import assert from "node:assert/strict";
import test from "node:test";

import { createMentoringDb, resetIds, seedUser } from "./harness.js";
import {
  getOwnMentorProfile,
  submitOwnMentorProfile,
  upsertOwnMentorProfile
} from "../../lib/mentoring/profileService.js";
import { listMentorCatalog, getCatalogProfile } from "../../lib/mentoring/catalogService.js";
import {
  createMentoringRequest,
  respondMentoringRequest,
  cancelMentoringRequest
} from "../../lib/mentoring/requestService.js";
import {
  acceptMentoringAgreement,
  closeMentoringRelation,
  getMentoringRelation,
  previewMentoringClose,
  proposeMentoringAgreement
} from "../../lib/mentoring/relationService.js";
import { createMentoringMeeting, updateMentoringMeeting } from "../../lib/mentoring/meetingService.js";
import {
  confirmMentoringSummary,
  createMentoringSummary,
  submitMentoringSummary,
  superseedMentoringSummary
} from "../../lib/mentoring/summaryService.js";
import { createMentoringNote } from "../../lib/mentoring/noteService.js";
import {
  handoffWellbeingDraftToMentoring,
  recallMentoringPreparation,
  shareMentoringPreparation,
  markMentoringPreparationOpened
} from "../../lib/mentoring/preparationService.js";
import {
  reviewMentorProfile,
  setExternalConsentStatus,
  importExternalMentorSeed
} from "../../lib/mentoring/adminService.js";
import { serializeCatalogProfile } from "../../lib/mentoring/serializers.js";

const MENTOR = { userId: "mentor", role: "SOCIAL_WORKER" };
const MENTEE = { userId: "mentee", role: "SOCIAL_WORKER" };
const STRANGER = { userId: "stranger", role: "SOCIAL_WORKER" };
const ADMIN = { userId: "admin", role: "ADMIN" };

function baseDb() {
  resetIds();
  const db = createMentoringDb();
  seedUser(db, "mentor");
  seedUser(db, "mentee");
  seedUser(db, "stranger");
  seedUser(db, "admin", "ADMIN");
  return db;
}

async function activeMentorProfile(db, now) {
  await upsertOwnMentorProfile(MENTOR, {
    displayName: "Mentor Malle",
    bioShort: "Kogenud sotsiaaltöötaja",
    fields: ["Lastekaitse"]
  }, { db, now });
  await submitOwnMentorProfile(MENTOR, { db, now });
  const profile = db.store.mentorProfile.find((p) => p.userId === "mentor");
  await reviewMentorProfile(ADMIN, profile.id, "APPROVE", {}, { db, now });
  return db.store.mentorProfile.find((p) => p.userId === "mentor");
}

async function activatedRelation(db, now) {
  await activeMentorProfile(db, now);
  const profile = db.store.mentorProfile.find((p) => p.userId === "mentor");
  const request = await createMentoringRequest(MENTEE, {
    mentorProfileId: profile.id,
    message: "Sooviksin arutada rollivahetust"
  }, { db, now });
  const accept = await respondMentoringRequest(MENTOR, request.id, "ACCEPT", { db, now });
  const relationId = accept.relationId;
  await proposeMentoringAgreement(MENTOR, relationId, {
    agreementText: "Kohtume kord kuus, konfidentsiaalselt.",
    expectedVersion: db.store.mentoringRelation.find((r) => r.id === relationId).version
  }, { db, now });
  await acceptMentoringAgreement(MENTEE, relationId, { agreementVersion: 1 }, { db, now });
  return relationId;
}

test("profile state machine: DRAFT → PENDING_REVIEW → ACTIVE; moderation gate", async () => {
  const db = baseDb();
  const now = new Date("2026-07-18T10:00:00.000Z");
  await upsertOwnMentorProfile(MENTOR, {
    displayName: "Mentor Malle",
    bioShort: "Kogemus",
    fields: ["Lastekaitse"]
  }, { db, now });
  let profile = await getOwnMentorProfile(MENTOR, { db });
  assert.equal(profile.status, "DRAFT");

  await submitOwnMentorProfile(MENTOR, { db, now });
  profile = await getOwnMentorProfile(MENTOR, { db });
  assert.equal(profile.status, "PENDING_REVIEW");

  // Not visible in catalog before approval.
  let catalog = await listMentorCatalog(MENTEE, {}, { db });
  assert.equal(catalog.length, 0);

  const stored = db.store.mentorProfile.find((p) => p.userId === "mentor");
  await reviewMentorProfile(ADMIN, stored.id, "APPROVE", {}, { db, now });
  catalog = await listMentorCatalog(MENTEE, {}, { db });
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].canRequest, true);
});

test("profile submit requires completeness", async () => {
  const db = baseDb();
  await upsertOwnMentorProfile(MENTOR, { displayName: "Vaid nimi" }, { db });
  await assert.rejects(() => submitOwnMentorProfile(MENTOR, { db }), /PROFILE_INCOMPLETE|invalid/);
});

test("request dedupe: only one PENDING per pair (partial unique)", async () => {
  const db = baseDb();
  const now = new Date("2026-07-18T10:00:00.000Z");
  const profile = await activeMentorProfile(db, now);
  await createMentoringRequest(MENTEE, { mentorProfileId: profile.id, message: "Esimene" }, { db, now });
  await assert.rejects(
    () => createMentoringRequest(MENTEE, { mentorProfileId: profile.id, message: "Teine" }, { db, now }),
    /REQUEST_ALREADY_PENDING|conflict/
  );
  assert.equal(db.store.mentoringRequest.filter((r) => r.status === "PENDING").length, 1);
});

test("request rate-limit: max 5 pending", async () => {
  const db = baseDb();
  const now = new Date("2026-07-18T10:00:00.000Z");
  // Create 5 distinct active mentors + pending requests.
  for (let i = 0; i < 5; i += 1) {
    const uid = `m${i}`;
    seedUser(db, uid);
    await upsertOwnMentorProfile({ userId: uid, role: "SOCIAL_WORKER" }, {
      displayName: `Mentor ${i}`, bioShort: "x", fields: ["Lastekaitse"]
    }, { db, now });
    await submitOwnMentorProfile({ userId: uid, role: "SOCIAL_WORKER" }, { db, now });
    const p = db.store.mentorProfile.find((mp) => mp.userId === uid);
    await reviewMentorProfile(ADMIN, p.id, "APPROVE", {}, { db, now });
    await createMentoringRequest(MENTEE, { mentorProfileId: p.id, message: "Soov" }, { db, now });
  }
  const profile = await activeMentorProfile(db, now);
  await assert.rejects(
    () => createMentoringRequest(MENTEE, { mentorProfileId: profile.id, message: "Kuues" }, { db, now }),
    /rate_limited|TOO_MANY_PENDING/
  );
});

test("self-request forbidden", async () => {
  const db = baseDb();
  const now = new Date("2026-07-18T10:00:00.000Z");
  const profile = await activeMentorProfile(db, now);
  await assert.rejects(
    () => createMentoringRequest(MENTOR, { mentorProfileId: profile.id, message: "iseendale" }, { db, now }),
    /SELF_REQUEST_FORBIDDEN|invalid/
  );
});

test("relation ACTIVE only with both agreement confirmations (version-based)", async () => {
  const db = baseDb();
  const now = new Date("2026-07-18T10:00:00.000Z");
  const profile = await activeMentorProfile(db, now);
  const request = await createMentoringRequest(MENTEE, { mentorProfileId: profile.id, message: "Soov" }, { db, now });
  const accept = await respondMentoringRequest(MENTOR, request.id, "ACCEPT", { db, now });
  const relationId = accept.relationId;
  let relation = db.store.mentoringRelation.find((r) => r.id === relationId);
  assert.equal(relation.status, "DRAFT");

  await proposeMentoringAgreement(MENTOR, relationId, {
    agreementText: "Kokkulepe", expectedVersion: relation.version
  }, { db, now });
  // Mentor proposed (auto-accepted for mentor) but mentee not yet → still DRAFT.
  relation = db.store.mentoringRelation.find((r) => r.id === relationId);
  assert.equal(relation.status, "DRAFT");

  await acceptMentoringAgreement(MENTEE, relationId, { agreementVersion: 1 }, { db, now });
  relation = db.store.mentoringRelation.find((r) => r.id === relationId);
  assert.equal(relation.status, "ACTIVE");
});

test("IDOR: stranger gets 404 on relation; both parties do not", async () => {
  const db = baseDb();
  const now = new Date("2026-07-18T10:00:00.000Z");
  const relationId = await activatedRelation(db, now);
  await assert.rejects(() => getMentoringRelation(STRANGER, relationId, { db }), (error) => error.status === 404);
  const asMentor = await getMentoringRelation(MENTOR, relationId, { db });
  assert.equal(asMentor.position, "mentor");
  const asMentee = await getMentoringRelation(MENTEE, relationId, { db });
  assert.equal(asMentee.position, "mentee");
});

test("meeting lifecycle + roomId only for own room (SetNull reference)", async () => {
  const db = baseDb();
  const now = new Date("2026-07-18T10:00:00.000Z");
  const relationId = await activatedRelation(db, now);
  const meeting = await createMentoringMeeting(MENTEE, relationId, {
    occurredAt: "2026-07-25T09:00:00.000Z", mode: "EXTERNAL", topicSummary: "Rolliselgus"
  }, { db, now });
  assert.equal(meeting.status, "PLANNED");
  const held = await updateMentoringMeeting(MENTOR, relationId, meeting.id, {
    action: "held", expectedVersion: meeting.version
  }, { db, now });
  assert.equal(held.status, "HELD");

  // Room the mentee is NOT a member of → 404, roomId never stored.
  await assert.rejects(
    () => createMentoringMeeting(MENTEE, relationId, {
      occurredAt: "2026-07-26T09:00:00.000Z", mode: "PLATFORM_ROOM", roomId: "foreignroom"
    }, { db, now }),
    (error) => error.status === 404
  );
  // With a real membership it is stored.
  db.store.roomMember.push({ id: "rm1", roomId: "room1", userId: "mentee", leftAt: null });
  const linked = await createMentoringMeeting(MENTEE, relationId, {
    occurredAt: "2026-07-26T09:00:00.000Z", mode: "PLATFORM_ROOM", roomId: "room1"
  }, { db, now });
  assert.equal(linked.roomId, "room1");
});

test("summary two-sided confirmation + superseded chain", async () => {
  const db = baseDb();
  const now = new Date("2026-07-18T10:00:00.000Z");
  const relationId = await activatedRelation(db, now);
  const summary = await createMentoringSummary(MENTEE, relationId, { content: "Kokkuvõte 1" }, { db, now });
  await submitMentoringSummary(MENTEE, relationId, summary.id, {
    expectedVersion: db.store.mentoringSummary.find((s) => s.id === summary.id).version
  }, { db, now });
  // First confirmation does not finalize.
  await confirmMentoringSummary(MENTEE, relationId, summary.id, { db, now });
  let stored = db.store.mentoringSummary.find((s) => s.id === summary.id);
  assert.equal(stored.status, "PENDING_CONFIRM");
  // Second party confirms → CONFIRMED.
  await confirmMentoringSummary(MENTOR, relationId, summary.id, { db, now });
  stored = db.store.mentoringSummary.find((s) => s.id === summary.id);
  assert.equal(stored.status, "CONFIRMED");

  // Supersede creates a new DRAFT linked back.
  const replacement = await superseedMentoringSummary(MENTOR, relationId, summary.id, { content: "Parandus" }, { db, now });
  stored = db.store.mentoringSummary.find((s) => s.id === summary.id);
  assert.equal(stored.supersededById, replacement.id);
});

test("close purge atomicity: unconfirmed drops, confirmed + private notes persist", async () => {
  const db = baseDb();
  const now = new Date("2026-07-18T10:00:00.000Z");
  const relationId = await activatedRelation(db, now);

  // A confirmed summary (kept) and an unconfirmed draft (purged).
  const confirmed = await createMentoringSummary(MENTEE, relationId, { content: "Kinnitatav" }, { db, now });
  await submitMentoringSummary(MENTEE, relationId, confirmed.id, {
    expectedVersion: db.store.mentoringSummary.find((s) => s.id === confirmed.id).version
  }, { db, now });
  await confirmMentoringSummary(MENTEE, relationId, confirmed.id, { db, now });
  await confirmMentoringSummary(MENTOR, relationId, confirmed.id, { db, now });
  await createMentoringSummary(MENTEE, relationId, { content: "Mustand" }, { db, now });

  await createMentoringNote(MENTEE, relationId, { content: "Minu privaatmärge" }, { db, now });

  const preview = await previewMentoringClose(MENTEE, relationId, { db });
  assert.equal(preview.keeps.confirmedSummaries, 1);
  assert.equal(preview.purges.unconfirmedSummaries, 1);

  await closeMentoringRelation(MENTEE, relationId, { reasonKey: "completed", confirmed: true }, { db, now });

  const relation = db.store.mentoringRelation.find((r) => r.id === relationId);
  assert.equal(relation.status, "CLOSED");
  assert.ok(relation.purgedAt);
  assert.equal(relation.goalSummary, null);
  // Confirmed kept, draft purged.
  const summaries = db.store.mentoringSummary.filter((s) => s.relationId === relationId);
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].status, "CONFIRMED");
  // Private note survives.
  const notes = db.store.mentoringPrivateNote.filter((n) => n.relationId === relationId && n.kind === "NOTE");
  assert.equal(notes.length, 1);
});

test("wellbeing handoff → private target, recall before open, no recall after open", async () => {
  const db = baseDb();
  const now = new Date("2026-07-18T10:00:00.000Z");
  const relationId = await activatedRelation(db, now);
  const draftUpdatedAt = new Date("2026-07-18T09:00:00.000Z");
  db.store.wellbeingOutputDraft.push({
    id: "wbdraft1",
    userId: "mentee",
    recipientType: "mentor",
    outputType: "support_request",
    status: "ready_to_share",
    userConfirmed: true,
    generatedText: "Üldistatud küsimused mentorile",
    editedText: null,
    handedOffAt: null,
    updatedAt: draftUpdatedAt
  });

  const prep = await handoffWellbeingDraftToMentoring(MENTEE, relationId, {
    draftId: "wbdraft1",
    expectedUpdatedAt: draftUpdatedAt.toISOString()
  }, { db, now });
  assert.equal(prep.own, true);
  // Mentor cannot see it yet (not shared).
  const mentorView = await getMentoringRelation(MENTOR, relationId, { db });
  assert.equal((mentorView.preparations || []).length, 0);
  // Double handoff blocked (unique sourceDraftId).
  await assert.rejects(
    () => handoffWellbeingDraftToMentoring(MENTEE, relationId, {
      draftId: "wbdraft1", expectedUpdatedAt: draftUpdatedAt.toISOString()
    }, { db, now }),
    (error) => error.status === 409
  );

  // Share requires client-data confirmation.
  await assert.rejects(
    () => shareMentoringPreparation(MENTEE, relationId, prep.id, {}, { db, now }),
    (error) => error.status === 400
  );
  await shareMentoringPreparation(MENTEE, relationId, prep.id, { confirmedNoClientData: true }, { db, now });
  // Mentor now sees the frozen copy.
  const afterShare = await getMentoringRelation(MENTOR, relationId, { db });
  assert.equal((afterShare.preparations || []).length, 1);

  // Recall before open succeeds.
  await recallMentoringPreparation(MENTEE, relationId, prep.id, { db, now });
  let note = db.store.mentoringPrivateNote.find((n) => n.id === prep.id);
  assert.ok(note.recalledAt);

  // Re-share then mentor opens → recall blocked.
  await shareMentoringPreparation(MENTEE, relationId, prep.id, { confirmedNoClientData: true }, { db, now });
  await markMentoringPreparationOpened(MENTOR, relationId, prep.id, { db, now });
  await assert.rejects(
    () => recallMentoringPreparation(MENTEE, relationId, prep.id, { db, now }),
    (error) => error.status === 409
  );
});

test("EXTERNAL contact fields never leave the admin serializer", async () => {
  const external = {
    id: "profx",
    origin: "ESTA_IMPORT",
    userId: null,
    status: "EXTERNAL_REFERENCE",
    consentStatus: "CONSENTED",
    displayName: "Väline Mentor",
    publicContact: { email: "secret@eswa.ee", phone: "+372..." },
    contactDisplayAllowed: false,
    fields: ["Lastekaitse"],
    externalProfileUrl: "https://eswa.ee/x",
    checkedAt: new Date("2026-05-24T00:00:00.000Z"),
    capacity: "OPEN"
  };
  const serialized = serializeCatalogProfile(external);
  assert.ok(!("publicContact" in serialized));
  assert.equal(serialized.external, true);
  assert.equal(serialized.canRequest, false);
  assert.ok(!JSON.stringify(serialized).includes("secret@eswa.ee"));
});

test("catalog: consented external visible; pending-consent 404 on direct lookup", async () => {
  const db = baseDb();
  const now = new Date("2026-07-18T10:00:00.000Z");
  await importExternalMentorSeed(ADMIN, {
    checkedAt: "2026-05-24",
    mentors: [{ displayName: "Väline A", slug: "valine-a", fields: ["Lastekaitse"], sourceUrl: "https://eswa.ee/a" }]
  }, { db, now });
  const record = db.store.mentorProfile.find((p) => p.externalSlug === "valine-a");
  // PENDING_CONSENT → not in catalog, direct lookup 404.
  assert.equal((await listMentorCatalog(MENTEE, {}, { db })).length, 0);
  await assert.rejects(() => getCatalogProfile(MENTEE, record.id, { db }), (error) => error.status === 404);
  // Consent → visible.
  await setExternalConsentStatus(ADMIN, record.id, { consentStatus: "CONSENTED" }, { db, now });
  // Need status ACTIVE? No — external CONSENTED userId=null is catalog-visible by consentStatus.
  const catalog = await listMentorCatalog(MENTEE, {}, { db });
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].external, true);
});

test("cancel request re-verify: CANCELLED request loses mentor's notification row", async () => {
  const db = baseDb();
  const now = new Date("2026-07-18T10:00:00.000Z");
  const { assertNotificationRecipient, NOTIFICATION_EVENT_TYPES } = await import("../../lib/notifications.js");
  const profile = await activeMentorProfile(db, now);
  const request = await createMentoringRequest(MENTEE, { mentorProfileId: profile.id, message: "Soov" }, { db, now });
  // While PENDING, mentor is a valid recipient.
  await assertNotificationRecipient(db, {
    type: NOTIFICATION_EVENT_TYPES.MENTORING_REQUEST_CREATED,
    userId: "mentor", sourceId: request.id, targetId: request.id
  });
  await cancelMentoringRequest(MENTEE, request.id, { db, now });
  // After cancel, re-verify fails → row disappears from mentor's list.
  await assert.rejects(
    () => assertNotificationRecipient(db, {
      type: NOTIFICATION_EVENT_TYPES.MENTORING_REQUEST_CREATED,
      userId: "mentor", sourceId: request.id, targetId: request.id
    }),
    (error) => error.status === 404
  );
});

test("account deletion carrier: null party renders as deleted, not leaked", async () => {
  const db = baseDb();
  const now = new Date("2026-07-18T10:00:00.000Z");
  const relationId = await activatedRelation(db, now);
  // Simulate mentee account deletion → SetNull on menteeUserId.
  const relation = db.store.mentoringRelation.find((r) => r.id === relationId);
  relation.menteeUserId = null;
  const view = await getMentoringRelation(MENTOR, relationId, { db });
  assert.equal(view.mentee.deleted, true);
  assert.equal(view.mentee.name, null);
});
