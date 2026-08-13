#!/usr/bin/env node
/** SOL-SLOG-J-05/06/07 — eksport, konto kustutus ja retention päris PostgreSQL-is. */
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import { deleteUserAfterFinalPracticeSweep } from "../lib/privacy/effectivePracticeAccountCleanup.js";
import {
  collectServiceLogDataExport,
  eraseServiceLogUserReferences,
  purgeExpiredServiceLogData
} from "../lib/serviceLog/privacyLifecycle.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");
const parsed = new URL(sourceUrl);
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname})`);
}
const databaseName = `sotsiaal_ai_slog_privacy_probe_${Date.now()}`;
if (!/^sotsiaal_ai_slog_privacy_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline andmebaasinimi");
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

function parseNdjson(file) {
  return file.content.toString("utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

const sum = (value) => Object.values(value).reduce((total, count) => total + count, 0);

async function createFixture() {
  const [worker, client, manager, otherOwner] = await Promise.all([
    db.user.create({ data: { email: "worker@slog-privacy.invalid", role: "SERVICE_PROVIDER", emailVerified: new Date() } }),
    db.user.create({ data: { email: "client@slog-privacy.invalid", role: "CLIENT", emailVerified: new Date() } }),
    db.user.create({ data: { email: "manager@slog-privacy.invalid", role: "SOCIAL_WORKER", emailVerified: new Date() } }),
    db.user.create({ data: { email: "other@slog-privacy.invalid", role: "SERVICE_PROVIDER", emailVerified: new Date() } })
  ]);
  const organization = await db.organization.create({
    data: {
      displayName: "Sünteetiline organisatsioon",
      legalKind: "NGO",
      status: "ACTIVE",
      verifiedAt: new Date(),
      activatedAt: new Date()
    }
  });
  const membership = await db.organizationMembership.create({
    data: { organizationId: organization.id, userId: manager.id, seatRole: "SOCIAL_WORKER" }
  });
  const profile = await db.serviceProviderProfile.create({
    data: { ownerId: worker.id, ownershipMode: "SOLO", organizationName: "Sünteetiline osutaja", status: "PUBLISHED" }
  });
  const otherProfile = await db.serviceProviderProfile.create({
    data: { ownerId: otherOwner.id, ownershipMode: "SOLO", organizationName: "Teine sünteetiline osutaja", status: "PUBLISHED" }
  });
  let referral = await db.serviceReferral.create({
    data: {
      providerProfileId: profile.id,
      kovName: "Sünteetiline KOV",
      referralNumber: "PRIVATE-REFERRAL",
      clientUserId: client.id,
      clientDisplayName: "Kliendi salanimi",
      clientExternalRef: "CLIENT-PRIVATE-REF",
      periodStart: new Date("2018-01-01T00:00:00.000Z"),
      periodEnd: new Date("2017-12-31T00:00:00.000Z"),
      status: "ENDED"
    }
  });
  referral = await db.serviceReferral.update({
    where: { id: referral.id },
    data: { periodEnd: new Date("2018-12-31T00:00:00.000Z") }
  });
  const route = await db.serviceWorkRoute.create({
    data: {
      providerProfileId: profile.id,
      workerUserId: worker.id,
      date: new Date("2018-06-10T00:00:00.000Z"),
      status: "CLOSED",
      startedAt: new Date("2018-06-10T07:00:00.000Z"),
      endedAt: new Date("2018-06-10T15:00:00.000Z")
    }
  });
  const finalEntry = await db.serviceEntry.create({
    data: {
      providerProfileId: profile.id,
      ownerUserId: worker.id,
      referralId: referral.id,
      clientUserId: client.id,
      clientDisplayName: "Kliendi salanimi",
      clientExternalRef: "CLIENT-PRIVATE-REF",
      date: new Date("2018-06-10T00:00:00.000Z"),
      quantity: "1.50",
      workerName: "Sünteetiline töötaja",
      note: "PRIVATE-FINAL-NOTE",
      status: "FINAL",
      finalizedAt: new Date("2018-06-10T10:00:00.000Z"),
      recordedFiscalYear: 2018,
      confirmedByClientAt: new Date("2018-06-10T10:05:00.000Z"),
      createdAt: new Date("2018-06-10T10:00:00.000Z")
    }
  });
  const voidEntry = await db.serviceEntry.create({
    data: {
      providerProfileId: profile.id,
      ownerUserId: worker.id,
      referralId: referral.id,
      clientUserId: client.id,
      clientDisplayName: "Kliendi salanimi",
      date: new Date("2018-06-11T00:00:00.000Z"),
      quantity: "1.00",
      status: "VOID",
      recordedFiscalYear: 2018,
      voidedAt: new Date("2018-06-11T11:00:00.000Z"),
      voidReason: "Sünteetiline tühistus",
      createdAt: new Date("2018-06-11T10:00:00.000Z")
    }
  });
  const draftEntry = await db.serviceEntry.create({
    data: {
      providerProfileId: profile.id,
      ownerUserId: worker.id,
      referralId: referral.id,
      clientUserId: client.id,
      clientDisplayName: "Kliendi salanimi",
      date: new Date("2018-06-12T00:00:00.000Z"),
      quantity: "0.50",
      status: "DRAFT",
      createdAt: new Date("2018-06-12T10:00:00.000Z")
    }
  });
  await db.serviceEntryCorrection.create({
    data: {
      entryId: finalEntry.id,
      actorUserId: manager.id,
      reason: "Sünteetiline parandus",
      previousValues: { note: "enne" },
      changedFields: ["note"],
      createdAt: new Date("2018-06-10T11:00:00.000Z")
    }
  });
  await db.serviceEntryCorrection.create({
    data: {
      entryId: voidEntry.id,
      actorUserId: manager.id,
      reason: "Sünteetiline tühistuse parandus",
      previousValues: { status: "FINAL" },
      changedFields: ["status"],
      createdAt: new Date("2018-06-11T11:00:00.000Z")
    }
  });
  const narrative = await db.serviceMonthlyNarrative.create({
    data: {
      providerProfileId: profile.id,
      referralId: referral.id,
      clientUserId: client.id,
      clientDisplayName: "Kliendi salanimi",
      clientExternalRef: "CLIENT-PRIVATE-REF",
      periodYear: 2018,
      periodMonth: 6,
      bodyText: "PRIVATE-NARRATIVE"
    }
  });
  const visit = await db.serviceVisit.create({
    data: {
      providerProfileId: profile.id,
      routeId: route.id,
      ownerUserId: worker.id,
      referralId: referral.id,
      clientUserId: client.id,
      clientDisplayName: "Kliendi salanimi",
      clientExternalRef: "CLIENT-PRIVATE-REF",
      address: "PRIVATE-ADDRESS",
      locationStamps: { arrived: { lat: 59.4, lng: 24.7 } },
      status: "COMPLETED",
      plannedStartAt: new Date("2018-06-10T08:00:00.000Z"),
      completedAt: new Date("2018-06-10T09:00:00.000Z"),
      serviceEntryId: finalEntry.id,
      assignedOrganizationId: organization.id
    }
  });
  await db.serviceLogTimeSample.create({
    data: { providerProfileId: profile.id, ownerUserId: worker.id, kind: "ENTRY_INPUT", seconds: 21, recordedAt: new Date("2018-06-10T10:00:00.000Z") }
  });
  const share = await db.serviceReportShare.create({
    data: {
      documentId: "synthetic-document",
      ownerUserId: worker.id,
      organizationId: organization.id,
      recipientMembershipId: membership.id,
      month: "2018-06",
      storagePath: "PRIVATE-STORAGE-PATH",
      fileName: "synthetic-report.pdf",
      mime: "application/pdf",
      sizeBytes: 123,
      sha256: "a".repeat(64),
      retentionEndsAt: new Date("2025-12-31T23:59:59.999Z")
    }
  });
  await db.serviceEntry.create({
    data: {
      providerProfileId: otherProfile.id,
      ownerUserId: otherOwner.id,
      clientDisplayName: "Teise omaniku klient",
      date: new Date("2026-08-13T00:00:00.000Z"),
      quantity: "1.00",
      note: "OTHER-OWNER-SECRET"
    }
  });
  return {
    worker, client, manager, otherOwner, organization, membership, profile, otherProfile,
    referral, route, finalEntry, voidEntry, draftEntry, narrative, visit, share
  };
}

async function main() {
  console.log("SOL-SLOG-J-05/06/07 — privaatsuse ja retention'i päris-DB sond\n");
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  const migrated = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: probeUrl.toString() },
    stdio: "pipe",
    shell: false
  });
  if (migrated.error) throw migrated.error;
  if (migrated.status !== 0) throw new Error(`prisma migrate deploy failed (${migrated.status})\n${migrated.stderr}`);
  const fixture = await createFixture();
  expect("suunamise lõpu muutmine uuendab retention-ankru", fixture.referral.retentionEndsAt.toISOString() === "2025-12-31T23:59:59.999Z", fixture.referral.retentionEndsAt.toISOString());

  const workerFiles = await collectServiceLogDataExport({ db, userId: fixture.worker.id });
  const workerRows = parseNdjson(workerFiles.find((file) => file.name.includes("professional")));
  const workerText = JSON.stringify(workerRows);
  expect("töötaja koopia sisaldab kirjet, parandust ja saatja jagamist", workerRows.some((row) => row.type === "entry" && row.corrections?.length === 1) && workerRows.some((row) => row.type === "report_share" && row.view === "sender"));
  expect("töötaja koopia välistab kliendi identiteedi, täpse asukoha ja storage path'i", !workerText.includes("CLIENT-PRIVATE-REF") && !workerText.includes("PRIVATE-ADDRESS") && !workerText.includes("PRIVATE-STORAGE-PATH"));
  expect("töötaja koopia ei leki teise omaniku kirjet", !workerText.includes("OTHER-OWNER-SECRET"));
  const clientFiles = await collectServiceLogDataExport({ db, userId: fixture.client.id });
  const clientRows = parseNdjson(clientFiles.find((file) => file.name.includes("client")));
  expect("kliendi koopia sisaldab tema kirjet ja kinnitust", clientRows.some((row) => row.type === "entry" && row.data.confirmedByClientAt));
  const managerFiles = await collectServiceLogDataExport({ db, userId: fixture.manager.id });
  const managerRows = parseNdjson(managerFiles.find((file) => file.name.includes("professional")));
  expect("jagatud aruande saaja saab metaandmete saajavaate ilma failiteeta", managerRows.some((row) => row.type === "report_share" && row.view === "recipient" && row.fileContent.includes("metadata_only")) && !JSON.stringify(managerRows).includes("PRIVATE-STORAGE-PATH"));

  const erasedAt = new Date("2025-12-30T00:00:00.000Z");
  await db.$executeRawUnsafe(`
    CREATE FUNCTION slog_probe_reject_client_delete() RETURNS trigger AS $$
    BEGIN
      IF OLD.email = 'client@slog-privacy.invalid' THEN
        RAISE EXCEPTION 'synthetic_user_delete_failure';
      END IF;
      RETURN OLD;
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER slog_probe_reject_client_delete
      BEFORE DELETE ON "User"
      FOR EACH ROW EXECUTE FUNCTION slog_probe_reject_client_delete();
  `);
  let rollbackObserved = false;
  try {
    await deleteUserAfterFinalPracticeSweep(fixture.client.id, db);
  } catch (error) {
    rollbackObserved = String(error?.message || error).includes("synthetic_user_delete_failure");
  }
  const rollbackReferral = await db.serviceReferral.findUnique({ where: { id: fixture.referral.id } });
  expect("User delete tõrge rollbackib samas tehingus Teenuspäeviku tombstone'id", rollbackObserved && rollbackReferral.clientUserId === fixture.client.id && rollbackReferral.clientErasedAt === null);
  await db.$executeRawUnsafe(`
    DROP TRIGGER slog_probe_reject_client_delete ON "User";
    DROP FUNCTION slog_probe_reject_client_delete();
  `);
  const clientDeleted = await deleteUserAfterFinalPracticeSweep(fixture.client.id, db);
  const clientErasure = { erased: clientDeleted.privacyCounts.serviceLogReferences };
  const [referralAfterClient, entryAfterClient, narrativeAfterClient, visitAfterClient] = await Promise.all([
    db.serviceReferral.findUnique({ where: { id: fixture.referral.id } }),
    db.serviceEntry.findUnique({ where: { id: fixture.finalEntry.id } }),
    db.serviceMonthlyNarrative.findUnique({ where: { id: fixture.narrative.id } }),
    db.serviceVisit.findUnique({ where: { id: fixture.visit.id } })
  ]);
  expect("kliendi kustutus nullib kõik neli kliendipinda ja seab tombstone'id", clientErasure.erased >= 6 && [referralAfterClient, entryAfterClient, narrativeAfterClient, visitAfterClient].every((row) => row.clientUserId === null && row.clientDisplayName === null && row.clientExternalRef === null && row.clientErasedAt instanceof Date), JSON.stringify(clientErasure));

  const workerDeleted = await deleteUserAfterFinalPracticeSweep(fixture.worker.id, db);
  const workerErasure = { erased: workerDeleted.privacyCounts.serviceLogReferences };
  const [entryAfterWorker, routeAfterWorker, visitAfterWorker, sampleAfterWorker, shareAfterWorker] = await Promise.all([
    db.serviceEntry.findUnique({ where: { id: fixture.finalEntry.id } }),
    db.serviceWorkRoute.findUnique({ where: { id: fixture.route.id } }),
    db.serviceVisit.findUnique({ where: { id: fixture.visit.id } }),
    db.serviceLogTimeSample.findFirst({ where: { providerProfileId: fixture.profile.id } }),
    db.serviceReportShare.findUnique({ where: { id: fixture.share.id } })
  ]);
  expect("töötaja kustutus nullib owner/route/visit/sample/share identiteedid", workerErasure.erased >= 7 && entryAfterWorker.ownerUserId === null && entryAfterWorker.ownerErasedAt && routeAfterWorker.workerUserId === null && routeAfterWorker.workerErasedAt && visitAfterWorker.ownerUserId === null && visitAfterWorker.ownerErasedAt && sampleAfterWorker.ownerUserId === null && shareAfterWorker.ownerUserId === null && shareAfterWorker.ownerErasedAt);

  const managerDeleted = await deleteUserAfterFinalPracticeSweep(fixture.manager.id, db);
  const managerErasure = { erased: managerDeleted.privacyCounts.serviceLogReferences };
  const shareAfterManager = await db.serviceReportShare.findUnique({ where: { id: fixture.share.id } });
  const correctionAfterManager = await db.serviceEntryCorrection.findFirst({ where: { entryId: fixture.finalEntry.id } });
  expect("juhi kustutus nullib parandaja ja jagamise saaja koos tombstone'iga", managerErasure.erased >= 3 && correctionAfterManager.actorUserId === null && correctionAfterManager.actorErasedAt && shareAfterManager.recipientMembershipId === null && shareAfterManager.recipientErasedAt);
  const retry = await eraseServiceLogUserReferences(fixture.manager.id, { db, now: new Date(erasedAt.getTime() + 1000) });
  expect("konto-kustutuse retry on idempotentne", retry.erased === 0, JSON.stringify(retry));

  const before = new Date("2025-12-31T23:59:59.998Z");
  const exact = new Date("2025-12-31T23:59:59.999Z");
  const after = new Date("2026-01-01T00:00:00.000Z");
  const beforeResult = await purgeExpiredServiceLogData({ db, now: before, batchSize: 2 });
  const exactResult = await purgeExpiredServiceLogData({ db, now: exact, batchSize: 2 });
  expect("piir-1 ei kustuta seitsmeaastase ankru ridu", sum(beforeResult) === beforeResult.timeSamples, JSON.stringify(beforeResult));
  expect("täpsel piiril ei kustutata veel ridu", sum(exactResult) === 0, JSON.stringify(exactResult));

  const concurrent = await Promise.all([
    purgeExpiredServiceLogData({ db, now: after, batchSize: 2 }),
    purgeExpiredServiceLogData({ db, now: after, batchSize: 2 })
  ]);
  const firstWave = concurrent.reduce((total, result) => total + sum(result), 0);
  expect("kaks samaaegset sweep'i lõpetavad veata ja kustutavad ainult olemasolevaid ridu", firstWave > 0 && firstWave <= 7, JSON.stringify(concurrent));
  let loops = 0;
  let result;
  do {
    result = await purgeExpiredServiceLogData({ db, now: after, batchSize: 2 });
    loops += 1;
  } while (sum(result) > 0 && loops < 10);
  const remaining = await Promise.all([
    db.serviceEntry.count({ where: { providerProfileId: fixture.profile.id } }),
    db.serviceEntryCorrection.count({ where: { entry: { providerProfileId: fixture.profile.id } } }),
    db.serviceMonthlyNarrative.count({ where: { providerProfileId: fixture.profile.id } }),
    db.serviceVisit.count({ where: { providerProfileId: fixture.profile.id } }),
    db.serviceWorkRoute.count({ where: { providerProfileId: fixture.profile.id } }),
    db.serviceReferral.count({ where: { providerProfileId: fixture.profile.id } }),
    db.serviceLogTimeSample.count({ where: { providerProfileId: fixture.profile.id } })
  ]);
  expect("piir+1 kustutab DRAFT/FINAL/VOID, parandusahela ja sõltuvused õiges järjekorras", remaining.every((count) => count === 0), JSON.stringify(remaining));
  expect("väike batch ei näljuta järgnevaid ridu", loops < 10 && sum(result) === 0, `${loops}`);

  console.log(`\n${passed}/${passed + failed} kontrolli läbis.`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect().catch(() => null);
    await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]).catch(() => null);
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null);
    await admin.end().catch(() => null);
    console.log("CLEANUP_OK temporary_database_removed");
  });
