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
 *
 * KUJU (11.10). Üks kast kõigi aruannete nuppude ja eelvaadetega on nüüd loend
 * ja üks avatud aruanne (`./reports/ReportsViews.jsx`); read ja faili nime
 * otsustab `./reports/reportRules.js`. Ebaõnnestunud vaatamine või allalaadimine
 * ütleb seda (enne ei juhtunud ekraanil midagi).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";
import { receiveReportBody } from "@/lib/serviceLog/reportDeliveryClient";

import OrgPart from "./OrgPart";
import { ReportView, ReportsBoard } from "./reports/ReportsViews";
import { downloadName, monthLabel, previewState, reportFacts, reportRow } from "./reports/reportRules";

export default function OrgServiceReportsClient({ context, organizationId, initialPage }) {
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
  const [openId, setOpenId] = useState("");
  /* Ebaõnnestunud vaatamine või allalaadimine: lause avatud aruande all servas. */
  const [fault, setFault] = useState("");
  const rootRef = useRef(null);

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
   * VAATAMINE ON KA AVAMINE: server märgib ta samamoodi nagu allalaadimise.
   * Kui ainult allalaadimine loeks, näeks saatja „avamata" ka siis, kui juht
   * luges terve aruande läbi.
   */
  const open = useCallback(
    async (shareId) => {
      setBusy(shareId);
      setFault("");
      try {
        const response = await fetch(`/api/org/${organizationId}/aruanded/${shareId}?eelvaade=1`, {
          headers: { "x-ui-locale": locale || "et" }
        });
        if (!response.ok) {
          setFault(t("org.reports.view_failed"));
          return;
        }
        const body = await receiveReportBody(response, {
          readBody: (value) => value.json(),
          tokenFromBody: true,
          confirm: (deliveryToken) => confirmDelivery(shareId, deliveryToken)
        });
        if (!body) {
          setFault(t("org.reports.view_failed"));
          return;
        }
        const previewBody = { ...body };
        delete previewBody.deliveryToken;
        setPreview({ shareId, ...previewBody });
        markOpened(shareId);
      } catch {
        /* Eelvaade on mugavus, mitte ainus tee: allalaadimine jääb alles. */
        setFault(t("org.reports.view_failed"));
      } finally {
        setBusy("");
      }
    },
    [confirmDelivery, locale, markOpened, organizationId, t]
  );

  const download = useCallback(
    async (row, format) => {
      setBusy(row.id);
      setFault("");
      try {
        const suffix = format === "pdf" ? "?vorming=pdf" : "";
        const response = await fetch(`/api/org/${organizationId}/aruanded/${row.id}${suffix}`);
        if (!response.ok) {
          setFault(t(format === "pdf" ? "org.reports.no_pdf" : "org.reports.download_failed"));
          return;
        }
        /* `blob()` lõpeb alles siis, kui kogu vastus on brauserisse jõudnud.
           Katkenud stream viskab ja kinnituskutset ei tehta. */
        const blob = await receiveReportBody(response, {
          readBody: (value) => value.blob(),
          confirm: (deliveryToken) => confirmDelivery(row.id, deliveryToken)
        });
        if (!blob) {
          setFault(t("org.reports.download_failed"));
          return;
        }
        const href = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.download = downloadName(row, format);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(href);
        setPicking("");
        markOpened(row.id);
      } catch {
        /* Ebaõnnestunud või katkenud tarne ei muuda OPENED seisu. */
        setFault(t("org.reports.download_failed"));
      } finally {
        setBusy("");
      }
    },
    [confirmDelivery, markOpened, organizationId, t]
  );

  const listRows = useMemo(() => rows.map((row) => reportRow(row, { t, locale })), [rows, t, locale]);
  const openRow = rows.find((row) => row.id === openId) || null;

  /* Vaate vahetusel (loend ↔ aruanne) kaob vajutatud rida või nupp: fookus läheb
     vaate pealkirjale. Esimesel joonistusel fookust ei võeta. */
  const shown = useRef(null);
  const shownKey = openRow ? openRow.id : "";
  useEffect(() => {
    const first = shown.current === null;
    const moved = shown.current !== shownKey;
    shown.current = shownKey;
    if (first || !moved) return;
    rootRef.current?.querySelector("[data-step-heading]")?.focus({ preventScroll: true });
  }, [shownKey]);

  if (openRow) {
    const state = previewState(preview, openRow.id);
    return (
      <div ref={rootRef}>
        <OrgPart context={context} part="service_reports">
          <ReportView
            t={t}
            title={monthLabel(openRow.month, locale)}
            facts={reportFacts(openRow, { t, locale })}
            note={openRow.note || ""}
            view={{ busy: busy === openRow.id, onView: () => (busy ? undefined : open(openRow.id)) }}
            formats={{
              open: picking === openRow.id,
              onToggle: () => setPicking(picking === openRow.id ? "" : openRow.id),
              onPick: (format) => (busy ? undefined : download(openRow, format))
            }}
            preview={state}
            tableRows={state === "table" ? preview.rows : []}
            notice={fault ? { tone: "risk", text: fault } : null}
            onBack={() => {
              setFault("");
              setPicking("");
              setOpenId("");
            }}
          />
        </OrgPart>
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      <OrgPart context={context} part="service_reports">
        <ReportsBoard
          t={t}
          rows={listRows}
          onOpen={(id) => {
            setFault("");
            setOpenId(id);
          }}
          more={nextCursor ? { busy: busy === "page", onMore: () => (busy ? undefined : loadMore()) } : null}
          notice={pageError ? { tone: "risk", text: t("org.pagination.loadFailed") } : null}
        />
      </OrgPart>
    </div>
  );
}
