/**
 * KODUTEENUS K6-a — sõidupäevik (kava II.6.15, ehituse esimene samm).
 *
 * Hooldaja sõidab kliendi juurde oma või asutuse autoga. Isikliku auto hüvitise aluseks on
 * sõidupäevik, kus on iga sõidu kohta kuupäev, läbisõidumõõdiku alg- ja lõppnäit ning sõidu
 * eesmärk. Seni tegi seda sõidukite jälgimise tarkvara; kui see asendatakse, peab päevik
 * tulema siit. Siin paneb töötaja iga töösõidu kirja kahe näiduga; kilomeetrid arvutatakse
 * näitude vahest, mitte kaardilt. Kogu asutuse hooldusjuht näeb kuu kokkuvõtet töötaja kaupa
 * ja saab selle tabelifailina raamatupidamisele.
 *
 * EESMÄRGI REAL EI OLE KLIENDI NIME: päevik läheb raamatupidamisse. Vorm ütleb seda;
 * sisu ei kontrollita.
 *
 * Hüvitist siin ei arvutata: määra otsustab tööandja. Ridu ei muudeta ega kustutata: ekslik
 * rida tühistatakse põhjusega ja jääb alles.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, conflict, forbidden, notFound } from "../org/errors.js";

import { assertHomeCareContext, coordinatorScope, isCareWorker, membershipDisplayName, organizationTimeZone } from "./access.js";
import { monthText, resolveCallMonth, shiftMonth } from "./calls.js";
import { CARE_TRIP_VEHICLES, HOME_CARE_COORDINATOR, HOME_CARE_LIMITS } from "./constants.js";
import { daysBetween, todayText } from "./decisions.js";
import { asObject, normalizeEnum, normalizeId, normalizeIsoDay, normalizeLine } from "./validation.js";

const TRIP_SELECT = {
  id: true,
  membershipId: true,
  workerName: true,
  day: true,
  vehicle: true,
  plate: true,
  startOdometer: true,
  endOdometer: true,
  purpose: true,
  createdAt: true
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function odometer(value) {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim().replace(/\s+/g, "") : "";
  if (!/^\d{1,7}$/.test(text)) throw badRequest("home_care.errors.trip_odometer", { limit: HOME_CARE_LIMITS.TRIP_KM_MAX });
  return Number(text);
}

/**
 * Sõidu sisend: päev (täna või kuni kaks kuud tagasi), sõiduk, kaks näitu ja eesmärk.
 * Lõppnäit ei saa olla algnäidust väiksem ja üks sõit ei saa olla pikem kui piir (trükiviga
 * näidus annaks muidu tuhandeid kilomeetreid). Puhas funktsioon.
 */
export function normalizeTrip(rawInput, today) {
  const input = asObject(rawInput);
  const parts = normalizeIsoDay(input.day);
  const day = parts ? `${parts.year}-${pad(parts.month)}-${pad(parts.day)}` : today;
  const back = daysBetween(day, today);
  if (back < 0 || back > HOME_CARE_LIMITS.TRIP_BACK_DAYS) throw badRequest("home_care.errors.trip_day");
  const vehicle = normalizeEnum(input.vehicle, CARE_TRIP_VEHICLES, "home_care.errors.trip_vehicle");
  const startOdometer = odometer(input.startOdometer);
  const endOdometer = odometer(input.endOdometer);
  if (endOdometer < startOdometer || endOdometer - startOdometer > HOME_CARE_LIMITS.TRIP_KM_MAX) throw badRequest("home_care.errors.trip_odometer", { limit: HOME_CARE_LIMITS.TRIP_KM_MAX });
  return {
    day,
    vehicle,
    plate: (normalizeLine(input.plate, HOME_CARE_LIMITS.TRIP_PLATE_MAX) || "").toUpperCase() || null,
    startOdometer,
    endOdometer,
    purpose: normalizeLine(input.purpose, HOME_CARE_LIMITS.TRIP_PURPOSE_MAX, { required: true, errorKey: "home_care.errors.trip_purpose" })
  };
}

/** Sõidu pikkus kilomeetrites: näitude vahe. */
export function tripKm(row) {
  return Math.max(0, (Number(row.endOdometer) || 0) - (Number(row.startOdometer) || 0));
}

/** Kuu kokkuvõte töötaja kaupa: sõitude arv, kilomeetrid kokku ja neist isikliku autoga. Puhas funktsioon. */
export function summarizeTrips(rows) {
  const workers = new Map();
  for (const row of rows || []) {
    if (!workers.has(row.membershipId)) workers.set(row.membershipId, { membershipId: row.membershipId, name: row.workerName || "", trips: 0, km: 0, ownKm: 0 });
    const item = workers.get(row.membershipId);
    if (row.workerName) item.name = row.workerName;
    item.trips += 1;
    item.km += tripKm(row);
    if (row.vehicle === "OWN") item.ownKm += tripKm(row);
  }
  return [...workers.values()].sort((a, b) => a.name.localeCompare(b.name, "et"));
}

function serialize(row, viewerMembershipId) {
  return {
    id: row.id,
    membershipId: row.membershipId,
    workerName: row.workerName || "",
    day: row.day,
    vehicle: row.vehicle,
    plate: row.plate || null,
    startOdometer: row.startOdometer,
    endOdometer: row.endOdometer,
    km: tripKm(row),
    purpose: row.purpose,
    isMine: Boolean(viewerMembershipId && row.membershipId === viewerMembershipId)
  };
}

/**
 * Sõidupäeviku leht: töötajale tema selle kuu sõidud ja viimane näit (uue sõidu algnäidu
 * ettepanek); kogu asutuse hooldusjuhile lisaks kõigi töötajate read ja kokkuvõte.
 */
export async function getTripLog(context, rawQuery = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  if (!(await isCareWorker(db, context))) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
  const organizationId = context.organization.id;
  const membershipId = context.membership?.id || null;
  const timeZone = organizationTimeZone(context);
  const today = todayText(now, timeZone);
  const month = resolveCallMonth(asObject(rawQuery).month, now, timeZone);
  const name = monthText(month.year, month.month);
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const wholeOrg = Boolean(coordinatorScope(context)?.wholeOrg);
  const inMonth = { organizationId, retractedAt: null, day: { gte: `${name}-01`, lte: `${name}-31` } };

  const mineRows = membershipId
    ? await db.careTripEntry.findMany({ where: { ...inMonth, membershipId }, select: TRIP_SELECT, orderBy: [{ day: "desc" }, { startOdometer: "desc" }, { id: "desc" }], take: HOME_CARE_LIMITS.TRIPS_SHOWN })
    : [];
  /* Viimane näit sõiduki kaupa ei ole vajalik: ettepanek on töötaja viimase sõidu lõppnäit ja sõiduk. */
  const last = membershipId
    ? await db.careTripEntry.findFirst({
        where: { organizationId, membershipId, retractedAt: null },
        select: { vehicle: true, plate: true, endOdometer: true },
        orderBy: [{ day: "desc" }, { endOdometer: "desc" }, { id: "desc" }]
      })
    : null;
  const allRows = wholeOrg
    ? await db.careTripEntry.findMany({ where: inMonth, select: TRIP_SELECT, orderBy: [{ day: "asc" }, { workerName: "asc" }, { startOdometer: "asc" }, { id: "asc" }], take: HOME_CARE_LIMITS.TRIPS_MONTH_MAX + 1 })
    : [];
  const shown = allRows.slice(0, HOME_CARE_LIMITS.TRIPS_MONTH_MAX);

  return {
    month: name,
    previousMonth: monthText(previous.year, previous.month),
    nextMonth: `${monthText(next.year, next.month)}-01` > today ? null : monthText(next.year, next.month),
    today,
    canAdd: Boolean(context.writable && membershipId),
    isCoordinator: wholeOrg,
    mine: {
      trips: mineRows.map((row) => serialize(row, membershipId)),
      km: mineRows.reduce((sum, row) => sum + tripKm(row), 0),
      last: last ? { vehicle: last.vehicle, plate: last.plate || null, endOdometer: last.endOdometer } : null
    },
    /* Ainult kogu asutuse hooldusjuhile: read raamatupidamise tabeli jaoks ja kokkuvõte töötaja kaupa. */
    all: wholeOrg ? { trips: shown.map((row) => serialize(row, membershipId)), workers: summarizeTrips(shown), truncated: allRows.length > HOME_CARE_LIMITS.TRIPS_MONTH_MAX } : null
  };
}

async function writeTripAudit(tx, context, tripId, membershipId, change) {
  await writeOrgAudit(tx, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_TRIP_CHANGED,
    resourceType: OrgAuditResource.CARE_TRIP_ENTRY,
    resourceId: tripId,
    /* Töötaja liikmesus ja muutuse liik: näidud, sõiduk ja eesmärk auditisse ei lähe. */
    meta: { organizationId: context.organization.id, membershipId, change }
  });
}

/** Lisab töötaja enda sõidu. Sõidu paneb kirja see, kes sõitis: teise töötaja nimel sõitu ei lisata. */
export async function addTrip(context, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const membershipId = context.membership?.id;
  if (!membershipId || !(await isCareWorker(db, context))) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
  const today = todayText(now, organizationTimeZone(context));
  const data = normalizeTrip(input, today);
  const organizationId = context.organization.id;

  await db.$transaction(async (tx) => {
    const row = await tx.careTripEntry.create({
      data: { organizationId, membershipId, workerName: await membershipDisplayName(tx, context), ...data, createdByMembershipId: membershipId, createdAt: now },
      select: { id: true }
    });
    await writeTripAudit(tx, context, row.id, membershipId, "added");
  });
  return getTripLog(context, { month: data.day.slice(0, 7) }, { db, now, env });
}

/** Tühistab eksliku sõidu, põhjusega. Oma sõidu tühistab töötaja ise; teise töötaja sõidu kogu asutuse hooldusjuht. */
export async function retractTrip(context, tripId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(tripId, "home_care.errors.trip_not_found");
  const reason = normalizeLine(asObject(input).reason, HOME_CARE_LIMITS.TRIP_PURPOSE_MAX, { required: true, errorKey: "home_care.errors.trip_retract_reason" });
  const membershipId = context.membership?.id || null;
  const organizationId = context.organization.id;
  const wholeOrg = Boolean(coordinatorScope(context)?.wholeOrg);

  const month = await db.$transaction(async (tx) => {
    const row = await tx.careTripEntry.findFirst({ where: { id, organizationId }, select: { id: true, membershipId: true, day: true, retractedAt: true } });
    /* Võõra töötaja rida ja olematu rida vastavad ühtemoodi: päevik ei ütle, kelle sõite seal on. */
    if (!row || (!wholeOrg && row.membershipId !== membershipId)) throw notFound("home_care.errors.trip_not_found");
    if (row.retractedAt) throw conflict("home_care.errors.trip_retracted");
    const changed = await tx.careTripEntry.updateMany({
      where: { id, retractedAt: null },
      data: { retractedAt: now, retractedByMembershipId: membershipId, retractReason: reason }
    });
    if (changed.count !== 1) throw conflict("home_care.errors.trip_retracted");
    await writeTripAudit(tx, context, id, row.membershipId, "retracted");
    return row.day.slice(0, 7);
  });
  return getTripLog(context, { month }, { db, now, env });
}
