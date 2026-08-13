import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const routeSource = fs.readFileSync(new URL("../../app/api/materials/route.js", import.meta.url), "utf8")
const itemRouteSource = fs.readFileSync(new URL("../../app/api/materials/[id]/route.js", import.meta.url), "utf8")
const downloadRouteSource = fs.readFileSync(new URL("../../app/api/materials/[id]/download/route.js", import.meta.url), "utf8")
const schemaSource = fs.readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8")
const lifecycleSource = fs.readFileSync(new URL("../../lib/materials/lifecycle.js", import.meta.url), "utf8")
const ragLifecycleSource = fs.readFileSync(new URL("../../lib/materials/ragLifecycle.js", import.meta.url), "utf8")
const ragMigrationSource = fs.readFileSync(new URL("../../prisma/migrations/20260814011000_sol_mat_08_rag_lifecycle/migration.sql", import.meta.url), "utf8")

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

test("material upload quarantines and scans before any document parser", () => {
  assert.doesNotMatch(routeSource, /validateMaterialBuffer/)
  assert.match(routeSource, /quarantineMaterialUpload/)
  assert.match(lifecycleSource, /scanState:\s*"CLEAN"/)
  assert.match(lifecycleSource, /validationState:\s*"VALIDATED"/)
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

test("material import route delegates to the versioned receipt-gated RAG lifecycle", () => {
  assert.match(itemRouteSource, /body\?\.action === "import_rag"/)
  assert.match(itemRouteSource, /importReviewedMaterialToRag\(/)
  assert.match(schemaSource, /ragIngestStatus\s+String\s+@default\("NOT_CONFIGURED"\)/)
  assert.match(schemaSource, /@@unique\(\[sha256, ragCollection, ragAudience\]\)/)
  assert.match(ragLifecycleSource, /Number\(receipt\?\.inserted\) > 0/)
  assert.match(ragLifecycleSource, /Number\(chunks\) > 0/)
  assert.match(ragLifecycleSource, /scanState !== "CLEAN"/)
  assert.match(ragLifecycleSource, /validationState !== "VALIDATED"/)
  assert.match(ragLifecycleSource, /action: "RAG_DELETE"/)
  assert.match(ragMigrationSource, /MaterialSubmission_imported_receipt_check/)
  assert.match(ragMigrationSource, /"ragIngestStatus" = 'IMPORTED'/)
})
