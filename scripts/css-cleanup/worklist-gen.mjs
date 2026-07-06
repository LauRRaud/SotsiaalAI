// Ranked worklist generator for the CSS cleanup safe-loop.
//
// Turns scripts/.../important.json (the !important debt measurement) into a
// data-driven, file-by-file worklist: which files carry the most !important,
// and within each, which rows are TOKENIZABLE (paint props → design tokens) vs
// STRUCTURAL (layout/behaviour → usually keep or delete, not tokenize).
//
// This is the "what to clean next" input; the safe-loop (run.mjs) then makes
// each change provably safe.
//
// Input:  newest reports/css-important-audit/<date>/important.json (or --in)
// Output: reports/css-cleanup/worklist-<date>.md (or --out)
//
// Usage:
//   node scripts/css-cleanup/worklist-gen.mjs [--in <important.json>] [--out <md>] [--top N]

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

// Paint props map to design tokens → tokenization candidates. Anything else is
// structural (layout/behaviour): keep, scope down, or delete — but not "tokenize".
const PAINT_PROPS = new Set([
  "color", "background", "background-color", "background-image",
  "border-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "box-shadow", "fill", "stroke", "outline-color", "text-decoration-color", "caret-color", "accent-color",
]);

function parseArgs(argv) {
  const out = { in: null, out: null, top: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--in") out.in = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--top") out.top = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

function newestImportantJson() {
  const base = "reports/css-important-audit";
  const dates = readdirSync(base).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!dates.length) throw new Error(`no dated dirs under ${base}`);
  return path.join(base, dates[dates.length - 1], "important.json");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inPath = args.in ?? newestImportantJson();
  const audit = JSON.parse(readFileSync(inPath, "utf8"));
  const rows = audit.rows ?? [];

  const byFile = new Map();
  for (const r of rows) {
    let e = byFile.get(r.file);
    if (!e) { e = { file: r.file, total: 0, tokenizable: 0, structural: 0, themeOverride: 0, props: new Map() }; byFile.set(r.file, e); }
    e.total++;
    if (PAINT_PROPS.has(r.prop)) e.tokenizable++; else e.structural++;
    if ((r.cats ?? []).includes("theme-override")) e.themeOverride++;
    e.props.set(r.prop, (e.props.get(r.prop) ?? 0) + 1);
  }

  let files = [...byFile.values()].sort((a, b) => b.total - a.total);
  if (args.top > 0) files = files.slice(0, args.top);

  const topProps = (m) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([p, n]) => `${p}×${n}`).join(", ");

  const date = new Date().toISOString().slice(0, 10);
  const L = [];
  L.push(`# CSS cleanup worklist — ${date}`);
  L.push("");
  L.push(`Source: \`${inPath}\` · total \`!important\`: **${audit.total}** · surfaces ${audit.surfaceCount} · theme-overrides ${audit.themeOverrideCount}`);
  L.push("");
  L.push("**Tokenizable** = paint props (color/bg/border-color/shadow…) → map to design tokens.");
  L.push("**Structural** = layout/behaviour → scope down or delete, do not tokenize.");
  L.push("Run each change through the safe-loop: `run.mjs before --file <f>` → edit → `run.mjs verify --file <f>`.");
  L.push("");
  L.push("| # | File | !important | tokenizable | structural | theme-ovr | top props |");
  L.push("|---|------|-----------:|------------:|-----------:|----------:|-----------|");
  files.forEach((e, i) => {
    L.push(`| ${i + 1} | \`${e.file}\` | ${e.total} | ${e.tokenizable} | ${e.structural} | ${e.themeOverride} | ${topProps(e.props)} |`);
  });
  L.push("");
  L.push("> Provenance / dead-code cross-check: see the per-route `.md` + `dead-candidates.md` + `consistency.md` in the newest `reports/css-page-report/<date>/`.");
  L.push("");

  const outPath = args.out ?? `reports/css-cleanup/worklist-${date}.md`;
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, L.join("\n"));
  console.log(`wrote ${outPath}`);
  console.log(`  files with !important: ${byFile.size}`);
  console.log(`  total rows: ${rows.length}`);
  console.log(`  top file: ${files[0]?.file} (${files[0]?.total})`);
}

main();
