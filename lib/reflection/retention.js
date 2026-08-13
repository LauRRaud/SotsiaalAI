import { prisma as defaultPrisma } from "../prisma.js";

const ACTIVE = "ACTIVE";
const USER_DELETED = "USER_DELETED";

function safeErrorCode(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  return /^[A-Z0-9_]{2,80}$/.test(code) ? code : "REFLECTION_RETENTION_ROW_FAILED";
}

async function currentContractDeadline(prisma, ownerUserId, now) {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      userId: ownerUserId,
      status: "ACTIVE",
      OR: [{ validUntil: null }, { validUntil: { gt: now } }]
    },
    select: { validUntil: true }
  });
  if (!subscriptions.length) return { active: false, deadline: null };
  if (subscriptions.some((item) => item.validUntil == null)) {
    return { active: true, deadline: null };
  }
  const deadline = subscriptions
    .map((item) => new Date(item.validUntil))
    .sort((left, right) => right.getTime() - left.getTime())[0];
  return { active: true, deadline };
}

export async function runPracticeReflectionRetention(options = {}) {
  const prisma = options.prisma || defaultPrisma;
  const now = options.now || new Date();
  const batchSize = Math.min(Math.max(Number(options.batchSize) || 100, 1), 500);
  const run = await prisma.practiceReflectionRetentionRun.create({
    data: { startedAt: now }
  });
  const result = {
    runId: run.id,
    scanned: 0,
    purged: 0,
    deferred: 0,
    failed: 0,
    errorCode: null
  };

  const candidates = await prisma.practiceReflection.findMany({
    where: {
      OR: [
        { retentionState: USER_DELETED, undoUntil: { lte: now } },
        { retentionState: ACTIVE, retentionDeadline: { lte: now } }
      ]
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      ownerUserId: true,
      retentionState: true,
      retentionDeadline: true,
      undoUntil: true
    },
    take: batchSize
  });
  result.scanned = candidates.length;

  for (const candidate of candidates) {
    try {
      if (candidate.retentionState === ACTIVE) {
        const contract = await currentContractDeadline(prisma, candidate.ownerUserId, now);
        if (contract.active) {
          const updated = await prisma.practiceReflection.updateMany({
            where: {
              id: candidate.id,
              retentionState: ACTIVE,
              retentionDeadline: { lte: now }
            },
            data: { retentionDeadline: contract.deadline }
          });
          result.deferred += Number(updated?.count) || 0;
          continue;
        }
      }

      if (typeof options.beforeDelete === "function") {
        await options.beforeDelete(candidate);
      }
      const deleted = await prisma.practiceReflection.deleteMany({
        where: candidate.retentionState === USER_DELETED
          ? { id: candidate.id, retentionState: USER_DELETED, undoUntil: { lte: now } }
          : { id: candidate.id, retentionState: ACTIVE, retentionDeadline: { lte: now } }
      });
      result.purged += Number(deleted?.count) || 0;
    } catch (error) {
      result.failed += 1;
      result.errorCode ||= safeErrorCode(error);
    }
  }

  const finishedAt = options.finishedAt || new Date();
  await prisma.practiceReflectionRetentionRun.update({
    where: { id: run.id },
    data: {
      finishedAt,
      ok: result.failed === 0,
      scanned: result.scanned,
      purged: result.purged,
      deferred: result.deferred,
      failed: result.failed,
      errorCode: result.errorCode
    }
  });
  return { ...result, ok: result.failed === 0, finishedAt };
}
