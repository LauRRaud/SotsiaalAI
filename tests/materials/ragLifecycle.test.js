import assert from "node:assert/strict"
import test from "node:test"

import {
  buildMaterialRagIdentity,
  MATERIAL_RAG_POLICY,
  materialRagPolicyFromEnvironment,
  requireMaterialRagPolicy,
  requireMaterialSharedRagRights
} from "../../lib/materials/ragPolicy.js"

const policy = MATERIAL_RAG_POLICY

test("confirmed material RAG policy is canonical and environment drift fails closed", () => {
  const result = materialRagPolicyFromEnvironment({
    MATERIALS_RAG_AUDIENCE: "PUBLIC"
  })
  assert.equal(result.configured, false)
  assert.deepEqual(result.missing, ["audience"])
  assert.throws(() => requireMaterialRagPolicy(result.policy), /rag_ingest_decision_required/)
  assert.deepEqual(materialRagPolicyFromEnvironment({}).policy, MATERIAL_RAG_POLICY)
})

test("shared RAG accepts documented public/open/permission rights only and rejects sensitive material", () => {
  const rights = {
    authorName: "Synthetic author",
    rightsHolder: "Synthetic holder",
    rightsBasis: "OPEN_LICENSE",
    rightsEvidence: "Synthetic SPDX-style evidence",
    clientCaseMaterial: false,
    confidential: false,
    containsPersonalData: false
  }
  assert.equal(requireMaterialSharedRagRights(rights).rightsBasis, "OPEN_LICENSE")
  assert.throws(() => requireMaterialSharedRagRights({ ...rights, rightsBasis: "SUBMITTER_ATTESTATION" }), /rights_forbidden/)
  assert.throws(() => requireMaterialSharedRagRights({ ...rights, containsPersonalData: true }), /rights_forbidden/)
  assert.equal(requireMaterialSharedRagRights({
    ...rights,
    clientCaseMaterial: undefined,
    confidential: undefined,
    containsPersonalData: undefined,
    rightsConfirmedAt: new Date(),
    rightsConfirmedByUserId: "synthetic-admin"
  }).rightsBasis, "OPEN_LICENSE")
})

test("material RAG policy rejects an unknown audience instead of widening retrieval", () => {
  assert.throws(
    () => requireMaterialRagPolicy({ ...policy, audience: "PUBLIC" }),
    /rag_ingest_decision_required/
  )
  assert.deepEqual(requireMaterialRagPolicy(policy), policy)
  assert.throws(
    () => requireMaterialRagPolicy({ ...policy, collection: "synthetic_professional_materials" }),
    /rag_ingest_decision_required/
  )
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
