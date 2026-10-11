/**
 * KODUTEENUS K6-f — kojutulek (kava II.6.5: „naasmisel tekib kojutuleku käik").
 *
 * Inimene tuleb haiglast või pikemalt äraolekult koju teistsugusena, kui ta läks: külmkapp
 * on tühi või toit riknenud, ravimiskeem on muutunud, tuba on kütmata, ja sageli vajab ta
 * abi rohkem kui enne. Kui esimene käik pärast naasmist tehakse nagu tavaline, jääb see
 * märkamata. Siin on märk, mis püsib kliendi juures naasmisest kuni esimese käigu kirjeni.
 *
 * Märk loetakse seisumuutuste ajaloost (`CareClientStatusChange`), midagi juurde ei
 * salvestata: viimane muutus on „ajutiselt ära → teenusel", äraolek kestis vähemalt
 * `HOMECOMING_MIN_AWAY_DAYS` päeva või oli haiglas, ja naasmise päevast alates ei ole
 * käigu kirjet. Ohutuse pärast peatatud käikude taastumine ei ole kojutulek. Märk aegub
 * `HOMECOMING_DAYS` päeva pärast, et vana äraolek ei jääks kliendi külge rippuma.
 */

import { CareAwayReason, CareClientStatus, HOME_CARE_LIMITS } from "./constants.js";
import { daysBetween, todayText } from "./decisions.js";
import { VISIT_RECORD } from "./provided.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `changes`: ühe kliendi seisumuutused ajajärjestuses (`{ fromStatus, toStatus, reason, changedAt }`).
 * Tagastab `{ returnedOn, awayFrom, reason }` või `null`. Äraoleku algus on järjestikuste
 * „ära" ridade esimene (põhjust võidi vahepeal täpsustada), põhjus viimane. Puhas funktsioon.
 */
export function homecomingOf(changes, { now, timeZone }) {
  const list = changes || [];
  const last = list[list.length - 1];
  if (!last || last.fromStatus !== CareClientStatus.AWAY || last.toStatus !== CareClientStatus.ACTIVE) return null;
  let start = null;
  let reason = null;
  for (let index = list.length - 2; index >= 0 && list[index].toStatus === CareClientStatus.AWAY; index -= 1) {
    start = list[index];
    if (reason === null) reason = list[index].reason || null;
  }
  if (!start || reason === CareAwayReason.SAFETY) return null;
  const returnedOn = todayText(last.changedAt, timeZone);
  const awayFrom = todayText(start.changedAt, timeZone);
  if (reason !== CareAwayReason.HOSPITAL && daysBetween(awayFrom, returnedOn) < HOME_CARE_LIMITS.HOMECOMING_MIN_AWAY_DAYS) return null;
  if (daysBetween(returnedOn, todayText(now, timeZone)) > HOME_CARE_LIMITS.HOMECOMING_DAYS) return null;
  return { returnedOn, awayFrom, reason };
}

/**
 * Lahtised kojutulekud kliendi kaupa: kaart kliendi ID → `{ returnedOn, awayFrom, reason }`.
 * `clientWhere` kitsendab kliente (ID-de loend või üksus). Käik naasmise päeval loeb ka siis,
 * kui naasmine pandi kirja pärast käiku: klient oli kodus, kui tema juures käidi.
 */
export async function loadHomecomings(db, { organizationId, clientWhere = {}, now, timeZone }) {
  const open = new Map();
  const cutoff = new Date(now.getTime() - (HOME_CARE_LIMITS.HOMECOMING_DAYS + 1) * DAY_MS);
  const candidates = await db.careClient.findMany({
    where: { organizationId, status: CareClientStatus.ACTIVE, statusChangedAt: { gte: cutoff }, ...clientWhere },
    select: { id: true },
    take: HOME_CARE_LIMITS.DEADLINE_CLIENTS_MAX
  });
  if (!candidates.length) return open;
  const ids = candidates.map((row) => row.id);
  const rows = await db.careClientStatusChange.findMany({
    where: { organizationId, clientId: { in: ids } },
    select: { clientId: true, fromStatus: true, toStatus: true, reason: true, changedAt: true },
    orderBy: [{ changedAt: "asc" }, { id: "asc" }]
  });
  const changesOf = new Map();
  for (const row of rows) {
    if (!changesOf.has(row.clientId)) changesOf.set(row.clientId, []);
    changesOf.get(row.clientId).push(row);
  }
  for (const [clientId, changes] of changesOf) {
    const homecoming = homecomingOf(changes, { now, timeZone });
    if (homecoming) open.set(clientId, homecoming);
  }
  if (!open.size) return open;
  const visited = await db.careClientEntry.groupBy({
    by: ["clientId"],
    where: { organizationId, clientId: { in: [...open.keys()] }, ...VISIT_RECORD, occurredAt: { gte: cutoff } },
    _max: { occurredAt: true }
  });
  for (const row of visited) {
    const lastVisitOn = row._max.occurredAt ? todayText(row._max.occurredAt, timeZone) : null;
    if (lastVisitOn && lastVisitOn >= open.get(row.clientId).returnedOn) open.delete(row.clientId);
  }
  return open;
}

/** Ühe kliendi lahtine kojutulek kliendi lehele; `null`, kui seda ei ole. */
export async function loadHomecomingWithin(tx, { organizationId, clientId, now, timeZone }) {
  return (await loadHomecomings(tx, { organizationId, clientWhere: { id: clientId }, now, timeZone })).get(clientId) || null;
}

/** Tähtaegade vaatele: kliendid, kelle juures ei ole pärast kojutulekut käidud; varasem naasmine ees. */
export async function loadHomecomingsOpen(db, { organizationId, clientWhere = {}, now, timeZone }) {
  const open = await loadHomecomings(db, { organizationId, clientWhere, now, timeZone });
  if (!open.size) return [];
  const today = todayText(now, timeZone);
  const clients = await db.careClient.findMany({
    where: { organizationId, id: { in: [...open.keys()] } },
    select: { id: true, displayName: true, status: true }
  });
  return clients
    .map((client) => ({ client, ...open.get(client.id), days: daysBetween(open.get(client.id).returnedOn, today) }))
    .sort((a, b) => (a.returnedOn < b.returnedOn ? -1 : a.returnedOn > b.returnedOn ? 1 : a.client.displayName.localeCompare(b.client.displayName, "et")));
}
