/**
 * KODUTEENUS kiht 2, K2-e — osutatud aeg otsustatud mahu kõrval.
 *
 * KÄIGU KIRJE on tühistamata päeviku kirje, millel on kestus või vähemalt üks
 * tehtud toiming (K2-d). Siin loetakse neid kokku:
 *   - kliendi lehel: selle nädala ja selle kuu käigud ja aeg (kogu meeskonnale);
 *   - hooldusjuhi kuu kokkuvõttes: kliendi kaupa osutatud aeg otsustatud mahu
 *     kõrval, töötaja kaupa aeg ja ära jäänud käigud (kava II.6.10 „ehituse esimene
 *     samm": üks tabel kolme lehega).
 *
 * OTSUSTATUD AEG ajavahemiku kohta arvutatakse päeva kaupa: iga päev võtab sellel
 * päeval kehtiva otsuse mahust oma osa (nädalamahust seitsmendiku, kuumahust kuu
 * päevade arvu jagu). Nii on poole kuu pealt alanud või lõppenud otsus ja jooksev
 * kuu arvestatud ausalt: võrreldakse seda, mis selleks päevaks pidi tehtud olema.
 *
 * KAKS TÖÖTAJAT SAMAL KÄIGUL: kliendi aeg loetakse üks kord (käik kestis 30 minutit),
 * töötajate tabelis saab aja nii kirje autor kui ka „kaasas" olnud töötaja.
 *
 * ÄRA JÄÄNUD KÄIK on erijuhtum „ei avanud ust" või „keeldus abist". Ette ära
 * öeldud käiku päevik ei tunne; kilomeetreid koduteenuse päevik ei mõõda.
 *
 * Vastustes on arvud ja nimed; kirjete teksti siin ei ole.
 */

import prisma from "@/lib/prisma";

import { forbidden } from "../org/errors.js";
import { localDateTimeToUtc, shiftLocalDate, zonedParts } from "../time/estonianDay.js";

import { assertHomeCareContext, coordinatorScope, organizationTimeZone } from "./access.js";
import { monthRange, monthText, resolveCallMonth, shiftMonth } from "./calls.js";
import {
  CARE_ACTIVITY_SKIP_REASONS,
  CareActivityOutcome,
  CareClientStatus,
  CareEntryKind,
  CareVisitChangeKind,
  CareIncidentType,
  CareVolumePeriod,
  HOME_CARE_COORDINATOR,
  HOME_CARE_LIMITS
} from "./constants.js";
import { todayText } from "./decisions.js";
import { loadMarkedClientIds } from "./workNature.js";
import { asObject } from "./validation.js";

/** Käigu kirje tingimus päringus: tühistamata ja kas kestuse või tehtud toiminguga. */
export const VISIT_RECORD = Object.freeze({
  retractedAt: null,
  OR: [{ visitMinutes: { not: null } }, { activities: { some: {} } }]
});

/** Erijuhtumi liigid, mis loetakse ära jäänud käiguks. */
export const MISSED_VISIT_TYPES = Object.freeze([CareIncidentType.DOOR_NOT_OPENED, CareIncidentType.REFUSED_HELP]);

function pad(value) {
  return String(value).padStart(2, "0");
}

function dayOf(parts) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function partsOf(day) {
  const [year, month, date] = day.split("-").map(Number);
  return { year, month, day: date };
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Asutuse kalendrinädal (esmaspäevast pühapäevani), millesse `now` kuulub. */
export function weekBounds(now, timeZone) {
  const today = zonedParts(now, timeZone);
  const sinceMonday = (new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay() + 6) % 7;
  const monday = shiftLocalDate({ year: today.year, month: today.month, day: today.day }, -sinceMonday);
  return {
    fromDay: dayOf(monday),
    toDay: dayOf(shiftLocalDate(monday, 6)),
    range: { gte: localDateTimeToUtc(monday, timeZone), lt: localDateTimeToUtc(shiftLocalDate(monday, 7), timeZone) }
  };
}

/** Sellel päeval kehtiv otsus: tühistamata, alanud ja lõppemata; mitme puhul hiliseima algusega. */
function decisionOn(decisions, day) {
  let best = null;
  for (const decision of decisions) {
    if (decision.retractedAt || decision.validFrom > day || (decision.validUntil && decision.validUntil < day)) continue;
    if (
      !best ||
      decision.validFrom > best.validFrom ||
      (decision.validFrom === best.validFrom && new Date(decision.createdAt || 0) > new Date(best.createdAt || 0))
    ) {
      best = decision;
    }
  }
  return best;
}

/**
 * Otsustatud aeg minutites päevast `fromDay` päevani `toDay` (mõlemad kaasa arvatud).
 * `null`, kui selles vahemikus ei kehtinud ühelgi päeval mahuga otsust: siis ei ole
 * millegagi võrrelda, ja null ei ole sama mis „otsustatud 0 minutit".
 */
export function expectedMinutes(decisions, fromDay, toDay) {
  let total = 0;
  let coveredDays = 0;
  let days = 0;
  for (let parts = partsOf(fromDay); dayOf(parts) <= toDay; parts = shiftLocalDate(parts, 1)) {
    days += 1;
    const decision = decisionOn(decisions, dayOf(parts));
    if (!decision?.volumeMinutes) continue;
    coveredDays += 1;
    total +=
      decision.volumePeriod === CareVolumePeriod.WEEK
        ? decision.volumeMinutes / 7
        : decision.volumeMinutes / daysInMonth(parts.year, parts.month);
  }
  return coveredDays ? { minutes: Math.round(total), coveredDays, days } : null;
}

async function sumVisits(db, where) {
  const sum = await db.careClientEntry.aggregate({ where, _count: { _all: true }, _sum: { visitMinutes: true } });
  const withoutLength = await db.careClientEntry.count({ where: { ...where, visitMinutes: null } });
  return { visits: sum._count._all, minutes: sum._sum.visitMinutes || 0, withoutLength };
}

/** Kliendi selle nädala ja selle kuu käigud ja aeg. Kutsuja on juba kontrollinud ligipääsu kliendile. */
export async function loadProvidedWithin(tx, clientId, now, timeZone) {
  const week = weekBounds(now, timeZone);
  const today = zonedParts(now, timeZone);
  const month = { year: today.year, month: today.month };
  const base = { clientId, ...VISIT_RECORD };
  return {
    week: { fromDay: week.fromDay, toDay: week.toDay, ...(await sumVisits(tx, { ...base, occurredAt: week.range })) },
    month: { month: monthText(month.year, month.month), ...(await sumVisits(tx, { ...base, occurredAt: monthRange(month, timeZone) })) }
  };
}

/** Sama inimese read (nimi võis vahepeal muutuda) üheks reaks; liikmesuseta rida jääb nime järgi. */
function mergeWorkers(authorRows, companionRows, heavyRows = []) {
  const workers = new Map();
  const rowFor = (membershipId, name) => {
    const key = membershipId || `nimi:${name || ""}`;
    if (!workers.has(key)) {
      workers.set(key, { membershipId: membershipId || null, name: name || "", visits: 0, minutes: 0, heavy: 0, companionVisits: 0, companionMinutes: 0 });
    }
    const row = workers.get(key);
    if (name) row.name = name;
    return row;
  };
  for (const item of authorRows) {
    const row = rowFor(item.authorMembershipId, item.authorName);
    row.visits += item._count._all;
    row.minutes += item._sum.visitMinutes || 0;
  }
  /* Raske töö märgiga kliendi käigud: osa samadest käikudest, mitte lisaks. */
  for (const item of heavyRows) rowFor(item.authorMembershipId, item.authorName).heavy += item._count._all;
  for (const item of companionRows) {
    const row = rowFor(item.companionMembershipId, item.companionName);
    row.companionVisits += item._count._all;
    row.companionMinutes += item._sum.visitMinutes || 0;
  }
  return [...workers.values()].sort((a, b) => a.name.localeCompare(b.name, "et"));
}

/**
 * Kuu kokkuvõte hooldusjuhile tema skoobis: kliendi kaupa, töötaja kaupa ja ära
 * jäänud käigud. Jooksva kuu puhul arvestatakse otsustatud aega tänase päevani.
 */
export async function getMonthSummary(context, rawQuery = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const scope = coordinatorScope(context);
  if (!scope) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });

  const organizationId = context.organization.id;
  const timeZone = organizationTimeZone(context);
  const month = resolveCallMonth(asObject(rawQuery).month, now, timeZone);
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const today = todayText(now, timeZone);
  const name = monthText(month.year, month.month);
  const fromDay = `${name}-01`;
  const lastDay = `${name}-${pad(daysInMonth(month.year, month.month))}`;
  const isFuture = fromDay > today;
  /* Jooksev kuu: otsustatud aeg arvestatakse tänaseni, mitte kuu lõpuni. */
  const untilDay = lastDay < today ? lastDay : today;

  const unitScope = scope.wholeOrg ? {} : { unitId: { in: scope.unitIds } };
  const entryScope = { organizationId, ...(scope.wholeOrg ? {} : { client: unitScope }), occurredAt: monthRange(month, timeZone) };
  const visits = { ...entryScope, ...VISIT_RECORD };

  const byClient = await db.careClientEntry.groupBy({ by: ["clientId"], where: visits, _count: { _all: true }, _sum: { visitMinutes: true } });
  const withoutLength = await db.careClientEntry.groupBy({ by: ["clientId"], where: { ...visits, visitMinutes: null }, _count: { _all: true } });
  const byAuthor = await db.careClientEntry.groupBy({
    by: ["authorMembershipId", "authorName"],
    where: visits,
    _count: { _all: true },
    _sum: { visitMinutes: true }
  });
  const byCompanion = await db.careClientEntry.groupBy({
    by: ["companionMembershipId", "companionName"],
    where: { ...visits, companionMembershipId: { not: null } },
    _count: { _all: true },
    _sum: { visitMinutes: true }
  });
  const missedRows = await db.careClientEntry.findMany({
    where: { ...entryScope, retractedAt: null, kind: CareEntryKind.INCIDENT, incidentType: { in: [...MISSED_VISIT_TYPES] } },
    select: { id: true, clientId: true, occurredAt: true, incidentType: true, client: { select: { displayName: true } } },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    take: HOME_CARE_LIMITS.MONTH_MISSED_MAX
  });

  /* Raske töö märgiga klientide käigud töötaja kaupa (K3-g): klient, kellel oli sel kuul märge. */
  const range = monthRange(month, timeZone);
  const marked = [...(await loadMarkedClientIds(db, organizationId, { from: range.gte, until: range.lt }))];
  const heavyRows = marked.length
    ? await db.careClientEntry.groupBy({
        by: ["authorMembershipId", "authorName"],
        where: { ...visits, clientId: { in: marked } },
        _count: { _all: true }
      })
    : [];

  /* Tegemata jäänud kava toimingud põhjuse kaupa (K2-f), samade käigu kirjete pealt. */
  const notDoneRows = await db.careEntryActivity.groupBy({
    by: ["clientId", "outcome"],
    where: { organizationId, outcome: { not: CareActivityOutcome.DONE }, entry: { ...entryScope, retractedAt: null } },
    _count: { _all: true }
  });
  const emptyNotDone = () => Object.fromEntries(CARE_ACTIVITY_SKIP_REASONS.map((reason) => [reason, 0]));
  const notDoneOf = new Map();
  for (const row of notDoneRows) {
    /* Tundmatu väärtus andmebaasis (uuem koodiversioon) kokkuvõtet katki ei tee. */
    if (!CARE_ACTIVITY_SKIP_REASONS.includes(row.outcome)) continue;
    if (!notDoneOf.has(row.clientId)) notDoneOf.set(row.clientId, emptyNotDone());
    notDoneOf.get(row.clientId)[row.outcome] += row._count._all;
  }

  /* Ära jäetud plaanitud käigud (K3-b): päevaplaani erandid selles kuus. */
  const cancelledRows = await db.careVisitChange.groupBy({
    by: ["clientId"],
    where: {
      organizationId,
      kind: CareVisitChangeKind.CANCELLED,
      day: { gte: fromDay, lte: lastDay },
      ...(scope.wholeOrg ? {} : { client: unitScope })
    },
    _count: { _all: true }
  });
  const cancelledOf = new Map(cancelledRows.map((row) => [row.clientId, row._count._all]));

  const visitsOf = new Map(byClient.map((row) => [row.clientId, row]));
  const withoutOf = new Map(withoutLength.map((row) => [row.clientId, row._count._all]));
  const missedOf = new Map();
  for (const row of missedRows) missedOf.set(row.clientId, (missedOf.get(row.clientId) || 0) + 1);

  /* Teenusel ja ajutiselt ära olevad kliendid ning lisaks need, kellel selles kuus oli käik või
     ära jäänud käik (ka siis, kui teenus on vahepeal lõppenud). */
  const active = [...new Set([...visitsOf.keys(), ...missedOf.keys(), ...cancelledOf.keys()])];
  const limit = HOME_CARE_LIMITS.DEADLINE_CLIENTS_MAX;
  const clientRows = await db.careClient.findMany({
    where: {
      organizationId,
      ...unitScope,
      OR: [{ status: { in: [CareClientStatus.ACTIVE, CareClientStatus.AWAY] } }, { id: { in: active } }]
    },
    select: {
      id: true,
      displayName: true,
      status: true,
      decisions: {
        where: { retractedAt: null },
        select: { validFrom: true, validUntil: true, volumeMinutes: true, volumePeriod: true, createdAt: true, retractedAt: true }
      }
    },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    take: limit + 1
  });

  const clients = clientRows.slice(0, limit).map((row) => {
    const sums = visitsOf.get(row.id);
    const decision = isFuture ? null : decisionOn(row.decisions, untilDay);
    return {
      client: { id: row.id, displayName: row.displayName, status: row.status },
      /* Otsus, mis kehtis vahemiku viimasel päeval: näitab, mille järgi maht käib. */
      volumeMinutes: decision?.volumeMinutes ?? null,
      volumePeriod: decision?.volumePeriod || null,
      expectedMinutes: isFuture ? null : (expectedMinutes(row.decisions, fromDay, untilDay)?.minutes ?? null),
      visits: sums?._count._all || 0,
      minutes: sums?._sum.visitMinutes || 0,
      withoutLength: withoutOf.get(row.id) || 0,
      missed: missedOf.get(row.id) || 0,
      cancelled: cancelledOf.get(row.id) || 0,
      notDone: notDoneOf.get(row.id) || emptyNotDone()
    };
  });

  return {
    month: name,
    previousMonth: monthText(previous.year, previous.month),
    /* Tulevikku ei sirvita: seal ei ole midagi lugeda. */
    nextMonth: `${monthText(next.year, next.month)}-01` > today ? null : monthText(next.year, next.month),
    today,
    fromDay,
    untilDay: isFuture ? null : untilDay,
    /* Kuu on läbi: alles siis on aus öelda, et osutatud aeg ületas otsustatu. Jooksvas kuus
       koonduvad käigud sageli nädala algusesse ja päeva kaupa võrdlus annaks valehäire. */
    complete: lastDay < today,
    truncated: clientRows.length > limit,
    totals: {
      visits: byClient.reduce((sum, row) => sum + row._count._all, 0),
      minutes: byClient.reduce((sum, row) => sum + (row._sum.visitMinutes || 0), 0),
      withoutLength: withoutLength.reduce((sum, row) => sum + row._count._all, 0),
      missed: missedRows.length,
      cancelled: cancelledRows.reduce((sum, row) => sum + row._count._all, 0),
      notDone: [...notDoneOf.values()].reduce((sum, counts) => sum + Object.values(counts).reduce((a, b) => a + b, 0), 0)
    },
    clients,
    workers: mergeWorkers(byAuthor, byCompanion, heavyRows),
    missed: missedRows.map((row) => ({
      entryId: row.id,
      client: { id: row.clientId, displayName: row.client.displayName },
      occurredAt: new Date(row.occurredAt).toISOString(),
      type: row.incidentType
    }))
  };
}
