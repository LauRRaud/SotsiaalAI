#!/usr/bin/env node
/** SOL-COV-01…04 — Kovisiooni identiteedi, kutse ja võistluse PostgreSQL-i sond. */

import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import { raceOnLockedRow, expectExactlyOneWinner } from "./probe-race-harness.mjs";
import { tombstoneCovisionParticipationForAccountDeletion } from "../lib/covision/accountDeletion.js";
import {
  covisionParticipantIdentityOr,
  findCovisionParticipantForActor,
  serializeCovisionWorkspaceCase
} from "../lib/covisionAccessShared.js";
import { applyCovisionSessionAction, getCovisionSessionForUser } from "../lib/covisionSession.js";
import {
  expireCovisionInvitations,
  queueCovisionInviteDelivery,
  runCovisionInviteDelivery
} from "../lib/covisionInviteDelivery.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");
const parsed = new URL(sourceUrl);
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname})`);
}
const databaseName = `sotsiaal_ai_covision_integrity_probe_${Date.now()}`;
if (!/^sotsiaal_ai_covision_integrity_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline andmebaasinimi");
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

function deploy() {
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: probeUrl.toString() }, stdio: "pipe", shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`prisma migrate deploy failed (${result.status})\n${result.stderr}`);
}

async function makeCase({ owner, participant, email, inviteStatus = "INVITED", expiresAt }) {
  const covisionCase = await db.covisionCase.create({
    data: {
      ownerId: owner.id,
      title: "Salajane sondjuhtum",
      status: "DRAFT",
      anonymityConfirmedAt: new Date(),
      sessionState: {
        create: { stage: 1, phase: "waiting_room", version: 0, settingsConfirmedAt: new Date() }
      }
    }
  });
  const session = await db.covisionSessionState.findUnique({ where: { covisionCaseId: covisionCase.id } });
  const ownerRow = await db.covisionParticipant.create({
    data: { covisionCaseId: covisionCase.id, userId: owner.id, email: owner.email, role: "OWNER", inviteStatus: "ACCEPTED" }
  });
  const participantRow = await db.covisionParticipant.create({
    data: {
      covisionCaseId: covisionCase.id,
      userId: participant?.id || null,
      email,
      role: "PARTICIPANT",
      inviteStatus,
      inviteExpiresAt: expiresAt || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      ...(inviteStatus === "ACCEPTED" ? { decisionAt: new Date() } : {})
    }
  });
  await Promise.all([
    db.covisionParticipantState.create({
      data: { sessionId: session.id, participantId: ownerRow.id, roleConfirmedAt: new Date(), agreementConfirmedAt: new Date(), readyAt: new Date() }
    }),
    db.covisionParticipantState.create({ data: { sessionId: session.id, participantId: participantRow.id } })
  ]);
  return { covisionCase, session, participant: participantRow };
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  deploy();
  expect("migratsioon loob kutse elutsükli väljad ja outboxi", true);

  const [owner, erasedUser, raceUser] = await Promise.all([
    db.user.create({ data: { email: "cov-owner@example.test", role: "SOCIAL_WORKER" } }),
    db.user.create({ data: { email: "reused@example.test", role: "SERVICE_PROVIDER" } }),
    db.user.create({ data: { email: "race@example.test", role: "SERVICE_PROVIDER" } })
  ]);

  const erased = await makeCase({ owner, participant: erasedUser, email: erasedUser.email, inviteStatus: "ACCEPTED" });
  await db.$transaction(async (tx) => {
    await tombstoneCovisionParticipationForAccountDeletion(erasedUser.id, { db: tx, now: new Date() });
    await tx.user.delete({ where: { id: erasedUser.id } });
  });
  const tombstone = await db.covisionParticipant.findUnique({ where: { id: erased.participant.id } });
  expect("COV-01 konto kustutus jätab identiteedita terminalse rea",
    tombstone.userId === null && tombstone.email === null && tombstone.inviteStatus === "EXPIRED" && Boolean(tombstone.identityErasedAt));
  const reused = await db.user.create({ data: { email: "reused@example.test", role: "SERVICE_PROVIDER" } });
  const erasedCase = await db.covisionCase.findUnique({
    where: { id: erased.covisionCase.id }, include: { participants: true }
  });
  expect("COV-01 sama e-post ei sobitu shared ligipääsuhelperis",
    findCovisionParticipantForActor(erasedCase, reused.id, reused.email) === null);
  expect("COV-01 sama e-post ei saa tööruumi kaarti",
    serializeCovisionWorkspaceCase(erasedCase, { userId: reused.id, email: reused.email }) === null);
  const sessionError = await getCovisionSessionForUser(
    { userId: reused.id, email: reused.email }, erased.covisionCase.id, { db }
  ).then(() => null, (error) => error);
  expect("COV-01 sama e-post ei saa sessiooni sisu", sessionError?.status === 404, String(sessionError?.status));
  expect("COV-01 legacy päring ei leia sama e-posti",
    await db.covisionParticipant.count({ where: { OR: covisionParticipantIdentityOr({ userId: reused.id, email: reused.email }) } }) === 0);

  const [erasedOwner, retainedParticipant] = await Promise.all([
    db.user.create({ data: { email: "erased-owner@example.test", role: "SOCIAL_WORKER" } }),
    db.user.create({ data: { email: "retained-participant@example.test", role: "SERVICE_PROVIDER" } })
  ]);
  const retained = await makeCase({
    owner: erasedOwner,
    participant: retainedParticipant,
    email: retainedParticipant.email,
    inviteStatus: "ACCEPTED"
  });
  const closure = await db.covisionClosure.create({
    data: {
      covisionCaseId: retained.covisionCase.id,
      ownerId: erasedOwner.id,
      assignedFollowUpUserId: erasedOwner.id,
      closedById: erasedOwner.id,
      generalizedTitle: "Üldistatud lõpetatud juhtum",
      workFocus: "Üldistatud fookus",
      selectedDirection: "Üldistatud suund",
      nextStep: "Üldistatud samm",
      timeframe: "14 päeva",
      progressMarker: "Üldistatud edenemine",
      ownerConfirmedAt: new Date(),
      retentionStatus: "RETAINED_SELECTED_OUTPUT",
      followUps: {
        create: {
          assignedToUserId: erasedOwner.id,
          scheduleLabel: "30.08.2026",
          responsibleParty: "owner",
          channel: "platform"
        }
      },
      ownerPackage: {
        create: {
          ownerId: erasedOwner.id,
          content: { privateMarker: "PRIVATE_OWNER_PACKAGE" },
          confirmedAt: new Date()
        }
      }
    }
  });
  await db.covisionAuditEvent.create({
    data: {
      covisionCaseId: retained.covisionCase.id,
      actorUserId: erasedOwner.id,
      actorRoleSnapshot: "OWNER",
      action: "CLOSURE_CREATED",
      entityType: "CLOSURE",
      entityId: closure.id,
      idempotencyKey: `${closure.id}:probe:created`
    }
  });
  await db.$transaction(async (tx) => {
    await tombstoneCovisionParticipationForAccountDeletion(erasedOwner.id, { db: tx, now: new Date() });
    await tx.user.delete({ where: { id: erasedOwner.id } });
  });
  const [retainedCase, retainedClosure, retainedFollowUp, retainedAudit] = await Promise.all([
    db.covisionCase.findUnique({ where: { id: retained.covisionCase.id } }),
    db.covisionClosure.findUnique({ where: { id: closure.id } }),
    db.covisionFollowUp.findFirst({ where: { closureId: closure.id } }),
    db.covisionAuditEvent.findUnique({ where: { idempotencyKey: `${closure.id}:probe:created` } })
  ]);
  expect("COV-06 omaniku kustutus säilitab juhtumi SetNull ja snapshotiga",
    retainedCase?.ownerId === null && retainedCase?.ownerRoleSnapshot === "SOCIAL_WORKER" && Boolean(retainedCase?.ownerErasedAt));
  expect("COV-06 minimaalne closure ja follow-up säilivad",
    retainedClosure?.ownerId === null && retainedFollowUp?.assignedToUserId === null);
  expect("COV-06 omaniku privaatpakett kustub",
    await db.covisionOwnerPackage.count({ where: { closureId: closure.id } }) === 0);
  expect("COV-08 audit säilib actor tombstone'i ja rollisnapshotiga",
    retainedAudit?.actorUserId === null && retainedAudit?.actorRoleSnapshot === "OWNER");

  const race = await makeCase({ owner, participant: raceUser, email: raceUser.email });
  await db.$transaction((tx) => queueCovisionInviteDelivery(tx, {
    participantId: race.participant.id, email: raceUser.email
  }));
  const restricted = await getCovisionSessionForUser(
    { userId: raceUser.id, email: raceUser.email }, race.covisionCase.id, { db }
  );
  expect("COV-03 kutsutu saab enne valmisolekut ainult minimaalse vaate",
    restricted.case.id === race.covisionCase.id && restricted.case.title === undefined && restricted.me.readOnly === true);
  await applyCovisionSessionAction(
    { userId: raceUser.id, email: raceUser.email }, race.covisionCase.id,
    { action: "CONFIRM_PARTICIPANT", expectedVersion: 0, payload: { roleConfirmed: true } }, { db }
  );
  await applyCovisionSessionAction(
    { userId: raceUser.id, email: raceUser.email }, race.covisionCase.id,
    { action: "CONFIRM_PARTICIPANT", expectedVersion: 1, payload: { agreementConfirmed: true } }, { db }
  );

  const lockSession = async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`covisionSession:${race.covisionCase.id}`}))`;
  };
  const raced = await raceOnLockedRow({
    prisma: db,
    lockRow: lockSession,
    first: () => applyCovisionSessionAction(
      { userId: owner.id, email: owner.email }, race.covisionCase.id,
      { action: "REVOKE_PARTICIPANT", expectedVersion: 2, payload: { participantId: race.participant.id } }, { db }
    ),
    second: () => applyCovisionSessionAction(
      { userId: raceUser.id, email: raceUser.email }, race.covisionCase.id,
      { action: "CONFIRM_PARTICIPANT", expectedVersion: 2, payload: { ready: true } }, { db }
    ),
    label: "COV-02 revoke vs accept",
    expect
  });
  expectExactlyOneWinner(expect, "COV-02 revoke vs accept", raced.resultA, raced.resultB);
  const raceFinal = await db.covisionParticipant.findUnique({ where: { id: race.participant.id } });
  expect("COV-02 valitud tühistamine võidab ja jätab auditväljad",
    raceFinal.inviteStatus === "EXPIRED" && Boolean(raceFinal.revokedAt) && raceFinal.revokedByUserId === owner.id);
  const revokedError = await getCovisionSessionForUser(
    { userId: raceUser.id, email: raceUser.email }, race.covisionCase.id, { db }
  ).then(() => null, (error) => error);
  expect("COV-02 avatud vahekaardi järgmine päring on kohe 404", revokedError?.status === 404);
  expect("COV-02 tühistamine katkestab ootel väljastuse",
    (await db.covisionInviteDelivery.findUnique({ where: { participantId: race.participant.id } })).status === "CANCELLED");
  const raceAudit = await db.covisionAuditEvent.findMany({
    where: { covisionCaseId: race.covisionCase.id }, orderBy: { occurredAt: "asc" }
  });
  expect("COV-08 role, agreement ja revoke on taastatavas auditijadas",
    ["CONFIRM_PARTICIPANT", "REVOKE_PARTICIPANT"].every((action) => raceAudit.some((event) => event.action === action))
    && raceAudit.length >= 3);

  const deliveryUser = await db.user.create({ data: { email: "delivery@example.test", role: "SERVICE_PROVIDER" } });
  const deliveryCase = await makeCase({ owner, participant: deliveryUser, email: deliveryUser.email });
  await db.$transaction((tx) => queueCovisionInviteDelivery(tx, {
    participantId: deliveryCase.participant.id, email: deliveryUser.email
  }));
  const sent = [];
  const previousFrom = process.env.EMAIL_FROM;
  process.env.EMAIL_FROM = "notifications@example.test";
  try {
    const delivery = await runCovisionInviteDelivery({
      db, now: new Date(), baseUrl: "https://probe.invalid",
      mailer: { async sendMail(message) { sent.push(message); } }
    });
    expect("COV-04 worker claimib ja saadab ühe püsiva kirja", delivery.sent === 1 && sent.length === 1);
    expect("COV-04 outbox jääb SENT tõendiga",
      (await db.covisionInviteDelivery.findUnique({ where: { participantId: deliveryCase.participant.id } })).status === "SENT");
  } finally {
    if (previousFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = previousFrom;
  }

  const expiredUser = await db.user.create({ data: { email: "expired@example.test", role: "SERVICE_PROVIDER" } });
  const expiredCase = await makeCase({
    owner, participant: expiredUser, email: expiredUser.email,
    expiresAt: new Date(Date.now() - 60_000)
  });
  await db.$transaction((tx) => queueCovisionInviteDelivery(tx, {
    participantId: expiredCase.participant.id, email: expiredUser.email
  }));
  const expiry = await expireCovisionInvitations({ db, now: new Date() });
  expect("COV-02 aegumissweep muudab kutse terminalseks", expiry.expired === 1);
  expect("COV-02 aegumine tühistab saatmata kirja",
    (await db.covisionInviteDelivery.findUnique({ where: { participantId: expiredCase.participant.id } })).status === "CANCELLED");

  console.log(`PROBE_OK ${passed}/${passed}`);
} finally {
  await db.$disconnect().catch(() => null);
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`, [databaseName]).catch(() => null);
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null);
  await admin.end().catch(() => null);
  console.log("CLEANUP_OK temporary_database_removed");
}
