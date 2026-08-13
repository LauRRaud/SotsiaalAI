#!/usr/bin/env node
/** SOL-SUP-01/02/04 — supervisiooni oleku- ja võistluspiiride PostgreSQL-i sond. */

import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import { raceOnLockedRow } from "./probe-race-harness.mjs";
import { issueGrant } from "../lib/supervision/grants.js";
import {
  acceptContractVersion,
  activateContractVersion,
  createContractVersion,
  createProcess,
  getProcessDetail,
  inviteParticipant,
  leaveProcess,
  respondToInvite
} from "../lib/supervision/service.js";
import { closeProcess } from "../lib/supervision/closure.js";
import { shareTopic } from "../lib/supervision/topics.js";
import { approveSummary, createSummary, submitSummary } from "../lib/supervision/summaries.js";
import { planMeeting } from "../lib/supervision/meetings.js";
import { runSupervisionSweep } from "../lib/supervision/sweep.js";
import { createPrivateItem } from "../lib/supervision/privateItems.js";
import { deleteUserAfterFinalPracticeSweep } from "../lib/privacy/effectivePracticeAccountCleanup.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");
const parsed = new URL(sourceUrl);
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname})`);
}
const databaseName = `sotsiaal_ai_supervision_integrity_probe_${Date.now()}`;
if (!/^sotsiaal_ai_supervision_integrity_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline andmebaasinimi");
const adminUrl = new URL(parsed);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const probeUrl = new URL(parsed);
probeUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }), log: [] });
let passed = 0;

function expect(label, condition, detail = "") {
  if (!condition) throw new Error(`PROBE_FAIL ${label}${detail ? ` (${detail})` : ""}`);
  passed += 1;
  console.log(`  PASS  ${label}`);
}

async function rejects(label, promise, code) {
  const result = await Promise.resolve(promise).then(() => null, (error) => error);
  expect(label, result?.code === code, result?.code || "no error");
}

function deploy() {
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: probeUrl.toString() }, stdio: "pipe", shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`prisma migrate deploy failed (${result.status})\n${result.stderr}`);
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  deploy();
  const now = new Date("2026-08-13T08:00:00.000Z");
  const [adminUser, supervisor, osA, osB] = await Promise.all([
    db.user.create({ data: { email: "sup-admin@example.test", role: "ADMIN", isAdmin: true } }),
    db.user.create({ data: { email: "sup-supervisor@example.test", role: "SOCIAL_WORKER" } }),
    db.user.create({ data: { email: "sup-os-a@example.test", role: "SOCIAL_WORKER" } }),
    db.user.create({ data: { email: "sup-os-b@example.test", role: "SERVICE_PROVIDER" } })
  ]);
  const SV = { user: { id: supervisor.id, role: supervisor.role } };
  const OS_A = { user: { id: osA.id, role: osA.role } };
  const OS_B = { user: { id: osB.id, role: osB.role } };
  await issueGrant({ actorUserId: adminUser.id, userId: supervisor.id, grantBasis: "probe" }, { db, now });

  async function makeActive(title, members = [{ user: osA, session: OS_A }]) {
    const processView = await createProcess(
      { session: SV, input: { type: members.length > 1 ? "GROUP" : "INDIVIDUAL", title } },
      { db, now }
    );
    const contract = await createContractVersion(
      { processId: processView.id, session: SV, input: { body: `${title} contract` } },
      { db, now }
    );
    await activateContractVersion({
      processId: processView.id,
      versionId: contract.contractVersion.id,
      session: SV,
      input: { expectedVersion: processView.version }
    }, { db, now });
    const participationIds = {};
    for (const member of members) {
      const detail = await inviteParticipant(
        { processId: processView.id, session: SV, input: { userId: member.user.id } },
        { db, now }
      );
      const participation = detail.participants.find((row) => row.userId === member.user.id);
      participationIds[member.user.id] = participation.id;
      await respondToInvite({
        participationId: participation.id,
        session: member.session,
        input: { action: "accept", contractVersionId: contract.contractVersion.id }
      }, { db, now });
    }
    return { processId: processView.id, contractVersionId: contract.contractVersion.id, participationIds };
  }

  const lockProcess = (processId) => async (tx) => {
    await tx.$queryRaw`SELECT id FROM "SupervisionProcess" WHERE id = ${processId} FOR UPDATE`;
  };

  const closedTopic = await makeActive("closed-topic");
  const topicDetail = await getProcessDetail({ processId: closedTopic.processId, session: SV }, { db });
  const topicRace = await raceOnLockedRow({
    prisma: db,
    lockRow: lockProcess(closedTopic.processId),
    first: () => closeProcess({
      processId: closedTopic.processId,
      session: SV,
      input: { expectedVersion: topicDetail.version, generalizedTitle: "closed" }
    }, { db, now }),
    second: () => shareTopic({
      processId: closedTopic.processId,
      session: OS_A,
      input: { audience: "PROCESS", title: "late", body: "must not persist" }
    }, { db, now }),
    label: "SUP-01 close vs topic",
    expect
  });
  expect("SUP-01 close wins queued topic write", !topicRace.resultA.error && topicRace.resultB.error?.code === "ALREADY_CLOSED");
  expect("SUP-01 closed process has no shared raw topics", await db.supervisionSharedTopic.count({
    where: { processId: closedTopic.processId }
  }) === 0);

  const closedInvite = await makeActive("closed-invite");
  const invited = await inviteParticipant(
    { processId: closedInvite.processId, session: SV, input: { userId: osB.id } },
    { db, now }
  );
  const pendingId = invited.participants.find((row) => row.userId === osB.id).id;
  const inviteDetail = await getProcessDetail({ processId: closedInvite.processId, session: SV }, { db });
  const inviteRace = await raceOnLockedRow({
    prisma: db,
    lockRow: lockProcess(closedInvite.processId),
    first: () => closeProcess({
      processId: closedInvite.processId,
      session: SV,
      input: { expectedVersion: inviteDetail.version, generalizedTitle: "closed" }
    }, { db, now }),
    second: () => respondToInvite({
      participationId: pendingId,
      session: OS_B,
      input: { action: "accept", contractVersionId: closedInvite.contractVersionId }
    }, { db, now }),
    label: "SUP-01 close vs invite",
    expect
  });
  expect("SUP-01 close wins queued invite response", !inviteRace.resultA.error && inviteRace.resultB.error?.code === "ALREADY_CLOSED");
  expect("SUP-01 pending participation remains INVITED", (await db.supervisionParticipation.findUnique({
    where: { id: pendingId }
  })).status === "INVITED");
  await rejects("SUP-01 closed contract acceptance is rejected", acceptContractVersion({
    processId: closedInvite.processId,
    session: OS_A,
    input: { contractVersionId: closedInvite.contractVersionId }
  }, { db, now }), "ALREADY_CLOSED");

  const contracts = await makeActive("contracts");
  const contractView = await getProcessDetail({ processId: contracts.processId, session: SV }, { db });
  const v2 = await createContractVersion(
    { processId: contracts.processId, session: SV, input: { body: "v2" } },
    { db, now }
  );
  await activateContractVersion({
    processId: contracts.processId,
    versionId: v2.contractVersion.id,
    session: SV,
    input: { expectedVersion: contractView.version }
  }, { db, now });
  const afterV2 = await getProcessDetail({ processId: contracts.processId, session: SV }, { db });
  await rejects("SUP-02 superseded version is final", activateContractVersion({
    processId: contracts.processId,
    versionId: contracts.contractVersionId,
    session: SV,
    input: { expectedVersion: afterV2.version }
  }, { db, now }), "CONTRACT_VERSION_FINAL");
  expect("SUP-02 v2 remains active", (await db.supervisionProcess.findUnique({
    where: { id: contracts.processId }
  })).activeContractVersionId === v2.contractVersion.id);

  const leaving = await makeActive("leaving");
  const summary = await createSummary(
    { processId: leaving.processId, session: SV, input: { kind: "FINAL", body: "final" } },
    { db, now }
  );
  await submitSummary(
    { summaryId: summary.summary.id, session: SV, input: { expectedVersion: summary.summary.version } },
    { db, now }
  );
  const leaveRace = await raceOnLockedRow({
    prisma: db,
    lockRow: lockProcess(leaving.processId),
    first: () => leaveProcess({ participationId: leaving.participationIds[osA.id], session: OS_A }, { db, now }),
    second: () => approveSummary({ summaryId: summary.summary.id, session: OS_A }, { db, now }),
    label: "SUP-04 leave vs approve",
    expect
  });
  expect("SUP-04 leave wins queued approval", !leaveRace.resultA.error && leaveRace.resultB.error?.status === 404);
  const [leftRow, approvedSummary] = await Promise.all([
    db.supervisionParticipation.findUnique({ where: { id: leaving.participationIds[osA.id] } }),
    db.supervisionSummary.findUnique({ where: { id: summary.summary.id } })
  ]);
  expect("SUP-04 last participant is LEFT with timestamp", leftRow.status === "LEFT" && Boolean(leftRow.leftAt));
  expect("SUP-04 last participant does not strand pending summary", approvedSummary.status === "APPROVED");
  expect("SUP-04 departure audit exists exactly once", await db.supervisionAuditEvent.count({
    where: { processId: leaving.processId, action: "PARTICIPANT_LEFT" }
  }) === 1);
  expect("SUP-04 supervisor notification exists", await db.notificationEvent.count({
    where: { type: "SUPERVISION_PARTICIPANT_LEFT", sourceId: leaving.participationIds[osA.id], userId: supervisor.id }
  }) === 1);

  const upcoming = await makeActive("upcoming");
  const upcomingMeetings = [];
  for (let seq = 1; seq <= 3; seq += 1) {
    upcomingMeetings.push(await db.supervisionMeeting.create({
      data: {
        processId: upcoming.processId,
        seq,
        plannedAt: new Date(now.getTime() + seq * 60_000),
        status: "PLANNED"
      }
    }));
  }
  const upcomingFirst = await runSupervisionSweep({ db, now, batchSize: 1 });
  expect("SUP-05 stable pagination covers more than one batch", upcomingFirst.meetingsConsidered === 3);
  expect("SUP-05 fresh members receive all upcoming events", upcomingFirst.notificationsCreated === 6);
  const upcomingRepeat = await runSupervisionSweep({ db, now, batchSize: 1 });
  expect("SUP-05 repeat is deduplicated", upcomingRepeat.notificationsCreated === 0 && upcomingRepeat.notificationsExisting === 6);
  const movedAt = new Date(now.getTime() + 10 * 60_000);
  await db.supervisionMeeting.update({ where: { id: upcomingMeetings[0].id }, data: { plannedAt: movedAt } });
  const upcomingMoved = await runSupervisionSweep({ db, now, batchSize: 1 });
  expect("SUP-05 reschedule creates a new exact-time reminder", upcomingMoved.notificationsCreated === 2);
  await db.supervisionMeeting.update({ where: { id: upcomingMeetings[1].id }, data: { status: "CANCELLED" } });
  await db.supervisionProcess.update({ where: { id: upcoming.processId }, data: { status: "CLOSED", closedAt: now } });
  const closedMeeting = await db.supervisionMeeting.create({
    data: { processId: upcoming.processId, seq: 4, plannedAt: new Date(now.getTime() + 20 * 60_000), status: "PLANNED" }
  });
  await runSupervisionSweep({ db, now, batchSize: 1 });
  expect("SUP-05 CANCELLED and CLOSED candidates do not notify", await db.notificationEvent.count({
    where: { type: "SUPERVISION_MEETING_UPCOMING", sourceId: closedMeeting.id }
  }) === 0);

  const perOwner = await makeActive("per-owner-contract", [
    { user: osA, session: OS_A },
    { user: osB, session: OS_B }
  ]);
  const beforeOwnerV2 = await getProcessDetail({ processId: perOwner.processId, session: SV }, { db });
  const ownerV2 = await createContractVersion(
    { processId: perOwner.processId, session: SV, input: { body: "per-owner v2" } },
    { db, now }
  );
  await activateContractVersion({
    processId: perOwner.processId,
    versionId: ownerV2.contractVersion.id,
    session: SV,
    input: { expectedVersion: beforeOwnerV2.version }
  }, { db, now });
  await acceptContractVersion({
    processId: perOwner.processId,
    session: OS_A,
    input: { contractVersionId: ownerV2.contractVersion.id }
  }, { db, now });
  const beforeOwnerClose = await getProcessDetail({ processId: perOwner.processId, session: SV }, { db });
  await closeProcess({
    processId: perOwner.processId,
    session: SV,
    input: { expectedVersion: beforeOwnerClose.version, generalizedTitle: "per owner" }
  }, { db, now });
  const ownerOutcomes = await db.supervisionPersonalOutcome.findMany({ where: { processId: perOwner.processId } });
  const ownerBody = new Map(ownerOutcomes.map((row) => [row.ownerUserId, row.contentJson.lastAcceptedContractBody]));
  expect("SUP-06 accepted v2 owner keeps v2", ownerBody.get(osA.id) === "per-owner v2");
  expect("SUP-06 stale owner keeps proven v1", ownerBody.get(osB.id) === "per-owner-contract contract");

  const staleShare = await makeActive("stale-share");
  const beforeShareV2 = await getProcessDetail({ processId: staleShare.processId, session: SV }, { db });
  const shareV2 = await createContractVersion(
    { processId: staleShare.processId, session: SV, input: { body: "share v2" } },
    { db, now }
  );
  const shareRace = await raceOnLockedRow({
    prisma: db,
    lockRow: lockProcess(staleShare.processId),
    first: () => activateContractVersion({
      processId: staleShare.processId,
      versionId: shareV2.contractVersion.id,
      session: SV,
      input: { expectedVersion: beforeShareV2.version }
    }, { db, now }),
    second: () => shareTopic({
      processId: staleShare.processId,
      session: OS_A,
      input: { audience: "PROCESS", title: "stale", body: "must not persist" }
    }, { db, now }),
    label: "SUP-07 activate vs share",
    expect
  });
  expect("SUP-07 queued share rechecks fresh OS_STALE role", !shareRace.resultA.error && shareRace.resultB.error?.code === "CONTRACT_NOT_ACCEPTED");
  expect("SUP-07 forbidden queued topic is absent", await db.supervisionSharedTopic.count({
    where: { processId: staleShare.processId }
  }) === 0);

  const cardinality = await makeActive("cardinality");
  const finalRace = await raceOnLockedRow({
    prisma: db,
    lockRow: lockProcess(cardinality.processId),
    first: () => createSummary({
      processId: cardinality.processId, session: SV, input: { kind: "FINAL", body: "final A" }
    }, { db, now }),
    second: () => createSummary({
      processId: cardinality.processId, session: SV, input: { kind: "FINAL", body: "final B" }
    }, { db, now }),
    label: "SUP-08 concurrent FINAL",
    expect
  });
  expect("SUP-08 concurrent FINAL returns one stable conflict", !finalRace.resultA.error && finalRace.resultB.error?.code === "FINAL_SUMMARY_EXISTS");
  expect("SUP-08 exactly one live FINAL persists", await db.supervisionSummary.count({
    where: { processId: cardinality.processId, kind: "FINAL", status: { not: "DISCARDED" } }
  }) === 1);
  await rejects("SUP-08 database rejects direct duplicate FINAL", db.supervisionSummary.create({
    data: {
      processId: cardinality.processId,
      kind: "FINAL",
      body: "direct duplicate",
      status: "DRAFT",
      createdByUserId: supervisor.id
    }
  }), "P2002");

  const meeting = await planMeeting({ processId: cardinality.processId, session: SV, input: {} }, { db, now });
  const meetingRace = await raceOnLockedRow({
    prisma: db,
    lockRow: lockProcess(cardinality.processId),
    first: () => createSummary({
      processId: cardinality.processId,
      session: SV,
      input: { kind: "MEETING", meetingId: meeting.meeting.id, body: "meeting A" }
    }, { db, now }),
    second: () => createSummary({
      processId: cardinality.processId,
      session: SV,
      input: { kind: "MEETING", meetingId: meeting.meeting.id, body: "meeting B" }
    }, { db, now }),
    label: "SUP-08 concurrent MEETING",
    expect
  });
  expect("SUP-08 concurrent MEETING returns one stable conflict", !meetingRace.resultA.error && meetingRace.resultB.error?.code === "SUMMARY_EXISTS_FOR_MEETING");
  expect("SUP-08 exactly one live MEETING summary persists", await db.supervisionSummary.count({
    where: { meetingId: meeting.meeting.id, status: { not: "DISCARDED" } }
  }) === 1);

  const [erasedSupervisor, erasedMember] = await Promise.all([
    db.user.create({ data: { email: "sup-erased-supervisor@example.test", role: "SOCIAL_WORKER" } }),
    db.user.create({ data: { email: "sup-erased-member@example.test", role: "SERVICE_PROVIDER" } })
  ]);
  const ERASED_SV = { user: { id: erasedSupervisor.id, role: erasedSupervisor.role } };
  const ERASED_OS = { user: { id: erasedMember.id, role: erasedMember.role } };
  await issueGrant({ actorUserId: adminUser.id, userId: erasedSupervisor.id, grantBasis: "erase-probe" }, { db, now });

  async function makeErasureProcess(title) {
    const processView = await createProcess(
      { session: ERASED_SV, input: { type: "INDIVIDUAL", title } },
      { db, now }
    );
    const contract = await createContractVersion(
      { processId: processView.id, session: ERASED_SV, input: { body: `${title} contract` } },
      { db, now }
    );
    await activateContractVersion({
      processId: processView.id,
      versionId: contract.contractVersion.id,
      session: ERASED_SV,
      input: { expectedVersion: processView.version }
    }, { db, now });
    const detail = await inviteParticipant(
      { processId: processView.id, session: ERASED_SV, input: { userId: erasedMember.id } },
      { db, now }
    );
    const participationId = detail.participants.find((row) => row.userId === erasedMember.id).id;
    await respondToInvite({
      participationId,
      session: ERASED_OS,
      input: { action: "accept", contractVersionId: contract.contractVersion.id }
    }, { db, now });
    return { processId: processView.id, participationId, contractVersionId: contract.contractVersion.id };
  }

  const erasureActive = await makeErasureProcess("erasure-active");
  const supervisorTopic = await shareTopic({
    processId: erasureActive.processId,
    session: ERASED_SV,
    input: { audience: "PROCESS", title: "supervisor topic", body: "shared evidence" }
  }, { db, now });
  const memberTopic = await shareTopic({
    processId: erasureActive.processId,
    session: ERASED_OS,
    input: { audience: "PROCESS", title: "member topic", body: "shared evidence" }
  }, { db, now });
  await createPrivateItem({
    processId: erasureActive.processId,
    session: ERASED_SV,
    input: { kind: "PRIVATE_NOTE", body: "supervisor private" }
  }, { db });
  await createPrivateItem({
    processId: erasureActive.processId,
    session: ERASED_OS,
    input: { kind: "PRIVATE_NOTE", body: "member private" }
  }, { db });

  const erasureClosed = await makeErasureProcess("erasure-closed");
  const erasureSummary = await createSummary({
    processId: erasureClosed.processId,
    session: ERASED_SV,
    input: { kind: "FINAL", body: "approved evidence" }
  }, { db, now });
  await submitSummary({
    summaryId: erasureSummary.summary.id,
    session: ERASED_SV,
    input: { expectedVersion: erasureSummary.summary.version }
  }, { db, now });
  await approveSummary({ summaryId: erasureSummary.summary.id, session: ERASED_OS }, { db, now });
  const erasureBeforeClose = await getProcessDetail({ processId: erasureClosed.processId, session: ERASED_SV }, { db });
  await closeProcess({
    processId: erasureClosed.processId,
    session: ERASED_SV,
    input: { expectedVersion: erasureBeforeClose.version, generalizedTitle: "closed evidence" }
  }, { db, now });

  await deleteUserAfterFinalPracticeSweep(erasedSupervisor.id, db);
  const activeAfterSupervisorErase = await db.supervisionProcess.findUnique({ where: { id: erasureActive.processId } });
  const supervisorTopicAfterErase = await db.supervisionSharedTopic.findUnique({ where: { id: supervisorTopic.topic.id } });
  expect("SUP-09 supervisor deletion preserves shared process", activeAfterSupervisorErase?.supervisorId === null
    && Boolean(activeAfterSupervisorErase.supervisorErasedAt));
  expect("SUP-09 supervisor-authored topic becomes identity-free tombstone",
    supervisorTopicAfterErase?.authorSupervisorUserId === null && Boolean(supervisorTopicAfterErase.authorErasedAt));
  expect("SUP-09 contract and content-free audit survive supervisor deletion",
    await db.supervisionContractVersion.count({ where: { processId: erasureActive.processId } }) === 1
    && await db.supervisionAuditEvent.count({ where: { processId: erasureActive.processId } }) > 0);
  expect("SUP-09 supervisor private M6 and M12 delete with account",
    await db.supervisionPrivateItem.count({ where: { ownerUserId: erasedSupervisor.id } }) === 0
    && await db.supervisionPersonalOutcome.count({ where: { ownerUserId: erasedSupervisor.id } }) === 0);
  expect("SUP-09 closure and approved summary survive supervisor deletion",
    await db.supervisionClosure.count({ where: { processId: erasureClosed.processId } }) === 1
    && await db.supervisionSummary.count({ where: { id: erasureSummary.summary.id, status: "APPROVED" } }) === 1);

  await deleteUserAfterFinalPracticeSweep(erasedMember.id, db);
  const participationAfterErase = await db.supervisionParticipation.findUnique({ where: { id: erasureActive.participationId } });
  expect("SUP-09 participant deletion preserves identity-free participation",
    participationAfterErase?.userId === null && Boolean(participationAfterErase.userErasedAt));
  expect("SUP-09 participant acceptance and approval evidence survive",
    await db.supervisionContractAcceptance.count({ where: { participationId: erasureActive.participationId } }) === 1
    && await db.supervisionSummaryApproval.count({ where: { participationId: erasureClosed.participationId } }) === 1);
  expect("SUP-09 participant-authored shared topic survives",
    await db.supervisionSharedTopic.count({ where: { id: memberTopic.topic.id } }) === 1);
  expect("SUP-09 participant private M6 and M12 delete with account",
    await db.supervisionPrivateItem.count({ where: { ownerUserId: erasedMember.id } }) === 0
    && await db.supervisionPersonalOutcome.count({ where: { ownerUserId: erasedMember.id } }) === 0);

  console.log(`PROBE_OK ${passed}/${passed}`);
} finally {
  await db.$disconnect().catch(() => null);
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`, [databaseName]).catch(() => null);
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null);
  await admin.end().catch(() => null);
  console.log("CLEANUP_OK temporary_database_removed");
}
