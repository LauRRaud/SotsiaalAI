/**
 * KODUTEENUS kiht 3, K3-g — töö iseloom kliendi juures (kava II.6.3).
 *
 * Märge kirjeldab TÖÖD selle kliendi juures, mitte inimest: füüsiliselt raske, vaimselt
 * kurnav, raske kodukeskkond, ainult kahekesi. Märke paneb hooldusjuht (meeskonnaga
 * arutades) koos põhjuse ja ülevaatuse päevaga. Näeb igaüks, kes tohib kliendi lehte
 * avada: asendaja peab enne minekut teadma, et siin ei tõsteta üksi.
 *
 * MILLEKS. Raske töö märgiga klientide käike loetakse töötaja kaupa (kuu kokkuvõte,
 * nädalaplaan, käigu määramine), et raske töö ei koguneks ühele inimesele. Loendatakse
 * käike, mitte enesetunnet; töötaja kohta siin midagi ei hoita.
 *
 * Rida ei muudeta ega kustutata: uus märge lõpetab eelmise, nii on näha, mis kehtis
 * varem. Pere ega ametiasutuse väljavõttesse (kronoloogia) märge ei lähe.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, notFound } from "../org/errors.js";

import { assertHomeCareContext, membershipDisplayName, organizationTimeZone, requireClientCoordinator } from "./access.js";
import { CARE_WORK_NATURE_KINDS, HOME_CARE_LIMITS } from "./constants.js";
import { todayText } from "./decisions.js";
import { asObject, normalizeId, normalizeIsoDay, normalizeLine } from "./validation.js";

const WORK_NATURE_SELECT = Object.freeze({
  id: true,
  kinds: true,
  reason: true,
  reviewOn: true,
  createdByName: true,
  createdAt: true
});

function pad(value) {
  return String(value).padStart(2, "0");
}

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    /* Alati sõnastiku järjekorras, ükskõik mis järjekorras need salvestati. */
    kinds: CARE_WORK_NATURE_KINDS.filter((kind) => (row.kinds || []).includes(kind)),
    reason: row.reason,
    reviewOn: row.reviewOn || null,
    setByName: row.createdByName || null,
    setAt: row.createdAt.toISOString()
  };
}

async function writeWorkNatureAudit(tx, context, clientId, workNatureId, change) {
  await writeOrgAudit(tx, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_WORK_NATURE_CHANGED,
    resourceType: OrgAuditResource.CARE_WORK_NATURE,
    resourceId: workNatureId,
    meta: { organizationId: context.organization.id, clientId, workNatureId, change }
  });
}

/** Kliendi kehtiv märge kliendi lehele või `null`. */
export async function loadWorkNatureWithin(tx, clientId) {
  const row = await tx.careWorkNature.findFirst({ where: { clientId, endedAt: null }, select: WORK_NATURE_SELECT });
  return serialize(row);
}

/**
 * Raske töö märgiga kliendid. Ilma vahemikuta need, kellel on märge praegu; vahemikuga
 * need, kellel märge selles vahemikus mõnel hetkel kehtis (kuu kokkuvõtte jaoks: kui
 * klient oli sel kuul märgiga, loetakse kõik tema selle kuu käigud).
 */
export async function loadMarkedClientIds(db, organizationId, { from = null, until = null } = {}) {
  const rows = await db.careWorkNature.findMany({
    where: {
      organizationId,
      ...(from && until ? { createdAt: { lt: until }, OR: [{ endedAt: null }, { endedAt: { gt: from } }] } : { endedAt: null })
    },
    select: { clientId: true },
    take: HOME_CARE_LIMITS.WORK_NATURE_CLIENTS_MAX
  });
  return new Set(rows.map((row) => row.clientId));
}

function normalizeInput(rawInput, today) {
  const input = asObject(rawInput);
  const chosen = Array.isArray(input.kinds) ? input.kinds : [];
  if (chosen.some((kind) => !CARE_WORK_NATURE_KINDS.includes(kind))) throw badRequest("home_care.errors.work_nature_kinds_required");
  const kinds = CARE_WORK_NATURE_KINDS.filter((kind) => chosen.includes(kind));
  if (!kinds.length) throw badRequest("home_care.errors.work_nature_kinds_required");
  const reason = normalizeLine(input.reason, HOME_CARE_LIMITS.WORK_NATURE_REASON_MAX, {
    required: true,
    errorKey: "home_care.errors.work_nature_reason_required"
  });
  const parts = normalizeIsoDay(input.reviewOn);
  const reviewOn = parts ? `${parts.year}-${pad(parts.month)}-${pad(parts.day)}` : null;
  if (reviewOn && reviewOn < today) throw badRequest("home_care.errors.work_nature_review_past");
  return { kinds, reason, reviewOn };
}

/** Lõpetab kehtiva märke (kui on). Tagastab lõpetatud rea ID või `null`. */
async function endCurrent(tx, context, clientId, now) {
  const current = await tx.careWorkNature.findFirst({ where: { clientId, endedAt: null }, select: { id: true } });
  if (!current) return null;
  await tx.careWorkNature.updateMany({
    where: { id: current.id, endedAt: null },
    data: { endedAt: now, endedByMembershipId: context.membership?.id || null, endedByName: await membershipDisplayName(tx, context) }
  });
  return current.id;
}

/** Hooldusjuht paneb või uuendab märke: liigid, põhjus ja ülevaatuse päev. Eelmine märge lõpeb. */
export async function setWorkNature(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const data = normalizeInput(input, todayText(now, organizationTimeZone(context)));

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    await endCurrent(tx, context, id, now);
    const created = await tx.careWorkNature.create({
      data: {
        ...data,
        organizationId: context.organization.id,
        clientId: id,
        createdByMembershipId: context.membership?.id || null,
        createdByName: await membershipDisplayName(tx, context),
        createdAt: now
      },
      select: WORK_NATURE_SELECT
    });
    await writeWorkNatureAudit(tx, context, id, created.id, "set");
    return { workNature: serialize(created) };
  });
}

/** Hooldusjuht võtab märke maha (töö ei ole enam selline). Rida jääb ajalukku. */
export async function clearWorkNature(context, clientId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const endedId = await endCurrent(tx, context, id, now);
    if (!endedId) throw notFound("home_care.errors.work_nature_not_found");
    await writeWorkNatureAudit(tx, context, id, endedId, "cleared");
    return { workNature: null };
  });
}
