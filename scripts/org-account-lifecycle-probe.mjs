#!/usr/bin/env node
/** SOL-ORG-18/19 — konto offboarding ja isiku andmekoopia päris PostgreSQL-is. */
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import { deleteUserAfterFinalPracticeSweep } from "../lib/privacy/effectivePracticeAccountCleanup.js";
import { offboardOrganizationMembershipsForAccountDeletion } from "../lib/org/accountDeletion.js";
import { collectOrganizationMembershipDataExport } from "../lib/org/dataExport.js";
import { assignSeat } from "../lib/org/seats.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");
const parsed = new URL(sourceUrl);
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname})`);
}
const databaseName = `sotsiaal_ai_org_lifecycle_probe_${Date.now()}`;
if (!/^sotsiaal_ai_org_lifecycle_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline andmebaasinimi");
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

async function user(tag) {
  return db.user.create({
    data: { email: `${tag}@org-lifecycle.invalid`, role: "SOCIAL_WORKER", emailVerified: new Date() }
  });
}

async function organization(tag) {
  return db.organization.create({
    data: {
      displayName: `Sünteetiline ${tag}`,
      legalKind: "MUNICIPALITY",
      status: "ACTIVE",
      verifiedAt: new Date(),
      activatedAt: new Date()
    }
  });
}

async function membership(orgId, person, tag, status = "ACTIVE") {
  return db.organizationMembership.create({
    data: {
      organizationId: orgId,
      userId: person.id,
      status,
      seatRole: "SOCIAL_WORKER",
      jobTitle: `Sünteetiline ${tag}`,
      endedAt: status === "ENDED" ? new Date("2025-01-01T00:00:00.000Z") : null
    }
  });
}

async function ownerGrant(membershipId) {
  return db.organizationCapabilityGrant.create({
    data: { membershipId, capability: "ORG_OWNER", scopeType: "ORGANIZATION", reason: "synthetic_probe" }
  });
}

async function liveOrHistoricalWork(orgId, membershipId, tag, status) {
  const inbox = await db.organizationInboxItem.create({
    data: {
      organizationId: orgId,
      sourceType: "PRE_INQUIRY",
      sourceId: `source-${tag}`,
      status: status === "ENDED" ? "CLOSED" : "ASSIGNED",
      closedAt: status === "ENDED" ? new Date("2025-01-02T00:00:00.000Z") : null,
      closedReason: status === "ENDED" ? "synthetic_history" : null
    }
  });
  return db.organizationWorkAssignment.create({
    data: {
      inboxItemId: inbox.id,
      assigneeMembershipId: membershipId,
      status,
      endedAt: status === "ENDED" ? new Date("2025-01-02T00:00:00.000Z") : null
    }
  });
}

async function seatPlan(orgId, tag, limit = 5) {
  return db.organizationSeatPlan.create({
    data: {
      organizationId: orgId,
      seatRole: "SOCIAL_WORKER",
      seatLimit: limit,
      unitPriceCents: 799,
      source: "PILOT",
      status: "ACTIVE",
      priceReason: `synthetic-${tag}`
    }
  });
}

function proxyTransaction(intercept) {
  return {
    $transaction: (work) => db.$transaction(async (tx) => work(intercept(tx)))
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function main() {
  console.log("SOL-ORG-18/19 — konto elutsükli päris-DB sond\n");
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  const migrated = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: probeUrl.toString() }, stdio: "pipe", shell: false
  });
  if (migrated.error) throw migrated.error;
  if (migrated.status !== 0) throw new Error(`prisma migrate deploy failed (${migrated.status})\n${migrated.stderr}`);

  const lastOwner = await user("last-owner");
  const lastOrg = await organization("viimase omaniku org");
  const lastMembership = await membership(lastOrg.id, lastOwner, "viimane omanik");
  await ownerGrant(lastMembership.id);
  let lastError = null;
  try { await deleteUserAfterFinalPracticeSweep(lastOwner.id, db); } catch (error) { lastError = error; }
  expect("viimase omaniku kustutus peatub parandatava 409 põhjusega", lastError?.status === 409 && lastError?.messageKey === "org.errors.last_owner_cannot_leave");
  expect("viimase omaniku tõrge rollbackib User ja liikmesuse", await db.user.count({ where: { id: lastOwner.id } }) === 1 && await db.organizationMembership.count({ where: { id: lastMembership.id, status: "ACTIVE" } }) === 1);

  const target = await user("target");
  const successor = await user("successor");
  const ownerOfShare = await user("share-owner");
  const org = await organization("kahe omaniku org");
  const targetMembership = await membership(org.id, target, "lahkuja");
  const successorMembership = await membership(org.id, successor, "järeltulija");
  await Promise.all([ownerGrant(targetMembership.id), ownerGrant(successorMembership.id)]);
  const plan = await seatPlan(org.id, "offboard");
  const activeSeat = await db.organizationSeatAssignment.create({
    data: { seatPlanId: plan.id, membershipId: targetMembership.id, status: "ACTIVE", assignedByUserId: successor.id }
  });
  const historicalAssignment = await liveOrHistoricalWork(org.id, targetMembership.id, "history", "ENDED");
  const supportShare = await db.wellbeingSupportShare.create({
    data: {
      ownerUserId: ownerOfShare.id,
      organizationId: org.id,
      recipientMembershipId: targetMembership.id,
      sharedSnapshotJson: { synthetic: true },
      contentDeletionDueAt: new Date("2027-01-01T00:00:00.000Z")
    }
  });
  const reportShare = await db.serviceReportShare.create({
    data: {
      documentId: "org-probe-document",
      ownerUserId: ownerOfShare.id,
      organizationId: org.id,
      recipientMembershipId: targetMembership.id,
      month: "2026-08",
      storagePath: "synthetic/org-probe.pdf",
      fileName: "org-probe.pdf",
      mime: "application/pdf",
      sizeBytes: 10,
      sha256: "b".repeat(64),
      retentionEndsAt: new Date("2033-12-31T23:59:59.999Z")
    }
  });

  const [beforeFile] = await collectOrganizationMembershipDataExport({ db, userId: target.id });
  const beforeText = beforeFile.content.toString("utf8");
  expect("andmekoopia sisaldab küsija aktiivset liikmesust, õigust ja kohta", beforeText.includes(targetMembership.id) && beforeText.includes("ORG_OWNER") && beforeText.includes(activeSeat.id));
  expect("andmekoopia ei sisalda teise liikme identiteeti ega töövara", !beforeText.includes(successor.id) && !beforeText.includes(successor.email) && !beforeText.includes(historicalAssignment.id));

  const deleted = await deleteUserAfterFinalPracticeSweep(target.id, db);
  const [memberAfter, seatAfter, assignmentAfter, supportAfter, reportAfter] = await Promise.all([
    db.organizationMembership.findUnique({ where: { id: targetMembership.id } }),
    db.organizationSeatAssignment.findUnique({ where: { id: activeSeat.id } }),
    db.organizationWorkAssignment.findUnique({ where: { id: historicalAssignment.id } }),
    db.wellbeingSupportShare.findUnique({ where: { id: supportShare.id } }),
    db.serviceReportShare.findUnique({ where: { id: reportShare.id } })
  ]);
  expect("kahe omaniku konto kustub ja liikmesus jääb ENDED tombstone'ina", deleted.id === target.id && memberAfter.userId === null && memberAfter.userErasedAt && memberAfter.status === "ENDED");
  expect("aktiivne koht lõpetatakse, lõpetatud tööajalugu säilib", seatAfter.status === "ENDED" && seatAfter.endedAt && assignmentAfter.status === "ENDED" && assignmentAfter.assigneeMembershipId === targetMembership.id);
  expect("toe- ja aruandejagamise read ei kaskaadi", supportAfter?.id === supportShare.id && reportAfter?.id === reportShare.id);
  expect("konto kustutuse loendurid ja append-only audit on olemas", deleted.privacyCounts.organizationMembershipsEnded === 1 && deleted.privacyCounts.organizationMembershipsErased === 1 && await db.dataAuditLog.count({ where: { resourceId: targetMembership.id, action: { in: ["org.member_ended", "org.member_identity_erased"] } } }) === 2);
  const retry = await offboardOrganizationMembershipsForAccountDeletion(target.id, { db });
  expect("offboarding retry on idempotentne", retry.membershipsEnded === 0 && retry.membershipsErased === 0);

  const liveUser = await user("live-work");
  const liveOrg = await organization("elava töö org");
  const liveMembership = await membership(liveOrg.id, liveUser, "elav töö");
  const liveSuccessor = await membership(liveOrg.id, successor, "elava töö omanik");
  await ownerGrant(liveSuccessor.id);
  await liveOrHistoricalWork(liveOrg.id, liveMembership.id, "live", "PENDING");
  let liveError = null;
  try { await deleteUserAfterFinalPracticeSweep(liveUser.id, db); } catch (error) { liveError = error; }
  expect("elav töö peatab konto kustutuse ja jätab seose aktiivseks", liveError?.status === 409 && liveError?.details?.liveWork === 1 && await db.user.count({ where: { id: liveUser.id } }) === 1 && await db.organizationMembership.count({ where: { id: liveMembership.id, status: "ACTIVE" } }) === 1);

  // assign võtab liikmesuse luku esimesena; delete ootab ja lõpetab äsja loodud koha.
  const raceUser = await user("race-assign-first");
  const raceOrg = await organization("assign enne delete");
  const raceMembership = await membership(raceOrg.id, raceUser, "võistlev liige");
  const raceOwner = await membership(raceOrg.id, successor, "võistlev omanik");
  await ownerGrant(raceOwner.id);
  const racePlan = await seatPlan(raceOrg.id, "race-a");
  const assignLocked = deferred();
  const releaseAssign = deferred();
  const assignDb = proxyTransaction((tx) => new Proxy(tx, {
    get(targetDb, key) {
      if (key !== "organizationMembership") return targetDb[key];
      return new Proxy(targetDb.organizationMembership, {
        get(model, method) {
          if (method !== "findFirst") return model[method];
          return async (...args) => {
            const row = await model.findFirst(...args);
            assignLocked.resolve();
            await releaseAssign.promise;
            return row;
          };
        }
      });
    }
  }));
  const assignPromise = assignSeat(raceOrg.id, { actorUserId: successor.id, seatPlanId: racePlan.id, membershipId: raceMembership.id }, { db: assignDb });
  await assignLocked.promise;
  const deleteAfterAssign = deleteUserAfterFinalPracticeSweep(raceUser.id, db);
  releaseAssign.resolve();
  const [raceSeat] = await Promise.all([assignPromise, deleteAfterAssign]);
  const raceSeatAfter = await db.organizationSeatAssignment.findUnique({ where: { id: raceSeat.id } });
  expect("assign-vs-delete serialiseerub: loodud koht lõpetatakse, orvu ei jää", raceSeatAfter.status === "ENDED" && await db.user.count({ where: { id: raceUser.id } }) === 0);

  // delete hoiab liikmesuse lukku; hilisem assign näeb pärast commit'i ENDED seisu.
  const deleteRaceUser = await user("race-delete-first");
  const deleteRaceOrg = await organization("delete enne assign");
  const deleteRaceMembership = await membership(deleteRaceOrg.id, deleteRaceUser, "kustuv liige");
  const deleteRaceOwner = await membership(deleteRaceOrg.id, successor, "kustutuse omanik");
  await ownerGrant(deleteRaceOwner.id);
  const deleteRacePlan = await seatPlan(deleteRaceOrg.id, "race-b");
  const beforeDelete = deferred();
  const releaseDelete = deferred();
  const deleteDb = proxyTransaction((tx) => new Proxy(tx, {
    get(targetDb, key) {
      if (key !== "user") return targetDb[key];
      return new Proxy(targetDb.user, {
        get(model, method) {
          if (method !== "delete") return model[method];
          return async (...args) => {
            beforeDelete.resolve();
            await releaseDelete.promise;
            return model.delete(...args);
          };
        }
      });
    }
  }));
  const deleteFirst = deleteUserAfterFinalPracticeSweep(deleteRaceUser.id, deleteDb);
  await beforeDelete.promise;
  const lateAssign = assignSeat(deleteRaceOrg.id, { actorUserId: successor.id, seatPlanId: deleteRacePlan.id, membershipId: deleteRaceMembership.id }, { db });
  releaseDelete.resolve();
  await deleteFirst;
  let assignError = null;
  try { await lateAssign; } catch (error) { assignError = error; }
  expect("delete-vs-assign serialiseerub: hiline assign saab parandatava konflikti", assignError?.status === 409 && assignError?.messageKey === "org.errors.membership_not_active" && await db.organizationSeatAssignment.count({ where: { membershipId: deleteRaceMembership.id, status: "ACTIVE" } }) === 0);

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
