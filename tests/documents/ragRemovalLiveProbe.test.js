import assert from "node:assert/strict"
import test from "node:test"

import { assertLocalDocumentRagProbeConfig } from "../../scripts/document-rag-removal-live-safety.mjs"

const localConfig = {
  databaseUrl: "postgresql://probe:secret@127.0.0.1:5432/sotsiaalai_probe",
  ragHost: "127.0.0.1:8765",
  ragServiceKey: "synthetic-loopback-key-32-characters"
}

test("live document RAG probe accepts only explicit loopback dependencies", () => {
  assert.doesNotThrow(() => assertLocalDocumentRagProbeConfig(localConfig))

  assert.throws(
    () => assertLocalDocumentRagProbeConfig({ ...localConfig, databaseUrl: "" }),
    /DATABASE_URL/
  )
  assert.throws(
    () => assertLocalDocumentRagProbeConfig({
      ...localConfig,
      databaseUrl: "postgresql://probe:secret@db.example.invalid:5432/sotsiaalai"
    }),
    /loopback/
  )
  assert.throws(
    () => assertLocalDocumentRagProbeConfig({ ...localConfig, ragHost: "rag.example.invalid:443" }),
    /loopback/
  )
  assert.throws(
    () => assertLocalDocumentRagProbeConfig({ ...localConfig, ragServiceKey: "" }),
    /RAG_SERVICE_API_KEY/
  )
  assert.throws(
    () => assertLocalDocumentRagProbeConfig({ ...localConfig, ragServiceKey: "too-short" }),
    /at least 32 characters/
  )
})
