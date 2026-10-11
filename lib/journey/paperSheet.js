/**
 * TEEKOND K1-e — paberleht: inimese Teekond ühel prinditaval lehel.
 *
 * MILLEKS. Kohtumisele minnakse sageli paberiga, ja mitte igaühel ei ole
 * nutiseadet või tahtmist seda arsti või ametniku ees lahti hoida. Paberleht on
 * inimese enda kokkuvõte: mida ta soovib, mis on olukord, mis sammud on ees,
 * kellele on pöördutud ja kuidas tal läheb. Lehel on ruumi käsitsi märkmeteks.
 *
 * MIS LEHEL ON. Ainult osad, mille inimene printimise eel valis. Ettevaatlikke
 * tähelepanekuid (platvormi enda märkmed riskide kohta) lehele ei panda kunagi:
 * need ei ole inimese sõnad ega mõeldud kellelegi näitamiseks.
 *
 * TURVE. Leht koosneb inimese kirjutatud tekstist ja serveeritakse rakenduse
 * päritolust, seega läbib IGA väärtus `escapeHtml`-i, lehel ei ole ühtegi skripti
 * ja dokument kannab ise ranget sisuturbe poliitikat (`<meta http-equiv>`;
 * rakenduse üldine päiste seadistus asendab marsruudi pandud poliitika päise).
 * Pealkirjas (vahelehe nimi jääb brauseri ajalukku) ei ole Teekonna nime.
 *
 * Puhas funktsioon: andmebaasi ei loe.
 */
import { serverT } from "../i18n/serverMessages.js";
import { ESTONIA_TIME_ZONE, zonedParts } from "../time/estonianDay.js";

import { AssessmentChange } from "./assessmentRules.js";
import { LinkedPreInquiryState } from "./linkedPreInquiryState.js";
import { JourneyStepState } from "./stepRules.js";

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

/** Lehe osad selles järjekorras, milles need lehel on. */
export const PAPER_SHEET_PARTS = Object.freeze(["wish", "summary", "steps", "pre_inquiries", "assessment", "questions"]);

/** Aadressi `?osad=` → valitud osad. Tühi või puuduv tähendab kõiki; tundmatuid ei arvestata. */
export function normalizePaperSheetParts(value) {
  const raw = Array.isArray(value) ? value.join(",") : typeof value === "string" ? value : "";
  const wanted = new Set(raw.split(",").map((part) => part.trim().toLowerCase()).filter(Boolean));
  if (!wanted.size) return [...PAPER_SHEET_PARTS];
  return PAPER_SHEET_PARTS.filter((part) => wanted.has(part));
}

/**
 * Lehel „Kuhu olen pöördunud" on ainult pöördumised, mis on päriselt teele läinud
 * (või mille inimene on ise saatmiseks alla laadinud). Mustandit, tagasi võetut ja
 * parandusega asendatut seal ei ole: asendatu asemel on lehel selle parandus.
 */
const SHEET_PRE_INQUIRY_STATES = new Set([
  LinkedPreInquiryState.DOWNLOADED,
  LinkedPreInquiryState.SENT,
  LinkedPreInquiryState.SENT_OUTSIDE,
  LinkedPreInquiryState.OPENED,
  LinkedPreInquiryState.ANSWERED
]);

/** Dokumendi enda poliitika. `frame-ancestors` meta-sildis ei kehti; selle annab rakenduse üldine päis. */
export const PAPER_SHEET_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'";

export const PAPER_SHEET_HEADERS = Object.freeze({
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": `${PAPER_SHEET_CSP}; frame-ancestors 'none'`,
  "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
});

/* Suur ja selge kiri: lehte loeb ka inimene, kelle nägemine ei ole hea. */
const STYLE = `
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
html { font-family: "Segoe UI", "Helvetica Neue", Arial, "Liberation Sans", sans-serif; font-size: 13pt; line-height: 1.5; color: #111; background: #fff; }
body { margin: 0 auto; padding: 24px 16px 48px; max-width: 190mm; }
h1 { font-size: 22pt; margin: 0 0 2pt; }
h2 { font-size: 15pt; margin: 18pt 0 6pt; border-bottom: 1.5pt solid #111; padding-bottom: 2pt; }
.sub { margin: 0 0 14pt; color: #333; }
.hint { border: 1px solid #999; border-radius: 6px; padding: 8px 12px; margin: 0 0 20px; font-size: 11pt; color: #333; }
.text { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0 0 6pt; }
ul { margin: 0; padding: 0; list-style: none; }
li { break-inside: avoid; page-break-inside: avoid; padding: 5pt 0; border-bottom: 1px solid #ccc; overflow-wrap: anywhere; }
.box { display: inline-block; width: 13pt; height: 13pt; border: 1.5pt solid #111; margin-right: 8pt; vertical-align: -2pt; }
.meta { font-size: 11pt; color: #333; margin: 2pt 0 0 21pt; }
.plain .meta { margin-left: 0; }
.lines div { border-bottom: 1px solid #777; height: 24pt; }
.foot { margin: 22pt 0 0; font-size: 10.5pt; color: #333; }
@media print { .hint { display: none; } body { padding: 0; max-width: none; } }
`;

function dayOf(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = zonedParts(date, ESTONIA_TIME_ZONE);
  return `${String(parts.day).padStart(2, "0")}.${String(parts.month).padStart(2, "0")}.${parts.year}`;
}

function dayLabel(day) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ""));
  return match ? `${match[3]}.${match[2]}.${match[1]}` : "";
}

/**
 * @param {{ journey: object, parts?: string[], locale?: string, now?: Date }} input
 * @returns {string} terviklik HTML-dokument
 */
export function renderPaperSheetHtml({ journey, parts = PAPER_SHEET_PARTS, locale = "et", now = new Date() }) {
  const t = (key, values) => serverT(locale, `journey.paper.${key}`, values, key);
  const has = (part) => parts.includes(part);
  const section = (title, body) => (body ? `<section><h2>${escapeHtml(title)}</h2>${body}</section>` : "");
  const text = (value) => `<p class="text">${escapeHtml(value)}</p>`;
  const out = [];

  const wish = typeof journey?.context?.personWish === "string" ? journey.context.personWish.trim() : "";
  if (has("wish") && wish) out.push(section(t("wish"), text(wish)));

  if (has("summary") && journey?.summary) out.push(section(t("summary"), text(journey.summary)));

  if (has("steps")) {
    const steps = Array.isArray(journey?.steps) ? journey.steps : [];
    const open = steps.filter((step) => step.state === JourneyStepState.TODO);
    const done = steps.filter((step) => step.state === JourneyStepState.DONE);
    const stepMeta = (step) =>
      [
        step.doer ? t("doer", { name: step.doer }) : "",
        step.dueOn ? t("due", { date: dayLabel(step.dueOn) }) : "",
        step.state === JourneyStepState.DONE && step.doneAt ? t("done_on", { date: dayOf(step.doneAt) }) : ""
      ]
        .filter(Boolean)
        .join(" · ");
    const item = (step, box) =>
      `<li>${box ? '<span class="box"></span>' : ""}${escapeHtml(step.title)}` +
      (stepMeta(step) ? `<p class="meta">${escapeHtml(stepMeta(step))}</p>` : "") +
      (step.note ? `<p class="meta">${escapeHtml(step.note)}</p>` : "") +
      `</li>`;
    if (open.length) out.push(section(t("steps_open"), `<ul>${open.map((step) => item(step, true)).join("")}</ul>`));
    if (done.length) out.push(section(t("steps_done"), `<ul class="plain">${done.map((step) => item(step, false)).join("")}</ul>`));
  }

  if (has("pre_inquiries")) {
    const linked = (Array.isArray(journey?.linkedPreInquiries) ? journey.linkedPreInquiries : []).filter((row) =>
      SHEET_PRE_INQUIRY_STATES.has(row.state)
    );
    const rows = linked.map((row) => {
      const state = serverT(locale, `journey.related.pre_inquiry_state.${row.state}`, null, row.state);
      const when = [row.sentAt ? t("sent_on", { date: dayOf(row.sentAt) }) : "", row.lastReplyAt ? t("answered_on", { date: dayOf(row.lastReplyAt) }) : ""]
        .filter(Boolean)
        .join(" · ");
      return `<li>${escapeHtml(row.topic || t("untitled"))}<p class="meta">${escapeHtml([state, when].filter(Boolean).join(" · "))}</p></li>`;
    });
    if (rows.length) out.push(section(t("pre_inquiries"), `<ul class="plain">${rows.join("")}</ul>`));
  }

  if (has("assessment") && journey?.assessments?.baseline) {
    const picture = journey.assessments;
    const level = (value) => serverT(locale, `journey.assessment.levels.${value}`, null, String(value));
    const sentences = {
      [AssessmentChange.BETTER]: serverT(locale, "journey.assessment.summary_better", null, ""),
      [AssessmentChange.SAME]: serverT(locale, "journey.assessment.summary_same", null, ""),
      [AssessmentChange.HARDER]: serverT(locale, "journey.assessment.summary_harder", null, "")
    };
    const lines = [
      serverT(locale, "journey.assessment.baseline_line", { date: dayOf(picture.baseline.createdAt), level: level(picture.baseline.level) }, ""),
      picture.latest
        ? serverT(locale, "journey.assessment.latest_line", { date: dayOf(picture.latest.createdAt), level: level(picture.latest.level) }, "")
        : "",
      picture.latest ? sentences[picture.change] || "" : "",
      picture.latest?.note || picture.baseline.note || ""
    ].filter(Boolean);
    out.push(section(t("assessment"), lines.map(text).join("")));
  }

  if (has("questions")) {
    const questions = (Array.isArray(journey?.missingInfo) ? journey.missingInfo : [])
      .map((item) => (typeof item === "string" ? item : item?.title || ""))
      .filter(Boolean);
    if (questions.length) {
      out.push(section(t("questions"), `<ul>${questions.map((q) => `<li><span class="box"></span>${escapeHtml(q)}</li>`).join("")}</ul>`));
    }
  }

  /* Ruum käsitsi kirjutamiseks on lehel alati: paber on selleks, et sinna saaks märkida. */
  out.push(section(t("notes"), `<div class="lines">${"<div></div>".repeat(8)}</div>`));

  return [
    "<!doctype html>",
    `<html lang="${escapeHtml(locale)}">`,
    "<head>",
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(PAPER_SHEET_CSP)}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex, nofollow, noarchive">',
    '<meta name="referrer" content="no-referrer">',
    `<title>${escapeHtml(t("tab_title"))}</title>`,
    `<style>${STYLE}</style>`,
    "</head>",
    "<body>",
    `<p class="hint">${escapeHtml(t("screen_hint"))}</p>`,
    `<h1>${escapeHtml(journey?.title || t("tab_title"))}</h1>`,
    `<p class="sub">${escapeHtml(t("printed", { date: dayOf(now) }))}</p>`,
    out.join(""),
    `<p class="foot">${escapeHtml(t("footer"))}</p>`,
    "</body>",
    "</html>"
  ].join("\n");
}
