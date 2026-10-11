import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  ANSWER_FEEDBACK_CATEGORIES,
  answerFeedbackAdminList,
  answerFeedbackAdminResolve,
  answerFeedbackOwnList,
  answerFeedbackPost
} from "../lib/answerFeedback.js";
import { pilotChatMessages, pilotChatResult } from "../lib/chat/m4PilotClientContract.js";
import { validatePersonalDataSurfaceRegistry } from "../lib/dataExport/personalDataSurfaceRegistry.js";

// The request handlers with only the sign-in check and the database replaced. The database is a small in-memory
// stand-in that answers exactly the queries the handlers make and keeps the table's one rule: one row per reporter
// and turn.
function database({ turns = [], messages = [], conversations = {} } = {}) {
  const rows = [], audit = [];
  let serial = 0, clock = Date.parse("2026-10-11T09:00:00Z");
  const db = {
    rows, audit,
    createRace: null,
    m4PilotTurn: {
      findFirst: async ({ where }) => {
        const turn = turns.find(item => item.id === where.id && item.userId === where.chatTurn.userId && item.conversationId === where.chatTurn.conversationId);
        return turn ? { id: turn.id, chatTurn: { userMessageId: turn.userMessageId ?? null, assistantMessageId: turn.assistantMessageId ?? null } } : null;
      }
    },
    conversationMessage: {
      findMany: async ({ where }) => {
        if (where.id?.in) return messages.filter(message => where.id.in.includes(message.id)).map(({ id, content }) => ({ id, content }));
        assert.deepEqual(where.metadata.path, ["m4TurnId"]);
        return messages.filter(message => message.conversationId === where.conversationId && conversations[message.conversationId] === where.conversation.userId
          && message.turnId === where.metadata.equals).map(({ id, role }) => ({ id, role }));
      }
    },
    answerFeedback: {
      findUnique: async ({ where }) => rows.find(row => where.id ? row.id === where.id
        : row.reporterId === where.reporterId_turnId.reporterId && row.turnId === where.reporterId_turnId.turnId) || null,
      count: async ({ where }) => rows.filter(row => row.reporterId === where.reporterId && row.createdAt >= where.createdAt.gte).length,
      create: async ({ data }) => {
        if (db.createRace) { const race = db.createRace; db.createRace = null; race(); }
        if (rows.some(row => row.reporterId === data.reporterId && row.turnId === data.turnId)) throw Object.assign(new Error("unique"), { code: "P2002" });
        const row = { id: `fb-${++serial}`, status: "OPEN", note: null, resolvedAt: null, resolvedById: null, resolutionNote: null, createdAt: new Date(clock += 1000), ...data };
        rows.push(row);
        return row;
      },
      findMany: async ({ where }) => rows.filter(row => Object.entries(where).every(([key, value]) => row[key] === value)).map(row => ({ ...row })),
      updateMany: async ({ where, data }) => {
        const hit = rows.filter(row => row.id === where.id && row.status === where.status);
        for (const row of hit) Object.assign(row, data);
        return { count: hit.length };
      }
    },
    dataAuditLog: { create: async ({ data }) => { audit.push(data); return data; } },
    $transaction: async fn => fn(db)
  };
  return db;
}

const signedIn = (userId, extra = {}) => async () => ({ ok: true, userId, isAdmin: false, role: "CLIENT", ...extra });
const signedOut = async () => ({ ok: false, status: 401, message: "api.common.unauthorized" });
const admin = signedIn("admin-1", { isAdmin: true, role: "ADMIN" });
const post = (body, raw = false) => new Request("http://localhost:3000/api/answer-feedback", { method: "POST", headers: { "content-type": "application/json" },
  body: raw ? body : JSON.stringify(body) });
const get = query => new Request(`http://localhost:3000/api/answer-feedback${query}`);
const patch = body => new Request("http://localhost:3000/api/admin/answer-feedback/x", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// Anna's conversation with one published turn, one turn that got no answer, and Boris's conversation.
const world = () => database({
  conversations: { "conv-anna": "anna", "conv-anna-old": "anna", "conv-boris": "boris" },
  turns: [
    { id: "turn-anna-1", userId: "anna", conversationId: "conv-anna", userMessageId: "m-q1", assistantMessageId: "m-a1" },
    { id: "turn-anna-failed", userId: "anna", conversationId: "conv-anna" },
    { id: "turn-boris-1", userId: "boris", conversationId: "conv-boris", userMessageId: "m-bq", assistantMessageId: "m-ba" }
  ],
  messages: [
    { id: "m-q1", conversationId: "conv-anna", role: "USER", turnId: "turn-anna-1", content: "Kust saan toimetulekutoetust?" },
    { id: "m-a1", conversationId: "conv-anna", role: "ASSISTANT", turnId: "turn-anna-1", content: "Taotle oma vallast. [S1]" },
    // A turn whose audit row is gone (ADR-094): only the conversation's own messages carry its id.
    { id: "m-oq", conversationId: "conv-anna-old", role: "USER", turnId: "turn-anna-old", content: "Vana küsimus" },
    { id: "m-oa", conversationId: "conv-anna-old", role: "ASSISTANT", turnId: "turn-anna-old", content: "Vana vastus" },
    { id: "m-bq", conversationId: "conv-boris", role: "USER", turnId: "turn-boris-1", content: "Borisi küsimus" },
    { id: "m-ba", conversationId: "conv-boris", role: "ASSISTANT", turnId: "turn-boris-1", content: "Borisi vastus" }
  ]
});
const good = { convId: "conv-anna", turnId: "turn-anna-1", category: "wrong_or_outdated", note: "  Määr on vana.  " };

test("a signed-out request stores nothing", async () => {
  const db = world();
  for (const reply of [await answerFeedbackPost(post(good), { authenticate: signedOut, prisma: db }), await answerFeedbackOwnList(get("?convId=conv-anna"), { authenticate: signedOut, prisma: db })]) {
    assert.equal(reply.status, 401);
    assert.deepEqual(reply.body, { ok: false, message: "api.common.unauthorized" });
  }
  assert.equal(db.rows.length, 0);
});

test("feedback about a person's own answer is stored with the turn's id and without the conversation's content", async () => {
  const db = world();
  const reply = await answerFeedbackPost(post(good), { authenticate: signedIn("anna"), prisma: db });
  assert.equal(reply.status, 201);
  assert.equal(reply.body.ok, true);
  assert.equal(reply.body.duplicate, false);
  assert.deepEqual(Object.keys(reply.body.item).sort(), ["category", "createdAt", "id", "note", "status", "turnId"]);
  assert.equal(db.rows.length, 1);
  const { id: _id, createdAt: _createdAt, ...row } = db.rows[0];
  assert.deepEqual(row, { status: "OPEN", note: "Määr on vana.", resolvedAt: null, resolvedById: null, resolutionNote: null, reporterId: "anna",
    conversationId: "conv-anna", turnId: "turn-anna-1", userMessageId: "m-q1", assistantMessageId: "m-a1", category: "wrong_or_outdated" });
  assert.ok(!JSON.stringify(db.rows[0]).includes("toimetulekutoetust"));
});

test("a turn that got no answer can be reported too; it has no messages to point at", async () => {
  const db = world();
  const reply = await answerFeedbackPost(post({ convId: "conv-anna", turnId: "turn-anna-failed", category: "unanswered" }), { authenticate: signedIn("anna"), prisma: db });
  assert.equal(reply.status, 201);
  assert.equal(db.rows[0].userMessageId, null);
  assert.equal(db.rows[0].assistantMessageId, null);
  assert.equal(db.rows[0].note, null);
});

test("someone else's answer, a wrong conversation and an unknown turn all answer the same and store nothing", async () => {
  const db = world();
  const cases = [
    { convId: "conv-boris", turnId: "turn-boris-1" },
    { convId: "conv-anna", turnId: "turn-boris-1" },
    { convId: "conv-boris", turnId: "turn-anna-1" },
    { convId: "conv-anna", turnId: "turn-missing" }
  ];
  for (const target of cases) {
    const reply = await answerFeedbackPost(post({ ...target, category: "other" }), { authenticate: signedIn("anna"), prisma: db });
    assert.equal(reply.status, 404, JSON.stringify(target));
    assert.deepEqual(reply.body, { ok: false, message: "api.answer_feedback.not_found" });
  }
  assert.equal(db.rows.length, 0);
});

test("a turn whose audit row is gone is found through the person's own conversation messages only", async () => {
  const db = world();
  const old = { convId: "conv-anna-old", turnId: "turn-anna-old", category: "unclear" };
  assert.equal((await answerFeedbackPost(post(old), { authenticate: signedIn("boris"), prisma: db })).status, 404);
  const reply = await answerFeedbackPost(post(old), { authenticate: signedIn("anna"), prisma: db });
  assert.equal(reply.status, 201);
  assert.deepEqual([db.rows[0].userMessageId, db.rows[0].assistantMessageId], ["m-oq", "m-oa"]);
});

test("a second send for the same answer makes no second row and leaves the first as it was", async () => {
  const db = world();
  await answerFeedbackPost(post(good), { authenticate: signedIn("anna"), prisma: db });
  const again = await answerFeedbackPost(post({ ...good, category: "other", note: "teine tekst" }), { authenticate: signedIn("anna"), prisma: db });
  assert.equal(again.status, 200);
  assert.equal(again.body.duplicate, true);
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0].category, "wrong_or_outdated");
  assert.equal(db.rows[0].note, "Määr on vana.");
  // The same answer is still each person's own to report: the rule is one row per reporter and turn.
  assert.equal(again.body.item.id, db.rows[0].id);
});

test("two sends that race end as one row: the table's unique key decides", async () => {
  const db = world();
  db.createRace = () => db.rows.push({ id: "fb-race", reporterId: "anna", turnId: "turn-anna-1", conversationId: "conv-anna", category: "other", note: null, status: "OPEN", createdAt: new Date() });
  const reply = await answerFeedbackPost(post(good), { authenticate: signedIn("anna"), prisma: db });
  assert.equal(reply.status, 200);
  assert.equal(reply.body.duplicate, true);
  assert.equal(reply.body.item.id, "fb-race");
  assert.equal(db.rows.length, 1);
});

test("the note holds up to 500 characters; a longer one, or one that is not text, is refused", async () => {
  const db = world();
  const send = note => answerFeedbackPost(post({ ...good, note }), { authenticate: signedIn("anna"), prisma: db });
  const long = await send("a".repeat(501));
  assert.equal(long.status, 400);
  assert.equal(long.body.message, "api.answer_feedback.note_too_long");
  assert.equal((await send(42)).body.message, "api.answer_feedback.invalid");
  assert.equal(db.rows.length, 0);
  // Surrounding blank space does not count toward the length.
  assert.equal((await send(`  ${"õ".repeat(500)}\n`)).status, 201);
  assert.equal(db.rows[0].note.length, 500);
});

test("a reason from the list is required, and a body with other fields or no JSON is refused", async () => {
  const db = world();
  const send = (body, raw) => answerFeedbackPost(post(body, raw), { authenticate: signedIn("anna"), prisma: db });
  for (const category of [undefined, "", "like", "dislike", 5]) {
    const reply = await send({ ...good, category });
    assert.equal(reply.status, 400);
    assert.equal(reply.body.message, "api.answer_feedback.reason_required");
  }
  for (const body of [{ ...good, reporterId: "boris" }, { ...good, status: "RESOLVED" }, { ...good, convId: "" }, { ...good, turnId: "a b" }, [good]]) {
    assert.equal((await send(body)).body.message, "api.answer_feedback.invalid", JSON.stringify(body));
  }
  assert.equal((await send("{not json", true)).body.message, "api.answer_feedback.invalid");
  assert.equal(db.rows.length, 0);
  for (const category of ANSWER_FEEDBACK_CATEGORIES) {
    const one = world();
    assert.equal((await answerFeedbackPost(post({ ...good, category }), { authenticate: signedIn("anna"), prisma: one })).status, 201, category);
  }
});

test("more than ten reports in an hour are refused", async () => {
  const turns = Array.from({ length: 11 }, (_, index) => ({ id: `turn-${index}`, userId: "anna", conversationId: "conv-anna" }));
  const db = database({ turns });
  const now = Date.now;
  Date.now = () => Date.parse("2026-10-11T09:00:30Z");
  try {
    for (let index = 0; index < 10; index++) {
      assert.equal((await answerFeedbackPost(post({ convId: "conv-anna", turnId: `turn-${index}`, category: "other" }), { authenticate: signedIn("anna"), prisma: db })).status, 201);
    }
    const eleventh = await answerFeedbackPost(post({ convId: "conv-anna", turnId: "turn-10", category: "other" }), { authenticate: signedIn("anna"), prisma: db });
    assert.equal(eleventh.status, 429);
    assert.equal(eleventh.body.message, "api.answer_feedback.rate_limited");
    assert.equal(db.rows.length, 10);
  } finally { Date.now = now; }
});

test("a person's own list names only the turns they reported in that conversation", async () => {
  const db = world();
  await answerFeedbackPost(post(good), { authenticate: signedIn("anna"), prisma: db });
  await answerFeedbackPost(post({ convId: "conv-boris", turnId: "turn-boris-1", category: "other" }), { authenticate: signedIn("boris"), prisma: db });
  const own = await answerFeedbackOwnList(get("?convId=conv-anna"), { authenticate: signedIn("anna"), prisma: db });
  assert.deepEqual(own.body, { ok: true, items: [{ turnId: "turn-anna-1", status: "OPEN" }] });
  assert.deepEqual((await answerFeedbackOwnList(get("?convId=conv-boris"), { authenticate: signedIn("anna"), prisma: db })).body.items, []);
  assert.equal((await answerFeedbackOwnList(get(""), { authenticate: signedIn("anna"), prisma: db })).status, 400);
});

test("only an administrator reads the queue; an open report shows the question and the answer while the conversation has them", async () => {
  const db = world();
  await answerFeedbackPost(post(good), { authenticate: signedIn("anna"), prisma: db });
  await answerFeedbackPost(post({ convId: "conv-anna", turnId: "turn-anna-failed", category: "unanswered" }), { authenticate: signedIn("anna"), prisma: db });
  const list = new Request("http://localhost:3000/api/admin/answer-feedback?status=OPEN");
  for (const authenticate of [signedOut, signedIn("anna"), signedIn("boris", { role: "SOCIAL_WORKER" })]) {
    const refused = await answerFeedbackAdminList(list, { authenticate, prisma: db });
    assert.equal(refused.status, 404);
    assert.deepEqual(refused.body, { ok: false, message: "api.common.not_found" });
  }
  const { status, body } = await answerFeedbackAdminList(list, { authenticate: admin, prisma: db });
  assert.equal(status, 200);
  assert.equal(body.items.length, 2);
  const [first, second] = body.items;
  assert.equal(first.turnId, "turn-anna-1");
  assert.equal(first.category, "wrong_or_outdated");
  assert.equal(first.note, "Määr on vana.");
  assert.equal(first.question, "Kust saan toimetulekutoetust?");
  assert.equal(first.answer, "Taotle oma vallast. [S1]");
  assert.deepEqual([second.question, second.answer], [null, null]);
  // The queue does not say who reported, and carries no message or conversation ids.
  for (const item of body.items) for (const key of ["reporterId", "conversationId", "userMessageId", "assistantMessageId"]) assert.ok(!(key in item), key);
});

test("a deleted conversation takes the question and the answer away; the report stays", async () => {
  const db = database({ turns: [{ id: "turn-anna-1", userId: "anna", conversationId: "conv-anna", userMessageId: "m-q1", assistantMessageId: "m-a1" }], messages: [] });
  await answerFeedbackPost(post(good), { authenticate: signedIn("anna"), prisma: db });
  const { body } = await answerFeedbackAdminList(new Request("http://localhost:3000/api/admin/answer-feedback"), { authenticate: admin, prisma: db });
  assert.equal(body.items.length, 1);
  assert.deepEqual([body.items[0].question, body.items[0].answer, body.items[0].note], [null, null, "Määr on vana."]);
});

test("an administrator resolves a report once, with a note, and the step is audited without the reporter's text", async () => {
  const db = world();
  const created = await answerFeedbackPost(post(good), { authenticate: signedIn("anna"), prisma: db });
  const id = created.body.item.id;
  assert.equal((await answerFeedbackAdminResolve(patch({ resolutionNote: "Parandatud" }), id, { authenticate: signedIn("anna"), prisma: db })).status, 404);
  for (const body of [{}, { resolutionNote: "  " }, { resolutionNote: "x".repeat(1001) }, { resolutionNote: "ok", status: "OPEN" }]) {
    const refused = await answerFeedbackAdminResolve(patch(body), id, { authenticate: admin, prisma: db });
    assert.equal(refused.status, 400);
    assert.equal(refused.body.message, "api.answer_feedback.resolution_invalid");
  }
  assert.equal((await answerFeedbackAdminResolve(patch({ resolutionNote: "Parandatud" }), "fb-none", { authenticate: admin, prisma: db })).status, 404);
  const resolved = await answerFeedbackAdminResolve(patch({ resolutionNote: " Allikas uuendatud. " }), id, { authenticate: admin, prisma: db });
  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.item.status, "RESOLVED");
  assert.equal(db.rows[0].resolvedById, "admin-1");
  assert.equal(db.rows[0].resolutionNote, "Allikas uuendatud.");
  assert.ok(db.rows[0].resolvedAt instanceof Date);
  // A second resolve changes nothing and writes no second audit row.
  await answerFeedbackAdminResolve(patch({ resolutionNote: "Teine" }), id, { authenticate: admin, prisma: db });
  assert.equal(db.rows[0].resolutionNote, "Allikas uuendatud.");
  assert.equal(db.audit.length, 1);
  assert.deepEqual(db.audit[0], { actorUserId: "admin-1", targetUserId: "anna", action: "ANSWER_FEEDBACK_RESOLVED", resourceType: "AnswerFeedback", resourceId: id,
    meta: { turnId: "turn-anna-1", category: "wrong_or_outdated", resolutionNote: "Allikas uuendatud." } });
  assert.ok(!JSON.stringify(db.audit).includes("Määr on vana"));
  // Resolved reports are listed without the conversation's content, and the person cannot report that answer again.
  const done = await answerFeedbackAdminList(new Request("http://localhost:3000/api/admin/answer-feedback?status=RESOLVED"), { authenticate: admin, prisma: db });
  assert.deepEqual([done.body.items.length, done.body.items[0].question, done.body.items[0].answer], [1, null, null]);
  assert.equal((await answerFeedbackPost(post(good), { authenticate: signedIn("anna"), prisma: db })).body.duplicate, true);
});

test("the chat carries the turn's id with an answer, so the page can name the answer it reports", () => {
  const turn = { id: "turn-1", state: "completed", mode: "test", question: "Küsimus", createdAt: new Date(0),
    answer: { kind: "grounded", blocks: [{ text: "Vastus", refs: ["S1"] }], limitations: [], clarification: null }, sources: [{ ref: "S1", title: "Allikas", pages: [1], used: true }] };
  assert.equal(pilotChatResult(turn, "conv").turnId, "turn-1");
  assert.equal(pilotChatResult({ id: "turn-2", state: "answer_rejected", question: "Küsimus" }, "conv").turnId, "turn-2");
  assert.ok(!("turnId" in pilotChatResult({ state: "unknown" }, "conv")));
  const [question, answer] = pilotChatMessages([turn], "conv");
  assert.ok(!("turnId" in question));
  assert.equal(answer.turnId, "turn-1");
});

test("every reason and every refusal has a sentence in all three languages", async () => {
  const source = await readFile(new URL("../lib/answerFeedback.js", import.meta.url), "utf8");
  const serverKeys = [...new Set(source.match(/api\.answer_feedback\.[a-z_]+/g))];
  assert.ok(serverKeys.length >= 6);
  const keys = [...serverKeys, ...ANSWER_FEEDBACK_CATEGORIES.map(category => `chat.answer_feedback.reason_${category}`),
    ...["action", "sent_aria", "title", "note_label", "note_placeholder", "notice", "send", "sending", "cancel", "sent", "failed", "choose_reason"].map(key => `chat.answer_feedback.${key}`),
    "chat.message_tip.feedback", "chat.message_tip.feedback_sent"];
  for (const locale of ["et", "en", "ru"]) {
    const catalogue = JSON.parse(await readFile(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
    for (const key of keys) {
      const value = key.split(".").reduce((node, part) => node?.[part], catalogue);
      assert.ok(typeof value === "string" && value.trim(), `${locale}: ${key}`);
    }
  }
});

test("the new table is in the personal data register and its migration makes the shape the schema names", async () => {
  const schemaText = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const result = validatePersonalDataSurfaceRegistry({ schemaText, exportSurfaceNames: [] });
  for (const list of [result.missingRelations, result.staleRelations, result.missingCopyFields, result.staleCopyFields]) {
    assert.deepEqual(list.filter(name => /answerFeedback/i.test(name)), []);
  }
  const model = schemaText.match(/^model AnswerFeedback \{[\s\S]*?^\}/m)[0];
  assert.match(model, /@@unique\(\[reporterId, turnId\]\)/);
  assert.match(model, /note\s+String\?\s+@db\.VarChar\(500\)/);
  const sql = await readFile(new URL("../prisma/migrations/20261014130000_answer_feedback/migration.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE UNIQUE INDEX "AnswerFeedback_reporterId_turnId_key" ON "AnswerFeedback"\("reporterId", "turnId"\)/);
  assert.match(sql, /"note" VARCHAR\(500\)/);
  assert.match(sql, /REFERENCES "User"\("id"\) ON DELETE CASCADE/);
  assert.doesNotMatch(sql.replace(/^--.*$/gm, ""), /DROP|ALTER TABLE "(?!AnswerFeedback")/);
});
