import { prisma } from "./prisma.js";
import { ANSWER_FEEDBACK_CATEGORIES, ANSWER_FEEDBACK_NOTE_MAX } from "./answerFeedbackReasons.js";

// Inimese teade ühe assistendi vastuse kohta (omanik 11.10.2026: „anna tagasisidet"). Hinnanguid ega loendureid ei ole:
// üks põhjus neljast, soovi korral märkus. Üks teade teataja ja pöörde kohta.
export { ANSWER_FEEDBACK_CATEGORIES, ANSWER_FEEDBACK_NOTE_MAX };

const ALLOWED_POST_FIELDS = new Set(["convId", "turnId", "category", "note"]);
const ID_SHAPE = /^[\w:.-]{1,200}$/;
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
    category: item.category,
    note: item.note,
    status: item.status,
    createdAt: item.createdAt
  };
}

export function parseAnswerFeedbackInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw feedbackError("api.answer_feedback.invalid");
  if (Object.keys(body).some(key => !ALLOWED_POST_FIELDS.has(key))) throw feedbackError("api.answer_feedback.invalid");
  const convId = typeof body.convId === "string" ? body.convId.trim() : "";
  const turnId = typeof body.turnId === "string" ? body.turnId.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  if (body.note !== undefined && body.note !== null && typeof body.note !== "string") throw feedbackError("api.answer_feedback.invalid");
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!ID_SHAPE.test(convId) || !ID_SHAPE.test(turnId)) throw feedbackError("api.answer_feedback.invalid");
  if (!ANSWER_FEEDBACK_CATEGORIES.includes(category)) throw feedbackError("api.answer_feedback.reason_required");
  if (note.length > ANSWER_FEEDBACK_NOTE_MAX) throw feedbackError("api.answer_feedback.note_too_long");
  return { convId, turnId, category, note: note || null };
}

export async function parseAnswerFeedbackJsonBody(request) {
  try {
    return await request.json();
  } catch {
    throw feedbackError("api.answer_feedback.invalid");
  }
}

// Kelle vastus see on: pööre peab kuuluma teataja enda vestlusse. Pöörde kirje (M4PilotTurn) elab lühemalt kui vestlus
// (ADR-094), seepärast on kaks teed: kirje ise, kuni ta alles on, ja muidu vestluse sõnumid, mis kannavad pöörde tunnust.
// Võõra, olematu ja vale vestluse pööre annavad sama vastuse, et tunnuse olemasolu välja ei paistaks.
async function ownTurn(db, reporterId, { convId, turnId }) {
  const row = await db.m4PilotTurn.findFirst({
    where: { id: turnId, chatTurn: { userId: reporterId, conversationId: convId } },
    select: { id: true, chatTurn: { select: { userMessageId: true, assistantMessageId: true } } }
  });
  if (row) {
    return { userMessageId: row.chatTurn?.userMessageId || null, assistantMessageId: row.chatTurn?.assistantMessageId || null };
  }
  const messages = await db.conversationMessage.findMany({
    where: { conversationId: convId, conversation: { userId: reporterId }, metadata: { path: ["m4TurnId"], equals: turnId } },
    select: { id: true, role: true },
    take: 4
  });
  const assistant = messages.find(message => message.role === "ASSISTANT");
  if (!assistant) return null;
  return { userMessageId: messages.find(message => message.role === "USER")?.id || null, assistantMessageId: assistant.id };
}

async function lockReporter(tx, reporterId) {
  if (typeof tx.$executeRaw !== "function") return;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`answer-feedback:${reporterId}`}))`;
}

export async function createAnswerFeedback(reporterId, body, options = {}) {
  const db = options.prisma || prisma;
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const input = parseAnswerFeedbackInput(body);
  const turn = await ownTurn(db, reporterId, input);
  if (!turn) throw feedbackError("api.answer_feedback.not_found", 404);
  const key = { reporterId_turnId: { reporterId, turnId: input.turnId } };

  try {
    const result = await db.$transaction(async tx => {
      await lockReporter(tx, reporterId);
      // Teine saatmine sama vastuse kohta ei tee uut rida ega muuda esimest.
      const existing = await tx.answerFeedback.findUnique({ where: key });
      if (existing) return { item: existing, duplicate: true };
      const count = await tx.answerFeedback.count({
        where: { reporterId, createdAt: { gte: new Date(now.getTime() - RATE_LIMIT_WINDOW_MS) } }
      });
      if (count >= RATE_LIMIT_MAX) throw feedbackError("api.answer_feedback.rate_limited", 429);
      const item = await tx.answerFeedback.create({
        data: {
          reporterId,
          conversationId: input.convId,
          turnId: input.turnId,
          userMessageId: turn.userMessageId,
          assistantMessageId: turn.assistantMessageId,
          category: input.category,
          note: input.note
        }
      });
      return { item, duplicate: false };
    });
    return { item: publicItem(result.item), duplicate: result.duplicate };
  } catch (error) {
    if (error?.code !== "P2002") throw error;
    const existing = await db.answerFeedback.findUnique({ where: key });
    if (!existing) throw error;
    return { item: publicItem(existing), duplicate: true };
  }
}

/** Teataja enda teated ühes vestluses: leht märgib nende järgi, millise vastuse kohta on tagasiside juba saadetud. */
export async function listOwnAnswerFeedback(reporterId, convId, options = {}) {
  const db = options.prisma || prisma;
  const conversationId = typeof convId === "string" ? convId.trim() : "";
  if (!ID_SHAPE.test(conversationId)) throw feedbackError("api.answer_feedback.invalid");
  const items = await db.answerFeedback.findMany({
    where: { reporterId, conversationId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 400,
    select: { turnId: true, status: true }
  });
  return items.map(item => ({ turnId: item.turnId, status: item.status }));
}

/**
 * Halduri järjekord. Avatud teate juures on ka küsimus ja vastus, mille kohta teade anti (vorm ütleb seda teatajale):
 * need loetakse vestluse enda sõnumitest, mitte teate reast, ja puuduvad, kui vestlus on kustutatud või aegunud.
 * Lahendatud teate juurde sisu ei loeta. Teataja isikut vastuses ei ole.
 */
export async function listAdminAnswerFeedback(options = {}) {
  const db = options.prisma || prisma;
  const status = options.status === "RESOLVED" ? "RESOLVED" : "OPEN";
  const items = await db.answerFeedback.findMany({
    where: { status },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 200,
    select: {
      id: true,
      turnId: true,
      userMessageId: true,
      assistantMessageId: true,
      category: true,
      note: true,
      status: true,
      createdAt: true,
      resolvedAt: true,
      resolutionNote: true
    }
  });
  const contents = new Map();
  if (status === "OPEN") {
    const ids = [...new Set(items.flatMap(item => [item.userMessageId, item.assistantMessageId]).filter(Boolean))];
    if (ids.length) {
      const messages = await db.conversationMessage.findMany({ where: { id: { in: ids } }, select: { id: true, content: true } });
      for (const message of messages) contents.set(message.id, message.content);
    }
  }
  return items.map(item => ({
    id: item.id,
    turnId: item.turnId,
    category: item.category,
    note: item.note,
    status: item.status,
    createdAt: item.createdAt,
    resolvedAt: item.resolvedAt,
    resolutionNote: item.resolutionNote,
    question: contents.get(item.userMessageId) ?? null,
    answer: contents.get(item.assistantMessageId) ?? null
  }));
}

export async function resolveAnswerFeedback(adminUserId, id, body = {}, options = {}) {
  const db = options.prisma || prisma;
  const valid = body && typeof body === "object" && !Array.isArray(body) && Object.keys(body).every(key => key === "resolutionNote");
  const resolutionNote = valid && typeof body.resolutionNote === "string" ? body.resolutionNote.trim() : "";
  if (!resolutionNote || resolutionNote.length > 1000) throw feedbackError("api.answer_feedback.resolution_invalid");
  return db.$transaction(async tx => {
    const existing = await tx.answerFeedback.findUnique({ where: { id } });
    if (!existing) throw feedbackError("api.answer_feedback.not_found", 404);
    if (existing.status === "RESOLVED") return publicItem(existing);
    const claimed = await tx.answerFeedback.updateMany({
      where: { id, status: "OPEN" },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: adminUserId, resolutionNote }
    });
    if (claimed.count === 1) {
      // Jälg hoiab ainult tunnuseid ja põhjust: teataja märkust ega vestluse sisu sinna ei kopeerita.
      await tx.dataAuditLog.create({
        data: {
          actorUserId: adminUserId,
          targetUserId: existing.reporterId,
          action: "ANSWER_FEEDBACK_RESOLVED",
          resourceType: "AnswerFeedback",
          resourceId: existing.id,
          meta: { turnId: existing.turnId, category: existing.category, resolutionNote }
        }
      });
    }
    const current = await tx.answerFeedback.findUnique({ where: { id } });
    if (!current) throw feedbackError("api.answer_feedback.not_found", 404);
    return publicItem(current);
  });
}

// Päringute käsitlejad. Sisselogimise kontroll antakse kaasa (`authenticate`, marsruudis requireChatUser), et sama
// käsitlejat saaks testida ilma seansita. Vastus on { status, body }.
const reply = (status, body) => ({ status, body });
const failureReply = error => {
  const isPublic = Number.isInteger(error?.status) && error.status >= 400 && error.status < 500;
  return reply(isPublic ? error.status : 500, { ok: false, message: isPublic ? error.code : "api.answer_feedback.failed" });
};
const isAdmin = auth => !!auth?.ok && (!!auth.isAdmin || auth.role === "ADMIN");
// Haldurile mitte kuuluv päring saab sama vastuse mis olematu aadress.
const notFound = () => reply(404, { ok: false, message: "api.common.not_found" });

export async function answerFeedbackPost(request, { authenticate, prisma: db } = {}) {
  const auth = await authenticate();
  if (!auth.ok) return reply(auth.status, { ok: false, message: auth.message });
  try {
    const result = await createAnswerFeedback(auth.userId, await parseAnswerFeedbackJsonBody(request), { prisma: db });
    return reply(result.duplicate ? 200 : 201, { ok: true, ...result });
  } catch (error) {
    return failureReply(error);
  }
}

export async function answerFeedbackOwnList(request, { authenticate, prisma: db } = {}) {
  const auth = await authenticate();
  if (!auth.ok) return reply(auth.status, { ok: false, message: auth.message });
  try {
    const items = await listOwnAnswerFeedback(auth.userId, new URL(request.url).searchParams.get("convId"), { prisma: db });
    return reply(200, { ok: true, items });
  } catch (error) {
    return failureReply(error);
  }
}

export async function answerFeedbackAdminList(request, { authenticate, prisma: db } = {}) {
  const auth = await authenticate({ includeRole: true });
  if (!isAdmin(auth)) return notFound();
  const status = new URL(request.url).searchParams.get("status");
  return reply(200, { ok: true, items: await listAdminAnswerFeedback({ status, prisma: db }) });
}

export async function answerFeedbackAdminResolve(request, id, { authenticate, prisma: db } = {}) {
  const auth = await authenticate({ includeRole: true });
  if (!isAdmin(auth)) return notFound();
  try {
    const body = await request.json().catch(() => null);
    return reply(200, { ok: true, item: await resolveAnswerFeedback(auth.userId, String(id || ""), body, { prisma: db }) });
  } catch (error) {
    return failureReply(error);
  }
}
