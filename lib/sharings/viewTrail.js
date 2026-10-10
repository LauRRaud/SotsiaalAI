/**
 * „KES ON VAADANUD" — jagatu vaatamiste jälg (funktsioonikaart F13).
 *
 * Lehel „Minu jagamised" oli näha ainult saaja ESIMESE avamise aeg. Siin on jälg: üks rida
 * vaataja ja päeva kohta, kui SAAJA jagatut loeb. Jagaja näeb sellest ainult kokkuvõtet
 * (mitmel päeval ja millal viimati), mitte seda, kes vaatas: asutuse postkasti puhul oleks
 * vaatajate nimed või arv asutuse sisemine asi.
 *
 * Kolm reeglit, mida iga kutsuja peab pidama:
 *  1. Kirjutatakse PÄRAST lugemise tehingu lõppu ja tavalise ühendusega. Tehingu sees
 *     ebaõnnestunud lisamine katkestaks Postgresis kogu tehingu ja lõhuks lugemise.
 *  2. Kirjutus ei viska kunagi: jälje puudumine on väiksem kahju kui lugemata jäänud pöördumine.
 *  3. Jagaja enda vaatamist ei logita ja rida, millel jagajat enam ei ole (konto kustutatud),
 *     ei logita samuti: seda jälge ei oleks kellelgi näha.
 *
 * Jagatu rida ennast (`updatedAt`) see moodul ei puuduta: eelpöördumise `updatedAt` on
 * tagasivõtmise ja paranduse lukk ning loendi järjestus.
 */

import { safeError } from "@/lib/privacy/safeError";
import { ESTONIA_TIME_ZONE, zonedParts } from "@/lib/time/estonianDay";

export const SharingViewKind = Object.freeze({
  PRE_INQUIRY: "PRE_INQUIRY",
  NETWORK_SHARE: "NETWORK_SHARE",
  SERVICE_REPORT_SHARE: "SERVICE_REPORT_SHARE"
});

/** Millise veeruga rida jagatule viitab. */
const ITEM_FIELD = Object.freeze({
  [SharingViewKind.PRE_INQUIRY]: "preInquiryId",
  [SharingViewKind.NETWORK_SHARE]: "networkShareId",
  [SharingViewKind.SERVICE_REPORT_SHARE]: "serviceReportShareId"
});

/** Päev kujul AAAA-KK-PP Eesti aja järgi: kell 01.00 öösel loetu kuulub juba uude päeva. */
export function viewDay(now = new Date()) {
  const parts = zonedParts(now, ESTONIA_TIME_ZONE);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** Kas see lugemine läheb jäljesse. Puhas funktsioon. */
export function shouldRecordSharingView({ kind, itemId, viewerUserId, sharerUserIds }) {
  if (!ITEM_FIELD[kind] || !itemId || !viewerUserId) return false;
  const sharers = (sharerUserIds || []).filter(Boolean);
  if (!sharers.length) return false;
  return !sharers.includes(viewerUserId);
}

/**
 * Paneb kirja, et saaja luges jagatut. Tagastab `true`, kui tekkis uus rida (selle vaataja
 * selle päeva esimene lugemine). Ei viska kunagi.
 */
export async function recordSharingView({ db, kind, itemId, viewerUserId, sharerUserIds = [], now = new Date() }) {
  if (!shouldRecordSharingView({ kind, itemId, viewerUserId, sharerUserIds })) return false;
  try {
    /* Kerge testiühendus ilma selle mudelita: jälge lihtsalt ei teki. */
    if (typeof db?.sharingView?.createMany !== "function") return false;
    const result = await db.sharingView.createMany({
      data: [{ kind, [ITEM_FIELD[kind]]: itemId, viewerUserId, day: viewDay(now) }],
      skipDuplicates: true
    });
    return Boolean(result?.count);
  } catch (error) {
    console.error("[sharing_view] record failed", safeError(error));
    return false;
  }
}

/**
 * Read (`{ <veerg>, day }`, üks iga jagatu ja päeva kohta) kokkuvõtteks: kaart jagatu ID →
 * `{ days, lastDay }`. Mitme vaataja sama päev loeb üheks päevaks.
 *
 * `firstOpenDays` (kaart jagatu ID → päev) lisab esimese avamise päeva nende ridade hulka,
 * millel on jälg olemas. Enne jälje sündi avatud jagamisel ei ole avamise päeva kohta rida:
 * ilma selleta ütleks leht „avatud 2. oktoobril" ja selle all „vaadatud ühel päeval: 14.
 * oktoober". Jagamisele, millel jälge ei ole, kokkuvõtet ei teki. Puhas funktsioon.
 */
export function summarizeSharingViews(rows, field, firstOpenDays = new Map()) {
  const daysOf = new Map();
  for (const row of rows || []) {
    const id = row?.[field];
    if (!id || !row.day) continue;
    if (!daysOf.has(id)) daysOf.set(id, new Set());
    daysOf.get(id).add(row.day);
  }
  const summary = new Map();
  for (const [id, days] of daysOf) {
    const firstOpen = firstOpenDays.get(id);
    if (firstOpen) days.add(firstOpen);
    summary.set(id, { days: days.size, lastDay: [...days].sort().at(-1) });
  }
  return summary;
}

/**
 * Jagaja lehele ja väljavõttesse: loendi ridade vaatamiste kokkuvõte ühe päringuga. Viga
 * (ka puuduv tabel enne migratsiooni) annab tühja kaardi, mitte ei vii kogu jaotist rivist välja.
 */
export async function loadSharingViewSummary(db, kind, itemIds, { firstOpenDays } = {}) {
  const field = ITEM_FIELD[kind];
  const ids = [...new Set((itemIds || []).filter(Boolean))];
  if (!field || !ids.length || typeof db?.sharingView?.groupBy !== "function") return new Map();
  try {
    const rows = await db.sharingView.groupBy({ by: [field, "day"], where: { kind, [field]: { in: ids } } });
    return summarizeSharingViews(rows, field, firstOpenDays);
  } catch (error) {
    console.error("[sharing_view] summary failed", safeError(error));
    return new Map();
  }
}

/** Esimese avamise päev rea väljalt `openedAt` (kuupäev või ISO-tekst); vigane väärtus jääb välja. */
function firstOpenDaysOf(items) {
  const days = new Map();
  for (const item of items || []) {
    if (!item?.id || !item.openedAt) continue;
    const opened = new Date(item.openedAt);
    if (Number.isFinite(opened.getTime())) days.set(item.id, viewDay(opened));
  }
  return days;
}

/**
 * Lisab loendi ridadele välja `views` seal, kus vaatamisi on; ülejäänud read jäävad puutumata.
 * Rea enda `openedAt` (esimene avamine) loetakse vaatamispäevade hulka.
 */
export async function attachSharingViews(db, kind, items) {
  const summary = await loadSharingViewSummary(db, kind, (items || []).map((item) => item?.id), { firstOpenDays: firstOpenDaysOf(items) });
  if (!summary.size) return items;
  return items.map((item) => (summary.has(item.id) ? { ...item, views: summary.get(item.id) } : item));
}
