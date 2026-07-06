// Orchestrator for the CSS cleanup safe-loop (serial, one file at a time).
//
// Wraps the existing, proven pieces into a self-verifying loop:
//   css-snapshot.mjs (golden master) → css-snapshot-diff.mjs (gate 1) → tests (gate 2)
//
// CRITICAL: capture is ALWAYS headed + all-instances. Headless does not
// faithfully render this app's token/glass/canvas components (see
// css-page-report.mjs header), so a headless golden master would compare two
// equally-wrong snapshots and pass a real regression. --all captures every
// instance of each selector, not just the first.
//
// Two phases (no interactive prompts — this env can't answer them):
//
//   # 1) BEFORE you edit the css file — capture the baseline
//   node scripts/css-cleanup/run.mjs before --file app/styles/.../hc.css [--noise-runs 2]
//
//   # 2) ...make your edit...
//
//   # 3) AFTER — capture again, diff, run tests, decide
//   node scripts/css-cleanup/run.mjs verify --file app/styles/.../hc.css [--auto-revert]
//
// --noise-runs N (before): re-capture the UNCHANGED baseline N times and record
//   the cells that differ between clean captures (async render noise: Leaflet,
//   scroll/layout settle, identity transforms). verify auto-subtracts that noise
//   floor so it can't masquerade as a regression. Use this for files whose gate
//   touches map/scroll/animated surfaces (was the manual technique that proved
//   service-map/desktop was NOT "locked" — see css-important-reduction-method.md).
//
// Gate verdict: green only if computed-style diff is identical AND tests pass.
// On red with --auto-revert, the file is reverted IF it is the only working-tree
// change (never clobbers unrelated edits).
//
// Coverage:
//   default        → scripts/css-snapshot.targets.generated.json (full, run targets-gen first)
//   --targets <f>  → explicit targets file
//   --selectors a,b→ narrow the generated targets to these selectors (fast inner
//                    loop). The FULL run is still mandatory before commit.
//
// Tests: on by default for verify; --no-tests skips (use only for fast iteration,
// never as the final gate). Auth for snapshots: env SNAPSHOT_SESSION or --token
// (passed through to css-snapshot.mjs).
//
// Flags: --base-url <url> --token <t> --label <name> (override the state key)

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const STATE_DIR = "reports/css-cleanup/state";
const DEFAULT_TARGETS = "scripts/css-snapshot.targets.generated.json";

function parseArgs(argv) {
  const cmd = argv[0];
  const out = {
    cmd,
    file: null,
    label: null,
    targets: DEFAULT_TARGETS,
    selectors: null,
    tests: true,
    autoRevert: false,
    baseUrl: "http://localhost:3000",
    token: null,
    noiseRuns: 1,
  };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file") out.file = argv[++i];
    else if (a === "--label") out.label = argv[++i];
    else if (a === "--targets") out.targets = argv[++i];
    else if (a === "--selectors") out.selectors = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--tests") out.tests = true;
    else if (a === "--no-tests") out.tests = false;
    else if (a === "--auto-revert") out.autoRevert = true;
    else if (a === "--base-url") out.baseUrl = argv[++i];
    else if (a === "--token") out.token = argv[++i];
    else if (a === "--noise-runs") out.noiseRuns = Math.max(1, parseInt(argv[++i], 10) || 1);
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (cmd !== "before" && cmd !== "verify") {
    throw new Error("Usage: run.mjs <before|verify> --file <css> [options]");
  }
  if (!out.file && !out.label) throw new Error("--file (or --label) is required");
  return out;
}

const keyFor = (args) =>
  args.label
    ? args.label.replace(/[^a-z0-9._-]/gi, "_")
    : createHash("sha1").update(args.file).digest("hex").slice(0, 12);

// Narrow the generated targets to a selector subset (fast inner loop). Targets
// that retain no selectors are dropped.
function buildScopedTargets(targetsPath, selectors, outPath) {
  const all = JSON.parse(readFileSync(targetsPath, "utf8"));
  const set = new Set(selectors);
  const scoped = all
    .map((t) => ({ ...t, selectors: t.selectors.filter((s) => set.has(s)) }))
    .filter((t) => t.selectors.length > 0);
  writeFileSync(outPath, JSON.stringify(scoped, null, 2));
  return scoped.length;
}

function captureSnapshot({ targetsPath, outPath, baseUrl, token }) {
  const a = ["scripts/css-snapshot.mjs", "--targets", targetsPath, "--out", outPath, "--base-url", baseUrl, "--headed", "--all"];
  if (token) a.push("--token", token);
  const r = spawnSync("node", a, { stdio: "inherit", env: process.env });
  return r.status ?? 1;
}

function gitOnlyFileChanged(file) {
  const r = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" });
  if (r.status !== 0) return false;
  const changed = r.stdout.split("\n").map((l) => l.slice(3).trim()).filter(Boolean);
  const norm = (p) => p.replace(/\\/g, "/");
  return changed.length === 1 && norm(changed[0]) === norm(file);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(STATE_DIR, { recursive: true });
  const key = keyFor(args);
  const beforePath = path.join(STATE_DIR, `${key}.before.json`);
  const afterPath = path.join(STATE_DIR, `${key}.after.json`);
  const metaPath = path.join(STATE_DIR, `${key}.meta.json`);
  const noisePath = path.join(STATE_DIR, `${key}.noise.json`);

  if (!existsSync(args.targets)) {
    console.error(`✖ targets file not found: ${args.targets}\n  Run: node scripts/css-cleanup/targets-gen.mjs`);
    process.exit(2);
  }

  // Resolve targets (scoped or full) once; verify reuses what before recorded.
  let targetsPath = args.targets;
  if (args.cmd === "before") {
    if (args.selectors) {
      targetsPath = path.join(STATE_DIR, `${key}.scoped-targets.json`);
      const n = buildScopedTargets(args.targets, args.selectors, targetsPath);
      console.log(`scoped to ${args.selectors.length} selector(s) → ${n} target(s): ${targetsPath}`);
      console.log("  ⚠ scoped run is a FAST inner loop, NOT the safety gate. Re-run full before commit.");
    }
    console.log(`\n▶ BEFORE  key=${key}  file=${args.file ?? "(label)"}\n  targets=${targetsPath}  (headed, all instances)`);
    const code = captureSnapshot({ targetsPath, outPath: beforePath, baseUrl: args.baseUrl, token: args.token });
    if (code !== 0) { console.error("✖ baseline capture failed"); process.exit(code); }

    // Noise-floor: re-capture the UNCHANGED baseline N-1 more times and record
    // every cell that differs between clean captures. These are async render
    // noise (Leaflet, scroll/layout settle, identity transforms that slipped
    // canonicalization) — verify subtracts them so they can't masquerade as a
    // regression (see reports/css-important-reduction-method.md MÜRA-PÕRAND).
    let noiseCaptured = false;
    if (args.noiseRuns >= 2) {
      if (existsSync(noisePath)) spawnSync("node", ["-e", `require('fs').unlinkSync(${JSON.stringify(noisePath)})`]);
      console.log(`\n  measuring noise floor: ${args.noiseRuns - 1} extra baseline capture(s)…`);
      const extraPath = path.join(STATE_DIR, `${key}.noise-extra.json`);
      for (let i = 1; i < args.noiseRuns; i++) {
        const c = captureSnapshot({ targetsPath, outPath: extraPath, baseUrl: args.baseUrl, token: args.token });
        if (c !== 0) { console.error("✖ noise-floor capture failed"); process.exit(c); }
        spawnSync("node", ["scripts/css-snapshot-diff.mjs", beforePath, extraPath, "--emit-noise", noisePath], { stdio: "inherit" });
      }
      noiseCaptured = existsSync(noisePath);
    }
    writeFileSync(metaPath, JSON.stringify({ file: args.file, label: args.label, targetsPath, baseUrl: args.baseUrl, noisePath: noiseCaptured ? noisePath : null, createdAt: new Date().toISOString() }, null, 2));
    console.log(`\n✓ baseline saved: ${beforePath}${noiseCaptured ? `\n✓ noise floor: ${noisePath}` : ""}\n  Now make your edit, then: node scripts/css-cleanup/run.mjs verify --file ${args.file ?? ""}`.trimEnd());
    return;
  }

  // verify
  if (!existsSync(metaPath) || !existsSync(beforePath)) {
    console.error(`✖ no baseline for key=${key}. Run 'before' first.`);
    process.exit(2);
  }
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  targetsPath = meta.targetsPath; // identical scope before/after
  console.log(`\n▶ VERIFY  key=${key}  file=${meta.file ?? "(label)"}\n  targets=${targetsPath}  (headed, all instances)`);

  const capCode = captureSnapshot({ targetsPath, outPath: afterPath, baseUrl: args.baseUrl, token: args.token });
  if (capCode !== 0) { console.error("✖ after capture failed"); process.exit(capCode); }

  // Gate 1: computed-style diff (subtracting the recorded noise floor, if any).
  console.log("\n— Gate 1: computed-style diff —");
  const diffArgs = ["scripts/css-snapshot-diff.mjs", beforePath, afterPath];
  if (meta.noisePath && existsSync(meta.noisePath)) {
    diffArgs.push("--noise", meta.noisePath);
    console.log(`  (subtracting noise floor: ${meta.noisePath})`);
  }
  const diff = spawnSync("node", diffArgs, { stdio: "inherit" });
  const diffOk = diff.status === 0;

  // Gate 2: test baseline (optional).
  let testsOk = true;
  if (args.tests) {
    console.log("\n— Gate 2: test suite —");
    const t = spawnSync("npm", ["test"], { stdio: "inherit", env: process.env, shell: process.platform === "win32" });
    testsOk = t.status === 0;
  } else {
    console.log("\n— Gate 2: SKIPPED (--no-tests) — not a valid final gate —");
  }

  const green = diffOk && testsOk;
  console.log(`\n${"=".repeat(48)}`);
  console.log(`Gate 1 (visual)  : ${diffOk ? "✓ identical" : "✖ CHANGED"}`);
  console.log(`Gate 2 (tests)   : ${args.tests ? (testsOk ? "✓ pass" : "✖ fail") : "– skipped"}`);
  console.log(`VERDICT          : ${green ? "🟢 SAFE — ok to commit" : "🔴 BLOCKED"}`);
  console.log("=".repeat(48));

  if (!green && args.autoRevert) {
    if (meta.file && gitOnlyFileChanged(meta.file)) {
      const rev = spawnSync("git", ["checkout", "--", meta.file], { stdio: "inherit" });
      console.log(rev.status === 0 ? `↩ auto-reverted ${meta.file}` : `⚠ auto-revert failed for ${meta.file}`);
    } else {
      console.log("⚠ auto-revert skipped: working tree has other changes (won't clobber). Revert manually.");
    }
  }

  process.exit(green ? 0 : 1);
}

try {
  main();
} catch (e) {
  console.error(`✖ ${e.message}`);
  process.exit(2);
}
