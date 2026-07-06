import { applyKovRtRegistryCheck } from "../lib/admin/rag/rtRegistry/service.js";

async function main() {
  const result = await applyKovRtRegistryCheck();
  console.info(`[kov:rt:apply-check] changed entries: ${result.changedEntries}`);
  console.info(`[kov:rt:apply-check] applied xml: ${result.appliedXml}`);
  console.info(`[kov:rt:apply-check] backup: ${result.backupDir}`);
}

main().catch(error => {
  console.error("[kov:rt:apply-check] failed", error);
  process.exitCode = 1;
});
