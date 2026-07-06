// Strip !important from a theme file, but KEEP markers that contract tests
// assert by source text. The audit proved theme overrides are render-redundant
// (win by specificity without !important); the only reason to keep a marker is a
// source-text contract test. So: collect every `prop:\s*value\s*!important`
// pattern asserted across the given test files, and keep a theme declaration's
// !important iff its (prop, normalized-value) matches an asserted pair.
//
// Over-keep is SAFE (a coincidental value match just leaves an extra marker);
// under-keep is caught by `npm test`. Run the test gate after applying.
//
// Usage:
//   node scripts/css-cleanup/theme-strip-keepasserted.mjs \
//     --file app/styles/theme/hc.css \
//     --tests t1.test.js,t2.test.js,... \
//     [--apply]   (default dry-run)

import { readFileSync, writeFileSync } from "node:fs";

function parseArgs(argv) {
  const out = { file: null, tests: [], apply: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file") out.file = argv[++i];
    else if (a === "--tests") out.tests = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--apply") out.apply = true;
  }
  if (!out.file || !out.tests.length) throw new Error("--file and --tests required");
  return out;
}

// Turn a regex-source value fragment into a comparable CSS value: drop \s*/\s+,
// unescape backslash-escaped punctuation, remove all whitespace, lowercase.
function normFromRegex(s) {
  return s
    .replace(/\\s\*/g, "")
    .replace(/\\s\+/g, "")
    .replace(/\\([().,/[\]{}*+?|^$-])/g, "$1")
    .replace(/\s+/g, "")
    .toLowerCase();
}
const normCss = (s) => s.replace(/\s+/g, "").toLowerCase();

function main() {
  const args = parseArgs(process.argv.slice(2));

  // Asserted (prop|value) pairs from the test sources.
  const asserted = new Set();
  const assertRe = /([a-z][a-z-]+)\s*:\s*\\s\*([\s\S]*?)\\s\*!important/g;
  for (const tf of args.tests) {
    const t = readFileSync(tf, "utf8");
    let m;
    while ((m = assertRe.exec(t))) {
      asserted.add(`${m[1].toLowerCase()}|${normFromRegex(m[2])}`);
    }
  }

  // Walk theme declarations; strip marker unless (prop|value) is asserted.
  const css = readFileSync(args.file, "utf8");
  let keep = 0, strip = 0;
  const stripProps = {};
  const keptExamples = [];
  const out = css.replace(/([a-z-]+)\s*:\s*([^;{}]*?)\s*!important/g, (full, prop, val) => {
    const key = `${prop.toLowerCase()}|${normCss(val)}`;
    if (asserted.has(key)) {
      keep++;
      if (keptExamples.length < 15) keptExamples.push(`${prop}: ${val.trim()}`);
      return full; // keep !important
    }
    strip++;
    stripProps[prop] = (stripProps[prop] || 0) + 1;
    return `${prop}: ${val}`; // drop !important
  });

  if (args.apply) writeFileSync(args.file, out);

  process.stderr.write(
    `${args.apply ? "APPLIED" : "DRY-RUN"} ${args.file}\n` +
    `  asserted pairs: ${asserted.size} | !important total: ${keep + strip} | KEEP: ${keep} | STRIP: ${strip}\n`
  );
  process.stderr.write("  KEEP examples:\n");
  for (const e of keptExamples) process.stderr.write(`    ${e}\n`);
  process.stderr.write("  STRIP props (top):\n");
  for (const [p, c] of Object.entries(stripProps).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    process.stderr.write(`    ${c}x ${p}\n`);
  }
}

main();
