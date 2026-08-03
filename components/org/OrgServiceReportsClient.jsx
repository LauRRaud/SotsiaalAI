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
  /* Eelvaade on ÜHE aruande kohta korraga: kaks tabelit kõrvuti ei aita
     kedagi ja juht vaatab niikuinii ühte rida korraga. */
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState("");
  /* Vormingu valik on ÜHE aruande kohta lahti korraga. */
  const [picking, setPicking] = useState("");

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

  /**
   * VAATA — aruanne loetavaks brauseris.
   *
   * Omanik proovis päris kontoga: „sain salvestada, aga vaadata ei saanud."
   * CSV läheb brauserist mööda otse ketta peale ja juht, kes tahab lihtsalt üle
   * vaadata, peab avama teise programmi.
   *
   * VAATAMINE ON KA AVAMINE: server märgib ta samamoodi nagu allalaadimise.
   * Kui ainult allalaadimine loeks, näeks saatja „avamata" ka siis, kui juht
   * luges terve aruande läbi.
   */
  const open = useCallback(
    async (shareId) => {
      setBusy(shareId);
      try {
        const response = await fetch(`/api/org/${organizationId}/aruanded/${shareId}?eelvaade=1`, {
          headers: { "x-ui-locale": locale || "et" }
        });
        if (!response.ok) return;
        const body = await response.json();
        setPreview({ shareId, ...body });
        markOpened(shareId);
      } catch {
        /* Eelvaade on mugavus, mitte ainus tee: allalaadimine jääb alles. */
      } finally {
        setBusy("");
      }
    },
    [locale, markOpened, organizationId]
  );

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
              {/* KAKS TEED, MITTE ÜKS. „Vaata" avab tabeli siinsamas;
                  „Laadi alla" annab CSV-faili neile, kes teda Excelis edasi
                  töötlevad. Omanik küsis mõlemat. */}
              <div className="org-report-actions">
                <Button type="button" variant="secondary" disabled={busy === row.id} onClick={() => open(row.id)}>
                  {t("org.reports.view")}
                </Button>
                {/* VALIK TULEB VAJUTUSE PEALE, mitte kahe nupuna kõrvuti:
                    tavaline tee on üks („laadi alla") ja vorming on erand,
                    mille pärast ei pea iga päev otsustama. */}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPicking(picking === row.id ? "" : row.id)}
                >
                  {t("org.reports.download")}
                </Button>
              </div>

              {picking === row.id ? (
                <div className="org-report-formats" role="group">
                  {/* KAKS ERI ASJA JA SEDA EI TOHI SEGADA. CSV on ESITATUD
                      fail — tema räsi tõendab, et see on täpselt see, mis
                      KOV-ile läks. PDF on lugemiseks renditud koopia ja ta
                      ütleb seda ka failis endas. */}
                  <a
                    className="org-inline-btn"
                    href={`/api/org/${organizationId}/aruanded/${row.id}`}
                    download
                    onClick={() => { markOpened(row.id); setPicking(""); }}
                  >
                    {t("org.reports.format_csv")}
                  </a>
                  <a
                    className="org-inline-btn"
                    href={`/api/org/${organizationId}/aruanded/${row.id}?vorming=pdf`}
                    download
                    onClick={() => { markOpened(row.id); setPicking(""); }}
                  >
                    {t("org.reports.format_pdf")}
                  </a>
                </div>
              ) : null}

              {preview?.shareId === row.id ? (
                preview.previewable ? (
                  <div className="org-report-preview">
                    <table>
                      <tbody>
                        {preview.rows.map((cells, index) => (
                          <tr key={`${row.id}-${index}`}>
                            {cells.map((cell, cellIndex) => (
                              <td key={cellIndex}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* PDF ja DOCX ei ole tekst — nende „eelvaade" oleks prügi.
                     Siis on allalaadimine ainus tee ja seda öeldakse välja. */
                  <p className="org-hint">{t("org.reports.no_preview")}</p>
                )
              ) : null}

            </li>
          ))}
        </ul>
      )}
      <p className="org-hint">{t("org.reports.audit_note")}</p>
    </Panel>
  );
}
