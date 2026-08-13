#!/usr/bin/env node
/** SOL-REF-01…05 — CAS, source, cursor, idempotency and rate limit on PostgreSQL. */

import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";

import { PrismaClient } from "../generated/prisma/client.ts";
import {
  createPracticeReflectionForUser,
  getPracticeReflectionForUser,
  listPracticeReflectionsForUser,
  updatePracticeReflectionForUser
} from "../lib/reflection/records.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const fallbackUrl = "postgresql://sotsiaal_user:sotsiaalai@localhost:5432/sotsiaal_ai?schema=public";
const parsed = new URL(String(process.env.DATABASE_URL || fallbackUrl).trim());
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) {
  throw new Error(`REF sond loob ajutise andmebaasi ainult localhostil (host=${parsed.hostname})`);
}
const databaseName = `sotsiaal_ai_reflection_probe_${Date.now()}`;
if (!/^sotsiaal_ai_reflection_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline ajutise andmebaasi nimi");
const adminUrl = new URL(parsed); adminUrl.pathname = "/postgres"; adminUrl.search = "";
const probeUrl = new URL(parsed); probeUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));

function client() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }), log: [] });
}

const db = client();
const contender = client();
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

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  migrate();
  const [owner, foreign] = await Promise.all([
    db.user.create({ data: { email: "reflection-owner@example.test", role: "SOCIAL_WORKER" } }),
    db.user.create({ data: { email: "reflection-foreign@example.test", role: "SOCIAL_WORKER" } })
  ]);

  const base = await createPracticeReflectionForUser(owner.id, { method: "Algne" }, {
    prisma: db, idempotencyKey: "cas-initial-request", rateLimit: false
  });
  const expectedUpdatedAt = base.reflection.updatedAt;
  const race = await Promise.allSettled([
    updatePracticeReflectionForUser(owner.id, base.reflection.id, { method: "Esimene", expectedUpdatedAt }, { prisma: db }),
    updatePracticeReflectionForUser(owner.id, base.reflection.id, { method: "Teine", expectedUpdatedAt }, { prisma: contender })
  ]);
  const winner = race.filter((result) => result.status === "fulfilled");
  const stale = race.filter((result) => result.status === "rejected" && result.reason?.status === 409);
  check("REF-01 kahe ühenduse CAS annab täpselt ühe võitja ja ühe 409", winner.length === 1 && stale.length === 1);
  check("REF-01 409 kannab serveri praegust teksti, kuid mitte kordusvõtit", Boolean(stale[0]?.reason?.details?.current?.method) && !("idempotencyKey" in stale[0].reason.details.current));

  const source = await db.preInquiry.create({ data: {
    recipientOwnerId: owner.id,
    recipientType: "KOV_CONTACT",
    situation: "Probe source"
  } });
  const linked = await createPracticeReflectionForUser(owner.id, {
    method: "Allikaga", sourceKind: "PRE_INQUIRY", sourceId: source.id
  }, { prisma: db, idempotencyKey: "owned-source-request", rateLimit: false });
  const foreignError = await createPracticeReflectionForUser(foreign.id, {
    method: "Võõras", sourceKind: "PRE_INQUIRY", sourceId: source.id
  }, { prisma: db, idempotencyKey: "foreign-source-request", rateLimit: false }).then(() => null, (error) => error);
  const missingError = await createPracticeReflectionForUser(owner.id, {
    method: "Puuduv", sourceKind: "PRE_INQUIRY", sourceId: "missing-source"
  }, { prisma: db, idempotencyKey: "missing-source-request", rateLimit: false }).then(() => null, (error) => error);
  check("REF-02 võõras ja puuduv allikas annavad sama üldise 404", foreignError?.status === 404 && missingError?.status === 404 && foreignError.message === missingError.message);
  await db.preInquiry.delete({ where: { id: source.id } });
  check("REF-02 allika hilisem kustutus jätab refleksiooni alles ja märgib allika kustutatuks",
    (await getPracticeReflectionForUser(owner.id, linked.reflection.id, { prisma: db }))?.sourceState === "deleted");

  const sameCreatedAt = new Date("2026-08-14T03:00:00.000Z");
  await db.practiceReflection.createMany({ data: Array.from({ length: 51 }, (_, index) => ({
    id: `cursor_${String(index).padStart(3, "0")}`,
    ownerUserId: owner.id,
    method: `Cursor ${index}`,
    createdAt: sameCreatedAt,
    updatedAt: sameCreatedAt
  })) });
  const seen = [];
  let cursor = null;
  do {
    const page = await listPracticeReflectionsForUser(owner.id, { take: 17, cursor }, { prisma: db });
    seen.push(...page.items);
    cursor = page.page.nextCursor;
  } while (cursor);
  check("REF-04 51+ ja sama ajatempliga read läbivad stabiilse kursori täpselt üks kord",
    seen.length === 53 && new Set(seen.map((row) => row.id)).size === 53);
  check("REF-04 loendiprojektsioon ei lae detailteksti ega sisemisi kordusvõtmeid",
    seen.every((row) => Object.keys(row).sort().join(",") === "approach,createdAt,id,interimOutcome,method"));

  const replayKey = "parallel-create-request";
  const parallel = await Promise.all([
    createPracticeReflectionForUser(owner.id, { method: "Üks kord" }, { prisma: db, idempotencyKey: replayKey, rateLimit: false }),
    createPracticeReflectionForUser(owner.id, { method: "Üks kord" }, { prisma: contender, idempotencyKey: replayKey, rateLimit: false })
  ]);
  check("REF-05 paralleelne sama võtmega POST loob ühe rea ja tagastab sama id",
    parallel[0].reflection.id === parallel[1].reflection.id
    && await db.practiceReflection.count({ where: { ownerUserId: owner.id, idempotencyKey: replayKey } }) === 1);
  const changedReplay = await createPracticeReflectionForUser(owner.id, { method: "Teine sisu" }, {
    prisma: db, idempotencyKey: replayKey, rateLimit: false
  }).then(() => null, (error) => error);
  check("REF-05 sama võti teise sisuga annab 409", changedReplay?.status === 409);
  const whitespaceError = await createPracticeReflectionForUser(owner.id, { method: "   " }, {
    prisma: db, idempotencyKey: "whitespace-request", rateLimit: false
  }).then(() => null, (error) => error);
  check("REF-05 ainult tühikuid sisaldav kirje lükatakse tagasi", whitespaceError?.status === 400);

  let rateError = null;
  for (let index = 0; index < 21; index += 1) {
    try {
      await createPracticeReflectionForUser(foreign.id, { method: `Piir ${index}` }, {
        prisma: db, idempotencyKey: `rate-request-${String(index).padStart(2, "0")}`,
        now: new Date("2026-08-14T04:00:00.000Z")
      });
    } catch (error) {
      rateError = error;
    }
  }
  const [bucket] = await db.$queryRawUnsafe(`SELECT "count" FROM "PracticeReflectionRateLimitBucket"`);
  check("REF-05 kasutaja+operatsiooni püsiv piir peatab 21. loomise", rateError?.status === 429);
  check("REF-05 piirangu tagasilükatud tehing ei jäta loendurit ega kirjet poolikuks",
    Number(bucket?.count) === 20 && await db.practiceReflection.count({ where: { ownerUserId: foreign.id } }) === 20);

  console.log(`PROBE_OK ${passed}/${passed}`);
} finally {
  await Promise.all([db.$disconnect().catch(() => null), contender.$disconnect().catch(() => null)]);
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]).catch(() => null);
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null);
  await admin.end().catch(() => null);
  console.log("CLEANUP_OK temporary_database_removed");
}
