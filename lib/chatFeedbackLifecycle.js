// Vestluse teadete eluiga: tagasiside vastuse kohta (AnswerFeedback) ja allika veateade (SourceFeedback).
//
// Omanik 11.10.2026: „teate säilivusaeg võiks olla 30 päeva" ja „inimese enda selgitus peab olema" andmeväljavõttes.
// Teade elab 30 päeva saatmisest, olgu ta lahendatud või mitte. Üle aja läinud rida on iga lugeja jaoks läinud ka siis,
// kui puhastus ei ole teda veel eemaldanud (sama reegel mis pöörde kirjel, lifetime.js): lugejad küsivad ainult elavaid
// ridu (`liveFeedback`) ja puhastus (`cleanupFeedbackRetention`, lib/retention.js) kustutab ülejäänu.
export const FEEDBACK_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
const asDate = value => (value instanceof Date ? value : new Date(value ?? Date.now()));

/** Hetk, millest varem saadetud teade on läinud. */
export function feedbackCutoff(now = new Date()) {
  return new Date(asDate(now).getTime() - FEEDBACK_RETENTION_DAYS * DAY_MS);
}

/** Päringu tingimus elavatele teadetele. */
export function liveFeedback(now = new Date()) {
  return { createdAt: { gte: feedbackCutoff(now) } };
}

/** Millal teade kustub: haldur näeb seda järjekorras, et lahendamata teade ei kaoks märkamatult. */
export function feedbackExpiresAt(createdAt) {
  return new Date(asDate(createdAt).getTime() + FEEDBACK_RETENTION_DAYS * DAY_MS);
}

export async function cleanupFeedbackRetention(db, { now = new Date() } = {}) {
  if (!db?.answerFeedback?.deleteMany || !db?.sourceFeedback?.deleteMany) throw new TypeError("Feedback retention database is required");
  const where = { createdAt: { lt: feedbackCutoff(now) } };
  const [answers, sources] = await Promise.all([db.answerFeedback.deleteMany({ where }), db.sourceFeedback.deleteMany({ where })]);
  return { answerFeedback: Number(answers?.count || 0), sourceFeedback: Number(sources?.count || 0) };
}

const iso = value => (value instanceof Date ? value.toISOString() : value || null);

/**
 * Inimese enda teated andmeväljavõtte jaoks: mida ta valis ja kirjutas, millal, mille kohta ja mis seisus teade on.
 * Halduri lahendusmärkust ega lahendaja isikut siin ei ole: need on halduse töökirjed.
 */
export async function collectOwnChatFeedback(db, userId, { now = new Date() } = {}) {
  const where = { reporterId: userId, ...liveFeedback(now) };
  const orderBy = [{ createdAt: "asc" }, { id: "asc" }];
  const [answers, sources] = await Promise.all([
    db.answerFeedback.findMany({ where, orderBy, select: { id: true, conversationId: true, turnId: true, category: true, note: true, status: true, createdAt: true, resolvedAt: true } }),
    db.sourceFeedback.findMany({ where, orderBy, select: { id: true, turnId: true, sourceRef: true, sourceTitle: true, category: true, note: true, status: true, createdAt: true, resolvedAt: true } })
  ]);
  return [
    ...answers.map(row => ({ kind: "answer_feedback", id: row.id, conversationId: row.conversationId, turnId: row.turnId, reason: row.category, note: row.note ?? null,
      status: row.status, createdAt: iso(row.createdAt), resolvedAt: iso(row.resolvedAt), deletedAfter: iso(feedbackExpiresAt(row.createdAt)) })),
    ...sources.map(row => ({ kind: "source_report", id: row.id, turnId: row.turnId ?? null, sourceRef: row.sourceRef ?? null, sourceTitle: row.sourceTitle ?? null, reason: row.category,
      note: row.note ?? null, status: row.status, createdAt: iso(row.createdAt), resolvedAt: iso(row.resolvedAt), deletedAfter: iso(feedbackExpiresAt(row.createdAt)) }))
  ];
}
