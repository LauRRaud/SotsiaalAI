/**
 * KODUTEENUS K5-t — päevaleht paberil (kava II.6.15 ja II.6.12): iseseisev prinditav HTML-leht.
 *
 * Kriisis ei pruugi rakendus, side ega elekter töötada, ja tavalisel päeval võib telefon
 * katki minna. Hooldusjuht prindib töötaja päeva: käigud kellaajaga, kliendi nimi, aadress ja
 * telefon, „enne kui lähed" read, võti, kava toimingud märkeruutudega ja koht kestuse ning
 * märkuste jaoks. Töötaja kannab tehtu hiljem päevikusse.
 *
 * Leht kannab isikuandmeid ja selle peal on öeldud, mida sellega pärast teha. Sama põhimõte
 * mis teistel dokumentidel: rakenduse raamist sõltumatu, skriptideta, range sisuturbe
 * poliitika enda sees. Iga töötaja leht algab uuelt lehelt. Puhas funktsioon.
 */

import { serverT } from "../i18n/serverMessages.js";

import { CHRONOLOGY_DOCUMENT_CSP, escapeHtml } from "./chronologyDocument.js";
import { clockText } from "./fridgeSheetDocument.js";

const STYLE = `
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; }
html { font-family: "Segoe UI", "Helvetica Neue", Arial, "Liberation Sans", sans-serif; font-size: 11pt; line-height: 1.35; color: #111; background: #fff; }
body { margin: 0 auto; padding: 24px 16px 48px; max-width: 186mm; }
.hint { border: 1px solid #999; border-radius: 6px; padding: 8px 12px; margin: 0 0 12px; font-size: 10pt; color: #333; }
.sheet { page-break-after: always; break-after: page; }
.sheet:last-child { page-break-after: auto; break-after: auto; }
h1 { font-size: 16pt; margin: 0 0 1mm; }
.sub { font-size: 10pt; color: #333; margin: 0 0 4mm; }
.visit { border: 1px solid #777; border-radius: 4px; padding: 3mm 4mm; margin: 0 0 4mm; page-break-inside: avoid; break-inside: avoid; }
.when { font-size: 13pt; font-weight: 600; }
.who { font-size: 13pt; font-weight: 600; }
.line { margin: 1mm 0 0; }
.label { font-weight: 600; }
ul { margin: 1mm 0 0; padding: 0; list-style: none; }
li { padding: 0.5mm 0; }
.box { display: inline-block; width: 3.6mm; height: 3.6mm; border: 1px solid #111; margin: 0 2mm 0 0; vertical-align: -0.5mm; }
.write { margin: 3mm 0 0; }
.blank { display: inline-block; min-width: 28mm; border-bottom: 1px solid #111; }
.blank--wide { display: block; min-width: 0; height: 7mm; border-bottom: 1px solid #111; }
.foot { font-size: 9pt; color: #333; margin: 4mm 0 0; }
@media print { .hint { display: none; } body { padding: 0; } }
`;

/** Päev kujul PP.KK.AAAA. */
function dayLabel(day) {
  const [year, month, date] = String(day || "").split("-");
  return year && month && date ? `${date}.${month}.${year}` : "";
}

/**
 * @param {{ organizationName: string, day: string, weekday: number, sheets: Array<{ workerName: string|null, visits: Array<object> }>, locale?: string }} input
 *   Käigu väljad: `startMinute`, `plannedMinutes`, `clientName`, `address`, `phone`, `priority`, `note`,
 *   `key` ({ held, holders, office } või null), `cardLines` ([{ kind, text }]), `activities` ([string]), `medication` (boolean).
 * @returns {string} terviklik HTML-dokument
 */
export function renderDaySheetHtml({ organizationName, day, weekday, sheets, locale }) {
  const lang = locale || "et";
  const t = (key, values) => serverT(lang, `home_care.day_sheet.doc.${key}`, values || null, key);
  const weekdayName = serverT(lang, `home_care.slots.weekdays_long.${weekday}`, null, String(weekday));
  const keyLine = (key) => {
    if (!key) return "";
    if (key.held) return t("key_with_you");
    const places = [...(key.holders || []).map((name) => serverT(lang, "home_care.keys.held_by", { name })), ...(key.office ? [serverT(lang, "home_care.keys.in_office")] : [])];
    return places.length ? t("key_elsewhere", { where: places.join(", ") }) : "";
  };

  const visitBlock = (visit) => {
    const cardRows = (visit.cardLines || []).map(
      (line) => `<li><span class="label">${escapeHtml(serverT(lang, `home_care.card.kinds.${line.kind}`, null, line.kind))}:</span> ${escapeHtml(line.text)}</li>`
    );
    const activityRows = (visit.activities || []).map((name) => `<li><span class="box"></span>${escapeHtml(name)}</li>`);
    const key = keyLine(visit.key);
    return [
      `<div class="visit">`,
      `<div><span class="when">${escapeHtml(t("time", { from: clockText(visit.startMinute), to: clockText(visit.startMinute + visit.plannedMinutes) }))}</span> · <span class="who">${escapeHtml(visit.clientName || "")}</span>${
        visit.priority ? ` · ${escapeHtml(t("priority", { priority: visit.priority }))}` : ""
      }</div>`,
      visit.address ? `<p class="line">${escapeHtml(visit.address)}</p>` : "",
      visit.phone ? `<p class="line"><span class="label">${escapeHtml(t("phone"))}</span> ${escapeHtml(visit.phone)}</p>` : "",
      key ? `<p class="line">${escapeHtml(key)}</p>` : "",
      visit.note ? `<p class="line"><span class="label">${escapeHtml(t("note"))}</span> ${escapeHtml(visit.note)}</p>` : "",
      visit.medication ? `<p class="line"><span class="label">${escapeHtml(t("medication"))}</span></p>` : "",
      cardRows.length ? `<p class="line"><span class="label">${escapeHtml(t("card_title"))}</span></p><ul>${cardRows.join("")}</ul>` : "",
      activityRows.length ? `<p class="line"><span class="label">${escapeHtml(t("activities_title"))}</span></p><ul>${activityRows.join("")}</ul>` : "",
      `<p class="write">${escapeHtml(t("arrived"))} <span class="blank">&nbsp;</span> ${escapeHtml(t("minutes"))} <span class="blank">&nbsp;</span></p>`,
      `<p class="write">${escapeHtml(t("remarks"))}</p><span class="blank blank--wide">&nbsp;</span><span class="blank blank--wide">&nbsp;</span>`,
      `</div>`
    ]
      .filter(Boolean)
      .join("\n");
  };

  const sheetBlock = (sheet) =>
    [
      `<section class="sheet">`,
      `<h1>${escapeHtml(sheet.workerName || t("unassigned"))}</h1>`,
      `<p class="sub">${escapeHtml(weekdayName)} ${escapeHtml(dayLabel(day))} · ${escapeHtml(organizationName || "")} · ${escapeHtml(t("visits", { count: sheet.visits.length }))}</p>`,
      ...sheet.visits.map(visitBlock),
      `<p class="foot">${escapeHtml(t("foot"))}</p>`,
      `</section>`
    ].join("\n");

  return [
    `<!doctype html>`,
    `<html lang="${escapeHtml(lang)}">`,
    `<head>`,
    `<meta charset="utf-8">`,
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(CHRONOLOGY_DOCUMENT_CSP)}">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<meta name="robots" content="noindex, nofollow, noarchive">`,
    `<meta name="referrer" content="no-referrer">`,
    /* Pealkirjas EI OLE töötaja ega kliendi nime. */
    `<title>${escapeHtml(t("title"))}</title>`,
    `<style>${STYLE}</style>`,
    `</head>`,
    `<body>`,
    `<p class="hint">${escapeHtml(t("print_hint"))}</p>`,
    ...sheets.map(sheetBlock),
    `</body>`,
    `</html>`
  ].join("\n");
}
