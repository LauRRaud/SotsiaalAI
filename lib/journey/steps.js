/**
 * TEEKOND K1-b — järgmised sammud: teenuskiht.
 *
 * Samm kuulub Teekonnale ja Teekond inimesele. Iga päring filtreerib omaniku
 * järgi (`ownerUserId` on sammul denormaliseeritud just selleks); võõras ja
 * olematu on eristamatud (404). Arhiveeritud Teekonna samme saab lugeda, mitte
 * muuta. Sammu muutmine ei puuduta Teekonna enda muutmise aega: muidu annaks
 * avatud muutmisvorm sammu märkimise järel konflikti.
 */
import { prisma } from "@/lib/prisma";

import {
  JOURNEY_STEP_LIMITS,
  JourneyStepState,
  isStepOverdue,
  normalizeStepInput,
  sortSteps,
  todayInEstonia
} from "./stepRules.js";

const STEP_SELECT = Object.freeze({
  id: true,
  title: true,
  doer: true,
  dueOn: true,
  state: true,
  note: true,
  doneAt: true,
  createdAt: true,
  updatedAt: true
});

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

function iso(value) {
  if (!value) return null;
  return value?.toISOString?.() || value;
}

export function serializeJourneyStep(row, today) {
  return {
    id: row.id,
    title: row.title,
    doer: row.doer || null,
    dueOn: row.dueOn || null,
    state: row.state,
    note: row.note || null,
    doneAt: iso(row.doneAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    overdue: isStepOverdue(row, today)
  };
}

async function requireOwnedJourney(db, userId, journeyId, { writable = false } = {}) {
  const id = String(journeyId || "").trim();
  if (!id) throw publicError("journeys.errors.not_found", 404);
  const journey = await db.journey.findFirst({ where: { id, ownerUserId: userId }, select: { id: true, status: true } });
  if (!journey) throw publicError("journeys.errors.not_found", 404);
  if (writable && journey.status === "ARCHIVED") throw publicError("journeys.errors.archived", 409);
  return journey;
}

/** Teekonna sammud lehe järjekorras. Kutsuja on juba tõendanud, et Teekond on selle inimese oma. */
export async function readJourneySteps(db, userId, journeyId, { now = new Date() } = {}) {
  const rows = await db.journeyStep.findMany({
    where: { journeyId, ownerUserId: userId },
    select: STEP_SELECT
  });
  const today = todayInEstonia(now);
  return sortSteps(rows).map((row) => serializeJourneyStep(row, today));
}

export async function listJourneySteps(ownerUserId, journeyId, { db = prisma, now = new Date() } = {}) {
  const userId = requireOwnerId(ownerUserId);
  const journey = await requireOwnedJourney(db, userId, journeyId);
  return { steps: await readJourneySteps(db, userId, journey.id, { now }) };
}

/**
 * Lisab sammu. `clientActionId` teeb kordussaatmise ohutuks: sama võti annab
 * sama sammu, mitte teist rida.
 */
export async function createJourneyStep(ownerUserId, journeyId, input = {}, { db = prisma, now = new Date() } = {}) {
  const userId = requireOwnerId(ownerUserId);
  const data = normalizeStepInput(input);
  const clientActionId = typeof input?.clientActionId === "string" && CLIENT_ACTION_ID.test(input.clientActionId) ? input.clientActionId : null;

  const journey = await requireOwnedJourney(db, userId, journeyId, { writable: true });
  if (clientActionId) {
    const replay = await db.journeyStep.findFirst({ where: { ownerUserId: userId, clientActionId }, select: { id: true, journeyId: true } });
    if (replay) {
      if (replay.journeyId !== journey.id) throw publicError("journeys.errors.idempotency_conflict", 409);
      return { steps: await readJourneySteps(db, userId, journey.id, { now }), stepId: replay.id };
    }
  }
  const count = await db.journeyStep.count({ where: { journeyId: journey.id, ownerUserId: userId } });
  if (count >= JOURNEY_STEP_LIMITS.perJourney) {
    throw publicError("journeys.errors.step_limit_reached", 409, { limit: JOURNEY_STEP_LIMITS.perJourney });
  }

  let created;
  try {
    created = await db.journeyStep.create({
      data: {
        journeyId: journey.id,
        ownerUserId: userId,
        title: data.title,
        doer: data.doer ?? null,
        dueOn: data.dueOn ?? null,
        note: data.note ?? null,
        state: JourneyStepState.TODO,
        clientActionId
      },
      select: { id: true }
    });
  } catch (error) {
    /* Kaks sama võtmega päringut korraga: teine leiab esimese rea. */
    if (error?.code !== "P2002" || !clientActionId) throw error;
    created = await db.journeyStep.findFirst({ where: { ownerUserId: userId, clientActionId, journeyId: journey.id }, select: { id: true } });
    if (!created) throw publicError("journeys.errors.idempotency_conflict", 409);
  }
  return { steps: await readJourneySteps(db, userId, journey.id, { now }), stepId: created.id };
}

/**
 * Muudab sammu välju ja seisu. Tehtuks või ära jäetuks märkimine paneb kirja
 * aja; uuesti avamine võtab selle ära. Märkus („helistasin, lubati tagasi
 * helistada") käib sama päringuga kaasa.
 */
export async function updateJourneyStep(ownerUserId, journeyId, stepId, input = {}, { db = prisma, now = new Date() } = {}) {
  const userId = requireOwnerId(ownerUserId);
  const data = normalizeStepInput(input, { partial: true });
  const journey = await requireOwnedJourney(db, userId, journeyId, { writable: true });
  const id = String(stepId || "").trim();
  const existing = id
    ? await db.journeyStep.findFirst({ where: { id, journeyId: journey.id, ownerUserId: userId }, select: { id: true, state: true } })
    : null;
  if (!existing) throw publicError("journeys.errors.step_not_found", 404);

  if (data.state && data.state !== existing.state) {
    data.doneAt = data.state === JourneyStepState.TODO ? null : now;
  }
  if (Object.keys(data).length) {
    await db.journeyStep.updateMany({ where: { id: existing.id, journeyId: journey.id, ownerUserId: userId }, data });
  }
  return { steps: await readJourneySteps(db, userId, journey.id, { now }), stepId: existing.id };
}

/** Kustutab sammu päriselt (valesti lisatud rida). Ära jäetud samm on seis, mitte kustutus. */
export async function deleteJourneyStep(ownerUserId, journeyId, stepId, { db = prisma, now = new Date() } = {}) {
  const userId = requireOwnerId(ownerUserId);
  const journey = await requireOwnedJourney(db, userId, journeyId, { writable: true });
  const id = String(stepId || "").trim();
  const result = id
    ? await db.journeyStep.deleteMany({ where: { id, journeyId: journey.id, ownerUserId: userId } })
    : { count: 0 };
  if (result.count !== 1) throw publicError("journeys.errors.step_not_found", 404);
  return { steps: await readJourneySteps(db, userId, journey.id, { now }) };
}
