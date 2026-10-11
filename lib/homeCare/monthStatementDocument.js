/**
 * KODUTEENUS K6-e — kliendi kuuleht (kava II.6.9): iseseisev prinditav HTML-dokument.
 *
 * Üks A4 suure kirjaga kliendi kohta: mis päevadel käisime, kui kaua, kes käis ja mis käigud
 * jäid ära. Leht on kirjutatud kliendile („käisime teie juures"), mitte asutusele, ja lõpeb
 * telefoninumbriga: kui see ei klapi sellega, mida inimene mäletab, helistab ta asutusse.
 * Leht on TEATAVAKS TEGEMINE, mitte allkirjastamine, ja ütleb seda ise.
 *
 * Lehel on käigu kuupäev, kestus ja hooldaja EESNIMI. Päeviku teksti, tehtud toiminguid ega
 * erijuhtumi sisu lehel ei ole: need ei ole kokkuvõtte osa ja leht jääb kliendi koju, kus
 * seda näevad ka külalised.
 *
 * Mitu klienti on ühes dokumendis, igaüks eraldi lehel. Sama põhimõte mis külmkapilehel:
 * ilma skriptideta, range sisuturbe poliitika dokumendi sees. Puhas funktsioon.
 */

import { serverT } from "../i18n/serverMessages.js";

import { CHRONOLOGY_DOCUMENT_CSP, escapeHtml } from "./chronologyDocument.js";
import { firstName } from "./fridgeSheetDocument.js";

/** Nii paljude käikude järel läheb käikude loend kahte veergu, et kuu mahuks ühele lehele. */
const TWO_COLUMNS_FROM = 14;

const STYLE = `
@page { size: A4; margin: 15mm; }
* { box-sizing: border-box; }
html { font-family: "Segoe UI", "Helvetica Neue", Arial, "Liberation Sans", sans-serif; font-size: 14pt; line-height: 1.4; color: #111; background: #fff; }
body { margin: 0 auto; padding: 24px 16px 48px; max-width: 180mm; }
.hint { border: 1px solid #999; border-radius: 6px; padding: 8px 12px; margin: 0 0 12px; font-size: 10pt; color: #333; }
.sheet { break-after: page; page-break-after: always; padding: 0 0 12mm; }
.sheet:last-child { break-after: auto; page-break-after: auto; }
.org { font-size: 11pt; color: #333; margin: 0 0 2mm; }
h1 { font-size: 22pt; margin: 0 0 2mm; }
.name { font-size: 16pt; font-weight: 600; margin: 0 0 5mm; }
.sum { font-size: 16pt; margin: 0 0 2mm; }
.note { font-size: 12pt; color: #333; margin: 0 0 2mm; }
h2 { font-size: 15pt; margin: 6mm 0 2mm; }
ul { margin: 0; padding: 0; list-style: none; }
ul.many { columns: 2; column-gap: 10mm; }
li { padding: 1mm 0; border-bottom: 1px solid #ddd; break-inside: avoid; }
.day { font-weight: 600; }
.call { font-size: 18pt; font-weight: 600; margin: 2mm 0 0; }
.blank { display: inline-block; min-width: 70mm; border-bottom: 2px solid #111; }
.foot { font-size: 11pt; color: #333; margin: 8mm 0 0; }
@media print { .hint { display: none; } body { padding: 0; } .sheet { padding: 0; } }
`;

/** Nädalapäev 1 (esmaspäev) kuni 7 (pühapäev) päevast kujul `AAAA-KK-PP`. Puhas funktsioon. */
export function weekdayOf(day) {
  const [year, month, date] = String(day).split("-").map(Number);
  return ((new Date(Date.UTC(year, month - 1, date)).getUTCDay() + 6) % 7) + 1;
}

/** Päev kujul „02.09" (aasta on lehe pealkirjas). */
export function shortDay(day) {
  const [, month, date] = String(day).split("-");
  return `${date}.${month}`;
}

/** Kuu nimi aastaga lehe keeles, näiteks „september 2026". */
export function monthLabel(month, locale) {
  const [year, number] = String(month).split("-").map(Number);
  return new Intl.DateTimeFormat(locale || "et", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, number - 1, 1)));
}

/** Kestus inimesele: „45 min", „2 t", „1 t 15 min". `t` on dokumendi tõlkefunktsioon. */
export function durationText(t, minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return t("duration_m", { minutes: rest });
  return rest ? t("duration_hm", { hours, minutes: rest }) : t("duration_h", { hours });
}

/** Käikude arv, minutid kokku ja mitu käiku on kestuseta. Puhas funktsioon. */
export function statementTotals(visits) {
  let minutes = 0;
  let withoutLength = 0;
  for (const visit of visits || []) {
    if (visit.minutes === null || visit.minutes === undefined) withoutLength += 1;
    else minutes += visit.minutes;
  }
  return { count: (visits || []).length, minutes, withoutLength };
}

/**
 * @param {{ organizationName: string, month: string, phone: string|null, composedOn: string, locale?: string,
 *   statements: Array<{ clientName: string, visits: Array<{ day: string, minutes: number|null, workerName: string|null }>, notHappened: Array<{ day: string, reason: string }> }> }} input
 * @returns {string} terviklik HTML-dokument
 */
export function renderMonthStatementsHtml({ organizationName, month, phone, composedOn, locale, statements }) {
  const lang = locale || "et";
  const t = (key, values) => serverT(lang, `home_care.statement.doc.${key}`, values || null, key);
  const weekday = (day) => serverT(lang, `home_care.slots.weekdays_long.${weekdayOf(day)}`, null, "");
  const title = t("title", { month: monthLabel(month, lang) });

  const sheet = (statement) => {
    const totals = statementTotals(statement.visits);
    const visitRows = statement.visits.map(
      (visit) =>
        `<li><span class="day">${escapeHtml(`${weekday(visit.day)}, ${shortDay(visit.day)}`)}</span> · ${escapeHtml(
          visit.minutes === null || visit.minutes === undefined ? t("no_length") : durationText(t, visit.minutes)
        )}${visit.workerName ? ` · ${escapeHtml(firstName(visit.workerName))}` : ""}</li>`
    );
    const missedRows = statement.notHappened.map(
      (row) => `<li><span class="day">${escapeHtml(`${weekday(row.day)}, ${shortDay(row.day)}`)}</span> · ${escapeHtml(t(`reasons.${row.reason}`))}</li>`
    );
    /* Kui ühegi käigu kestust ei ole kirjas, ei ütle leht „kokku 0 min": ainult mitu korda käidi. */
    const summary = !totals.count
      ? t("summary_none")
      : totals.withoutLength === totals.count
        ? t("summary_count", { count: totals.count })
        : t("summary", { count: totals.count, duration: durationText(t, totals.minutes) });
    return [
      `<section class="sheet">`,
      `<p class="org">${escapeHtml(organizationName || "")}</p>`,
      `<h1>${escapeHtml(title)}</h1>`,
      `<p class="name">${escapeHtml(statement.clientName || "")}</p>`,
      `<p class="sum">${escapeHtml(summary)}</p>`,
      totals.withoutLength ? `<p class="note">${escapeHtml(t("without_length", { count: totals.withoutLength }))}</p>` : "",
      visitRows.length ? `<h2>${escapeHtml(t("visits_title"))}</h2><ul${visitRows.length >= TWO_COLUMNS_FROM ? ' class="many"' : ""}>${visitRows.join("")}</ul>` : "",
      missedRows.length ? `<h2>${escapeHtml(t("not_happened_title"))}</h2><ul>${missedRows.join("")}</ul>` : "",
      `<h2>${escapeHtml(t("call_title"))}</h2>`,
      `<p class="call">${phone ? escapeHtml(phone) : `<span class="blank">&nbsp;</span>`}</p>`,
      `<p class="foot">${escapeHtml(t("foot", { date: composedOn }))}</p>`,
      `</section>`
    ]
      .filter(Boolean)
      .join("\n");
  };

  return [
    `<!doctype html>`,
    `<html lang="${escapeHtml(lang)}">`,
    `<head>`,
    `<meta charset="utf-8">`,
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(CHRONOLOGY_DOCUMENT_CSP)}">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<meta name="robots" content="noindex, nofollow, noarchive">`,
    `<meta name="referrer" content="no-referrer">`,
    /* Pealkirjas EI OLE kliendi nime: see jääb brauseri ajalukku ja akna tiitlisse. */
    `<title>${escapeHtml(title)}</title>`,
    `<style>${STYLE}</style>`,
    `</head>`,
    `<body>`,
    `<p class="hint">${escapeHtml(t("print_hint"))}</p>`,
    ...statements.map(sheet),
    `</body>`,
    `</html>`
  ].join("\n");
}
