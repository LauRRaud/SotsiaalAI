#!/usr/bin/env node
/** SOL-FIELD-J-04/06/07 — durable handover + file/quota races in real PostgreSQL. */
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import { putFieldVisitAttachment } from "../lib/field/attachments.js";
import { handoverFieldVisit } from "../lib/field/service.js";
import { withStorageQuota } from "../lib/documents/storageQuota.js";
import { getUserStorageUsageBytes } from "../lib/storageUsage.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");
const parsed = new URL(sourceUrl);
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname})`);
}
const databaseName = `sotsiaal_ai_field_saga_probe_${Date.now()}`;
if (!/^sotsiaal_ai_field_saga_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline andmebaasinimi");
const adminUrl = new URL(parsed);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const probeUrl = new URL(parsed);
probeUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }), log: [] });
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

const memory = new Map();
const files = {
  async write(path, buffer) { memory.set(path, Buffer.from(buffer)); },
  async publish(from, to) {
    if (memory.has(to)) return;
    if (!memory.has(from)) throw new Error("staging_missing");
    memory.set(to, memory.get(from));
    memory.delete(from);
  },
  async remove(path) { if (path) memory.delete(path); },
  async exists(path) { return memory.has(path); }
};

function uploadFile(bytes, type, name) {
  return { type, name, size: bytes.length, async arrayBuffer() { return bytes; } };
}

async function main() {
  console.log("SOL-FIELD-J-04/06/07 — päris-DB saga- ja kvoodisond\n");
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  const migrated = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: probeUrl.toString() }, stdio: "pipe", shell: false
  });
  if (migrated.error) throw migrated.error;
  if (migrated.status !== 0) throw new Error(`prisma migrate deploy failed (${migrated.status})\n${migrated.stderr}`);

  const handoverOwner = await db.user.create({
    data: { email: "field-handover@probe.invalid", role: "SOCIAL_WORKER", emailVerified: new Date() }
  });
  const inquiry = await db.preInquiry.create({
    data: {
      authorId: handoverOwner.id,
      recipientOwnerId: handoverOwner.id,
      recipientType: "KOV_CONTACT",
      situation: "Sünteetiline välitöö üleandmine",
      status: "SENT",
      sentAt: new Date()
    }
  });
  const handoverVisit = await db.fieldVisit.create({
    data: { ownerUserId: handoverOwner.id, preInquiryId: inquiry.id, status: "WRAP_UP", goal: "Saga" }
  });
  await db.fieldVisitNote.create({
    data: {
      visitId: handoverVisit.id,
      clientItemId: "probe-handover-note-1",
      provenance: "TOOTAJA_TAHELEPANEK",
      body: "Sünteetiline kokkuvõte",
      kind: "note"
    }
  });
  const sagaInput = {
    clientActionId: "field-probe-saga-action-1",
    toArtifact: true,
    toPreInquiry: true,
    preInquiryNote: "Külastus lõpetati."
  };
  const stale = Object.assign(new Error("pre_inquiries.errors.open_conflict"), { status: 409 });
  const partial = await handoverFieldVisit(handoverOwner.id, handoverVisit.id, sagaInput, {
    db,
    workflow: async () => { throw stale; }
  });
  expect("kahe sihi osaline viga jätab artefakti DONE", partial.handover.targets.artifact.status === "DONE");
  expect("kahe sihi osaline viga jätab eelpöördumise FAILED", partial.handover.targets.preInquiry.status === "FAILED");
  const resumed = await handoverFieldVisit(handoverOwner.id, handoverVisit.id, sagaInput, { db });
  expect("retry jätkab ainult puuduvat sihti", resumed.handover.targets.preInquiry.status === "DONE");
  expect("retry ei dubleeri artefakti", await db.agentArtifact.count({ where: { ownerId: handoverOwner.id } }) === 1);

  const parallelVisit = await db.fieldVisit.create({ data: { ownerUserId: handoverOwner.id, status: "WRAP_UP" } });
  const parallelInput = { clientActionId: "field-probe-parallel-1", toArtifact: true };
  const parallel = await Promise.all([
    handoverFieldVisit(handoverOwner.id, parallelVisit.id, parallelInput, { db }),
    handoverFieldVisit(handoverOwner.id, parallelVisit.id, parallelInput, { db })
  ]);
  expect("kaks paralleelset sama võtit tagastavad sama siht-ID", parallel[0].artifact.id === parallel[1].artifact.id);
  expect("kaks paralleelset request'i loovad ühe artefakti", await db.agentArtifact.count({ where: { ownerId: handoverOwner.id } }) === 2);
  let conflict = null;
  try {
    await handoverFieldVisit(handoverOwner.id, parallelVisit.id, { ...parallelInput, artifactTitle: "Muu" }, { db });
  } catch (error) { conflict = error; }
  expect("sama võti eri sisuga annab 409", conflict?.status === 409);

  const quotaOwner = await db.user.create({
    data: { email: "field-quota@probe.invalid", role: "SOCIAL_WORKER", emailVerified: new Date() }
  });
  const visits = await Promise.all([
    db.fieldVisit.create({ data: { ownerUserId: quotaOwner.id, status: "IN_PROGRESS" } }),
    db.fieldVisit.create({ data: { ownerUserId: quotaOwner.id, status: "IN_PROGRESS" } })
  ]);
  await db.fieldVisitNote.createMany({
    data: [
      { visitId: visits[0].id, clientItemId: "probe-photo-consent-1", kind: "consent", provenance: "KLIENDI_KINNITATUD", body: "Foto", consentKind: "photo" },
      { visitId: visits[1].id, clientItemId: "probe-audio-consent-1", kind: "consent", provenance: "KLIENDI_KINNITATUD", body: "Heli", consentKind: "audio" }
    ]
  });
  const chunk = 20;
  const quotaBytes = 100 * 1024 * 1024;
  await db.userDocument.create({
    data: {
      ownerId: quotaOwner.id,
      title: "Täide",
      originalName: "fill.bin",
      kind: "MATERIAL",
      mime: "application/octet-stream",
      size: quotaBytes - 2 * chunk,
      sha256: "0".repeat(64),
      storagePath: "uploads/probe-fill.bin"
    }
  });
  const png = Buffer.from("89504e470d0a1a0a0000000049454e44ae426082", "hex");
  const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(16)]);
  const standardStage = "uploads/probe-standard.staged";
  const standardFinal = "uploads/probe-standard.bin";
  memory.set(standardStage, Buffer.alloc(chunk));
  const standard = () => withStorageQuota(
    { userId: quotaOwner.id, role: "SOCIAL_WORKER", addBytes: chunk, dailyAddBytes: chunk },
    { db },
    async (tx) => {
      const row = await tx.userDocument.create({
        data: {
          ownerId: quotaOwner.id,
          title: "Tavadokument",
          originalName: "probe.bin",
          kind: "MATERIAL",
          mime: "application/octet-stream",
          size: chunk,
          sha256: "1".repeat(64),
          storagePath: standardFinal
        }
      });
      await files.publish(standardStage, standardFinal);
      return row;
    }
  ).catch(async (error) => { await files.remove(standardStage); throw error; });
  const results = await Promise.allSettled([
    putFieldVisitAttachment(
      quotaOwner.id,
      visits[0].id,
      "probe-photo-upload-1",
      { file: uploadFile(png, "image/png", "photo.png"), role: "photo", consentClientItemId: "probe-photo-consent-1" },
      { db, session: { user: { role: "SOCIAL_WORKER" } }, files }
    ),
    putFieldVisitAttachment(
      quotaOwner.id,
      visits[1].id,
      "probe-audio-upload-1",
      { file: uploadFile(webm, "audio/webm", "audio.webm"), role: "audio", consentClientItemId: "probe-audio-consent-1" },
      { db, session: { user: { role: "SOCIAL_WORKER" } }, files }
    ),
    standard()
  ]);
  const won = results.filter((row) => row.status === "fulfilled").length;
  const rejected = results.filter((row) => row.status === "rejected" && row.reason?.status === 413).length;
  const usage = await getUserStorageUsageBytes(quotaOwner.id, { db });
  expect("foto + heli + tavadokumendi võistlusest võidab täpselt mahtu jääv hulk", won === 2, `won=${won}`);
  expect("ülejäänud paralleelne upload saab 413", rejected === 1, `413=${rejected}`);
  expect("lõppsumma ei ületa kvooti", usage.totalBytes <= quotaBytes, `${usage.totalBytes} > ${quotaBytes}`);
  expect("kaotaja ei jäta faili", memory.size === 2, `files=${memory.size}`);
  expect("ükski FIELD failitöö ei jää pending/failed", await db.dataDeletionJob.count({ where: { action: { in: ["FIELD_FILE_STAGE", "FIELD_FILE_PUBLISH"] }, status: { in: ["pending", "failed"] } } }) === 0);

  console.log(`\n${passed}/${passed + failed} kontrolli läbis.`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => {
    await db.$disconnect().catch(() => null);
    await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]).catch(() => null);
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null);
    await admin.end().catch(() => null);
    console.log("CLEANUP_OK temporary_database_removed");
  });
