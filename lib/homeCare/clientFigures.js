/**
 * KODUTEENUS K5-s — kliendi arvud otsustajale (kava II.6.13: ülevaade enne ülevaatust).
 *
 * Enne teenuse ülevaatust küsib omavalitsuse sotsiaaltöötaja, kuidas on läinud: mitu käiku
 * tehti, kui palju aega osutati otsustatu kõrval, mitu käiku jäi ära ja mis juhtus. Siin
 * loetakse need arvud ühe kliendi kohta kokku: kolm viimast täiskuud ja jooksev kuu tänaseni.
 * Arvud lähevad teate teksti (`decisionNotices.js`); päeviku teksti siin ei ole.
 *
 * Kuud, millest varem kliendi kohta midagi kirjas ei ole (ei käike, ei otsustatud mahtu, ei
 * ära jäänud käike), jäetakse algusest välja: hiljuti alanud teenusel ei ole tühje ridu.
 */

import { serverT } from "../i18n/serverMessages.js";

import { monthRange, monthText, resolveCallMonth, shiftMonth } from "./calls.js";
import { CareEntryKind, CareIncidentType, CareVisitChangeKind, HOME_CARE_LIMITS } from "./constants.js";
import { loadContinuityWithin } from "./continuity.js";
import { hoursCell } from "./crisisSheet.js";
import { todayText } from "./decisions.js";
import { loadHelpDriftWithin } from "./helpDrift.js";
import { MISSED_VISIT_TYPES, VISIT_RECORD, expectedMinutes } from "./provided.js";
import { awayDaysBetween, loadStatusChanges } from "./statusTimeline.js";

function pad(value) {
  return String(value).padStart(2, "0");
}

function nextDay(day) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function dayLabel(day) {
  const [year, month, date] = String(day || "").split("-");
  return year && month && date ? `${date}.${month}.${year}` : "";
}

function monthLabel(month) {
  const [year, number] = String(month || "").split("-");
  return year && number ? `${number}.${year}` : "";
}

/** Kuu real on midagi öelda: oli käike, otsustatud maht, ära jäänud või ette ära jäetud käike või äraolek. */
function hasContent(row) {
  return Boolean(row.visits || row.expectedMinutes !== null || row.missed || row.cancelled || row.awayDays);
}

/** Jätab algusest välja kuud, mille kohta ei ole midagi kirjas. Puhas funktsioon. */
export function trimLeadingEmptyMonths(months) {
  const first = months.findIndex(hasContent);
  return first === -1 ? [] : months.slice(first);
}

/** Kliendi arvud: viimased täiskuud ja jooksev kuu tänaseni, erijuhtumid liigi kaupa, märkamised ja püsivus. */
export async function loadClientFiguresWithin(tx, { organizationId, client, now, timeZone }) {
  const today = todayText(now, timeZone);
  const current = resolveCallMonth(undefined, now, timeZone);
  const decisions = await tx.careDecision.findMany({
    where: { clientId: client.id, retractedAt: null },
    select: { validFrom: true, validUntil: true, volumeMinutes: true, volumePeriod: true, createdAt: true, retractedAt: true }
  });
  const changes = (await loadStatusChanges(tx, organizationId, [client.id], timeZone)).get(client.id) || [];

  const months = [];
  for (let back = HOME_CARE_LIMITS.NOTICE_FIGURE_MONTHS; back >= 0; back -= 1) {
    const month = shiftMonth(current, -back);
    const name = monthText(month.year, month.month);
    const fromDay = `${name}-01`;
    const lastDay = `${name}-${pad(new Date(Date.UTC(month.year, month.month, 0)).getUTCDate())}`;
    const untilDay = lastDay < today ? lastDay : today;
    const range = monthRange(month, timeZone);
    const sums = await tx.careClientEntry.aggregate({
      where: { clientId: client.id, ...VISIT_RECORD, occurredAt: range },
      _count: { _all: true },
      _sum: { visitMinutes: true }
    });
    const missed = await tx.careClientEntry.count({
      where: { clientId: client.id, retractedAt: null, kind: CareEntryKind.INCIDENT, incidentType: { in: [...MISSED_VISIT_TYPES] }, occurredAt: range }
    });
    const cancelled = await tx.careVisitChange.count({
      where: { clientId: client.id, kind: CareVisitChangeKind.CANCELLED, day: { gte: fromDay, lte: lastDay } }
    });
    months.push({
      month: name,
      untilDay,
      partial: back === 0,
      visits: sums._count._all,
      minutes: sums._sum.visitMinutes || 0,
      expectedMinutes: expectedMinutes(decisions, fromDay, untilDay)?.minutes ?? null,
      missed,
      cancelled,
      awayDays: awayDaysBetween(changes, client.status, fromDay, untilDay, nextDay)
    });
  }

  const first = shiftMonth(current, -HOME_CARE_LIMITS.NOTICE_FIGURE_MONTHS);
  const window = { gte: monthRange(first, timeZone).gte, lte: now };
  const incidentRows = await tx.careClientEntry.groupBy({
    by: ["incidentType"],
    /* „Peaaegu juhtus" on asutuse enda tööohutuse õppimiseks; otsustajale see ei lähe. */
    where: { clientId: client.id, retractedAt: null, kind: CareEntryKind.INCIDENT, incidentType: { not: CareIncidentType.NEAR_MISS }, occurredAt: window },
    _count: { _all: true }
  });
  const byType = {};
  for (const row of incidentRows) if (row.incidentType) byType[row.incidentType] = row._count._all;
  const signals = await tx.careChangeSignal.count({ where: { clientId: client.id, openedAt: window } });
  const continuity = await loadContinuityWithin(tx, client.id, now);

  return {
    months: trimLeadingEmptyMonths(months),
    incidents: { total: Object.values(byType).reduce((sum, count) => sum + count, 0), byType },
    signals,
    continuity: continuity ? { workers: continuity.workers, visits: continuity.visits } : null,
    /* Abi rohkem või vähem kui kavas (K6-d), viimased neli nädalat. */
    helpDrift: await loadHelpDriftWithin(tx, client.id, now)
  };
}

/** Arvude read teate teksti jaoks, asutuse keeles. Puhas funktsioon. */
export function figureLines(locale, figures) {
  const say = (key, values) => serverT(locale, `home_care.notice.doc.${key}`, values);
  const lines = [say("figures_title")];
  if (!figures.months.length) lines.push(say("figures_none"));
  for (const row of figures.months) {
    const label = row.partial ? say("figures_partial", { month: monthLabel(row.month), date: dayLabel(row.untilDay) }) : monthLabel(row.month);
    const parts = [
      say("figures_visits", { count: row.visits }),
      say("figures_hours", { hours: hoursCell(row.minutes) }),
      row.expectedMinutes === null ? say("figures_no_decision") : say("figures_expected", { hours: hoursCell(row.expectedMinutes) }),
      row.missed ? say("figures_missed", { count: row.missed }) : null,
      row.cancelled ? say("figures_cancelled", { count: row.cancelled }) : null,
      row.awayDays ? say("figures_away", { count: row.awayDays }) : null
    ].filter(Boolean);
    lines.push(`- ${label}: ${parts.join(", ")}`);
  }
  if (figures.incidents.total) {
    const list = Object.keys(figures.incidents.byType)
      .sort()
      .map((type) => `${serverT(locale, `home_care.incident.types.${type}`, null, type)} ${figures.incidents.byType[type]}`)
      .join(", ");
    lines.push(say("figures_incidents", { count: figures.incidents.total, list }));
  } else {
    lines.push(say("figures_incidents_none"));
  }
  if (figures.signals) lines.push(say("figures_signals", { count: figures.signals }));
  if (figures.continuity) lines.push(say("figures_workers", { workers: figures.continuity.workers, visits: figures.continuity.visits }));
  if (figures.helpDrift && figures.helpDrift.more + figures.helpDrift.less > 0) {
    lines.push(say("figures_help_drift", { more: figures.helpDrift.more, less: figures.helpDrift.less, total: figures.helpDrift.total }));
  }
  return lines;
}
