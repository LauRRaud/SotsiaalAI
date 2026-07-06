// Coverage generator for the CSS cleanup safe-loop.
//
// WHY: css-snapshot.mjs is only as safe as its target list. The hand-curated
// scripts/css-snapshot.targets.json covers ~7 selectors, but css-page-report
// tracks the full primitive set across every route × theme. A change can move a
// computed style on a selector the snapshot never watches → "green" is then a
// false sense of safety. This script DERIVES a comprehensive snapshot target
// file from the same selector/flow universe page-report already uses, so the
// golden-master net covers every tracked primitive.
//
// Inputs (reused, not duplicated):
//   scripts/css-page-report.targets.json   — selectors[], keyProps[], tokens[], flows[]
//   scripts/css-effective-audit.routes.json — [{ route, auth }] (46 routes)
//
// Output:
//   scripts/css-snapshot.targets.generated.json — array consumed by css-snapshot.mjs
//   The hand-curated css-snapshot.targets.json is left untouched (ad-hoc diffs).
//
// Two property kinds are captured, both readable via getComputedStyle:
//   1. keyProps  → converted camelCase → kebab-case (getPropertyValue wants kebab)
//   2. tokens    → CSS custom properties as-is (e.g. --btn-primary-bg). Capturing
//                  these means a change to a TOKEN VALUE is caught even if the
//                  painted result happens to match — a stronger net.
//
// Usage:
//   node scripts/css-cleanup/targets-gen.mjs \
//     [--page-targets scripts/css-page-report.targets.json] \
//     [--routes scripts/css-effective-audit.routes.json] \
//     [--out scripts/css-snapshot.targets.generated.json]

import { readFileSync, writeFileSync } from "node:fs";

function parseArgs(argv) {
  const out = {
    pageTargets: "scripts/css-page-report.targets.json",
    routes: "scripts/css-effective-audit.routes.json",
    out: "scripts/css-snapshot.targets.generated.json",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--page-targets") out.pageTargets = argv[++i];
    else if (a === "--routes") out.routes = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

const kebab = (s) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

// page-report flow steps speak {waitFor, click, waitMs, goto}; css-snapshot's
// runSteps speaks {hover, click, focus, fill, move} + (after our enhancement)
// {waitFor}. Translate what maps cleanly; warn on the rest so coverage gaps are
// never silent.
function translateSteps(steps, flowName) {
  const out = [];
  for (const step of steps ?? []) {
    if (step.click != null) out.push({ click: step.click });
    else if (step.waitFor != null) out.push({ waitFor: step.waitFor });
    else if (step.waitMs != null) {
      // Intentionally dropped: css-snapshot freezes motion + flushes frames and
      // (via waitFor) gates on real conditions, so a guessed delay is not needed.
    } else if (step.goto != null) {
      console.warn(`  ⚠ flow "${flowName}": {goto} step not supported by css-snapshot targets — skipped`);
    } else {
      console.warn(`  ⚠ flow "${flowName}": unrecognized step ${JSON.stringify(step)} — skipped`);
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const page = JSON.parse(readFileSync(args.pageTargets, "utf8"));
  const routesRaw = JSON.parse(readFileSync(args.routes, "utf8"));
  const routes = Array.isArray(routesRaw) ? routesRaw : routesRaw.routes ?? [];

  const selectors = page.selectors ?? [];
  const keyProps = page.keyProps ?? [];
  const tokens = page.tokens ?? [];
  const flows = page.flows ?? [];

  // properties captured on every selector: painted key props (kebab) + tokens.
  const properties = [...keyProps.map(kebab), ...tokens];

  // auth lookup by route (flows reference a route by path).
  const authByRoute = new Map(routes.map((r) => [r.route, r.auth !== false]));

  const targets = [];

  // One target per route: all global selectors, all properties.
  for (const r of routes) {
    targets.push({
      name: `route:${r.route}`,
      route: r.route,
      auth: r.auth !== false,
      selectors,
      properties,
    });
  }

  // One target per flow: route + translated steps + (global ∪ flow) selectors.
  for (const f of flows) {
    const flowSelectors = Array.from(new Set([...selectors, ...(f.selectors ?? [])]));
    targets.push({
      name: `${f.route}#${f.name}`,
      route: f.route,
      auth: authByRoute.get(f.route) ?? true,
      steps: translateSteps(f.steps, f.name),
      selectors: flowSelectors,
      properties,
    });
  }

  writeFileSync(args.out, JSON.stringify(targets, null, 2));

  const selSlots = targets.reduce((n, t) => n + t.selectors.length, 0);
  console.log(`wrote ${args.out}`);
  console.log(`  targets: ${targets.length} (${routes.length} routes + ${flows.length} flows)`);
  console.log(`  selectors: ${selectors.length} global, ${selSlots} total selector-slots`);
  console.log(`  properties per selector: ${properties.length} (${keyProps.length} keyProps kebab + ${tokens.length} tokens)`);
}

main();
