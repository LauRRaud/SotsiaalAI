import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { classifyMigrationStatements, createdMigrationTables } from "../../lib/prismaMigrationRisk.js";

async function repoFile(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("SOL-PRISMA-01: A4 legacy backfill preserves source meaning before dropping reason", async () => {
  const sql = await repoFile("prisma/migrations/20260805190000_a4_licence_assessment_evidence/migration.sql");

  assert.match(sql, /"entitySourceResult"\s*=\s*CASE[\s\S]*"entityResolved"[\s\S]*'OK'[\s\S]*'UNCONFIRMED'/);
  assert.match(sql, /"result"\s*=\s*CASE[\s\S]*"result"\s*=\s*'OK'[\s\S]*"entityResolved"/);
  assert.match(sql, /"licenceReason"\s*=\s*CASE[\s\S]*"reason"/);
  assert.match(sql, /"entityReason"\s*=\s*CASE[\s\S]*"reason"/);
  assert.ok(
    sql.indexOf('"licenceReason"') < sql.indexOf('DROP COLUMN "reason"'),
    "legacy reason is dropped before it is preserved"
  );
});

test("SOL-PRISMA-02: forward migration repairs HelpMatch actors and validates both constraints", async () => {
  const sql = await repoFile("prisma/migrations/20260813235500_sol_prisma_01_02_integrity/migration.sql");

  assert.match(sql, /UPDATE "HelpMatch"[\s\S]*"HelpRequest"[\s\S]*"requesterId"/);
  assert.match(sql, /UPDATE "HelpMatch"[\s\S]*"HelpOffer"[\s\S]*"offererId"/);
  assert.match(sql, /VALIDATE CONSTRAINT "HelpMatch_requesterId_fkey"/);
  assert.match(sql, /VALIDATE CONSTRAINT "HelpMatch_offererId_fkey"/);
});

test("SOL-PRISMA-03: deploy builds before migration and applies a bounded maintenance gate", async () => {
  const deploy = await repoFile("scripts/deploy-server.mjs");
  const buildAt = deploy.indexOf("npm run build");
  const migrateAt = deploy.indexOf("prisma migrate deploy");

  assert.ok(buildAt >= 0 && migrateAt >= 0 && buildAt < migrateAt, "migration still runs before the build");
  assert.match(deploy, /db:migrate:preflight/);
  assert.match(deploy, /lock_timeout/);
  assert.match(deploy, /statement_timeout/);
  assert.match(deploy, /prisma-migration-state\.mjs compare/);
  assert.match(deploy, /systemctl stop sotsiaalai-frontend\.service[\s\S]*prisma migrate deploy/);
});

function bashPath(value) {
  const normalized = path.resolve(value).replaceAll("\\", "/");
  return normalized.replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`);
}

function bashQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

test("SOL-PRISMA-03: injected build failure restores the old artifact and never migrates", async () => {
  const folder = await mkdtemp(path.join(tmpdir(), "sotsiaalai-deploy-gate-"));
  try {
    const nextDir = path.join(folder, ".next");
    const marker = path.join(nextDir, "marker.txt");
    const logPath = path.join(folder, "probe.log");
    await mkdir(nextDir, { recursive: true });
    await writeFile(marker, "old-artifact", "utf8");
    await writeFile(logPath, "", "utf8");

    const appDir = bashPath(folder);
    const log = bashPath(logPath);
    const rendered = spawnSync(process.execPath, ["scripts/deploy-server.mjs", "--print-script"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, DEPLOY_APP_DIR: appDir, DEPLOY_FRONTEND_ENV: `${appDir}/missing.env` }
    });
    assert.equal(rendered.status, 0, rendered.stderr);

    const harness = `
export DEPLOY_PROBE_LOG=${bashQuote(log)}
export DEPLOY_PROBE_APP_DIR=${bashQuote(appDir)}
git() {
  printf 'git %s\\n' "$*" >> "$DEPLOY_PROBE_LOG"
  if [ "$1" = "branch" ]; then printf 'main\\n'; return 0; fi
  if [ "$1" = "ls-files" ]; then return 0; fi
  if [ "$1" = "rev-parse" ] || [ "$1" = "merge-base" ]; then printf '1111111111111111111111111111111111111111\\n'; return 0; fi
  return 0
}
npm() { printf 'npm %s\\n' "$*" >> "$DEPLOY_PROBE_LOG"; return 0; }
npx() { printf 'MIGRATE_CALLED %s\\n' "$*" >> "$DEPLOY_PROBE_LOG"; return 0; }
systemctl() {
  printf 'systemctl %s\\n' "$*" >> "$DEPLOY_PROBE_LOG"
  if [ "$1" = "list-unit-files" ]; then return 1; fi
  return 0
}
sudo() { "$@"; }
timeout() {
  printf 'new-partial-artifact' > "$DEPLOY_PROBE_APP_DIR/.next/marker.txt"
  printf 'BUILD_FAILED\\n' >> "$DEPLOY_PROBE_LOG"
  return 42
}
${rendered.stdout}
`;
    const result = spawnSync("bash", ["-s"], { input: harness, encoding: "utf8" });
    assert.equal(result.status, 42, result.stderr || result.stdout);

    const calls = await readFile(logPath, "utf8");
    assert.match(calls, /BUILD_FAILED/);
    assert.doesNotMatch(calls, /MIGRATE_CALLED/, "migration ran after a failed build");
    assert.match(calls, /systemctl start sotsiaalai-frontend\.service/);
    assert.equal(await readFile(marker, "utf8"), "old-artifact");
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test("SOL-PRISMA-04: CI and package scripts run the legacy upgrade probe", async () => {
  const [workflow, pkgText] = await Promise.all([
    repoFile(".github/workflows/quality-gate.yml"),
    repoFile("package.json")
  ]);
  const pkg = JSON.parse(pkgText);

  assert.ok(pkg.scripts["db:migrate:upgrade:probe"]);
  assert.ok(pkg.scripts["db:migrate:preflight"]);
  assert.match(workflow, /npm run db:migrate:upgrade:probe/);
});

test("migration preflight measures the relation rather than the quoted public schema", () => {
  const sql = `
    ALTER TABLE "public"."HelpMatch"
      DROP CONSTRAINT "old_fk",
      ADD CONSTRAINT "new_fk" FOREIGN KEY ("requestId") REFERENCES "public"."HelpRequest"("id");
    CREATE INDEX "example_idx" ON "public"."HelpRequest" ("createdAt");
    CREATE TABLE "public"."HelpRateLimitBucket" ("id" TEXT PRIMARY KEY);
  `;

  assert.deepEqual(classifyMigrationStatements(sql), [
    { kind: "add_constraint", table: "HelpMatch", destructive: false },
    { kind: "nonconcurrent_index", table: "HelpRequest", destructive: false }
  ]);
  assert.deepEqual(createdMigrationTables(sql), ["HelpRateLimitBucket"]);
});
