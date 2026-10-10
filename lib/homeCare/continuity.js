/**
 * KODUTEENUS K5-f — püsivuse näit (kava II.6.2).
 *
 * Kui klienti jagab mitu hooldajat, on kliendil ja hooldusjuhil õigus teada, kui mitu eri
 * inimest tema juures tegelikult käib. Näit on inimkeeles: „viimasel neljal nädalal käis
 * kuus eri töötajat; kolm neist tegid 80% käikudest". See ei ole hinnang: uuringus ei
 * pidanud enamik kliente töötajate arvu probleemiks, lähedased aga pidasid. Näit annab
 * arvu, mille üle saab kliendiga rääkida.
 *
 * Loetakse käigu kirjeid (tühistamata kirje kestuse või toimingutega) kirjutaja järgi.
 * Kaasas käinud töötajat eraldi ei loeta: näit on selle kohta, kes käigu tegi.
 */

import { HOME_CARE_LIMITS } from "./constants.js";
import { VISIT_RECORD } from "./provided.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Puhas reegel: käikude arv töötaja kaupa → mitu töötajat käis ja mitu neist tegid
 * vähemalt `share` käikudest (väikseim selline hulk). Käikudeta tagastab `null`.
 */
export function continuityFigure(counts, share = HOME_CARE_LIMITS.CONTINUITY_SHARE) {
  const rows = counts.filter((row) => row.visits > 0).sort((a, b) => b.visits - a.visits);
  const visits = rows.reduce((sum, row) => sum + row.visits, 0);
  if (!visits) return null;
  let covered = 0;
  let topWorkers = 0;
  for (const row of rows) {
    covered += row.visits;
    topWorkers += 1;
    if (covered / visits >= share) break;
  }
  return { visits, workers: rows.length, topWorkers, topPercent: Math.round((covered / visits) * 100) };
}

/** Kliendi viimase nelja nädala näit kliendi lehele või `null`, kui käike ei olnud. */
export async function loadContinuityWithin(tx, clientId, now) {
  const days = HOME_CARE_LIMITS.CONTINUITY_DAYS;
  const rows = await tx.careClientEntry.groupBy({
    by: ["authorMembershipId", "authorName"],
    where: { clientId, ...VISIT_RECORD, occurredAt: { gte: new Date(now.getTime() - days * DAY_MS), lte: now } },
    _count: { _all: true }
  });
  /* Sama inimese read (nimi võis vahepeal muutuda) üheks; liikmesuseta rida jääb nime järgi. */
  const byWorker = new Map();
  for (const row of rows) {
    const key = row.authorMembershipId || `nimi:${row.authorName || ""}`;
    byWorker.set(key, (byWorker.get(key) || 0) + row._count._all);
  }
  const figure = continuityFigure([...byWorker.values()].map((visits) => ({ visits })));
  return figure ? { days, ...figure } : null;
}

/* Asenduse mõju reegel on failis `continuityImpact.js` (puhas, loetav ka brauseris). */
export { continuityImpact } from "./continuityImpact.js";

/** Klientide viimase nelja nädala käikude tegijad: kliendi ID → liikmesuste ID-d. Üks päring kõigi klientide kohta. */
export async function loadRecentWorkersByClient(db, organizationId, clientIds, now) {
  const ids = [...new Set((clientIds || []).filter(Boolean))];
  if (!ids.length) return {};
  const rows = await db.careClientEntry.groupBy({
    by: ["clientId", "authorMembershipId"],
    where: {
      organizationId,
      clientId: { in: ids },
      authorMembershipId: { not: null },
      ...VISIT_RECORD,
      occurredAt: { gte: new Date(now.getTime() - HOME_CARE_LIMITS.CONTINUITY_DAYS * DAY_MS), lte: now }
    },
    _count: { _all: true }
  });
  const byClient = {};
  for (const row of rows) {
    if (!byClient[row.clientId]) byClient[row.clientId] = [];
    byClient[row.clientId].push(row.authorMembershipId);
  }
  return byClient;
}
