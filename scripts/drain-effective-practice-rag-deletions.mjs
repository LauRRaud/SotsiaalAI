import { prisma } from "../lib/prisma.js";
import { retryDeletionJob } from "../lib/privacy/retryDeletionJob.js";

const verifyOnly = process.argv.includes("--verify-only");
const staleGuardBefore = new Date(Date.now() - 10 * 60 * 1000);
const where = {
  action: "RAG_DELETE",
  resourceType: "EffectivePractice",
  OR: [
    { status: { in: ["pending", "failed"] } },
    { status: "guard", createdAt: { lte: staleGuardBefore } }
  ]
};

try {
  if (!verifyOnly) {
    // Freeze the initial workset in bounded pages. Each job is attempted once
    // per invocation, so a failed remote delete cannot create an endless loop
    // while batches larger than 500 are still fully drained.
    const initialJobs = [];
    let cursor = null;
    do {
      const page = await prisma.dataDeletionJob.findMany({
        where,
        orderBy: { id: "asc" },
        take: 500,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, resourceId: true, externalRef: true }
      });
      initialJobs.push(...page);
      cursor = page.length === 500 ? page.at(-1).id : null;
    } while (cursor);
    for (const job of initialJobs) {
      await retryDeletionJob({ jobId: job.id, actorUserId: null });
    }
  }
  const remaining = await prisma.dataDeletionJob.count({ where });
  const staleReferences = await prisma.effectivePractice.count({
    where: { status: { not: "PUBLISHED" }, ragSourceId: { not: null } }
  });
  const ok = remaining === 0 && staleReferences === 0;
  process.stdout.write(`${JSON.stringify({ ok, remaining, staleReferences })}\n`);
  if (!ok) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
