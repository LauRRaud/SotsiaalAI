import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../lib/admin/rag/kov/service.js", import.meta.url),
  "utf8"
);

test("KOV web ingest stores contact fields in RAG chunk metadata for service-map sync", () => {
  assert.match(source, /contact_phone:\s*item\.phone/);
  assert.match(source, /contact_email:\s*item\.email/);
  assert.match(source, /contact_address:\s*item\.address/);
  assert.match(source, /contact_role:\s*item\.role/);
  assert.match(source, /contact_department:\s*item\.department/);
});
