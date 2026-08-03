"use client";

/**
 * TEENUSPÄEVIK — juhile saadetud kuuaruanded (E10a, saaja vaade).
 *
 * KOLM ASJA, MIS SIIN ON TEADLIKUD:
 *
 * 1. TÜHI LOEND ON NORMAALNE SEIS, mitte tõrge. Juht, kellele keegi ei ole
 *    midagi saatnud, ei ole vale ega õigusteta — talle lihtsalt ei ole veel
 *    saadetud. Tekst ütleb seda välja, sest muidu loeb ta tühjust rikkena.
 *
 * 2. AVAMINE JÄTAB JÄLJE ja seda öeldakse ette. Töötaja näeb oma poolel, kas
 *    juht luges — see on osa lepingust, mitte varjatud telemeetria.
 *
 * 3. SISU EI OLE SIIN. Loend näitab perioodi, saatjat ja mahtu; kliendinimed
 *    on failis. Nii ei jää nimekiri ekraanile lahti seisma.
 */

import { useCallback, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";

function formatDate(value, locale) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale || "et", { dateStyle: "short", timeStyle: "short" }).format(date);
  } catch {
    return date.toISOString().slice(0, 16).replace("T", " ");
  }
}

export default function OrgServiceReportsClient({ organizationId, items = [] }) {
  const { t, locale } = useI18n();
  /* KIIRMENÜÜ INFO IGAL LEHEL (omaniku reegel): lehe nimi ja sektsioonid on
     kirjas `lib/dashboardInfoContent.js`-is, mitte laiali komponentides. */
  usePanelInfoSlot({ infoId: "org_service_reports" });
  const [rows, setRows] = useState(items);

  /* Avamine muudab seisu serveris. Loendi kohalik uuendamine hoiab ära selle,
     et juht vajutab teist korda, sest ekraanil ei muutunud midagi. */
  const markOpened = useCallback((shareId) => {
    setRows((current) =>
      current.map((row) =>
        row.id === shareId && row.status === "SENT"
          ? { ...row, status: "OPENED", openedAt: new Date().toISOString() }
          : row
      )
    );
  }, []);

  return (
    <Panel as="section" variant="secondary" padding="sm">
      <h2>{t("org.reports.title")}</h2>
      <p className="org-hint">{t("org.reports.intro")}</p>

      {rows.length === 0 ? (
        <p className="org-empty">{t("org.reports.empty")}</p>
      ) : (
        <ul className="org-list">
          {rows.map((row) => (
            <li key={row.id} className="org-list__item">
              <div className="org-list__main">
                <strong>{row.month}</strong>{" "}
                <span>{t("org.reports.from", { name: row.senderName })}</span>
                {row.kovName ? <span> · {row.kovName}</span> : null}
              </div>
              <div className="org-list__meta">
                {t("org.reports.sent_at", { date: formatDate(row.sentAt, locale) })}
                {row.entryCount !== null && row.entryCount !== undefined
                  ? ` · ${t("org.reports.entries", { count: String(row.entryCount) })}`
                  : ""}
                {row.status === "OPENED"
                  ? ` · ${t("org.reports.opened_at", { date: formatDate(row.openedAt, locale) })}`
                  : ` · ${t("org.reports.unopened")}`}
              </div>
              {row.note ? <p className="org-list__note">{row.note}</p> : null}
              <Button
                as="a"
                href={`/api/org/${organizationId}/aruanded/${row.id}`}
                download
                variant="secondary"
                onClick={() => markOpened(row.id)}
              >
                {t("org.reports.open")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="org-hint">{t("org.reports.audit_note")}</p>
    </Panel>
  );
}
