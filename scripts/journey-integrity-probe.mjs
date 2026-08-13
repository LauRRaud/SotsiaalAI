#!/usr/bin/env node
/**
 * SOL-JOUR-05/09/14/15 — Journey kirjutuse, ajaloo, mahu ja päritolu päris
 * PostgreSQL-i sond.
 *
 * Fake-Prisma ei tõenda kahe sama `updatedAt` versiooniga kirjutaja võistlust.
 * Sond loob ainult localhosti ajutise andmebaasi, rakendab olemasolevad
 * migratsioonid ning nõuab igas võistluses täpselt üht võitjat.
 */

import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";

import { PrismaClient } from "../generated/prisma/client.ts";
import {
  createJourneyForUser,
  listJourneyActivityForUser,
  listJourneysForUser,
  listLinkedPreInquiriesForJourney,
  updateJourneyForUser
} from "../lib/journey/service.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
process.env.U1_OUTBOX_ENABLED = "false";

const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");

const parsed = new URL(sourceUrl);
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
if (!localHosts.has(parsed.hostname)) {
  throw new Error(`Journey sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname || "tundmatu"})`);
}

const databaseName = `sotsiaal_ai_journey_probe_${Date.now()}`;
if (!/^sotsiaal_ai_journey_probe_\d+$/.test(databaseName)) {
  throw new Error("Ebaturvaline ajutise andmebaasi nimi");
}

const adminUrl = new URL(parsed);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const probeUrl = new URL(parsed);
probeUrl.pathname = `/${databaseName}`;

const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: probeUrl.toString() }),
  log: []
});

function runPrisma(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: probeUrl.toString() },
    stdio: "pipe",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`prisma ${args.join(" ")} kukkus koodiga ${result.status}`);
  }
}

function synchronizedReadDb(participants = 2) {
  let readers = 0;
  let release;
  const allRead = new Promise((resolve) => { release = resolve; });

  return {
    journey: {
      async findFirst(args) {
        const row = await db.journey.findFirst(args);
        readers += 1;
        if (readers === participants) release();
        await allRead;
        return row;
      }
    },
    preInquiry: db.preInquiry,
    domainEvent: db.domainEvent,
    $transaction: (...args) => db.$transaction(...args)
  };
}

async function seedJourney(ownerUserId, suffix) {
  return db.journey.create({
    data: {
      ownerUserId,
      title: `Algne ${suffix}`,
      summary: "Sünteetiline Journey võistlussond",
      status: "ACTIVE",
      sharingStatus: "PRIVATE",
      roleContext: "CLIENT",
      context: { schemaVersion: 1 }
    }
  });
}

async function expectOneWinner(label, ownerUserId, journey, first, second, verifyFinal) {
  const version = journey.updatedAt.toISOString();
  const raceDb = synchronizedReadDb();
  const results = await Promise.allSettled([
    updateJourneyForUser(ownerUserId, journey.id, { ...first, expectedUpdatedAt: version }, { db: raceDb }),
    updateJourneyForUser(ownerUserId, journey.id, { ...second, expectedUpdatedAt: version }, { db: raceDb })
  ]);
  const winners = results.filter((result) => result.status === "fulfilled");
  const losers = results.filter((result) => result.status === "rejected");

  if (winners.length !== 1 || losers.length !== 1 || losers[0].reason?.status !== 409) {
    throw new Error(`${label}: oodati üht võitjat ja üht 409 kaotajat`);
  }

  const finalRow = await db.journey.findUnique({ where: { id: journey.id } });
  if (!verifyFinal(finalRow)) throw new Error(`${label}: lõppseis ei vasta ühe võitja invariandile`);
  process.stdout.write(`OK ${label}: üks võitja, üks 409\n`);
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  runPrisma(["migrate", "deploy"]);

  const owner = await db.user.create({
    data: { email: `journey-probe-${Date.now()}@sotsiaalai.test`, role: "CLIENT" }
  });

  const missingVersion = await seedJourney(owner.id, "missing-version");
  await updateJourneyForUser(owner.id, missingVersion.id, { title: "Keelatud" }, { db })
    .then(() => { throw new Error("Versioonita PATCH võeti vastu"); })
    .catch((error) => {
      if (error.status !== 409 || error.message !== "journeys.errors.version_required") throw error;
    });
  process.stdout.write("OK versioonita PATCH: 409 version_required\n");

  const editVsContinuity = await seedJourney(owner.id, "edit-continuity");
  await expectOneWinner(
    "edit vs continuity",
    owner.id,
    editVsContinuity,
    { title: "Kasutaja parandus" },
    { context: { schemaVersion: 1, serviceContinuity: { serviceName: "Koduteenus" } } },
    (row) => (row.title === "Kasutaja parandus") !== (row.context?.serviceContinuity?.serviceName === "Koduteenus")
  );

  const editVsArchive = await seedJourney(owner.id, "edit-archive");
  await expectOneWinner(
    "edit vs archive",
    owner.id,
    editVsArchive,
    { title: "Kasutaja parandus" },
    { status: "ARCHIVED" },
    (row) => (row.title === "Kasutaja parandus" && row.status === "ACTIVE")
      || (row.title === "Algne edit-archive" && row.status === "ARCHIVED")
  );

  const continuityVsContinuity = await seedJourney(owner.id, "continuity-continuity");
  await expectOneWinner(
    "continuity vs continuity",
    owner.id,
    continuityVsContinuity,
    { context: { schemaVersion: 1, serviceContinuity: { serviceName: "Variant A" } } },
    { context: { schemaVersion: 1, serviceContinuity: { serviceName: "Variant B" } } },
    (row) => ["Variant A", "Variant B"].includes(row.context?.serviceContinuity?.serviceName)
  );

  const foreignOwner = await db.user.create({
    data: { email: `journey-probe-foreign-${Date.now()}@sotsiaalai.test`, role: "CLIENT" }
  });
  const ownConversation = await db.conversation.create({
    data: {
      id: crypto.randomUUID(),
      userId: owner.id,
      role: "CLIENT"
    }
  });
  const foreignConversation = await db.conversation.create({
    data: {
      id: crypto.randomUUID(),
      userId: foreignOwner.id,
      role: "CLIENT"
    }
  });

  const originJourney = await createJourneyForUser(owner.id, {
    clientActionId: "probe-origin-own",
    summary: "Sünteetiline vestlusest loodud Teekond",
    conversationId: ownConversation.id
  }, { db, roleContext: "CLIENT" });
  if (originJourney.conversationId !== ownConversation.id) {
    throw new Error("Omaniku vestluse päritoluseos ei salvestunud");
  }
  process.stdout.write("OK omaniku conversationId: seos salvestus\n");

  const beforeForeignAttempt = await db.journey.count({ where: { ownerUserId: owner.id } });
  await createJourneyForUser(owner.id, {
    clientActionId: "probe-origin-foreign",
    summary: "Võõra vestluse päritolukatse",
    conversationId: foreignConversation.id
  }, { db, roleContext: "CLIENT" })
    .then(() => { throw new Error("Võõra vestluse seos võeti vastu"); })
    .catch((error) => {
      if (error.status !== 400 || error.message !== "journeys.errors.conversation_not_found") throw error;
    });
  const afterForeignAttempt = await db.journey.count({ where: { ownerUserId: owner.id } });
  if (afterForeignAttempt !== beforeForeignAttempt) {
    throw new Error("Võõra conversationId katse lõi Journey kirje");
  }
  process.stdout.write("OK võõras conversationId: 400 ja Journey kirjet ei loodud\n");

  await db.conversation.delete({ where: { id: ownConversation.id } });
  const afterConversationDelete = await db.journey.findUnique({
    where: { id: originJourney.id },
    select: { id: true, conversationId: true }
  });
  if (!afterConversationDelete || afterConversationDelete.conversationId !== null) {
    throw new Error("Vestluse kustutus ei jätnud Journey kirjet SetNull seosega alles");
  }
  process.stdout.write("OK vestluse kustutus: Journey jäi alles ja conversationId=null\n");

  const idempotencyOwner = await db.user.create({
    data: { email: `journey-probe-idempotency-${Date.now()}@sotsiaalai.test`, role: "CLIENT" }
  });
  const retries = await Promise.all(Array.from({ length: 5 }, () => createJourneyForUser(idempotencyOwner.id, {
    clientActionId: "same-save-click",
    summary: "Üks kord salvestatav sünteetiline Teekond"
  }, { db, roleContext: "CLIENT" })));
  if (new Set(retries.map((row) => row.id)).size !== 1) {
    throw new Error("Kordusohutu loomine tagastas eri Journey ID-d");
  }
  const retryCount = await db.journey.count({ where: { ownerUserId: idempotencyOwner.id } });
  if (retryCount !== 1) throw new Error(`Kordusohutu loomine lõi ${retryCount} rida`);
  process.stdout.write("OK paralleelne kordus: 5 katset, üks Journey rida\n");

  const cappedOwner = await db.user.create({
    data: { email: `journey-probe-capped-${Date.now()}@sotsiaalai.test`, role: "CLIENT" }
  });
  await db.journey.createMany({
    data: Array.from({ length: 200 }, (_, index) => ({
      id: `jrn_cap_${String(index).padStart(3, "0")}`,
      ownerUserId: cappedOwner.id,
      title: `Cap ${index}`,
      summary: "Sünteetiline loomise piir",
      status: "ACTIVE",
      sharingStatus: "PRIVATE",
      roleContext: "CLIENT",
      context: { schemaVersion: 1 }
    }))
  });
  await createJourneyForUser(cappedOwner.id, {
    clientActionId: "over-active-cap",
    summary: "Seda rida ei tohi luua"
  }, { db, roleContext: "CLIENT" })
    .then(() => { throw new Error("Aktiivsete Journey kirjete piir ei rakendunud"); })
    .catch((error) => {
      if (error.code !== "JOURNEY_CREATE_LIMIT_REACHED" || error.status !== 429) throw error;
    });
  process.stdout.write("OK loomise piir: 200 aktiivse rea järel fail-closed 429\n");

  const volumeOwner = await db.user.create({
    data: { email: `journey-probe-volume-${Date.now()}@sotsiaalai.test`, role: "CLIENT" }
  });
  const volumeRows = 10_005;
  const sameUpdatedAt = new Date("2026-08-13T12:00:00.000Z");
  for (let offset = 0; offset < volumeRows; offset += 1000) {
    const size = Math.min(1000, volumeRows - offset);
    await db.journey.createMany({
      data: Array.from({ length: size }, (_, index) => {
        const number = offset + index;
        return {
          id: `jrn_volume_${String(number).padStart(5, "0")}`,
          ownerUserId: volumeOwner.id,
          title: `Volume ${number}`,
          summary: "Sünteetiline mahusond",
          status: number % 2 ? "ACTIVE" : "ARCHIVED",
          sharingStatus: "PRIVATE",
          roleContext: "CLIENT",
          context: { schemaVersion: 1 },
          createdAt: sameUpdatedAt,
          updatedAt: sameUpdatedAt
        };
      })
    });
  }

  const seenJourneys = new Set();
  let journeyCursor = null;
  let firstJourneyPage = null;
  do {
    const page = await listJourneysForUser(volumeOwner.id, { db, limit: 100, cursor: journeyCursor });
    firstJourneyPage ||= page;
    for (const row of page.items) seenJourneys.add(row.id);
    journeyCursor = page.nextCursor;
  } while (journeyCursor);
  if (firstJourneyPage.totalCount !== volumeRows || seenJourneys.size !== volumeRows) {
    throw new Error(`Journey cursor kaotas read: count=${firstJourneyPage.totalCount}, unique=${seenJourneys.size}`);
  }
  const activePage = await listJourneysForUser(volumeOwner.id, { db, limit: 1, status: "ACTIVE" });
  if (activePage.totalCount !== Math.floor(volumeRows / 2)) throw new Error("Journey olekufilter loendas valesti");
  process.stdout.write(`OK Journey maht: ${volumeRows} rida, stabiilne cursor, count ja olekufilter\n`);

  const sourceJourneyId = "jrn_volume_00000";
  for (let offset = 0; offset < volumeRows; offset += 1000) {
    const size = Math.min(1000, volumeRows - offset);
    await db.preInquiry.createMany({
      data: Array.from({ length: size }, (_, index) => {
        const number = offset + index;
        return {
          id: `pi_volume_${String(number).padStart(5, "0")}`,
          authorId: volumeOwner.id,
          sourceJourneyId,
          recipientType: "KOV_CONTACT",
          situation: "Sünteetiline seotud eelpöördumine",
          status: "DRAFT",
          createdAt: sameUpdatedAt,
          updatedAt: sameUpdatedAt
        };
      })
    });
  }
  const seenPreInquiries = new Set();
  let preCursor = null;
  let firstPrePage = null;
  do {
    const page = await listLinkedPreInquiriesForJourney(volumeOwner.id, sourceJourneyId, {
      db, limit: 100, cursor: preCursor
    });
    firstPrePage ||= page;
    for (const row of page.items) seenPreInquiries.add(row.id);
    preCursor = page.nextCursor;
  } while (preCursor);
  if (firstPrePage.totalCount !== volumeRows || seenPreInquiries.size !== volumeRows) {
    throw new Error(`Seotud eelpöördumiste cursor kaotas read: count=${firstPrePage.totalCount}, unique=${seenPreInquiries.size}`);
  }
  process.stdout.write(`OK seotud eelpöördumiste maht: ${volumeRows} rida, stabiilne cursor ja count\n`);

  await db.domainEvent.createMany({
    data: Array.from({ length: 61 }, (_, index) => ({
      id: `event_volume_${String(index).padStart(2, "0")}`,
      type: "workspace.updated",
      version: 1,
      occurredAt: new Date(sameUpdatedAt.getTime() + index * 1000),
      actorKind: "user",
      actorUserId: volumeOwner.id,
      sourceFeature: "journeys",
      sourceType: "JOURNEY",
      sourceId: sourceJourneyId,
      workspaceKind: "journey",
      workspaceId: sourceJourneyId,
      audienceRule: "owner",
      visibilityClass: "personal",
      actionKind: "OPEN_WORKSPACE",
      actionTarget: `journey:${sourceJourneyId}`,
      idempotencyKey: `probe-activity:${index}`,
      retentionClass: "standard90",
      meta: { kind: "journey" }
    }))
  });
  const activity = await listJourneyActivityForUser(volumeOwner.id, sourceJourneyId, { db, limit: 8 });
  if (activity.totalCount !== 61 || activity.items.length !== 8 || activity.items[0].id !== "event_volume_60") {
    throw new Error("DomainEvent ajalugu ei tagastanud 61 sündmuse uusimat järjestatud lehte");
  }
  process.stdout.write("OK sündmusajalugu: 61 append-only rida, uusim 8 õiges järjekorras\n");

  const patchTarget = await db.journey.findUnique({ where: { id: "jrn_volume_00001" } });
  await updateJourneyForUser(volumeOwner.id, patchTarget.id, {
    expectedUpdatedAt: patchTarget.updatedAt.toISOString(),
    context: {
      schemaVersion: 1,
      personWish: "Usaldatav sisu",
      activityLog: [{ type: "deleted", title: "Kliendi võltsitud sündmus" }]
    }
  }, { db });
  const patched = await db.journey.findUnique({ where: { id: patchTarget.id } });
  if (patched.context?.activityLog || patched.context?.personWish !== "Usaldatav sisu") {
    throw new Error("context PATCH muutis sündmusajalugu või kaotas usaldatava konteksti");
  }
  const patchedActivity = await listJourneyActivityForUser(volumeOwner.id, patchTarget.id, { db });
  if (patchedActivity.totalCount !== 1 || patchedActivity.items[0]?.type !== "workspace.updated") {
    throw new Error("context PATCH ei tekitanud serveripoolset workspace.updated sündmust");
  }
  process.stdout.write("OK context PATCH: activityLog eirati ja server lisas workspace.updated sündmuse\n");
} finally {
  await db.$disconnect().catch(() => {});
  await admin.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
    [databaseName]
  ).catch(() => {});
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => {});
  await admin.end().catch(() => {});
}
