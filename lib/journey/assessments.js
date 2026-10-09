/**
 * TEEKOND K1-d — inimese enda hinnang muutusele: teenuskiht.
 *
 * Märge kuulub Teekonnale ja Teekond inimesele: iga päring filtreerib omaniku
 * järgi, võõras ja olematu on eristamatud (404). Märget ei muudeta: hinnang on
 * selle hetke oma ja hiljem ümber kirjutatud algseis teeks muutuse võrdlemise
 * mõttetuks. Valesti pandud märke saab kustutada. Arhiveeritud Teekonna märkeid
 * saab lugeda, mitte lisada ega kustutada.
 */
import { prisma } from "@/lib/prisma";

import { JOURNEY_ASSESSMENT_LIMITS, normalizeAssessmentInput, summarizeAssessments } from "./assessmentRules.js";

const ASSESSMENT_SELECT = Object.freeze({ id: true, level: true, note: true, createdAt: true });
const CLIENT_ACTION_ID = /^[A-Za-z0-9_-]{8,120}$/;

function publicError(message, status = 400, extra = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
}

function requireOwnerId(ownerUserId) {
  const normalized = String(ownerUserId || "").trim();
  if (!normalized) throw publicError("api.common.unauthorized", 401);
  return normalized;
}

async function requireOwnedJourney(db, userId, journeyId, { writable = false } = {}) {
  const id = String(journeyId || "").trim();
  if (!id) throw publicError("journeys.errors.not_found", 404);
  const journey = await db.journey.findFirst({ where: { id, ownerUserId: userId }, select: { id: true, status: true } });
  if (!journey) throw publicError("journeys.errors.not_found", 404);
  if (writable && journey.status === "ARCHIVED") throw publicError("journeys.errors.archived", 409);
  return journey;
}

function serialize(row) {
  return {
    id: row.id,
    level: row.level,
    note: row.note || null,
    createdAt: row.createdAt?.toISOString?.() || row.createdAt
  };
}

/** Teekonna hinnangute pilt. Kutsuja on juba tõendanud, et Teekond on selle inimese oma. */
export async function readJourneyAssessments(db, userId, journeyId) {
  const rows = await db.journeyAssessment.findMany({
    where: { journeyId, ownerUserId: userId },
    select: ASSESSMENT_SELECT,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });
  return summarizeAssessments(rows.map(serialize));
}

export async function listJourneyAssessments(ownerUserId, journeyId, { db = prisma } = {}) {
  const userId = requireOwnerId(ownerUserId);
  const journey = await requireOwnedJourney(db, userId, journeyId);
  return { assessments: await readJourneyAssessments(db, userId, journey.id) };
}

/** Lisab märke. Esimene märge on algseis. Kordussaatmine sama võtmega ei tee teist rida. */
export async function createJourneyAssessment(ownerUserId, journeyId, input = {}, { db = prisma, now = new Date() } = {}) {
  const userId = requireOwnerId(ownerUserId);
  const data = normalizeAssessmentInput(input);
  const clientActionId = typeof input?.clientActionId === "string" && CLIENT_ACTION_ID.test(input.clientActionId) ? input.clientActionId : null;
  const journey = await requireOwnedJourney(db, userId, journeyId, { writable: true });

  if (clientActionId) {
    const replay = await db.journeyAssessment.findFirst({ where: { ownerUserId: userId, clientActionId }, select: { journeyId: true } });
    if (replay) {
      if (replay.journeyId !== journey.id) throw publicError("journeys.errors.idempotency_conflict", 409);
      return { assessments: await readJourneyAssessments(db, userId, journey.id) };
    }
  }
  const count = await db.journeyAssessment.count({ where: { journeyId: journey.id, ownerUserId: userId } });
  if (count >= JOURNEY_ASSESSMENT_LIMITS.perJourney) {
    throw publicError("journeys.errors.assessment_limit_reached", 409, { limit: JOURNEY_ASSESSMENT_LIMITS.perJourney });
  }
  try {
    await db.journeyAssessment.create({
      data: { journeyId: journey.id, ownerUserId: userId, level: data.level, note: data.note, clientActionId, createdAt: now }
    });
  } catch (error) {
    /* Kaks sama võtmega päringut korraga: teine leiab esimese rea. */
    if (error?.code !== "P2002" || !clientActionId) throw error;
  }
  return { assessments: await readJourneyAssessments(db, userId, journey.id) };
}

/** Kustutab valesti pandud märke. Kui see oli algseis, saab algseisuks järgmine märge. */
export async function deleteJourneyAssessment(ownerUserId, journeyId, assessmentId, { db = prisma } = {}) {
  const userId = requireOwnerId(ownerUserId);
  const journey = await requireOwnedJourney(db, userId, journeyId, { writable: true });
  const id = String(assessmentId || "").trim();
  const result = id
    ? await db.journeyAssessment.deleteMany({ where: { id, journeyId: journey.id, ownerUserId: userId } })
    : { count: 0 };
  if (result.count !== 1) throw publicError("journeys.errors.assessment_not_found", 404);
  return { assessments: await readJourneyAssessments(db, userId, journey.id) };
}
