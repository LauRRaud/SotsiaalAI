/**
 * KODUTEENUS K5-b — kriisivalmidus (kava II.6.12).
 *
 * Elektrikatkestuse, tormi või külmalaine ajal peab hooldusjuht teadma, kelle juurde peab
 * jõudma iga päev, kelle juurde kord või kaks nädalas ja kes saab varudega seitse päeva
 * ise hakkama. Jaotus järgib Sotsiaalkindlustusameti juhendi kolme rühma. Kliendi juures
 * on lisaks sõltuvused (elekter, küte, vesi, side, liikumine, ravimid) ja kes lähedastest
 * saab aidata.
 *
 * Hinnangu paneb hooldusjuht; loeb igaüks, kes tohib kliendi lehte avada. Nimekirja näeb
 * hooldusjuht oma skoobis ja saab selle alla laadida: kriisis ei pruugi rakendus, side
 * ega elekter töötada, seepärast peab nimekiri olema ka paberil.
 *
 * Rida ei muudeta ega kustutata: uus hinnang lõpetab eelmise.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, forbidden, notFound } from "../org/errors.js";

import { loadCareWorkerIds } from "./absences.js";
import { assertHomeCareContext, coordinatorScope, membershipDisplayName, organizationTimeZone, requireClientCoordinator } from "./access.js";
import { CARE_CRISIS_DEPENDENCIES, CARE_CRISIS_LEVELS, CareClientStatus, CareVisitPriority, HOME_CARE_COORDINATOR, HOME_CARE_LIMITS } from "./constants.js";
import { todayText } from "./decisions.js";
import { shiftDay } from "./slots.js";
import { asObject, normalizeEnum, normalizeId, normalizeLine } from "./validation.js";

const CRISIS_SELECT = Object.freeze({
  id: true,
  level: true,
  dependencies: true,
  helper: true,
  note: true,
  createdByName: true,
  createdAt: true
});

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    level: row.level,
    /* Alati sõnastiku järjekorras, ükskõik mis järjekorras need salvestati. */
    dependencies: CARE_CRISIS_DEPENDENCIES.filter((item) => (row.dependencies || []).includes(item)),
    helper: row.helper || null,
    note: row.note || null,
    setByName: row.createdByName || null,
    setAt: row.createdAt.toISOString()
  };
}

/** Kliendi kehtiv hinnang kliendi lehele või `null`. */
export async function loadCrisisWithin(tx, clientId) {
  return serialize(await tx.careCrisisProfile.findFirst({ where: { clientId, endedAt: null }, select: CRISIS_SELECT }));
}

/** Sisendi kuju: aste kohustuslik, sõltuvused loendist, kaks vaba rida. Puhas funktsioon. */
export function normalizeCrisisInput(rawInput) {
  const input = asObject(rawInput);
  const level = normalizeEnum(input.level, CARE_CRISIS_LEVELS, "home_care.errors.crisis_level_required");
  const chosen = Array.isArray(input.dependencies) ? input.dependencies : [];
  if (chosen.some((item) => !CARE_CRISIS_DEPENDENCIES.includes(item))) throw badRequest("home_care.errors.crisis_dependency_invalid");
  return {
    level,
    dependencies: CARE_CRISIS_DEPENDENCIES.filter((item) => chosen.includes(item)),
    helper: normalizeLine(input.helper, HOME_CARE_LIMITS.CRISIS_HELPER_MAX) || null,
    note: normalizeLine(input.note, HOME_CARE_LIMITS.CRISIS_NOTE_MAX) || null
  };
}

async function endCurrent(tx, context, clientId, now) {
  const current = await tx.careCrisisProfile.findFirst({ where: { clientId, endedAt: null }, select: { id: true } });
  if (!current) return null;
  await tx.careCrisisProfile.updateMany({
    where: { id: current.id, endedAt: null },
    data: { endedAt: now, endedByMembershipId: context.membership?.id || null, endedByName: await membershipDisplayName(tx, context) }
  });
  return current.id;
}

async function writeCrisisAudit(tx, context, clientId, change) {
  await writeOrgAudit(tx, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_CRISIS_CHANGED,
    resourceType: OrgAuditResource.CARE_CLIENT,
    resourceId: clientId,
    meta: { organizationId: context.organization.id, clientId, change }
  });
}

/** Hooldusjuht paneb või uuendab hinnangu. Eelmine hinnang lõpeb. */
export async function setCrisisProfile(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const data = normalizeCrisisInput(input);

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    await endCurrent(tx, context, id, now);
    const created = await tx.careCrisisProfile.create({
      data: {
        ...data,
        organizationId: context.organization.id,
        clientId: id,
        createdByMembershipId: context.membership?.id || null,
        createdByName: await membershipDisplayName(tx, context),
        createdAt: now
      },
      select: CRISIS_SELECT
    });
    await writeCrisisAudit(tx, context, id, "set");
    return { crisis: serialize(created) };
  });
}

/** Hooldusjuht võtab hinnangu maha. Rida jääb ajalukku. */
export async function clearCrisisProfile(context, clientId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const endedId = await endCurrent(tx, context, id, now);
    if (!endedId) throw notFound("home_care.errors.crisis_not_found");
    await writeCrisisAudit(tx, context, id, "cleared");
    return { crisis: null };
  });
}

/**
 * Nädala plaanitud käiguminutid kliendi kaupa kehtivast käigumustrist. Puhas funktsioon:
 * `slots` on read `{ clientId, plannedMinutes }`, üks rida nädalapäeva kohta.
 */
export function weeklyMinutesByClient(slots) {
  const totals = new Map();
  for (const slot of slots) totals.set(slot.clientId, (totals.get(slot.clientId) || 0) + (slot.plannedMinutes || 0));
  return totals;
}

/**
 * Arvud omavalitsuse riskianalüüsi jaoks (K6-j, kava II.6.12): mitu klienti on igas rühmas,
 * millest nad sõltuvad ja kui palju aega võtavad nädalas kriitilised käigud (tähtsus A: peab
 * toimuma täna). Väikseim koosseis on see aeg jagatud täistööaja nädalaga, ILMA sõiduajata:
 * see on alumine piir, mitte plaan. Puhas funktsioon.
 * `items`: nimekirja read (`{ crisis }`), `slots`: kehtiva käigumustri read (`{ clientId, plannedMinutes, priority }`).
 */
export function crisisFigures(items, slots) {
  const byLevel = Object.fromEntries(CARE_CRISIS_LEVELS.map((level) => [level, 0]));
  const dependencies = Object.fromEntries(CARE_CRISIS_DEPENDENCIES.map((code) => [code, 0]));
  let unset = 0;
  for (const item of items) {
    if (!item.crisis) {
      unset += 1;
      continue;
    }
    if (item.crisis.level in byLevel) byLevel[item.crisis.level] += 1;
    for (const code of item.crisis.dependencies || []) {
      if (code in dependencies) dependencies[code] += 1;
    }
  }
  const critical = (slots || []).filter((slot) => slot.priority === CareVisitPriority.A);
  const criticalWeeklyMinutes = critical.reduce((sum, slot) => sum + (slot.plannedMinutes || 0), 0);
  return {
    clients: items.length,
    byLevel,
    unset,
    dependencies,
    criticalClients: new Set(critical.map((slot) => slot.clientId)).size,
    criticalWeeklyMinutes,
    minStaff: Math.ceil(criticalWeeklyMinutes / HOME_CARE_LIMITS.CRISIS_FULL_TIME_WEEK_MINUTES)
  };
}

/**
 * Kriisinimekiri hooldusjuhile: teenusel ja ajutiselt ära olevad kliendid kolmes rühmas
 * (iga päev, kord või kaks nädalas, saab ise hakkama) ja eraldi need, kellel hinnangut
 * veel ei ole. Iga rühma juures on klientide arv ja nädala plaanitud käiguaeg.
 */
export async function getCrisisList(context, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const scope = coordinatorScope(context);
  if (!scope) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });

  const today = todayText(now, organizationTimeZone(context));
  const limit = HOME_CARE_LIMITS.DEADLINE_CLIENTS_MAX;
  const rows = await db.careClient.findMany({
    where: {
      organizationId: context.organization.id,
      status: { in: [CareClientStatus.ACTIVE, CareClientStatus.AWAY] },
      ...(scope.wholeOrg ? {} : { unitId: { in: scope.unitIds } })
    },
    select: {
      id: true,
      displayName: true,
      status: true,
      address: true,
      contactPhone: true,
      crisisProfiles: { where: { endedAt: null }, select: CRISIS_SELECT, take: 1 },
      visitSlots: {
        where: { validFrom: { lte: today }, OR: [{ validUntil: null }, { validUntil: { gte: today } }] },
        select: { clientId: true, plannedMinutes: true, priority: true }
      }
    },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    take: limit + 1
  });

  const shown = rows.slice(0, limit);
  const minutes = weeklyMinutesByClient(shown.flatMap((row) => row.visitSlots));
  const groups = Object.fromEntries(CARE_CRISIS_LEVELS.map((level) => [level, { level, clients: [], weeklyMinutes: 0 }]));
  const unset = [];
  const items = [];
  for (const row of shown) {
    const item = {
      client: { id: row.id, displayName: row.displayName, status: row.status },
      address: row.address || null,
      phone: row.contactPhone || null,
      weeklyMinutes: minutes.get(row.id) || 0,
      crisis: serialize(row.crisisProfiles[0] || null)
    };
    items.push(item);
    if (!item.crisis) {
      unset.push(item);
      continue;
    }
    groups[item.crisis.level].clients.push(item);
    groups[item.crisis.level].weeklyMinutes += item.weeklyMinutes;
  }
  /* Töötajad ja sõidukid on kogu asutuse omad (üksust neil ei ole): ainult kogu asutuse hooldusjuhile.
     Sõidukite register puudub; arv tuleb sõidupäevikust ja ütleb, mida seal viimasel ajal kasutati. */
  let workers = null;
  let vehicles = null;
  if (scope.wholeOrg) {
    workers = (await loadCareWorkerIds(db, context.organization.id)).length;
    const trips = await db.careTripEntry.findMany({
      where: { organizationId: context.organization.id, retractedAt: null, day: { gte: shiftDay(today, -HOME_CARE_LIMITS.CRISIS_VEHICLE_DAYS) } },
      select: { membershipId: true, vehicle: true, plate: true },
      take: HOME_CARE_LIMITS.TRIPS_MONTH_MAX
    });
    if (trips.length) {
      vehicles = {
        ownDrivers: new Set(trips.filter((trip) => trip.vehicle === "OWN").map((trip) => trip.membershipId)).size,
        orgPlates: new Set(trips.filter((trip) => trip.vehicle === "ORG" && trip.plate).map((trip) => trip.plate)).size
      };
    }
  }
  return {
    today,
    clientCount: shown.length,
    truncated: rows.length > limit,
    groups: CARE_CRISIS_LEVELS.map((level) => groups[level]),
    unset,
    figures: { ...crisisFigures(items, shown.flatMap((row) => row.visitSlots)), workers, vehicles }
  };
}
