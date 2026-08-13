#!/usr/bin/env node
/** SOL-CW-19 — CaseWorkAssist konto-kustutuse leping päris PostgreSQL-is. */
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";

import { PrismaClient } from "../generated/prisma/client.ts";
import { collectCaseWorkDataExport } from "../lib/casework/dataExport.js";
import { deleteUserAfterFinalPracticeSweep } from "../lib/privacy/effectivePracticeAccountCleanup.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");
const parsed = new URL(sourceUrl);
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname})`);
}

const databaseName = `sotsiaal_ai_casework_delete_probe_${Date.now()}`;
if (!/^sotsiaal_ai_casework_delete_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline andmebaasinimi");
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
    data: { email: `${tag}@casework-delete.invalid`, role: "SOCIAL_WORKER", emailVerified: new Date() }
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

async function membership(organizationId, person, tag, seatRole = "SOCIAL_WORKER") {
  return db.organizationMembership.create({
    data: { organizationId, userId: person.id, status: "ACTIVE", seatRole, jobTitle: `Sünteetiline ${tag}` }
  });
}

async function ownerGrant(membershipId) {
  return db.organizationCapabilityGrant.create({
    data: { membershipId, capability: "ORG_OWNER", scopeType: "ORGANIZATION", reason: "synthetic_probe" }
  });
}

async function liveWork(organizationId, membershipId, tag) {
  const inbox = await db.organizationInboxItem.create({
    data: { organizationId, sourceType: "PRE_INQUIRY", sourceId: `source-${tag}`, status: "ASSIGNED" }
  });
  const assignment = await db.organizationWorkAssignment.create({
    data: { inboxItemId: inbox.id, assigneeMembershipId: membershipId, status: "PENDING" }
  });
  return { inbox, assignment };
}

async function closeWork({ inbox, assignment }) {
  const endedAt = new Date("2026-08-13T12:00:00.000Z");
  await db.organizationWorkAssignment.update({
    where: { id: assignment.id },
    data: { status: "ENDED", endedAt }
  });
  await db.organizationInboxItem.update({
    where: { id: inbox.id },
    data: { status: "CLOSED", closedAt: endedAt, closedReason: "synthetic_handover_complete" }
  });
}

async function caseWithEvidence(ownerUserId, tag, retentionState) {
  const createdAt = new Date(`2026-0${retentionState === "ACTIVE" ? "6" : retentionState === "READ_ONLY" ? "5" : "4"}-01T09:00:00.000Z`);
  const casework = await db.caseWorkAssist.create({
    data: {
      ownerUserId,
      clientDisplayName: `Klient ${tag}`,
      clientExternalRef: `REF-${tag}`,
      externalSystem: "STAR2",
      externalReference: `STAR-${tag}`,
      retentionState,
      createdAt
    }
  });
  const note = await db.caseWorkMeetingNote.create({
    data: { caseWorkAssistId: casework.id, meetingAt: createdAt, createdAt }
  });
  const entry = await db.caseWorkMeetingNoteEntry.create({
    data: {
      meetingNoteId: note.id,
      layer: "KOKKULEPE",
      text: `Sünteetiline kokkulepe ${tag}`,
      provenance: "TOOTAJA_TAHELEPANEK",
      createdAt,
      updatedAt: createdAt
    }
  });
  const revision = await db.caseWorkMeetingNoteEntryRevision.create({
    data: {
      entryId: entry.id,
      meetingNoteId: note.id,
      kind: "CORRECTION",
      layer: "KOKKULEPE",
      text: `Sünteetiline varasem kokkulepe ${tag}`,
      provenance: "TOOTAJA_TAHELEPANEK",
      ordinal: 0,
      revision: 1,
      reason: "Sünteetiline täpsustus",
      actorUserId: ownerUserId,
      createdAt
    }
  });
  const draft = await db.caseWorkDraft.create({
    data: {
      caseWorkAssistId: casework.id,
      draftType: "EESMARGI_SONASTUS",
      transferState: "ULE_KANTUD",
      transferredAt: createdAt,
      createdAt,
      updatedAt: createdAt
    }
  });
  const field = await db.caseWorkDraftField.create({
    data: {
      draftId: draft.id,
      fieldKey: "EESMARK",
      text: `Sünteetiline mustand ${tag}`,
      provenance: "TOOTAJA_TAHELEPANEK",
      createdAt,
      updatedAt: createdAt
    }
  });
  const transfer = await db.caseWorkTransferEvent.create({
    data: {
      caseWorkAssistId: casework.id,
      draftId: draft.id,
      ownerUserId,
      actorUserId: ownerUserId,
      kind: "MARKED_AS_TRANSFERRED",
      draftType: "EESMARGI_SONASTUS",
      transferStateAtEvent: "VALMIS_ULEKANDEKS",
      fieldKeys: [],
      createdAt
    }
  });
  const retention = [];
  if (retentionState !== "ACTIVE") {
    retention.push(await db.caseWorkRetentionAudit.create({
      data: {
        caseWorkAssistId: casework.id,
        ownerUserId,
        actorUserId: ownerUserId,
        fromState: "ACTIVE",
        toState: "READ_ONLY",
        reason: "Sünteetiline töö lõpetatud",
        createdAt
      }
    }));
  }
  if (retentionState === "ARCHIVED") {
    retention.push(await db.caseWorkRetentionAudit.create({
      data: {
        caseWorkAssistId: casework.id,
        ownerUserId,
        actorUserId: ownerUserId,
        fromState: "READ_ONLY",
        toState: "ARCHIVED",
        reason: "Sünteetiline arhiiv",
        createdAt: new Date(createdAt.getTime() + 1000)
      }
    }));
  }
  const erasure = await db.caseWorkClientErasureAudit.create({
    data: {
      caseWorkAssistId: casework.id,
      ownerUserId,
      actorUserId: ownerUserId,
      actorKind: "USER",
      reason: "Sünteetiline kliendiviite kontroll",
      createdAt
    }
  });
  return { casework, note, entry, revision, draft, field, transfer, retention, erasure };
}

async function caseTreeCounts(ownerUserId) {
  const cases = await db.caseWorkAssist.findMany({ where: { ownerUserId }, select: { id: true } });
  const ids = cases.map((item) => item.id);
  return {
    cases: cases.length,
    notes: await db.caseWorkMeetingNote.count({ where: { caseWorkAssistId: { in: ids } } }),
    entries: await db.caseWorkMeetingNoteEntry.count({ where: { meetingNote: { caseWorkAssistId: { in: ids } } } }),
    revisions: await db.caseWorkMeetingNoteEntryRevision.count({ where: { entry: { meetingNote: { caseWorkAssistId: { in: ids } } } } }),
    drafts: await db.caseWorkDraft.count({ where: { caseWorkAssistId: { in: ids } } }),
    fields: await db.caseWorkDraftField.count({ where: { draft: { caseWorkAssistId: { in: ids } } } }),
    transfers: await db.caseWorkTransferEvent.count({ where: { caseWorkAssistId: { in: ids } } }),
    retentionAudits: await db.caseWorkRetentionAudit.count({ where: { caseWorkAssistId: { in: ids } } }),
    erasureAudits: await db.caseWorkClientErasureAudit.count({ where: { caseWorkAssistId: { in: ids } } })
  };
}

async function main() {
  console.log("SOL-CW-19 — konto kustutuse ja juhtumitöö päris-DB sond\n");
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

  const foreign = await user("foreign-worker");
  await caseWithEvidence(foreign.id, "foreign", "ACTIVE");

  const worker = await user("last-owner");
  const org = await organization("viimase omaniku org");
  const workerMembership = await membership(org.id, worker, "viimane omanik");
  await ownerGrant(workerMembership.id);
  const states = ["ACTIVE", "READ_ONLY", "ARCHIVED"];
  for (const state of states) await caseWithEvidence(worker.id, state.toLowerCase(), state);
  const technicalTrace = await db.dataDeletionJob.create({
    data: {
      targetUserId: worker.id,
      actorUserId: worker.id,
      action: "USER_DELETE",
      resourceType: "User",
      resourceId: worker.id,
      status: "pending"
    }
  });

  const exported = await collectCaseWorkDataExport({ db, userId: worker.id });
  const exportText = JSON.stringify(exported);
  expect("andmekoopia sisaldab omaniku ACTIVE/READ_ONLY/ARCHIVED juhtumeid", exported.length === 3 && states.every((state) => exported.some((item) => item.retentionState === state)));
  expect("andmekoopia sisaldab märkme-, ülekande- ja audititõendeid", exportText.includes("Sünteetiline kokkulepe") && exportText.includes("MARKED_AS_TRANSFERRED") && exportText.includes("Sünteetiline töö lõpetatud") && exportText.includes("Sünteetiline kliendiviite kontroll"));
  expect("andmekoopia välistab võõra juhtumi ning konto- ja tegija-ID-d", !exportText.includes("foreign") && !exportText.includes(worker.id) && !exportText.includes(foreign.id));

  const beforeBlock = await caseTreeCounts(worker.id);
  let lastOwnerError = null;
  try {
    await deleteUserAfterFinalPracticeSweep(worker.id, db);
  } catch (error) {
    lastOwnerError = error;
  }
  expect("viimase omaniku kustutus peatub parandatava 409-ga", lastOwnerError?.status === 409 && lastOwnerError?.messageKey === "org.errors.last_owner_cannot_leave");
  expect("viimase omaniku tõrge rollbackib konto ja kogu juhtumipuu", await db.user.count({ where: { id: worker.id } }) === 1 && JSON.stringify(await caseTreeCounts(worker.id)) === JSON.stringify(beforeBlock));

  const successor = await user("successor");
  const successorMembership = await membership(org.id, successor, "järeltulija", "SERVICE_PROVIDER");
  await ownerGrant(successorMembership.id);
  const deleted = await deleteUserAfterFinalPracticeSweep(worker.id, db);
  const membershipAfter = await db.organizationMembership.findUnique({ where: { id: workerMembership.id } });
  const deletedTree = await caseTreeCounts(worker.id);
  expect("retry kustutab konto ja kõik isikliku juhtumitöö kihid", deleted.id === worker.id && Object.values(deletedTree).every((count) => count === 0), JSON.stringify(deletedTree));
  expect("organisatsioon ja järeltulija säilivad, liikmesus muutub isikuta tombstone'iks", await db.organization.count({ where: { id: org.id } }) === 1 && await db.user.count({ where: { id: successor.id } }) === 1 && membershipAfter?.status === "ENDED" && membershipAfter?.userId === null && Boolean(membershipAfter?.userErasedAt));
  expect("viimase SOCIAL_WORKER-i lahkumine on lubatud, kui organisatsioonil jääb omanik", successorMembership.seatRole === "SERVICE_PROVIDER" && membershipAfter?.seatRole === "SOCIAL_WORKER");
  expect("üldine kustutustöö tõend ja organisatsiooni audit jäävad alles", await db.dataDeletionJob.count({ where: { id: technicalTrace.id } }) === 1 && await db.dataAuditLog.count({ where: { resourceId: workerMembership.id, action: { in: ["org.member_ended", "org.member_identity_erased"] } } }) === 2);

  const liveUser = await user("live-work");
  const liveOrg = await organization("elava töö org");
  const liveMembership = await membership(liveOrg.id, liveUser, "lahkuv töötaja");
  const liveOwnerMembership = await membership(liveOrg.id, successor, "säiliv omanik", "SERVICE_PROVIDER");
  await ownerGrant(liveOwnerMembership.id);
  const liveCase = await caseWithEvidence(liveUser.id, "live-work", "ACTIVE");
  const work = await liveWork(liveOrg.id, liveMembership.id, "casework-delete");
  const beforeLiveBlock = await caseTreeCounts(liveUser.id);
  let liveError = null;
  try {
    await deleteUserAfterFinalPracticeSweep(liveUser.id, db);
  } catch (error) {
    liveError = error;
  }
  expect("elav PENDING töö peatab kustutuse parandatava 409-ga", liveError?.status === 409 && liveError?.messageKey === "org.errors.membership_has_live_work" && liveError?.details?.liveWork === 1);
  expect("elava töö tõrge rollbackib konto, liikmesuse, töö ja juhtumi", await db.user.count({ where: { id: liveUser.id } }) === 1 && await db.organizationMembership.count({ where: { id: liveMembership.id, status: "ACTIVE" } }) === 1 && await db.organizationWorkAssignment.count({ where: { id: work.assignment.id, status: "PENDING" } }) === 1 && JSON.stringify(await caseTreeCounts(liveUser.id)) === JSON.stringify(beforeLiveBlock));

  await closeWork(work);
  await deleteUserAfterFinalPracticeSweep(liveUser.id, db);
  const historicalWork = await db.organizationWorkAssignment.findUnique({ where: { id: work.assignment.id } });
  expect("pärast töö lõpetamist õnnestub retry ja isiklik juhtum kustub", await db.user.count({ where: { id: liveUser.id } }) === 0 && await db.caseWorkAssist.count({ where: { id: liveCase.casework.id } }) === 0);
  expect("organisatsiooni ametlik tööajalugu säilib lõpetatud liikmesuse küljes", historicalWork?.status === "ENDED" && historicalWork?.assigneeMembershipId === liveMembership.id && await db.organization.count({ where: { id: liveOrg.id } }) === 1);

  const caseworkFks = await db.$queryRaw`
    SELECT c.relname::text AS child, p.relname::text AS parent, con.confdeltype::text AS on_delete
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_class p ON p.oid = con.confrelid
     WHERE con.contype = 'f' AND (c.relname LIKE 'CaseWork%' OR p.relname LIKE 'CaseWork%')`;
  const ownerCascade = caseworkFks.some((row) => row.child === "CaseWorkAssist" && row.parent === "User" && row.on_delete === "c");
  const children = caseworkFks.filter((row) => row.parent === "CaseWorkAssist");
  expect("DB jõustab omaniku kaskaadi ja kõik otsesed CaseWorkAssist lapsed kaskaadivad", ownerCascade && children.length > 0 && children.every((row) => row.on_delete === "c"), `${children.filter((row) => row.on_delete === "c").length}/${children.length}`);

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
