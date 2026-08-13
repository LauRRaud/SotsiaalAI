import { deterministicRagDocumentId } from "./effectivePractices.js";

// P1-E: pre-deploy readiness gate for the effective-practice RAG + review pipeline.
// Read-only (no DB mutation), emits a machine-readable summary, and reports which
// critical residues would block a deploy. Never returns practice text, emails or PII.

export const RAG_STALE_GUARD_MS = 10 * 60 * 1000;

/**
 * Builds the read-only deploy-gate report. `service` supplies the P1-C read-only
 * assignment audit (dryRun). `maxRagResidue` is the allowed pending/failed RAG job
 * count (default 0). The migration/schema drift check is added by the CLI wrapper.
 */
export async function buildPracticeDeployGateReport({ db, service, now = new Date(), maxRagResidue = 0, allowRagDisabled = false }) {
  // Fail-closed residue limit: a NaN / negative / non-finite limit must NEVER skip
  // the residue comparison (`residue > NaN` is false → fail-open). Coerce to a
  // finite non-negative integer; anything invalid collapses to the strict 0.
  const rawLimit = Number(maxRagResidue);
  const residueLimit = Number.isFinite(rawLimit) && rawLimit >= 0 ? Math.floor(rawLimit) : 0;
  const staleGuardBefore = new Date(now.getTime() - RAG_STALE_GUARD_MS);

  const [ragDeleteResidue, ragIngestResidue, ragProcessing, ragDeadLetter, staleReferences, publishedUnlinked, publishedWithRag, repair] = await Promise.all([
    db.dataDeletionJob.count({
      where: {
        action: "RAG_DELETE",
        resourceType: "EffectivePractice",
        OR: [{ status: { in: ["pending", "failed"] } }, { status: "guard", createdAt: { lte: staleGuardBefore } }]
      }
    }),
    db.dataDeletionJob.count({
      where: { action: "RAG_INGEST", resourceType: "EffectivePractice", status: { in: ["pending", "failed"] } }
    }),
    db.dataDeletionJob.count({
      where: { resourceType: "EffectivePractice", action: { in: ["RAG_INGEST", "RAG_DELETE"] }, status: "processing" }
    }),
    db.dataDeletionJob.count({
      where: { resourceType: "EffectivePractice", action: { in: ["RAG_INGEST", "RAG_DELETE"] }, status: "dead_letter" }
    }),
    db.effectivePractice.count({ where: { status: { not: "PUBLISHED" }, ragSourceId: { not: null } } }),
    db.effectivePractice.count({ where: { status: "PUBLISHED", ragSourceId: null } }),
    db.effectivePractice.findMany({
      where: { status: "PUBLISHED", ragSourceId: { not: null } },
      select: { publicId: true, publishedVersion: true, ragSourceId: true }
    }),
    service.repairAssignments({ userId: "system", role: "SYSTEM", isAdmin: true }, { dryRun: true })
  ]);

  const versionMismatches = publishedWithRag.filter(
    (p) => p.ragSourceId !== deterministicRagDocumentId(p.publicId, p.publishedVersion)
  ).length;
  const assignmentFindings = Array.isArray(repair?.findings) ? repair.findings.length : 0;

  const checks = {
    ragDeleteResidue,
    ragIngestResidue,
    ragProcessing,
    ragDeadLetter,
    staleReferences,
    versionMismatches,
    publishedUnlinked,
    assignmentFindings,
    residueLimit,
    allowRagDisabled: allowRagDisabled === true
  };

  const failures = [];
  if (ragDeleteResidue > residueLimit) failures.push("rag_delete_residue");
  if (ragIngestResidue > residueLimit) failures.push("rag_ingest_residue");
  if (ragProcessing > residueLimit) failures.push("rag_processing_residue");
  if (ragDeadLetter > 0) failures.push("rag_dead_letter");
  if (staleReferences > 0) failures.push("stale_references");
  if (versionMismatches > 0) failures.push("published_version_mismatch");
  if (assignmentFindings > 0) failures.push("assignment_repair_needed");
  // §3.7: a published practice not linked to RAG is a red gate by default. Only an
  // explicit, machine-readable, auditable RAG-disabled opt-out downgrades it.
  if (publishedUnlinked > 0 && allowRagDisabled !== true) failures.push("published_unlinked");

  return { ok: failures.length === 0, failures, checks };
}
