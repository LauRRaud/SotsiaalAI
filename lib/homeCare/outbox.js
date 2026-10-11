/**
 * KODUTEENUS K1-e — võrguta kirje järjekorra reeglid.
 *
 * MIKS. Hooldaja kirjutab kirje seal, kus töö lõpeb: kliendi köögis, keldris,
 * levita maal. Kui salvestamise hetkel võrku ei ole, ei tohi kirje kaduda ega
 * jääda õhtuseks mälu järgi kirjutamiseks. Kirje jääb seadmesse ootele ja
 * saadetakse, kui ühendus taastub.
 *
 * IGAL KIRJEL ON `clientRequestId`, mille vorm paneb paika esimesel katsel.
 * Server tunneb korduse ära, seega võib järjekord sama kirjet saata mitu korda
 * (vastus läks kaotsi, kaks vahelehte saadavad korraga) ilma teist kirjet
 * tekitamata.
 *
 * KUI KAUA OOTAS, mitte mis kell oli. Seadme kellaaega server ei usalda;
 * järjekord saadab kaasa ooteaja (`waitedMs`), mille seade mõõdab ühe ja sama
 * kellaga mõlemas otsas. Server arvutab sellest sündmuse aja.
 *
 * Siin on ainult puhtad funktsioonid: salvestus (`deviceStore.js`) ja võrk
 * (`components/homeCare/homeCareOutbox.js`) antakse väljastpoolt, et reegleid
 * saaks testida ilma brauserita.
 */

/**
 * Ülempiir. Ilma selleta kasvaks järjekord katkise sünkroonimise korral kuni
 * seadme salvestusruumi täitumiseni. Täis järjekord BLOKEERIB uue kirje
 * (tekst jääb vormile), mitte ei viska vanu ära.
 */
export const OUTBOX_LIMIT = 50;

export const OutboxState = Object.freeze({
  /** Ootab ühendust või ligipääsu; proovitakse uuesti. */
  PENDING: "pending",
  /** Server vaatas ja ütles ei; kordamine annaks sama vastuse. Jääb seadmesse, kuni inimene otsustab. */
  ATTENTION: "attention"
});

export const SendOutcome = Object.freeze({
  SENT: "sent",
  RETRY: "retry",
  ATTENTION: "attention"
});

/** Pooleli kirje mustand aegub: kliendi tekst ei jää seadmesse igaveseks. */
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Kas saatmine jõudis otsuseni?
 *
 * Võrguviga ja 5xx: server ei otsustanud, proovime uuesti. 401, 403 ja 404:
 * sessioon või ligipääs võib taastuda (uuesti sisselogimine, põhjusega
 * avamine, homne meeskond; 404 tähendab siin „sulle seda praegu ei ole", ka
 * siis, kui koduteenus on hetkeks suletud), tehtud tööd ei tohi selle pärast
 * kaotada. 408, 425 ja 429 on ajutised. Muu 4xx tähendab, et server vaatas
 * sisu ja keeldus: kordamine sama sisuga ei aita ja kirje jääb seadmesse
 * inimese otsust ootama (ta saab selle uuesti teele panna, kui põhjus on
 * kõrvaldatud).
 *
 * „Õnnestunud" olekukood ILMA meie vastuseta (wifi sisselogimisleht, vahelüüsi
 * HTML) ei ole serveri otsus: meie API vastab 2xx-ga alati `ok: true`. Selline
 * vastus tähendab, et päring ei jõudnud kohale, ja kirje jääb ootele.
 */
export function sendOutcome({ ok = false, status = 0 } = {}) {
  if (ok) return SendOutcome.SENT;
  const code = Number(status) || 0;
  if (code < 400) return SendOutcome.RETRY;
  if ([401, 403, 404, 408, 425, 429].includes(code)) return SendOutcome.RETRY;
  if (code >= 500) return SendOutcome.RETRY;
  return SendOutcome.ATTENTION;
}

/**
 * Kas salvestamise ebaõnnestumine tähendab „serverini ei jõudnud"? Ainult siis
 * läheb uus kirje vormilt järjekorda. 502, 503 ja 504 on vahelüüsi vastused
 * ajal, mil rakendus taaskäivitub; server ise kirjet ei näinud. Sama kehtib
 * alla 400 olekukoodi kohta, millel ei olnud meie vastust (vt `sendOutcome`).
 */
export function isUnreachable(status) {
  const code = Number(status) || 0;
  return code < 400 || code === 502 || code === 503 || code === 504;
}

/** Ligipääsuta kirje: ootab ja seda proovitakse edasi, aga inimene peab teadma, miks see ei liigu. */
export function isBlocked(item) {
  const status = Number(item?.lastStatus);
  return !item?.unreadable && item?.state !== OutboxState.ATTENTION && (status === 403 || status === 404);
}

/**
 * Kirje, mis ei lähe ise teele ilma inimese sammuta: server lükkas tagasi,
 * rida ei saa avada või ligipääs kliendile puudub. Sellise kirje täistekst on
 * ribal näha ja selle saab seadmest kustutada.
 */
export function needsPerson(item) {
  return Boolean(item?.unreadable || item?.state === OutboxState.ATTENTION || isBlocked(item));
}

/** Uus järjekorra kirje. `body` on TÄPSELT see keha, mille vorm serverile saatis. */
export function newQueueItem({ organizationId, clientId, clientName, body, nowMs }) {
  const clientRequestId = typeof body?.clientRequestId === "string" ? body.clientRequestId : "";
  if (!clientRequestId || !organizationId || !clientId || !Number.isFinite(nowMs)) return null;
  return {
    clientRequestId,
    organizationId: String(organizationId),
    clientId: String(clientId),
    queuedAtMs: nowMs,
    state: OutboxState.PENDING,
    attempts: 0,
    lastStatus: null,
    lastMessageKey: null,
    lastTriedAtMs: null,
    payload: { clientName: typeof clientName === "string" ? clientName : "", body }
  };
}

/**
 * Saadetav keha: vormi keha ja ooteaeg. Ooteaeg ei ole kunagi negatiivne
 * (seadme kella tagasi keeramine ei tohi anda tuleviku sündmust). Ülempiiri
 * siin ei ole: liiga kaua oodanud kirje lükkab server tagasi ja inimene näeb
 * seda, selle asemel et aeg vaikselt valeks läheks.
 */
export function bodyForSend(item, nowMs) {
  const waitedMs = Math.max(0, Math.round((Number(nowMs) || 0) - (Number(item?.queuedAtMs) || 0)));
  return { ...(item?.payload?.body || {}), waitedMs };
}

/** Kirje seis pärast saatmiskatset. Õnnestunud kirje eemaldatakse seadmest, seda siin ei ole. */
export function afterAttempt(item, { outcome, status = 0, messageKey = "", nowMs }) {
  return {
    ...item,
    state: outcome === SendOutcome.ATTENTION ? OutboxState.ATTENTION : OutboxState.PENDING,
    attempts: (Number(item.attempts) || 0) + 1,
    lastStatus: Number(status) || 0,
    lastMessageKey: typeof messageKey === "string" && messageKey ? messageKey.slice(0, 200) : null,
    lastTriedAtMs: Number.isFinite(nowMs) ? nowMs : null
  };
}

/** Sama võti asendab olemasoleva; uus võti vajab vaba kohta. */
export function canEnqueue(items, clientRequestId) {
  const list = Array.isArray(items) ? items : [];
  if (list.some((item) => item.clientRequestId === clientRequestId)) return true;
  return list.length < OUTBOX_LIMIT;
}

export function outboxSummary(items) {
  const list = Array.isArray(items) ? items : [];
  const refused = list.filter((item) => item.state === OutboxState.ATTENTION || item.unreadable).length;
  return { total: list.length, attention: list.filter(needsPerson).length, pending: list.length - refused };
}

/** Vanemad ees: kirjed jõuavad serverisse kirjutamise järjekorras. */
export function sortQueue(items) {
  return [...(Array.isArray(items) ? items : [])].sort((a, b) => {
    if (a.queuedAtMs !== b.queuedAtMs) return (a.queuedAtMs || 0) - (b.queuedAtMs || 0);
    return String(a.clientRequestId) < String(b.clientRequestId) ? -1 : 1;
  });
}

/** Lühike eelvaade loendisse; täistekst on krüpteeritult seadmes. */
export function previewText(text, max = 90) {
  const flat = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/** Kas vormi seisus on midagi, mida tasub alles hoida? */
export function isDraftWorthKeeping(state) {
  if (!state || typeof state !== "object") return false;
  /* Ka käigu kirje märked (tehtud toimingud, kestus) on töö, mida ei tohi kaotada. */
  const hasVisit =
    Boolean(String(state.visitMinutes || "").trim()) ||
    Boolean(state.done && typeof state.done === "object" && Object.keys(state.done).length > 0) ||
    Boolean(state.skipped && typeof state.skipped === "object" && Object.keys(state.skipped).length > 0);
  return Boolean(String(state.text || "").trim() || String(state.assessment || "").trim() || hasVisit);
}

export function isDraftExpired(draft, nowMs) {
  const savedAt = Number(draft?.savedAtMs);
  if (!Number.isFinite(savedAt)) return true;
  return nowMs - savedAt > DRAFT_MAX_AGE_MS;
}
