import { buildHtmlOrTopicIngestPayload, contentHashForHtmlOrTopic } from "../../scripts/lib/master-source-html-adapter.mjs";

export const MASTER_SOURCE_RESOURCE_TYPE = "master_source";
export const MASTER_SOURCE_MAX_ATTEMPTS = 5;

export class MasterSourceLifecycleError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "MasterSourceLifecycleError";
    this.code = code;
  }
}

export function retryBackoffMs(attempt) {
  return Math.min(60_000 * (2 ** Math.max(0, Number(attempt || 1) - 1)), 24 * 60 * 60 * 1000);
}

function requireText(value, code) {
  const text = String(value || "").trim();
  if (!text) throw new MasterSourceLifecycleError(code);
  return text;
}

function candidateFingerprint(candidate) {
  return requireText(candidate?.candidate_fingerprint || candidate?.fingerprint, "candidate_fingerprint_required");
}

function approvedCandidate(source) {
  const approved = source?.approved_candidate;
  if (!approved?.fingerprint) throw new MasterSourceLifecycleError("candidate_not_approved");
  return approved;
}

async function advisoryLock(tx, key) {
  if (typeof tx.$executeRaw === "function") {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }
}

export async function enqueueMasterSourceJob(db, data) {
  if (!db?.dataDeletionJob) throw new TypeError("db.dataDeletionJob is required");
  const run = async tx => {
    const lockKey = `master_source:${data.action}:${data.resourceId}:${data.externalRef || ""}`;
    await advisoryLock(tx, lockKey);
    const existing = await tx.dataDeletionJob.findFirst({
      where: {
        action: data.action,
        resourceType: MASTER_SOURCE_RESOURCE_TYPE,
        resourceId: data.resourceId,
        externalRef: data.externalRef || null,
        status: { in: ["pending", "processing", "failed"] }
      }
    });
    if (existing) return { job: existing, created: false };
    const job = await tx.dataDeletionJob.create({
      data: {
        actorUserId: data.actorUserId || null,
        action: data.action,
        resourceType: MASTER_SOURCE_RESOURCE_TYPE,
        resourceId: data.resourceId,
        externalRef: data.externalRef || null,
        storagePath: data.storagePath || null,
        status: "pending",
        attempts: 0,
        maxAttempts: data.maxAttempts || MASTER_SOURCE_MAX_ATTEMPTS,
        nextAttemptAt: data.nextAttemptAt || new Date(),
        lastError: data.error ? String(data.error?.message || data.error).slice(0, 500) : null,
        lastErrorCode: data.error?.code || null
      }
    });
    return { job, created: true };
  };
  return typeof db.$transaction === "function" ? db.$transaction(run) : run(db);
}

async function enqueueIngestFailure(db, { sourceId, docId, fingerprint, actorUserId, error }) {
  return enqueueMasterSourceJob(db, {
    action: "RAG_INGEST",
    resourceId: sourceId,
    externalRef: docId,
    storagePath: `master_source_ingest:${fingerprint}`,
    actorUserId,
    maxAttempts: MASTER_SOURCE_MAX_ATTEMPTS,
    nextAttemptAt: new Date(),
    error
  });
}

export function createMasterSourceLifecycleService({ stateStore, db, rag, fetcher, now = () => new Date() } = {}) {
  if (!stateStore?.read || !stateStore?.mutate) throw new TypeError("stateStore with read/mutate is required");
  if (!db) throw new TypeError("db is required");

  async function approve({ sourceId, candidate, expectedFingerprint, actorUserId, confirmed }) {
    if (confirmed !== true) throw new MasterSourceLifecycleError("admin_confirmation_required");
    const fingerprint = candidateFingerprint(candidate);
    if (expectedFingerprint !== fingerprint) throw new MasterSourceLifecycleError("candidate_fingerprint_mismatch");
    requireText(actorUserId, "admin_actor_required");
    const current = await stateStore.read();
    const existing = current.state.sources?.[sourceId];
    if (existing?.approved_candidate?.fingerprint === fingerprint) return { status: "already_approved", state: current.state, fingerprint: current.fingerprint };
    const written = await stateStore.mutate(current.fingerprint, state => {
      const prior = state.sources[sourceId] || { source_id: sourceId, version: 0 };
      state.sources[sourceId] = {
        ...prior,
        approved_candidate: {
          fingerprint,
          content_hash: candidate.content_hash || null,
          final_url: candidate.final_url || candidate.url || null,
          approved_at: now().toISOString(),
          approved_by: actorUserId
        },
        status: "approved_pending_apply"
      };
      return state;
    });
    return { status: "approved", ...written };
  }

  async function applyApproved({ sourceId, record, candidate, expectedFingerprint, actorUserId, confirmed }) {
    if (!rag?.ingestText || !rag?.countChunks || !rag?.deleteDocument || !rag?.patchMetadata) throw new TypeError("rag client is incomplete");
    if (typeof fetcher !== "function") throw new TypeError("fetcher is required");
    if (confirmed !== true) throw new MasterSourceLifecycleError("admin_confirmation_required");
    const fingerprint = candidateFingerprint(candidate);
    if (expectedFingerprint !== fingerprint) throw new MasterSourceLifecycleError("candidate_fingerprint_mismatch");
    requireText(actorUserId, "admin_actor_required");
    const current = await stateStore.read();
    const source = current.state.sources?.[sourceId] || {};
    if (source.last_applied_fingerprint === fingerprint) return { status: "already_applied", docId: source.current_doc_id || null };
    const approved = approvedCandidate(source);
    if (approved.fingerprint !== fingerprint) throw new MasterSourceLifecycleError("candidate_not_current_approval");

    const oldDocId = source.current_doc_id || null;
    const version = Number(source.version || 0) + 1;
    let payload;
    try {
      const response = await fetcher(candidate.final_url || candidate.url || record.url);
      const html = Buffer.isBuffer(response?.body) ? response.body.toString("utf8") : String(response?.body || response?.text || "");
      const realHash = contentHashForHtmlOrTopic(html);
      if (!candidate.content_hash || candidate.content_hash !== realHash) throw new MasterSourceLifecycleError("candidate_content_hash_mismatch");
      payload = buildHtmlOrTopicIngestPayload({
        record,
        html,
        checkedAt: now().toISOString(),
        version,
        finalUrl: response?.finalUrl || candidate.final_url || candidate.url || record.url,
        supersedesDocId: oldDocId
      });
      await rag.ingestText(payload);
      const chunks = await rag.countChunks(payload.doc_id);
      if (!(Number(chunks) > 0)) throw new MasterSourceLifecycleError("ingest_chunks_not_proven");
    } catch (error) {
      const plannedDocId = payload?.doc_id || `master-source:${sourceId}:v${version}`;
      await enqueueIngestFailure(db, { sourceId, docId: plannedDocId, fingerprint, actorUserId, error });
      throw error;
    }

    let moved = null;
    try {
      if (oldDocId) await rag.patchMetadata(oldDocId, { is_current_version: false, historical: true, source_status: "superseded" });
      moved = await stateStore.mutate(current.fingerprint, state => {
        const latest = state.sources[sourceId] || {};
        if (latest.approved_candidate?.fingerprint !== fingerprint) throw new MasterSourceLifecycleError("candidate_not_current_approval");
        state.sources[sourceId] = {
          ...latest,
          source_id: sourceId,
          version,
          current_doc_id: payload.doc_id,
          current_content_hash: payload.contentHash,
          last_applied_fingerprint: fingerprint,
          last_applied_at: now().toISOString(),
          last_applied_by: actorUserId,
          approved_candidate: null,
          status: "current",
          superseded_doc_ids: oldDocId ? [...new Set([...(latest.superseded_doc_ids || []), oldDocId])] : (latest.superseded_doc_ids || [])
        };
        return state;
      });
      if (oldDocId) {
        await enqueueMasterSourceJob(db, {
          action: "RAG_DELETE",
          resourceId: sourceId,
          externalRef: oldDocId,
          storagePath: `master_source_superseded:v${Math.max(1, version - 1)}`,
          actorUserId,
          maxAttempts: MASTER_SOURCE_MAX_ATTEMPTS
        });
      }
      return { status: "applied", docId: payload.doc_id, contentHash: payload.contentHash, state: moved.state };
    } catch (error) {
      if (moved) {
        const latest = await stateStore.read().catch(() => null);
        if (latest?.state?.sources?.[sourceId]?.last_applied_fingerprint === fingerprint) {
          await stateStore.mutate(latest.fingerprint, state => {
            state.sources[sourceId] = source;
            return state;
          }).catch(() => null);
        }
      }
      await rag.deleteDocument(payload.doc_id).catch(() => null);
      if (oldDocId) await rag.patchMetadata(oldDocId, { is_current_version: true, historical: false, source_status: "active" }).catch(() => null);
      throw error;
    }
  }

  async function processJob(job, { retryIngest } = {}) {
    if (!rag?.countChunks || !rag?.deleteDocument) throw new TypeError("rag client is incomplete");
    if (!job || job.resourceType !== MASTER_SOURCE_RESOURCE_TYPE) throw new MasterSourceLifecycleError("unsupported_master_source_job");
    const due = !job.nextAttemptAt || new Date(job.nextAttemptAt).getTime() <= now().getTime();
    if (!due || job.status === "done" || job.status === "failed") return { status: "not_due" };
    const attempt = Number(job.attempts || 0) + 1;
    try {
      if (job.action === "RAG_DELETE") {
        await rag.deleteDocument(job.externalRef);
        const chunks = await rag.countChunks(job.externalRef);
        if (Number(chunks) !== 0) throw new MasterSourceLifecycleError("delete_chunks_not_zero");
      } else if (job.action === "RAG_INGEST" && typeof retryIngest === "function") {
        await retryIngest(job);
      } else {
        throw new MasterSourceLifecycleError("master_source_retry_not_configured");
      }
      return db.dataDeletionJob.update({ where: { id: job.id }, data: { status: "done", attempts: attempt, lastError: null, lastErrorCode: null, nextAttemptAt: null } });
    } catch (error) {
      const maxAttempts = Number(job.maxAttempts) || MASTER_SOURCE_MAX_ATTEMPTS;
      const failed = attempt >= maxAttempts;
      return db.dataDeletionJob.update({
        where: { id: job.id },
        data: {
          status: failed ? "failed" : "pending",
          attempts: attempt,
          lastError: String(error?.message || error).slice(0, 500),
          lastErrorCode: error?.code || "master_source_retry_failed",
          nextAttemptAt: failed ? null : new Date(now().getTime() + retryBackoffMs(attempt))
        }
      });
    }
  }

  return { approve, applyApproved, processJob };
}
