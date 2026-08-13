import test from "node:test"
import assert from "node:assert/strict"

import { requireMaterialReadAccess, requireMaterialUploadAccess } from "../../lib/materials/access.js"

const session = (role, id = "user-1") => ({ user: { id, role } })

test("material upload access denies unauthenticated and client sessions", async () => {
  assert.equal((await requireMaterialUploadAccess(null)).status, 401)
  assert.equal((await requireMaterialUploadAccess(session("CLIENT"))).status, 403)
})

test("material upload access checks live subscription for both professional roles", async () => {
  const active = async () => ({ ok: true, status: 200 })
  const expired = async () => ({ ok: false, status: 402, message: "api.common.subscription_required" })
  assert.equal((await requireMaterialUploadAccess(session("SOCIAL_WORKER"), { subscriptionGate: active })).ok, true)
  assert.equal((await requireMaterialUploadAccess(session("SERVICE_PROVIDER"), { subscriptionGate: active })).ok, true)
  assert.equal((await requireMaterialUploadAccess(session("SOCIAL_WORKER"), { subscriptionGate: expired })).status, 402)
})

test("admin bypasses subscription but a changed session role is re-evaluated", async () => {
  let gateCalls = 0
  const gate = async () => { gateCalls += 1; return { ok: true, status: 200 } }
  assert.equal((await requireMaterialUploadAccess(session("ADMIN"), { subscriptionGate: gate })).ok, true)
  assert.equal(gateCalls, 0)
  assert.equal((await requireMaterialUploadAccess(session("CLIENT"), { subscriptionGate: gate })).status, 403)
  assert.equal(gateCalls, 0)
})

test("listing and owner lifecycle remain available without subscription", () => {
  assert.deepEqual(requireMaterialReadAccess(null), { ok: false, status: 401, message: "api.common.unauthorized" })
  assert.deepEqual(requireMaterialReadAccess(session("CLIENT")), { ok: true, status: 200, userId: "user-1", admin: false })
  assert.deepEqual(requireMaterialReadAccess(session("ADMIN")), { ok: true, status: 200, userId: "user-1", admin: true })
})
