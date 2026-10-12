/**
 * Klientide sissetoomise reeglid ilma joonistamiseta: mis seisab eelvaate ja selle
 * ridade peal, mitu klienti tuuakse üle ja millal samm on valmis.
 *
 * Klientide nimekirja sissetoomine tabelist (hooldusjuht). Kaks sammu: „Kontrolli"
 * näitab, mis igast reast saab, ja midagi ei salvesta; „Too üle" loob kliendid.
 * Server loeb sama teksti uuesti, seega eelvaade ja tulemus ei saa lahku minna.
 * Teksti või üksuse muutmine tühistab eelvaate: üle tuuakse ainult see, mida
 * hooldusjuht just kontrollis. Olek ja päringud on konksus ./useClientImport.js,
 * vaated on ühised (../client/PartViews.jsx), kokku paneb need ./ClientImport.jsx.
 */

import { ClientImportStatus } from "@/lib/homeCare/clientTable";

/** Mitu rida on loendis vaates enne nuppu „Näita veel". */
export const IMPORT_PAGE = 4;

/** Mitu klienti tuuakse üle: uued ja need sama nimega read, mille hooldusjuht kinnitas. */
export function willCreate(preview, confirmed) {
  return preview ? preview.summary.new + confirmed.length : 0;
}

/** Tabeli samm on valmis, kui tekst ei ole tühi. */
export function textReady(text) {
  return Boolean(String(text || "").trim());
}

/** Üksuste valik: kui üksus ei ole kohustuslik, on esimene „üksuseta"; `[{ value, label }]`. */
export function unitChoices(t, units, unitRequired) {
  return [...(unitRequired ? [] : [{ value: "", label: t("home_care.client.unit_none") }]), ...units.map((unit) => ({ value: unit.id, label: unit.name }))];
}

/** Eelvaate read olekute kaupa: mitu rida on uusi ja millised probleemid. Ainult need, mida on. */
export function previewRows(t, preview) {
  const summary = preview.summary;
  return [
    { key: ClientImportStatus.NEW, title: t("home_care.import.count_new", { count: summary.new }), open: summary.new > 0 },
    summary.exists > 0 ? { key: ClientImportStatus.EXISTS, title: t("home_care.import.count_exists", { count: summary.exists }) } : null,
    summary.repeated > 0 ? { key: ClientImportStatus.REPEATED, title: t("home_care.import.count_repeated", { count: summary.repeated }) } : null,
    summary.sameName > 0 ? { key: ClientImportStatus.SAME_NAME, title: t("home_care.import.count_same_name", { count: summary.sameName }), tone: "risk" } : null,
    summary.errors > 0 ? { key: ClientImportStatus.ERROR, title: t("home_care.import.count_errors", { count: summary.errors }), tone: "risk" } : null
  ].filter(Boolean);
}

/** Ühe oleku read: nimi (või „nimi puudub"), rea number ja tunnus ning vea põhjus. */
export function statusRows(t, preview, status) {
  return preview.rows
    .filter((row) => row.status === status)
    .map((row) => ({
      key: String(row.line),
      title: row.displayName || t("home_care.import.no_name"),
      lines:
        status === ClientImportStatus.NEW
          ? [row.internalCode].filter(Boolean)
          : [`${t("home_care.import.row_line", { line: row.line })}${row.internalCode ? ` · ${row.internalCode}` : ""}`, status === ClientImportStatus.ERROR ? t(row.errorKey || "home_care.errors.import_row_invalid") : ""].filter(Boolean),
      open: false
    }));
}

/** Sama nimega read: märkeruut igaühe kohta, mille hooldusjuht peab kinnitama. */
export function sameNameChecks(t, preview, confirmed, toggle) {
  return preview.rows
    .filter((row) => row.status === ClientImportStatus.SAME_NAME)
    .map((row) => ({
      kind: "check",
      key: `line-${row.line}`,
      label: `${row.displayName || t("home_care.import.no_name")} · ${t("home_care.import.row_line", { line: row.line })}: ${t("home_care.import.confirm_same_name")}`,
      value: confirmed.includes(row.line),
      onChange: () => toggle(row.line)
    }));
}
