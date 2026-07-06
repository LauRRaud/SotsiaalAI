import { checkKovContactRegistryFromWeb } from "../lib/admin/rag/contactRegistry/service.js";

function valueAfterFlag(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

async function main() {
  const maxUrls = Number(valueAfterFlag("--max-urls", "0")) || 0;
  const report = await checkKovContactRegistryFromWeb({ maxUrls });
  console.info(`[kov:contacts:check-web] contacts: ${report.contacts}`);
  console.info(`[kov:contacts:check-web] checked urls: ${report.checkedUrls}/${report.urls}`);
  console.info(`[kov:contacts:check-web] fetched ok: ${report.fetchedOk}, failed: ${report.fetchedFailed}`);
  console.info(`[kov:contacts:check-web] protected emails decoded: ${report.protectedEmailsDecoded}`);
  console.info(`[kov:contacts:check-web] changed contacts: ${report.changedContacts}`);
  console.info(`[kov:contacts:check-web] candidate: ${report.outputFile}`);
  console.info(`[kov:contacts:check-web] report: ${report.reportFile}`);
}

main().catch((error) => {
  console.error("[kov:contacts:check-web] failed", error);
  process.exitCode = 1;
});
