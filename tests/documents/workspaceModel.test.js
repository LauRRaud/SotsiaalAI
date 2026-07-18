import assert from "node:assert/strict"
import test from "node:test"

import { buildWorkspaceItems } from "../../lib/documents/workspace.js"
import { describeProvenance, researchStatusLabel, workspaceTypeLabel } from "../../lib/documents/presentation.js"

// T07 E3 — the unified "My documents" model. buildWorkspaceItems is the single place that
// decides an object's type, provenance and privacy descriptor, so it is unit-tested here;
// describeProvenance turns that descriptor into the localized provenance bar.

// A fake t: returns the key, but for interpolated retention it appends the day count so the
// test can prove the {days} var is threaded through.
const fakeT = (key, vars) => (vars && vars.days != null ? `${key}:${vars.days}` : key)

function itemsByType(items) {
  const map = new Map()
  for (const item of items) map.set(item.type, item)
  return map
}

test("uploaded document maps to an owner-only source that never enters shared search", () => {
  const [item] = buildWorkspaceItems({ documents: [{ id: "d1", kind: "MATERIAL", title: "Fail", updatedAt: "2026-07-18T10:00:00.000Z", agentAllowed: false }] })
  assert.equal(item.type, "source")
  assert.equal(item.provenance.audience, "owner_only")
  assert.equal(item.provenance.origin, "uploaded")
  assert.equal(item.provenance.rag, "not_in_search")
  assert.deepEqual(item.provenance.retention, { key: "retention_days", days: 90 })
})

test("agentAllowed document is the only object whose audience widens to work mode / shared search", () => {
  const [item] = buildWorkspaceItems({ documents: [{ id: "d2", kind: "MATERIAL", updatedAt: "2026-07-18T10:00:00.000Z", agentAllowed: true }] })
  assert.equal(item.provenance.audience, "owner_and_worktree")
  assert.equal(item.provenance.rag, "in_search_when_shared")
})

test("audio-transcript kinds are presented as transcripts, not raw source files", () => {
  const [item] = buildWorkspaceItems({ documents: [{ id: "d3", kind: "AUDIO_TRANSCRIPT", updatedAt: "2026-07-18T10:00:00.000Z" }] })
  assert.equal(item.type, "transcript")
  assert.equal(item.provenance.origin, "transcript")
})

test("artifacts split into draft/final and stay out of shared search", () => {
  const items = buildWorkspaceItems({
    artifacts: [
      { id: "a1", status: "DRAFT", title: "Mustand", updatedAt: "2026-07-18T09:00:00.000Z" },
      { id: "a2", status: "FINAL", title: "Kinnitatud", updatedAt: "2026-07-18T09:30:00.000Z" }
    ]
  })
  const byType = itemsByType(items)
  assert.equal(byType.get("draft").provenance.origin, "ai_draft")
  assert.equal(byType.get("final").provenance.origin, "ai_final")
  for (const item of items) assert.equal(item.provenance.rag, "not_in_search")
})

test("saved analysis is owner-only, kept until deleted, and carries its disclaimer through", () => {
  const [item] = buildWorkspaceItems({ analyses: [{ id: "an1", title: "Selgitus", updatedAt: "2026-07-18T08:00:00.000Z", disclaimer: "ai_explanation_not_official_decision" }] })
  assert.equal(item.type, "analysis")
  assert.equal(item.provenance.audience, "owner_only")
  assert.equal(item.provenance.rag, "not_in_search")
  assert.deepEqual(item.provenance.retention, { key: "retention_until_deleted" })
  assert.equal(item.disclaimer, "ai_explanation_not_official_decision")
})

test("research job reads the knowledge base but its result is never shared; query is the title", () => {
  const [item] = buildWorkspaceItems({ research: [{ id: "r1", status: "done", query: "toetused", updatedAt: "2026-07-18T11:00:00.000Z", convId: "conv-1" }] })
  assert.equal(item.type, "research")
  assert.equal(item.title, "toetused")
  assert.equal(item.provenance.origin, "research")
  assert.equal(item.provenance.rag, "reads_kb")
  assert.deepEqual(item.provenance.retention, { key: "retention_days", days: 14 })
  assert.equal(item.convId, "conv-1")
})

test("all families merge into one list sorted newest-first", () => {
  const items = buildWorkspaceItems({
    documents: [{ id: "d1", kind: "MATERIAL", updatedAt: "2026-07-18T10:00:00.000Z" }],
    artifacts: [{ id: "a1", status: "DRAFT", updatedAt: "2026-07-18T12:00:00.000Z" }],
    analyses: [{ id: "an1", updatedAt: "2026-07-18T08:00:00.000Z" }],
    research: [{ id: "r1", status: "queued", updatedAt: "2026-07-18T11:00:00.000Z" }]
  })
  assert.deepEqual(items.map((item) => item.id), ["a1", "r1", "d1", "an1"])
})

test("objects without an id are dropped rather than rendered as broken rows", () => {
  const items = buildWorkspaceItems({ documents: [{ kind: "MATERIAL" }, { id: "d1", kind: "MATERIAL", updatedAt: "2026-07-18T10:00:00.000Z" }] })
  assert.equal(items.length, 1)
  assert.equal(items[0].id, "d1")
})

test("describeProvenance renders the five provenance-bar fields and threads the retention days", () => {
  const [item] = buildWorkspaceItems({ documents: [{ id: "d1", kind: "MATERIAL", updatedAt: "2026-07-18T10:00:00.000Z", agentAllowed: true }] })
  const described = describeProvenance(item, fakeT)
  assert.equal(described.audience, "documents.provenance.audience.owner_and_worktree")
  assert.equal(described.origin, "documents.provenance.origin.uploaded")
  assert.equal(described.state, "documents.kinds.material")
  assert.equal(described.retention, "documents.provenance.retention.days:90")
  assert.equal(described.rag, "documents.provenance.rag.in_search_when_shared")
})

test("research + type labels resolve to their own namespaced keys", () => {
  assert.equal(researchStatusLabel("running", fakeT), "documents.workspace.research_status.running")
  assert.equal(researchStatusLabel("weird-unknown", fakeT), "documents.workspace.research_status.queued")
  assert.equal(workspaceTypeLabel("final", fakeT), "documents.workspace.types.final")
})
