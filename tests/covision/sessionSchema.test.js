import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  join(root, "prisma/migrations/20260714120000_covision_session_core/migration.sql"),
  "utf8"
);

test("TopicSeed links one-to-one to a CovisionCase and has lifecycle states", () => {
  const topicStatus = schema.match(/enum TopicSeedStatus \{([^}]*)\}/)?.[1] || "";
  for (const status of ["DRAFT", "WAITING", "IN_COVISION", "FOLLOW_UP", "CLOSED"]) {
    assert.match(topicStatus, new RegExp(`\\b${status}\\b`));
  }
  const topicSeed = schema.match(/model TopicSeed \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(topicSeed, /covisionCaseId\s+String\?\s+@unique/);
  assert.match(topicSeed, /@relation\("TopicSeedCovisionCase"[\s\S]*onDelete:\s*SetNull\)/);
  const covisionCase = schema.match(/model CovisionCase \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(covisionCase, /sourceTopicSeed\s+TopicSeed\?\s+@relation\("TopicSeedCovisionCase"\)/);
});

test("schema separates session, participants, shared work, private state and immutable snapshots", () => {
  for (const model of [
    "CovisionSessionState",
    "CovisionParticipantState",
    "CovisionWorkItem",
    "CovisionPrivateState",
    "CovisionStageSnapshot"
  ]) {
    assert.match(schema, new RegExp(`model ${model} \\{`), `${model} missing`);
    assert.match(migration, new RegExp(`CREATE TABLE "${model}"`), `${model} migration missing`);
  }
  assert.match(schema, /covisionCaseId\s+String\s+@unique/);
  assert.match(schema, /version\s+Int\s+@default\(0\)/);
  assert.match(schema, /@@unique\(\[sessionId, userId, stage, kind\]\)/);
  assert.match(schema, /@@unique\(\[sessionId, stage\]\)/);
  assert.match(migration, /TopicSeed_covisionCaseId_key/);
  assert.match(migration, /ON DELETE CASCADE/);
  assert.match(migration, /ON DELETE SET NULL/);
});

test("private state has its own user-scoped relation and shared work has no user-private column", () => {
  const privateModel = schema.match(/model CovisionPrivateState \{[\s\S]*?\n\}/)?.[0] || "";
  const workModel = schema.match(/model CovisionWorkItem \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(privateModel, /userId\s+String/);
  assert.match(privateModel, /CovisionPrivateStateUser/);
  assert.match(workModel, /visibility\s+String\s+@default\("shared"\)/);
  assert.doesNotMatch(workModel, /privateState|privateContent|userId/);
});

test("migration is forward-only and does not mutate or delete existing case data", () => {
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(migration, /\bDROP\s+(TABLE|COLUMN|TYPE)\b/i);
  assert.doesNotMatch(migration, /ALTER TABLE "CovisionCase"/);
});
