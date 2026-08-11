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
  // SOL-MEET-01 andis settle-kutsele neljanda argumendi (süstitav teenus), mistõttu vana
  // sõna-sõnaline kuju ei kehti. Kontrolli EI lõdvendatud: nüüd on nõutud, et `workCompleted`
  // märge ja tema etapi commit oleksid KÕRVUTI — seda vana regexp ei nõudnud ja seega ei
  // takistanud ta märke ja arvelduse lahku triivimist.
  assert.match(jobs, /job\.usage\.stt\.workCompleted = true;\s*\r?\n\s*await settleMeetingSummaryUsage\(job, "stt", "commit"[,)]/);
  assert.match(jobs, /job\.usage\.document\.workCompleted = true;\s*\r?\n\s*await settleMeetingSummaryUsage\(job, "document", "commit"[,)]/);
  assert.match(jobs, /releaseIncompleteMeetingSummaryUsage/);

  // Süstitava teenuse VAIKEVÄÄRTUS peab olema päris arveldus, muidu saaks testiõmblus
  // arvelduse vaikselt välja lülitada.
  assert.match(jobs, /usage = usageService/);
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
