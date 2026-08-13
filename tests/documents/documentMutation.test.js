import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

import {
  parseExpectedDocumentVersion,
  updateOwnedDocument,
  updateOwnedDocumentWithStagedText
} from "../../lib/documents/documentMutation.js"

function mutationDb() {
  const state = {
    row: {
      id: "doc_1",
      ownerId: "owner_1",
      title: "Algne",
      content: "algne",
      updatedAt: new Date("2026-08-12T10:00:00.000Z")
    }
  }
  const tx = {
    userDocument: {
      updateMany: async ({ where, data }) => {
        if (
          where.id !== state.row.id ||
          where.ownerId !== state.row.ownerId ||
          where.updatedAt.getTime() !== state.row.updatedAt.getTime()
        ) return { count: 0 }
        state.row = {
          ...state.row,
          ...data,
          updatedAt: new Date(state.row.updatedAt.getTime() + 1)
        }
        return { count: 1 }
      },
      findFirst: async ({ where }) =>
        where.id === state.row.id && where.ownerId === state.row.ownerId ? { ...state.row } : null
    }
  }
  return { state, $transaction: async (run) => run(tx) }
}

test("SOL-DOC-J-02: PATCH version is required and must be a valid timestamp", () => {
  assert.throws(() => parseExpectedDocumentVersion(null), (error) => error.status === 400)
  assert.throws(() => parseExpectedDocumentVersion("not-a-date"), (error) => error.status === 400)
  assert.equal(parseExpectedDocumentVersion("2026-08-12T10:00:00Z").toISOString(), "2026-08-12T10:00:00.000Z")
})

test("SOL-DOC-J-02: two writes from one revision produce one winner and one fresh 409", async () => {
  const db = mutationDb()
  const expectedUpdatedAt = new Date(db.state.row.updatedAt)
  const results = await Promise.allSettled([
    updateOwnedDocument({ documentId: "doc_1", ownerId: "owner_1", expectedUpdatedAt, data: { title: "A" } }, { db }),
    updateOwnedDocument({ documentId: "doc_1", ownerId: "owner_1", expectedUpdatedAt, data: { title: "B" } }, { db })
  ])
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1)
  const loser = results.find((result) => result.status === "rejected")?.reason
  assert.equal(loser?.status, 409)
  assert.equal(loser?.freshDocument?.title, db.state.row.title)
})

test("SOL-DOC-J-02: staged text conflict rolls the candidate back without publishing", async () => {
  const db = mutationDb()
  let published = 0
  let rolledBack = 0
  db.state.row.updatedAt = new Date("2026-08-12T10:00:01Z")
  await assert.rejects(
    () => updateOwnedDocumentWithStagedText(
      {
        documentId: "doc_1",
        ownerId: "owner_1",
        expectedUpdatedAt: new Date("2026-08-12T10:00:00Z"),
        storagePath: "uploads/doc.txt",
        content: "kaotaja",
        data: {},
        select: { id: true, content: true, updatedAt: true }
      },
      {
        db,
        stage: async () => ({
          size: 7,
          sha256: "a".repeat(64),
          publish: async () => { published += 1 },
          rollback: async () => { rolledBack += 1 },
          cleanup: async () => {}
        })
      }
    ),
    (error) => error.status === 409 && error.freshDocument.content === "algne"
  )
  assert.equal(published, 0)
  assert.equal(rolledBack, 1)
})

test("SOL-DOC-J-02: every UserDocument PATCH client sends its visible revision", async () => {
  const [documentsPage, agentPage] = await Promise.all([
    readFile(new URL("../../components/documents/DocumentsPage.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../components/agent/AgentModePage.jsx", import.meta.url), "utf8")
  ])
  assert.match(documentsPage, /expectedUpdatedAt:\s*currentDocument\.updatedAt/)
  assert.match(agentPage, /expectedUpdatedAt:\s*transcript\.updatedAt/)
  assert.doesNotMatch(agentPage, /const allowResponse = await fetch/)
  assert.doesNotMatch(
    agentPage.slice(
      agentPage.indexOf("function handleClientRemoveDocument"),
      agentPage.indexOf("async function loadTranscriptDocument")
    ),
    /method:\s*"PATCH"/
  )
})
