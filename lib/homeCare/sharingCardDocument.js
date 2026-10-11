/**
 * KODUTEENUS K5-u — jagamiskokkuleppe kaart (kava II.6.8): iseseisev prinditav HTML-leht.
 *
 * Klient lepib hooldusjuhiga kokku, kellele ja mida tema kohta võib rääkida. Kokkulepe on
 * kliendi oma: ta peab seda nägema paberil, suure kirjaga ja oma sõnadega, mitte astme
 * numbrina. Kaart läheb kliendi koju kausta lepingu kõrvale; sellel on koht kliendi
 * kinnituse jaoks, kaks tühja rida käsitsi lisamiseks ja päev, milleks kokkulepe üle
 * küsitakse.
 *
 * Sama põhimõte mis teistel dokumentidel: rakenduse raamist sõltumatu, skriptideta, range
 * sisuturbe poliitika enda sees. Puhas funktsioon.
 */

import { serverT } from "../i18n/serverMessages.js";

import { CHRONOLOGY_DOCUMENT_CSP, escapeHtml } from "./chronologyDocument.js";

const STYLE = `
@page { size: A4; margin: 15mm; }
* { box-sizing: border-box; }
html { font-family: "Segoe UI", "Helvetica Neue", Arial, "Liberation Sans", sans-serif; font-size: 15pt; line-height: 1.45; color: #111; background: #fff; }
body { margin: 0 auto; padding: 24px 16px 48px; max-width: 180mm; }
.hint { border: 1px solid #999; border-radius: 6px; padding: 8px 12px; margin: 0 0 12px; font-size: 10pt; color: #333; }
h1 { font-size: 24pt; margin: 0 0 3mm; }
.lead { margin: 0 0 6mm; }
.person { border: 1px solid #777; border-radius: 4px; padding: 3mm 4mm; margin: 0 0 4mm; page-break-inside: avoid; break-inside: avoid; }
.name { font-size: 18pt; font-weight: 600; margin: 0 0 1mm; }
.line { margin: 1mm 0 0; }
.small { font-size: 11pt; color: #333; }
.blank { display: inline-block; min-width: 60mm; border-bottom: 2px solid #111; }
.blank--wide { display: block; min-width: 0; height: 9mm; border-bottom: 2px solid #111; }
.sign { margin: 8mm 0 0; }
.foot { font-size: 11pt; color: #333; margin: 8mm 0 0; }
@media print { .hint { display: none; } body { padding: 0; } }
`;

/** Päev kujul PP.KK.AAAA. */
function dayLabel(day) {
  const [year, month, date] = String(day || "").split("-");
  return year && month && date ? `${date}.${month}.${year}` : "";
}

/**
 * @param {{ clientName: string, organizationName: string, relatives: Array<{ name: string, relation: string|null, level: number, noTell: string|null, agreedOn: string }>, issuedOn: string, reviewBy: string, locale?: string }} input
 * @returns {string} terviklik HTML-dokument
 */
export function renderSharingCardHtml({ clientName, organizationName, relatives, issuedOn, reviewBy, locale }) {
  const lang = locale || "et";
  const t = (key, values) => serverT(lang, `home_care.sharing_card.doc.${key}`, values || null, key);
  const personBlock = (person) =>
    [
      `<div class="person">`,
      `<p class="name">${escapeHtml(person.name)}${person.relation ? ` (${escapeHtml(person.relation)})` : ""}</p>`,
      `<p class="line">${escapeHtml(t(`level_${person.level}`))}</p>`,
      person.noTell ? `<p class="line">${escapeHtml(t("no_tell", { text: person.noTell }))}</p>` : "",
      `<p class="line small">${escapeHtml(t("agreed_on", { date: dayLabel(person.agreedOn) }))}</p>`,
      `</div>`
    ]
      .filter(Boolean)
      .join("\n");
  /* Tühi rida käsitsi lisamiseks: klient võib kaardi täitmise ajal kedagi juurde nimetada. */
  const emptyBlock = () =>
    [`<div class="person">`, `<p class="line">${escapeHtml(t("empty_name"))} <span class="blank">&nbsp;</span></p>`, `<p class="line">${escapeHtml(t("empty_what"))}</p><span class="blank blank--wide">&nbsp;</span>`, `</div>`].join("\n");

  return [
    `<!doctype html>`,
    `<html lang="${escapeHtml(lang)}">`,
    `<head>`,
    `<meta charset="utf-8">`,
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(CHRONOLOGY_DOCUMENT_CSP)}">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<meta name="robots" content="noindex, nofollow, noarchive">`,
    `<meta name="referrer" content="no-referrer">`,
    /* Pealkirjas EI OLE kliendi ega lähedase nime. */
    `<title>${escapeHtml(t("title"))}</title>`,
    `<style>${STYLE}</style>`,
    `</head>`,
    `<body>`,
    `<p class="hint">${escapeHtml(t("print_hint"))}</p>`,
    `<h1>${escapeHtml(t("title"))}</h1>`,
    `<p class="lead">${escapeHtml(t("lead", { name: clientName || "" }))}</p>`,
    relatives.length ? relatives.map(personBlock).join("\n") : `<p class="lead">${escapeHtml(t("nobody"))}</p>`,
    emptyBlock(),
    emptyBlock(),
    `<p class="line">${escapeHtml(t("review_by", { date: dayLabel(reviewBy) }))}</p>`,
    `<p class="line">${escapeHtml(t("change"))}</p>`,
    `<p class="sign">${escapeHtml(t("sign_client"))} <span class="blank">&nbsp;</span> ${escapeHtml(t("sign_date"))} <span class="blank">&nbsp;</span></p>`,
    `<p class="sign">${escapeHtml(t("sign_org"))} <span class="blank">&nbsp;</span></p>`,
    `<p class="foot">${escapeHtml(organizationName || "")} · ${escapeHtml(t("issued_on", { date: dayLabel(issuedOn) }))}</p>`,
    `</body>`,
    `</html>`
  ].join("\n");
}
