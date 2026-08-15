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

test("material POST rejects an invalid idempotency key before quarantine writes", async () => {
  const form = new FormData()
  form.append("file", new File(["safe"], "safe.txt", { type: "text/plain" }))
  let quarantineCalls = 0
  const response = await handleMaterialPost(new Request("http://localhost/api/materials", { method: "POST", body: form }), {
    sessionProvider: async () => session("SOCIAL_WORKER"),
    uploadAccess: async () => ({ ok: true }),
    quarantineUpload: async () => { quarantineCalls += 1 }
  })
  assert.equal(response.status, 400)
  assert.equal(quarantineCalls, 0)
})

test("material POST discards request quarantines when submission admission fails", async () => {
  const form = new FormData()
  form.append("idempotencyKey", "valid-request-key")
  form.append("file", new File(["safe"], "safe.txt", { type: "text/plain" }))
  const discarded = []
  const response = await handleMaterialPost(new Request("http://localhost/api/materials", { method: "POST", body: form }), {
    sessionProvider: async () => session("SOCIAL_WORKER"),
    uploadAccess: async () => ({ ok: true }),
    quarantineUpload: async () => ({ quarantineReceiptId: "receipt-1" }),
    discardQuarantine: async value => discarded.push(value.receiptId),
    createSubmissions: async () => { const error = new Error("api.common.too_many_requests"); error.status = 429; throw error }
  })
  assert.equal(response.status, 429)
  assert.deepEqual(discarded, ["receipt-1"])
})
