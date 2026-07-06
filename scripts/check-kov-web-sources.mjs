import { checkKovWebSourcesFromWeb } from "../lib/admin/rag/kovSourceMonitor/service.js";

function parseArgs(argv = process.argv.slice(2)) {
  const args = { maxUrls: 0, slug: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--max-urls") args.maxUrls = Number.parseInt(String(argv[++index] || "0"), 10) || 0;
    else if (arg === "--slug") args.slug = String(argv[++index] || "").trim().toLowerCase();
    else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const report = await checkKovWebSourcesFromWeb(args);
  console.info(`[kov:web-sources:check] files: ${report.files}`);
  console.info(`[kov:web-sources:check] checked urls: ${report.checkedUrls}`);
  console.info(`[kov:web-sources:check] fetched ok: ${report.fetchedOk}, failed: ${report.fetchedFailed}`);
  console.info(`[kov:web-sources:check] changed sources: ${report.changedSources}`);
  console.info(`[kov:web-sources:check] baseline missing: ${report.baselineMissing}`);
  console.info(`[kov:web-sources:check] candidates: ${report.candidatesWritten}`);
  console.info(`[kov:web-sources:check] report: ${report.reportFile}`);
}

main().catch(error => {
  console.error("[kov:web-sources:check] failed", error);
  process.exitCode = 1;
});
