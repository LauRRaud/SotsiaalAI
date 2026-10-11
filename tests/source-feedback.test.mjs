import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  SOURCE_FEEDBACK_CATEGORIES,
  sourceFeedbackAdminList,
  sourceFeedbackAdminResolve,
  sourceFeedbackOwnList,
  sourceFeedbackPost
} from "../lib/sourceFeedback.js";
import { pilotSourceRef } from "../lib/chat/pilotSourceRef.js";
import { pilotChatResult } from "../lib/chat/m4PilotClientContract.js";
import { completedView } from "../lib/rag-v2/pilot/service.js";
import { historyRecord, historyMessages } from "../lib/rag-v2/pilot/history.js";
import { normalizeSources } from "../components/chat/utils/sources.js";
import { collectMessageSources } from "../components/chat/hooks/useConversationSources.js";
import { municipalPacket } from "./fixtures/rag-v2-municipal-packet.mjs";

// "Teata veast" in the sources panel (owner, 11.10.2026). The button had been made for the retired system's sources
// and never showed for an answer of the present chat. A report now names a source as the answer's reference in a turn.

// A published turn as the chat stores it: its row, its view, and the durable record its answer message carries.
function publishedTurn(id = "turn-1") {
  const packet = municipalPacket({ records: 2, passages: 2 });
  const answer = { kind: "grounded", blocks: [{ text: "Esimene väide.", factual: true, refs: ["S1"] }, { text: "Teine väide.", factual: true, refs: ["S2"] }], limitations: [], clarification: null };
  const row = { id, state: "completed", configHash: "plan", createdAt: new Date("2026-10-11T09:00:00Z"), expiresAt: null,
    payload: { question: "Kust saab abi?", contextMode: "new", query: { language: "et", tokens: 4 }, events: [], answer, answerVersion: "m4-text-refs-2", messageId: "message-1", packet,
      context: { version: "d", scopeId: "scope-1", personId: "person-1", scopeTurnId: id, revision: 1, correctionRevision: 0, mode: "new" }, contextAudit: { userTurns: [{ text: "Kust saab abi?" }] } } };
  const view = completedView(row, "real"), record = historyRecord({ row, view, packet });
  return { row, view, record, messages: historyMessages(record, row.payload.question) };
}

// A row against a query's conditions: equality, and the three comparisons the handlers use.
const matches = (row, where) => Object.entries(where).every(([key, value]) => !value || typeof value !== "object" || value instanceof Date ? row[key] === value
  : "gte" in value ? row[key] >= value.gte : "lt" in value ? row[key] < value.lt : "not" in value ? row[key] !== value.not : false);
const removeWhere = (rows, where) => { const kept = rows.filter(row => !matches(row, where)), count = rows.length - kept.length; rows.splice(0, rows.length, ...kept); return { count }; };

// The request handlers with only the sign-in check and the database replaced.
function database({ messages = [], conversations = {} } = {}) {
  const rows = [], audit = [];
  // Reports are dated just before now: a report lives 30 days from its sending (chatFeedbackLifecycle.js).
  let serial = 0, clock = Date.now() - 120000;
  const db = {
    rows, audit,
    createRace: null,
    conversationMessage: {
      findFirst: async ({ where }) => {
        assert.deepEqual(where.metadata.path, ["m4TurnId"]);
        const found = messages.find(message => message.conversationId === where.conversationId && message.role === where.role
          && conversations[message.conversationId] === where.conversation.userId && message.metadata?.m4TurnId === where.metadata.equals);
        return found ? { id: found.id, metadata: found.metadata } : null;
      }
    },
    sourceFeedback: {
      findUnique: async ({ where }) => rows.find(row => where.id ? row.id === where.id : row.dedupeKey === where.dedupeKey) || null,
      count: async ({ where }) => rows.filter(row => row.reporterId === where.reporterId && row.createdAt >= where.createdAt.gte).length,
      create: async ({ data }) => {
        if (db.createRace) { const race = db.createRace; db.createRace = null; race(data); }
        if (rows.some(row => row.dedupeKey === data.dedupeKey)) throw Object.assign(new Error("unique"), { code: "P2002" });
        const row = { id: `sf-${++serial}`, status: "OPEN", note: null, resolvedAt: null, resolvedById: null, resolutionNote: null, createdAt: new Date(clock += 1000), ...data };
        rows.push(row);
        return row;
      },
      findMany: async ({ where }) => rows.filter(row => matches(row, where)).map(row => ({ ...row })),
      deleteMany: async ({ where }) => removeWhere(rows, where),
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
const post = (body, raw = false) => new Request("http://localhost:3000/api/source-feedback", { method: "POST", headers: { "content-type": "application/json" },
  body: raw ? body : JSON.stringify(body) });
const list = new Request("http://localhost:3000/api/source-feedback");
const patch = body => new Request("http://localhost:3000/api/admin/source-feedback/x", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// Anna's conversation holds the published turn; Boris has a conversation of his own with another turn.
function world() {
  const anna = publishedTurn("turn-anna"), boris = publishedTurn("turn-boris");
  const db = database({
    conversations: { "conv-anna": "anna", "conv-boris": "boris" },
    messages: [
      { id: "m-anna-q", conversationId: "conv-anna", role: "USER", content: anna.messages.user.content, metadata: anna.messages.user.metadata },
      { id: "m-anna-a", conversationId: "conv-anna", role: "ASSISTANT", content: anna.messages.assistant.content, metadata: anna.messages.assistant.metadata },
      { id: "m-boris-a", conversationId: "conv-boris", role: "ASSISTANT", content: boris.messages.assistant.content, metadata: boris.messages.assistant.metadata },
      // An answer stored before the durable record: it names its turn but lists no sources.
      { id: "m-anna-old", conversationId: "conv-anna", role: "ASSISTANT", content: "[Kaitstud M4 sisepiloodi vastus]", metadata: { m4TurnId: "turn-anna-old" } }
    ]
  });
  return { db, anna, boris };
}
const good = { convId: "conv-anna", turnId: "turn-anna", ref: "S2", category: "broken_link", note: "  Link annab vea 404.  " };

test("the panel names a source of the present chat by its turn and reference, through both client layers", () => {
  const { view } = publishedTurn("turn-9");
  const reply = pilotChatResult(view, "conv-1");
  const message = { id: 7, role: "ai", text: reply.answer, sources: normalizeSources(reply.sources) };
  const shown = collectMessageSources(message, null);
  assert.equal(shown.length, 2);
  assert.deepEqual(shown.map(pilotSourceRef), [{ turnId: "turn-9", ref: "S1" }, { turnId: "turn-9", ref: "S2" }]);
  // Any other source (an uploaded file, a source of the retired system, a key of another shape) gives no target.
  for (const other of [null, {}, { sourceType: "m4_pilot", key: "turn-9" }, { sourceType: "m4_pilot", key: "turn-9/X1" }, { sourceType: "upload", key: "turn-9/S1" },
    { sourceType: "rag", key: "a/S1" }, { sourceType: "m4_pilot", key: "turn 9/S1" }]) assert.equal(pilotSourceRef(other), null, JSON.stringify(other));
});

test("a signed-out request stores nothing", async () => {
  const { db } = world();
  for (const reply of [await sourceFeedbackPost(post(good), { authenticate: signedOut, prisma: db }), await sourceFeedbackOwnList(list, { authenticate: signedOut, prisma: db })]) {
    assert.equal(reply.status, 401);
    assert.deepEqual(reply.body, { ok: false, message: "api.common.unauthorized" });
  }
  assert.equal(db.rows.length, 0);
});

test("a report about a source of a person's own answer stores the source's document and title from the turn's record", async () => {
  const { db, anna } = world();
  const reply = await sourceFeedbackPost(post(good), { authenticate: signedIn("anna"), prisma: db });
  assert.equal(reply.status, 201);
  assert.equal(reply.body.duplicate, false);
  assert.deepEqual(Object.keys(reply.body.item).sort(), ["category", "createdAt", "id", "note", "sourceRef", "status", "turnId"]);
  const cited = anna.record.sources.find(source => source.ref === "S2");
  assert.ok(cited.document && cited.title, "the record names the cited source's document and title");
  const { id: _id, createdAt: _createdAt, dedupeKey, ...row } = db.rows[0];
  assert.match(dedupeKey, /^[0-9a-f]{64}$/);
  assert.deepEqual(row, { status: "OPEN", note: "Link annab vea 404.", resolvedAt: null, resolvedById: null, resolutionNote: null, reporterId: "anna", messageId: "m-anna-a",
    sourceId: cited.document, sourceType: "rag_v2", category: "broken_link", turnId: "turn-anna", sourceRef: "S2",
    sourceTitle: [cited.title, cited.provision].filter(Boolean).join(", ") });
  // The row holds no text of the conversation.
  assert.ok(!JSON.stringify(db.rows[0]).includes("Kust saab abi"));
  assert.ok(!JSON.stringify(db.rows[0]).includes("Teine väide"));
});

test("someone else's answer, a wrong conversation, an unknown turn and a reference the answer does not have all answer the same", async () => {
  const { db } = world();
  const cases = [
    { convId: "conv-boris", turnId: "turn-boris", ref: "S1" },
    { convId: "conv-anna", turnId: "turn-boris", ref: "S1" },
    { convId: "conv-boris", turnId: "turn-anna", ref: "S1" },
    { convId: "conv-anna", turnId: "turn-missing", ref: "S1" },
    { convId: "conv-anna", turnId: "turn-anna", ref: "S9" },
    // The retrieved but uncited evidence is not in the reader's list, so it cannot be reported either.
    { convId: "conv-anna", turnId: "turn-anna", ref: "S3" },
    { convId: "conv-anna", turnId: "turn-anna-old", ref: "S1" }
  ];
  for (const target of cases) {
    const reply = await sourceFeedbackPost(post({ ...target, category: "other" }), { authenticate: signedIn("anna"), prisma: db });
    assert.equal(reply.status, 404, JSON.stringify(target));
    assert.deepEqual(reply.body, { ok: false, message: "api.source_feedback.not_found" });
  }
  assert.equal(db.rows.length, 0);
});

test("a second send for the same source of the same answer makes no second row; another source of it is its own report", async () => {
  const { db } = world();
  await sourceFeedbackPost(post(good), { authenticate: signedIn("anna"), prisma: db });
  const again = await sourceFeedbackPost(post({ ...good, category: "other", note: "teine tekst" }), { authenticate: signedIn("anna"), prisma: db });
  assert.equal(again.status, 200);
  assert.equal(again.body.duplicate, true);
  assert.equal(db.rows.length, 1);
  assert.deepEqual([db.rows[0].category, db.rows[0].note], ["broken_link", "Link annab vea 404."]);
  assert.equal((await sourceFeedbackPost(post({ ...good, ref: "S1" }), { authenticate: signedIn("anna"), prisma: db })).status, 201);
  assert.equal(db.rows.length, 2);
});

test("two sends that race end as one row: the table's unique key decides", async () => {
  const { db } = world();
  db.createRace = data => db.rows.push({ ...data, id: "sf-race", status: "OPEN", createdAt: new Date() });
  const reply = await sourceFeedbackPost(post(good), { authenticate: signedIn("anna"), prisma: db });
  assert.equal(reply.status, 200);
  assert.equal(reply.body.duplicate, true);
  assert.equal(reply.body.item.id, "sf-race");
  assert.equal(db.rows.length, 1);
});

test("the note holds up to 500 characters, a reason from the list is required, and other fields are refused", async () => {
  const { db } = world();
  const send = (body, raw) => sourceFeedbackPost(post(body, raw), { authenticate: signedIn("anna"), prisma: db });
  assert.equal((await send({ ...good, note: "a".repeat(501) })).body.message, "api.source_feedback.note_too_long");
  assert.equal((await send({ ...good, note: 42 })).body.message, "api.source_feedback.invalid");
  for (const category of [undefined, "", "like", 5]) {
    const reply = await send({ ...good, category });
    assert.equal(reply.status, 400);
    assert.equal(reply.body.message, "api.source_feedback.reason_required");
  }
  // The retired contract (a message id and a source id) and forged fields are refused as a whole.
  for (const body of [{ messageId: "m-anna-a", sourceId: "x", category: "other" }, { ...good, reporterId: "boris" }, { ...good, sourceId: "doc" }, { ...good, ref: "1" }, { ...good, ref: "S1; drop" },
    { ...good, convId: "" }, { ...good, turnId: "a b" }, [good]]) {
    assert.equal((await send(body)).body.message, "api.source_feedback.invalid", JSON.stringify(body));
  }
  assert.equal((await send("{not json", true)).body.message, "api.source_feedback.invalid");
  assert.equal(db.rows.length, 0);
  assert.equal((await send({ ...good, note: ` ${"õ".repeat(500)}\n` })).status, 201);
  assert.equal(db.rows[0].note.length, 500);
  for (const category of SOURCE_FEEDBACK_CATEGORIES) {
    const one = world().db;
    assert.equal((await sourceFeedbackPost(post({ ...good, category }), { authenticate: signedIn("anna"), prisma: one })).status, 201, category);
  }
});

test("more than ten reports in an hour are refused", async () => {
  const turns = Array.from({ length: 6 }, (_, index) => publishedTurn(`turn-${index}`));
  const db = database({ conversations: { "conv-anna": "anna" },
    messages: turns.map((turn, index) => ({ id: `m-${index}`, conversationId: "conv-anna", role: "ASSISTANT", metadata: turn.messages.assistant.metadata })) });
  const targets = turns.flatMap((_, index) => ["S1", "S2"].map(ref => ({ convId: "conv-anna", turnId: `turn-${index}`, ref, category: "other" })));
  for (const target of targets.slice(0, 10)) assert.equal((await sourceFeedbackPost(post(target), { authenticate: signedIn("anna"), prisma: db })).status, 201);
  const eleventh = await sourceFeedbackPost(post(targets[10]), { authenticate: signedIn("anna"), prisma: db });
  assert.equal(eleventh.status, 429);
  assert.equal(eleventh.body.message, "api.source_feedback.rate_limited");
  assert.equal(db.rows.length, 10);
});

test("a person's own list names the answer sources they reported, and nobody else's", async () => {
  const { db } = world();
  await sourceFeedbackPost(post(good), { authenticate: signedIn("anna"), prisma: db });
  await sourceFeedbackPost(post({ convId: "conv-boris", turnId: "turn-boris", ref: "S1", category: "other" }), { authenticate: signedIn("boris"), prisma: db });
  assert.deepEqual((await sourceFeedbackOwnList(list, { authenticate: signedIn("anna"), prisma: db })).body, { ok: true, items: [{ turnId: "turn-anna", sourceRef: "S2", status: "OPEN" }] });
  assert.deepEqual((await sourceFeedbackOwnList(list, { authenticate: signedIn("carl"), prisma: db })).body.items, []);
});

test("only an administrator reads the queue and resolves; the queue names the document, not the reporter", async () => {
  const { db, anna } = world();
  const created = await sourceFeedbackPost(post(good), { authenticate: signedIn("anna"), prisma: db });
  const queue = new Request("http://localhost:3000/api/admin/source-feedback?status=OPEN");
  for (const authenticate of [signedOut, signedIn("anna"), signedIn("boris", { role: "SOCIAL_WORKER" })]) {
    assert.deepEqual(await sourceFeedbackAdminList(queue, { authenticate, prisma: db }), { status: 404, body: { ok: false, message: "api.common.not_found" } });
    assert.equal((await sourceFeedbackAdminResolve(patch({ resolutionNote: "x" }), created.body.item.id, { authenticate, prisma: db })).status, 404);
  }
  const { status, body } = await sourceFeedbackAdminList(queue, { authenticate: admin, prisma: db });
  assert.equal(status, 200);
  const cited = anna.record.sources.find(source => source.ref === "S2");
  assert.deepEqual(body.items.map(({ id: _id, createdAt: _createdAt, expiresAt: _expiresAt, ...item }) => item), [{ turnId: "turn-anna", sourceRef: "S2", sourceId: cited.document,
    sourceTitle: [cited.title, cited.provision].filter(Boolean).join(", "), sourceType: "rag_v2", category: "broken_link", note: "Link annab vea 404.", status: "OPEN", resolvedAt: null, resolutionNote: null }]);

  for (const invalid of [{}, { resolutionNote: " " }, { resolutionNote: "x".repeat(1001) }, { resolutionNote: "ok", status: "OPEN" }]) {
    assert.equal((await sourceFeedbackAdminResolve(patch(invalid), created.body.item.id, { authenticate: admin, prisma: db })).body.message, "api.source_feedback.resolution_invalid");
  }
  assert.equal((await sourceFeedbackAdminResolve(patch({ resolutionNote: "ok" }), "sf-none", { authenticate: admin, prisma: db })).status, 404);
  const resolved = await sourceFeedbackAdminResolve(patch({ resolutionNote: " Link parandatud. " }), created.body.item.id, { authenticate: admin, prisma: db });
  assert.equal(resolved.body.item.status, "RESOLVED");
  assert.deepEqual([db.rows[0].resolvedById, db.rows[0].resolutionNote], ["admin-1", "Link parandatud."]);
  await sourceFeedbackAdminResolve(patch({ resolutionNote: "Teine" }), created.body.item.id, { authenticate: admin, prisma: db });
  assert.equal(db.rows[0].resolutionNote, "Link parandatud.");
  assert.deepEqual(db.audit, [{ actorUserId: "admin-1", targetUserId: "anna", action: "SOURCE_FEEDBACK_RESOLVED", resourceType: "SourceFeedback", resourceId: created.body.item.id,
    meta: { sourceId: cited.document, category: "broken_link", resolutionNote: "Link parandatud." } }]);
  // The person sees their report as checked and cannot report that source of that answer again.
  assert.deepEqual((await sourceFeedbackOwnList(list, { authenticate: signedIn("anna"), prisma: db })).body.items, [{ turnId: "turn-anna", sourceRef: "S2", status: "RESOLVED" }]);
  assert.equal((await sourceFeedbackPost(post(good), { authenticate: signedIn("anna"), prisma: db })).body.duplicate, true);
});

test("every reason and every refusal has a sentence in all three languages, and the panel's old texts are gone", async () => {
  const source = await readFile(new URL("../lib/sourceFeedback.js", import.meta.url), "utf8");
  const serverKeys = [...new Set(source.match(/api\.source_feedback\.[a-z_]+/g))];
  assert.ok(serverKeys.length >= 6);
  const keys = [...serverKeys, ...SOURCE_FEEDBACK_CATEGORIES.map(category => `chat.sources.report_${category}`),
    ...["action", "category", "note", "note_label", "send", "sending", "cancel", "choose", "sent", "failed", "resolved"].map(key => `chat.sources.report_${key}`)];
  for (const locale of ["et", "en", "ru"]) {
    const catalogue = JSON.parse(await readFile(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
    for (const key of keys) {
      const value = key.split(".").reduce((node, part) => node?.[part], catalogue);
      assert.ok(typeof value === "string" && value.trim(), `${locale}: ${key}`);
    }
    assert.equal("report_open" in catalogue.chat.sources, false, locale);
  }
});

test("the migration only adds the three columns the schema names", async () => {
  const schema = (await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8")).match(/^model SourceFeedback \{[\s\S]*?^\}/m)[0];
  for (const field of [/turnId\s+String\?/, /sourceRef\s+String\?/, /sourceTitle\s+String\?\s+@db\.VarChar\(300\)/]) assert.match(schema, field);
  const sql = (await readFile(new URL("../prisma/migrations/20261014150000_source_feedback_answer_source/migration.sql", import.meta.url), "utf8")).replace(/^--.*$/gm, "");
  assert.match(sql, /ALTER TABLE "SourceFeedback"\s+ADD COLUMN "turnId" TEXT,\s+ADD COLUMN "sourceRef" TEXT,\s+ADD COLUMN "sourceTitle" VARCHAR\(300\);/);
  assert.doesNotMatch(sql, /DROP|NOT NULL|UPDATE|DELETE|CREATE/);
});
