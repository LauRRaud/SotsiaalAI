import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

// T07 E3 — the unified workspace lists the owner's research jobs. These routes/store functions
// have no unit harness (module-level prisma), so the owner-scope + privacy guarantees are
// asserted against source, matching tests/documents/documentsResearchContracts.test.js.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8")

test("GET /api/research/jobs authenticates and lists only the caller's own jobs", () => {
  const route = read("app/api/research/jobs/route.js")
  assert.match(route, /export async function GET\(/)
  assert.match(route, /requireResearchAuth\(\)/)
  // The owner id comes from the authenticated session, never from the request.
  assert.match(route, /listResearchJobsForOwner\(\{\s*userId:\s*auth\.userId/)
  // Listing past jobs must stay readable even when creating new ones is disabled.
  assert.match(route, /enabled:\s*RESEARCH_API_ENABLED/)
})

test("listResearchJobsForOwner filters by userId and maps every row through the safe projector", () => {
  const store = read("lib/research/jobStore.js")
  // SOL-RES-07 lisas filtrid (convId, activeOnly), seega `where` on nüüd muutuja — omanikuskoop
  // peab aga OLEMA tema esimene tingimus ja mõlemad päringud peavad sama objekti kasutama.
  assert.match(store, /const where = \{\s*userId: targetUserId,/)
  assert.match(store, /count\(\{ where \}\)/)
  assert.match(store, /findMany\(\{\s*where,/)
  assert.match(store, /rows\.map\(toOwnerListItem\)/)
})

test("the research list item never leaks the report body — no result/metrics/full payload", () => {
  const store = read("lib/research/jobStore.js")
  const match = store.match(/function toOwnerListItem\(record\)\s*\{([\s\S]*?)\n\}/)
  assert.ok(match, "toOwnerListItem must exist")
  const body = match[1]
  // It exposes only status, timestamps and the owner's own (truncated) query + conv link.
  assert.match(body, /status:/)
  assert.match(body, /query:/)
  assert.match(body, /slice\(0,\s*200\)/, "the owner's query is length-capped")
  // It must NOT surface the synthesized report, its metrics, or spread the raw payload/record.
  assert.doesNotMatch(body, /\bresult\b/)
  assert.doesNotMatch(body, /\bmetrics\b/)
  assert.doesNotMatch(body, /payload:/, "payload is destructured into safe locals, never returned as a field")
  assert.doesNotMatch(body, /\.\.\.\s*(payload|record)/, "no spread of the raw job into the list item")
})
