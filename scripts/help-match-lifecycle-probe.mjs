#!/usr/bin/env node
/** SOL-HELP-05…08 — päris PostgreSQL-i tehingu-, luku- ja cursoritõend. */

import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "../generated/prisma/client.ts";
import {
  createHelpMatchAndRoom,
  decideHelpMatch,
  listIncomingHelpMatches,
  withdrawHelpMatch
} from "../lib/help/matches.js";

const DEFAULT_LOCAL_URL = "postgresql://sotsiaal_user:sotsiaalai@localhost:5432/sotsiaal_ai?schema=public";
const sourceUrl = String(process.env.DATABASE_URL || DEFAULT_LOCAL_URL).trim();
const parsed = new URL(sourceUrl);
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname)) {
  throw new Error(`HELP match sond loob ajutise andmebaasi ainult localhostil (host=${parsed.hostname})`);
}

const databaseName = `sotsiaal_ai_help_match_probe_${Date.now()}`;
if (!/^sotsiaal_ai_help_match_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline ajutise andmebaasi nimi");
const adminUrl = new URL(parsed);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const probeUrl = new URL(parsed);
probeUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }), log: [] });

const lines = [];
let passed = 0;
let failed = 0;
function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    lines.push(`  OK   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed += 1;
    lines.push(`  VIGA ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function runMigrations() {
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: probeUrl.toString() },
    stdio: "pipe",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`prisma migrate deploy kukkus koodiga ${result.status}`);
}

async function installFailureTrigger(table, name) {
  await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION "${name}_fn"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '${name}'; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER "${name}" BEFORE INSERT OR UPDATE ON "${table}" FOR EACH ROW EXECUTE FUNCTION "${name}_fn"()`);
}

async function dropFailureTrigger(table, name) {
  await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${name}" ON "${table}"`);
  await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${name}_fn"()`);
}

let sequence = 0;
async function seedPair(overrides = {}) {
  sequence += 1;
  const suffix = String(sequence).padStart(3, "0");
  const requester = await db.user.create({ data: { email: `help-match-requester-${suffix}@sotsiaalai.test` } });
  const offerer = await db.user.create({ data: { email: `help-match-offerer-${suffix}@sotsiaalai.test` } });
  const category = await db.helpCategory.create({
    data: { code: `PROBE_${suffix}`, labelEt: `Probe ${suffix}`, labelEn: `Probe ${suffix}`, labelRu: `Probe ${suffix}` }
  });
  const expiresAt = overrides.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const request = await db.helpRequest.create({
    data: {
      userId: requester.id,
      primaryCategoryId: category.id,
      title: `Vajan tuge ${suffix}`,
      description: `Privaatne hiv tugi ${suffix}`,
      structuredSummary: `Hiv tugi ${suffix}`,
      status: "OPEN",
      expiresAt
    }
  });
  const offer = await db.helpOffer.create({
    data: {
      userId: offerer.id,
      primaryCategoryId: category.id,
      title: `Pakun tuge ${suffix}`,
      description: `Privaatne hiv tugi ${suffix}`,
      structuredSummary: `Hiv tugi ${suffix}`,
      status: "OPEN",
      expiresAt
    }
  });
  return { requester, offerer, category, request, offer };
}

async function pendingFor(pair) {
  return createHelpMatchAndRoom({
    requestId: pair.request.id,
    offerId: pair.offer.id,
    initiatedByUserId: pair.requester.id
  }, db);
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  runMigrations();

  /* Notification-write failure must roll back the match row itself. */
  const atomicPair = await seedPair();
  await installFailureTrigger("NotificationEvent", "help_match_notification_failure");
  let notificationFailed = false;
  try {
    await pendingFor(atomicPair);
  } catch {
    notificationFailed = true;
  }
  check("notification-write veasüst jõuab kutsujani", notificationFailed);
  check("notification-write viga rollback'ib HelpMatch rea", await db.helpMatch.count({ where: { requestId: atomicPair.request.id } }) === 0);
  check("notification-write viga ei jäta NotificationEvent rida", await db.notificationEvent.count({ where: { userId: atomicPair.offerer.id } }) === 0);
  await dropFailureTrigger("NotificationEvent", "help_match_notification_failure");

  const created = await pendingFor(atomicPair);
  check("edu commit'ib ühe PENDING match'i", created.status === "PENDING" && await db.helpMatch.count({ where: { requestId: atomicPair.request.id } }) === 1);
  check("edu commit'ib samas ühe nõusolekuteavituse", await db.notificationEvent.count({ where: { sourceId: created.id, userId: atomicPair.offerer.id } }) === 1);
  const duplicateWithNotification = await pendingFor(atomicPair);
  check("tavaline kordus tagastab sama match'i veata", duplicateWithNotification.id === created.id && duplicateWithNotification.wasCreated === false);
  check("tavaline kordus ei dubleeri olemasolevat teavitust", await db.notificationEvent.count({ where: { sourceId: created.id } }) === 1);
  await db.notificationEvent.deleteMany({ where: { sourceId: created.id } });
  const retry = await pendingFor(atomicPair);
  check("kordus kasutab sama match'i", retry.id === created.id && retry.wasCreated === false);
  check("kordus taastab puuduva teavituse idempotentselt", await db.notificationEvent.count({ where: { sourceId: created.id } }) === 1);

  /* ACCEPT must wait for the source lock, then observe the committed closure. */
  const lockPair = await seedPair();
  const lockMatch = await pendingFor(lockPair);
  const blocker = new pg.Client({ connectionString: probeUrl.toString() });
  await blocker.connect();
  await blocker.query("BEGIN");
  await blocker.query('SELECT "id" FROM "HelpRequest" WHERE "id" = $1 FOR UPDATE', [lockPair.request.id]);
  await blocker.query('UPDATE "HelpRequest" SET "status" = \'CLOSED\' WHERE "id" = $1', [lockPair.request.id]);
  let acceptSettled = false;
  const acceptPromise = decideHelpMatch({
    matchId: lockMatch.id,
    decidedByUserId: lockPair.offerer.id,
    decision: "ACCEPT"
  }, db).then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error })
  ).finally(() => { acceptSettled = true; });
  await new Promise((resolve) => setTimeout(resolve, 120));
  check("ACCEPT ootab lukustatud allikakuulutust", acceptSettled === false);
  await blocker.query("COMMIT");
  await blocker.end();
  const acceptResult = await acceptPromise;
  const closedMatch = await db.helpMatch.findUnique({ where: { id: lockMatch.id } });
  check(
    "luku järel muutunud alus annab HELP_MATCH_BASIS_CHANGED",
    acceptResult.ok === false && acceptResult.error?.code === "HELP_MATCH_BASIS_CHANGED",
    acceptResult.ok ? "ootamatu edu" : `${acceptResult.error?.code || "no-code"}: ${String(acceptResult.error?.message || "").slice(0, 120)}`
  );
  check("muutunud alus lõpetab PENDING match'i", closedMatch?.status === "CLOSED");
  check("muutunud alus ei loo ruumi", closedMatch?.roomId === null && await db.room.count({ where: { originId: lockMatch.id } }) === 0);

  /* Expired and incompatible variants close in the same way. */
  const expiredPair = await seedPair();
  const expiredMatch = await pendingFor(expiredPair);
  await db.helpOffer.update({ where: { id: expiredPair.offer.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  let expiredCode = "";
  try {
    await decideHelpMatch({ matchId: expiredMatch.id, decidedByUserId: expiredPair.offerer.id, decision: "ACCEPT" }, db);
  } catch (error) {
    expiredCode = error?.code || "";
  }
  check("aegunud alus annab HELP_MATCH_BASIS_CHANGED", expiredCode === "HELP_MATCH_BASIS_CHANGED");
  check("aegunud alus märgitakse CLOSED", (await db.helpMatch.findUnique({ where: { id: expiredMatch.id } }))?.status === "CLOSED");

  const sweepPair = await seedPair();
  const sweepMatch = await pendingFor(sweepPair);
  await db.helpRequest.update({ where: { id: sweepPair.request.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const sweptInbox = await listIncomingHelpMatches(sweepPair.offerer.id, { limit: 25 }, db);
  check("nimekirja päring ei tagasta aegunud PENDING match'i", sweptInbox.items.every((item) => item.id !== sweepMatch.id));
  check("nimekirja päring sulgeb aegunud PENDING match'i", (await db.helpMatch.findUnique({ where: { id: sweepMatch.id } }))?.status === "CLOSED");

  const incompatiblePair = await seedPair();
  const incompatibleMatch = await pendingFor(incompatiblePair);
  const otherCategory = await db.helpCategory.create({
    data: { code: `PROBE_OTHER_${sequence}`, labelEt: "Muu", labelEn: "Other", labelRu: "Другое" }
  });
  await db.helpOffer.update({ where: { id: incompatiblePair.offer.id }, data: { primaryCategoryId: otherCategory.id } });
  let incompatibleCode = "";
  try {
    await decideHelpMatch({ matchId: incompatibleMatch.id, decidedByUserId: incompatiblePair.offerer.id, decision: "ACCEPT" }, db);
  } catch (error) {
    incompatibleCode = error?.code || "";
  }
  check("kokkusobimatu alus annab HELP_MATCH_BASIS_CHANGED", incompatibleCode === "HELP_MATCH_BASIS_CHANGED");
  check("kokkusobimatu alus ei loo ruumi", (await db.helpMatch.findUnique({ where: { id: incompatibleMatch.id } }))?.roomId === null);

  /* Initiator withdrawal is terminal. */
  const withdrawPair = await seedPair();
  const withdrawMatch = await pendingFor(withdrawPair);
  const withdrawn = await withdrawHelpMatch({ matchId: withdrawMatch.id, initiatedByUserId: withdrawPair.requester.id }, db);
  check("algataja WITHDRAW viib match'i CLOSED olekusse", withdrawn.status === "CLOSED");
  let lateDecisionCode = "";
  try {
    await decideHelpMatch({ matchId: withdrawMatch.id, decidedByUserId: withdrawPair.offerer.id, decision: "ACCEPT" }, db);
  } catch (error) {
    lateDecisionCode = error?.code || "";
  }
  check("tagasivõetud match'i hiline ACCEPT ei õnnestu", lateDecisionCode === "HELP_MATCH_NOT_PENDING");

  /* 27 valid rows must be reachable through the stable compound cursor. */
  const pageRecipient = await db.user.create({ data: { email: `help-match-page-recipient-${Date.now()}@sotsiaalai.test` } });
  const pageInitiator = await db.user.create({ data: { email: `help-match-page-initiator-${Date.now()}@sotsiaalai.test` } });
  const pageCategory = await db.helpCategory.create({ data: { code: "PROBE_PAGE", labelEt: "Leht", labelEn: "Page", labelRu: "Страница" } });
  const pageOffer = await db.helpOffer.create({
    data: { userId: pageRecipient.id, primaryCategoryId: pageCategory.id, description: "Lehitav pakkumine", status: "OPEN", expiresAt: new Date(Date.now() + 86_400_000) }
  });
  for (let index = 0; index < 27; index += 1) {
    const request = await db.helpRequest.create({
      data: { userId: pageInitiator.id, primaryCategoryId: pageCategory.id, description: `Lehitav soov ${index}`, status: "OPEN", expiresAt: new Date(Date.now() + 86_400_000) }
    });
    await db.helpMatch.create({
      data: {
        requestId: request.id,
        offerId: pageOffer.id,
        requesterId: pageInitiator.id,
        offererId: pageRecipient.id,
        initiatedByUserId: pageInitiator.id,
        status: "PENDING",
        createdAt: new Date(Date.now() - index * 1000)
      }
    });
  }
  const page1 = await listIncomingHelpMatches(pageRecipient.id, { limit: 25 }, db);
  const page2 = await listIncomingHelpMatches(pageRecipient.id, { limit: 25, cursor: page1.page.nextCursor }, db);
  check("esimene leht sisaldab 25 ja hasMore=true", page1.items.length === 25 && page1.page.hasMore === true);
  check("teine leht sisaldab ülejäänud 2", page2.items.length === 2 && page2.page.hasMore === false);
  check("cursor läbib kõik 27 unikaalset rida", new Set([...page1.items, ...page2.items].map((item) => item.id)).size === 27);

  for (const line of lines) console.log(line);
  console.log(`HELP_MATCH_LIFECYCLE_PROBE ${passed}/${passed + failed}`);
  if (failed) process.exitCode = 1;
} finally {
  await db.$disconnect().catch(() => {});
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]).catch(() => {});
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => {});
  await admin.end().catch(() => {});
}
