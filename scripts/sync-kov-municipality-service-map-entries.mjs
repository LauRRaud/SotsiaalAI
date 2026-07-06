import { syncKovMunicipalitiesToServiceMap } from "../lib/serviceMap/kovMunicipalitySync.js";

function hasFlag(name) {
  return process.argv.includes(name);
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const result = await syncKovMunicipalitiesToServiceMap({ dryRun });
  console.info(`[sync-kov-municipality-service-map] municipalities scanned: ${result.scannedMunicipalities}`);
  console.info(`[sync-kov-municipality-service-map] entries ${dryRun ? "planned" : "upserted"}: ${dryRun ? result.planned : result.upserted}`);

  const preview = result.entries.slice(0, 20);
  for (const entry of preview) {
    console.info(`- ${entry.type}: ${entry.title} (${entry.website || entry.municipalityName || "KOV"})`);
  }
  if (result.entries.length > preview.length) {
    console.info(`[sync-kov-municipality-service-map] ... ${result.entries.length - preview.length} more`);
  }
}

main().catch((error) => {
  console.error("[sync-kov-municipality-service-map] failed", error);
  process.exitCode = 1;
});
