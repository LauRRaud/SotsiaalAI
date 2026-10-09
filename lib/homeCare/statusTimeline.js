/**
 * KODUTEENUS K5-m — kliendi seis MINEVIKU päeval (seisu ajaloost).
 *
 * Plaanivaated (päev, nädal, kuu lahtised asjad, eilne käik) peavad möödunud päeva kohta
 * teadma, mis seisus klient TOL päeval oli, mitte mis seisus ta on täna: klient, kes oli
 * eelmisel nädalal haiglas, ei jätnud käike tegemata, ja klient, kelle teenus eile lõppes,
 * oli esmaspäeval veel teenusel. Seis loetakse seisumuutuste ajaloost
 * (`CareClientStatusChange`); tänase ja tulevaste päevade kohta kehtib tänane seis.
 */

import { todayText } from "./decisions.js";

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

/** Klientide seisumuutused ajajärjestuses kliendi kaupa, päev asutuse ajavööndis. */
export async function loadStatusChanges(db, organizationId, clientIds, timeZone) {
  const changesOf = new Map();
  if (!clientIds.length) return changesOf;
  const rows = await db.careClientStatusChange.findMany({
    where: { organizationId, clientId: { in: clientIds } },
    select: { clientId: true, fromStatus: true, toStatus: true, changedAt: true },
    orderBy: [{ changedAt: "asc" }, { id: "asc" }]
  });
  for (const row of rows) {
    if (!changesOf.has(row.clientId)) changesOf.set(row.clientId, []);
    changesOf.get(row.clientId).push({ day: todayText(row.changedAt, timeZone), fromStatus: row.fromStatus, toStatus: row.toStatus });
  }
  return changesOf;
}

/**
 * Seisu küsija plaanivaadetele: möödunud päeva kohta ajaloost, tänase ja tulevase päeva
 * kohta tänane seis. `clients` on kaart kliendi ID → `{ status }`.
 */
export function statusReader(changesOf, clients, today) {
  return (clientId, day) => {
    const current = clients.get(clientId)?.status;
    return day < today ? statusOnDay(changesOf.get(clientId) || [], current, day) : current;
  };
}
