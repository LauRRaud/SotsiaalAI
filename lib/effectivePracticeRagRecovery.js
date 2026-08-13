import crypto from "node:crypto";
import { prisma } from "./prisma.js";

const LOCK_KEY = "effective-practice:rag-recovery";
const DEFAULT_MAX_ATTEMPTS = 8;
const BACKOFF_BASE_MS = 60_000;

function backoffMs(attempt) {
  return BACKOFF_BASE_MS * 2 ** Math.min(Math.max(Number(attempt) || 1, 1) - 1, 10);
}

export async function runEffectivePracticeRagRecovery({
  db = prisma,
  now = new Date(),
  batchSize = 40,
  dryRun = false,
  processIngest = null,
  processDelete = null
} = {}) {
  const take = Math.max(1, Math.min(Number(batchSize) || 40, 100));
  const staleClaimBefore = new Date(now.getTime() - 10 * 60_000);
  const staleGuardBefore = new Date(now.getTime() - 10 * 60_000);
  const eligibleWhere = {
    resourceType: "EffectivePractice",
    OR: [
      { action: "RAG_INGEST", status: { in: ["pending", "failed"] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
      { action: "RAG_DELETE", status: { in: ["pending", "failed"] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
      { action: "RAG_DELETE", status: "guard", createdAt: { lte: staleGuardBefore } },
      { action: { in: ["RAG_INGEST", "RAG_DELETE"] }, status: "processing", claimedAt: { lte: staleClaimBefore } }
    ]
  };
  const claimed = await db.$transaction(async (tx) => {
    if (typeof tx.$executeRaw === "function") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${LOCK_KEY}))`;
    }
    const rows = await tx.dataDeletionJob.findMany({
      where: eligibleWhere,
      orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      take,
      select: { id: true, action: true, resourceId: true, externalRef: true, storagePath: true, status: true, attempts: true, maxAttempts: true }
    });
    if (dryRun) return rows;
    const result = [];
    for (const row of rows) {
      const claimToken = crypto.randomUUID();
      const updated = await tx.dataDeletionJob.updateMany({
        where: { id: row.id, status: row.status },
        data: { status: "processing", claimToken, claimedAt: now }
      });
      if (updated.count === 1) result.push({ ...row, claimToken });
    }
    return result;
  });
  if (dryRun) {
    const deadLetter = await db.dataDeletionJob.count({
      where: { resourceType: "EffectivePractice", action: { in: ["RAG_INGEST", "RAG_DELETE"] }, status: "dead_letter" }
    });
    return {
      dryRun: true, eligible: claimed.length, claimed: 0, succeeded: 0, failed: 0,
      deadLettered: 0, deadLetter, alarm: deadLetter > 0
    };
  }

  const ingestJob = processIngest || (await import("./effectivePractices.js")).retryEffectivePracticeRagIngest;
  const deleteJob = processDelete || (await import("./privacy/retryDeletionJob.js")).retryDeletionJob;

  let succeeded = 0;
  let failed = 0;
  let deadLettered = 0;
  for (const job of claimed) {
    try {
      const result = job.action === "RAG_INGEST"
        ? await ingestJob(job)
        : await deleteJob({ jobId: job.id, actorUserId: null });
      const fresh = await db.dataDeletionJob.findUnique({ where: { id: job.id }, select: { status: true, attempts: true } });
      if (fresh?.status === "done") {
        succeeded += 1;
      } else if (fresh?.status === "failed") {
        const attempts = Number(fresh.attempts || 0);
        const maxAttempts = Number(job.maxAttempts) || DEFAULT_MAX_ATTEMPTS;
        const terminal = attempts >= maxAttempts;
        await db.dataDeletionJob.updateMany({
          where: { id: job.id, claimToken: job.claimToken },
          data: {
            status: terminal ? "dead_letter" : "failed",
            nextAttemptAt: terminal ? null : new Date(now.getTime() + backoffMs(attempts)),
            claimToken: null,
            claimedAt: null,
            maxAttempts
          }
        });
        if (terminal) deadLettered += 1; else failed += 1;
      } else {
        throw new Error(result?.status === "failed" ? "processor_reported_failure" : "processor_did_not_finish_job");
      }
      await db.dataDeletionJob.updateMany({
        where: { id: job.id, claimToken: job.claimToken }, data: { claimToken: null, claimedAt: null }
      });
    } catch (error) {
      const attempts = Number(job.attempts || 0) + 1;
      const maxAttempts = Number(job.maxAttempts) || DEFAULT_MAX_ATTEMPTS;
      const terminal = attempts >= maxAttempts;
      await db.dataDeletionJob.updateMany({
        where: { id: job.id, claimToken: job.claimToken },
        data: {
          status: terminal ? "dead_letter" : "failed",
          attempts: { increment: 1 },
          lastErrorCode: "worker_failed",
          lastError: String(error?.message || "worker_failed").slice(0, 500),
          nextAttemptAt: terminal ? null : new Date(now.getTime() + backoffMs(attempts)),
          claimToken: null,
          claimedAt: null,
          maxAttempts
        }
      });
      if (terminal) deadLettered += 1; else failed += 1;
    }
  }
  const [remaining, existingDeadLetter] = await Promise.all([
    db.dataDeletionJob.count({
      where: {
        resourceType: "EffectivePractice", action: { in: ["RAG_INGEST", "RAG_DELETE"] },
        status: { in: ["pending", "failed", "guard", "processing"] }
      }
    }),
    db.dataDeletionJob.count({
      where: { resourceType: "EffectivePractice", action: { in: ["RAG_INGEST", "RAG_DELETE"] }, status: "dead_letter" }
    })
  ]);
  return {
    dryRun: false,
    eligible: claimed.length,
    claimed: claimed.length,
    succeeded,
    failed,
    deadLettered,
    deadLetter: existingDeadLetter,
    remaining,
    alarm: existingDeadLetter > 0 || failed > 0
  };
}
