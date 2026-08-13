import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const routeSource = fs.readFileSync(new URL("../../app/api/materials/route.js", import.meta.url), "utf8")
const itemRouteSource = fs.readFileSync(new URL("../../app/api/materials/[id]/route.js", import.meta.url), "utf8")
const downloadRouteSource = fs.readFileSync(new URL("../../app/api/materials/[id]/download/route.js", import.meta.url), "utf8")
const schemaSource = fs.readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8")
const lifecycleSource = fs.readFileSync(new URL("../../lib/materials/lifecycle.js", import.meta.url), "utf8")

test("material upload is subscription and professional-role gated on the server", () => {
  assert.match(routeSource, /uploadAccess = requireMaterialUploadAccess/)
  assert.match(routeSource, /await uploadAccess\(session/)
})

test("material upload uses a durable batch, idempotency fingerprint, and atomic quota path", () => {
  assert.match(schemaSource, /model MaterialSubmissionBatch\s*{/)
  assert.match(schemaSource, /@@unique\(\[submittedByUserId, idempotencyKey\]\)/)
  assert.match(routeSource, /createSubmissions = createMaterialSubmissions/)
  assert.match(routeSource, /await createSubmissions\(/)
  assert.doesNotMatch(routeSource, /enforceDocumentsRateLimit\(/)
})

test("material upload validates the complete buffered document before storage", () => {
  assert.match(routeSource, /await validateMaterialBuffer\(buffer, mime\)/)
  assert.doesNotMatch(routeSource, /assertMimeMatchesBuffer\(/)
})

test("material list is owner scoped unless admin and uses a stable cursor", () => {
  assert.match(routeSource, /listMaterialSubmissions\(/)
  assert.match(lifecycleSource, /nextCursor/)
  assert.match(lifecycleSource, /hasMore/)
})

test("material deletion and download use owner-aware lifecycle services", () => {
  assert.match(itemRouteSource, /requestMaterialSubmissionDeletion\(/)
  assert.match(downloadRouteSource, /getMaterialSubmissionDownload\(/)
  assert.doesNotMatch(itemRouteSource, /deleteStoredMaterial\(/)
  assert.doesNotMatch(downloadRouteSource, /findUnique\(\{\s*where: \{ id \}/)
})
