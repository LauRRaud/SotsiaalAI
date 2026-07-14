import { createHash } from "node:crypto";
import { prisma } from "./prisma.js";
import { getSourceAttributionId } from "./chat/sourceAttribution.js";

export const SOURCE_FEEDBACK_CATEGORIES = Object.freeze([
  "outdated",
  "wrong_content",
  "broken_link",
  "wrong_source",
  "other"
]);

const ALLOWED_POST_FIELDS = new Set(["messageId", "sourceId", "category", "note"]);
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function sourceList(metadata) {
  if (!metadata || typeof metadata !== "object") return [];
  const value = metadata.displayed_sources || metadata.displayedSources;
  return Array.isArray(value) ? value : [];
}

function publicItem(item) {
  return {
    id: item.id,
    sourceId: item.sourceId,
    sourceType: item.sourceType,
    category: item.category,
    note: item.note,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    resolvedAt: item.resolvedAt,
    resolutionNote: item.resolutionNote
  };
}

function feedbackError(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

export function parseSourceFeedbackInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw feedbackError("INVALID_BODY");
  const unknown = Object.keys(body).filter(key => !ALLOWED_POST_FIELDS.has(key));
  if (unknown.length) throw feedbackError("FORGED_FIELDS");
  const messageId = String(body.messageId || "").trim();
  const sourceId = String(body.sourceId || "").trim();
  const category = String(body.category || "").trim();
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!messageId || messageId.length > 200 || !sourceId || sourceId.length > 500) throw feedbackError("INVALID_IDENTITY");
  if (!SOURCE_FEEDBACK_CATEGORIES.includes(category)) throw feedbackError("INVALID_CATEGORY");
  if (note.length > 500) throw feedbackError("NOTE_TOO_LONG");
  return { messageId, sourceId, category, note: note || null };
}

export async function parseSourceFeedbackJsonBody(request) {
  try {
    return await request.json();
  } catch {
    throw feedbackError("INVALID_BODY", 400);
  }
}

function createDedupeKey(reporterId, input) {
  return createHash("sha256")
    .update([reporterId, input.messageId, input.sourceId, input.category, input.note || ""].join("\u001f"))
    .digest("hex");
}

async function lockReporter(tx, reporterId) {
  if (typeof tx.$executeRaw !== "function") return;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`source-feedback:${reporterId}`}))`;
}

export async function createSourceFeedback(reporterId, body, options = {}) {
  const db = options.prisma || prisma;
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const input = parseSourceFeedbackInput(body);
  const message = await db.conversationMessage.findFirst({
    where: {
      id: input.messageId,
      role: "ASSISTANT",
      conversation: { userId: reporterId }
    },
    select: { id: true, metadata: true }
  });
  if (!message) throw feedbackError("SOURCE_NOT_FOUND", 404);
  const matched = sourceList(message.metadata).find((source, index) => {
    const pinnedId = String(source?.source_id || source?.sourceId || "").trim();
    return pinnedId === input.sourceId || getSourceAttributionId(source, index) === input.sourceId;
  });
  if (!matched) throw feedbackError("SOURCE_NOT_FOUND", 404);
  const sourceType = String(
    matched?.source_trust_type || matched?.source_type || matched?.sourceType || matched?.origin || matched?.type || "unknown"
  ).trim() || "unknown";
  const dedupeKey = createDedupeKey(reporterId, input);

  try {
    const result = await db.$transaction(async tx => {
      await lockReporter(tx, reporterId);
      const existing = await tx.sourceFeedback.findUnique({ where: { dedupeKey } });
      if (existing) return { item: existing, duplicate: true };
      const count = await tx.sourceFeedback.count({
        where: {
          reporterId,
          createdAt: { gte: new Date(now.getTime() - RATE_LIMIT_WINDOW_MS) }
        }
      });
      if (count >= RATE_LIMIT_MAX) throw feedbackError("RATE_LIMITED", 429);
      const item = await tx.sourceFeedback.create({
        data: {
          reporterId,
          messageId: input.messageId,
          sourceId: input.sourceId,
          sourceType,
          category: input.category,
          note: input.note,
          dedupeKey
        }
      });
      return { item, duplicate: false };
    });
    return { item: publicItem(result.item), duplicate: result.duplicate };
  } catch (error) {
    if (error?.code !== "P2002") throw error;
    const existing = await db.sourceFeedback.findUnique({ where: { dedupeKey } });
    if (!existing) throw error;
    return { item: publicItem(existing), duplicate: true };
  }
}

export async function listOwnSourceFeedback(reporterId, options = {}) {
  const db = options.prisma || prisma;
  const items = await db.sourceFeedback.findMany({
    where: { reporterId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100
  });
  return items.map(publicItem);
}

export async function getOwnSourceFeedback(reporterId, id, options = {}) {
  const db = options.prisma || prisma;
  const item = await db.sourceFeedback.findFirst({ where: { id, reporterId } });
  if (!item) throw feedbackError("NOT_FOUND", 404);
  return publicItem(item);
}

export async function listAdminSourceFeedback(options = {}) {
  const db = options.prisma || prisma;
  const status = options.status === "RESOLVED" ? "RESOLVED" : "OPEN";
  return db.sourceFeedback.findMany({
    where: { status },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 200,
    select: {
      id: true,
      reporterId: true,
      messageId: true,
      sourceId: true,
      sourceType: true,
      category: true,
      note: true,
      status: true,
      createdAt: true,
      resolvedAt: true,
      resolutionNote: true
    }
  });
}

export async function resolveSourceFeedback(adminUserId, id, body = {}, options = {}) {
  const db = options.prisma || prisma;
  const resolutionNote = typeof body.resolutionNote === "string" ? body.resolutionNote.trim() : "";
  if (!resolutionNote || resolutionNote.length > 1000 || Object.keys(body).some(key => key !== "resolutionNote")) {
    throw feedbackError("INVALID_RESOLUTION");
  }
  return db.$transaction(async tx => {
    const existing = await tx.sourceFeedback.findUnique({ where: { id } });
    if (!existing) throw feedbackError("NOT_FOUND", 404);
    if (existing.status === "RESOLVED") return existing;
    const resolvedAt = new Date();
    const claimed = await tx.sourceFeedback.updateMany({
      where: { id, status: "OPEN" },
      data: {
        status: "RESOLVED",
        resolvedAt,
        resolvedById: adminUserId,
        resolutionNote,
        dedupeKey: `${existing.dedupeKey}:resolved:${existing.id}`
      }
    });
    if (claimed.count !== 1) {
      const current = await tx.sourceFeedback.findUnique({ where: { id } });
      if (!current) throw feedbackError("NOT_FOUND", 404);
      return current;
    }
    await tx.dataAuditLog.create({
      data: {
        actorUserId: adminUserId,
        targetUserId: existing.reporterId,
        action: "SOURCE_FEEDBACK_RESOLVED",
        resourceType: "SourceFeedback",
        resourceId: existing.id,
        meta: { sourceId: existing.sourceId, category: existing.category, resolutionNote }
      }
    });
    return tx.sourceFeedback.findUnique({ where: { id } });
  });
}

export { feedbackError };
