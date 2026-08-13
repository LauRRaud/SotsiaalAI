#!/usr/bin/env node
/**
 * SOL-PRE-08 — optimistic concurrency against two real PostgreSQL clients.
 *
 * The unit suite uses fake Prisma and cannot prove transaction/advisory-lock or
 * updatedAt CAS behaviour. This probe creates a temporary local database,
 * deploys the existing migrations, and races two independent Prisma clients.
 *
 *   npm run pre:concurrency:probe
 */

import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";

import { PrismaClient } from "../generated/prisma/client.ts";
import { markPreInquiryDownloaded, updatePreInquiry } from "../lib/preInquiries.js";
import { preInquiryRoomLockKey } from "../lib/rooms/preInquiryRoom.js";
import { holdOpen, watch } from "./probe-race-harness.mjs";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");

const parsed = new URL(sourceUrl);
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
if (!localHosts.has(parsed.hostname) && process.env.PRE_INQUIRY_PROBE_ALLOW_REMOTE !== "true") {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname || "tundmatu"})`);
}

const databaseName = `sotsiaal_ai_pre_inquiry_probe_${Date.now()}`;
if (!/^sotsiaal_ai_pre_inquiry_probe_\d+$/.test(databaseName)) {
  throw new Error("Ebaturvaline ajutise andmebaasi nimi");
}

const adminUrl = new URL(parsed);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const probeUrl = new URL(parsed);
probeUrl.pathname = `/${databaseName}`;

const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const clients = Array.from({ length: 3 }, () => new PrismaClient({
  adapter: new PrismaPg({ connectionString: probeUrl.toString() }),
  log: []
}));
const [dbA, dbB, lockDb] = clients;

let failures = 0;
function expect(label, condition, detail = "") {
  const prefix = condition ? "PASS" : "FAIL";
  console.log(`  ${prefix}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures += 1;
}

function runPrisma(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: probeUrl.toString() },
    stdio: "pipe",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`prisma ${args.join(" ")} kukkus koodiga ${result.status}: ${result.stderr?.toString() || ""}`);
  }
}

async function seedInquiry(label) {
  const author = await dbA.user.create({
    data: { email: `pre-probe-${label}-${Date.now()}@sotsiaalai.invalid` }
  });
  const inquiry = await dbA.preInquiry.create({
    data: {
      authorId: author.id,
      recipientType: "KOV_CONTACT",
      deliveryChannel: "EXTERNAL_EMAIL",
      selectedRecipientEmail: "recipient@sotsiaalai.invalid",
      selectedRecipientName: "Probe recipient",
      topic: "Algne teema",
      situation: "See on sünteetiline eelpöördumine optimistic concurrency sondi jaoks.",
      generatedDraft: "Algne mustand",
      userEditedDraft: "Algne mustand",
      status: "DRAFT"
    }
  });
  return { author, inquiry };
}

async function raceBehindHeldLock(inquiryId, first, second, label) {
  const holder = holdOpen(lockDb, (tx) =>
    tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${preInquiryRoomLockKey(inquiryId)}))`
  );
  await new Promise((resolve) => setTimeout(resolve, 80));
  const a = watch(first());
  await new Promise((resolve) => setTimeout(resolve, 120));
  const b = watch(second());
  await new Promise((resolve) => setTimeout(resolve, 120));
  expect(`${label}: klient A ootab sama kirje lukku`, !a.state.settled);
  expect(`${label}: klient B ootab sama kirje lukku`, !b.state.settled);
  holder.release();
  await holder.done;
  return Promise.all([a.wrapped, b.wrapped]);
}

function expectOneCasWinner(label, results) {
  const winners = results.filter((result) => !result.error);
  const conflicts = results.filter((result) => result.error?.status === 409);
  expect(`${label}: täpselt üks kirjutaja võidab`, winners.length === 1, `võitjaid ${winners.length}`);
  expect(`${label}: kaotaja saab 409`, conflicts.length === 1, `409 vastuseid ${conflicts.length}`);
}

async function legacyUpdate(db, inquiryId, topic) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${preInquiryRoomLockKey(inquiryId)}))`;
    const fresh = await tx.preInquiry.findUnique({ where: { id: inquiryId } });
    return tx.preInquiry.update({ where: { id: inquiryId }, data: { topic, situation: fresh.situation } });
  });
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  console.log(`SOL-PRE-08 — ajutine PostgreSQL ${databaseName}\n`);
  runPrisma(["migrate", "deploy"]);

  // Negative control: the former no-CAS shape serializes, but still lets both
  // stale clients succeed and silently overwrites the first result.
  {
    const { inquiry } = await seedInquiry("negative");
    const results = await raceBehindHeldLock(
      inquiry.id,
      () => legacyUpdate(dbA, inquiry.id, "Vana A"),
      () => legacyUpdate(dbB, inquiry.id, "Vana B"),
      "negatiivkontroll"
    );
    const after = await dbA.preInquiry.findUnique({ where: { id: inquiry.id } });
    expect("VANA rada lubab mõlemal aegunud kliendil kirjutada", results.every((result) => !result.error));
    expect("VANA rada kaotab esimese kirjutaja tulemuse", after.topic === "Vana B", after.topic || "teema puudub");
  }

  {
    const { author, inquiry } = await seedInquiry("content-content");
    const expectedUpdatedAt = inquiry.updatedAt.toISOString();
    const results = await raceBehindHeldLock(
      inquiry.id,
      () => updatePreInquiry(author.id, inquiry.id, { expectedUpdatedAt, topic: "Sisu A" }, { db: dbA }),
      () => updatePreInquiry(author.id, inquiry.id, { expectedUpdatedAt, topic: "Sisu B" }, { db: dbB }),
      "content-content"
    );
    expectOneCasWinner("content-content", results);
    const after = await dbA.preInquiry.findUnique({ where: { id: inquiry.id } });
    expect("content-content: lõppseis on ühe võitja tervik", ["Sisu A", "Sisu B"].includes(after.topic), after.topic || "");
  }

  {
    const { author, inquiry } = await seedInquiry("recipient-content");
    const expectedUpdatedAt = inquiry.updatedAt.toISOString();
    const results = await raceBehindHeldLock(
      inquiry.id,
      () => updatePreInquiry(author.id, inquiry.id, {
        expectedUpdatedAt,
        selectedRecipientEmail: "second@sotsiaalai.invalid",
        selectedRecipientName: "Teine adressaat"
      }, { db: dbA }),
      () => updatePreInquiry(author.id, inquiry.id, { expectedUpdatedAt, topic: "Muudetud sisu" }, { db: dbB }),
      "recipient-content"
    );
    expectOneCasWinner("recipient-content", results);
    const after = await dbA.preInquiry.findUnique({ where: { id: inquiry.id } });
    const recipientWon = after.selectedRecipientEmail === "second@sotsiaalai.invalid" && after.topic === "Algne teema";
    const contentWon = after.selectedRecipientEmail === "recipient@sotsiaalai.invalid" && after.topic === "Muudetud sisu";
    expect("recipient-content: adressaat ja sisu ei segune", recipientWon || contentWon, `${after.selectedRecipientEmail} / ${after.topic}`);
  }

  {
    const { author, inquiry } = await seedInquiry("download-edit");
    const expectedUpdatedAt = inquiry.updatedAt.toISOString();
    const results = await raceBehindHeldLock(
      inquiry.id,
      () => markPreInquiryDownloaded(author.id, inquiry.id, { expectedUpdatedAt, db: dbA }),
      () => updatePreInquiry(author.id, inquiry.id, { expectedUpdatedAt, topic: "Pärast allalaadimist" }, { db: dbB }),
      "download-edit"
    );
    expectOneCasWinner("download-edit", results);
    const after = await dbA.preInquiry.findUnique({ where: { id: inquiry.id } });
    const downloadWon = after.status === "DOWNLOADED" && after.topic === "Algne teema";
    const editWon = after.status === "DRAFT" && after.topic === "Pärast allalaadimist";
    expect("download-edit: failitempel ja sisu kuuluvad samale versioonile", downloadWon || editWon, `${after.status} / ${after.topic}`);
  }

  {
    const { author, inquiry } = await seedInquiry("archive-edit");
    const expectedUpdatedAt = inquiry.updatedAt.toISOString();
    const results = await raceBehindHeldLock(
      inquiry.id,
      () => updatePreInquiry(author.id, inquiry.id, { expectedUpdatedAt, status: "ARCHIVED" }, { db: dbA }),
      () => updatePreInquiry(author.id, inquiry.id, { expectedUpdatedAt, topic: "Arhiiviga võistlev sisu" }, { db: dbB }),
      "archive-edit"
    );
    expectOneCasWinner("archive-edit", results);
    const after = await dbA.preInquiry.findUnique({ where: { id: inquiry.id } });
    const archiveWon = after.status === "ARCHIVED" && after.topic === "Algne teema";
    const editWon = after.status === "DRAFT" && after.topic === "Arhiiviga võistlev sisu";
    expect("archive-edit: arhiiv ja sisu ei segune", archiveWon || editWon, `${after.status} / ${after.topic}`);
  }
} finally {
  await Promise.allSettled(clients.map((client) => client.$disconnect()));
  try {
    await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]);
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
  } finally {
    await admin.end();
  }
}

if (failures) {
  console.error(`\nSOL-PRE-08 sond: ${failures} viga`);
  process.exitCode = 1;
} else {
  console.log("\nSOL-PRE-08 sond: kõik invariandid tõendatud; ajutine andmebaas eemaldatud.");
}
