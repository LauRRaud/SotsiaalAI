import { applyKovWebSourcesCheck } from "../lib/admin/rag/kovSourceMonitor/service.js";

async function main() {
  const result = await applyKovWebSourcesCheck();
  console.info(`[kov:web-sources:apply] applied files: ${result.appliedFiles}`);
  console.info(`[kov:web-sources:apply] applied changes: ${result.appliedChanges}`);
  console.info(`[kov:web-sources:apply] report: ${result.reportFile}`);
}

main().catch(error => {
  console.error("[kov:web-sources:apply] failed", error);
  process.exitCode = 1;
});
