/**
 * KODUTEENUS K5-j — kuu lahtised asjad (kava II.6.10, kuu sulgemise esimene samm).
 *
 * Enne kui hooldusjuht kuu numbrid linnale saadab, peab ta teadma, mis on selle kuu kohta
 * veel lahti: plaanitud käigud, mille kohta ei ole kirjet ega ära jätmise märget; lahtised
 * erijuhtumid; märkamised, millele ei ole vastatud; ravimitoimingud, mille juures ei ole
 * öeldud, mida tehti. Siin on see nimekiri. Kuud ei lukustata: see on kontroll, mitte
 * sulgemine.
 *
 * TEGEMATA KÄIK loetakse ainult päeval, mil klient oli teenusel. Päevaplaan vaatab kliendi
 * tänast seisu; kuu kohta oleks see vale (klient, kes oli kaks nädalat haiglas, ei jätnud
 * käike tegemata). Seepärast loetakse seis päeva kaupa seisu ajaloost.
 */

import prisma from "@/lib/prisma";

import { forbidden } from "../org/errors.js";

import { assertHomeCareContext, coordinatorScope, organizationTimeZone } from "./access.js";
import { monthRange, monthText, resolveCallMonth } from "./calls.js";
import {
  CareActivityGroup,
  CareActivityOutcome,
  CareClientStatus,
  CareEntryKind,
  CareIncidentStatus,
  CarePlannedState,
  HOME_CARE_COORDINATOR,
  HOME_CARE_LIMITS
} from "./constants.js";
import { loadRange } from "./dayPlan.js";
import { todayText } from "./decisions.js";
import { timeText } from "./slots.js";
import { asObject } from "./validation.js";

function pad(value) {
  return String(value).padStart(2, "0");
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Puhas: kliendi seis päeva LÕPUS. `changes` on selle kliendi seisumuutused ajajärjestuses
 * (`{ day, fromStatus, toStatus }`, päev asutuse ajavööndis); `current` on tänane seis.
 * Enne esimest muutust kehtis selle muutuse lähteseis; muutusteta kliendil tänane seis.
 */
export function statusOnDay(changes, current, day) {
  let status = changes.length ? changes[0].fromStatus : current;
  for (const change of changes) {
    if (change.day > day) break;
    status = change.toStatus;
  }
  return status;
}

export async function getMonthOpenItems(context, rawQuery = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const scope = coordinatorScope(context);
  if (!scope) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });

  const organizationId = context.organization.id;
  const timeZone = organizationTimeZone(context);
  const month = resolveCallMonth(asObject(rawQuery).month, now, timeZone);
  const name = monthText(month.year, month.month);
  const today = todayText(now, timeZone);
  const fromDay = `${name}-01`;
  const lastDay = `${name}-${pad(daysInMonth(month.year, month.month))}`;
  const empty = { month: name, missing: [], missingCount: 0, openIncidents: 0, openSignals: 0, medicationUnmarked: 0, clear: true };
  if (fromDay > today) return empty;
  const untilDay = lastDay < today ? lastDay : today;

  const unitScope = scope.wholeOrg ? {} : { unitId: { in: scope.unitIds } };
  const range = monthRange(month, timeZone);

  /* Plaanitud käigud päeva kaupa; kliendid, kelle teenus on vahepeal lõppenud, on samuti sees. */
  const { days, clients } = await loadRange(db, { organizationId, fromDay, toDay: untilDay, timeZone, now, clientWhere: unitScope });
  const clientIds = [...clients.keys()];
  const changeRows = clientIds.length
    ? await db.careClientStatusChange.findMany({
        where: { organizationId, clientId: { in: clientIds } },
        select: { clientId: true, fromStatus: true, toStatus: true, changedAt: true },
        orderBy: [{ changedAt: "asc" }, { id: "asc" }]
      })
    : [];
  const changesOf = new Map();
  for (const row of changeRows) {
    if (!changesOf.has(row.clientId)) changesOf.set(row.clientId, []);
    changesOf.get(row.clientId).push({ day: todayText(row.changedAt, timeZone), fromStatus: row.fromStatus, toStatus: row.toStatus });
  }

  const missing = [];
  for (const [day, visits] of days) {
    for (const visit of visits) {
      if (visit.state !== CarePlannedState.MISSING) continue;
      const client = clients.get(visit.clientId);
      if (statusOnDay(changesOf.get(visit.clientId) || [], client.status, day) !== CareClientStatus.ACTIVE) continue;
      missing.push({ day, startTime: timeText(visit.startMinute), client: { id: client.id, displayName: client.displayName } });
    }
  }
  missing.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.startTime.localeCompare(b.startTime) || a.client.displayName.localeCompare(b.client.displayName, "et")));

  const entryScope = { organizationId, retractedAt: null, occurredAt: range, ...(scope.wholeOrg ? {} : { client: unitScope }) };
  const openIncidents = await db.careClientEntry.count({
    where: { ...entryScope, kind: CareEntryKind.INCIDENT, incidentStatus: { in: [CareIncidentStatus.OPEN, CareIncidentStatus.IN_REVIEW] } }
  });
  const openSignals = await db.careChangeSignal.count({ where: { organizationId, handledAt: null, openedAt: range, client: unitScope } });
  const medicationUnmarked = await db.careEntryActivity.count({
    where: { organizationId, activityGroup: CareActivityGroup.MEDICATION, outcome: CareActivityOutcome.DONE, medicationAction: null, entry: entryScope }
  });

  return {
    month: name,
    missing: missing.slice(0, HOME_CARE_LIMITS.MONTH_MISSING_SHOWN),
    missingCount: missing.length,
    openIncidents,
    openSignals,
    medicationUnmarked,
    clear: missing.length + openIncidents + openSignals + medicationUnmarked === 0
  };
}
