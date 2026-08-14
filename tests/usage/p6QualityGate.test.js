import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P6 quality gate checks migrations, tests, lint, translations, build and smoke", async () => {
  const [workflow, smoke, migrationCheck, retention] = await Promise.all([
    readFile(new URL("../../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
    readFile(new URL("../../scripts/ci-smoke.mjs", import.meta.url), "utf8"),
    readFile(new URL("../../scripts/check-clean-migrations.mjs", import.meta.url), "utf8"),
    readFile(new URL("../../lib/retention.js", import.meta.url), "utf8")
  ]);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /prisma migrate deploy/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npm run i18n:check/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /npm run ci:smoke/);
  const actionRefs = [...workflow.matchAll(/uses:\s*[^@\s]+@([^\s#]+)/gu)].map((match) => match[1]);
  assert.ok(actionRefs.length >= 4, "mõlema job'i checkout ja setup-node peavad olema nähtavad");
  assert.ok(
    actionRefs.every((ref) => /^[a-f0-9]{40}$/u.test(ref)),
    "kõik GitHub Actions viited peavad olema täis commit-SHA-d"
  );
  assert.match(
    workflow,
    /image:\s*postgres:16@sha256:[a-f0-9]{64}/u,
    "PostgreSQL teenuse image peab olema muutumatu digestiga"
  );
  assert.match(smoke, /Alusta tasuta/);
  assert.match(smoke, /api\/admin\/usage\/deletion-jobs/);
  assert.match(migrationCheck, /sotsiaal_ai_migration_probe_/);
  assert.match(migrationCheck, /DROP DATABASE IF EXISTS/);
  assert.match(retention, /deleteDocumentRagReference/);
  assert.match(retention, /deleteTrackedStorageFile/);
});
