import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../rag-service/main.py", import.meta.url), "utf8");

test("RAG service exposes document chunks for structured service-map sync", () => {
  assert.match(source, /@app\.get\("\/documents\/\{doc_id\}\/chunks"/);
  assert.match(source, /include=\["documents",\s*"metadatas"\]/);
  assert.match(source, /item_type/);
  assert.match(source, /source_type/);
});
