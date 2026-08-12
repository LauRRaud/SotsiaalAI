import test from "node:test"
import assert from "node:assert/strict"

import { DATA_EXPORT_REGISTRY } from "../../lib/dataExport/registry.js"

test("SOL-DOC-J-04: saved analyses export is owner-scoped and preserves deleted source references", async () => {
  const rows = [
    {
      id: "analysis-own",
      ownerId: "owner-1",
      title: "Minu analüüs",
      content: "omaniku privaatne analüüs",
      sourceDocumentIds: ["source-present", "source-deleted"],
      metadata: { disclaimer: "ai_explanation_not_official_decision" },
      createdAt: new Date("2026-08-10T10:00:00Z"),
      updatedAt: new Date("2026-08-11T10:00:00Z")
    },
    {
      id: "analysis-foreign",
      ownerId: "owner-2",
      title: "Võõras",
      content: "võõra inimese privaatne analüüs",
      sourceDocumentIds: ["foreign-source"],
      metadata: null,
      createdAt: new Date("2026-08-10T10:00:00Z"),
      updatedAt: new Date("2026-08-11T10:00:00Z")
    }
  ]
  let where = null
  const db = {
    savedAnalysis: {
      findMany: async (query) => {
        where = query.where
        return rows.filter((row) => row.ownerId === query.where.ownerId)
      }
    }
  }
  const surface = DATA_EXPORT_REGISTRY.find((entry) => entry.name === "saved_analyses")
  const [entry] = await surface.collect({ db, userId: "owner-1" })
  const exported = entry.content.toString("utf8")
  assert.deepEqual(where, { ownerId: "owner-1" })
  assert.equal(entry.count, 1)
  assert.match(exported, /omaniku privaatne analüüs/)
  assert.match(exported, /source-deleted/)
  assert.match(exported, /ai_explanation_not_official_decision/)
  assert.doesNotMatch(exported, /võõra inimese|foreign-source/)
})
