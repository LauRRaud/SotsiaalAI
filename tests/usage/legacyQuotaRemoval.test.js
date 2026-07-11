import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("meeting summary reserves STT and document units and settles each completed stage", () => {
  const route = read("app/api/documents/meeting-summary/jobs/route.js");
  const jobs = read("lib/documents/meetingSummaryJobs.js");

  assert.doesNotMatch(route, /canSpendMonthlyBudget/);
  assert.match(route, /metric: "STT_SECONDS"/);
  assert.match(route, /metric: "DOCUMENT_GENERATE"/);
  assert.match(jobs, /usage\.stt\.workCompleted = true/);
  assert.match(jobs, /settleMeetingSummaryUsage\(job, "stt", "commit"\)/);
  assert.match(jobs, /usage\.document\.workCompleted = true/);
  assert.match(jobs, /settleMeetingSummaryUsage\(job, "document", "commit"\)/);
  assert.match(jobs, /releaseIncompleteMeetingSummaryUsage/);
});

test("admin user analytics reads ledger events and buckets instead of AnalyzeUsage", () => {
  const source = read("app/api/admin/analytics/users/route.js");

  assert.doesNotMatch(source, /prisma\.analyzeUsage/);
  assert.match(source, /prisma\.usageEvent\.groupBy/);
  assert.match(source, /prisma\.usageBucket\.findMany/);
  assert.match(source, /prisma\.userEntitlementOverride\.findMany/);
});

test("legacy AnalyzeUsage data is archived non-destructively", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260711160000_archive_legacy_analyze_usage/migration.sql");

  assert.doesNotMatch(schema, /model AnalyzeUsage\s*\{/);
  assert.match(migration, /RENAME TO "AnalyzeUsageLegacy"/);
  assert.doesNotMatch(migration, /DROP TABLE/i);
});
