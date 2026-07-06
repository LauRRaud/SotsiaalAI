#!/usr/bin/env node
import { loadManifest, upgradeKovBundle, writeUpgrade } from "./kovMetadataUpgradeLib.mjs";

function usage() {
  return [
    "Usage:",
    "  npm run kov:upgrade-metadata -- --slug <slug> --municipality <municipality_id> --county \"<county>\" --name \"<municipality_name>\" --write",
    "  npm run kov:upgrade-metadata:batch -- --manifest config/kov-metadata-upgrade-manifest.json --dry-run",
    "  npm run kov:upgrade-metadata:batch -- --manifest config/kov-metadata-upgrade-manifest.json --write"
  ].join("\n");
}

function parseArgs(argv) {
  const args = { dryRun: true, write: false, root: "KOV", batch: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--batch") args.batch = true;
    else if (arg === "--manifest") args.manifest = argv[++index];
    else if (arg === "--slug") args.slug = argv[++index];
    else if (arg === "--municipality") args.municipality_id = argv[++index];
    else if (arg === "--name" || arg === "--municipality-name") args.municipality_name = argv[++index];
    else if (arg === "--county") args.county = argv[++index];
    else if (arg === "--root") args.root = argv[++index] || args.root;
    else if (arg === "--write") { args.write = true; args.dryRun = false; }
    else if (arg === "--dry-run") { args.dryRun = true; args.write = false; }
    else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

function timestamp() {
  return new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 12);
}

function entriesFromArgs(args) {
  if (args.batch || args.manifest) {
    if (!args.manifest) throw new Error("--manifest is required for batch mode");
    const manifest = loadManifest(args.manifest);
    const excluded = new Set(manifest.excluded_slugs || []);
    return manifest.municipalities.filter(entry => !excluded.has(entry.slug));
  }
  if (!args.slug || !args.municipality_id || !args.county) {
    throw new Error("--slug, --municipality and --county are required for single bundle mode");
  }
  return [{
    slug: args.slug,
    municipality_id: args.municipality_id,
    municipality_name: args.municipality_name || args.slug,
    county: args.county
  }];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const entries = entriesFromArgs(args);
  const stamp = timestamp();
  const results = [];
  for (const entry of entries) {
    if (entry.slug === "harku-vald") throw new Error("harku-vald is excluded and must not be upgraded by this script");
    const result = upgradeKovBundle(entry, { root: args.root });
    const written = args.write ? writeUpgrade(result, stamp) : [];
    results.push({ ...result.summary, written: args.write, backups: written });
  }
  console.log(JSON.stringify({
    ok: true,
    mode: args.write ? "write" : "dry-run",
    count: results.length,
    results
  }, null, 2));
}

main().catch(error => {
  console.error(`[kov:upgrade-metadata] ${error?.message || String(error)}`);
  process.exitCode = 1;
});
