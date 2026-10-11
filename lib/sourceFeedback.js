import { createHash } from "node:crypto";
import { prisma } from "./prisma.js";
import { SOURCE_FEEDBACK_CATEGORIES, SOURCE_FEEDBACK_NOTE_MAX } from "./sourceFeedbackReasons.js";
import { feedbackCutoff, feedbackExpiresAt, liveFeedback } from "./chatFeedbackLifecycle.js";

// Inimese teade ühe vastuse ühe allika kohta („Teata veast" allikate paneelis). Allikas on vastuse viide (S3) ühes
// pöördes: teade võetakse vastu ainult teataja enda vestluse vastuse kohta ja ainult viitele, mis selles vastuses on.
// Üks teade teataja, pöörde ja viite kohta.
export { SOURCE_FEEDBACK_CATEGORIES, SOURCE_FEEDBACK_NOTE_MAX };

const ALLOWED_POST_FIELDS = new Set(["convId", "turnId", "ref", "category", "note"]);
const ID_SHAPE = /^[\w:.-]{1,200}$/;
const REF_SHAPE = /^S\d{1,4}$/;
const TITLE_MAX = 300;
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function feedbackError(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function publicItem(item) {
  return {
    id: item.id,
    turnId: item.turnId,
    sourceRef: item.sourceRef,
    category: item.category,
    note: item.note,
    status: item.status,
    createdAt: item.createdAt
  };
}

export function parseSourceFeedbackInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw feedbackError("api.source_feedback.invalid");
  if (Object.keys(body).some(key => !ALLOWED_POST_FIELDS.has(key))) throw feedbackError("api.source_feedback.invalid");
  const convId = typeof body.convId === "string" ? body.convId.trim() : "";
  const turnId = typeof body.turnId === "string" ? body.turnId.trim() : "";
  const ref = typeof body.ref === "string" ? body.ref.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  if (body.note !== undefined && body.note !== null && typeof body.note !== "string") throw feedbackError("api.source_feedback.invalid");
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!ID_SHAPE.test(convId) || !ID_SHAPE.test(turnId) || !REF_SHAPE.test(ref)) throw feedbackError("api.source_feedback.invalid");
  if (!SOURCE_FEEDBACK_CATEGORIES.includes(category)) throw feedbackError("api.source_feedback.reason_required");
  if (note.length > SOURCE_FEEDBACK_NOTE_MAX) throw feedbackError("api.source_feedback.note_too_long");
  return { convId, turnId, ref, category, note: note || null };
}

export async function parseSourceFeedbackJsonBody(request) {
  try {
    return await request.json();
  } catch {
    throw feedbackError("api.source_feedback.invalid");
  }
}

// Vastuse allikas, millele teade antakse: vastuse sõnum teataja enda vestluses kannab pöörde püsikirjet (ADR-094),
// kus on vastuses viidatud allikad koos dokumendi tunnusega. Võõras vestlus, olematu pööre ja viide, mida selles
// vastuses ei ole, annavad sama vastuse.
async function answerSource(db, reporterId, { convId, turnId, ref }) {
  const message = await db.conversationMessage.findFirst({
    where: { conversationId: convId, role: "ASSISTANT", conversation: { userId: reporterId }, metadata: { path: ["m4TurnId"], equals: turnId } },
    select: { id: true, metadata: true }
  });
  const sources = message?.metadata?.m4History?.sources;
  const source = Array.isArray(sources) ? sources.find(item => item?.ref === ref) : null;
  if (!source) return null;
  const title = [source.title, source.provision].filter(part => typeof part === "string" && part.trim()).map(part => part.trim()).join(", ");
  return {
    messageId: message.id,
    sourceId: typeof source.document === "string" && source.document ? source.document.slice(0, 500) : `${turnId}/${ref}`,
    sourceTitle: title ? title.slice(0, TITLE_MAX) : null
  };
}

function createDedupeKey(reporterId, input) {
  return createHash("sha256").update([reporterId, input.turnId, input.ref].join("\u001f")).digest("hex");
}

async function lockReporter(tx, reporterId) {
  if (typeof tx.$executeRaw !== "function") return;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`source-feedback:${reporterId}`}))`;
}

export async function createSourceFeedback(reporterId, body, options = {}) {
  const db = options.prisma || prisma;
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const input = parseSourceFeedbackInput(body);
  const source = await answerSource(db, reporterId, input);
  if (!source) throw feedbackError("api.source_feedback.not_found", 404);
  const dedupeKey = createDedupeKey(reporterId, input);

  try {
    const result = await db.$transaction(async tx => {
      await lockReporter(tx, reporterId);
      // Üle aja läinud teade on läinud (30 päeva, chatFeedbackLifecycle.js): ta ei takista uut teadet sama allika kohta.
      await tx.sourceFeedback.deleteMany({ where: { reporterId, createdAt: { lt: feedbackCutoff(now) } } });
      // Teine saatmine sama vastuse sama allika kohta ei tee uut rida ega muuda esimest.
      const existing = await tx.sourceFeedback.findUnique({ where: { dedupeKey } });
      if (existing) return { item: existing, duplicate: true };
      const count = await tx.sourceFeedback.count({
        where: { reporterId, createdAt: { gte: new Date(now.getTime() - RATE_LIMIT_WINDOW_MS) } }
      });
      if (count >= RATE_LIMIT_MAX) throw feedbackError("api.source_feedback.rate_limited", 429);
      const item = await tx.sourceFeedback.create({
        data: {
          reporterId,
          messageId: source.messageId,
          sourceId: source.sourceId,
          sourceType: "rag_v2",
          category: input.category,
          note: input.note,
          dedupeKey,
          turnId: input.turnId,
          sourceRef: input.ref,
          sourceTitle: source.sourceTitle
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

/** Teataja enda teated: paneel märgib nende järgi allikad, mille kohta teade on juba saadetud. */
export async function listOwnSourceFeedback(reporterId, options = {}) {
  const db = options.prisma || prisma;
  const items = await db.sourceFeedback.findMany({
    where: { reporterId, turnId: { not: null }, ...liveFeedback() },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
    select: { turnId: true, sourceRef: true, status: true }
  });
  return items.map(item => ({ turnId: item.turnId, sourceRef: item.sourceRef, status: item.status }));
}

/** Halduri järjekord: põhjus, märkus ja allikas (pealkiri, dokumendi tunnus, pööre ja viide). Teataja isikut ei ole.
 *  `expiresAt` ütleb, millal teade kustub. */
export async function listAdminSourceFeedback(options = {}) {
  const db = options.prisma || prisma;
  const status = options.status === "RESOLVED" ? "RESOLVED" : "OPEN";
  const items = await db.sourceFeedback.findMany({
    where: { status, ...liveFeedback() },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 200,
    select: {
      id: true,
      turnId: true,
      sourceRef: true,
      sourceId: true,
      sourceTitle: true,
      sourceType: true,
      category: true,
      note: true,
      status: true,
      createdAt: true,
      resolvedAt: true,
      resolutionNote: true
    }
  });
  return items.map(item => ({
    id: item.id,
    turnId: item.turnId,
    sourceRef: item.sourceRef,
    sourceId: item.sourceId,
    sourceTitle: item.sourceTitle,
    sourceType: item.sourceType,
    category: item.category,
    note: item.note,
    status: item.status,
    createdAt: item.createdAt,
    expiresAt: feedbackExpiresAt(item.createdAt),
    resolvedAt: item.resolvedAt,
    resolutionNote: item.resolutionNote
  }));
}

export async function resolveSourceFeedback(adminUserId, id, body = {}, options = {}) {
  const db = options.prisma || prisma;
  const valid = body && typeof body === "object" && !Array.isArray(body) && Object.keys(body).every(key => key === "resolutionNote");
  const resolutionNote = valid && typeof body.resolutionNote === "string" ? body.resolutionNote.trim() : "";
  if (!resolutionNote || resolutionNote.length > 1000) throw feedbackError("api.source_feedback.resolution_invalid");
  return db.$transaction(async tx => {
    const existing = await tx.sourceFeedback.findUnique({ where: { id } });
    if (!existing) throw feedbackError("api.source_feedback.not_found", 404);
    if (existing.status === "RESOLVED") return publicItem(existing);
    const claimed = await tx.sourceFeedback.updateMany({
      where: { id, status: "OPEN" },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: adminUserId, resolutionNote }
    });
    if (claimed.count === 1) {
      // Jälg hoiab tunnuseid ja põhjust: teataja märkust sinna ei kopeerita.
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
    }
    const current = await tx.sourceFeedback.findUnique({ where: { id } });
    if (!current) throw feedbackError("api.source_feedback.not_found", 404);
    return publicItem(current);
  });
}

// Päringute käsitlejad. Sisselogimise kontroll antakse kaasa (`authenticate`, marsruudis requireChatUser), et sama
// käsitlejat saaks testida ilma seansita. Vastus on { status, body }.
const reply = (status, body) => ({ status, body });
const failureReply = error => {
  const isPublic = Number.isInteger(error?.status) && error.status >= 400 && error.status < 500;
  return reply(isPublic ? error.status : 500, { ok: false, message: isPublic ? error.code : "api.source_feedback.failed" });
};
const isAdmin = auth => !!auth?.ok && (!!auth.isAdmin || auth.role === "ADMIN");
// Haldurile mitte kuuluv päring saab sama vastuse mis olematu aadress.
const notFound = () => reply(404, { ok: false, message: "api.common.not_found" });

export async function sourceFeedbackPost(request, { authenticate, prisma: db } = {}) {
  const auth = await authenticate();
  if (!auth.ok) return reply(auth.status, { ok: false, message: auth.message });
  try {
    const result = await createSourceFeedback(auth.userId, await parseSourceFeedbackJsonBody(request), { prisma: db });
    return reply(result.duplicate ? 200 : 201, { ok: true, ...result });
  } catch (error) {
    return failureReply(error);
  }
}

export async function sourceFeedbackOwnList(_request, { authenticate, prisma: db } = {}) {
  const auth = await authenticate();
  if (!auth.ok) return reply(auth.status, { ok: false, message: auth.message });
  return reply(200, { ok: true, items: await listOwnSourceFeedback(auth.userId, { prisma: db }) });
}

export async function sourceFeedbackAdminList(request, { authenticate, prisma: db } = {}) {
  const auth = await authenticate({ includeRole: true });
  if (!isAdmin(auth)) return notFound();
  const status = new URL(request.url).searchParams.get("status");
  return reply(200, { ok: true, items: await listAdminSourceFeedback({ status, prisma: db }) });
}

export async function sourceFeedbackAdminResolve(request, id, { authenticate, prisma: db } = {}) {
  const auth = await authenticate({ includeRole: true });
  if (!isAdmin(auth)) return notFound();
  try {
    const body = await request.json().catch(() => null);
    return reply(200, { ok: true, item: await resolveSourceFeedback(auth.userId, String(id || ""), body, { prisma: db }) });
  } catch (error) {
    return failureReply(error);
  }
}
