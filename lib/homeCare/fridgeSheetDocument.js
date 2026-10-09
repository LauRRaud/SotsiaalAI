/**
 * KODUTEENUS K5-g — külmkapileht (kava II.6.8): iseseisev prinditav HTML-leht.
 *
 * Kliendil ei ole ekraani ja osa lähedasi on ise eakad. Üks A4 suure kirjaga ütleb: kes
 * ja mis päeval tuleb, mida koos teeme, kuhu helistada ja mis ajast leht kehtib. Leht
 * ripub kliendi kodus, kus seda näevad ka külalised, seepärast on sellel hooldaja EESNIMI
 * (mitte perekonnanimi ega telefon) ja kliendi nime ei ole: nimi on ainult äralõigataval
 * real lehe ülaosas, et hooldusjuht teaks, kellele leht viia.
 *
 * Sama põhimõte mis uksesildi dokumendil: leht on rakenduse raamist sõltumatu, ilma
 * skriptideta ja kannab ranget sisuturbe poliitikat enda sees. Puhas funktsioon.
 */

import { serverT } from "../i18n/serverMessages.js";

import { CHRONOLOGY_DOCUMENT_CSP, escapeHtml } from "./chronologyDocument.js";

const STYLE = `
@page { size: A4; margin: 15mm; }
* { box-sizing: border-box; }
html { font-family: "Segoe UI", "Helvetica Neue", Arial, "Liberation Sans", sans-serif; font-size: 16pt; line-height: 1.45; color: #111; background: #fff; }
body { margin: 0 auto; padding: 24px 16px 48px; max-width: 180mm; }
.hint { border: 1px solid #999; border-radius: 6px; padding: 8px 12px; margin: 0 0 12px; font-size: 10pt; color: #333; }
.for { font-size: 10pt; color: #333; margin: 0 0 4mm; padding: 0 0 4mm; border-bottom: 1px dashed #777; }
h1 { font-size: 26pt; margin: 0 0 6mm; }
h2 { font-size: 19pt; margin: 8mm 0 3mm; }
ul { margin: 0; padding: 0; list-style: none; }
li { padding: 2mm 0; border-bottom: 1px solid #ddd; }
.day { font-weight: 600; }
.call { font-size: 20pt; font-weight: 600; margin: 2mm 0 0; }
.blank { display: inline-block; min-width: 70mm; border-bottom: 2px solid #111; }
.foot { font-size: 12pt; color: #333; margin: 10mm 0 0; }
@media print { .hint { display: none; } body { padding: 0; } }
`;

/** Eesnimi täisnimest: esimene sõna. Tühja nime korral tühi. */
export function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

/** Kellaaeg kujul „9.00" minutitest alates keskööst. */
export function clockText(minutes) {
  const value = ((minutes % 1440) + 1440) % 1440;
  return `${Math.floor(value / 60)}.${String(value % 60).padStart(2, "0")}`;
}

/**
 * @param {{ clientName: string, organizationName: string, visits: Array<{ weekday: number, startMinute: number, plannedMinutes: number, workerName: string|null }>, activities: string[], phone: string|null, validFrom: string, locale?: string }} input
 * @returns {string} terviklik HTML-dokument
 */
export function renderFridgeSheetHtml({ clientName, organizationName, visits, activities, phone, validFrom, locale }) {
  const lang = locale || "et";
  const t = (key, values) => serverT(lang, `home_care.fridge.doc.${key}`, values || null, key);
  const weekday = (number) => serverT(lang, `home_care.slots.weekdays_long.${number}`, null, String(number));
  const visitRows = visits.map(
    (visit) =>
      `<li><span class="day">${escapeHtml(weekday(visit.weekday))}</span> ${escapeHtml(
        t("time", { from: clockText(visit.startMinute), to: clockText(visit.startMinute + visit.plannedMinutes) })
      )} · ${escapeHtml(firstName(visit.workerName) || t("worker_unknown"))}</li>`
  );
  const activityRows = activities.map((name) => `<li>${escapeHtml(name)}</li>`);

  return [
    `<!doctype html>`,
    `<html lang="${escapeHtml(lang)}">`,
    `<head>`,
    `<meta charset="utf-8">`,
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(CHRONOLOGY_DOCUMENT_CSP)}">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<meta name="robots" content="noindex, nofollow, noarchive">`,
    `<meta name="referrer" content="no-referrer">`,
    /* Pealkirjas EI OLE kliendi nime. */
    `<title>${escapeHtml(t("title"))}</title>`,
    `<style>${STYLE}</style>`,
    `</head>`,
    `<body>`,
    `<p class="hint">${escapeHtml(t("print_hint"))}</p>`,
    `<p class="for">${escapeHtml(t("for_client"))} ${escapeHtml(clientName || "")}</p>`,
    `<h1>${escapeHtml(t("title"))}</h1>`,
    `<h2>${escapeHtml(t("who_title"))}</h2>`,
    visitRows.length ? `<ul>${visitRows.join("")}</ul>` : `<p>${escapeHtml(t("no_visits"))}</p>`,
    `<h2>${escapeHtml(t("what_title"))}</h2>`,
    activityRows.length ? `<ul>${activityRows.join("")}</ul>` : `<p>${escapeHtml(t("no_plan"))}</p>`,
    `<h2>${escapeHtml(t("call_title"))}</h2>`,
    `<p class="call">${phone ? escapeHtml(phone) : `<span class="blank">&nbsp;</span>`}</p>`,
    `<p class="foot">${escapeHtml(organizationName || "")} · ${escapeHtml(t("valid_from", { date: validFrom }))}</p>`,
    `</body>`,
    `</html>`
  ].join("\n");
}
