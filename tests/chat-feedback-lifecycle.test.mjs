import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { FEEDBACK_RETENTION_DAYS, cleanupFeedbackRetention, collectOwnChatFeedback, feedbackCutoff, feedbackExpiresAt, liveFeedback } from "../lib/chatFeedbackLifecycle.js";
import { answerFeedbackAdminList, answerFeedbackOwnList, answerFeedbackPost } from "../lib/answerFeedback.js";
import { sourceFeedbackAdminList, sourceFeedbackOwnList, sourceFeedbackPost } from "../lib/sourceFeedback.js";
import { PRISMA_USER_RELATION_CLASSIFICATIONS, classifiedExportSurfaceNames, validatePersonalDataSurfaceRegistry } from "../lib/dataExport/personalDataSurfaceRegistry.js";

// Owner, 11.10.2026: "teate säilivusaeg võiks olla 30 päeva" and "inimese enda selgitus peab olema" (in the data export).
// A report about an answer or about a source lives 30 days from its sending, resolved or not; the person's own reports,
// with what they wrote, are in their data export.

const DAY = 86400000;
const matches = (row, where) => Object.entries(where).every(([key, value]) => !value || typeof value !== "object" || value instanceof Date ? row[key] === value
  : "gte" in value ? row[key] >= value.gte : "lt" in value ? row[key] < value.lt : "not" in value ? row[key] !== value.not : false);
function table(rows) {
  let serial = 0;
  return {
    rows,
    findMany: async ({ where }) => rows.filter(row => matches(row, where)).map(row => ({ ...row })),
    findUnique: async ({ where }) => rows.find(row => where.id ? row.id === where.id : where.dedupeKey ? row.dedupeKey === where.dedupeKey
      : row.reporterId === where.reporterId_turnId.reporterId && row.turnId === where.reporterId_turnId.turnId) || null,
    count: async ({ where }) => rows.filter(row => matches(row, where)).length,
    create: async ({ data }) => { const row = { id: `new-${++serial}`, status: "OPEN", note: null, resolvedAt: null, createdAt: new Date(), ...data }; rows.push(row); return row; },
    deleteMany: async ({ where }) => { const kept = rows.filter(row => !matches(row, where)), count = rows.length - kept.length; rows.splice(0, rows.length, ...kept); return { count }; }
  };
}
const ago = days => new Date(Date.now() - days * DAY);
const record = { version: "rag-v2/history-1", turnId: "turn-1", sources: [{ ref: "S1", title: "Sotsiaalhoolekande seadus", provision: "§ 133", document: "doc-shs" }] };
function world() {
  const answers = table([
    { id: "a-old", reporterId: "anna", conversationId: "conv-1", turnId: "turn-1", category: "unclear", note: "vana märkus", status: "OPEN", createdAt: ago(31), resolvedAt: null },
    { id: "a-edge", reporterId: "anna", conversationId: "conv-1", turnId: "turn-2", category: "other", note: null, status: "RESOLVED", createdAt: ago(29), resolvedAt: ago(28), resolvedById: "admin-1", resolutionNote: "halduri märkus" },
    { id: "a-new", reporterId: "anna", conversationId: "conv-1", turnId: "turn-3", category: "wrong_or_outdated", note: "Määr on vana.", status: "OPEN", createdAt: ago(1), resolvedAt: null },
    { id: "a-boris", reporterId: "boris", conversationId: "conv-b", turnId: "turn-b", category: "other", note: "Borisi märkus", status: "OPEN", createdAt: ago(2), resolvedAt: null }
  ]);
  const sources = table([
    { id: "s-old", reporterId: "anna", messageId: "m-1", turnId: "turn-1", sourceRef: "S1", sourceId: "doc-shs", sourceTitle: "Sotsiaalhoolekande seadus, § 133", sourceType: "rag_v2", category: "outdated", note: "vana allikamärkus",
      status: "RESOLVED", dedupeKey: "k-old", createdAt: ago(40), resolvedAt: ago(39) },
    { id: "s-new", reporterId: "anna", messageId: "m-1", turnId: "turn-3", sourceRef: "S2", sourceId: "doc-ska", sourceTitle: "Toimetulekutoetus", sourceType: "rag_v2", category: "broken_link", note: "Link annab vea 404.",
      status: "OPEN", dedupeKey: "k-new", createdAt: ago(3), resolvedAt: null }
  ]);
  const db = {
    answerFeedback: answers, sourceFeedback: sources,
    m4PilotTurn: { findFirst: async ({ where }) => where.chatTurn.userId === "anna" && where.chatTurn.conversationId === "conv-1" && where.id === "turn-1" ? { id: "turn-1", chatTurn: { userMessageId: "m-q", assistantMessageId: "m-1" } } : null },
    conversationMessage: {
      findMany: async () => [],
      findFirst: async ({ where }) => where.conversationId === "conv-1" && where.conversation.userId === "anna" && where.metadata.equals === "turn-1" ? { id: "m-1", metadata: { m4TurnId: "turn-1", m4History: record } } : null
    },
    $transaction: async fn => fn(db)
  };
  return db;
}
const signedIn = userId => async () => ({ ok: true, userId, isAdmin: false, role: "CLIENT" });
const admin = async () => ({ ok: true, userId: "admin-1", isAdmin: true, role: "ADMIN" });
const post = (path, body) => new Request(`http://localhost:3000${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

test("a report lives thirty days from its sending", () => {
  assert.equal(FEEDBACK_RETENTION_DAYS, 30);
  const now = new Date("2026-11-10T12:00:00Z");
  assert.equal(feedbackCutoff(now).toISOString(), "2026-10-11T12:00:00.000Z");
  assert.deepEqual(liveFeedback(now), { createdAt: { gte: new Date("2026-10-11T12:00:00Z") } });
  assert.equal(feedbackExpiresAt(new Date("2026-10-11T12:00:00Z")).toISOString(), "2026-11-10T12:00:00.000Z");
});

test("the sweep deletes reports older than thirty days from both tables, resolved or not, and leaves the rest", async () => {
  const db = world();
  assert.deepEqual(await cleanupFeedbackRetention(db), { answerFeedback: 1, sourceFeedback: 1 });
  assert.deepEqual(db.answerFeedback.rows.map(row => row.id), ["a-edge", "a-new", "a-boris"]);
  assert.deepEqual(db.sourceFeedback.rows.map(row => row.id), ["s-new"]);
  // Running it again finds nothing; a day later the 29-day-old report is still inside its time, two days later it is not.
  assert.deepEqual(await cleanupFeedbackRetention(db), { answerFeedback: 0, sourceFeedback: 0 });
  assert.deepEqual(await cleanupFeedbackRetention(db, { now: new Date(Date.now() + 0.5 * DAY) }), { answerFeedback: 0, sourceFeedback: 0 });
  assert.deepEqual(await cleanupFeedbackRetention(db, { now: new Date(Date.now() + 2 * DAY) }), { answerFeedback: 1, sourceFeedback: 0 });
  await assert.rejects(() => cleanupFeedbackRetention({}), /Feedback retention database is required/);
});

test("a report past its time is gone for every reader before the sweep has removed it", async () => {
  const db = world();
  const own = await answerFeedbackOwnList(new Request("http://localhost:3000/api/answer-feedback?convId=conv-1"), { authenticate: signedIn("anna"), prisma: db });
  assert.deepEqual(own.body.items.map(item => item.turnId), ["turn-2", "turn-3"]);
  assert.deepEqual((await sourceFeedbackOwnList(new Request("http://localhost:3000/api/source-feedback"), { authenticate: signedIn("anna"), prisma: db })).body.items,
    [{ turnId: "turn-3", sourceRef: "S2", status: "OPEN" }]);
  const answers = await answerFeedbackAdminList(new Request("http://localhost:3000/api/admin/answer-feedback?status=OPEN"), { authenticate: admin, prisma: db });
  assert.deepEqual(answers.body.items.map(item => item.turnId), ["turn-3", "turn-b"]);
  const sources = await sourceFeedbackAdminList(new Request("http://localhost:3000/api/admin/source-feedback?status=RESOLVED"), { authenticate: admin, prisma: db });
  assert.deepEqual(sources.body.items, []);
  // The queue says when each report is deleted, so an unresolved one does not vanish unnoticed.
  for (const item of answers.body.items) assert.equal(new Date(item.expiresAt).getTime(), new Date(item.createdAt).getTime() + 30 * DAY);
  const open = await sourceFeedbackAdminList(new Request("http://localhost:3000/api/admin/source-feedback"), { authenticate: admin, prisma: db });
  assert.equal(new Date(open.body.items[0].expiresAt).getTime(), new Date(open.body.items[0].createdAt).getTime() + 30 * DAY);
});

test("after its time a report no longer stands in the way of a new one about the same answer or source", async () => {
  const db = world();
  const answer = await answerFeedbackPost(post("/api/answer-feedback", { convId: "conv-1", turnId: "turn-1", category: "other", note: "uus märkus" }), { authenticate: signedIn("anna"), prisma: db });
  assert.equal(answer.status, 201);
  assert.equal(answer.body.duplicate, false);
  assert.ok(!db.answerFeedback.rows.some(row => row.id === "a-old"));
  assert.equal(db.answerFeedback.rows.filter(row => row.reporterId === "anna" && row.turnId === "turn-1").length, 1);
  // Only the reporter's own expired rows are removed on the way; a live report still makes a second send a duplicate.
  assert.ok(db.answerFeedback.rows.some(row => row.id === "a-boris"));
  db.sourceFeedback.rows.find(row => row.id === "s-old").dedupeKey = (await import("node:crypto")).createHash("sha256").update(["anna", "turn-1", "S1"].join("\u001f")).digest("hex");
  const source = await sourceFeedbackPost(post("/api/source-feedback", { convId: "conv-1", turnId: "turn-1", ref: "S1", category: "other" }), { authenticate: signedIn("anna"), prisma: db });
  assert.equal(source.status, 201);
  assert.equal(source.body.duplicate, false);
  assert.ok(!db.sourceFeedback.rows.some(row => row.id === "s-old"));
  assert.equal((await sourceFeedbackPost(post("/api/source-feedback", { convId: "conv-1", turnId: "turn-1", ref: "S1", category: "outdated" }), { authenticate: signedIn("anna"), prisma: db })).body.duplicate, true);
});

test("the person's data export holds their own reports with what they wrote, and nothing of the administrator's or of others", async () => {
  const db = world();
  const rows = await collectOwnChatFeedback(db, "anna");
  assert.deepEqual(rows.map(row => [row.kind, row.id]), [["answer_feedback", "a-edge"], ["answer_feedback", "a-new"], ["source_report", "s-new"]]);
  const [resolved, answer, source] = rows;
  assert.deepEqual(Object.keys(answer), ["kind", "id", "conversationId", "turnId", "reason", "note", "status", "createdAt", "resolvedAt", "deletedAfter"]);
  assert.deepEqual([answer.reason, answer.note, answer.status, answer.resolvedAt], ["wrong_or_outdated", "Määr on vana.", "OPEN", null]);
  assert.deepEqual(Object.keys(source), ["kind", "id", "turnId", "sourceRef", "sourceTitle", "reason", "note", "status", "createdAt", "resolvedAt", "deletedAfter"]);
  assert.deepEqual([source.sourceTitle, source.sourceRef, source.reason, source.note], ["Toimetulekutoetus", "S2", "broken_link", "Link annab vea 404."]);
  assert.equal(new Date(source.deletedAfter).getTime(), new Date(source.createdAt).getTime() + 30 * DAY);
  assert.equal(resolved.status, "RESOLVED");
  assert.match(resolved.resolvedAt, /^\d{4}-\d{2}-\d{2}T/);
  const text = JSON.stringify(rows);
  for (const absent of ["halduri märkus", "admin-1", "resolvedById", "resolutionNote", "Borisi märkus", "vana märkus", "vana allikamärkus", "dedupeKey", "messageId"]) assert.ok(!text.includes(absent), absent);
  assert.deepEqual(await collectOwnChatFeedback(db, "carl"), []);
});

test("the export register names the reports as exported and the sweep and the export are wired in", async () => {
  const byRelation = new Map(PRISMA_USER_RELATION_CLASSIFICATIONS.map(item => [item.relation, item]));
  for (const relation of ["answerFeedbackReported", "sourceFeedbackReported"]) {
    assert.equal(byRelation.get(relation).exportDecision, "EXPORTED", relation);
    assert.deepEqual(byRelation.get(relation).manifestSurfaces, ["chat_feedback"], relation);
  }
  // The administrator's side of a report (who resolved it) is not the reporter's data and is not exported.
  for (const relation of ["answerFeedbackResolved", "sourceFeedbackResolved"]) assert.notEqual(byRelation.get(relation).exportDecision, "EXPORTED", relation);
  assert.ok(classifiedExportSurfaceNames().includes("chat_feedback"));
  const exportSource = await readFile(new URL("../lib/dataExport/registry.js", import.meta.url), "utf8");
  const surfaces = [...exportSource.matchAll(/^\s+name: "([a-z_]+)", version:/gm)].map(match => match[1]);
  assert.ok(surfaces.includes("chat_feedback"));
  assert.match(exportSource, /name: "chat_feedback"[\s\S]{0,200}collectOwnChatFeedback\(db, userId\)[\s\S]{0,120}chat-feedback\.ndjson/);
  const schemaText = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const result = validatePersonalDataSurfaceRegistry({ schemaText, exportSurfaceNames: surfaces });
  for (const list of Object.values(result)) assert.deepEqual(list.filter(name => /feedback/i.test(name)), []);
  const retention = await readFile(new URL("../lib/retention.js", import.meta.url), "utf8");
  assert.match(retention, /cleanupFeedbackRetention\(prisma, \{ now \}\)/);
  assert.match(retention, /feedbackDays: FEEDBACK_RETENTION_DAYS/);
});

test("the privacy notice states the thirty days and the export in all three languages", async () => {
  const page = await readFile(new URL("../components/alalehed/PrivaatsusBody.jsx", import.meta.url), "utf8");
  assert.match(page, /t\("privacy\.section7Feedback\.body"\)/);
  for (const [locale, words] of [["et", ["7.13", "30 päeva", "andmeväljavõttes"]], ["en", ["7.13", "30 days", "data export"]], ["ru", ["7.13", "30 дней", "выгрузку данных"]]]) {
    const body = JSON.parse(await readFile(new URL(`../messages/${locale}.json`, import.meta.url), "utf8")).privacy.section7Feedback.body;
    for (const word of words) assert.ok(body.includes(word), `${locale}: ${word}`);
  }
});
