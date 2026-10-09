/**
 * KODUTEENUS kiht 3, K3-a — käigumuster ja hooldaja tänane päev.
 *
 * KÄIGUMUSTER on kliendi korduvad käigud nädalas: nädalapäev, algusaeg, plaanitud
 * kestus ja töötaja. Sellest ja ühe päeva eranditest arvutatakse päevaplaan
 * (`dayPlan.js`): hooldaja tänane nimekiri ja hooldusjuhi päevavaade. Muster on asutuse ühine ja kliendi küljes, nagu
 * otsus ja käigu kirje: platvormi teenuspäeviku päevatahvel käib iga töötaja isikliku
 * teenuseosutaja profiili kaudu ja ainult tänase päeva kohta.
 *
 * MINEVIK EI MUUTU. Juba alanud mustri muutmine („alates tänasest") lõpetab vana rea
 * eilse päevaga ja loob uue rea tänasest. Nii on hiljem näha, mis oli plaanis päeval,
 * mil käik tehti või tegemata jäi. Rida, mis ei ole veel alanud, muudetakse kohapeal;
 * lõpetamisel selline rida kustub, sest see ei ole kunagi kehtinud.
 *
 * TÖÖTAJA peab olema kliendi meeskonnas: meeskond annab ligipääsu kliendi lehele, ja
 * käiku ei saa määrata inimesele, kes klienti avada ei tohi.
 *
 * Mustrit loeb igaüks, kes tohib kliendi lehte avada; muudab hooldusjuht, kelle
 * skoobis klient on.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { OrganizationMembershipStatus } from "../org/constants.js";
import { badRequest, conflict, notFound } from "../org/errors.js";
import { shiftLocalDate } from "../time/estonianDay.js";

import { assertHomeCareContext, organizationTimeZone, personName, requireClientAccess, requireClientCoordinator } from "./access.js";
import { CARE_VISIT_PRIORITIES, CareVisitPriority, HOME_CARE_LIMITS } from "./constants.js";
import { todayText } from "./decisions.js";
import { VISIT_RECORD } from "./provided.js";
import { asObject, normalizeEnum, normalizeId, normalizeIsoDay, normalizeLine, normalizeOptionalId, normalizeVersion } from "./validation.js";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MEMBER_NAME = Object.freeze({
  status: true,
  jobTitle: true,
  user: { select: { profile: { select: { firstName: true, lastName: true } } } }
});
const SLOT_SELECT = Object.freeze({
  id: true,
  weekday: true,
  startMinute: true,
  plannedMinutes: true,
  priority: true,
  workerMembershipId: true,
  note: true,
  validFrom: true,
  validUntil: true,
  version: true,
  worker: { select: MEMBER_NAME }
});

function pad(value) {
  return String(value).padStart(2, "0");
}

function partsOf(day) {
  const [year, month, date] = day.split("-").map(Number);
  return { year, month, day: date };
}

function dayOf(parts) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** Päev ± n päeva kujul `AAAA-KK-PP`. */
export function shiftDay(day, days) {
  return dayOf(shiftLocalDate(partsOf(day), days));
}

/** Nädalapäev 1 (esmaspäev) kuni 7 (pühapäev). */
export function weekdayOf(day) {
  const { year, month, day: date } = partsOf(day);
  return ((new Date(Date.UTC(year, month - 1, date)).getUTCDay() + 6) % 7) + 1;
}

/** Minutid südaööst kujul `09:30`. */
export function timeText(minutes) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Kas muster kehtib sellel päeval (õige nädalapäev ja kehtivuse sees). */
export function slotActiveOn(slot, day) {
  return slot.weekday === weekdayOf(day) && slot.validFrom <= day && (!slot.validUntil || slot.validUntil >= day);
}

function serializeSlot(row) {
  return {
    id: row.id,
    weekday: row.weekday,
    startMinute: row.startMinute,
    startTime: timeText(row.startMinute),
    plannedMinutes: row.plannedMinutes,
    priority: row.priority || CareVisitPriority.B,
    worker: row.workerMembershipId
      ? {
          membershipId: row.workerMembershipId,
          name: personName(row.worker),
          active: row.worker?.status === OrganizationMembershipStatus.ACTIVE
        }
      : null,
    note: row.note || null,
    validFrom: row.validFrom,
    validUntil: row.validUntil || null,
    version: row.version
  };
}

function dayText(parts) {
  return parts ? dayOf(parts) : null;
}

function normalizeTime(value) {
  const match = TIME_PATTERN.exec(typeof value === "string" ? value.trim() : "");
  if (!match) throw badRequest("home_care.errors.slot_time_invalid");
  return Number(match[1]) * 60 + Number(match[2]);
}

function normalizeMinutes(value) {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  const minutes = /^\d{1,3}$/.test(text) ? Number(text) : NaN;
  if (!Number.isInteger(minutes) || minutes < HOME_CARE_LIMITS.SLOT_MINUTES_MIN || minutes > HOME_CARE_LIMITS.SLOT_MINUTES_MAX) {
    throw badRequest("home_care.errors.slot_minutes_invalid", { min: HOME_CARE_LIMITS.SLOT_MINUTES_MIN, max: HOME_CARE_LIMITS.SLOT_MINUTES_MAX });
  }
  return minutes;
}

function normalizeWeekdays(value) {
  const days = Array.isArray(value) ? value.map(Number) : [];
  if (!days.length || days.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
    throw badRequest("home_care.errors.slot_weekday_required");
  }
  return [...new Set(days)].sort((a, b) => a - b);
}

/** Mustri ühised väljad: algusaeg, kestus, töötaja ja märkus. */
function normalizeSlotFields(input) {
  return {
    startMinute: normalizeTime(input.startTime),
    plannedMinutes: normalizeMinutes(input.plannedMinutes),
    /* Tähtsus puudub = B (nii saadab ka varasem vorm). */
    priority: normalizeEnum(input.priority, CARE_VISIT_PRIORITIES, "home_care.errors.slot_priority_invalid", { fallback: CareVisitPriority.B }),
    workerMembershipId: normalizeOptionalId(input.workerMembershipId, "home_care.errors.slot_worker_not_in_team"),
    note: normalizeLine(input.note, HOME_CARE_LIMITS.SLOT_NOTE_MAX)
  };
}

/** Töötaja peab olema kliendi praeguses meeskonnas ja tema liikmesus kehtiv. */
async function assertWorkerInTeam(tx, clientId, workerMembershipId) {
  if (!workerMembershipId) return;
  const row = await tx.careClientTeamMember.findFirst({
    where: { clientId, membershipId: workerMembershipId, endedAt: null, membership: { status: OrganizationMembershipStatus.ACTIVE } },
    select: { id: true }
  });
  if (!row) throw badRequest("home_care.errors.slot_worker_not_in_team");
}

async function writeSlotAudit(tx, context, clientId, slotId, change) {
  await writeOrgAudit(tx, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_SLOT_CHANGED,
    resourceType: OrgAuditResource.CARE_VISIT_SLOT,
    resourceId: slotId,
    meta: { organizationId: context.organization.id, clientId, slotId, change }
  });
}

/** Kliendi kehtivad ja tulevased käigumustri read (lõppenud ridu ei näidata). */
export async function loadSlotsWithin(tx, clientId, today) {
  const rows = await tx.careVisitSlot.findMany({
    where: { clientId, OR: [{ validUntil: null }, { validUntil: { gte: today } }] },
    select: SLOT_SELECT,
    orderBy: [{ weekday: "asc" }, { startMinute: "asc" }, { id: "asc" }],
    take: HOME_CARE_LIMITS.SLOTS_MAX
  });
  return rows.map(serializeSlot);
}

/** Meeskonna liikmed, kellele saab käiku määrata, koos viimase 28 päeva käigu kirjete arvuga selle kliendi juures. */
async function loadAssignableTeam(tx, clientId, now) {
  const members = await tx.careClientTeamMember.findMany({
    where: { clientId, endedAt: null, membership: { status: OrganizationMembershipStatus.ACTIVE } },
    select: { membershipId: true, membership: { select: MEMBER_NAME } },
    orderBy: [{ startedAt: "asc" }, { id: "asc" }]
  });
  const since = new Date(now.getTime() - HOME_CARE_LIMITS.SLOT_LOAD_DAYS * 24 * 60 * 60 * 1000);
  const counts = await tx.careClientEntry.groupBy({
    by: ["authorMembershipId"],
    where: { clientId, ...VISIT_RECORD, occurredAt: { gte: since } },
    _count: { _all: true }
  });
  const countOf = new Map(counts.map((row) => [row.authorMembershipId, row._count._all]));
  return members.map((row) => ({
    membershipId: row.membershipId,
    name: personName(row.membership),
    /* „Käike viimase 28 päeva jooksul": määramise hetkel on näha, kelle kord on (kava II.6.3). */
    recentVisits: countOf.get(row.membershipId) || 0
  }));
}

/** Käigumuster kliendi lehele: loeb igaüks, kes tohib lehte avada. */
export async function getClientSlots(context, clientId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const today = todayText(now, organizationTimeZone(context));
  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { now });
    return { today, slots: await loadSlotsWithin(tx, id, today), canEdit: access.isCoordinator && Boolean(context.writable) };
  });
}

async function editorView(tx, context, clientId, today, now) {
  return {
    today,
    slots: await loadSlotsWithin(tx, clientId, today),
    team: await loadAssignableTeam(tx, clientId, now),
    canEdit: Boolean(context.writable)
  };
}

/** Käigumustri lehe algseis hooldusjuhile. Muu on 403 (leht teeb sellest 404). */
export async function getSlotEditor(context, clientId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const today = todayText(now, organizationTimeZone(context));
  return db.$transaction(async (tx) => {
    const access = await requireClientCoordinator(tx, context, id, { now });
    return { client: { id: access.client.id, displayName: access.client.displayName }, ...(await editorView(tx, context, id, today, now)) };
  });
}

/** Lisab korduva käigu igale valitud nädalapäevale (üks rida päeva kohta). */
export async function createSlots(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const body = asObject(input);
  const weekdays = normalizeWeekdays(body.weekdays);
  const fields = normalizeSlotFields(body);
  const today = todayText(now, organizationTimeZone(context));
  const validFrom = dayText(normalizeIsoDay(body.validFrom)) || today;
  if (validFrom < today) throw badRequest("home_care.errors.slot_from_past");
  const validUntil = dayText(normalizeIsoDay(body.validUntil));
  if (validUntil && validUntil < validFrom) throw badRequest("home_care.errors.slot_period_invalid");

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    await assertWorkerInTeam(tx, id, fields.workerMembershipId);
    const current = await tx.careVisitSlot.count({ where: { clientId: id, OR: [{ validUntil: null }, { validUntil: { gte: today } }] } });
    if (current + weekdays.length > HOME_CARE_LIMITS.SLOTS_MAX) {
      throw badRequest("home_care.errors.slot_too_many", { limit: HOME_CARE_LIMITS.SLOTS_MAX });
    }
    for (const weekday of weekdays) {
      const created = await tx.careVisitSlot.create({
        data: {
          ...fields,
          organizationId: context.organization.id,
          clientId: id,
          weekday,
          validFrom,
          validUntil,
          createdByMembershipId: context.membership?.id || null
        },
        select: { id: true }
      });
      await writeSlotAudit(tx, context, id, created.id, "created");
    }
    return editorView(tx, context, id, today, now);
  });
}

async function findOwnSlot(tx, clientId, slotId) {
  const row = await tx.careVisitSlot.findFirst({
    where: { id: slotId, clientId },
    select: { id: true, weekday: true, validFrom: true, validUntil: true, version: true }
  });
  if (!row) throw notFound("home_care.errors.slot_not_found");
  return row;
}

/**
 * Muudab korduva käigu aega, kestust, töötajat või märkust alates tänasest. Juba alanud
 * rida lõpetatakse eilse päevaga ja selle asemele tekib uus rida tänasest; veel alustamata
 * (või täna alanud) rida muudetakse kohapeal.
 */
export async function changeSlot(context, clientId, slotId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const targetId = normalizeId(slotId, "home_care.errors.slot_not_found");
  const body = asObject(input);
  const version = normalizeVersion(body.version);
  const fields = normalizeSlotFields(body);
  const today = todayText(now, organizationTimeZone(context));

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const slot = await findOwnSlot(tx, id, targetId);
    if (slot.validUntil && slot.validUntil < today) throw conflict("home_care.errors.slot_ended");
    await assertWorkerInTeam(tx, id, fields.workerMembershipId);

    if (slot.validFrom >= today) {
      const result = await tx.careVisitSlot.updateMany({ where: { id: targetId, version }, data: { ...fields, version: { increment: 1 } } });
      if (result.count !== 1) throw conflict("home_care.errors.version_conflict", { currentVersion: slot.version });
      await writeSlotAudit(tx, context, id, targetId, "changed");
    } else {
      const result = await tx.careVisitSlot.updateMany({
        where: { id: targetId, version },
        data: { validUntil: shiftDay(today, -1), version: { increment: 1 } }
      });
      if (result.count !== 1) throw conflict("home_care.errors.version_conflict", { currentVersion: slot.version });
      const created = await tx.careVisitSlot.create({
        data: {
          ...fields,
          organizationId: context.organization.id,
          clientId: id,
          weekday: slot.weekday,
          validFrom: today,
          validUntil: slot.validUntil,
          createdByMembershipId: context.membership?.id || null
        },
        select: { id: true }
      });
      await writeSlotAudit(tx, context, id, targetId, "ended");
      await writeSlotAudit(tx, context, id, created.id, "created");
    }
    return editorView(tx, context, id, today, now);
  });
}

/**
 * Lõpetab korduva käigu. Viimane kehtiv päev on vaikimisi eile (tänasest enam ei kehti);
 * varasemat päeva valida ei saa, sest möödunud päevade plaan ei muutu. Rida, mis ei ole
 * selleks päevaks veel alanud, kustub.
 */
export async function endSlot(context, clientId, slotId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const targetId = normalizeId(slotId, "home_care.errors.slot_not_found");
  const body = asObject(input);
  const version = normalizeVersion(body.version);
  const today = todayText(now, organizationTimeZone(context));
  const yesterday = shiftDay(today, -1);
  const lastDay = dayText(normalizeIsoDay(body.lastDay)) || yesterday;
  if (lastDay < yesterday) throw badRequest("home_care.errors.slot_end_past");

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const slot = await findOwnSlot(tx, id, targetId);
    if (slot.validUntil && slot.validUntil < today) throw conflict("home_care.errors.slot_ended");
    const neverRan = slot.validFrom > lastDay;
    const result = neverRan
      ? await tx.careVisitSlot.deleteMany({ where: { id: targetId, version } })
      : await tx.careVisitSlot.updateMany({ where: { id: targetId, version }, data: { validUntil: lastDay, version: { increment: 1 } } });
    if (result.count !== 1) throw conflict("home_care.errors.version_conflict", { currentVersion: slot.version });
    await writeSlotAudit(tx, context, id, targetId, neverRan ? "removed" : "ended");
    return editorView(tx, context, id, today, now);
  });
}
