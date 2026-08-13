import assert from "node:assert/strict";
import test from "node:test";

import { createMentoringDb, resetIds, seedUser } from "./harness.js";
import { runMentoringSweep } from "../../lib/mentoring/sweep.js";
import { toMentoringWorkspaceDescriptor, listWorkspaces } from "../../lib/workspaces/adapters/mentoringAdapter.js";

const DAY = 24 * 60 * 60 * 1000;

function baseDb() {
  resetIds();
  const db = createMentoringDb();
  seedUser(db, "mentor");
  seedUser(db, "mentee");
  return db;
}

test("sweep expires PENDING requests past 30d and is idempotent", async () => {
  const db = baseDb();
  const now = new Date("2026-07-18T10:00:00.000Z");
  db.store.mentorProfile.push({
    id: "prof1", userId: "mentor", origin: "SELF", status: "ACTIVE", capacity: "OPEN",
    displayName: "M", version: 0
  });
  db.store.mentoringRequest.push({
    id: "req1", menteeId: "mentee", mentorProfileId: "prof1", mentorUserId: "mentor",
    message: "x", status: "PENDING", version: 0,
    expiresAt: new Date(now.getTime() - DAY), createdAt: new Date(now.getTime() - 31 * DAY),
    updatedAt: new Date(now.getTime() - 31 * DAY)
  });
  const first = await runMentoringSweep({ db, now });
  assert.equal(first.requestsExpired, 1);
  assert.equal(db.store.mentoringRequest.find((r) => r.id === "req1").status, "EXPIRED");
  const second = await runMentoringSweep({ db, now });
  assert.equal(second.requestsExpired, 0, "second pass is a no-op");
});

test("sweep closes DRAFT relations older than 30d without both confirmations", async () => {
  const db = baseDb();
  const now = new Date("2026-07-18T10:00:00.000Z");
  db.store.mentoringRelation.push({
    id: "rel1", mentorUserId: "mentor", menteeUserId: "mentee", status: "DRAFT",
    version: 0, agreementVersion: 0, lastActivityAt: new Date(now.getTime() - 31 * DAY),
    createdAt: new Date(now.getTime() - 31 * DAY), updatedAt: new Date(now.getTime() - 31 * DAY)
  });
  const result = await runMentoringSweep({ db, now });
  assert.equal(result.draftRelationsClosed, 1);
  const relation = db.store.mentoringRelation.find((r) => r.id === "rel1");
  assert.equal(relation.status, "CLOSED");
  assert.equal(relation.closeReasonKey, "not_started");
});

test("sweep inactivity: 90d check, then 30d close; idempotent per phase", async () => {
  const db = baseDb();
  const now = new Date("2026-07-18T10:00:00.000Z");
  db.store.mentoringRelation.push({
    id: "rel2", mentorUserId: "mentor", menteeUserId: "mentee", status: "ACTIVE",
    version: 0, agreementVersion: 1, inactivityCheckAt: null,
    lastActivityAt: new Date(now.getTime() - 91 * DAY),
    createdAt: new Date(now.getTime() - 200 * DAY), updatedAt: new Date(now.getTime() - 91 * DAY)
  });
  const phase1 = await runMentoringSweep({ db, now });
  assert.equal(phase1.inactivityChecksSent, 1);
  let relation = db.store.mentoringRelation.find((r) => r.id === "rel2");
  assert.ok(relation.inactivityCheckAt);
  assert.equal(relation.status, "ACTIVE");

  // Same day re-run: check already sent → no duplicate.
  const phase1b = await runMentoringSweep({ db, now });
  assert.equal(phase1b.inactivityChecksSent, 0);

  // 31 days later with no response → auto close.
  const later = new Date(now.getTime() + 31 * DAY);
  const phase2 = await runMentoringSweep({ db, now: later });
  assert.equal(phase2.inactivityRelationsClosed, 1);
  relation = db.store.mentoringRelation.find((r) => r.id === "rel2");
  assert.equal(relation.status, "CLOSED");
  assert.equal(relation.closeReasonKey, "inactive");
});

test("sweep anonymizes terminal request messages after 90d", async () => {
  const db = baseDb();
  const now = new Date("2026-07-18T10:00:00.000Z");
  db.store.mentoringRequest.push({
    id: "req2", menteeId: "mentee", mentorProfileId: "prof1", mentorUserId: "mentor",
    message: "Isiklik tekst", status: "DECLINED", version: 1, anonymizedAt: null,
    expiresAt: new Date(now.getTime() - 100 * DAY), createdAt: new Date(now.getTime() - 100 * DAY),
    updatedAt: new Date(now.getTime() - 91 * DAY)
  });
  const result = await runMentoringSweep({ db, now });
  assert.equal(result.messagesAnonymized, 1);
  const request = db.store.mentoringRequest.find((r) => r.id === "req2");
  assert.equal(request.message, null);
  assert.ok(request.anonymizedAt);
});

test("SOL-MENT-02: sweep marks stale external consent once and notifies admins", async () => {
  const db = baseDb();
  seedUser(db, "admin", "ADMIN");
  const now = new Date("2026-08-13T10:00:00.000Z");
  db.store.mentorProfile.push({
    id: "external-stale", userId: null, origin: "ESTA_IMPORT", status: "EXTERNAL_REFERENCE",
    consentStatus: "CONSENTED", consentEvidenceType: "WRITTEN", consentEvidenceRef: "proof",
    consentCapturedAt: new Date("2025-08-13T09:59:59.000Z"), checkedAt: new Date("2025-08-13T09:59:59.000Z"),
    displayName: "External", version: 0, createdAt: now, updatedAt: now
  });
  const first = await runMentoringSweep({ db, now });
  assert.equal(first.externalConsentsStaled, 1);
  assert.equal(db.store.mentorProfile[0].consentStatus, "STALE");
  assert.equal(db.store.notificationEvent.filter((event) => event.userId === "admin").length, 1);
  const second = await runMentoringSweep({ db, now });
  assert.equal(second.externalConsentsStaled, 0);
  assert.equal(db.store.notificationEvent.filter((event) => event.userId === "admin").length, 1);
});

test("SOL-MENT-07: upcoming sweep paginates 2.5 batches, rerun is quiet, same-day reschedule emits once", async () => {
  const db = baseDb();
  const now = new Date("2026-08-13T10:00:00.000Z");
  db.store.mentoringRelation.push({
    id: "rel-bulk", mentorUserId: "mentor", menteeUserId: "mentee", status: "ACTIVE",
    version: 0, agreementVersion: 1, lastActivityAt: now, createdAt: now, updatedAt: now
  });
  for (let index = 0; index < 125; index += 1) {
    db.store.mentoringMeeting.push({
      id: `bulk-${String(index).padStart(3, "0")}`,
      relationId: "rel-bulk", occurredAt: new Date(now.getTime() + (index + 1) * 60_000),
      status: "PLANNED", mode: "EXTERNAL", version: 0, createdAt: now, updatedAt: now
    });
  }
  const first = await runMentoringSweep({ db, now, batchSize: 50 });
  assert.equal(first.meetingsUpcoming, 125);
  assert.equal(first.notificationsCreated, 250);
  const second = await runMentoringSweep({ db, now, batchSize: 50 });
  assert.equal(second.meetingsUpcoming, 0);
  assert.equal(second.notificationsCreated, 0);

  db.store.mentoringMeeting[0].occurredAt = new Date(now.getTime() + 30 * 60_000);
  const third = await runMentoringSweep({ db, now, batchSize: 50 });
  assert.equal(third.meetingsUpcoming, 1);
  assert.equal(third.notificationsCreated, 2);
});

test("K1 adapter maps relation → descriptor (no content leaked)", async () => {
  const now = new Date("2026-07-18T10:00:00.000Z");
  const descriptor = toMentoringWorkspaceDescriptor({
    id: "rel9", mentorUserId: "mentor", menteeUserId: "mentee", status: "ACTIVE",
    goalSummary: "SALADUS", agreementText: "SALADUS", lastActivityAt: now, updatedAt: now,
    meetings: []
  });
  assert.equal(descriptor.ref.kind, "mentoring_process");
  assert.equal(descriptor.ownerId, "mentee");
  assert.equal(descriptor.lifecycle, "ACTIVE");
  assert.equal(descriptor.goal, null);
  assert.ok(!JSON.stringify(descriptor).includes("SALADUS"));
});

test("K1 adapter listWorkspaces is participant-scoped", async () => {
  const db = baseDb();
  const now = new Date("2026-07-18T10:00:00.000Z");
  db.store.mentoringRelation.push({
    id: "rel10", mentorUserId: "mentor", menteeUserId: "mentee", status: "ACTIVE",
    version: 0, lastActivityAt: now, updatedAt: now
  });
  const mine = await listWorkspaces("mentor", { db });
  assert.equal(mine.length, 1);
  const strangers = await listWorkspaces("stranger", { db });
  assert.equal(strangers.length, 0);
});
