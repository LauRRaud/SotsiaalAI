/**
 * KODUTEENUS K1-f — imporditud ajaloo tükeldamine.
 *
 * Kliendi senine päevik (näiteks Drive'i dokument) tuuakse üle ÜHE tekstina.
 * Tekstist ei tuletata fakte: ei kuupäevi, ei autoreid, ei kirjete piire. Tekst
 * jagatakse lõikudeks ainult selleks, et seda saaks lehekülgede kaupa näidata
 * ja otsing leiaks õige koha üles.
 *
 * LÕIGE on üks või mitu järjestikust tekstilõiku (tühja reaga eraldatud), kokku
 * umbes sihtpikkuseni. Väga pikk lõik (dokument ilma tühjade ridadeta) lõigatakse
 * reavahetuse või lause lõpu kohalt. Midagi ei jäeta välja ega muudeta: lõikude
 * järjestus on teksti järjestus.
 */

import { createHash } from "node:crypto";

import { HISTORY_BLOCK_MAX, HISTORY_BLOCK_TARGET } from "./historyLimits.js";

export { HISTORY_BLOCK_MAX, HISTORY_BLOCK_TARGET, HISTORY_MAX_CHARS, HISTORY_TITLE_MAX } from "./historyLimits.js";

const NUL = String.fromCharCode(0);

/** Reavahetused ühtseks, reaalguse ja -lõpu tühikud ära, NUL-märk välja. */
export function normalizeHistoryText(rawText) {
  return String(rawText ?? "")
    .split(NUL)
    .join("")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function cutLong(paragraph) {
  if (paragraph.length <= HISTORY_BLOCK_MAX) return [paragraph];
  const pieces = [];
  let rest = paragraph;
  while (rest.length > HISTORY_BLOCK_MAX) {
    const window = rest.slice(0, HISTORY_BLOCK_MAX);
    const half = HISTORY_BLOCK_MAX / 2;
    /* Eelistus: reavahetus, lause lõpp, tühik; alles siis sõna keskelt. */
    let cut = window.lastIndexOf("\n");
    if (cut < half) cut = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
    if (cut < half) cut = window.lastIndexOf(" ");
    if (cut < half) cut = HISTORY_BLOCK_MAX - 1;
    pieces.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) pieces.push(rest);
  return pieces;
}

/** Tekst lõikudeks. Tühi tekst annab tühja loendi. */
export function splitHistoryText(rawText) {
  const text = normalizeHistoryText(rawText);
  if (!text) return [];
  const pieces = [];
  for (const paragraph of text.split(/\n{2,}/)) {
    const trimmed = paragraph.trim();
    if (trimmed) pieces.push(...cutLong(trimmed));
  }
  const blocks = [];
  let current = "";
  for (const piece of pieces) {
    if (!current) current = piece;
    else if (current.length + 2 + piece.length <= HISTORY_BLOCK_TARGET) current = `${current}\n\n${piece}`;
    else {
      blocks.push(current);
      current = piece;
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

/** Sama tekst annab sama räsi: sama dokumendi teine ületoomine tuntakse ära. */
export function historyContentHash(blocks) {
  return createHash("sha256").update(blocks.join("\n\n"), "utf8").digest("hex");
}
