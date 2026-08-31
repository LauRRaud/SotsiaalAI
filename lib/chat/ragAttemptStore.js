import { prisma } from "@/lib/prisma";
import { lockConversationTurn } from "./turnRegistry.js";
import { projectAttemptEvidence, RAG_ATTEMPT_STAGES } from "./ragAttemptEvidence.js";

export const RAG_ATTEMPT_LEASE_MS = Number(process.env.CHAT_TURN_LEASE_MS) > 0 && Number.isFinite(Number(process.env.CHAT_TURN_LEASE_MS))
  ? Number(process.env.CHAT_TURN_LEASE_MS) : 15 * 60 * 1000;
export function staleAttemptError() {
  const error = new Error("RAG attempt no longer owns this turn");
  error.code = "RAG_ATTEMPT_STALE";
  return error;
}

export async function createRagAttempt(tx, turn, now = new Date(), leaseMs = RAG_ATTEMPT_LEASE_MS) {
  return tx.ragAttempt.create({ data: {
    chatTurnId: turn.id, attempt: turn.attempt, userMessageId: turn.userMessageId || null,
    startedAt: now, leaseExpiresAt: new Date(now.getTime() + leaseMs),
    evidence: projectAttemptEvidence({ stages: [{ stage: "claimed", elapsed_ms: 0 }] })
  } });
}

// Caller holds the conversation lock. The fence precedes ALL durable writes,
// including message/summary and usage settlement, not only the attempt update.
export async function assertRagAttemptOwner(tx, fence, now = new Date()) {
  if (!fence) return null;
  const row = await tx.ragAttempt.findUnique({ where: { id: fence.id }, include: { chatTurn: true } });
  if (!row || row.chatTurnId !== fence.chatTurnId || row.attempt !== fence.attempt ||
      row.status !== "RUNNING" || new Date(row.leaseExpiresAt).getTime() <= now.getTime() ||
      row.chatTurn?.attempt !== fence.attempt || row.chatTurn?.status !== "RUNNING" ||
      row.chatTurn?.conversationId !== fence.conversationId || row.chatTurn?.userId !== fence.userId) throw staleAttemptError();
  return row;
}

export async function finishRagAttempt(tx, fence, { status, assistantMessageId = null, trace = null, failure = null, now = new Date() } = {}) {
  const row = await assertRagAttemptOwner(tx, fence, now);
  if (!row) return;
  const finalStatus = status === "COMPLETED" ? "COMPLETED" : status === "ABORTED" ? "CANCELLED" : "FAILED";
  const evidence = projectAttemptEvidence({ ...row.evidence,
    ...(trace ? { trace } : {}),
    first_observed_failure: row.evidence?.first_observed_failure || failure
  });
  const updated = await tx.ragAttempt.updateMany({
    where: { id: row.id, attempt: fence.attempt, status: "RUNNING", sequence: row.sequence },
    data: { status: finalStatus, assistantMessageId, evidence, endedAt: now, sequence: { increment: 1 } }
  });
  if (updated.count !== 1) throw staleAttemptError();
}

export async function abandonRagAttempts(tx, turnId, attempt, now = new Date()) {
  await tx.ragAttempt.updateMany({ where: { chatTurnId: turnId, attempt, status: "RUNNING" },
    data: { status: "ABANDONED", endedAt: now, sequence: { increment: 1 } } });
}

export async function failRagAttempt(fence, { failure, settleUsage = null, cancelled = false } = {}, deps = {}) {
  if (!fence) return false;
  const db = deps.prisma || prisma;
  return db.$transaction(async tx => {
    await lockConversationTurn(tx, fence.conversationId);
    await assertRagAttemptOwner(tx, fence);
    if (settleUsage) await settleUsage(tx);
    await finishRagAttempt(tx, fence, { status: cancelled ? "ABORTED" : "ERROR", failure });
    const changed = await tx.chatTurn.updateMany({ where: { id: fence.chatTurnId, attempt: fence.attempt, status: "RUNNING" },
      data: { status: cancelled ? "ABORTED" : "ERROR", endedAt: new Date() } });
    if (changed.count !== 1) throw staleAttemptError();
    return true;
  });
}

export async function persistAttemptTerminal(input, { controller, persist, onFailure }, options = {}) {
  await controller?.stage("persistence", { trace: input.ragTrace });
  const result = await persist({ ...input, attemptNumber: controller?.fence.attempt || null, ragAttempt: controller?.fence || null }, options);
  if (result) controller?.stop();
  else {
    await controller?.stage("persistence", { failure: { stage: "persistence", code: "persistence_failed" } });
    const aborted = (input.completionStatus || input.status) === "ABORTED";
    // Keep the existing visible-partial-output policy; do not silently refund
    // output already delivered just because its terminal marker failed.
    await onFailure?.("persistence", "persistence_failed", aborted ? { settleChatUsage: input.settleUsage, cancelled: true } : {});
  }
  return result;
}

// No request data in module state. Every controller belongs to one immutable attempt.
export function createRagAttemptController(row, { conversationId, userId, db = prisma, now = () => new Date(), heartbeatMs = 30_000 } = {}) {
  if (!row) return null;
  const fence = Object.freeze({ id: row.id, chatTurnId: row.chatTurnId, attempt: row.attempt, conversationId, userId });
  let stopped = false;
  let beating = false;
  let timer = null;
  const stop = () => { stopped = true; if (timer) clearInterval(timer); timer = null; };
  const locked = action => db.$transaction(async tx => {
    await lockConversationTurn(tx, conversationId);
    const current = await assertRagAttemptOwner(tx, fence, now());
    return action(tx, current);
  });
  const stage = async (name, patch = {}) => {
    if (stopped || !RAG_ATTEMPT_STAGES.has(name)) return false;
    try {
      return await locked(async (tx, current) => {
        const modelCalls = [...(current.evidence?.model_calls || [])];
        if (patch.modelCall) {
          const previous = modelCalls.find(call => call.index === patch.modelCall.index);
          if (previous) previous.runtime = { ...previous.runtime, ...patch.modelCall.runtime };
          else modelCalls.push(patch.modelCall);
        }
        const evidence = projectAttemptEvidence({ ...current.evidence,
          model_calls: modelCalls,
          runtime: { ...current.evidence?.runtime, ...(patch.modelCall?.runtime?.prompt_hash ? { actual_model: null } : {}), ...patch.runtime },
          stages: [...(current.evidence?.stages || []), { stage: name, elapsed_ms: Math.max(0, now().getTime() - new Date(row.startedAt).getTime()) }],
          first_observed_failure: current.evidence?.first_observed_failure || patch.failure,
          ...(patch.trace ? { trace: patch.trace } : {})
        });
        const updated = await tx.ragAttempt.updateMany({ where: { id: fence.id, attempt: fence.attempt, status: "RUNNING", sequence: current.sequence },
          data: { stage: name, sequence: { increment: 1 }, evidence } });
        return updated.count === 1;
      });
    } catch (error) {
      if (error?.code === "RAG_ATTEMPT_STALE") stop();
      return false;
    }
  };
  const heartbeat = async () => {
    if (stopped || beating) return false;
    beating = true;
    try {
      return await locked(async (tx) => {
        const beat = now();
        const result = await tx.ragAttempt.updateMany({ where: { id: fence.id, attempt: fence.attempt, status: "RUNNING" },
          data: { leaseExpiresAt: new Date(beat.getTime() + RAG_ATTEMPT_LEASE_MS) } });
        const turn = await tx.chatTurn.updateMany({ where: { id: fence.chatTurnId, attempt: fence.attempt, status: "RUNNING" }, data: { updatedAt: beat } });
        if (result.count !== 1 || turn.count !== 1) throw staleAttemptError();
        return true;
      });
    } catch (error) {
      if (error?.code === "RAG_ATTEMPT_STALE") stop();
      return false;
    } finally { beating = false; }
  };
  if (heartbeatMs > 0) { timer = setInterval(() => { void heartbeat(); }, heartbeatMs); timer.unref?.(); }
  return { fence, stage, heartbeat, stop,
    settle: (callback, tx = null) => tx ? assertRagAttemptOwner(tx, fence, now()).then(() => callback(tx)) : locked(callback) };
}

// Re-read expiry under the same turn lock. Never release a reservation from an
// old snapshot: billing remains owned by its existing idempotent usage service.
export async function reapStaleRagAttempts({ db = prisma, now = new Date(), limit = 50 } = {}) {
  const rows = await db.ragAttempt.findMany({ where: { status: "RUNNING", leaseExpiresAt: { lte: now } },
    orderBy: { leaseExpiresAt: "asc" }, take: Math.min(100, Math.max(1, limit)), include: { chatTurn: true } });
  let abandoned = 0;
  for (const row of rows) {
    abandoned += await db.$transaction(async tx => {
      await lockConversationTurn(tx, row.chatTurn.conversationId);
      const current = await tx.ragAttempt.findUnique({ where: { id: row.id }, include: { chatTurn: true } });
      if (!current || current.status !== "RUNNING" || new Date(current.leaseExpiresAt).getTime() > now.getTime()) return 0;
      const updated = await tx.ragAttempt.updateMany({ where: { id: row.id, status: "RUNNING", leaseExpiresAt: { lte: now } },
        data: { status: "ABANDONED", endedAt: now, sequence: { increment: 1 }, evidence: projectAttemptEvidence({ ...current.evidence,
          first_observed_failure: current.evidence?.first_observed_failure || { stage: current.stage, code: "lease_expired" } }) } });
      if (updated.count !== 1) return 0;
      await tx.chatTurn.updateMany({ where: { id: current.chatTurnId, attempt: current.attempt, status: "RUNNING" }, data: { status: "ERROR", endedAt: now } });
      return 1;
    });
  }
  return { inspected: rows.length, abandoned };
}
