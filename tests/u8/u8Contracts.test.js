import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("ET, EN and RU provide identical source trust and AI draft keys", () => {
  const dictionaries = ["et", "en", "ru"].map(locale => JSON.parse(fs.readFileSync(`messages/${locale}.json`, "utf8")));
  for (const dict of dictionaries) {
    assert.equal(typeof dict.chat.sources.report_action, "string");
    assert.equal(typeof dict.chat.sources.checked_unknown, "string");
    assert.equal(typeof dict.content_trust.ai_draft, "string");
    assert.equal(typeof dict.content_trust.human_confirmed, "string");
  }
});

test("source report UI has semantic status and bounded fields", () => {
  const source = fs.readFileSync("components/alalehed/chat/ChatSourcesPanel.jsx", "utf8");
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /maxLength=\{500\}/);
  assert.match(source, /messageId: source\.messageId/);
  assert.doesNotMatch(source, /conversation:\s|prompt:\s|answerText:/);
});

test("migration is additive and source feedback has owner, status and audit fields", () => {
  const migration = fs.readFileSync("prisma/migrations/20260714223000_source_feedback_trust_layer/migration.sql", "utf8");
  assert.match(migration, /CREATE TABLE "SourceFeedback"/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|ALTER COLUMN/);
  const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
  assert.match(schema, /model SourceFeedback \{/);
  assert.match(schema, /dedupeKey\s+String\s+@unique/);
  assert.match(schema, /resolvedById\s+String\?/);
});
