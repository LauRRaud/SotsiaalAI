import test from "node:test";
import assert from "node:assert/strict";

import { loadMySharings } from "../../lib/mySharings.js";

const USER_ID = "user_owner";
const NOW = new Date("2026-07-14T12:00:00.000Z");

function model(name, rows, calls) {
  return {
    async findMany(query) {
      calls.push({ name, query });
      await Promise.resolve();
      return structuredClone(rows);
    }
  };
}

function fixtureDb() {
  const calls = [];
  const sentAt = new Date("2026-07-14T10:00:00.000Z");
  const openedAt = new Date("2026-07-14T10:30:00.000Z");
  const db = {
    preInquiry: model("preInquiry", [{
      id: "inq_1",
      topic: "Housing",
      situation: "General situation",
      generatedDraft: "Generated",
      userEditedDraft: "Shared text",
      selectedRecipientName: "Municipality",
      selectedRecipientEmail: "kov@example.test",
      deliveryChannel: "INTERNAL",
      status: "SENT",
      sentAt,
      openedAt,
      recalledAt: null,
      supersededById: null,
      updatedAt: openedAt,
      recipientEntry: { title: "Municipality service" },
      recipientOwner: { email: "worker@example.test" },
      supersedes: null,
      receiverNote: "must never be selected",
      receiverChecklist: { mustNeverLeak: true }
    }], calls),
    roomMember: model("roomMember", [{
      role: "MEMBER",
      joinedAt: sentAt,
      room: {
        id: "room_1",
        title: "Support room",
        ownerId: "room_owner",
        originType: null,
        originId: null
      }
    }], calls),
    invite: model("invite", [{
      id: "invite_1",
      roomId: "room_1",
      inviteeEmail: "invitee@example.test",
      status: "SENT",
      createdAt: sentAt,
      expiresAt: new Date("2026-07-20T10:00:00.000Z"),
      room: { title: "Support room", ownerId: USER_ID }
    }], calls),
    helpRequest: model("helpRequest", [{
      id: "request_1",
      title: "Need transport",
      structuredSummary: "",
      status: "OPEN",
      userConfirmedAt: sentAt,
      expiresAt: null,
      createdAt: sentAt
    }], calls),
    helpOffer: model("helpOffer", [{
      id: "offer_1",
      title: "Can help",
      structuredSummary: "",
      status: "MATCHED",
      userConfirmedAt: openedAt,
      expiresAt: null,
      createdAt: openedAt
    }], calls),
    frameworkAcceptance: model("frameworkAcceptance", [{
      id: "acceptance_1",
      frameworkKey: "community_help",
      frameworkVersion: "1",
      acceptanceType: "ACCEPTED",
      acceptedAt: sentAt
    }], calls),
    mentoringPrivateNote: model("mentoringPrivateNote", [], calls),
    networkShare: model("networkShare", [
      {
        id: "share_done",
        summaryText: "Juba saadetud kokkuvõte.",
        purpose: "Võlanõustaja kaasamine.",
        sharingBoundary: "Ainult võlaolukord.",
        participationEndsOn: new Date("2026-12-31T00:00:00.000Z"),
        status: "SENT",
        clientConfirmedAt: new Date("2026-07-14T09:00:00.000Z"),
        clientDeclinedAt: null,
        sentAt,
        openedAt: null,
        roomId: "room_ns"
      },
      {
        id: "share_waiting",
        summaryText: "Ootab sinu otsust.",
        purpose: "Kooli sotsiaalpedagoogi kaasamine.",
        sharingBoundary: "Ainult koolikohustuse teema.",
        participationEndsOn: new Date("2026-11-30T00:00:00.000Z"),
        status: "AWAITING_CLIENT",
        clientConfirmedAt: null,
        clientDeclinedAt: null,
        sentAt: null,
        openedAt: null,
        roomId: null
      }
    ], calls)
  };
  return { db, calls };
}

test("aggregate is owner-scoped, action-ready, and excludes receiver-private workflow", async () => {
  const { db, calls } = fixtureDb();
  const result = await loadMySharings(USER_ID, { db, now: NOW });

  assert.equal(calls.length, 8);
  assert.equal(calls.find((call) => call.name === "mentoringPrivateNote").query.where.ownerId, USER_ID);
  assert.equal(calls.find((call) => call.name === "preInquiry").query.where.authorId, USER_ID);
  assert.equal(calls.find((call) => call.name === "roomMember").query.where.userId, USER_ID);
  assert.equal(calls.find((call) => call.name === "invite").query.where.inviterId, USER_ID);
  assert.equal(calls.find((call) => call.name === "helpRequest").query.where.userId, USER_ID);
  assert.equal(calls.find((call) => call.name === "helpOffer").query.where.userId, USER_ID);
  assert.equal(calls.find((call) => call.name === "frameworkAcceptance").query.where.userId, USER_ID);

  const selection = calls.find((call) => call.name === "preInquiry").query.select;
  assert.equal(selection.receiverNote, undefined);
  assert.equal(selection.receiverChecklist, undefined);
  assert.equal(result.preInquiries[0].receiverNote, undefined);
  assert.equal(result.preInquiries[0].receiverChecklist, undefined);
  assert.equal(result.preInquiries[0].canRecall, false);
  assert.equal(result.preInquiries[0].canCorrect, true);
  assert.equal(result.rooms[0].canLeave, true);
  assert.equal(result.invites[0].canRevoke, true);
  assert.equal(result.helpListings.length, 2);
  assert.deepEqual(Object.keys(result), [
    "preInquiries",
    "rooms",
    "invites",
    "helpListings",
    "frameworkAcceptances",
    "mentoringPreparations",
    "networkShares"
  ]);
});

test("unopened internal SENT inquiry is recallable but external delivery is not", async () => {
  const { db } = fixtureDb();
  db.roomMember.findMany = async () => [];
  db.preInquiry.findMany = async () => [
    {
      id: "internal",
      topic: "Internal",
      situation: "General",
      userEditedDraft: "Text",
      generatedDraft: null,
      selectedRecipientName: "Worker",
      selectedRecipientEmail: null,
      deliveryChannel: "INTERNAL",
      status: "SENT",
      sentAt: NOW,
      openedAt: null,
      recalledAt: null,
      supersededById: null,
      updatedAt: NOW,
      recipientEntry: null,
      recipientOwner: { email: "worker@example.test" },
      supersedes: null
    },
    {
      id: "external",
      topic: "External",
      situation: "General",
      userEditedDraft: "Text",
      generatedDraft: null,
      selectedRecipientName: "External worker",
      selectedRecipientEmail: "external@example.test",
      deliveryChannel: "EXTERNAL_EMAIL",
      status: "SENT",
      sentAt: NOW,
      openedAt: null,
      recalledAt: null,
      supersededById: null,
      updatedAt: NOW,
      recipientEntry: null,
      recipientOwner: null,
      supersedes: null
    }
  ];

  const result = await loadMySharings(USER_ID, { db, now: NOW });
  assert.equal(result.preInquiries[0].canRecall, true);
  assert.equal(result.preInquiries[0].canCorrect, false);
  assert.equal(result.preInquiries[1].canRecall, false);
  assert.equal(result.preInquiries[1].canCorrect, false);
});

test("a canonical shared room removes the optimistic recall action", async () => {
  const { db } = fixtureDb();
  db.preInquiry.findMany = async () => [{
    id: "internal",
    topic: "Internal",
    situation: "General",
    userEditedDraft: "Text",
    generatedDraft: null,
    selectedRecipientName: "Worker",
    selectedRecipientEmail: null,
    deliveryChannel: "INTERNAL",
    status: "SENT",
    sentAt: NOW,
    openedAt: null,
    recalledAt: null,
    supersededById: null,
    updatedAt: NOW,
    recipientEntry: null,
    recipientOwner: { email: "worker@example.test" },
    supersedes: null
  }];
  db.roomMember.findMany = async () => [{
    role: "OWNER",
    joinedAt: NOW,
    room: {
      id: "room_pre_inquiry",
      title: "Shared inquiry",
      ownerId: USER_ID,
      originType: "PRE_INQUIRY",
      originId: "internal"
    }
  }];

  const result = await loadMySharings(USER_ID, { db, now: NOW });
  assert.equal(result.preInquiries[0].canRecall, false);
});

test("an invite remains visible but is not revocable after room authority is lost", async () => {
  const { db } = fixtureDb();
  db.roomMember.findMany = async () => [];
  db.invite.findMany = async () => [{
    id: "invite_without_authority",
    roomId: "room_other",
    inviteeEmail: "invitee@example.test",
    status: "SENT",
    createdAt: NOW,
    expiresAt: new Date("2026-07-20T10:00:00.000Z"),
    room: { title: "Other room", ownerId: "another_owner" }
  }];

  const result = await loadMySharings(USER_ID, { db, now: NOW });
  assert.equal(result.invites[0].canRevoke, false);
});

test("room owners cannot leave and an empty user id is rejected before queries", async () => {
  const { db, calls } = fixtureDb();
  db.roomMember.findMany = async () => [{
    role: "OWNER",
    joinedAt: NOW,
    room: {
      id: "room_owner",
      title: "Owned room",
      ownerId: USER_ID,
      originType: null,
      originId: null
    }
  }];
  const result = await loadMySharings(USER_ID, { db, now: NOW });
  assert.equal(result.rooms[0].canLeave, false);

  await assert.rejects(loadMySharings("", { db, now: NOW }), (error) => {
    assert.equal(error.status, 401);
    assert.equal(error.message, "api.common.unauthorized");
    return true;
  });
  // preInquiry, invite, helpRequest, helpOffer, frameworkAcceptance,
  // mentoringPrivateNote, networkShare (roomMember is overridden and does not push).
  assert.equal(calls.length, 7);
});

// --- COLLAB-P4: võrgustikujagamised „Minu jagamiste" all ---------------------
// Suund on siin teistpidi kui ülejäänud read: need ei ole asjad, mida inimene
// on jaganud, vaid ettepanek jagada tema KOHTA. Ühendav mõiste ei ole suund,
// vaid „kus mu info liigub" — seepärast on nad samas kohas.

test("otsust ootav võrgustikujagamine tuleb esimesena, mitte ei kao ajaloo sisse", async () => {
  const { db } = fixtureDb();
  const result = await loadMySharings(USER_ID, { db, now: NOW });

  assert.equal(result.networkShares.length, 2);
  assert.equal(result.networkShares[0].id, "share_waiting");
  assert.equal(result.networkShares[0].awaitingDecision, true);
  assert.equal(result.networkShares[1].awaitingDecision, false);
});

test("võrgustikujagamine kannab suunamärget, et kuvakiht ei peaks seda tüübist ära arvama", async () => {
  const { db } = fixtureDb();
  const result = await loadMySharings(USER_ID, { db, now: NOW });
  for (const share of result.networkShares) {
    assert.equal(share.direction, "INCOMING_REQUEST");
  }
});

test("klient näeb otsustamiseks vajalikku: kokkuvõtet, eesmärki, jagamispiiri ja lõppu", async () => {
  const { db } = fixtureDb();
  const result = await loadMySharings(USER_ID, { db, now: NOW });
  const waiting = result.networkShares.find((share) => share.id === "share_waiting");
  assert.equal(waiting.summaryText, "Ootab sinu otsust.");
  assert.equal(waiting.purpose, "Kooli sotsiaalpedagoogi kaasamine.");
  assert.equal(waiting.sharingBoundary, "Ainult koolikohustuse teema.");
  assert.equal(waiting.participationEndsOn, "2026-11-30T00:00:00.000Z");
});

test("päring on kliendi enda peale piiratud ja MUSTANDEID ei tooda", async () => {
  const { db, calls } = fixtureDb();
  await loadMySharings(USER_ID, { db, now: NOW });
  const call = calls.find((entry) => entry.name === "networkShare");
  assert.equal(call.query.where.clientUserId, USER_ID);
  // Mustandi kohta ei ole kliendil millegi üle otsustada.
  assert.equal(call.query.where.status.in.includes("DRAFT"), false);
});
