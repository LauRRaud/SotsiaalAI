import { syncServiceMapEntriesFromRag } from "../lib/serviceMap/ragServiceMapSync.js";

function hasFlag(name) {
  return process.argv.includes(name);
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const result = await syncServiceMapEntriesFromRag({ dryRun });
  const kov = result.kov;
  const providers = result.serviceProviders;

  console.info(`[sync-service-map-from-rag] KOV RAG documents scanned: ${kov.scannedDocuments}`);
  console.info(`[sync-service-map-from-rag] KOV contacts scanned: ${kov.scannedContacts}`);
  console.info(`[sync-service-map-from-rag] KOV contacts skipped: ${kov.skipped}`);
  console.info(`[sync-service-map-from-rag] KOV document failures: ${kov.failedDocuments}`);
  console.info(`[sync-service-map-from-rag] service-provider RAG documents scanned: ${providers.scannedDocuments}`);
  console.info(`[sync-service-map-from-rag] service providers scanned: ${providers.scannedProviders}`);
  console.info(`[sync-service-map-from-rag] service providers skipped: ${providers.skipped}`);
  console.info(`[sync-service-map-from-rag] entries ${dryRun ? "planned" : "upserted"}: ${dryRun ? result.entries.length : result.upserted}`);

  if (dryRun) {
    for (const entry of result.entries.slice(0, 20)) {
      console.info(`- ${entry.type}: ${entry.title} (${entry.email || entry.phone || entry.address || "kontakt"})`);
    }
    if (result.entries.length > 20) {
      console.info(`[sync-service-map-from-rag] ... ${result.entries.length - 20} more`);
    }
  }

  for (const error of kov.errors.slice(0, 10)) {
    console.warn(`[sync-service-map-from-rag] ${error.docId}: ${error.message}`);
  }
}

main().catch((error) => {
  console.error("[sync-service-map-from-rag] failed", error);
  process.exitCode = 1;
});
