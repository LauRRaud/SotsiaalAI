import test from "node:test"
import assert from "node:assert/strict"

import { DATA_EXPORT_REGISTRY } from "../../lib/dataExport/registry.js"

const document = {
  id: "document-stable-id",
  title: "Fail",
  originalName: "fail.txt",
  kind: "MATERIAL",
  mime: "text/plain",
  size: 10,
  sha256: "a".repeat(64),
  storagePath: "uploads/secret-path.txt",
  createdAt: new Date(),
  updatedAt: new Date()
}

const surface = DATA_EXPORT_REGISTRY.find((entry) => entry.name === "documents_and_artifacts")
const db = {
  userDocument: { findMany: async () => [document] },
  agentArtifact: { findMany: async () => [] }
}

for (const [label, injected, reason] of [
  ["ENOENT", Object.assign(new Error("secret path does not exist"), { code: "ENOENT" }), "missing"],
  ["access error", Object.assign(new Error("secret permission detail"), { code: "EACCES" }), "access_denied"],
  ["containment error", new Error("documents.errors.storage_path_invalid: secret root"), "containment"],
  ["mid-read error", new Error("unique secret stream marker"), "read_failed"]
]) {
  test(`SOL-DOC-J-05: ${label} fails the whole export without leaking the path`, async () => {
    await assert.rejects(
      () => surface.collect({
        db,
        userId: "owner-1",
        readDocument: async () => { throw injected }
      }),
      (error) => {
        assert.equal(error.code, "DATA_EXPORT_DOCUMENT_FILE_UNREADABLE")
        assert.equal(error.documentId, "document-stable-id")
        assert.equal(error.reason, reason)
        assert.match(error.message, new RegExp(`^data_export\\.document_file_unreadable\\|document-stable-id\\|${reason}$`))
        assert.doesNotMatch(error.message, /secret|uploads/)
        return true
      }
    )
  })
}
