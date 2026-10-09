/**
 * KODUTEENUS kiht 3, K3-b — päevaplaan: käigumuster koos ühe päeva eranditega.
 *
 * PÄEVA PLAAN arvutatakse, seda ei salvestata: sellel päeval kehtivad käigumustri read
 * (K3-a), nende peal selle päeva erandid ja kõrval selle päeva käigu kirjed. Nii ei ole
 * vaja ööseks midagi ette genereerida ja mustri muudatus kajastub kohe.
 *
 * ERAND on ühe korduva käigu muudatus ühel päeval: ümbertõstmine (teine töötaja ja/või
 * teine kellaaeg) või ärajätmine põhjusega. Muster ise ei muutu. Ümber tõsta saab
 * tänast ja tulevast käiku; ära jätta ja muudatust tagasi võtta ka kuni nädal tagasi,
 * et tegemata jäänud käigule saaks põhjuse kirja panna.
 *
 * KÄIGU SEIS: ära jäetud; tehtud (kliendil on sel päeval käigu kirje; mitme käigu puhul
 * loetakse kirjed kellaaja järjekorras, ära jäetud käiku vahele jättes); kirje puudub
 * (päev on möödas või tänase käigu plaanitud lõpust on üle tunni); ees.
 *
 * ASENDAJA. Ümber tõsta saab asutuse hooldajale (inimene, kes on mõne kliendi
 * meeskonnas), ka siis, kui ta ei ole selle kliendi meeskonnas: ta näeb käiku oma
 * päevas ja avab kliendi lehe põhjusega nagu iga asendaja.
 *
 * PUUDUV TÖÖTAJA (K3-c). Käik, mille selle päeva tegija on puudujate hulgas ja mis ei ole
 * tehtud ega ära jäetud, on omaette rühmas kõige ees, tähtsamad käigud enne (A, B, C).
 * Puuduvat töötajat asendajaks ei pakuta. Puuduja enda päevas käike ei ole.
 *
 * Päevaplaani näeb ja muudab hooldusjuht oma skoobis. Hooldaja näeb oma päeva.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { OrganizationMembershipStatus } from "../org/constants.js";
import { badRequest, forbidden, notFound } from "../org/errors.js";
import { localDateTimeToUtc, shiftLocalDate, zonedParts } from "../time/estonianDay.js";

import { loadAbsentByDay, loadCareWorkerIds } from "./absences.js";
import {
  assertHomeCareContext,
  coordinatorScope,
  membershipDisplayName,
  organizationTimeZone,
  personName,
  requireClientCoordinator
} from "./access.js";
import {
  CARE_VISIT_CANCEL_REASONS,
  CARE_VISIT_PRIORITIES,
  CareClientStatus,
  CarePlannedState,
  CareVisitChangeKind,
  CareVisitPriority,
  HOME_CARE_COORDINATOR,
  HOME_CARE_LIMITS
} from "./constants.js";
import { todayText } from "./decisions.js";
import { VISIT_RECORD } from "./provided.js";
import { shiftDay, slotActiveOn, timeText, weekdayOf } from "./slots.js";
import { asObject, normalizeEnum, normalizeId, normalizeIsoDay, normalizeLine, normalizeOptionalId } from "./validation.js";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MEMBER_NAME = Object.freeze({
  status: true,
  jobTitle: true,
  user: { select: { profile: { select: { firstName: true, lastName: true } } } }
});

function pad(value) {
  return String(value).padStart(2, "0");
}

function partsOf(day) {
  const [year, month, date] = day.split("-").map(Number);
  return { year, month, day: date };
}

function dayOfDate(date, timeZone) {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/**
 * Ühe päeva plaan mustri ridadest, eranditest ja käigu kirjete arvust. Puhas funktsioon:
 * andmebaasi ei loe, et reeglit saaks testida.
 *
 * @param {{ slots: Array, changes: Map<string, object>, recordCounts: Map<string, number>, day: string, today: string, nowMinute: number, absent?: Set<string> }} input
 */
export function buildDayPlan({ slots, changes, recordCounts, day, today, nowMinute, absent = new Set() }) {
  const visits = slots.map((slot) => {
    const change = changes.get(slot.id) || null;
    const cancelled = change?.kind === CareVisitChangeKind.CANCELLED;
    const moved = change?.kind === CareVisitChangeKind.MOVED;
    return {
      slotId: slot.id,
      clientId: slot.clientId,
      startMinute: moved && change.startMinute !== null && change.startMinute !== undefined ? change.startMinute : slot.startMinute,
      plannedMinutes: slot.plannedMinutes,
      priority: slot.priority || CareVisitPriority.B,
      note: slot.note || null,
      workerMembershipId: cancelled ? slot.workerMembershipId || null : moved ? change.workerMembershipId || null : slot.workerMembershipId || null,
      baseWorkerMembershipId: slot.workerMembershipId || null,
      baseStartMinute: slot.startMinute,
      change: change ? { kind: change.kind, reason: change.reason || null, note: change.note || null } : null,
      cancelled
    };
  });

  /* Tehtud: kliendi päeva kirjed katavad ära jätmata käike kellaaja järjekorras. */
  const done = new Set();
  const byClient = new Map();
  for (const visit of visits) {
    if (visit.cancelled) continue;
    if (!byClient.has(visit.clientId)) byClient.set(visit.clientId, []);
    byClient.get(visit.clientId).push(visit);
  }
  for (const [clientId, list] of byClient) {
    list.sort((a, b) => a.startMinute - b.startMinute || String(a.slotId).localeCompare(String(b.slotId)));
    for (const visit of list.slice(0, Math.max(0, recordCounts.get(clientId) || 0))) done.add(visit.slotId);
  }

  return visits
    .map(({ cancelled, ...visit }) => {
      let state = CarePlannedState.PLANNED;
      if (cancelled) state = CarePlannedState.CANCELLED;
      else if (done.has(visit.slotId)) state = CarePlannedState.DONE;
      else if (day < today) state = CarePlannedState.MISSING;
      else if (day === today && nowMinute > visit.startMinute + visit.plannedMinutes + HOME_CARE_LIMITS.VISIT_MISSING_GRACE_MIN) {
        state = CarePlannedState.MISSING;
      }
      /* Tegija puudub: loeb ainult käigul, mis on veel tegemata (ei tehtud ega ära jäetud). */
      const workerAbsent =
        Boolean(visit.workerMembershipId) &&
        absent.has(visit.workerMembershipId) &&
        state !== CarePlannedState.DONE &&
        state !== CarePlannedState.CANCELLED;
      return { ...visit, state, workerAbsent };
    })
    .sort((a, b) => a.startMinute - b.startMinute || String(a.slotId).localeCompare(String(b.slotId)));
}

/**
 * Loeb vahemiku `fromDay … toDay` plaani: mustri read, erandid ja käigu kirjed kolme
 * päringuga, ning ehitab iga päeva plaani. `clientWhere` piirab kliente (skoop, seis).
 */
async function loadRange(db, { organizationId, fromDay, toDay, timeZone, now, clientWhere }) {
  const today = todayText(now, timeZone);
  const local = zonedParts(now, timeZone);
  const nowMinute = local.hour * 60 + local.minute;

  const slots = await db.careVisitSlot.findMany({
    where: {
      organizationId,
      validFrom: { lte: toDay },
      OR: [{ validUntil: null }, { validUntil: { gte: fromDay } }],
      client: clientWhere
    },
    select: {
      id: true,
      clientId: true,
      weekday: true,
      startMinute: true,
      plannedMinutes: true,
      priority: true,
      workerMembershipId: true,
      note: true,
      validFrom: true,
      validUntil: true,
      client: { select: { id: true, displayName: true, address: true, status: true } }
    },
    orderBy: [{ startMinute: "asc" }, { id: "asc" }],
    take: HOME_CARE_LIMITS.DAY_PLAN_SLOTS_MAX
  });
  const slotIds = slots.map((slot) => slot.id);
  const clientIds = [...new Set(slots.map((slot) => slot.clientId))];
  const changeRows = slotIds.length
    ? await db.careVisitChange.findMany({
        where: { organizationId, slotId: { in: slotIds }, day: { gte: fromDay, lte: toDay } },
        select: { slotId: true, day: true, kind: true, workerMembershipId: true, startMinute: true, reason: true, note: true }
      })
    : [];
  const entries = clientIds.length
    ? await db.careClientEntry.findMany({
        where: {
          organizationId,
          clientId: { in: clientIds },
          ...VISIT_RECORD,
          occurredAt: {
            gte: localDateTimeToUtc(partsOf(fromDay), timeZone),
            lt: localDateTimeToUtc(shiftLocalDate(partsOf(toDay), 1), timeZone)
          }
        },
        select: { clientId: true, occurredAt: true }
      })
    : [];

  const absentByDay = await loadAbsentByDay(db, organizationId, fromDay, toDay);
  const days = new Map();
  for (let day = fromDay; day <= toDay; day = shiftDay(day, 1)) {
    const changes = new Map(changeRows.filter((row) => row.day === day).map((row) => [row.slotId, row]));
    const recordCounts = new Map();
    for (const entry of entries) {
      if (dayOfDate(entry.occurredAt, timeZone) !== day) continue;
      recordCounts.set(entry.clientId, (recordCounts.get(entry.clientId) || 0) + 1);
    }
    days.set(
      day,
      buildDayPlan({
        slots: slots.filter((slot) => slotActiveOn(slot, day)),
        changes,
        recordCounts,
        day,
        today,
        nowMinute,
        absent: absentByDay.get(day)
      })
    );
  }
  return { today, days, absentByDay, clients: new Map(slots.map((slot) => [slot.clientId, slot.client])) };
}

/** Töötajate nimed liikmesuse ID järgi (asutuse piires). */
async function loadNames(db, organizationId, membershipIds) {
  const ids = [...new Set(membershipIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await db.organizationMembership.findMany({
    where: { organizationId, id: { in: ids } },
    select: { id: true, ...MEMBER_NAME }
  });
  return new Map(rows.map((row) => [row.id, { name: personName(row), active: row.status === OrganizationMembershipStatus.ACTIVE }]));
}

function serializeVisit(visit, client, names) {
  const worker = visit.workerMembershipId ? names.get(visit.workerMembershipId) : null;
  return {
    slotId: visit.slotId,
    startMinute: visit.startMinute,
    startTime: timeText(visit.startMinute),
    plannedMinutes: visit.plannedMinutes,
    priority: visit.priority,
    note: visit.note,
    /* Selle päeva tegija on puudujate hulgas ja käik on veel tegemata. */
    workerAbsent: Boolean(visit.workerAbsent),
    client: { id: client.id, displayName: client.displayName, address: client.address || null, status: client.status },
    worker: visit.workerMembershipId ? { membershipId: visit.workerMembershipId, name: worker?.name || "", active: Boolean(worker?.active) } : null,
    state: visit.state,
    change: visit.change
      ? {
          kind: visit.change.kind,
          reason: visit.change.reason,
          note: visit.change.note,
          /* Mis ümbertõstmisel muutus: töötaja, kellaaeg või mõlemad. */
          workerChanged: visit.change.kind === CareVisitChangeKind.MOVED && visit.workerMembershipId !== visit.baseWorkerMembershipId,
          timeChanged: visit.change.kind === CareVisitChangeKind.MOVED && visit.startMinute !== visit.baseStartMinute
        }
      : null
  };
}

/** Klientide praegused meeskonnad: kliendi ID → liikmesuste ID-d. */
async function loadTeams(db, clientIds) {
  if (!clientIds.length) return {};
  const rows = await db.careClientTeamMember.findMany({
    where: { clientId: { in: clientIds }, endedAt: null },
    select: { clientId: true, membershipId: true }
  });
  const teams = {};
  for (const row of rows) (teams[row.clientId] ||= []).push(row.membershipId);
  return teams;
}

function resolveDay(value, today) {
  const parts = normalizeIsoDay(value);
  return parts ? `${parts.year}-${pad(parts.month)}-${pad(parts.day)}` : today;
}

/**
 * Hooldusjuhi päevaplaan tema skoobis: käigud töötaja kaupa, määramata käigud ja selle
 * nädala (esmaspäevast pühapäevani) päevade arvud.
 */
export async function getDayPlan(context, rawQuery = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const scope = coordinatorScope(context);
  if (!scope) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });

  const organizationId = context.organization.id;
  const timeZone = organizationTimeZone(context);
  const day = resolveDay(asObject(rawQuery).day, todayText(now, timeZone));
  const monday = shiftDay(day, 1 - weekdayOf(day));
  const { today, days, clients, absentByDay } = await loadRange(db, {
    organizationId,
    fromDay: monday,
    toDay: shiftDay(monday, 6),
    timeZone,
    now,
    clientWhere: {
      status: { in: [CareClientStatus.ACTIVE, CareClientStatus.AWAY] },
      ...(scope.wholeOrg ? {} : { unitId: { in: scope.unitIds } })
    }
  });

  const isActive = (visit) => clients.get(visit.clientId).status === CareClientStatus.ACTIVE;
  const planned = (days.get(day) || []).filter(isActive);
  const away = (days.get(day) || []).filter((visit) => !isActive(visit));
  const names = await loadNames(db, organizationId, [...planned, ...away].map((visit) => visit.workerMembershipId));
  const serialize = (visit) => serializeVisit(visit, clients.get(visit.clientId), names);

  /* Ära jäetud käik jääb selle töötaja alla, kellele see mustris kuulus: nii on näha, kelle päevast see ära läks. */
  const workers = new Map();
  const unassigned = [];
  /* Käigud, mille tegija puudub: omaette rühm, tähtsamad enne, siis kellaaja järgi. */
  const rank = (visit) => CARE_VISIT_PRIORITIES.indexOf(visit.priority);
  const uncovered = planned
    .filter((visit) => visit.workerAbsent)
    .sort((a, b) => rank(a) - rank(b) || a.startMinute - b.startMinute)
    .map(serialize);
  for (const visit of planned) {
    if (visit.workerAbsent) continue;
    if (!visit.workerMembershipId) {
      unassigned.push(serialize(visit));
      continue;
    }
    if (!workers.has(visit.workerMembershipId)) {
      const person = names.get(visit.workerMembershipId);
      workers.set(visit.workerMembershipId, { membershipId: visit.workerMembershipId, name: person?.name || "", active: Boolean(person?.active), visits: [] });
    }
    workers.get(visit.workerMembershipId).visits.push(serialize(visit));
  }

  const count = (list, state) => list.filter((visit) => visit.state === state).length;
  const live = (list) => list.filter((visit) => visit.state !== CarePlannedState.CANCELLED);
  return {
    day,
    today,
    weekday: weekdayOf(day),
    previousDay: shiftDay(day, -1),
    nextDay: shiftDay(day, 1),
    canEdit: Boolean(context.writable),
    week: [...days.entries()].map(([weekDay, list]) => {
      const active = list.filter(isActive);
      return {
        day: weekDay,
        weekday: weekdayOf(weekDay),
        planned: live(active).length,
        unassigned: live(active).filter((visit) => !visit.workerMembershipId).length,
        missing: count(active, CarePlannedState.MISSING),
        uncovered: active.filter((visit) => visit.workerAbsent).length
      };
    }),
    totals: {
      planned: live(planned).length,
      minutes: live(planned).reduce((sum, visit) => sum + visit.plannedMinutes, 0),
      done: count(planned, CarePlannedState.DONE),
      missing: count(planned, CarePlannedState.MISSING),
      cancelled: count(planned, CarePlannedState.CANCELLED),
      unassigned: live(planned).filter((visit) => !visit.workerMembershipId).length,
      uncovered: uncovered.length
    },
    uncovered,
    unassigned,
    workers: [...workers.values()].sort((a, b) => a.name.localeCompare(b.name, "et")),
    /* Ajutiselt ära oleva kliendi käigud: muster kehtib, aga käiku ei tehta. */
    away: away.map(serialize),
    /* Kellele saab ümber tõsta: asutuse hooldajad, sel päeval puuduja märgiga. */
    careWorkers: (await loadCareWorkerIds(db, organizationId)).map((worker) => ({
      ...worker,
      absent: Boolean(absentByDay.get(day)?.has(worker.membershipId))
    })),
    /* Kes klienti tunneb: selle päeva käikude klientide meeskonnad (ümbertõstmisel pakutakse neid enne). */
    teams: await loadTeams(db, [...new Set([...planned, ...away].map((visit) => visit.clientId))])
  };
}

/**
 * Hooldaja tänane päev: tema tänased käigud koos eranditega. Mustri järgi tema käik on
 * päevas siis, kui ta on kliendi meeskonnas; talle ümber tõstetud käik on päevas alati
 * (asendaja avab kliendi lehe põhjusega). Kolleegile ümber tõstetud käiku tema päevas ei
 * ole; ära jäetud käik on, märgiga, et ta ei läheks.
 */
export async function getMyDay(context, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const organizationId = context.organization.id;
  const timeZone = organizationTimeZone(context);
  const day = todayText(now, timeZone);
  const membershipId = context.membership?.id;
  if (!membershipId) return { today: day, weekday: weekdayOf(day), absent: false, visits: [] };

  const { days, clients, absentByDay } = await loadRange(db, {
    organizationId,
    fromDay: day,
    toDay: day,
    timeZone,
    now,
    clientWhere: { status: CareClientStatus.ACTIVE }
  });
  /* Puudujal tänaseid käike ei ole: need on hooldusjuhi päevaplaanis katmata käikude seas. */
  const absent = Boolean(absentByDay.get(day)?.has(membershipId));
  const mine = absent ? [] : (days.get(day) || []).filter((visit) => visit.workerMembershipId === membershipId);
  if (!mine.length) return { today: day, weekday: weekdayOf(day), absent, visits: [] };

  /* Mustri järgi oma käik eeldab, et inimene on praegu kliendi meeskonnas. */
  const teamRows = await db.careClientTeamMember.findMany({
    where: { membershipId, endedAt: null, clientId: { in: [...new Set(mine.map((visit) => visit.clientId))] } },
    select: { clientId: true }
  });
  const onTeam = new Set(teamRows.map((row) => row.clientId));
  const names = await loadNames(db, organizationId, [membershipId]);
  const visits = mine
    .filter((visit) => onTeam.has(visit.clientId) || (visit.change?.kind === CareVisitChangeKind.MOVED && visit.baseWorkerMembershipId !== membershipId))
    .map((visit) => {
      const row = serializeVisit(visit, clients.get(visit.clientId), names);
      return {
        slotId: row.slotId,
        startMinute: row.startMinute,
        startTime: row.startTime,
        plannedMinutes: row.plannedMinutes,
        note: row.note,
        client: { id: row.client.id, displayName: row.client.displayName, address: row.client.address },
        state: row.state,
        done: row.state === CarePlannedState.DONE,
        change: row.change,
        /* Asendus: käik ei ole mustri järgi tema oma ja ta ei pruugi olla kliendi meeskonnas. */
        covering: !onTeam.has(visit.clientId)
      };
    });
  return { today: day, weekday: weekdayOf(day), absent, visits };
}

async function requireSlotOnDay(tx, clientId, slotId, day) {
  const slot = await tx.careVisitSlot.findFirst({
    where: { id: slotId, clientId },
    select: { id: true, weekday: true, validFrom: true, validUntil: true, startMinute: true, workerMembershipId: true }
  });
  if (!slot) throw notFound("home_care.errors.slot_not_found");
  if (!slotActiveOn(slot, day)) throw badRequest("home_care.errors.visit_not_on_day");
  return slot;
}

async function writeChangeAudit(tx, context, clientId, slotId, change) {
  await writeOrgAudit(tx, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_VISIT_CHANGED,
    resourceType: OrgAuditResource.CARE_VISIT_SLOT,
    resourceId: slotId,
    meta: { organizationId: context.organization.id, clientId, slotId, change }
  });
}

function changeDay(input, today, { back }) {
  const parts = normalizeIsoDay(input.day);
  if (!parts) throw badRequest("home_care.errors.visit_day_required");
  const day = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  if (day < shiftDay(today, -back)) throw badRequest("home_care.errors.visit_day_past");
  if (day > shiftDay(today, HOME_CARE_LIMITS.VISIT_CHANGE_AHEAD_DAYS)) throw badRequest("home_care.errors.visit_day_far");
  return day;
}

/**
 * Tõstab ühe päeva käigu ümber: teine töötaja (või määramata) ja/või teine kellaaeg.
 * Kui tulemus on sama mis mustris, kustub erand. Ainult täna ja edasi.
 */
export async function moveVisit(context, clientId, slotId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const targetId = normalizeId(slotId, "home_care.errors.slot_not_found");
  const body = asObject(input);
  const today = todayText(now, organizationTimeZone(context));
  const day = changeDay(body, today, { back: 0 });
  const workerMembershipId = normalizeOptionalId(body.workerMembershipId, "home_care.errors.visit_worker_invalid");
  let startMinute = null;
  if (body.startTime !== undefined && body.startTime !== null && body.startTime !== "") {
    const match = TIME_PATTERN.exec(typeof body.startTime === "string" ? body.startTime.trim() : "");
    if (!match) throw badRequest("home_care.errors.slot_time_invalid");
    startMinute = Number(match[1]) * 60 + Number(match[2]);
  }
  const note = normalizeLine(body.note, HOME_CARE_LIMITS.VISIT_CHANGE_NOTE_MAX);

  await db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const slot = await requireSlotOnDay(tx, id, targetId, day);
    if (workerMembershipId) {
      /* Asutuse hooldaja: kehtiv liikmesus ja vähemalt ühe kliendi meeskonnas. */
      const worker = await tx.careClientTeamMember.findFirst({
        where: {
          membershipId: workerMembershipId,
          endedAt: null,
          client: { organizationId: context.organization.id },
          membership: { status: OrganizationMembershipStatus.ACTIVE }
        },
        select: { id: true }
      });
      if (!worker) throw badRequest("home_care.errors.visit_worker_invalid");
      const absentThatDay = (await loadAbsentByDay(tx, context.organization.id, day, day)).get(day);
      if (absentThatDay.has(workerMembershipId)) throw badRequest("home_care.errors.visit_worker_absent");
    }
    const sameTime = startMinute === null || startMinute === slot.startMinute;
    const sameWorker = (workerMembershipId || null) === (slot.workerMembershipId || null);
    if (sameTime && sameWorker) {
      const removed = await tx.careVisitChange.deleteMany({ where: { slotId: targetId, day } });
      if (removed.count) await writeChangeAudit(tx, context, id, targetId, "restored");
      return;
    }
    const data = {
      kind: CareVisitChangeKind.MOVED,
      workerMembershipId: workerMembershipId || null,
      startMinute: sameTime ? null : startMinute,
      reason: null,
      note,
      createdByMembershipId: context.membership?.id || null,
      createdByName: await membershipDisplayName(tx, context)
    };
    await tx.careVisitChange.upsert({
      where: { slotId_day: { slotId: targetId, day } },
      create: { ...data, organizationId: context.organization.id, clientId: id, slotId: targetId, day },
      update: data
    });
    await writeChangeAudit(tx, context, id, targetId, "moved");
  });
  return getDayPlan(context, { day }, { db, now, env });
}

/** Jätab ühe päeva käigu ära, põhjusega. Ka kuni nädal tagasi, et tegemata käigule saaks põhjuse panna. */
export async function cancelVisit(context, clientId, slotId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const targetId = normalizeId(slotId, "home_care.errors.slot_not_found");
  const body = asObject(input);
  const today = todayText(now, organizationTimeZone(context));
  const day = changeDay(body, today, { back: HOME_CARE_LIMITS.VISIT_CHANGE_BACK_DAYS });
  const reason = normalizeEnum(body.reason, CARE_VISIT_CANCEL_REASONS, "home_care.errors.visit_cancel_reason_required");
  const note = normalizeLine(body.note, HOME_CARE_LIMITS.VISIT_CHANGE_NOTE_MAX);

  await db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    await requireSlotOnDay(tx, id, targetId, day);
    const data = {
      kind: CareVisitChangeKind.CANCELLED,
      workerMembershipId: null,
      startMinute: null,
      reason,
      note,
      createdByMembershipId: context.membership?.id || null,
      createdByName: await membershipDisplayName(tx, context)
    };
    await tx.careVisitChange.upsert({
      where: { slotId_day: { slotId: targetId, day } },
      create: { ...data, organizationId: context.organization.id, clientId: id, slotId: targetId, day },
      update: data
    });
    await writeChangeAudit(tx, context, id, targetId, "cancelled");
  });
  return getDayPlan(context, { day }, { db, now, env });
}

/** Võtab ühe päeva erandi tagasi: käik on jälle nii, nagu mustris. */
export async function restoreVisit(context, clientId, slotId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const targetId = normalizeId(slotId, "home_care.errors.slot_not_found");
  const today = todayText(now, organizationTimeZone(context));
  const day = changeDay(asObject(input), today, { back: HOME_CARE_LIMITS.VISIT_CHANGE_BACK_DAYS });

  await db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const removed = await tx.careVisitChange.deleteMany({ where: { slotId: targetId, clientId: id, day } });
    if (!removed.count) throw notFound("home_care.errors.visit_change_not_found");
    await writeChangeAudit(tx, context, id, targetId, "restored");
  });
  return getDayPlan(context, { day }, { db, now, env });
}
