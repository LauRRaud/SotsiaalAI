// Auto-strip "free" !important markers chosen by the cascade audit.
//
// Pipeline role: the AUDIT (css-important-overrides.mjs) is the SELECTOR, this
// script is the EDITOR, and the css-snapshot-diff + npm test gate is the JUDGE.
// This script only removes the ` !important` token from author declarations the
// audit proved are droppable in EVERY captured state (theme × viewport). It
// changes nothing else. After running it you MUST run the gate; a red gate means
// the audit was wrong for some candidate — revert and investigate.
//
// "Droppable" = for a (selector, prop): in every non-null captured state the
// winner is !important AND verdict ∈ {REDUNDANT, WINS-BY-SPECIFICITY}, the winner
// is NOT a Tailwind-`!` utility, and NO overriding rule is itself !important
// (no war). Those are exactly the cases where the rule keeps winning on
// specificity/layer once the marker is gone.
//
// Author-file resolution is by TEXT, not by chunk:line (the audit reports
// compiled chunks). For each droppable (prop, value) we search the given author
// files for `prop: value !important`. We strip ONLY when the match is
// unambiguous (exactly one occurrence across the files). Ambiguous / not-found
// candidates are logged and skipped — safe by construction, the gate never sees
// a guess.
//
// Usage:
//   node scripts/css-cleanup/important-autostrip.mjs \
//     --audit reports/css-cleanup/state/<audit>.json \
//     --files app/styles/features/policy/pages.css,...,responsive.css \
//     [--apply]   (default: dry-run, only report; --apply writes the strips)
//     [--ledger reports/css-cleanup/state/<name>.autostrip.json]

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// Contract pre-filter: a strip can pass the render+test gate yet remove a marker
// an ALREADY-FAILING contract test greps (the case is red either way, so the
// test-case gate can't see it). So we refuse to strip any (selector) whose class
// tokens appear anywhere under tests/. Conservative by design — better to skip a
// safe strip than to silently weaken a contract. Returns a Set of class tokens.
function testClassTokens(dir = "tests") {
  let text = "";
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const p = path.join(d, e);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else if (/\.(m?js|jsx|ts|tsx)$/.test(e)) text += readFileSync(p, "utf8") + "\n";
    }
  };
  try { walk(dir); } catch { /* no tests dir */ }
  return text;
}
const classTokens = (selector) => [...selector.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((m) => m[1]);

function parseArgs(argv) {
  const out = { audit: null, files: [], apply: false, ledger: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--audit") out.audit = argv[++i];
    else if (a === "--files") out.files = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--apply") out.apply = true;
    else if (a === "--ledger") out.ledger = argv[++i];
  }
  if (!out.audit) throw new Error("--audit <file> required");
  if (!out.files.length) throw new Error("--files <a.css,b.css> required");
  return out;
}

const DROPPABLE = new Set(["REDUNDANT", "WINS-BY-SPECIFICITY"]);
const norm = (s) => s.replace(/\s+/g, " ").trim();

// Collect droppable (prop, value) pairs from the audit: droppable only if EVERY
// state that declares the prop agrees, and none is a war / tailwind-! winner.
function droppableFromAudit(audit) {
  const out = [];
  for (const [name, t] of Object.entries(audit.targets || {})) {
    const perPropStates = {}; // prop -> array of state verdict info
    for (const perProp of Object.values(t.byState || {})) {
      if (!perProp) continue;
      for (const [prop, res] of Object.entries(perProp)) {
        (perPropStates[prop] ||= []).push(res);
      }
    }
    for (const [prop, states] of Object.entries(perPropStates)) {
      let ok = states.length > 0;
      let value = null;
      for (const res of states) {
        const competingImportant = (res.overridden || []).some((o) => o.important);
        if (
          !res.winner?.important ||
          res.winnerIsTailwindImportant ||
          !DROPPABLE.has(res.verdict) ||
          competingImportant
        ) { ok = false; break; }
        const v = norm(String(res.winner.value).replace(/!important/g, ""));
        if (value === null) value = v;
        else if (value !== v) { ok = false; break; } // value differs across states → not a clean strip
      }
      if (ok && value) out.push({ name, selector: t.selector, prop, value });
    }
  }
  return out;
}

// Find the single author occurrence of `prop: value !important` and return a
// strip edit, or a skip reason. We match on the declaration text with flexible
// whitespace; the value is taken verbatim from author source (not the audit's
// possibly-normalised computed string) by locating `prop:` then `!important`.
function locate(files, fileText, cand) {
  const hits = [];
  for (const f of files) {
    const text = fileText[f];
    // declaration regex: prop : <value> !important ;
    const re = new RegExp(`(^|[{;\\s])(${cand.prop})\\s*:\\s*([^;{}]*?)\\s*!important\\s*;`, "gi");
    let m;
    while ((m = re.exec(text))) {
      const declValue = norm(m[3]);
      if (declValue === cand.value) {
        hits.push({ file: f, index: m.index + m[0].indexOf(m[2]), full: m[0], decl: `${m[2]}: ${m[3]} !important;` });
      }
    }
  }
  if (hits.length === 0) return { skip: "not-found-or-value-mismatch" };
  if (hits.length > 1) return { skip: `ambiguous-${hits.length}-matches` };
  return { hit: hits[0] };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const audit = JSON.parse(readFileSync(args.audit, "utf8"));
  const fileText = {};
  for (const f of args.files) fileText[f] = readFileSync(f, "utf8");

  const cands = droppableFromAudit(audit);
  const strips = []; // {file, decl} to apply
  const skips = [];
  // edits per file: list of {full match string} to replace with !important removed
  const editsByFile = {};

  const testText = testClassTokens();

  for (const c of cands) {
    // Contract pre-filter: skip if any class in the selector is named in tests/.
    const guarded = classTokens(c.selector).find((t) => testText.includes(t));
    if (guarded) { skips.push({ ...c, reason: `contract-referenced-class-${guarded}` }); continue; }
    const r = locate(args.files, fileText, c);
    if (r.skip) { skips.push({ ...c, reason: r.skip }); continue; }
    const stripped = r.hit.full.replace(/\s*!important/i, "");
    (editsByFile[r.hit.file] ||= []).push({ from: r.hit.full, to: stripped, decl: r.hit.decl });
    strips.push({ file: r.hit.file, selector: c.selector, prop: c.prop, value: c.value });
  }

  // apply edits (string replace, first occurrence each — full match is unique)
  if (args.apply) {
    for (const [f, edits] of Object.entries(editsByFile)) {
      let text = fileText[f];
      for (const e of edits) text = text.replace(e.from, e.to);
      writeFileSync(f, text);
    }
  }

  const report = {
    audit: args.audit,
    applied: args.apply,
    droppableCandidates: cands.length,
    stripped: strips.length,
    skipped: skips.length,
    strips,
    skips,
  };
  if (args.ledger) writeFileSync(args.ledger, JSON.stringify(report, null, 2));

  process.stderr.write(
    `${args.apply ? "APPLIED" : "DRY-RUN"}: ${strips.length} strip(s), ${skips.length} skip(s) ` +
    `from ${cands.length} droppable candidate(s).\n`
  );
  for (const s of strips) process.stderr.write(`  strip  ${s.file}  ${s.prop}: ${s.value} !important  (${s.selector})\n`);
  for (const s of skips) process.stderr.write(`  skip   ${s.prop}: ${s.value}  [${s.reason}]\n`);
}

main();
