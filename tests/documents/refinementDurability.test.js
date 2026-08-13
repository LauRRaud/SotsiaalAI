import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")

test("refinement is a persisted idempotent job fenced by the artifact version", () => {
  const route = read("app/api/documents/artifacts/refine/route.js")
  assert.match(route, /expectedUpdatedAt/)
  assert.match(route, /claimArtifactRefinement/)
  assert.match(route, /persistArtifactRefinement/)
  assert.match(route, /claim\.reused/)
  assert.doesNotMatch(route, /updatedAt:\s*new Date\(\)\.toISOString\(\)/)
})

test("provider work has a server deadline while browser Stop is explicitly recoverable", () => {
  const generation = read("lib/documents/generation.js")
  const page = read("components/agent/AgentModePage.jsx")
  assert.match(generation, /responses\.create\([\s\S]*?signal:\s*requestSignal/)
  assert.match(page, /documents\.agent_workspace\.refine_continues_after_stop/)
})

test("schema has a durable refinement job with lease and one owner intent", () => {
  const schema = read("prisma/schema.prisma")
  assert.match(schema, /model AgentArtifactRefinement/)
  assert.match(schema, /leaseExpiresAt\s+DateTime\?/)
  assert.match(schema, /resultContent\s+String\?[\s\S]*@db\.Text/)
  assert.match(schema, /@@unique\(\[ownerId, idempotencyKey\]/)
})
