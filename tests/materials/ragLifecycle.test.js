import assert from "node:assert/strict"
import test from "node:test"

import {
  buildMaterialRagIdentity,
  materialRagPolicyFromEnvironment,
  requireMaterialRagPolicy
} from "../../lib/materials/ragPolicy.js"

const policy = {
  version: "synthetic-v1",
  rightsEvidenceMode: "DOCUMENTED_LICENSE",
  collection: "synthetic_professional_materials",
  audience: "SOCIAL_WORKER",
  retentionMode: "DELETE_WITH_SUBMISSION_OR_ACCOUNT",
  withdrawalAuthority: "SUBMITTER_RIGHTS_HOLDER_OR_ADMIN"
}

test("material RAG stays fail-closed until every owner policy choice is configured", () => {
  const result = materialRagPolicyFromEnvironment({
    MATERIALS_RAG_POLICY_VERSION: "v1",
    MATERIALS_RAG_AUDIENCE: "SOCIAL_WORKER"
  })
  assert.equal(result.configured, false)
  assert.deepEqual(result.missing.sort(), [
    "collection",
    "retentionMode",
    "rightsEvidenceMode",
    "withdrawalAuthority"
  ])
  assert.throws(() => requireMaterialRagPolicy(result.policy), /rag_ingest_decision_required/)
})

test("material RAG policy rejects an unknown audience instead of widening retrieval", () => {
  assert.throws(
    () => requireMaterialRagPolicy({ ...policy, audience: "PUBLIC" }),
    /rag_ingest_decision_required/
  )
  assert.deepEqual(requireMaterialRagPolicy(policy), policy)
})

test("material RAG identity is stable by source and explicit version", () => {
  const identity = buildMaterialRagIdentity({
    id: "mat-1",
    sha256: "a".repeat(64)
  }, 3)
  assert.deepEqual(identity, {
    sourceId: "material:mat-1",
    docId: "material:mat-1:v3",
    contentHash: "a".repeat(64)
  })
  assert.throws(() => buildMaterialRagIdentity({ id: "mat-1", sha256: "bad" }, 1), /identity_invalid/)
})
