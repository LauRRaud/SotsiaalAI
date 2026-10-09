/**
 * KODUTEENUS K1-d — kronoloogia dokument: iseseisev prinditav HTML-leht.
 *
 * MIKS ISESEISEV LEHT, mitte rakenduse vaade. Dokument peab trükis välja nägema
 * täpselt nii nagu ekraanil ja olema sõltumatu rakenduse raamist (taust, paneel,
 * navigatsioon). Brauseri „Prindi → Salvesta PDF-ina" teeb sellest PDF-i;
 * eraldi PDF-teeki platvormil ei ole.
 *
 * TURVE. Leht koosneb kasutajate kirjutatud tekstist ja serveeritakse rakenduse
 * päritolust, seega:
 *   1. IGA väärtus läbib `escapeHtml`-i; toorest teksti lehele ei panda;
 *   2. lehel ei ole ühtegi skripti ja dokument kannab ISE ranget sisuturbe
 *      poliitikat (`<meta http-equiv>`; `script-src` puudub), nii et ka vea
 *      korral ei käivitu midagi. Poliitika on dokumendi sees, sest rakenduse
 *      üldine päiste seadistus (`next.config.mjs`) asendab marsruudi pandud
 *      `Content-Security-Policy` päise oma väärtusega (mõõdetud brauseris), ja
 *      sest nii kehtib see ka kettale salvestatud failil;
 *   3. pealkirjas ei ole kliendi nime (vahelehe pealkiri jääb ajalukku).
 *
 * Puhas funktsioon: andmebaasi ei loe, kellaaega ei küsi.
 */

import { serverT } from "../i18n/serverMessages.js";
import { zonedParts } from "../time/estonianDay.js";

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDateTime(isoValue, timeZone) {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";
  const parts = zonedParts(date, timeZone);
  return `${pad(parts.day)}.${pad(parts.month)}.${parts.year} ${pad(parts.hour)}:${pad(parts.minute)}`;
}

/** AAAA-KK-PP → PP.KK.AAAA; muu kuju jääb nii, nagu on (ja läbib ikka `escapeHtml`-i). */
function formatDay(isoDay) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDay || ""));
  return match ? `${match[3]}.${match[2]}.${match[1]}` : String(isoDay || "");
}

/** Dokumendi enda poliitika. `frame-ancestors` meta-sildis ei kehti; selle annab rakenduse üldine päis. */
export const CHRONOLOGY_DOCUMENT_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'";

const STYLE = `
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
html { font-family: "Segoe UI", "Helvetica Neue", Arial, "Liberation Sans", sans-serif; font-size: 11pt; line-height: 1.45; color: #111; background: #fff; }
body { margin: 0 auto; padding: 24px 16px 48px; max-width: 190mm; }
h1 { font-size: 20pt; margin: 0 0 4pt; }
h2 { font-size: 13pt; margin: 18pt 0 6pt; }
.org { font-size: 11pt; color: #444; margin: 0 0 18pt; }
.hint { border: 1px solid #999; border-radius: 6px; padding: 8px 12px; margin: 0 0 20px; font-size: 10pt; color: #333; }
table { border-collapse: collapse; width: 100%; margin: 0 0 12pt; }
th, td { text-align: left; vertical-align: top; padding: 4pt 6pt; border-bottom: 1px solid #bbb; }
th { width: 34%; font-weight: 600; }
.hash { font-family: Consolas, "Courier New", monospace; font-size: 9pt; overflow-wrap: anywhere; }
.summary, .text { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; }
.note { font-size: 9.5pt; color: #333; margin: 10pt 0 0; }
.cover { break-after: page; page-break-after: always; }
.entry { break-inside: avoid; page-break-inside: avoid; padding: 8pt 0; border-bottom: 1px solid #ccc; }
.entry-head { font-weight: 600; margin: 0 0 3pt; }
.entry-meta { font-size: 9.5pt; color: #333; margin: 3pt 0 0; }
@media print { .hint { display: none; } body { padding: 0; max-width: none; } }
`;

/**
 * @param {{ release: object, items: Array<object>, organization: object, locale?: string }} input
 * @returns {string} terviklik HTML-dokument
 */
export function renderChronologyHtml({ release, items, organization, locale }) {
  const lang = locale || organization?.defaultLocale || "et";
  const timeZone = organization?.timezone || "Europe/Tallinn";
  const t = (key, values) => serverT(lang, `home_care.chronology.doc.${key}`, values, key);
  const kindLabel = (kind) => serverT(lang, `home_care.entry.kinds.${kind}`, null, kind);
  const contactLabel = (mode) => serverT(lang, `home_care.entry.contact.${mode}`, null, mode);
  const incidentLabel = (type) => serverT(lang, `home_care.incident.types.${type}`, null, type);

  const row = (label, value, className = "") =>
    value
      ? `<tr><th scope="row">${escapeHtml(label)}</th><td${className ? ` class="${className}"` : ""}>${escapeHtml(value)}</td></tr>`
      : "";

  const cover = [
    `<section class="cover">`,
    `<p class="org">${escapeHtml(organization?.legalName || organization?.displayName || "")}</p>`,
    `<h1>${escapeHtml(t("title"))}</h1>`,
    `<table>`,
    row(t("client"), release.clientName),
    row(t("period"), `${formatDay(release.periodFromDay)} – ${formatDay(release.periodToDay)}`),
    row(t("requester"), release.requester),
    row(t("basis"), release.basis),
    row(t("registry_ref"), release.registryRef),
    row(t("compiled_by"), release.createdByName),
    row(t("compiled_at"), formatDateTime(release.createdAt, timeZone)),
    row(t("entry_count"), String(release.entryCount)),
    row(t("content_hash"), release.contentSha256, "hash"),
    `</table>`,
    release.summary ? `<h2>${escapeHtml(t("summary"))}</h2><p class="summary">${escapeHtml(release.summary)}</p>` : "",
    `<p class="note">${escapeHtml(t("privacy_note"))}</p>`,
    `<p class="note">${escapeHtml(t("scope_note"))}</p>`,
    `</section>`
  ].join("");

  const entries = items
    .map((item) => {
      const head = [formatDateTime(item.occurredAt, timeZone), item.authorName, kindLabel(item.kind)];
      if (item.incidentType) head.push(incidentLabel(item.incidentType));
      const meta = [contactLabel(item.contactMode)];
      if (item.redacted) meta.push(t("redacted"));
      return [
        `<article class="entry">`,
        `<p class="entry-head">${escapeHtml(`${item.position}. ${head.filter(Boolean).join(" · ")}`)}</p>`,
        `<p class="text">${escapeHtml(item.text)}</p>`,
        `<p class="entry-meta">${escapeHtml(meta.filter(Boolean).join(" · "))}</p>`,
        `</article>`
      ].join("");
    })
    .join("");

  return [
    `<!doctype html>`,
    `<html lang="${escapeHtml(lang)}">`,
    `<head>`,
    `<meta charset="utf-8">`,
    /* Enne kõike muud, et poliitika kehtiks kogu ülejäänud dokumendile. */
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
    cover,
    `<section><h2>${escapeHtml(t("entries_title"))}</h2>${entries}</section>`,
    `</body>`,
    `</html>`
  ].join("\n");
}

/**
 * Päised dokumendi vastusele: vahemällu ei jäeta, sisutüüpi ei arvata.
 * `Content-Security-Policy` ja `Referrer-Policy` on siin teise kihina: meie
 * serveris asendab need rakenduse üldine päiste seadistus (raami keeld jääb),
 * siduv poliitika on dokumendi sees (`CHRONOLOGY_DOCUMENT_CSP`).
 */
export const CHRONOLOGY_DOCUMENT_HEADERS = Object.freeze({
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": `${CHRONOLOGY_DOCUMENT_CSP}; frame-ancestors 'none'`,
  "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
});
