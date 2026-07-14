import test from "node:test";
import assert from "node:assert/strict";

import { createEffectivePracticeService } from "../../lib/effectivePractices.js";

// P1-D: immutable, visibility-gated review-justification ledger.

const NOW = new Date("2026-07-14T12:00:00.000Z");

function makeDb({ practice, events = [], capabilities = [] } = {}) {
  const state = { practice, events, capabilities };
  return {
    state,
    effectivePractice: {
      findUnique: async ({ where }) => (state.practice
        && (state.practice.publicId === where.publicId || state.practice.id === where.id)
        ? { ...state.practice } : null)
    },
    practiceCapability: {
      findMany: async ({ where = {} } = {}) => state.capabilities.filter((c) =>
        (!where.userId || c.userId === where.userId) && !c.revokedAt)
    },
    effectivePracticeAuditEvent: {
      findMany: async ({ where = {} } = {}) => state.events
        .filter((e) => e.practiceId === where.practiceId && (!where.action || e.action === where.action))
    }
  };
}

const service = (db) => createEffectivePracticeService(db, { now: () => NOW });
const practice = (o = {}) => ({ id: "p1", publicId: "pub-1", authorId: "author-1", status: "PUBLISHED", contentVersion: 2, ...o });
const cap = (userId, type = "REVIEWER", scope = "") => ({ userId, type, scope, revokedAt: null, validFrom: new Date("2020-01-01"), validUntil: null });
const ev = (o) => ({
  id: "e", practiceId: "p1", action: "REVIEW_JUSTIFICATION", contentVersion: 2,
  actorId: "rev-1", justificationVisibility: "author", justification: "text", decisionType: "NEEDS_CHANGES",
  createdAt: NOW, ...o
});

const AUTHOR_FEEDBACK = ev({ id: "e1", justificationVisibility: "author", justification: "Palun täpsusta konteksti." });
const PRIVATE_NOTE = ev({ id: "e2", justificationVisibility: "private", justification: "Kahtlane tuvastaja real 3." });

test("author sees author-facing feedback but NEVER a reviewer's private note", async () => {
  const db = makeDb({ practice: practice(), events: [AUTHOR_FEEDBACK, PRIVATE_NOTE], capabilities: [cap("rev-1")] });
  const history = await service(db).getJustificationHistory({ userId: "author-1", role: "SOCIAL_WORKER" }, "pub-1");
  assert.equal(history.length, 1);
  assert.equal(history[0].id, "e1");
  assert.equal(history[0].visibility, "author");
  assert.equal(history[0].actorId, null); // reviewer identity not exposed to the author
  assert.ok(!JSON.stringify(history).includes("Kahtlane tuvastaja"), "private reviewer note never leaks to the author");
});

test("the reviewer who wrote the notes sees their own author + private entries", async () => {
  const db = makeDb({ practice: practice(), events: [AUTHOR_FEEDBACK, PRIVATE_NOTE], capabilities: [cap("rev-1")] });
  const history = await service(db).getJustificationHistory({ userId: "rev-1", role: "SOCIAL_WORKER" }, "pub-1");
  assert.equal(history.length, 2);
  assert.deepEqual(history.map((h) => h.id).sort(), ["e1", "e2"]);
  assert.equal(history.find((h) => h.id === "e2").actorId, "rev-1");
});

test("another reviewer sees author-facing feedback but NOT the first reviewer's private note", async () => {
  const db = makeDb({ practice: practice(), events: [AUTHOR_FEEDBACK, PRIVATE_NOTE], capabilities: [cap("rev-2")] });
  const history = await service(db).getJustificationHistory({ userId: "rev-2", role: "SOCIAL_WORKER" }, "pub-1");
  assert.deepEqual(history.map((h) => h.id), ["e1"]);
});

test("a reviewer whose capability SCOPE does not match the practice gets a no-leak 404 (SOL-P1-4)", async () => {
  const scoped = practice({ topics: ["võrgustik"] });
  const db = makeDb({ practice: scoped, events: [AUTHOR_FEEDBACK, PRIVATE_NOTE], capabilities: [cap("rev-9", "REVIEWER", "tervis")] });
  const error = await service(db).getJustificationHistory({ userId: "rev-9", role: "SOCIAL_WORKER" }, "pub-1")
    .then(() => null, (e) => e);
  assert.equal(error.status, 404, "out-of-scope reviewer cannot read the feedback");
});

test("a reviewer whose capability SCOPE matches the practice DOES see author feedback", async () => {
  const scoped = practice({ topics: ["võrgustik"] });
  const db = makeDb({ practice: scoped, events: [AUTHOR_FEEDBACK, PRIVATE_NOTE], capabilities: [cap("rev-9", "REVIEWER", "võrgustik")] });
  const history = await service(db).getJustificationHistory({ userId: "rev-9", role: "SOCIAL_WORKER" }, "pub-1");
  assert.deepEqual(history.map((h) => h.id), ["e1"]);
});

test("an unrelated user (no capability, not author, no own note) gets a no-leak 404", async () => {
  const db = makeDb({ practice: practice(), events: [AUTHOR_FEEDBACK, PRIVATE_NOTE], capabilities: [] });
  const error = await service(db).getJustificationHistory({ userId: "stranger", role: "SOCIAL_WORKER" }, "pub-1")
    .then(() => null, (e) => e);
  assert.equal(error.status, 404);
});

test("the ledger is append-only — a later decision does not overwrite the first", async () => {
  const first = ev({ id: "e1", justification: "Esimene otsus", createdAt: new Date("2026-07-14T10:00:00.000Z"), decisionType: "NEEDS_CHANGES" });
  const second = ev({ id: "e3", justification: "Teine otsus", createdAt: new Date("2026-07-14T11:00:00.000Z"), decisionType: "APPROVED" });
  const db = makeDb({ practice: practice(), events: [first, second], capabilities: [cap("rev-1")] });
  const history = await service(db).getJustificationHistory({ userId: "author-1", role: "SOCIAL_WORKER" }, "pub-1");
  assert.equal(history.length, 2);
  assert.deepEqual(history.map((h) => h.justification), ["Esimene otsus", "Teine otsus"]);
});
