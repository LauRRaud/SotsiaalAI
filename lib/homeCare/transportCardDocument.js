/**
 * KODUTEENUS K5-y — transpordikaart (kava II.6.14, variant A): iseseisev prinditav HTML-leht.
 *
 * Autojuht ei ole platvormi kasutaja. Et ta teaks, kuidas klient autoni saab, prindib
 * hooldusjuht või kliendi meeskonna liige transpordi korraldajale ühe lehe: kliendi nimi,
 * aadress ja telefon, need püsikaardi read, mille juures on märge „nähtav autojuhile"
 * (liikumisabi, kes avab ukse, kellele helistada), ja eesolevad sõidud. MUUD KAARDI READ
 * (ohud, kokkulepped, häirenupp) LEHELE EI LÄHE: autojuht näeb ainult seda, mis on talle
 * märgitud.
 *
 * Sama põhimõte mis teistel dokumentidel: rakenduse raamist sõltumatu, skriptideta, range
 * sisuturbe poliitika enda sees. Puhas funktsioon.
 */

import { serverT } from "../i18n/serverMessages.js";

import { CHRONOLOGY_DOCUMENT_CSP, escapeHtml } from "./chronologyDocument.js";

const STYLE = `
@page { size: A4; margin: 15mm; }
* { box-sizing: border-box; }
html { font-family: "Segoe UI", "Helvetica Neue", Arial, "Liberation Sans", sans-serif; font-size: 13pt; line-height: 1.45; color: #111; background: #fff; }
body { margin: 0 auto; padding: 24px 16px 48px; max-width: 180mm; }
.hint { border: 1px solid #999; border-radius: 6px; padding: 8px 12px; margin: 0 0 12px; font-size: 10pt; color: #333; }
h1 { font-size: 20pt; margin: 0 0 2mm; }
h2 { font-size: 15pt; margin: 7mm 0 2mm; }
.who { font-size: 17pt; font-weight: 600; margin: 0; }
.line { margin: 1mm 0 0; }
ul { margin: 0; padding: 0; list-style: none; }
li { padding: 2mm 0; border-bottom: 1px solid #ddd; }
.label { font-weight: 600; }
.foot { font-size: 10pt; color: #333; margin: 9mm 0 0; }
@media print { .hint { display: none; } body { padding: 0; } }
`;

/** Päev kujul PP.KK.AAAA. */
function dayLabel(day) {
  const [year, month, date] = String(day || "").split("-");
  return year && month && date ? `${date}.${month}.${year}` : "";
}

/**
 * @param {{ clientName: string, address: string|null, phone: string|null, organizationName: string, lines: string[], rides: Array<{ wantedOn: string, time: string|null, destination: string, needs: string|null, arranged: boolean }>, issuedOn: string, locale?: string }} input
 * @returns {string} terviklik HTML-dokument
 */
export function renderTransportCardHtml({ clientName, address, phone, organizationName, lines, rides, issuedOn, locale }) {
  const lang = locale || "et";
  const t = (key, values) => serverT(lang, `home_care.transport_card.doc.${key}`, values || null, key);
  const rideRows = rides.map(
    (ride) =>
      `<li><span class="label">${escapeHtml(ride.time ? t("when_time", { date: dayLabel(ride.wantedOn), time: ride.time }) : dayLabel(ride.wantedOn))}</span> · ${escapeHtml(ride.destination)}${
        ride.needs ? ` · ${escapeHtml(ride.needs)}` : ""
      }${ride.arranged ? "" : ` · ${escapeHtml(t("not_arranged"))}`}</li>`
  );
  const lineRows = lines.map((text) => `<li>${escapeHtml(text)}</li>`);

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
    `<h1>${escapeHtml(t("title"))}</h1>`,
    `<p class="who">${escapeHtml(clientName || "")}</p>`,
    address ? `<p class="line">${escapeHtml(address)}</p>` : "",
    phone ? `<p class="line"><span class="label">${escapeHtml(t("phone"))}</span> ${escapeHtml(phone)}</p>` : "",
    `<h2>${escapeHtml(t("lines_title"))}</h2>`,
    lineRows.length ? `<ul>${lineRows.join("")}</ul>` : `<p class="line">${escapeHtml(t("lines_none"))}</p>`,
    `<h2>${escapeHtml(t("rides_title"))}</h2>`,
    rideRows.length ? `<ul>${rideRows.join("")}</ul>` : `<p class="line">${escapeHtml(t("rides_none"))}</p>`,
    `<p class="foot">${escapeHtml(organizationName || "")} · ${escapeHtml(t("issued_on", { date: dayLabel(issuedOn) }))} · ${escapeHtml(t("foot"))}</p>`,
    `</body>`,
    `</html>`
  ]
    .filter(Boolean)
    .join("\n");
}
