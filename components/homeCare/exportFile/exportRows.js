/**
 * Täieliku väljavõtte reeglid ilma joonistamiseta: mis failis on ja mis ei ole,
 * varasemad väljavõtted, faili suurus ja nimi ning kontrollsumma.
 *
 * Koduteenuse täielik väljavõte: kõik andmed ühe failina asutuse enda nupust. Fail
 * sisaldab kõigi klientide andmeid, seetõttu on tegemine kolmes vaates: põhjus,
 * kinnitus, valmis fail. Brauser võrdleb saadud faili suurust ja kontrollsummat
 * serveri omadega ja annab faili salvestada ainult siis, kui need klapivad. Olek ja
 * päring on konksus ./useExportFile.js, vaated on ühised (../client/PartViews.jsx),
 * kokku paneb need ./ExportFile.jsx.
 */

import { CARE_EXPORT_REASONS } from "@/lib/homeCare/constants";
import { HOME_CARE_EXPORT_EXCLUSIONS } from "@/lib/homeCare/exportFormat";

/** Mitu rida on loendis vaates enne nuppu „Näita veel". */
export const EXPORT_PAGE = 4;

/** Faili nimi vastuse päisest; tühi, kui päist ei ole. */
export function fileNameFrom(disposition) {
  const match = /filename="([^"]+)"/.exec(String(disposition || ""));
  return match ? match[1].replace(/[^A-Za-z0-9._-]/g, "") : "";
}

/** Tühi vastus tähendab, et brauser ei saa kontrollsummat arvutada (ebaturvaline aadress). */
export async function sha256Hex(blob) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return "";
  const digest = await subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Faili suurus sõnadega (kB või MB). */
export function sizeLabel(t, bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024 * 1024) return t("home_care.export.size_kb", { n: Math.max(1, Math.round(bytes / 1024)) });
  const megabytes = bytes / (1024 * 1024);
  const text = megabytes >= 10 ? String(Math.round(megabytes)) : megabytes.toFixed(1).replace(".", t("home_care.export.decimal_mark"));
  return t("home_care.export.size_mb", { n: text });
}

/** Põhjused valikuna: `[{ value, label }]`. */
export function reasonChoices(t) {
  return CARE_EXPORT_REASONS.map((value) => ({ value, label: t(`home_care.export.reasons.${value}`) }));
}

/** Esimene vaade: valmis fail (kui on), mis failis on, mis ei ole ja varasemad väljavõtted. */
export function exportMainRows(t, data, done) {
  return [
    done ? { key: "done", title: done.name, line: t("home_care.export.ready", { rows: done.rows, size: sizeLabel(t, done.bytes) }) } : null,
    { key: "contents", title: t("home_care.export.contents_title") },
    { key: "excluded", title: t("home_care.export.excluded_title") },
    { key: "recent", title: t("home_care.export.recent_title"), line: data.recent.length ? t("home_care.parts.count", { count: data.recent.length }) : t("home_care.export.recent_empty") }
  ].filter(Boolean);
}

/** Mis failis on: arvud ridadena (loetavad). */
export function contentRows(t, counts) {
  return [
    ["clients", t("home_care.export.count.clients", { count: counts.clients })],
    ["entries", t("home_care.export.count.entries", { count: counts.entries })],
    ["access", t("home_care.export.count.access", { count: counts.accessLog })],
    ["histories", t("home_care.export.count.histories", { count: counts.importedHistories })],
    ["releases", t("home_care.export.count.releases", { count: counts.chronologyReleases })]
  ].map(([key, title]) => ({ key, title, open: false }));
}

/** Mida failis ei ole: põhjused ridadena (loetavad). */
export function excludedRows(t) {
  return HOME_CARE_EXPORT_EXCLUSIONS.map((item) => ({ key: item.key, title: t(`home_care.export.excluded.${item.key}`), open: false }));
}

/** Varasemad väljavõtted ridadena: aeg ja tegija, põhjus, ridade arv ja suurus, kontrollsumma. */
export function recentRows(t, recent, { moment }) {
  return recent.map((row) => ({
    key: row.id,
    title: [moment(row.createdAt), row.byName].filter(Boolean).join(" · "),
    lines: [
      [row.reasonCode ? t(`home_care.export.reasons.${row.reasonCode}`) : "", row.rowCount === null ? "" : t("home_care.export.rows", { count: row.rowCount }), sizeLabel(t, row.byteCount)].filter(Boolean).join(" · "),
      row.contentSha256 ? t("home_care.export.recent_checksum", { sha: row.contentSha256 }) : ""
    ].filter(Boolean),
    open: false
  }));
}
