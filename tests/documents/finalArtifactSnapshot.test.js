import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8")

test("approval freezes provenance and rendered bytes in one transaction", async () => {
  const schema = await read("prisma/schema.prisma")
  const approve = await read("app/api/documents/artifacts/[id]/approve/route.js")
  const finalization = await read("lib/documents/artifactFinalization.js")

  assert.match(schema, /model AgentArtifactFinalSnapshot/)
  assert.match(schema, /artifactId\s+String\s+@unique/)
  assert.match(schema, /manifest\s+Json/)
  assert.match(schema, /docxBytes\s+Bytes/)
  assert.match(schema, /pdfBytes\s+Bytes\?/)
  assert.match(approve, /finalizeArtifact/)
  assert.match(finalization, /contentSha256/)
  assert.match(finalization, /evidenceChunks/)
  assert.match(finalization, /templateSha256/)
})

test("FINAL downloads read frozen bytes and never live source or template rows", async () => {
  const download = await read("app/api/documents/artifacts/[id]/download/route.js")
  assert.match(download, /readFinalArtifactDownload/)
  assert.doesNotMatch(download, /readStoredDocument\(artifact\.template\.storagePath\)/)
  assert.doesNotMatch(download, /artifact\.sourceDocuments/)
})

test("generation and refinement retain model, prompt and exact evidence chunks", async () => {
  const generation = await read("lib/documents/generation.js")
  const persistence = await read("lib/documents/persistDraft.js")
  const refinement = await read("lib/documents/artifactRefinements.js")

  assert.match(generation, /prompt_version/)
  assert.match(generation, /evidence_chunks/)
  assert.match(persistence, /metadata:\s*buildArtifactGenerationMetadata/)
  assert.match(refinement, /debugMeta/)
})
