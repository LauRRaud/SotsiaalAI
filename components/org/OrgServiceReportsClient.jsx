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
import { receiveReportBody } from "@/lib/serviceLog/reportDeliveryClient";

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

export default function OrgServiceReportsClient({ organizationId, initialPage }) {
  const { t, locale } = useI18n();
  /* KIIRMENÜÜ INFO IGAL LEHEL (omaniku reegel): lehe nimi ja sektsioonid on
     kirjas `lib/dashboardInfoContent.js`-is, mitte laiali komponentides. */
  usePanelInfoSlot({ infoId: "org_service_reports" });
  const [rows, setRows] = useState(initialPage?.items || []);
  const [nextCursor, setNextCursor] = useState(initialPage?.nextCursor || null);
  const [pageError, setPageError] = useState(false);
  /* Eelvaade on ÜHE aruande kohta korraga: kaks tabelit kõrvuti ei aita
     kedagi ja juht vaatab niikuinii ühte rida korraga. */
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState("");
  /* Vormingu valik on ÜHE aruande kohta lahti korraga. */
  const [picking, setPicking] = useState("");

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    setPageError(false);
    setBusy("page");
    try {
      const response = await fetch(
        `/api/org/${organizationId}/aruanded?cursor=${encodeURIComponent(nextCursor)}`
      );
      if (!response.ok) throw new Error("page");
      const payload = await response.json();
      setRows((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...(payload.items || []).filter((item) => !known.has(item.id))];
      });
      setNextCursor(payload.nextCursor || null);
    } catch {
      setPageError(true);
    } finally {
      setBusy("");
    }
  }, [nextCursor, organizationId]);

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

  const confirmDelivery = useCallback(
    async (shareId, deliveryToken) => {
      if (!deliveryToken) return false;
      const response = await fetch(`/api/org/${organizationId}/aruanded/${shareId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryToken })
      });
      return response.ok;
    },
    [organizationId]
  );

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
        const body = await receiveReportBody(response, {
          readBody: (value) => value.json(),
          tokenFromBody: true,
          confirm: (deliveryToken) => confirmDelivery(shareId, deliveryToken)
        });
        if (!body) return;
        const previewBody = { ...body };
        delete previewBody.deliveryToken;
        setPreview({ shareId, ...previewBody });
        markOpened(shareId);
      } catch {
        /* Eelvaade on mugavus, mitte ainus tee: allalaadimine jääb alles. */
      } finally {
        setBusy("");
      }
    },
    [confirmDelivery, locale, markOpened, organizationId]
  );

  const download = useCallback(
    async (row, format) => {
      setBusy(row.id);
      try {
        const suffix = format === "pdf" ? "?vorming=pdf" : "";
        const response = await fetch(`/api/org/${organizationId}/aruanded/${row.id}${suffix}`);
        if (!response.ok) return;
        /* `blob()` lõpeb alles siis, kui kogu vastus on brauserisse jõudnud.
           Katkenud stream viskab ja kinnituskutset ei tehta. */
        const blob = await receiveReportBody(response, {
          readBody: (value) => value.blob(),
          confirm: (deliveryToken) => confirmDelivery(row.id, deliveryToken)
        });
        if (!blob) return;

        const href = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.download =
          format === "pdf" ? String(row.fileName || "report.csv").replace(/\.csv$/i, ".pdf") : row.fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(href);
        setPicking("");
        markOpened(row.id);
      } catch {
        /* Ebaõnnestunud või katkenud tarne ei muuda OPENED seisu. */
      } finally {
        setBusy("");
      }
    },
    [confirmDelivery, markOpened, organizationId]
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
                  <Button type="button" variant="secondary" onClick={() => download(row, "csv")}>
                    {t("org.reports.format_csv")}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => download(row, "pdf")}>
                    {t("org.reports.format_pdf")}
                  </Button>
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
      {nextCursor ? (
        <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={loadMore}>
          {t("org.pagination.loadMore")}
        </Button>
      ) : null}
      {pageError ? <p className="org-hint">{t("org.pagination.loadFailed")}</p> : null}
      <p className="org-hint">{t("org.reports.audit_note")}</p>
    </Panel>
  );
}
