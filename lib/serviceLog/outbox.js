/**
 * TEENUSPÄEVIK-V1 — võrguta sisestuse järjekord (seadmes).
 *
 * MIKS: koduhooldaja töötab keldrites, betoonmajades ja levita piirkondades.
 * Fleet Complete'i kasutuselevõtu artikkel loetleb kasutajate kaebustena just
 * seda — internet ei olnud kättesaadav, rakendus hangus. Kui kirje sünnib seal,
 * kus töö lõpeb (leping ptk 0 kaitsereegel a), siis peab ta sündima ka siis,
 * kui võrku ei ole. Muidu läheb ta õhtusesse mälu järgi sisestamisse — täpselt
 * sinna, kust me ta ära tõime.
 *
 * IGAL KIRJEL ON `clientRequestId`. Ilma selleta oleks järjekord ohtlikum kui
 * kadunud kirje: kordussaatmine looks ÜHEST tehtud tööst KAKS arve
 * alusdokumenti. Server on idempotentne (`lib/serviceLog/entries.js`), aga
 * võti sünnib SIIN — server ei saa teda ise välja mõelda.
 *
 * ISIKUANDMED. Erinevalt käigus oleva külastuse mustandist (kus hoiame AINULT
 * aegu) peab järjekord hoidma ka kliendi nime ja märkuse — muidu ei ole hiljem
 * midagi saata. Vahe on teadlik: mustand on mugavus, mille kadumine ei maksa
 * midagi; järjekord hoiab TEHTUD TÖÖD, mille kadumine tähendab tasustamata
 * tööd. Kirje kustutatakse seadmest kohe, kui server on ta vastu võtnud.
 *
 * PUHTAD FUNKTSIOONID, salvestus antakse sisse. Nii saab järjekorda testida
 * ilma brauserita ja `localStorage`-i puudumine (server-render) ei ole eriharu.
 *
 * `store` EI OLE `localStorage`, vaid KONTOGA SEOTUD salvestus
 * (`openDeviceStore`, SOL-SLOG-01). Ilma omanikuta on ta `null` ja siinne
 * olemasolev „salvestust ei ole" haru katab ta ära: järgmine konto ei loe ega
 * saada eelmise konto tehtud tööd.
 */

import { DEVICE_ROW } from "./deviceStore.js";

export const OUTBOX_ROW = DEVICE_ROW.OUTBOX;

/**
 * Ülempiir on olemas, sest ilma selleta kasvaks järjekord ühe katkise
 * sünkroonimise korral kuni salvestuskvoodi täitumiseni — ja siis ei saaks
 * seade enam MITTE MIDAGI salvestada, ka mitte uut kirjet.
 */
export const OUTBOX_LIMIT = 200;

function safeParse(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readOutbox(store) {
  if (!store) return [];
  try {
    return safeParse(store.getItem(OUTBOX_ROW)).filter(
      (item) => item && typeof item === "object" && typeof item.clientRequestId === "string"
    );
  } catch {
    return [];
  }
}

/**
 * TAGASTAB SELLE, MIS PÄRISELT SALVESTUS — mitte seda, mida taheti salvestada.
 *
 * Vahe on oluline just seal, kus salvestamine EI ÕNNESTU: kvoot täis,
 * privaatrežiim, server-render. Kui tagastaksime soovitud järjekorra, ütleks UI
 * kasutajale „kirje on ootel", kuigi seadmes ei ole midagi — ja kirje kaoks
 * vaikselt. Uuestilugemine maksab ühe JSON-parsimise ja teeb vastuse ausaks.
 */
function writeOutbox(store, items) {
  if (!store) return [];
  try {
    if (!items.length) store.removeItem(OUTBOX_ROW);
    else store.setItem(OUTBOX_ROW, JSON.stringify(items));
  } catch {
    /* Vaikimine on siin õige: kutsuja saab tegeliku seisu tagasi ja UI otsustab
       selle põhjal, mida kasutajale öelda. */
  }
  return readOutbox(store);
}

/**
 * @returns uus järjekord. Sama `clientRequestId` ASENDAB olemasoleva, mitte ei
 *   lisa teist rida — muidu tekitaks kaks korda vajutamine kaks saadetist.
 */
export function enqueue(store, item) {
  if (!item || typeof item.clientRequestId !== "string" || !item.clientRequestId) {
    return readOutbox(store);
  }
  const current = readOutbox(store).filter(
    (queued) => queued.clientRequestId !== item.clientRequestId
  );
  current.push(item);
  /* Vanim kukub välja, mitte uusim: uusim on see, mida kasutaja just tegi ja
     mille kadumist ta kohe märkaks. */
  const trimmed = current.slice(-OUTBOX_LIMIT);
  return writeOutbox(store, trimmed);
}

export function dequeue(store, clientRequestId) {
  const remaining = readOutbox(store).filter(
    (item) => item.clientRequestId !== clientRequestId
  );
  return writeOutbox(store, remaining);
}

export function outboxCount(store) {
  return readOutbox(store).length;
}

/**
 * Kas viga oli VÕRGU oma (proovi uuesti) või SERVERI oma (ära proovi uuesti)?
 *
 * See vahe on kogu järjekorra mõte. Võrguviga tähendab „me ei tea, kas jõudis"
 * → hoia alles. 4xx tähendab „server vaatas ja ütles ei" → kordamine annab
 * igavesti sama vastuse ja järjekord ei tühjeneks enam kunagi.
 *
 * 5xx on VÕRGUVEA moodi: server ei jõudnud otsuseni, seega uuesti proovimine
 * on mõttekas.
 */
export function shouldRetry({ networkError = false, status = 0 } = {}) {
  if (networkError) return true;
  if (status >= 500) return true;
  return false;
}
