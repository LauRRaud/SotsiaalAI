// File-scoped golden-master target generator.
//
// For a "golden master refactor" you capture the rendered TRUTH of a file's
// surface once, rewrite the source freely, then prove the computed output is
// unchanged. That is only safe if coverage == the file's footprint. This script
// derives that footprint straight from the CSS file:
//
//   selectors  = every class token the file targets (one-class selectors are
//                enough — querySelector finds the element and getComputedStyle
//                reflects ALL applicable rules, incl. compound/attr ones)
//   properties = union(page-report keyProps, props the file declares) — so a
//                cascade shift into a property the file *doesn't* set is still seen
//
// Output: a css-snapshot targets file (route × selectors) for the chosen themes.
// Selectors that render only inside modals/overlays won't appear on plain routes
// (captured as null) — those need a flow; the script flags likely modal classes
// so the coverage gap is explicit, never silent.
//
// Usage:
//   node scripts/css-cleanup/targets-from-css.mjs --css app/styles/theme/hc.css \
//     [--themes hc,light] [--routes scripts/css-effective-audit.routes.json] \
//     [--page-targets scripts/css-page-report.targets.json] \
//     [--out reports/css-cleanup/state/<file>.targets.json]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const out = {
    css: null,
    themes: null, // null = all themes css-snapshot knows; else comma list
    routes: "scripts/css-effective-audit.routes.json",
    pageTargets: "scripts/css-page-report.targets.json",
    out: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--css") out.css = argv[++i];
    else if (a === "--themes") out.themes = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--routes") out.routes = argv[++i];
    else if (a === "--page-targets") out.pageTargets = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!out.css) throw new Error("--css <file> is required");
  return out;
}

const kebab = (s) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

// Strip comments, then pull class tokens and declared property names.
function analyzeCss(src) {
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, "");

  // class tokens: .foo-bar (not inside url(), not numbers)
  const classes = new Set();
  for (const m of noComments.matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)) classes.add(`.${m[1]}`);

  // declared properties: "<prop>:" at a declaration position. Capture both
  // standard props and custom props (--x). Heuristic: word(+hyphens) or --word
  // immediately followed by ':' and later a ';' or '}'.
  const props = new Set();
  for (const m of noComments.matchAll(/(^|[{;])\s*(--[A-Za-z0-9_-]+|[a-z-]+)\s*:/g)) {
    const p = m[2];
    // skip pseudo-class-ish false hits (e.g. "hover" from :hover never matches
    // here because those follow ':' not precede it; this is declarations only)
    props.add(p);
  }
  return { classes: [...classes].sort(), props: [...props].sort() };
}

// Classes that, by name, usually render only behind an interaction (modal /
// overlay / dropdown / menu / panel opened on click). Flagged as needing a flow.
const MODAL_HINT = /(modal|overlay|drawer|dropdown-menu|popover|dialog|sheet|orbit-menu)/i;

function main() {
  const args = parseArgs(process.argv.slice(2));
  const src = readFileSync(args.css, "utf8");
  const routesRaw = JSON.parse(readFileSync(args.routes, "utf8"));
  const routes = Array.isArray(routesRaw) ? routesRaw : routesRaw.routes ?? [];
  const page = JSON.parse(readFileSync(args.pageTargets, "utf8"));
  const keyProps = (page.keyProps ?? []).map(kebab);

  const { classes, props } = analyzeCss(src);
  const properties = Array.from(new Set([...keyProps, ...props]));
  const selectors = classes;

  const targets = routes.map((r) => {
    const t = { name: `route:${r.route}`, route: r.route, auth: r.auth !== false, selectors, properties };
    if (args.themes) t.themes = args.themes;
    return t;
  });

  const base = path.basename(args.css).replace(/[^a-z0-9.]/gi, "_");
  const outPath = args.out ?? `reports/css-cleanup/state/${base}.targets.json`;
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(targets, null, 2));

  const modalish = selectors.filter((s) => MODAL_HINT.test(s));
  console.log(`wrote ${outPath}`);
  console.log(`  from: ${args.css}`);
  console.log(`  selectors (class tokens): ${selectors.length}`);
  console.log(`  properties: ${properties.length} (${keyProps.length} keyProps ∪ ${props.length} declared)`);
  console.log(`  themes: ${args.themes ? args.themes.join(",") : "all (css-snapshot default 6)"}`);
  console.log(`  routes: ${routes.length}`);
  console.log("");
  console.log(`  ⚠ likely modal/overlay-gated (need a flow to be captured, else null): ${modalish.length}`);
  if (modalish.length) console.log("    " + modalish.slice(0, 30).join("  "));
}

main();
