#!/usr/bin/env node

import { validateKovRtSlug } from "../lib/admin/rag/kov/rtManifest.js";

function parseArgs(argv = process.argv.slice(2)) {
  const args = { root: "KOV", slug: "", help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") args.root = String(argv[++index] || "").trim();
    else if (arg === "--slug") args.slug = String(argv[++index] || "").trim().toLowerCase();
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  return args;
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    console.log("Usage: npm run kov:validate-rt -- --root KOV --slug haljala-vald");
    return;
  }
  if (!args.slug) throw new Error("--slug is required");

  const result = await validateKovRtSlug(args.root, args.slug);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main().catch(error => {
  console.error(String(error?.message || error));
  process.exitCode = 1;
});
