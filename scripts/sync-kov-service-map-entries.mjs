import { syncKovContactsToServiceMap } from "../lib/serviceMap/kovContactSync.js";

function hasFlag(name) {
  return process.argv.includes(name);
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const result = await syncKovContactsToServiceMap({ dryRun });
  console.info(`[sync-kov-service-map] files scanned: ${result.scannedFiles}`);
  console.info(`[sync-kov-service-map] contacts scanned: ${result.scannedContacts}`);
  console.info(`[sync-kov-service-map] contacts skipped: ${result.skipped}`);
  console.info(`[sync-kov-service-map] entries ${dryRun ? "planned" : "upserted"}: ${dryRun ? result.entries.length : result.upserted}`);

  if (dryRun) {
    for (const entry of result.entries.slice(0, 20)) {
      console.info(`- ${entry.type}: ${entry.title} (${entry.email || entry.phone || entry.address || "kontakt"})`);
    }
    if (result.entries.length > 20) {
      console.info(`[sync-kov-service-map] ... ${result.entries.length - 20} more`);
    }
  }
}

main().catch((error) => {
  console.error("[sync-kov-service-map] failed", error);
  process.exitCode = 1;
});
