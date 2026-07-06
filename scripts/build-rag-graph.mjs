#!/usr/bin/env node

// Graph-lite phase 1 offline builder: scans KOV canonical bundles and emits a
// deterministic entity/relation plan as JSON. It does NOT write to any
// database — applying the plan requires the RagEntity/RagRelation migration,
// which is a separate, explicitly approved step.

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { buildKovGraph, mergeGraphBuilds } from "../lib/rag/graph/kovGraphBuilder.js";

const DEFAULT_KOV_ROOT = "KOV";

function usage() {
  return [
    "Usage:",
    "  npm run rag:graph:plan -- --json reports/rag-graph-plan.json",
    "  npm run rag:graph:plan -- --root KOV --municipality kuusalu-vald",
    "",
    "Scans KOV/<slug>/<slug>.json canonical bundles and builds the phase 1",
    "deterministic graph plan (entities + evidence-carrying relations).",
    "No database writes."
  ].join("\n");
}

function parseArgs(argv = []) {
  const args = { root: DEFAULT_KOV_ROOT, jsonPath: null, municipalities: [], help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--root") args.root = argv[++index] || args.root;
    else if (arg === "--json") args.jsonPath = argv[++index] || null;
    else if (arg === "--municipality") args.municipalities.push(argv[++index] || "");
    else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

async function loadBundles(root, municipalities = []) {
  const bundles = [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "kov_rt") continue;
    if (municipalities.length > 0 && !municipalities.includes(entry.name)) continue;
    const bundlePath = path.join(root, entry.name, `${entry.name}.json`);
    try {
      const raw = await fs.readFile(bundlePath, "utf8");
      bundles.push({ slug: entry.name, bundle: JSON.parse(raw) });
    } catch {
      // No canonical bundle for this folder; skip silently.
    }
  }
  return bundles;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const bundles = await loadBundles(args.root, args.municipalities);
  if (bundles.length === 0) throw new Error(`No KOV bundles found under ${args.root}`);

  const builds = bundles.map(({ slug, bundle }) => {
    const build = buildKovGraph(bundle);
    return { ...build, slug };
  });
  const merged = mergeGraphBuilds(builds);

  const output = {
    ok: true,
    mode: "plan-only",
    generated_at: new Date().toISOString(),
    kov_root: args.root,
    bundle_count: bundles.length,
    summary: merged.summary,
    warnings: merged.warnings.slice(0, 100),
    entities: merged.entities,
    relations: merged.relations
  };

  if (args.jsonPath) await fs.writeFile(args.jsonPath, JSON.stringify(output, null, 2), "utf8");
  console.log(JSON.stringify({
    ok: true,
    bundle_count: bundles.length,
    summary: merged.summary,
    warning_sample: merged.warnings.slice(0, 10)
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(JSON.stringify({ ok: false, error: error?.message || String(error) }));
    process.exitCode = 1;
  });
}
