#!/usr/bin/env node
/** SOL-REF-06…09 — export, retention, undo and database lifecycle on PostgreSQL. */

import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";

import { PrismaClient } from "../generated/prisma/client.ts";
import { DATA_EXPORT_REGISTRY } from "../lib/dataExport/registry.js";
import {
  createPracticeReflectionForUser,
  deletePracticeReflectionForUser,
  getPracticeReflectionForUser,
  undoPracticeReflectionDeletionForUser
} from "../lib/reflection/records.js";
import { runPracticeReflectionRetention } from "../lib/reflection/retention.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const fallbackUrl = "postgresql://sotsiaal_user:sotsiaalai@localhost:5432/sotsiaal_ai?schema=public";
const parsed = new URL(String(process.env.DATABASE_URL || fallbackUrl).trim());
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) {
  throw new Error(`REF peatükisond loob ajutise andmebaasi ainult localhostil (host=${parsed.hostname})`);
}
const databaseName = `sotsiaal_ai_reflection_close_probe_${Date.now()}`;
if (!/^sotsiaal_ai_reflection_close_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline ajutise andmebaasi nimi");
const adminUrl = new URL(parsed); adminUrl.pathname = "/postgres"; adminUrl.search = "";
const probeUrl = new URL(parsed); probeUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }), log: [] });

let passed = 0;
function check(label, condition) {
  if (!condition) throw new Error(`PROBE_FAIL ${label}`);
  passed += 1;
  console.log(`  PASS  ${label}`);
}
function migrate() {
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: probeUrl.toString() }, stdio: "pipe", shell: false
  });
  if (result.status !== 0) throw new Error(`prisma migrate deploy failed (${result.status})\n${result.stderr}`);
}
async function createReflection(ownerUserId, key, method, retentionDeadline) {
  return createPracticeReflectionForUser(ownerUserId, { method }, {
    prisma: db,
    idempotencyKey: key,
    rateLimit: false,
    retentionDeadline
  });
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  migrate();
  const now = new Date("2026-08-14T10:00:00.000Z");
  const [owner, foreign] = await Promise.all([
    db.user.create({ data: { email: "reflection-close-owner@example.test", role: "SOCIAL_WORKER" } }),
    db.user.create({ data: { email: "reflection-close-foreign@example.test", role: "SOCIAL_WORKER" } })
  ]);

  const recoverable = await createReflection(owner.id, "recoverable-delete", "Taastatav sisu", null);
  const foreignDelete = await deletePracticeReflectionForUser(foreign.id, recoverable.reflection.id, { prisma: db, now });
  const firstDelete = await deletePracticeReflectionForUser(owner.id, recoverable.reflection.id, { prisma: db, now });
  const replayDelete = await deletePracticeReflectionForUser(owner.id, recoverable.reflection.id, {
    prisma: db, now: new Date(now.getTime() + 1_000)
  });
  check("REF-08 võõras id ei kustuta; omaniku topeltkinnitus on replay-safe",
    !foreignDelete.deleted && firstDelete.deleted && replayDelete.deleted && replayDelete.replayed);
  check("REF-08 pehme kustutus peidab detaili, kuid rida on taastamisaknas andmebaasis",
    await getPracticeReflectionForUser(owner.id, recoverable.reflection.id, { prisma: db }) === null
      && await db.practiceReflection.count({ where: { id: recoverable.reflection.id } }) === 1);
  const foreignUndo = await undoPracticeReflectionDeletionForUser(foreign.id, recoverable.reflection.id, {
    prisma: db, now: new Date(now.getTime() + 2_000)
  });
  const ownerUndo = await undoPracticeReflectionDeletionForUser(owner.id, recoverable.reflection.id, {
    prisma: db, now: new Date(now.getTime() + 2_000)
  });
  check("REF-08 taastamine on ainult omanikule ja ainult enne tähtaega",
    !foreignUndo.restored && ownerUndo.restored
      && (await getPracticeReflectionForUser(owner.id, recoverable.reflection.id, { prisma: db }))?.method === "Taastatav sisu");

  const expiredUndo = await createReflection(owner.id, "expired-undo", "Aegunud taastamine", null);
  await deletePracticeReflectionForUser(owner.id, expiredUndo.reflection.id, { prisma: db, now });
  check("REF-08 aegunud taastamine ebaõnnestub üldiselt",
    !(await undoPracticeReflectionDeletionForUser(owner.id, expiredUndo.reflection.id, {
      prisma: db, now: new Date(now.getTime() + 31_000)
    })).restored);

  await createReflection(foreign.id, "foreign-export", "Võõras eksport", null);
  const exportSurface = DATA_EXPORT_REGISTRY.find((entry) => entry.name === "practice_reflections");
  const exportFiles = await exportSurface.collect({ db, userId: owner.id });
  const exportText = exportFiles[0].content.toString("utf8");
  check("REF-06 koopia sisaldab omaniku aktiivset ja taastatavat kirjet, mitte võõrast ega sisemisi võtmeid",
    exportText.includes("Taastatav sisu") && exportText.includes("Aegunud taastamine")
      && !exportText.includes("Võõras eksport") && !exportText.includes("recoverable-delete")
      && !exportText.includes("requestHash"));

  const past = new Date(now.getTime() - 60_000);
  const future = new Date(now.getTime() + 86_400_000);
  const renewedUntil = new Date(now.getTime() + 10 * 86_400_000);
  const planDefinition = await db.planDefinition.create({ data: {
    key: "reflection_probe",
    name: "Reflection probe",
    role: "SOCIAL_WORKER",
    price: "0.00"
  } });
  const due = await createReflection(owner.id, "retention-due", "Tähtaeg möödas", past);
  const notDue = await createReflection(owner.id, "retention-future", "Tähtaeg ees", future);
  const renewed = await createReflection(owner.id, "retention-renewed", "Pikendatud leping", past);
  await db.subscription.create({ data: {
    userId: owner.id,
    status: "ACTIVE",
    plan: planDefinition.key,
    planDefinitionId: planDefinition.id,
    validUntil: renewedUntil
  } });

  // The renewed owner applies to every due owner row, so use a separate owner
  // for the row that must be purged at the contract boundary.
  const dueOwner = await db.user.create({ data: { email: "reflection-close-due@example.test", role: "SOCIAL_WORKER" } });
  const dueWithoutRenewal = await createReflection(dueOwner.id, "retention-purge", "Leping lõppenud", past);
  const cancelledOwner = await db.user.create({ data: { email: "reflection-close-cancelled@example.test", role: "SOCIAL_WORKER" } });
  const openEndedSubscription = await db.subscription.create({ data: {
    userId: cancelledOwner.id,
    status: "ACTIVE",
    plan: planDefinition.key,
    planDefinitionId: planDefinition.id,
    validUntil: null
  } });
  const nullDeadline = await createReflection(cancelledOwner.id, "retention-null", "Tühistatud tähtajatu leping", null);
  await db.subscription.delete({ where: { id: openEndedSubscription.id } });
  const retentionNow = new Date(now.getTime() + 31_000);
  const firstRun = await runPracticeReflectionRetention({ prisma: db, now: retentionNow });
  const renewedRow = await db.practiceReflection.findUnique({ where: { id: renewed.reflection.id } });
  check("REF-07 worker jätab tähtaja-eelse rea alles ja eemaldab möödunud lepingu rea",
    await db.practiceReflection.count({ where: { id: notDue.reflection.id } }) === 1
      && await db.practiceReflection.count({ where: { id: dueWithoutRenewal.reflection.id } }) === 0);
  check("REF-07 worker kontrollib tähtajatu lepingu NULL-tähtaja pärast tühistamist uuesti",
    await db.practiceReflection.count({ where: { id: nullDeadline.reflection.id } }) === 0);
  check("REF-07 kehtiv pikendus nihutab kõigi omaniku aegunud kirjete tähtaega",
    firstRun.deferred >= 2 && renewedRow?.retentionDeadline?.getTime() === renewedUntil.getTime()
      && await db.practiceReflection.count({ where: { id: due.reflection.id } }) === 1);
  check("REF-07 aegunud kasutajakustutus puhastatakse ja run on jälgitav",
    await db.practiceReflection.count({ where: { id: expiredUndo.reflection.id } }) === 0
      && (await db.practiceReflectionRetentionRun.findUnique({ where: { id: firstRun.runId } }))?.ok === true);

  const retryOwner = await db.user.create({ data: { email: "reflection-close-retry@example.test", role: "SOCIAL_WORKER" } });
  const retryRow = await createReflection(retryOwner.id, "retention-retry", "Retry sisu", past);
  await db.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION fail_reflection_probe_delete() RETURNS trigger AS $$
    BEGIN
      IF OLD.id = '${retryRow.reflection.id}' THEN
        RAISE EXCEPTION 'injected retention delete failure';
      END IF;
      RETURN OLD;
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER reflection_probe_delete_failure
      BEFORE DELETE ON "PracticeReflection"
      FOR EACH ROW EXECUTE FUNCTION fail_reflection_probe_delete();
  `);
  const failedRun = await runPracticeReflectionRetention({ prisma: db, now: retentionNow });
  check("REF-07 nurjunud rida jääb alles ja run märgitakse monitooritavalt ebaõnnestunuks",
    !failedRun.ok && failedRun.failed === 1 && failedRun.errorCode
      && await db.practiceReflection.count({ where: { id: retryRow.reflection.id } }) === 1);
  await db.$executeRawUnsafe(`DROP TRIGGER reflection_probe_delete_failure ON "PracticeReflection"; DROP FUNCTION fail_reflection_probe_delete();`);
  const retryRun = await runPracticeReflectionRetention({ prisma: db, now: retentionNow });
  check("REF-07 järgmine idempotentne käik lõpetab varem nurjunud kustutuse",
    retryRun.ok && await db.practiceReflection.count({ where: { id: retryRow.reflection.id } }) === 0);

  const cascadeOwner = await db.user.create({ data: { email: "reflection-close-cascade@example.test", role: "SOCIAL_WORKER" } });
  const cascadeRow = await createReflection(cascadeOwner.id, "account-cascade", "Konto sulgemine", future);
  await db.user.delete({ where: { id: cascadeOwner.id } });
  check("REF-07 konto kustutus eemaldab refleksiooni FK kaskaadiga kohe",
    await db.practiceReflection.count({ where: { id: cascadeRow.reflection.id } }) === 0);

  console.log(`PROBE_OK ${passed}/${passed}`);
} finally {
  await db.$disconnect().catch(() => null);
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]).catch(() => null);
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null);
  await admin.end().catch(() => null);
  console.log("CLEANUP_OK temporary_database_removed");
}
