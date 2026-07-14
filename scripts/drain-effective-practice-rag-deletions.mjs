import { prisma } from "../lib/prisma.js";
import { retryDeletionJob } from "../lib/privacy/retryDeletionJob.js";
import { retryEffectivePracticeRagIngest } from "../lib/effectivePractices.js";

// Drains the durable effective-practice RAG worklog: genuine RAG deletions
// (re_review / accepted-risk removals) AND P1-A ingest recovery (failed publish
// ingests + crash-stale publish guards). --verify-only is a read-only gate that
// only counts residue and exits non-zero when anything is left.

const verifyOnly = process.argv.includes("--verify-only");
const now = new Date();
const staleGuardBefore = new Date(now.getTime() - 10 * 60 * 1000);

const deleteWhere = {
  action: "RAG_DELETE",
  resourceType: "EffectivePractice",
  status: { in: ["pending", "failed"] }
};

// Due ingest retries + crash-stale publish guards (never converted because the
// publish process crashed before its catch block). Both are re-ingested (upsert
// with the deterministic doc id) and version guarded by processRagIngest.
const ingestWhere = {
  resourceType: "EffectivePractice",
  OR: [
    {
      action: "RAG_INGEST",
      status: "pending",
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }]
    },
    { action: "RAG_DELETE", status: "guard", createdAt: { lte: staleGuardBefore } }
  ]
};

// Residue counts (also used by the read-only verify gate).
const remainingDeleteWhere = {
  action: "RAG_DELETE",
  resourceType: "EffectivePractice",
  OR: [
    { status: { in: ["pending", "failed"] } },
    { status: "guard", createdAt: { lte: staleGuardBefore } }
  ]
};
const remainingIngestWhere = {
  action: "RAG_INGEST",
  resourceType: "EffectivePractice",
  status: { in: ["pending", "failed"] }
};

async function pagedJobs(where) {
  const out = [];
  let cursor = null;
  do {
    const page = await prisma.dataDeletionJob.findMany({
      where,
      orderBy: { id: "asc" },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        resourceId: true,
        externalRef: true,
        storagePath: true,
        attempts: true,
        maxAttempts: true
      }
    });
    out.push(...page);
    cursor = page.length === 500 ? page.at(-1).id : null;
  } while (cursor);
  return out;
}

try {
  if (!verifyOnly) {
    for (const job of await pagedJobs(deleteWhere)) {
      await retryDeletionJob({ jobId: job.id, actorUserId: null });
    }
    for (const job of await pagedJobs(ingestWhere)) {
      await retryEffectivePracticeRagIngest(job);
    }
  }
  const [remainingDeletes, remainingIngests, staleReferences] = await Promise.all([
    prisma.dataDeletionJob.count({ where: remainingDeleteWhere }),
    prisma.dataDeletionJob.count({ where: remainingIngestWhere }),
    prisma.effectivePractice.count({ where: { status: { not: "PUBLISHED" }, ragSourceId: { not: null } } })
  ]);
  const remaining = remainingDeletes + remainingIngests;
  const ok = remaining === 0 && staleReferences === 0;
  process.stdout.write(`${JSON.stringify({ ok, remaining, remainingDeletes, remainingIngests, staleReferences })}\n`);
  if (!ok) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
