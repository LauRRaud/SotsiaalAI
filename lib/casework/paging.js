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
