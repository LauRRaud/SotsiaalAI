import test from "node:test"
import assert from "node:assert/strict"

import { handleMaterialPost } from "../../app/api/materials/route.js"
import { requireMaterialUploadAccess } from "../../lib/materials/access.js"

const session = (role, id = "user-1") => ({ user: { id, role } })

function emptyUploadRequest() {
  return new Request("http://localhost/api/materials", { method: "POST", body: new FormData() })
}

async function statusFor(currentSession, subscriptionGate = async () => ({ ok: true, status: 200 })) {
  const response = await handleMaterialPost(emptyUploadRequest(), {
    sessionProvider: async () => currentSession,
    uploadAccess: (value) => requireMaterialUploadAccess(value, { subscriptionGate })
  })
  return response.status
}

test("material POST returns HTTP denial statuses for unauthenticated, client, and expired sessions", async () => {
  assert.equal(await statusFor(null), 401)
  assert.equal(await statusFor(session("CLIENT")), 403)
  assert.equal(await statusFor(session("SOCIAL_WORKER"), async () => ({ ok: false, status: 402, message: "api.common.subscription_required" })), 402)
})

test("material POST admits active worker, provider, and admin past the gate", async () => {
  // Empty multipart then reaches file validation (400), proving the access gate did not return 401/402/403.
  assert.equal(await statusFor(session("SOCIAL_WORKER")), 400)
  assert.equal(await statusFor(session("SERVICE_PROVIDER")), 400)
  assert.equal(await statusFor(session("ADMIN")), 400)
})

test("material POST re-evaluates a changed role on every request", async () => {
  assert.equal(await statusFor(session("SOCIAL_WORKER", "same-user")), 400)
  assert.equal(await statusFor(session("CLIENT", "same-user")), 403)
})
