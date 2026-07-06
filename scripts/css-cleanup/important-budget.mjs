// !important budget guard — freezes the debt so it can only shrink.
//
// Counts every `!important` in author CSS (app/styles/** + components/**) and
// fails if the total exceeds the committed budget. The budget is a ceiling, not
// a target: lower it whenever the count drops (the script prints the new floor).
// New work / a future redesign therefore cannot quietly reintroduce the
// !important-war disease — adding one without removing one is a red build.
//
// Why a budget and not stylelint `declaration-no-important`: the codebase has a
// large EXISTING load-bearing population (see css-cleanup/important-ledger.md);
// a blanket rule would flag all ~2000. The budget blocks NET-NEW growth while
// leaving the existing (justified) markers alone.
//
// Usage:
//   node scripts/css-cleanup/important-budget.mjs          # check against budget
//   node scripts/css-cleanup/important-budget.mjs --set     # set budget = current count
//
// Wire into CI / `npm test` to enforce. Budget file: reports/css-cleanup/important-budget.json

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const ROOTS = ["app/styles", "components"];
const BUDGET_FILE = "reports/css-cleanup/important-budget.json";

function cssFiles(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e);
    let s;
    try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) {
      if (e === "node_modules" || e === ".next") continue;
      cssFiles(p, out);
    } else if (e.endsWith(".css")) out.push(p);
  }
  return out;
}

function countImportant() {
  let total = 0;
  const perFile = {};
  for (const root of ROOTS) {
    for (const f of cssFiles(root)) {
      const text = readFileSync(f, "utf8");
      const n = (text.match(/!important/g) || []).length;
      if (n) perFile[f] = n;
      total += n;
    }
  }
  return { total, perFile };
}

const setMode = process.argv.includes("--set");
const { total, perFile } = countImportant();

if (setMode) {
  writeFileSync(BUDGET_FILE, JSON.stringify({ budget: total, setAt: new Date().toISOString(), note: "!important ceiling; lower as the count drops, never raise without justification" }, null, 2) + "\n");
  console.log(`✓ budget set to ${total} (${Object.keys(perFile).length} files)`);
  process.exit(0);
}

if (!existsSync(BUDGET_FILE)) {
  console.error(`✖ no budget file at ${BUDGET_FILE}. Run with --set to create it.`);
  process.exit(2);
}
const budget = JSON.parse(readFileSync(BUDGET_FILE, "utf8")).budget;

if (total > budget) {
  console.error(`✖ !important BUDGET EXCEEDED: ${total} > ${budget} (+${total - budget} net-new).`);
  console.error("  Adding an !important without removing one is blocked. Top files:");
  for (const [f, n] of Object.entries(perFile).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.error(`    ${n}  ${f}`);
  }
  console.error("  If this is genuinely load-bearing and justified, lower the floor elsewhere or update the budget with a note.");
  process.exit(1);
}

console.log(`✓ !important within budget: ${total} / ${budget}${total < budget ? `  (${budget - total} under — run --set to ratchet the floor down to ${total})` : ""}`);
process.exit(0);
