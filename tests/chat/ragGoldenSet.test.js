import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { isKnownRagSourceType } from "../../lib/rag/sourceMetadata.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.resolve(__dirname, "../fixtures/rag-golden-set.json");
const NON_SOURCE_TYPE_MARKERS = new Set(["retrieved_but_unused", "wrong_language"]);

function readGoldenSet() {
  return JSON.parse(readFileSync(fixturePath, "utf8"));
}

test("RAG golden set has the V1 minimum coverage and schema", () => {
  const cases = readGoldenSet();
  assert.equal(Array.isArray(cases), true);
  assert.equal(cases.length, 20);

  const ids = new Set();
  const requiredRoles = new Set();
  const expectedTypes = new Set();
  const forbiddenTypes = new Set();

  for (const item of cases) {
    assert.equal(typeof item.id, "string");
    assert.equal(item.id.length > 0, true);
    assert.equal(ids.has(item.id), false, `duplicate golden case id: ${item.id}`);
    ids.add(item.id);

    assert.equal(typeof item.question, "string", item.id);
    assert.equal(item.question.trim().length > 0, true, item.id);
    assert.equal(["CLIENT", "SOCIAL_WORKER"].includes(item.role), true, item.id);
    assert.equal(typeof item.language, "string", item.id);
    assert.equal(item.language.length > 0, true, item.id);
    assert.equal(Array.isArray(item.expected_source_types), true, item.id);
    assert.equal(item.expected_source_types.length > 0, true, item.id);
    assert.equal(Array.isArray(item.forbidden_source_types), true, item.id);
    assert.equal(Array.isArray(item.must_mention), true, item.id);
    assert.equal(Array.isArray(item.must_not_claim), true, item.id);

    requiredRoles.add(item.role);
    item.expected_source_types.forEach(type => {
      assert.equal(isKnownRagSourceType(type), true, `${item.id}: unknown expected source type ${type}`);
      expectedTypes.add(type);
    });
    item.forbidden_source_types.forEach(type => {
      if (!NON_SOURCE_TYPE_MARKERS.has(type)) {
        assert.equal(isKnownRagSourceType(type), true, `${item.id}: unknown forbidden source type ${type}`);
      }
      forbiddenTypes.add(type);
    });
  }

  assert.equal(requiredRoles.has("CLIENT"), true);
  assert.equal(requiredRoles.has("SOCIAL_WORKER"), true);
  assert.equal(expectedTypes.has("kov_service_info"), true);
  assert.equal(expectedTypes.has("application_form"), true);
  assert.equal(expectedTypes.has("official_contact"), true);
  assert.equal(expectedTypes.has("national_law"), true);
  assert.equal(expectedTypes.has("journal_article"), true);
  assert.equal(forbiddenTypes.has("journal_article"), true);
  assert.equal(forbiddenTypes.has("retrieved_but_unused"), true);
});
