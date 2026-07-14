import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  join(root, "prisma/migrations/20260714143000_covision_completed_cases/migration.sql"),
  "utf8"
);
const decisionMigration = readFileSync(
  join(root, "prisma/migrations/20260714183000_covision_closure_decision_note/migration.sql"),
  "utf8"
);
const closedByMigration = readFileSync(
  join(
    root,
    "prisma/migrations/20260714190000_covision_closure_closed_by_set_null/migration.sql"
  ),
  "utf8"
);

function model(name) {
  return schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`))?.[0] || "";
}

test("completed cases persist a minimal closure, follow-up and owner-only package separately", () => {
  for (const name of ["CovisionClosure", "CovisionFollowUp", "CovisionOwnerPackage"]) {
    assert.match(schema, new RegExp(`model ${name} \\{`));
    assert.match(migration, new RegExp(`CREATE TABLE "${name}"`));
  }
  const closure = model("CovisionClosure");
  assert.match(closure, /covisionCaseId\s+String\s+@unique/);
  assert.match(closure, /version\s+Int\s+@default\(0\)/);
  assert.match(closure, /decisionNote\s+String\?\s+@db\.Text/);
  assert.match(decisionMigration, /ADD COLUMN "decisionNote" TEXT/);
  assert.doesNotMatch(closure, /message|transcript|rawContent|anonymizedDescription/i);
  assert.match(model("CovisionOwnerPackage"), /closureId\s+String\s+@unique/);
});

test("lifecycle, follow-up, practice, package and retention are independent axes", () => {
  for (const name of [
    "CovisionClosureLifecycleStatus",
    "CovisionFollowUpStatus",
    "CovisionPracticeCandidateStatus",
    "CovisionPackageStatus",
    "CovisionRetentionStatus"
  ]) {
    assert.match(schema, new RegExp(`enum ${name} \\{`));
    assert.match(migration, new RegExp(`CREATE TYPE "${name}"`));
  }
  const closure = model("CovisionClosure");
  assert.match(closure, /lifecycleStatus\s+CovisionClosureLifecycleStatus/);
  assert.match(closure, /practiceStatus\s+CovisionPracticeCandidateStatus/);
  assert.match(closure, /packageStatus\s+CovisionPackageStatus/);
  assert.match(closure, /retentionStatus\s+CovisionRetentionStatus/);
  assert.doesNotMatch(closure, /attentionStatus/);
});

test("migration is forward-only and protects one closure per Kovisioon case", () => {
  assert.match(migration, /CovisionClosure_covisionCaseId_key/);
  assert.match(migration, /CovisionClosure_covisionCaseId_fkey/);
  assert.match(migration, /ON DELETE CASCADE/);
  assert.match(migration, /ON DELETE SET NULL/);
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(migration, /\bDROP\s+(TABLE|COLUMN|TYPE)\b/i);
});

test("deleting a historical closer account cannot block closure retention", () => {
  const closure = model("CovisionClosure");
  assert.match(closure, /closedById\s+String\?/);
  assert.match(closure, /closedBy\s+User\?[\s\S]*onDelete:\s*SetNull/);
  assert.match(closedByMigration, /ALTER COLUMN "closedById" DROP NOT NULL/);
  assert.match(
    closedByMigration,
    /FOREIGN KEY \("closedById"\) REFERENCES "User"\("id"\) ON DELETE SET NULL/
  );
  assert.doesNotMatch(closedByMigration, /DELETE FROM|DROP TABLE|DROP COLUMN/i);
});
