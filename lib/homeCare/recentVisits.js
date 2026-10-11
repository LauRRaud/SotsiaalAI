/**
 * KODUTEENUS K5-l — eilne ja tänane käik kliendi lehel (kava II.6.8, kõnele vastamine).
 *
 * Lähedane helistab ja küsib: „Kas ema juures käidi?" Vastaja peab seda nägema ühe
 * pilguga, mitte päevikust otsima. Siin on kliendi eilsed ja tänased plaanitud käigud
 * koos seisuga (plaanis, tehtud, tegemata, ära jäetud). Päeval, mil klient ei olnud
 * teenusel, käike ei näidata: seis loetakse seisu ajaloost, nagu kuu lahtiste asjade juures.
 */

import { CareClientStatus } from "./constants.js";
import { loadRange } from "./dayPlan.js";
import { todayText } from "./decisions.js";
import { statusOnDay } from "./monthClose.js";
import { shiftDay, timeText } from "./slots.js";

/**
 * @param {object} db andmebaas või tehing
 * @param {{ organizationId: string, client: { id: string, status: string }, statusHistory: Array<{ fromStatus: string, toStatus: string, changedAt: string }>, today: string, timeZone: string, now: Date }} input
 * @returns {Promise<Array<{ day: string, away: boolean, visits: Array<{ startTime: string, state: string }> }>|null>} eile ja täna; `null`, kui kummalgi päeval ei ole midagi öelda
 */
export async function loadRecentVisitsWithin(db, { organizationId, client, statusHistory, today, timeZone, now }) {
  const yesterday = shiftDay(today, -1);
  const { days } = await loadRange(db, { organizationId, fromDay: yesterday, toDay: today, timeZone, now, clientWhere: { id: client.id } });
  /* Seisu ajalugu tuleb uuem ees; reegel tahab ajajärjestust ja päeva asutuse ajavööndis. */
  const changes = [...(statusHistory || [])]
    .reverse()
    .map((row) => ({ day: todayText(new Date(row.changedAt), timeZone), fromStatus: row.fromStatus, toStatus: row.toStatus }));

  const result = [yesterday, today].map((day) => {
    const away = statusOnDay(changes, client.status, day) !== CareClientStatus.ACTIVE;
    const visits = away ? [] : (days.get(day) || []).filter((visit) => visit.clientId === client.id).map((visit) => ({ startTime: timeText(visit.startMinute), state: visit.state }));
    return { day, away, visits };
  });
  return result.some((item) => item.away || item.visits.length) ? result : null;
}
