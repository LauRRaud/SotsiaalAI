/**
 * KODUTEENUS K6-i — esindusõiguse kirje (kava II.6.9).
 *
 * Lähedasel ei ole seadusest tulenevat õigust täisealise eest otsustada ega alla kirjutada:
 * selleks on vaja volitust või eestkostet. Lähedaste ring (K5-k) ütleb, kellele mida tohib
 * rääkida; see kirje ütleb, kes tohib kliendi eest otsustada: kes, mis alusel, mis ulatuses,
 * mis ajast mis ajani, kus on dokumendi koopia ja mis päeval hooldusjuht dokumenti nägi.
 *
 * Platvorm dokumenti ei hoia ega kontrolli selle ehtsust. Lisab ja lõpetab hooldusjuht,
 * kelle skoobis klient on; loeb igaüks, kes tohib kliendi lehte avada, sest hooldaja peab
 * teadma, kelle sõna kliendi asjades loeb. Rida ei kustutata ega muudeta: muutunud või
 * lõppenud õigus lõpetatakse ja vajadusel tehakse uus rida.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, conflict, notFound } from "../org/errors.js";

import { assertHomeCareContext, membershipDisplayName, organizationTimeZone, requireClientCoordinator } from "./access.js";
import { CARE_REPRESENTATIVE_BASES, CareClientStatus, HOME_CARE_LIMITS } from "./constants.js";
import { daysBetween, todayText } from "./decisions.js";
import { phoneHref } from "./phone.js";
import { asObject, normalizeEnum, normalizeId, normalizeIsoDay, normalizeLine } from "./validation.js";

const PHONE_PATTERN = /^[0-9+() -]+$/;

const REPRESENTATIVE_SELECT = Object.freeze({
  id: true,
  name: true,
  phone: true,
  basis: true,
  scope: true,
  validFrom: true,
  validUntil: true,
  copyKept: true,
  checkedOn: true,
  createdByName: true
});

function dayOf(value) {
  const parts = normalizeIsoDay(value);
  return parts ? `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}` : null;
}

/** Sisend reaks. `today` on päev asutuse ajavööndis: dokumenti ei saa olla nähtud tulevikus. Puhas funktsioon. */
export function normalizeRepresentative(rawInput, today) {
  const input = asObject(rawInput);
  const name = normalizeLine(input.name, HOME_CARE_LIMITS.RELATIVE_NAME_MAX, { required: true, errorKey: "home_care.errors.representative_name_required" });
  const phone = normalizeLine(input.phone, HOME_CARE_LIMITS.REFERRAL_PHONE_MAX) || null;
  if (phone && (!PHONE_PATTERN.test(phone) || !phoneHref(phone))) throw badRequest("home_care.errors.referral_phone_invalid");
  const basis = normalizeEnum(input.basis, CARE_REPRESENTATIVE_BASES, "home_care.errors.representative_basis_required");
  const scope = normalizeLine(input.scope, HOME_CARE_LIMITS.REPRESENTATIVE_SCOPE_MAX, { required: true, errorKey: "home_care.errors.representative_scope_required" });
  const validFrom = dayOf(input.validFrom);
  const validUntil = dayOf(input.validUntil);
  if (validFrom && validUntil && validUntil < validFrom) throw badRequest("home_care.errors.representative_period_invalid");
  const checkedOn = dayOf(input.checkedOn) || today;
  if (checkedOn > today) throw badRequest("home_care.errors.representative_checked_future");
  return { name, phone, basis, scope, validFrom, validUntil, copyKept: normalizeLine(input.copyKept, HOME_CARE_LIMITS.DECISION_ORIGINAL_MAX) || null, checkedOn };
}

/** Kas õigus täna kehtib: `VALID`, `UPCOMING` (algab hiljem) või `EXPIRED` (tähtaeg on möödas). Puhas funktsioon. */
export function representativeState(row, today) {
  if (row.validUntil && row.validUntil < today) return "EXPIRED";
  if (row.validFrom && row.validFrom > today) return "UPCOMING";
  return "VALID";
}

export function serializeRepresentative(row, today) {
  const state = representativeState(row, today);
  return {
    id: row.id,
    name: row.name,
    phone: row.phone || null,
    basis: row.basis,
    scope: row.scope,
    validFrom: row.validFrom || null,
    validUntil: row.validUntil || null,
    copyKept: row.copyKept || null,
    checkedOn: row.checkedOn,
    checkedByName: row.createdByName || null,
    state,
    /* Mitu päeva tähtajaline õigus veel kehtib (täna lõppev = 0); möödunud tähtaeg on negatiivne. */
    daysLeft: row.validUntil ? daysBetween(today, row.validUntil) : null
  };
}

/** Kliendi lõpetamata esindusõigused lisamise järjekorras (ka need, mille tähtaeg on möödas: need tuleb lõpetada või uuendada). */
export async function loadRepresentativesWithin(tx, clientId, today) {
  const rows = await tx.careClientRepresentative.findMany({
    where: { clientId, endedAt: null },
    select: REPRESENTATIVE_SELECT,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });
  return rows.map((row) => serializeRepresentative(row, today));
}

async function writeRepresentativeAudit(tx, context, clientId, representativeId, change) {
  await writeOrgAudit(tx, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_REPRESENTATIVE_CHANGED,
    resourceType: OrgAuditResource.CARE_CLIENT_REPRESENTATIVE,
    resourceId: representativeId,
    /* Nimi, alus ja ulatus auditisse ei lähe. */
    meta: { organizationId: context.organization.id, clientId, change }
  });
}

/** Hooldusjuht paneb kirja esindusõiguse, mille dokumenti ta on näinud. */
export async function addRepresentative(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const today = todayText(now, organizationTimeZone(context));
  const data = normalizeRepresentative(input, today);

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const open = await tx.careClientRepresentative.count({ where: { clientId: id, endedAt: null } });
    if (open >= HOME_CARE_LIMITS.REPRESENTATIVES_MAX) {
      throw badRequest("home_care.errors.representative_too_many", { limit: HOME_CARE_LIMITS.REPRESENTATIVES_MAX });
    }
    const created = await tx.careClientRepresentative.create({
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
    await writeRepresentativeAudit(tx, context, id, created.id, "added");
    return { representativeId: created.id, representatives: await loadRepresentativesWithin(tx, id, today) };
  });
}

/** Hooldusjuht lõpetab kirje: õigus lõppes, võeti tagasi või pandi kirja ekslikult. */
export async function endRepresentative(context, clientId, representativeId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const targetId = normalizeId(representativeId, "home_care.errors.representative_not_found");
  const today = todayText(now, organizationTimeZone(context));

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const row = await tx.careClientRepresentative.findFirst({ where: { id: targetId, clientId: id }, select: { id: true, endedAt: true } });
    if (!row) throw notFound("home_care.errors.representative_not_found");
    if (row.endedAt) throw conflict("home_care.errors.representative_ended");
    await tx.careClientRepresentative.updateMany({
      where: { id: targetId, endedAt: null },
      data: { endedAt: now, endedByMembershipId: context.membership?.id || null, endedByName: await membershipDisplayName(tx, context) }
    });
    await writeRepresentativeAudit(tx, context, id, targetId, "ended");
    return { representatives: await loadRepresentativesWithin(tx, id, today) };
  });
}

/**
 * Tähtaegade vaatele: teenusel olevate klientide esindusõigused, mille tähtaeg on möödas või
 * lõpeb `REPRESENTATIVE_SOON_DAYS` päeva jooksul. Möödunud ees, siis varem lõppev.
 */
export async function loadRepresentativesDue(db, { organizationId, clientWhere = {}, today }) {
  const rows = await db.careClientRepresentative.findMany({
    where: {
      organizationId,
      endedAt: null,
      validUntil: { not: null },
      client: { status: { in: [CareClientStatus.ACTIVE, CareClientStatus.AWAY] }, ...clientWhere }
    },
    select: { id: true, name: true, validUntil: true, client: { select: { id: true, displayName: true, status: true } } },
    take: HOME_CARE_LIMITS.DEADLINE_CLIENTS_MAX
  });
  return rows
    .map((row) => ({ id: row.id, client: row.client, name: row.name, validUntil: row.validUntil, daysLeft: daysBetween(today, row.validUntil) }))
    .filter((item) => item.daysLeft <= HOME_CARE_LIMITS.REPRESENTATIVE_SOON_DAYS)
    .map((item) => ({ ...item, expired: item.daysLeft < 0 }))
    .sort((a, b) => a.daysLeft - b.daysLeft || a.client.displayName.localeCompare(b.client.displayName, "et"));
}
