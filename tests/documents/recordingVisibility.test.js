import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { visibleRecordingDocumentWhere } from "../../lib/documents/recordingVisibility.js"

test("pending-deletion and quarantined call recordings are excluded from document reads", () => {
  assert.deepEqual(visibleRecordingDocumentWhere(), {
    callRecordingFiles: {
      none: { status: { in: ["DELETE_PENDING", "QUARANTINED"] } }
    }
  })
})

test("recording visibility guard protects every document audio disclosure boundary", async () => {
  const routes = [
    "app/api/documents/route.js",
    "app/api/documents/[id]/route.js",
    "app/api/documents/[id]/download/route.js",
    "app/api/documents/[id]/transcribe/route.js",
    "app/api/documents/[id]/audio-select/route.js",
    "app/api/documents/audio-sources/route.js"
  ]

  for (const route of routes) {
    const source = await readFile(new URL(`../../${route}`, import.meta.url), "utf8")
    assert.match(source, /visibleRecordingDocumentWhere\(\)/u, route)
  }
})
