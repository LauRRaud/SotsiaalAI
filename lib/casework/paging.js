/**
 * JUHTUM-V1 / JTA-V1 — loendipiiri ühine normaliseerija.
 *
 * MIKS ÜKS KOHT: sama rida oli seitsmes moodulis kopeeritud kujul
 *
 *     const take = Math.min(Math.max(Number(limit) || DEFAULT, 1), MAX);
 *
 * ja tal on kaks auku, mis mõlemad tulevad päringustringist:
 *
 *   1. **MURDARV JÕUAB PRISMASSE.** `?limit=1.5` annab `Number` → `1.5`,
 *      klambrid jätavad ta puutumata ja `take + 1` = `2.5`. Prisma lükkab
 *      murdarvulise `take` tagasi — tulemus on **kasutaja sisendist põhjustatud
 *      500**, mitte korrektne 400. Fake-prisma seda ei näinud, sest ta ei
 *      valideeri ühtegi argumenti.
 *   2. **RÄMPS LANGES VAIKSELT VAIKEVÄÄRTUSELE.** `?limit=abc` andis `NaN`, mis
 *      `||` kaudu kukkus vaikeväärtusele. Kasutaja küsis ühte asja ja sai
 *      teise, ilma et keegi seda ütleks.
 *
 * PUUDUV PIIR ON ERI ASI KUI VIGANE PIIR. Puuduv (`null`, `undefined`, `""`)
 * tähendab „vaikimisi" ja on täiesti korras; olemasolev aga peab olema
 * positiivne täisarv. Ülemine lagi klambritakse vaikselt — see ei ole viga,
 * vaid serveri kaitse.
 */

import { badRequest } from "./errors.js";

/**
 * @param {unknown} limit päringust tulnud toorväärtus
 * @param {{ fallback: number, max: number }} bounds
 * @returns {number} positiivne täisarv, kõige rohkem `max`
 */
export function normalizeLimit(limit, { fallback, max }) {
  if (limit === undefined || limit === null || limit === "") return fallback;

  const value = typeof limit === "string" ? Number(limit.trim()) : Number(limit);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    throw badRequest("casework.errors.limit_invalid");
  }
  return Math.min(value, max);
}

/**
 * @param {unknown} cursor
 * @returns {string|null}
 */
export function normalizeCursor(cursor) {
  return typeof cursor === "string" && cursor.trim() ? cursor.trim() : null;
}

/* ────────────────────────────────────────────────────────────────────────────
   LOENDI CURSOR (SOL-CW-20)
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * MIKS AINULT ID-ST EI PIISA.
 *
 * Juhtumiloend sordib `updatedAt DESC, id DESC`, aga cursorina liikus kliendile
 * **ainult rea ID**. Prisma `cursor: { id }` positsioneerib rea PRAEGUSE koha
 * järgi järjestuses — ja `updatedAt` on muutlik: juhtumi iga lapse kirjutus
 * puudutab vanemrida. Tagajärg on kaks vaikset viga, mõlemad just aktiivse töö
 * pinnal, kus `updatedAt` muutub kõige sagedamini:
 *
 *   · **KORDUS** — cursor-rida hüppab vahepeal loendi etteotsa, järgmine leht
 *     algab uuesti pea algusest ja sama juhtum tuleb teist korda.
 *   · **VAHELEJÄÄK** — mõni veel nägemata rida hüppab cursorist ETTE ja teda ei
 *     tule enam ühelegi lehele. Seda ei märka keegi: puuduv rida ei jäta jälge.
 *
 * LAHENDUS ON KAKS OSA, mitte üks:
 *
 *   1. **TÄIELIK SORTIMISVÕTI** `(updatedAt, id)` käib cursoriga kaasas ja
 *      järgmine leht on keyset-tingimus, mitte „leia see rida üles". Rea
 *      liikumine ei nihuta enam lehepiiri.
 *   2. **STABIILNE ÜLEMPIIR** — esimese lehe hetk. Ilma temata tuleks üles
 *      hüpanud rida hiljem uuesti (ta on nüüd `updatedAt` poolest ülalpool
 *      lehepiiri, aga keyset laseks ta läbi ainult siis, kui piiri ei ole).
 *      Ülempiir teeb lehitsemisest SNAPSHOT'i: mis pärast esimest lehte muutus
 *      või tekkis, tuleb nähtavale järgmisel värskendusel, mitte poole
 *      lehitsemise pealt.
 *
 * CURSOR ON LÄBIPAISTMATU. Klient ei koosta ega paranda teda; `v` väli lubab
 * tulevasel kujul vana cursori AUSALT tagasi lükata, mitte teda valesti lugeda.
 */
const CURSOR_VERSION = 1;

function toIso(value) {
  /* `new Date(null)` on EPOCH, mitte vigane kuupäev — puuduv väärtus libiseks
     ilma selle reata cursorisse kujul „1970-01-01" ja lehitsemine algaks
     vaikselt loendi lõpust. */
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

/**
 * @param {{ updatedAt: Date|string, id: string, boundary: Date|string }} key
 * @returns {string|null} läbipaistmatu cursor, või `null` kui võti on puudulik
 */
export function encodeListCursor({ updatedAt, id, boundary } = {}) {
  const sortStamp = toIso(updatedAt);
  const boundaryStamp = toIso(boundary);
  const rowId = typeof id === "string" ? id.trim() : "";
  if (!sortStamp || !boundaryStamp || !rowId) return null;

  return Buffer.from(
    JSON.stringify({ v: CURSOR_VERSION, u: sortStamp, i: rowId, b: boundaryStamp }),
    "utf8"
  ).toString("base64url");
}

/**
 * @param {unknown} raw
 * @returns {{ updatedAt: Date, id: string, boundary: Date }|null}
 * @throws 400 vigase cursori korral
 */
export function decodeListCursor(raw) {
  const value = normalizeCursor(raw);
  if (!value) return null;

  let parsed;
  try {
    /* `Buffer.from(..., "base64url")` EI VISKA rämpsu peale — ta annab lihtsalt
       baidid, mis `JSON.parse`-il kukuvad. Seepärast on `try` siin ainus värav. */
    parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw badRequest("casework.errors.cursor_invalid");
  }

  if (!parsed || parsed.v !== CURSOR_VERSION) throw badRequest("casework.errors.cursor_invalid");

  const updatedAt = new Date(parsed.u);
  const boundary = new Date(parsed.b);
  const id = typeof parsed.i === "string" ? parsed.i.trim() : "";
  if (!id || !Number.isFinite(updatedAt.getTime()) || !Number.isFinite(boundary.getTime())) {
    throw badRequest("casework.errors.cursor_invalid");
  }

  return { updatedAt, id, boundary };
}

/**
 * Keyset-tingimus `(updatedAt, id) < (cursor.updatedAt, cursor.id)` koos
 * stabiilse ülempiiriga. `DESC, DESC` järjestuse jaoks, seega „väiksem".
 */
export function listCursorWhere(cursor) {
  if (!cursor) return {};
  return {
    AND: [
      /* Ülempiir: mis pärast esimest lehte üles hüppas või juurde tekkis, ei
         tule lehitsemise keskele. */
      { updatedAt: { lte: cursor.boundary } },
      {
        OR: [
          { updatedAt: { lt: cursor.updatedAt } },
          { AND: [{ updatedAt: cursor.updatedAt }, { id: { lt: cursor.id } }] }
        ]
      }
    ]
  };
}
