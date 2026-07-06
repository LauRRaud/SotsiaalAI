import { applyKovContactRegistryCheck } from "../lib/admin/rag/contactRegistry/service.js";

function hasFlag(name) {
  return process.argv.includes(name);
}

async function main() {
  const syncServiceMap = hasFlag("--sync-service-map");
  const result = await applyKovContactRegistryCheck({ syncServiceMap });
  console.info(`[kov:contacts:apply-check] applied contacts: ${result.appliedContacts}`);
  console.info(`[kov:contacts:apply-check] changed contacts: ${result.changedContacts}`);
  console.info(`[kov:contacts:apply-check] backup: ${result.backupFile}`);
  if (result.sync) {
    console.info(`[kov:contacts:apply-check] service map upserted: ${result.sync.upserted}`);
  }
}

main().catch((error) => {
  console.error("[kov:contacts:apply-check] failed", error);
  process.exitCode = 1;
});
