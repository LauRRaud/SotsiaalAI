import { checkKovRtRegistryFromWeb } from "../lib/admin/rag/rtRegistry/service.js";

function parseArgs(argv = process.argv.slice(2)) {
  const args = { maxUrls: 0 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--max-urls") args.maxUrls = Number.parseInt(String(argv[++index] || "0"), 10) || 0;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const report = await checkKovRtRegistryFromWeb({ maxUrls: args.maxUrls });
  console.info(`[kov:rt:check-web] entries: ${report.entries}`);
  console.info(`[kov:rt:check-web] checked urls: ${report.checkedUrls}`);
  console.info(`[kov:rt:check-web] fetched ok: ${report.fetchedOk}, failed: ${report.fetchedFailed}`);
  console.info(`[kov:rt:check-web] changed entries: ${report.changedEntries}`);
  console.info(`[kov:rt:check-web] downloaded xml: ${report.downloadedXml}`);
  console.info(`[kov:rt:check-web] candidate: ${report.outputFile}`);
  console.info(`[kov:rt:check-web] report: ${report.reportFile}`);
}

main().catch(error => {
  console.error("[kov:rt:check-web] failed", error);
  process.exitCode = 1;
});
