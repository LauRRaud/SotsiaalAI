/**
 * Aruannete osa (`/org/<id>/aruanded`) reeglid ilma joonistamiseta: loendi rida,
 * avatud aruande read ja faili nimi.
 *
 * SISU EI OLE SIIN. Loend näitab perioodi, saatjat ja mahtu; kliendinimed on
 * failis. Nii ei jää nimekiri ekraanile lahti seisma.
 *
 * Leht (`../OrgServiceReportsClient.jsx`) hoiab olekut ja teeb päringud, vaated
 * (`./ReportsViews.jsx`) joonistavad. Test: `tests/org-reports-views.test.mjs`.
 */

import { stampOf } from "../orgRules.js";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Kuu inimese keeles: `2026-09` → „september 2026". Muu kujuga väärtus jääb
 * selliseks, nagu see on (see on periood, mitte sisemine võti).
 */
export function monthLabel(month, locale = "et") {
  const match = /^(\d{4})-(\d{2})$/.exec(text(month));
  if (!match) return text(month);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  if (Number.isNaN(date.getTime()) || Number(match[2]) < 1 || Number(match[2]) > 12) return text(month);
  try {
    return new Intl.DateTimeFormat(locale || "et", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  } catch {
    return text(month);
  }
}

/** Kas aruanne on avatud. */
export function reportOpened(row) {
  return row?.status === "OPENED";
}

/**
 * Loendi rida: mis kuu aruanne, selle all saatja, omavalitsus ja kirjete arv;
 * paremal kas see on avamata (tähelepanu vajav) või millal avati.
 */
export function reportRow(row, { t, locale }) {
  const opened = reportOpened(row);
  const count = row?.entryCount;
  return {
    id: String(row?.id || ""),
    title: monthLabel(row?.month, locale),
    sub: [
      text(row?.senderName) ? t("org.reports.from", { name: text(row.senderName) }) : "",
      text(row?.kovName),
      count !== null && count !== undefined ? t("org.reports.entries", { count: String(count) }) : ""
    ]
      .filter(Boolean)
      .join(" · "),
    chip: opened ? "" : t("org.reports.unopened"),
    time: opened ? stampOf(row?.openedAt) : "",
    attention: !opened
  };
}

/** Avatud aruande read: saatja, omavalitsus, millal saadeti, mitu kirjet ja kas on avatud (periood on vaate pealkiri). */
export function reportFacts(row, { t }) {
  const count = row?.entryCount;
  return [
    { key: "sender", label: t("org.reports.sender"), value: text(row?.senderName) },
    { key: "kov", label: t("org.reports.kov"), value: text(row?.kovName) },
    { key: "sent", label: t("org.reports.sent"), value: stampOf(row?.sentAt) },
    { key: "entries", label: t("org.reports.entries_label"), value: count !== null && count !== undefined ? String(count) : "" },
    { key: "opened", label: t("org.reports.opened"), value: reportOpened(row) ? stampOf(row?.openedAt) || t("org.reports.opened_yes") : t("org.reports.unopened"), quiet: !reportOpened(row) }
  ].filter((fact) => fact.value);
}

/** Allalaaditava faili nimi: CSV on esitatud fail, PDF on sama nimega lugemiskoopia. */
export function downloadName(row, format) {
  return format === "pdf" ? String(row?.fileName || "report.csv").replace(/\.csv$/i, ".pdf") : row?.fileName;
}

/**
 * Mis eelvaatest näidata: "none" (ei ole küsitud), "table" (read on käes) või
 * "unavailable" (vormingut ei saa siin näidata: ainus tee on allalaadimine).
 */
export function previewState(preview, shareId) {
  if (!preview || preview.shareId !== shareId) return "none";
  return preview.previewable && Array.isArray(preview.rows) ? "table" : "unavailable";
}
