/**
 * KODUTEENUS K6-l — hooldusjuhi kontrollkõne kliendile (kava II.6.9).
 *
 * Koduteenuse saaja ei kinnita iga käiku allkirjaga. Selle asemel saab ta kuulehe (K6-e) ja
 * kord kvartalis helistab hooldusjuht talle ise, MITTE hooldaja kaudu, ja küsib, kas käigud
 * on toimunud nii, nagu kirjas. Siin on selle kõne kirje: mis päeval, kellega räägiti ja mis
 * selgus.
 *
 * Kirjet näeb ja teeb ainult hooldusjuht, kelle skoobis klient on: see on kontroll hooldaja
 * töö üle ja meeskond seda ei näe. Rida ei kustutata: ekslik kirje tühistatakse. Kui kliendi
 * jutt kirjapanduga ei klapi, jääb edasine (kaebus, vestlus töötajaga) hooldusjuhi teha;
 * platvorm sellest järeldust ei tee.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, conflict, notFound } from "../org/errors.js";

import { assertHomeCareContext, membershipDisplayName, organizationTimeZone, requireClientCoordinator } from "./access.js";
import { CARE_CONTROL_CALL_OUTCOMES, CARE_CONTROL_CALL_PARTIES, CareClientStatus, CareControlCallOutcome, HOME_CARE_LIMITS } from "./constants.js";
import { daysBetween, todayText } from "./decisions.js";
import { asObject, normalizeEnum, normalizeId, normalizeIsoDay, normalizeLine } from "./validation.js";

const CALL_SELECT = Object.freeze({
  id: true,
  calledOn: true,
  outcome: true,
  spokeWith: true,
  note: true,
  createdByMembershipId: true,
  createdByName: true
});

/** Sisend reaks. Helistamise päev ei saa olla tulevikus; tühi päev on täna. Puhas funktsioon. */
export function normalizeControlCall(rawInput, today) {
  const input = asObject(rawInput);
  const parts = normalizeIsoDay(input.calledOn);
  const calledOn = parts ? `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}` : today;
  if (calledOn > today) throw badRequest("home_care.errors.control_call_day_future");
  const outcome = normalizeEnum(input.outcome, CARE_CONTROL_CALL_OUTCOMES, "home_care.errors.control_call_outcome_required");
  const reached = outcome !== CareControlCallOutcome.NOT_REACHED;
  const spokeWith = reached ? normalizeEnum(input.spokeWith, CARE_CONTROL_CALL_PARTIES, "home_care.errors.control_call_spoke_required") : null;
  const note = normalizeLine(input.note, HOME_CARE_LIMITS.CONTROL_CALL_NOTE_MAX) || null;
  if (outcome === CareControlCallOutcome.DIFFERS && !note) throw badRequest("home_care.errors.control_call_note_required");
  return { calledOn, outcome, spokeWith, note };
}

/**
 * Kas kontrollkõne on tegemata: esimest korda `CONTROL_CALL_FIRST_DAYS` päeva pärast teenuse
 * algust, edaspidi `CONTROL_CALL_EVERY_DAYS` päeva pärast viimast kõnet, kus kedagi kätte saadi.
 * `days` on päevi viimasest sellisest kõnest (või teenuse algusest). Puhas funktsioon.
 */
export function controlCallDue({ startedOn, lastReachedOn, today }) {
  if (lastReachedOn) {
    const days = daysBetween(lastReachedOn, today);
    return { due: days > HOME_CARE_LIMITS.CONTROL_CALL_EVERY_DAYS, days };
  }
  const days = daysBetween(startedOn, today);
  return { due: days >= HOME_CARE_LIMITS.CONTROL_CALL_FIRST_DAYS, days };
}

function serialize(row, viewerMembershipId) {
  return {
    id: row.id,
    calledOn: row.calledOn,
    outcome: row.outcome,
    spokeWith: row.spokeWith || null,
    note: row.note || null,
    byName: row.createdByName || null,
    isMine: Boolean(viewerMembershipId && row.createdByMembershipId === viewerMembershipId)
  };
}

/** Kliendi viimased tühistamata kontrollkõned (uuem ees) ja kas järgmine on tegemata. Ainult hooldusjuhile. */
export async function loadControlCallsWithin(tx, { clientId, startedOn, today, viewerMembershipId }) {
  const rows = await tx.careControlCall.findMany({
    where: { clientId, retractedAt: null },
    select: CALL_SELECT,
    orderBy: [{ calledOn: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: HOME_CARE_LIMITS.CONTROL_CALLS_SHOWN
  });
  const lastReached = await tx.careControlCall.findFirst({
    where: { clientId, retractedAt: null, outcome: { not: CareControlCallOutcome.NOT_REACHED } },
    select: { calledOn: true },
    orderBy: [{ calledOn: "desc" }]
  });
  const lastReachedOn = lastReached?.calledOn || null;
  return { items: rows.map((row) => serialize(row, viewerMembershipId)), lastReachedOn, ...controlCallDue({ startedOn, lastReachedOn, today }) };
}

async function writeCallAudit(tx, context, clientId, callId, change) {
  await writeOrgAudit(tx, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_CONTROL_CALL_CHANGED,
    resourceType: OrgAuditResource.CARE_CONTROL_CALL,
    resourceId: callId,
    /* Tulemus ja märkus auditisse ei lähe. */
    meta: { organizationId: context.organization.id, clientId, change }
  });
}

/** Kliendi lehele ja kirjutamise vastusesse: teenuse algus loetakse kliendi realt. Kutsuja kontrollib, et vaataja on hooldusjuht. */
export async function loadControlCallsView(tx, context, clientId, now) {
  const timeZone = organizationTimeZone(context);
  const client = await tx.careClient.findUnique({ where: { id: clientId }, select: { createdAt: true } });
  return loadControlCallsWithin(tx, {
    clientId,
    startedOn: todayText(client.createdAt, timeZone),
    today: todayText(now, timeZone),
    viewerMembershipId: context.membership?.id || null
  });
}

/** Hooldusjuht paneb kontrollkõne kirja. */
export async function addControlCall(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const data = normalizeControlCall(input, todayText(now, organizationTimeZone(context)));

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const created = await tx.careControlCall.create({
      data: {
        ...data,
        organizationId: context.organization.id,
        clientId: id,
        createdByMembershipId: context.membership?.id || null,
        createdByName: await membershipDisplayName(tx, context),
        createdAt: now
      },
      select: { id: true }
    });
    await writeCallAudit(tx, context, id, created.id, "added");
    return { callId: created.id, controlCalls: await loadControlCallsView(tx, context, id, now) };
  });
}

/** Hooldusjuht tühistab ekslikult kirja pandud kõne. Rida jääb alles. */
export async function retractControlCall(context, clientId, callId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const targetId = normalizeId(callId, "home_care.errors.control_call_not_found");

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const row = await tx.careControlCall.findFirst({ where: { id: targetId, clientId: id }, select: { id: true, retractedAt: true } });
    if (!row) throw notFound("home_care.errors.control_call_not_found");
    if (row.retractedAt) throw conflict("home_care.errors.control_call_retracted");
    await tx.careControlCall.updateMany({
      where: { id: targetId, retractedAt: null },
      data: { retractedAt: now, retractedByMembershipId: context.membership?.id || null, retractedByName: await membershipDisplayName(tx, context) }
    });
    await writeCallAudit(tx, context, id, targetId, "retracted");
    return { controlCalls: await loadControlCallsView(tx, context, id, now) };
  });
}

/**
 * Tähtaegade vaatele: teenusel olevad kliendid, kelle kontrollkõne on tegemata; kauem oodanu ees.
 * Ajutiselt ära olevaid kliente ei loeta: käike, mille kohta küsida, neil praegu ei ole.
 */
export async function loadControlCallsDue(db, { organizationId, clientWhere = {}, today, timeZone }) {
  const clients = await db.careClient.findMany({
    where: { organizationId, status: CareClientStatus.ACTIVE, ...clientWhere },
    select: { id: true, displayName: true, status: true, createdAt: true },
    take: HOME_CARE_LIMITS.DEADLINE_CLIENTS_MAX
  });
  if (!clients.length) return [];
  const reached = await db.careControlCall.groupBy({
    by: ["clientId"],
    where: { organizationId, clientId: { in: clients.map((row) => row.id) }, retractedAt: null, outcome: { not: CareControlCallOutcome.NOT_REACHED } },
    _max: { calledOn: true }
  });
  const lastOf = new Map(reached.map((row) => [row.clientId, row._max.calledOn]));
  return clients
    .map((row) => {
      const lastReachedOn = lastOf.get(row.id) || null;
      const state = controlCallDue({ startedOn: todayText(row.createdAt, timeZone), lastReachedOn, today });
      return { client: { id: row.id, displayName: row.displayName, status: row.status }, lastReachedOn, days: state.days, due: state.due };
    })
    .filter((item) => item.due)
    .map((item) => ({ client: item.client, lastReachedOn: item.lastReachedOn, days: item.days }))
    .sort((a, b) => b.days - a.days || a.client.displayName.localeCompare(b.client.displayName, "et"));
}
