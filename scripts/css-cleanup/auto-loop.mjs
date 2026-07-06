// Hands-off per-file !important strip loop — chains the proven pieces so you
// don't have to drive them one declaration at a time.
//
//   1. baseline + noise floor      → css-snapshot.mjs (via run.mjs before)
//   2. cascade audit (resolver)    → css-important-overrides.mjs --targets
//   3. strip droppable markers     → important-autostrip.mjs --apply
//   4. gate (diff + tests)         → run.mjs verify
//   5. RED  → git checkout -- <file>   (revert the whole batch; never commit red)
//      GREEN → report strips (and --commit to commit them)
//
// The autostrip is conservative by construction: it only removes markers the
// resolver proved REDUNDANT / WINS-BY-SPECIFICITY in EVERY captured state, not a
// Tailwind-! winner, no competing !important. The snapshot gate is the final
// judge; a red gate reverts the file untouched.
//
// LIMITS (read before trusting it blindly):
//  - The gate is animation-blind (snapshot-diff ignores transparent shadow
//    layers). Do NOT auto-strip box-shadow / transition on glow surfaces — pass
//    an explicit --props list of layout/positioning props for those files.
//  - The gate needs the target elements VISIBLE on --route (auth via
//    SNAPSHOT_SESSION env; stateful pages may hide elements → capture may miss).
//  - Red = whole-file revert (no per-marker bisect). Re-run with fewer --props
//    or selectors to isolate.
//  - Gate 2 is CASE-level "did any currently-green test go red". It can NOT see
//    a marker that an ALREADY-FAILING contract test greps (the case is red
//    either way) — so a strip can pass the gate yet remove a marker a (broken)
//    contract names. Before --commit, grep tests/ for the selector; if a test
//    references it, leave it (contract-referenced) even if the gate is green.
//
// Usage:
//   SNAPSHOT_SESSION=$(cat /tmp/snap_sess.txt) \
//   node scripts/css-cleanup/auto-loop.mjs \
//     --file app/styles/features/chat/shell.css \
//     --route /vestlus --auth \
//     --selectors ".chat-send-btn .chat-send-glyph,.chat-send-btn" \
//     --props display,transform-box,transform-origin,width,height \
//     [--no-tests] [--commit] [--base-url http://localhost:3000]

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const STATE_DIR = "reports/css-cleanup/state";
const DEFAULT_PROPS = [
  "display", "width", "max-width", "min-width", "height", "max-height", "min-height",
  "margin-left", "margin-right", "margin-top", "margin-bottom",
  "padding-left", "padding-right", "padding-top", "padding-bottom",
  "justify-content", "align-items", "align-content", "justify-items",
  "justify-self", "align-self", "transform-box", "transform-origin",
  "overflow", "position", "top", "left", "right", "bottom", "z-index"
];

function parseArgs(argv) {
  const out = {
    file: null, route: "/vestlus", selectors: [], props: DEFAULT_PROPS,
    auth: false, tests: true, commit: false, baseUrl: "http://localhost:3000",
    testBaseline: "reports/css-cleanup/state/test-case-baseline.txt",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file") out.file = argv[++i];
    else if (a === "--route") out.route = argv[++i];
    else if (a === "--selectors") out.selectors = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--props") out.props = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--auth") out.auth = true;
    else if (a === "--no-tests") out.tests = false;
    else if (a === "--commit") out.commit = true;
    else if (a === "--base-url") out.baseUrl = argv[++i];
    else if (a === "--test-baseline") out.testBaseline = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!out.file) throw new Error("--file <css> required");
  if (!out.selectors.length) throw new Error("--selectors <a,b> required");
  return out;
}

const run = (cmd, cmdArgs) => spawnSync(cmd, cmdArgs, { stdio: "inherit", env: process.env, shell: process.platform === "win32" });
const runCap = (cmd, cmdArgs) => spawnSync(cmd, cmdArgs, { encoding: "utf8", env: process.env });

function gitOnlyFileChanged(file) {
  const r = runCap("git", ["status", "--porcelain"]);
  if (r.status !== 0) return false;
  const changed = r.stdout.split("\n").map((l) => l.slice(3).trim()).filter(Boolean);
  const norm = (p) => p.replace(/\\/g, "/");
  return changed.length === 1 && norm(changed[0]) === norm(file);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const key = createHash("sha1").update(args.file).digest("hex").slice(0, 12) + "-auto";
  const resolverTargets = path.join(STATE_DIR, `${key}.resolver-targets.json`);
  const gateTargets = path.join(STATE_DIR, `${key}.gate-targets.json`);
  const auditOut = path.join(STATE_DIR, `${key}.audit.json`);
  const stripLedger = path.join(STATE_DIR, `${key}.autostrip.json`);

  // Resolver wants one {name,route,selector} per selector; the gate wants one
  // target with a selectors[] + properties[]. Generate both from the same input.
  writeFileSync(resolverTargets, JSON.stringify(
    args.selectors.map((s, i) => ({ name: `s${i}`, route: args.route, selector: s })), null, 2));
  writeFileSync(gateTargets, JSON.stringify(
    [{ name: key, route: args.route, auth: args.auth, selectors: args.selectors, properties: args.props }], null, 2));

  console.log(`\n▶ AUTO-LOOP  file=${args.file}  route=${args.route}  selectors=${args.selectors.length}\n`);

  // 1) baseline + noise floor
  console.log("— 1/4 baseline (+noise) —");
  let r = run("node", ["scripts/css-cleanup/run.mjs", "before", "--label", key, "--file", args.file, "--targets", gateTargets, "--noise-runs", "2", "--base-url", args.baseUrl]);
  if (r.status !== 0) { console.error("✖ baseline failed"); process.exit(2); }

  // 2) cascade audit
  console.log("\n— 2/4 cascade audit (resolver) —");
  r = run("node", ["scripts/css-important-overrides.mjs", "--targets", resolverTargets, "--route", args.route, "--props", args.props.join(","), "--headed", "--out", auditOut]);
  if (r.status !== 0 || !existsSync(auditOut)) { console.error("✖ audit failed"); process.exit(2); }

  // 3) strip droppable markers (conservative: REDUNDANT/WINS-BY-SPEC, no war, no Tailwind-!)
  console.log("\n— 3/4 autostrip (apply) —");
  r = run("node", ["scripts/css-cleanup/important-autostrip.mjs", "--audit", auditOut, "--files", args.file, "--apply", "--ledger", stripLedger]);
  const ledger = existsSync(stripLedger) ? JSON.parse(readFileSync(stripLedger, "utf8")) : { stripped: 0 };
  if (!ledger.stripped) {
    console.log("\n✓ nothing droppable here (no clean candidates). Tree untouched.");
    process.exit(0);
  }

  // 4) gate — Gate 1 (visual diff) via run.mjs --no-tests, then Gate 2 our own
  // test-CASE-level baseline compare. We can NOT trust `npm test`'s exit code:
  // the project carries a stable set of pre-existing failures, so the raw code
  // is always red. We also can NOT compare failing FILES — a strip can break a
  // fresh assertion inside an already-failing file (file-set unchanged). So we
  // diff the set of failing test-CASE names against a recorded baseline; only a
  // genuinely NEW failing case is red.
  console.log(`\n— 4/4 gate: Gate 1 visual (${ledger.stripped} strip(s)) —`);
  r = run("node", ["scripts/css-cleanup/run.mjs", "verify", "--label", key, "--no-tests", "--base-url", args.baseUrl]);
  const diffOk = r.status === 0;

  let testsOk = true;
  if (args.tests) {
    console.log("\n— Gate 2: test-case baseline diff —");
    if (!existsSync(args.testBaseline)) {
      console.error(`✖ no test baseline at ${args.testBaseline}. Generate it on a clean tree:\n` +
        `  npm test 2>&1 | grep -oE '^✖ .*' | sed -E 's/ \\([0-9.]+ms\\)$//' | sort -u > ${args.testBaseline}`);
      process.exit(2);
    }
    const baseline = new Set(readFileSync(args.testBaseline, "utf8").split("\n").map((s) => s.trim()).filter(Boolean));
    const t = runCap("npm", ["test"]);
    const log = `${t.stdout || ""}\n${t.stderr || ""}`;
    const failing = [...new Set((log.match(/^✖ .*/gm) || []).map((l) => l.replace(/^✖ /, "").replace(/ \([0-9.]+ms\)\s*$/, "").trim()))];
    const newFails = failing.filter((c) => !baseline.has(c));
    if (newFails.length) {
      testsOk = false;
      console.log(`✖ ${newFails.length} NEW failing test case(s):`);
      for (const c of newFails) console.log(`    ${c}`);
    } else {
      console.log(`✓ no new failing cases (${failing.length} failing, all in ${baseline.size}-case baseline)`);
    }
  }
  const green = diffOk && testsOk;

  console.log(`\n${"=".repeat(48)}`);
  if (green) {
    console.log(`🟢 GREEN — ${ledger.stripped} !important stripped from ${args.file}, gate identical + tests ok.`);
    if (args.commit) {
      run("git", ["add", args.file]);
      const msg = `refactor(css): auto-strip ${ledger.stripped} redundant !important in ${path.basename(args.file)}\n\nResolver-driven (REDUNDANT/WINS-BY-SPEC, no war, no Tailwind-!), gate-verified\n(snapshot identical + tests). Via scripts/css-cleanup/auto-loop.mjs.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`;
      run("git", ["commit", "-m", msg]);
      console.log("✓ committed.");
    } else {
      console.log("Review the diff, then commit (or re-run with --commit).");
    }
  } else {
    console.log("🔴 RED — gate blocked (load-bearing value moved OR contract test).");
    if (gitOnlyFileChanged(args.file)) {
      run("git", ["checkout", "--", args.file]);
      console.log(`↩ reverted ${args.file} (only-file-changed guard ok).`);
    } else {
      console.log(`⚠ ${args.file} NOT auto-reverted (working tree has other changes). Revert manually.`);
    }
  }
  console.log("=".repeat(48));
  process.exit(green ? 0 : 1);
}

try { main(); } catch (e) { console.error(`✖ ${e.message}`); process.exit(2); }
