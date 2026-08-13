#!/usr/bin/env node
/** SOL-FIELD-J-10/11 — safety outbox and OCR concurrency in real PostgreSQL. */
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import { enqueuePaymentEmail } from "../lib/payments/emailOutbox.js";
import { reconcileFieldSafetyEmailOutbox, runFieldSafetySweep } from "../lib/field/safety.js";
import { requestFieldOcr } from "../lib/field/ocr.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");
const parsed = new URL(sourceUrl);
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname})`);
}
const databaseName = `sotsiaal_ai_field_final_probe_${Date.now()}`;
if (!/^sotsiaal_ai_field_final_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline andmebaasinimi");
const adminUrl = new URL(parsed);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const probeUrl = new URL(parsed);
probeUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const makeDb = () => new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }), log: [] });
const db = makeDb();
const clients = [db, makeDb(), makeDb(), makeDb()];
let passed = 0;
let failed = 0;

function expect(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function createSafetyVisit(ownerId, suffix, now) {
  return db.fieldVisit.create({
    data: {
      ownerUserId: ownerId,
      status: "IN_PROGRESS",
      safetyArmedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      safetyDeadlineAt: new Date(now.getTime() - 60 * 60 * 1000),
      safetyContactName: `Kontakt ${suffix}`,
      safetyContactEmail: `trusted-${suffix}@probe.invalid`,
      safetyInstructions: "Helista töötajale."
    }
  });
}

async function createOcrAttachment(ownerId, visitId, suffix) {
  const document = await db.userDocument.create({
    data: {
      ownerId,
      title: `OCR ${suffix}`,
      originalName: `${suffix}.png`,
      kind: "FIELD_PHOTO",
      mime: "image/png",
      size: 20,
      sha256: suffix.padEnd(64, "a").slice(0, 64),
      storagePath: `uploads/${suffix}.png`
    }
  });
  return db.fieldVisitAttachment.create({
    data: {
      visitId,
      clientItemId: `ocr-${suffix}`,
      role: "photo",
      documentId: document.id,
      storageStatus: "ACTIVE"
    }
  });
}

async function main() {
  console.log("SOL-FIELD-J-10/11 — päris-DB outboxi- ja OCR-sond\n");
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  const migrated = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: probeUrl.toString() }, stdio: "pipe", shell: false
  });
  if (migrated.error) throw migrated.error;
  if (migrated.status !== 0) throw new Error(`prisma migrate deploy failed (${migrated.status})\n${migrated.stderr}`);

  const now = new Date("2026-08-13T20:00:00.000Z");
  const owner = await db.user.create({
    data: { email: "field-final@probe.invalid", role: "SOCIAL_WORKER", emailVerified: now }
  });
  const originalFrom = process.env.EMAIL_FROM;
  process.env.EMAIL_FROM = "field-safety@probe.invalid";

  const parallelVisit = await createSafetyVisit(owner.id, "parallel", now);
  const sent = [];
  const mailer = { async sendMail(message) { sent.push(message); return { messageId: message.messageId, accepted: [message.to] }; } };
  await Promise.all([
    runFieldSafetySweep({ db: clients[0], now, mailer, batchSize: 10 }),
    runFieldSafetySweep({ db: clients[1], now, mailer, batchSize: 10 })
  ]);
  expect("kaks paralleelset sweep'i saadavad ühe eskalatsiooni", sent.length === 1, `sent=${sent.length}`);
  expect("eskalatsioon saab SENT alles outboxi kinnituse järel", (await db.fieldVisit.findUnique({ where: { id: parallelVisit.id } })).safetyEscalationStatus === "SENT");
  expect("eskalatsiooni outbox on dedupe-võtmega üks rida", await db.paymentEmailOutbox.count({ where: { dedupeKey: `field-safety:${parallelVisit.id}:escalation` } }) === 1);

  await db.fieldVisit.update({ where: { id: parallelVisit.id }, data: { departedConfirmedAt: new Date(now.getTime() + 60_000) } });
  await runFieldSafetySweep({ db, now: new Date(now.getTime() + 2 * 60_000), mailer, batchSize: 10 });
  expect("lahendusteade saadetakse täpselt ühe korra", sent.length === 2);
  expect("resolvedNotifiedAt tekib ainult SENT järel", Boolean((await db.fieldVisit.findUnique({ where: { id: parallelVisit.id } })).safetyResolvedNotifiedAt));

  const missingTransport = await createSafetyVisit(owner.id, "no-transport", now);
  process.env.EMAIL_FROM = "";
  await runFieldSafetySweep({ db, now, mailer: null, batchSize: 10 });
  expect("puuduv saatja/transport on FAILED, mitte edu", (await db.fieldVisit.findUnique({ where: { id: missingTransport.id } })).safetyEscalationStatus === "FAILED");
  process.env.EMAIL_FROM = "field-safety@probe.invalid";

  const timeoutVisit = await createSafetyVisit(owner.id, "timeout", now);
  let timeoutSends = 0;
  const slowMailer = {
    async sendMail(message) {
      timeoutSends += 1;
      await new Promise(resolve => setTimeout(resolve, 50));
      return { messageId: message.messageId };
    }
  };
  await runFieldSafetySweep({ db, now, mailer: slowMailer, batchSize: 10, emailTimeoutMs: 5 });
  expect("SMTP timeout jääb ausalt UNKNOWN", (await db.fieldVisit.findUnique({ where: { id: timeoutVisit.id } })).safetyEscalationStatus === "UNKNOWN");
  await runFieldSafetySweep({ db, now: new Date(now.getTime() + 60 * 60 * 1000), mailer, batchSize: 10 });
  expect("UNKNOWN tundlik kiri ei lähe pimedale kordusele", timeoutSends === 1);

  const crashVisit = await createSafetyVisit(owner.id, "reconcile", now);
  const dedupeKey = `field-safety:${crashVisit.id}:escalation`;
  await enqueuePaymentEmail(db, {
    dedupeKey,
    template: "field_safety_escalation",
    toEmail: "trusted-reconcile@probe.invalid",
    locale: "et",
    payload: { visitId: crashVisit.id, ownerUserId: owner.id, subject: "S", text: "T" },
    now
  });
  await db.paymentEmailOutbox.update({ where: { dedupeKey }, data: { status: "SENT", sentAt: now, nextAttemptAt: null } });
  await reconcileFieldSafetyEmailOutbox({ db, now });
  expect("worker crash pärast outbox SENT-i taastab visiidi ilma uue kirjata", (await db.fieldVisit.findUnique({ where: { id: crashVisit.id } })).safetyEscalationStatus === "SENT");

  const ocrOwner = await db.user.create({
    data: { email: "field-ocr@probe.invalid", role: "SOCIAL_WORKER", emailVerified: now }
  });
  const ocrVisit = await db.fieldVisit.create({ data: { ownerUserId: ocrOwner.id, status: "IN_PROGRESS" } });
  const same = await createOcrAttachment(ocrOwner.id, ocrVisit.id, "same-photo");
  let sameExecutions = 0;
  const sameCalls = await Promise.all(clients.map((client, index) => requestFieldOcr(
    { ownerUserId: ocrOwner.id, visitId: ocrVisit.id, clientItemId: same.clientItemId, ipAddress: `10.0.0.${index + 1}` },
    {
      db: client,
      now,
      rateMax: 20,
      concurrency: 2,
      readDocument: async () => Buffer.from("photo"),
      execute: async () => {
        sameExecutions += 1;
        await new Promise(resolve => setTimeout(resolve, 60));
        return { text: "Üks tulemus", truncated: false };
      }
    }
  )));
  expect("sama foto+SHA neljast ühendusest arvutatakse üks kord", sameExecutions === 1, `exec=${sameExecutions}`);
  expect("sama foto kõik vastused kannavad sama job ID-d", new Set(sameCalls.map(row => row.jobId)).size === 1);

  const different = await Promise.all(["photo-a", "photo-b", "photo-c", "photo-d"].map(suffix => createOcrAttachment(ocrOwner.id, ocrVisit.id, suffix)));
  let active = 0;
  let peak = 0;
  const differentResults = await Promise.allSettled(different.map((attachment, index) => requestFieldOcr(
    { ownerUserId: ocrOwner.id, visitId: ocrVisit.id, clientItemId: attachment.clientItemId, ipAddress: `10.0.1.${index + 1}` },
    {
      db: clients[index],
      now: new Date(now.getTime() + 1000),
      rateMax: 20,
      concurrency: 2,
      readDocument: async () => Buffer.from("photo"),
      execute: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise(resolve => setTimeout(resolve, 150));
        active -= 1;
        return { text: "Tulemus", truncated: false };
      }
    }
  )));
  const busy = differentResults.filter(row => row.status === "rejected" && row.reason?.status === 429 && row.reason?.retryAfter === 2).length;
  expect("DB-globaalne OCR concurrency ei ületa kahte", peak <= 2, `peak=${peak}`);
  expect("üle globaalse piiri päring saab 429 Retry-After", busy >= 1, `busy=${busy}`);

  const rateOwner = await db.user.create({ data: { email: "field-ocr-rate@probe.invalid", role: "SOCIAL_WORKER", emailVerified: now } });
  const rateVisit = await db.fieldVisit.create({ data: { ownerUserId: rateOwner.id, status: "IN_PROGRESS" } });
  const rateAttachments = await Promise.all(["rate-a", "rate-b"].map(suffix => createOcrAttachment(rateOwner.id, rateVisit.id, suffix)));
  const rateOptions = { db, now, rateMax: 1, readDocument: async () => Buffer.from("photo"), execute: async () => ({ text: "T", truncated: false }) };
  await requestFieldOcr({ ownerUserId: rateOwner.id, visitId: rateVisit.id, clientItemId: rateAttachments[0].clientItemId, ipAddress: "10.1.0.1" }, rateOptions);
  let rateError = null;
  try {
    await requestFieldOcr({ ownerUserId: rateOwner.id, visitId: rateVisit.id, clientItemId: rateAttachments[1].clientItemId, ipAddress: "10.1.0.1" }, rateOptions);
  } catch (error) { rateError = error; }
  expect("püsiv kasutaja/IP rate-limit annab 429 ja Retry-After 60", rateError?.status === 429 && rateError?.retryAfter === 60);

  if (originalFrom === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = originalFrom;
  console.log(`\n${passed}/${passed + failed} kontrolli läbis.`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => {
    await Promise.all(clients.map(client => client.$disconnect().catch(() => null)));
    await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]).catch(() => null);
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null);
    await admin.end().catch(() => null);
    console.log("CLEANUP_OK temporary_database_removed");
  });
