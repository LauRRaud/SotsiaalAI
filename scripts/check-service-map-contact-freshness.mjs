import { checkDatabaseContactsFromWeb } from "../lib/admin/rag/contactRegistry/databaseService.js";

function valueAfterFlag(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

async function main() {
  const maxUrls = Number(valueAfterFlag("--max-urls", "0")) || 0;
  const result = await checkDatabaseContactsFromWeb({ maxUrls });
  console.info(`[service-map:contacts:check] contacts: ${result.contacts}`);
  console.info(`[service-map:contacts:check] checked urls: ${result.checkedUrls}/${result.urls}`);
  console.info(`[service-map:contacts:check] verified contacts: ${result.verifiedContacts}`);
  console.info(`[service-map:contacts:check] review candidates: ${result.changedContacts}`);
  console.info(`[service-map:contacts:check] fetch failures: ${result.fetchedFailed}`);
}

main().catch(error => {
  console.error("[service-map:contacts:check] failed", error);
  process.exitCode = 1;
});
