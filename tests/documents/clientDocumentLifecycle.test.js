import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8")

test("client upload creates the source and its agent permission in one request", async () => {
  const page = await read("components/agent/AgentModePage.jsx")
  const route = await read("app/api/documents/route.js")

  assert.match(page, /formData\.append\("agentAllowed", "true"\)/)
  assert.doesNotMatch(page, /const allowResponse = await fetch/)
  assert.match(route, /resolveUploadAgentAllowed/)
  assert.match(route, /agentAllowed,\s*\n\s*mime/)
})

test("remove from work is local selection state while delete stays an explicit library action", async () => {
  const page = await read("components/agent/AgentModePage.jsx")
  const documentsPage = await read("components/documents/DocumentsPage.jsx")
  const routePage = await read("app/documents/page.js")
  const removeHandler = page.slice(
    page.indexOf("function handleClientRemoveDocument"),
    page.indexOf("async function loadTranscriptDocument")
  )

  assert.doesNotMatch(removeHandler, /method: "PATCH"/)
  assert.match(page, /router\.replace\(buildWorkspaceHref\(persistedArtifactId, nextIds\)/)
  assert.doesNotMatch(routePage, /effectiveRole === "CLIENT"[\s\S]*?redirect/)
  assert.doesNotMatch(documentsPage, /router\.replace\(localizePath\("\/dokreziim"/)
  assert.match(documentsPage, /client_document_library/)
  assert.match(documentsPage, /method: "DELETE"/)
})

test("client source library is owner-list backed and can fetch past the first page", async () => {
  const page = await read("components/documents/DocumentsPage.jsx")
  assert.match(page, /docsState\.items/)
  assert.match(page, /docsState\.total/)
  assert.match(page, /loadDocuments\(docsState\.items\.length\)/)
  assert.match(page, /\/api\/documents\/\$\{encodeURIComponent\(document\.id\)\}\/download/)
})
