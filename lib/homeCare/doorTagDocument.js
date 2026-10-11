/**
 * KODUTEENUS K1-g — uksesildi prinditav dokument: iseseisev HTML-leht.
 *
 * Sama põhimõte mis kronoloogia dokumendil (`chronologyDocument.js`): leht
 * peab trükis välja nägema nagu ekraanil ja olema rakenduse raamist sõltumatu;
 * brauseri „Prindi" teeb sellest paberi või PDF-i. Lehel ei ole skripte ja see
 * kannab ranget sisuturbe poliitikat enda sees.
 *
 * SILDIL EI OLE KLIENDI NIME. Silt ripub kliendi kodus ukse kõrval ja seda
 * näevad ka külalised. Sildil on kood, asutuse nimi ja lause, mida see teeb.
 * Nimi on ainult dokumendi lõikejoonest VÄLJASPOOL oleval real, et hooldusjuht
 * teaks, kellele silt viia; see rida lõigatakse ära.
 *
 * Puhas funktsioon: andmebaasi ei loe.
 */

import { serverT } from "../i18n/serverMessages.js";

import { CHRONOLOGY_DOCUMENT_CSP, escapeHtml } from "./chronologyDocument.js";

const STYLE = `
@page { size: A4; margin: 15mm; }
* { box-sizing: border-box; }
html { font-family: "Segoe UI", "Helvetica Neue", Arial, "Liberation Sans", sans-serif; font-size: 11pt; line-height: 1.4; color: #111; background: #fff; }
body { margin: 0 auto; padding: 24px 16px 48px; max-width: 120mm; }
.hint { border: 1px solid #999; border-radius: 6px; padding: 8px 12px; margin: 0 0 16px; font-size: 10pt; color: #333; }
.for { font-size: 10pt; color: #333; margin: 0 0 6mm; }
.tag { width: 90mm; margin: 0 auto; padding: 6mm; border: 1px dashed #777; text-align: center; break-inside: avoid; page-break-inside: avoid; }
.tag svg { display: block; width: 70mm; height: 70mm; margin: 0 auto 4mm; }
.org { font-size: 12pt; font-weight: 600; margin: 0 0 2mm; }
.what { font-size: 10pt; margin: 0 0 2mm; }
.safe { font-size: 8.5pt; color: #333; margin: 0; }
@media print { .hint { display: none; } body { padding: 0; } }
`;

/**
 * @param {{ tag: { qr: { d: string, side: number } }, clientName: string, organization: object, locale?: string }} input
 * @returns {string} terviklik HTML-dokument
 */
export function renderDoorTagHtml({ tag, clientName, organization, locale }) {
  const lang = locale || organization?.defaultLocale || "et";
  const t = (key) => serverT(lang, `home_care.door_tag.doc.${key}`, null, key);
  const side = Number(tag?.qr?.side) || 0;
  /* Teekond tuleb meie enda kodeerijast (ainult M, h, v, z, arvud, koma ja miinus); laseme läbi ainult need märgid. */
  const path = String(tag?.qr?.d || "").replace(/[^Mhvz0-9,-]/g, "");

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
    `<section class="tag">`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges" role="img" aria-label="${escapeHtml(t("qr_label"))}">`,
    `<rect width="${side}" height="${side}" fill="#fff"/>`,
    `<path d="${path}" fill="#000"/>`,
    `</svg>`,
    `<p class="org">${escapeHtml(organization?.displayName || "")}</p>`,
    `<p class="what">${escapeHtml(t("what"))}</p>`,
    `<p class="safe">${escapeHtml(t("safe"))}</p>`,
    `</section>`,
    `</body>`,
    `</html>`
  ].join("\n");
}
