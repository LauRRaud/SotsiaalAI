import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// A6.1 §9.2 — schema/migration CONTRACT (the clean chain itself is verified by
// `npm run db:migrate:check`; these pin the model shape so a refactor can't drop
// ownership cascade, the DRAFT default, or the owner index).

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
const migration = readFileSync(join(root, "prisma/migrations/20260714040000_topic_seed/migration.sql"), "utf8");
const lifecycleMigration = readFileSync(
  join(root, "prisma/migrations/20260814006000_topic_seed_lifecycle_integrity/migration.sql"),
  "utf8"
);

test("schema: TopicSeedStatus keeps A6.1 states and adds the Kovisioon lifecycle", () => {
  const match = schema.match(/enum TopicSeedStatus \{([^}]*)\}/);
  assert.ok(match, "TopicSeedStatus enum missing");
  const values = match[1].split(/\s+/).filter(Boolean);
  assert.deepEqual(values.sort(), ["CLOSED", "DRAFT", "FOLLOW_UP", "IN_COVISION", "WAITING"]);
});

test("schema: TopicSeed is a separate owner-cascaded model with the required fields", () => {
  const match = schema.match(/model TopicSeed \{[\s\S]*?\n\}/);
  assert.ok(match, "TopicSeed model missing");
  const model = match[0];
  for (const field of [
    "ownerId", "title", "contextType", "caseType", "whyNow",
    "requestedSupport", "importance", "safetyGate", "sharedCardSnapshot",
    "ownerConfirmedAt", "sharedAt", "version", "privacyAssessment", "privacyReviewedAt"
  ]) {
    assert.match(model, new RegExp(`\\b${field}\\b`), `field ${field} missing`);
  }
  assert.match(model, /status\s+TopicSeedStatus\s+@default\(DRAFT\)/);
  assert.match(model, /requestedSupport\s+String\[\]\s+@default\(\[\]\)/);
  assert.match(model, /version\s+Int\s+@default\(1\)/);
  assert.match(model, /onDelete:\s*Cascade/);
  assert.match(model, /@@index\(\[ownerId, updatedAt\]\)/);
});

test("lifecycle migration adds integer CAS, privacy evidence and cursor indexes", () => {
  assert.match(lifecycleMigration, /ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1/);
  assert.match(lifecycleMigration, /ADD COLUMN "privacyAssessment" JSONB/);
  assert.match(lifecycleMigration, /TopicSeed_ownerId_updatedAt_id_idx/);
  assert.match(lifecycleMigration, /TopicSeed_ownerId_status_updatedAt_id_idx/);
});

test("schema: User back-relation to TopicSeed exists", () => {
  assert.match(schema, /topicSeeds\s+TopicSeed\[\]\s+@relation\("TopicSeedOwner"\)/);
});

test("migration: creates the enum, table, owner index and ON DELETE CASCADE FK", () => {
  assert.match(migration, /CREATE TYPE "TopicSeedStatus" AS ENUM \('DRAFT', 'WAITING'\)/);
  assert.match(migration, /CREATE TABLE "TopicSeed"/);
  assert.match(migration, /CREATE INDEX "TopicSeed_ownerId_updatedAt_idx"/);
  assert.match(migration, /"requestedSupport" TEXT\[\] NOT NULL DEFAULT ARRAY\[\]::TEXT\[\]/);
  assert.match(migration, /"TopicSeed_ownerId_fkey".*REFERENCES "User".*ON DELETE CASCADE/s);
  // Forward-compatible: only creates new objects, never alters existing tables.
  assert.doesNotMatch(migration, /ALTER TABLE "(User|CovisionCase|PreInquiry)"/);
});
