import test from "node:test"
import assert from "node:assert/strict"

import {
  assertDocumentRagIngestReady,
  attemptDocumentRagRemoval,
  prepareDocumentRagPermissionChange
} from "../../lib/documents/ragPermission.js"

const document = {
  id: "doc_1",
  ownerId: "owner_1",
  sha256: "a".repeat(64),
  agentAllowed: true,
  metadata: { source: "test" }
}

function preparationTx({ unresolved = null } = {}) {
  const state = { jobs: [], audits: [] }
  return {
    state,
    dataDeletionJob: {
      findFirst: async () => unresolved,
      create: async ({ data }) => {
        const job = { id: "job_1", ...data }
        state.jobs.push(job)
        return job
      }
    },
    dataAuditLog: {
      create: async ({ data }) => {
        state.audits.push(data)
        return data
      }
    }
  }
}

function attemptDb(pendingDocument) {
  const state = { document: structuredClone(pendingDocument), job: { id: "job_1", status: "pending", attempts: 0 }, audits: [] }
  const tx = {
    dataDeletionJob: {
      update: async ({ data }) => {
        state.job = {
          ...state.job,
          ...data,
          attempts: state.job.attempts + Number(data.attempts?.increment || 0)
        }
        return state.job
      }
    },
    userDocument: {
      findFirst: async () => ({ ...state.document }),
      update: async ({ data }) => {
        state.document = { ...state.document, ...data }
        return state.document
      }
    },
    dataAuditLog: {
      create: async ({ data }) => {
        state.audits.push(data)
        return data
      }
    }
  }
  return { state, $transaction: async (run) => run(tx) }
}

test("SOL-DOC-J-03: revoke queues an audited durable job before returning pending metadata", async () => {
  const tx = preparationTx()
  const plan = prepareDocumentRagPermissionChange({
    document,
    nextAgentAllowed: false,
    metadata: document.metadata,
    actorUserId: "owner_1",
    targetUserId: "owner_1"
  })
  const prepared = await plan.prepareWithin(tx)
  assert.equal(plan.removalRequested, true)
  assert.equal(tx.state.jobs.length, 1)
  assert.equal(tx.state.audits[0].action, "RAG_DELETE_REQUESTED")
  assert.equal(prepared.data.metadata.ragRemoval.status, "pending")
  assert.equal(prepared.data.metadata.ragRemoval.jobId, "job_1")
})

test("SOL-DOC-J-03: failed delete remains recoverable and blocks re-enable/ingest", async () => {
  const pending = {
    ...document,
    agentAllowed: false,
    metadata: {
      ragRemoval: {
        status: "pending",
        jobId: "job_1",
        externalRef: `agent::doc_1::${"a".repeat(64)}`
      }
    }
  }
  const db = attemptDb(pending)
  const updated = await attemptDocumentRagRemoval(
    { document: pending, actorUserId: "owner_1", targetUserId: "owner_1" },
    { db, deleteIndex: async () => ({ ok: false, reason: "injected_rag_failure" }) }
  )
  assert.equal(updated.metadata.ragRemoval.status, "failed")
  assert.equal(db.state.job.status, "failed")
  assert.equal(db.state.audits[0].action, "RAG_DELETE_PENDING")

  const reenable = prepareDocumentRagPermissionChange({
    document: updated,
    nextAgentAllowed: true,
    metadata: updated.metadata,
    actorUserId: "owner_1",
    targetUserId: "owner_1"
  })
  const tx = preparationTx({ unresolved: { id: "job_1" } })
  await assert.rejects(() => reenable.prepareWithin(tx), (error) => error.status === 409)
  await assert.rejects(
    () => assertDocumentRagIngestReady({ ...updated, agentAllowed: true }, { db: tx }),
    (error) => error.status === 409
  )
})

test("SOL-DOC-J-03: confirmed delete closes the job and persists done", async () => {
  const pending = {
    ...document,
    agentAllowed: false,
    metadata: {
      ragRemoval: {
        status: "pending",
        jobId: "job_1",
        externalRef: `agent::doc_1::${"a".repeat(64)}`
      }
    }
  }
  const db = attemptDb(pending)
  const updated = await attemptDocumentRagRemoval(
    { document: pending, actorUserId: "owner_1", targetUserId: "owner_1" },
    { db, deleteIndex: async () => ({ ok: true, missing: true }) }
  )
  assert.equal(updated.metadata.ragRemoval.status, "done")
  assert.equal(db.state.job.status, "done")
  assert.equal(db.state.audits[0].action, "RAG_DELETE")
})

test("SOL-DOC-J-03: content replacement still deletes the queued RAG identity", async () => {
  const oldExternalRef = `agent::doc_1::${"a".repeat(64)}`
  const pending = {
    ...document,
    sha256: "b".repeat(64),
    agentAllowed: false,
    metadata: {
      ragRemoval: {
        status: "pending",
        jobId: "job_1",
        externalRef: oldExternalRef
      }
    }
  }
  const db = attemptDb(pending)
  let deletedExternalRef = null

  await attemptDocumentRagRemoval(
    { document: pending, actorUserId: "owner_1", targetUserId: "owner_1" },
    {
      db,
      deleteIndex: async (externalRef) => {
        deletedExternalRef = externalRef
        return { ok: true }
      }
    }
  )

  assert.equal(deletedExternalRef, oldExternalRef)
  assert.equal(db.state.job.status, "done")
})
