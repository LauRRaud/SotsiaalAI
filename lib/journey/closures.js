/**
 * TEEKOND K1-f — paus ja lõpetamine: lugemine ja kirjutamise sammud.
 *
 * Teekonna seisu muutmine (ARCHIVED ja tagasi) käib `service.js`-is ühes tehingus
 * koos sündmuse ja versioonikontrolliga; siin on ainult selle tehingu sammud ja
 * lugemine. Iga päring filtreerib omaniku järgi.
 */
import { JOURNEY_ASSESSMENT_LIMITS } from "./assessmentRules.js";
import { JOURNEY_CLOSURE_LIMITS, JourneyClosureKind, summarizeClosures } from "./closureRules.js";
import { todayInEstonia } from "./stepRules.js";

const CLOSURE_SELECT = Object.freeze({
  id: true,
  journeyId: true,
  kind: true,
  outcome: true,
  note: true,
  resumeOn: true,
  closedAt: true,
  reopenedAt: true
});

function publicError(message, status = 400, extra = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
}

function iso(value) {
  return value?.toISOString?.() || value || null;
}

function serialize(row) {
  return {
    id: row.id,
    kind: row.kind,
    outcome: row.outcome || null,
    note: row.note || null,
    resumeOn: row.resumeOn || null,
    closedAt: iso(row.closedAt),
    reopenedAt: iso(row.reopenedAt)
  };
}

/** Teekonna pausid ja lõpetamised. Kutsuja on juba tõendanud, et Teekond on selle inimese oma. */
export async function readJourneyClosures(db, userId, journeyId, { status, now = new Date() } = {}) {
  const rows = await db.journeyClosure.findMany({
    where: { journeyId, ownerUserId: userId },
    select: CLOSURE_SELECT,
    orderBy: [{ closedAt: "desc" }, { id: "desc" }]
  });
  return summarizeClosures(rows.map(serialize), { archived: status === "ARCHIVED", today: todayInEstonia(now) });
}

/**
 * Loendi jaoks: kõrvale pandud Teekondade praegune paus või lõpetamine ühe päringuga.
 * @returns {Promise<Map<string, object>>} Teekonna id → `{ kind, outcome, resumeOn, closedAt, resumeDue }`
 */
export async function readCurrentClosures(db, userId, journeyIds, { now = new Date() } = {}) {
  const ids = [...new Set((journeyIds || []).filter(Boolean))];
  const result = new Map();
  if (!ids.length) return result;
  const rows = await db.journeyClosure.findMany({
    where: { ownerUserId: userId, journeyId: { in: ids }, reopenedAt: null },
    select: CLOSURE_SELECT,
    orderBy: [{ closedAt: "desc" }, { id: "desc" }]
  });
  const today = todayInEstonia(now);
  for (const row of rows) {
    if (result.has(row.journeyId)) continue;
    const { current } = summarizeClosures([serialize(row)], { archived: true, today });
    result.set(row.journeyId, {
      kind: current.kind,
      outcome: current.outcome,
      resumeOn: current.resumeOn,
      closedAt: current.closedAt,
      resumeDue: current.resumeDue
    });
  }
  return result;
}

/**
 * Tehingu samm: kirjutab pausi või lõpetamise rea; lõpetamisel koos antud
 * lõpphinnanguga ka viimase märke „kuidas mul läheb".
 */
export async function writeJourneyClosure(tx, { journeyId, userId, closure, now }) {
  const count = await tx.journeyClosure.count({ where: { journeyId, ownerUserId: userId } });
  if (count >= JOURNEY_CLOSURE_LIMITS.perJourney) {
    throw publicError("journeys.errors.closure_limit_reached", 409, { limit: JOURNEY_CLOSURE_LIMITS.perJourney });
  }
  await tx.journeyClosure.create({
    data: {
      journeyId,
      ownerUserId: userId,
      kind: closure.kind,
      outcome: closure.outcome,
      note: closure.note,
      resumeOn: closure.resumeOn,
      closedAt: now
    }
  });
  if (closure.kind === JourneyClosureKind.FINISHED && closure.level) {
    const marks = await tx.journeyAssessment.count({ where: { journeyId, ownerUserId: userId } });
    if (marks >= JOURNEY_ASSESSMENT_LIMITS.perJourney) {
      throw publicError("journeys.errors.assessment_limit_reached", 409, { limit: JOURNEY_ASSESSMENT_LIMITS.perJourney });
    }
    await tx.journeyAssessment.create({ data: { journeyId, ownerUserId: userId, level: closure.level, note: null, createdAt: now } });
  }
}

/** Tehingu samm: Teekond avati uuesti, lahtine paus või lõpetamine saab lõpuaja. */
export async function stampJourneyReopened(tx, { journeyId, userId, now }) {
  await tx.journeyClosure.updateMany({
    where: { journeyId, ownerUserId: userId, reopenedAt: null },
    data: { reopenedAt: now }
  });
}
