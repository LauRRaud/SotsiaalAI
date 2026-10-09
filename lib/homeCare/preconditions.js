/**
 * KODUTEENUS K4-a — eeltingimus enne teenuse algust (kava II.3.7 punkt 3).
 *
 * Koduteenuse juhendi järgi ei saa teenust mõnikord alustada enne, kui kodus on midagi
 * korda tehtud: suurpuhastus, putukatõrje, ohtlik küttekolle või elektrisüsteem. Selle
 * korraldab omavalitsus. Siin on kirjas, mida oodatakse, kes korraldab ja mis ajaks.
 *
 * Kuni kliendil on täitmata eeltingimus, on ta loendis märgiga „ootab eeltingimust" ja
 * tähtaegade lehel omaette nimekirjas. Kliendi seisu see ei muuda: eeltingimus on
 * lahtine asi kliendi juures, mitte teenuse peatamine.
 *
 * Lisab ja lõpetab hooldusjuht, kelle skoobis klient on; loeb igaüks, kes tohib kliendi
 * lehte avada. Rida ei kustutata: eeltingimus kas täidetakse või jäetakse ära.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, conflict, notFound } from "../org/errors.js";

import { assertHomeCareContext, membershipDisplayName, organizationTimeZone, requireClientCoordinator } from "./access.js";
import { CARE_PRECONDITION_KINDS, CARE_PRECONDITION_OUTCOMES, CarePreconditionKind, CarePreconditionOutcome, HOME_CARE_LIMITS } from "./constants.js";
import { daysBetween, todayText } from "./decisions.js";
import { asObject, normalizeEnum, normalizeId, normalizeIsoDay, normalizeLine } from "./validation.js";

const PRECONDITION_SELECT = Object.freeze({
  id: true,
  kind: true,
  note: true,
  responsible: true,
  dueOn: true,
  createdByName: true,
  createdAt: true
});

function pad(value) {
  return String(value).padStart(2, "0");
}

/** Lahtine eeltingimus vaatesse: tähtajani jäänud päevad arvutatakse tänase suhtes. */
export function serializePrecondition(row, today) {
  const daysLeft = row.dueOn ? daysBetween(today, row.dueOn) : null;
  return {
    id: row.id,
    kind: row.kind,
    note: row.note || null,
    responsible: row.responsible,
    dueOn: row.dueOn || null,
    daysLeft,
    overdue: daysLeft !== null && daysLeft < 0,
    setByName: row.createdByName || null
  };
}

async function writePreconditionAudit(tx, context, clientId, preconditionId, change) {
  await writeOrgAudit(tx, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_PRECONDITION_CHANGED,
    resourceType: OrgAuditResource.CARE_PRECONDITION,
    resourceId: preconditionId,
    meta: { organizationId: context.organization.id, clientId, preconditionId, change }
  });
}

/** Kliendi täitmata eeltingimused lisamise järjekorras. */
export async function loadOpenPreconditionsWithin(tx, clientId, today) {
  const rows = await tx.carePrecondition.findMany({
    where: { clientId, closedAt: null },
    select: PRECONDITION_SELECT,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });
  return rows.map((row) => serializePrecondition(row, today));
}

function normalizeInput(rawInput) {
  const input = asObject(rawInput);
  const kind = normalizeEnum(input.kind, CARE_PRECONDITION_KINDS, "home_care.errors.precondition_kind_required");
  const note = normalizeLine(input.note, HOME_CARE_LIMITS.PRECONDITION_NOTE_MAX);
  if (kind === CarePreconditionKind.OTHER && !note) throw badRequest("home_care.errors.precondition_note_required");
  const responsible = normalizeLine(input.responsible, HOME_CARE_LIMITS.PRECONDITION_RESPONSIBLE_MAX, {
    required: true,
    errorKey: "home_care.errors.precondition_responsible_required"
  });
  const parts = normalizeIsoDay(input.dueOn);
  return { kind, note, responsible, dueOn: parts ? `${parts.year}-${pad(parts.month)}-${pad(parts.day)}` : null };
}

/** Hooldusjuht lisab eeltingimuse: mis peab enne korras olema, kes korraldab ja mis ajaks. */
export async function addPrecondition(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const data = normalizeInput(input);
  const today = todayText(now, organizationTimeZone(context));

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const open = await tx.carePrecondition.count({ where: { clientId: id, closedAt: null } });
    if (open >= HOME_CARE_LIMITS.PRECONDITIONS_OPEN_MAX) {
      throw badRequest("home_care.errors.precondition_too_many", { limit: HOME_CARE_LIMITS.PRECONDITIONS_OPEN_MAX });
    }
    const created = await tx.carePrecondition.create({
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
    await writePreconditionAudit(tx, context, id, created.id, "added");
    return { preconditionId: created.id, preconditions: await loadOpenPreconditionsWithin(tx, id, today) };
  });
}

/** Hooldusjuht lõpetab eeltingimuse: täidetud (`DONE`) või ei ole enam vaja (`DROPPED`). */
export async function closePrecondition(context, clientId, preconditionId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const targetId = normalizeId(preconditionId, "home_care.errors.precondition_not_found");
  const outcome = normalizeEnum(asObject(input).outcome, CARE_PRECONDITION_OUTCOMES, "home_care.errors.precondition_outcome_invalid");
  const today = todayText(now, organizationTimeZone(context));

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const row = await tx.carePrecondition.findFirst({ where: { id: targetId, clientId: id }, select: { id: true, closedAt: true } });
    if (!row) throw notFound("home_care.errors.precondition_not_found");
    if (row.closedAt) throw conflict("home_care.errors.precondition_closed");
    await tx.carePrecondition.updateMany({
      where: { id: targetId, closedAt: null },
      data: { closedAt: now, outcome, closedByMembershipId: context.membership?.id || null, closedByName: await membershipDisplayName(tx, context) }
    });
    await writePreconditionAudit(tx, context, id, targetId, outcome === CarePreconditionOutcome.DONE ? "done" : "dropped");
    return { preconditions: await loadOpenPreconditionsWithin(tx, id, today) };
  });
}
