/**
 * TEENUSPÄEVIK E6 — ühine renderdusplaan CSV/DOCX/PDF jaoks.
 *
 * ÜKS PLAAN, KOLM VÄLJUNDIT. Malliehitajad (`templates.js`) annavad neutraalse
 * kuju `{header, columns, rows, footer, warnings}`. Kui iga vorming loeks seda
 * kuju ise, tekiks kolm eri arusaama sellest, mis on „veerg" — ja kolmas
 * vorming jääks alati millegi võrra maha. Siin tehakse plaan ÜKS KORD ja
 * vormingud ainult joonistavad ta välja.
 *
 * PEALKIRI ON TOOTENIMI. „Teenuspäevik" täpselt nii, kirjapilt kaasa arvatud:
 * see on KOV-ile mineva arve alusdokumendi päis ja tootenimi ei tohi seal olla
 * kolmes eri kujus.
 */

import { TEMPLATE } from "./templates.js";

export const PRODUCT_NAME = "Teenuspäevik";

/** Vorming on kutsuja valik; failinimi ja MIME tulevad siit, mitte marsruudist. */
export const EXPORT_FORMAT = Object.freeze({
  CSV: "csv",
  DOCX: "docx",
  PDF: "pdf"
});

export const EXPORT_FORMATS = Object.freeze(Object.values(EXPORT_FORMAT));

export function isExportFormat(value) {
  return typeof value === "string" && EXPORT_FORMATS.includes(value.toLowerCase());
}

export const FORMAT_MIME = Object.freeze({
  [EXPORT_FORMAT.CSV]: "text/csv; charset=utf-8",
  [EXPORT_FORMAT.DOCX]:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  [EXPORT_FORMAT.PDF]: "application/pdf"
});

const TEMPLATE_TITLE = Object.freeze({
  [TEMPLATE.A_TIMESHEET]: "Tööajaarvestus",
  [TEMPLATE.B_CARE_DIARY]: "Hoolduspäevik",
  [TEMPLATE.C_NARRATIVE]: "Sisuline aruanne",
  [TEMPLATE.D_STATISTICS]: "Statistikaväljavõte"
});

/**
 * Veerupäised. Eesti keel on siin FAILI keel, mitte kasutajaliidese oma: fail
 * läheb KOV-ile ja peab olema loetav ka siis, kui osutaja kasutab platvormi
 * vene või inglise keeles. Sama põhjus, miks CSV-l on püsivad päised.
 */
const COLUMN_LABEL = Object.freeze({
  client: "Klient",
  referralNumber: "Suunamisotsuse nr",
  date: "Kuupäev",
  service: "Teenus",
  activities: "Tegevused",
  unit: "Ühik",
  quantity: "Kogus",
  worker: "Töötaja",
  travelMinutes: "Sõiduaeg (min)",
  clientConfirmed: "Kliendi kinnitus",
  status: "Olek",
  arrivedAt: "Kohal",
  leftAt: "Lahkus",
  duration: "Kestus",
  moneyAmount: "Rahaline tehing",
  moneyNote: "Selgitus",
  note: "Tähelepanek",
  noteProvenance: "Päritolu",
  goals: "Eesmärgid",
  progress: "Edenemine",
  obstacles: "Takistused",
  proposal: "Ettepanek",
  period: "Periood",
  clientCount: "Kliente",
  entryCount: "Kirjeid",
  totalQuantity: "Maht"
});

const HEADER_LABEL = Object.freeze({
  provider: "Osutaja",
  registryCode: "Registrikood",
  recipient: "Saaja",
  period: "Periood",
  contractRef: "Lepingu/hanke viide"
});

export function columnLabel(key) {
  return COLUMN_LABEL[key] || key;
}

export function headerLabel(key) {
  return HEADER_LABEL[key] || key;
}

export function documentTitle(document) {
  const name = TEMPLATE_TITLE[document?.template] || "Aruanne";
  return `${PRODUCT_NAME} — ${name}`;
}

function cellText(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "jah" : "";
  return String(value);
}

/**
 * Neutraalne plaan: pealkiri, päiseread, tabel, kokkuvõte ja hoiatused.
 *
 * HOIATUSED KUULUVAD FAILI, mitte ainult ekraanile. Kui eksport jättis midagi
 * välja (mustandid, teise KOV-i read), peab see olema kirjas seal, kuhu fail
 * läheb — vastuvõtja ei näe meie ekraani.
 */
export function buildRenderPlan(document, { generatedAt = null } = {}) {
  if (!document || typeof document !== "object") {
    throw new TypeError("buildRenderPlan vajab malli väljundit");
  }

  const columns = Array.isArray(document.columns) ? document.columns : [];
  const rows = Array.isArray(document.rows) ? document.rows : [];

  const meta = (Array.isArray(document.header) ? document.header : [])
    .filter(([, value]) => cellText(value).trim() !== "")
    .map(([key, value]) => `${headerLabel(key)}: ${cellText(value)}`);

  if (generatedAt) meta.push(`Koostatud: ${String(generatedAt).slice(0, 10)}`);

  const totals = [];
  const footerTotals = document.footer?.totals;
  if (footerTotals && typeof footerTotals === "object") {
    for (const [unit, value] of Object.entries(footerTotals)) {
      totals.push(`${columnLabel("unit")} ${unit}: ${cellText(value)}`);
    }
  }
  if (Number.isFinite(document.footer?.entryCount)) {
    totals.push(`${columnLabel("entryCount")}: ${document.footer.entryCount}`);
  }

  return {
    title: documentTitle(document),
    meta,
    table: {
      head: columns.map(columnLabel),
      rows: rows.map((row) => columns.map((column) => cellText(row?.[column])))
    },
    totals,
    warnings: Array.isArray(document.warnings) ? document.warnings.map(cellText) : []
  };
}
