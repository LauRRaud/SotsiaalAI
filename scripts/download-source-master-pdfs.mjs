#!/usr/bin/env node

import {
  buildPlan,
  DEFAULT_CONCURRENCY,
  DEFAULT_MASTER_PATH,
  DEFAULT_MAX_BYTES,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_REPORT_DIR,
  DEFAULT_RETRIES,
  DEFAULT_SCAN_ROOTS,
  DEFAULT_TIMEOUT_MS,
  downloadMissingPdfs,
  inventoryLocalPdfs,
  loadMasterPdfRecords,
  SourceMasterDownloadError,
  writeReports
} from "./lib/source-master-pdf-download.mjs";

function usage() {
  console.log(`
Usage:
  node scripts/download-source-master-pdfs.mjs --plan
  node scripts/download-source-master-pdfs.mjs --download

Options:
  --plan                 Inventory only; do not download files (default).
  --download             Download missing PDFs.
  --master <path>        Source master JSON. Default: ${DEFAULT_MASTER_PATH}
  --scan-root <path>     Existing local corpus root. Repeatable.
  --output <path>        Download destination. Default: ${DEFAULT_OUTPUT_DIR}
  --report-dir <path>    Report destination. Default: ${DEFAULT_REPORT_DIR}
  --concurrency <n>      Parallel downloads. Default: ${DEFAULT_CONCURRENCY}
  --timeout-ms <n>       Per-request timeout. Default: ${DEFAULT_TIMEOUT_MS}
  --max-bytes <n>        Maximum PDF bytes. Default: ${DEFAULT_MAX_BYTES}
  --retries <n>          Retry count. Default: ${DEFAULT_RETRIES}
  --json                 Print the result as JSON.
  --help
`.trim());
}

function parseArgs(argv) {
  const args = {
    mode: "plan",
    master: DEFAULT_MASTER_PATH,
    scanRoots: [],
    output: DEFAULT_OUTPUT_DIR,
    reportDir: DEFAULT_REPORT_DIR,
    concurrency: DEFAULT_CONCURRENCY,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxBytes: DEFAULT_MAX_BYTES,
    retries: DEFAULT_RETRIES,
    json: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || "");
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else if (arg === "--plan") args.mode = "plan";
    else if (arg === "--download") args.mode = "download";
    else if (arg === "--master") args.master = String(argv[++index] || "").trim();
    else if (arg === "--scan-root") args.scanRoots.push(String(argv[++index] || "").trim());
    else if (arg === "--output") args.output = String(argv[++index] || "").trim();
    else if (arg === "--report-dir") args.reportDir = String(argv[++index] || "").trim();
    else if (arg === "--concurrency") args.concurrency = Number.parseInt(String(argv[++index] || ""), 10);
    else if (arg === "--timeout-ms") args.timeoutMs = Number.parseInt(String(argv[++index] || ""), 10);
    else if (arg === "--max-bytes") args.maxBytes = Number.parseInt(String(argv[++index] || ""), 10);
    else if (arg === "--retries") args.retries = Number.parseInt(String(argv[++index] || ""), 10);
    else if (arg === "--json") args.json = true;
    else throw new SourceMasterDownloadError("invalid_argument", `Unknown option: ${arg}`);
  }
  if (!args.master || !args.output || !args.reportDir || args.scanRoots.some(root => !root)) {
    throw new SourceMasterDownloadError("invalid_argument", "Paths cannot be empty");
  }
  if (!Number.isInteger(args.concurrency) || args.concurrency < 1 || args.concurrency > 10 ||
      !Number.isInteger(args.timeoutMs) || args.timeoutMs < 1000 ||
      !Number.isInteger(args.maxBytes) || args.maxBytes < 5 ||
      !Number.isInteger(args.retries) || args.retries < 0 || args.retries > 10) {
    throw new SourceMasterDownloadError("invalid_argument", "Numeric options are outside their allowed range");
  }
  if (!args.scanRoots.length) args.scanRoots = [...DEFAULT_SCAN_ROOTS];
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const records = await loadMasterPdfRecords(args.master);
  const catalog = await inventoryLocalPdfs([...args.scanRoots, args.output]);
  const report = args.mode === "download"
    ? await downloadMissingPdfs({
        records,
        catalog,
        outputDir: args.output,
        concurrency: args.concurrency,
        timeoutMs: args.timeoutMs,
        maxBytes: args.maxBytes,
        retries: args.retries
      })
    : await buildPlan({ records, catalog });
  await writeReports(args.reportDir, report);
  if (args.json) console.log(JSON.stringify(report));
  else {
    console.log(`PDF sources: ${report.counts.total}`);
    console.log(`Already local: ${report.counts.local_file_exists}`);
    if (report.mode === "plan") console.log(`Would download: ${report.counts.would_download}`);
    else console.log(`Downloaded: ${report.counts.downloaded || 0}`);
  }
}

main().catch(error => {
  const payload = {
    error: {
      code: error instanceof SourceMasterDownloadError ? error.code : "unexpected_error",
      message: error?.message || "Unexpected error"
    }
  };
  console.error(JSON.stringify(payload));
  process.exitCode = 1;
});
