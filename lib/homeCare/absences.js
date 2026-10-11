/**
 * KODUTEENUS kiht 3, K3-c — töötaja puudumised.
 *
 * Puudumine ütleb, et töötaja ei ole nendel päevadel tööl. Päevaplaan (`dayPlan.js`)
 * tõstab selle põhjal esile käigud, mille tegija puudub, tähtsamad ees, ega paku
 * puuduvat töötajat asendajaks.
 *
 * MIDA EI HOITA. Liik ütleb ainult, kas puudumine oli plaaniline (puhkus, koolitus) või
 * ootamatu. Haigust, diagnoosi ega muud põhjust ei küsita ja vaba teksti välja ei ole:
 * töökorralduseks piisab teadmisest, et inimest ei ole.
 *
 * Puudumisi näeb ja haldab hooldusjuht (kogu asutuse või üksuse oma: inimene võib
 * käia mitme üksuse klientide juures). Hooldaja näeb oma tänases päevas ainult seda,
 * et tal on puudumine märgitud; kolleegide puudumisi ta ei näe.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { OrganizationMembershipStatus } from "../org/constants.js";
import { badRequest, conflict, forbidden, notFound } from "../org/errors.js";

import { assertHomeCareContext, coordinatorScope, membershipDisplayName, organizationTimeZone, personName } from "./access.js";
import { CARE_ABSENCE_KINDS, CareAbsenceKind, HOME_CARE_COORDINATOR, HOME_CARE_LIMITS } from "./constants.js";
import { daysBetween, todayText } from "./decisions.js";
import { shiftDay } from "./slots.js";
import { asObject, normalizeEnum, normalizeId, normalizeIsoDay, normalizeVersion } from "./validation.js";

const MEMBER_NAME = Object.freeze({
  status: true,
  jobTitle: true,
  user: { select: { profile: { select: { firstName: true, lastName: true } } } }
});
const ABSENCE_SELECT = Object.freeze({
  id: true,
  membershipId: true,
  fromDay: true,
  toDay: true,
  kind: true,
  version: true,
  createdByName: true,
  membership: { select: MEMBER_NAME }
});

function pad(value) {
  return String(value).padStart(2, "0");
}

function dayText(parts) {
  return parts ? `${parts.year}-${pad(parts.month)}-${pad(parts.day)}` : null;
}

function requireCoordinator(context) {
  if (!coordinatorScope(context)) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
}

function serializeAbsence(row, today) {
  return {
    id: row.id,
    membershipId: row.membershipId,
    name: personName(row.membership),
    fromDay: row.fromDay,
    toDay: row.toDay,
    days: daysBetween(row.fromDay, row.toDay) + 1,
    kind: row.kind,
    /* Täna kestev puudumine on loendis esile tõstetud. */
    current: row.fromDay <= today && row.toDay >= today,
    version: row.version,
    createdByName: row.createdByName || null
  };
}

function normalizeAbsenceInput(rawInput, today) {
  const input = asObject(rawInput);
  const fromDay = dayText(normalizeIsoDay(input.fromDay));
  const toDay = dayText(normalizeIsoDay(input.toDay));
  if (!fromDay || !toDay) throw badRequest("home_care.errors.absence_days_required");
  if (toDay < fromDay) throw badRequest("home_care.errors.absence_period_invalid");
  /* Paari päeva eest alanud ootamatu puudumise saab tagantjärele kirja panna; kaugemat minevikku ei planeerita. */
  if (fromDay < shiftDay(today, -HOME_CARE_LIMITS.ABSENCE_BACK_DAYS)) throw badRequest("home_care.errors.absence_from_past");
  if (daysBetween(fromDay, toDay) + 1 > HOME_CARE_LIMITS.ABSENCE_MAX_DAYS) {
    throw badRequest("home_care.errors.absence_too_long", { limit: HOME_CARE_LIMITS.ABSENCE_MAX_DAYS });
  }
  return { fromDay, toDay, kind: normalizeEnum(input.kind, CARE_ABSENCE_KINDS, "home_care.errors.absence_kind_required") };
}

async function writeAbsenceAudit(tx, context, absenceId, change) {
  await writeOrgAudit(tx, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_ABSENCE_CHANGED,
    resourceType: OrgAuditResource.CARE_ABSENCE,
    resourceId: absenceId,
    meta: { organizationId: context.organization.id, absenceId, change }
  });
}

/** Asutuse hooldajad (inimesed, kes on mõne kliendi meeskonnas): neile saab puudumise märkida. */
export async function loadCareWorkerIds(tx, organizationId) {
  const rows = await tx.careClientTeamMember.findMany({
    where: { endedAt: null, client: { organizationId }, membership: { status: OrganizationMembershipStatus.ACTIVE } },
    distinct: ["membershipId"],
    select: { membershipId: true, membership: { select: MEMBER_NAME } }
  });
  return rows
    .map((row) => ({ membershipId: row.membershipId, name: personName(row.membership) }))
    .sort((a, b) => a.name.localeCompare(b.name, "et"));
}

/** Kes puuduvad vahemikus `fromDay … toDay`: päev → puuduvate liikmesuste hulk. */
export async function loadAbsentByDay(db, organizationId, fromDay, toDay) {
  const rows = await db.careAbsence.findMany({
    where: { organizationId, fromDay: { lte: toDay }, toDay: { gte: fromDay } },
    select: { membershipId: true, fromDay: true, toDay: true }
  });
  const byDay = new Map();
  for (let day = fromDay; day <= toDay; day = shiftDay(day, 1)) {
    byDay.set(day, new Set(rows.filter((row) => row.fromDay <= day && row.toDay >= day).map((row) => row.membershipId)));
  }
  return byDay;
}

async function loadList(tx, organizationId, today) {
  const rows = await tx.careAbsence.findMany({
    where: { organizationId, toDay: { gte: shiftDay(today, -HOME_CARE_LIMITS.ABSENCE_BACK_DAYS) } },
    select: ABSENCE_SELECT,
    orderBy: [{ fromDay: "asc" }, { id: "asc" }],
    take: HOME_CARE_LIMITS.ABSENCES_LIST_MAX
  });
  return rows.map((row) => serializeAbsence(row, today));
}

async function view(tx, context, today) {
  return {
    today,
    absences: await loadList(tx, context.organization.id, today),
    careWorkers: await loadCareWorkerIds(tx, context.organization.id),
    canEdit: Boolean(context.writable)
  };
}

/** Käimasolevad ja tulevased puudumised (ja viimase nädala lõppenud) hooldusjuhile. */
export async function getAbsences(context, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  requireCoordinator(context);
  const today = todayText(now, organizationTimeZone(context));
  return db.$transaction((tx) => view(tx, context, today));
}

async function assertNoOverlap(tx, organizationId, membershipId, data, exceptId = null) {
  const clash = await tx.careAbsence.findFirst({
    where: {
      organizationId,
      membershipId,
      fromDay: { lte: data.toDay },
      toDay: { gte: data.fromDay },
      ...(exceptId ? { id: { not: exceptId } } : {})
    },
    select: { id: true }
  });
  if (clash) throw conflict("home_care.errors.absence_overlap");
}

/**
 * Märgib töötajale ühe päeva ootamatu puudumise teise tehingu sees (K3-e: hooldusjuht
 * teeb seda takistuse teate „ei saa täna töötada" juurest). Kui see päev on juba mõne
 * puudumisega kaetud, ei tee midagi. Tagastab loodud rea ID või `null`.
 */
export async function markAbsentWithin(tx, context, membershipId, day) {
  const organizationId = context.organization.id;
  const covered = await tx.careAbsence.findFirst({
    where: { organizationId, membershipId, fromDay: { lte: day }, toDay: { gte: day } },
    select: { id: true }
  });
  if (covered) return null;
  const created = await tx.careAbsence.create({
    data: {
      organizationId,
      membershipId,
      fromDay: day,
      toDay: day,
      kind: CareAbsenceKind.SUDDEN,
      createdByMembershipId: context.membership?.id || null,
      createdByName: await membershipDisplayName(tx, context)
    },
    select: { id: true }
  });
  await writeAbsenceAudit(tx, context, created.id, "created");
  return created.id;
}

/** Märgib töötaja puudumise. Töötaja peab olema asutuse hooldaja; sama töötaja puudumised ei kattu. */
export async function createAbsence(context, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  requireCoordinator(context);
  const today = todayText(now, organizationTimeZone(context));
  const membershipId = normalizeId(asObject(input).membershipId, "home_care.errors.absence_worker_invalid");
  const data = normalizeAbsenceInput(input, today);
  const organizationId = context.organization.id;

  return db.$transaction(async (tx) => {
    const workers = await loadCareWorkerIds(tx, organizationId);
    if (!workers.some((worker) => worker.membershipId === membershipId)) throw badRequest("home_care.errors.absence_worker_invalid");
    await assertNoOverlap(tx, organizationId, membershipId, data);
    const created = await tx.careAbsence.create({
      data: {
        ...data,
        organizationId,
        membershipId,
        createdByMembershipId: context.membership?.id || null,
        createdByName: await membershipDisplayName(tx, context)
      },
      select: { id: true }
    });
    await writeAbsenceAudit(tx, context, created.id, "created");
    return { absenceId: created.id, ...(await view(tx, context, today)) };
  });
}

/** Muudab puudumise päevi või liiki (näiteks töötaja tuli varem tagasi). Nõuab nähtud versiooni. */
export async function updateAbsence(context, absenceId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  requireCoordinator(context);
  const id = normalizeId(absenceId, "home_care.errors.absence_not_found");
  const version = normalizeVersion(asObject(input).version);
  const today = todayText(now, organizationTimeZone(context));
  const data = normalizeAbsenceInput(input, today);
  const organizationId = context.organization.id;

  return db.$transaction(async (tx) => {
    const row = await tx.careAbsence.findFirst({ where: { id, organizationId }, select: { id: true, membershipId: true, version: true } });
    if (!row) throw notFound("home_care.errors.absence_not_found");
    await assertNoOverlap(tx, organizationId, row.membershipId, data, id);
    const result = await tx.careAbsence.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
    if (result.count !== 1) throw conflict("home_care.errors.version_conflict", { currentVersion: row.version });
    await writeAbsenceAudit(tx, context, id, "updated");
    return view(tx, context, today);
  });
}

/** Kustutab ekslikult märgitud puudumise. Muutus jääb auditisse. */
export async function removeAbsence(context, absenceId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  requireCoordinator(context);
  const id = normalizeId(absenceId, "home_care.errors.absence_not_found");
  const version = normalizeVersion(asObject(input).version);
  const today = todayText(now, organizationTimeZone(context));
  const organizationId = context.organization.id;

  return db.$transaction(async (tx) => {
    const row = await tx.careAbsence.findFirst({ where: { id, organizationId }, select: { id: true, version: true } });
    if (!row) throw notFound("home_care.errors.absence_not_found");
    const result = await tx.careAbsence.deleteMany({ where: { id, version } });
    if (result.count !== 1) throw conflict("home_care.errors.version_conflict", { currentVersion: row.version });
    await writeAbsenceAudit(tx, context, id, "removed");
    return view(tx, context, today);
  });
}
