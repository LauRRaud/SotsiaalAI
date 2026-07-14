import test from "node:test";
import assert from "node:assert/strict";
import {
  createSourceFeedback,
  getOwnSourceFeedback,
  parseSourceFeedbackJsonBody,
  parseSourceFeedbackInput,
  resolveSourceFeedback
} from "../../lib/sourceFeedback.js";
import { getSourceAttributionId } from "../../lib/chat/sourceAttribution.js";
import { serializeDisplayedSourceTrust } from "../../lib/chat/sourceTrust.js";

function makeDb() {
  const rows = [];
  const audits = [];
  let sequence = Promise.resolve();
  const tx = {
    $executeRaw: async () => 1,
    sourceFeedback: {
      findUnique: async ({ where }) => rows.find(row => row.dedupeKey === where.dedupeKey || row.id === where.id) || null,
      findFirst: async ({ where }) => rows.find(row => row.id === where.id && row.reporterId === where.reporterId) || null,
      count: async ({ where }) => rows.filter(row => row.reporterId === where.reporterId && row.createdAt >= where.createdAt.gte).length,
      create: async ({ data }) => {
        const now = new Date("2026-07-14T12:00:00.000Z");
        const row = { id: `feedback-${rows.length + 1}`, status: "OPEN", createdAt: now, updatedAt: now, resolvedAt: null, resolutionNote: null, ...data };
        rows.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = rows.find(item => item.id === where.id);
        Object.assign(row, data, { updatedAt: new Date("2026-07-14T12:01:00.000Z") });
        return row;
      },
      updateMany: async ({ where, data }) => {
        const row = rows.find(item => item.id === where.id && item.status === where.status);
        if (!row) return { count: 0 };
        Object.assign(row, data, { updatedAt: new Date("2026-07-14T12:01:00.000Z") });
        return { count: 1 };
      }
    },
    dataAuditLog: { create: async ({ data }) => { audits.push(data); return data; } }
  };
  return {
    rows,
    audits,
    conversationMessage: {
      findFirst: async ({ where }) => where.id === "message-owner" && where.conversation.userId === "owner"
        ? { id: where.id, metadata: { displayed_sources: [{ source_id: "source-1", source_type: "state_guide", title: "Server title" }] } }
        : null
    },
    sourceFeedback: tx.sourceFeedback,
    $transaction: callback => {
      const run = sequence.then(() => callback(tx));
      sequence = run.catch(() => {});
      return run;
    }
  };
}

const VALID = { messageId: "message-owner", sourceId: "source-1", category: "outdated", note: "Kontrolli kuupäeva" };

test("feedback input rejects conversation payloads and forged source identity fields", () => {
  assert.throws(() => parseSourceFeedbackInput({ ...VALID, conversation: [{ role: "user", content: "private" }] }), /FORGED_FIELDS/);
  assert.throws(() => parseSourceFeedbackInput({ ...VALID, title: "Forged", sourceType: "law" }), /FORGED_FIELDS/);
});

test("malformed JSON is a public 400 instead of an internal 500", async () => {
  await assert.rejects(
    () => parseSourceFeedbackJsonBody({ json: async () => { throw new SyntaxError("bad json"); } }),
    error => error.status === 400 && error.code === "INVALID_BODY"
  );
});

test("server verifies the source against the reporter-owned persisted message", async () => {
  const db = makeDb();
  const result = await createSourceFeedback("owner", VALID, { prisma: db, now: new Date("2026-07-14T12:00:00Z") });
  assert.equal(result.item.sourceType, "state_guide");
  await assert.rejects(() => createSourceFeedback("foreign", VALID, { prisma: db }), error => error.status === 404);
});

test("feedback from the fresh response flow matches the pinned source id without a reload", async () => {
  const db = makeDb();
  const source = { source_id: "A", id: "B", type: "riigiteataja_regulation", title: "Õigusallikas" };
  const shownId = getSourceAttributionId(source, 0);
  const persisted = serializeDisplayedSourceTrust(source, shownId);
  db.conversationMessage.findFirst = async ({ where }) => where.id === "message-owner" && where.conversation.userId === "owner"
    ? { id: where.id, metadata: { displayed_sources: [persisted] } }
    : null;

  assert.equal(shownId, "A");
  const result = await createSourceFeedback("owner", { ...VALID, sourceId: shownId }, { prisma: db });
  assert.equal(result.item.sourceId, "A");
  assert.equal(result.item.sourceType, "riigiteataja_regulation");
});

test("parallel duplicate submissions create one open row and return idempotently", async () => {
  const db = makeDb();
  const results = await Promise.all(Array.from({ length: 8 }, () => createSourceFeedback("owner", VALID, { prisma: db })));
  assert.equal(db.rows.length, 1);
  assert.equal(results.filter(result => result.duplicate).length, 7);
});

test("database-backed hourly rate limit fails closed", async () => {
  const db = makeDb();
  const now = new Date("2026-07-14T12:30:00.000Z");
  for (let index = 0; index < 10; index += 1) {
    await createSourceFeedback("owner", { ...VALID, note: `note-${index}` }, { prisma: db, now });
  }
  await assert.rejects(
    () => createSourceFeedback("owner", { ...VALID, note: "eleventh" }, { prisma: db, now }),
    error => error.status === 429
  );
});

test("foreign feedback ids do not leak and admin resolution creates an audit row", async () => {
  const db = makeDb();
  const created = await createSourceFeedback("owner", VALID, { prisma: db });
  await assert.rejects(() => getOwnSourceFeedback("foreign", created.item.id, { prisma: db }), error => error.status === 404);
  const resolved = await resolveSourceFeedback("admin", created.item.id, { resolutionNote: "Verified and corrected upstream." }, { prisma: db });
  assert.equal(resolved.status, "RESOLVED");
  assert.equal(db.audits.length, 1);
  assert.equal(db.audits[0].action, "SOURCE_FEEDBACK_RESOLVED");
});
