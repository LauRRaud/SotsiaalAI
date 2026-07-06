"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return new Intl.NumberFormat("et-EE").format(value);
  return String(value);
}

function statusText(status) {
  if (status?.disabled) return "Välja lülitatud";
  if (!status?.reportExists) return "Kontrollimata";
  if ((status?.report?.baselineMissing || 0) > 0) return "Vajab baasjoont";
  if ((status?.report?.changedSources || 0) > 0) return "Lehed muutunud";
  return "Ajakohane";
}

export default function RagAdminKovSourceMonitorPanel() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [slug, setSlug] = useState("");

  const loadStatus = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/rag/kov-source-monitor", {
        cache: "no-store",
        credentials: "same-origin"
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.message || "KOV allikate kontroll ebaõnnestus");
      setStatus(data);
    } catch (error) {
      setMessage(error?.message || "KOV allikate kontroll ebaõnnestus");
    } finally {
      setBusy(false);
    }
  }, []);

  const runWebCheck = useCallback(async () => {
    setBusy(true);
    setMessage("Kontrollin KOV allikalehti ja koostan kandidaatfailid...");
    try {
      const response = await fetch("/api/admin/rag/kov-source-monitor", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "web-check", slug })
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.message || "KOV allikate veebikontroll ebaõnnestus");
      setStatus(data.status);
      setMessage(`Kontroll valmis: ${formatValue(data?.result?.changedSources || 0)} muutunud allikat, ${formatValue(data?.result?.baselineMissing || 0)} baasjooneta allikat.`);
    } catch (error) {
      setMessage(error?.message || "KOV allikate veebikontroll ebaõnnestus");
    } finally {
      setBusy(false);
    }
  }, [slug]);

  const applyCheck = useCallback(async () => {
    setBusy(true);
    setMessage("Rakendan KOV allikate kontrollfailid...");
    try {
      const response = await fetch("/api/admin/rag/kov-source-monitor", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply-check" })
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.message || "KOV allikate kontrollfailide rakendamine ebaõnnestus");
      setStatus(data.status);
      setMessage(`Allikate baasjoon uuendatud: ${formatValue(data?.result?.appliedFiles || 0)} faili.`);
    } catch (error) {
      setMessage(error?.message || "KOV allikate kontrollfailide rakendamine ebaõnnestus");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const items = useMemo(() => status?.report?.items || [], [status]);
  const canApply = Boolean(status?.reportExists && (status?.report?.candidatesWritten || 0) > 0);
  const sourceMonitorDisabled = Boolean(status?.disabled);

  return (
    <section aria-label="KOV veebiallikate seire">
      <h2>KOV veebiallikate seire</h2>
      <p>
        Kontrollib kõigi `KOV/*/*.sources.json` allikate ametlikke URL-e ja kirjutab kõrvale kandidaatfailid.
        See ei uuenda teenuste JSON-i ega RAG markdowni, vaid loob lehtede muutuste baasjoone ja raporti.
      </p>

      <div>
        <div>
          <div>Seis</div>
          <div>{statusText(status)}</div>
        </div>
        <div>
          <div>KOV failid</div>
          <div>{formatValue(status?.sourceFiles)}</div>
        </div>
        <div>
          <div>Muudatused</div>
          <div>{formatValue(status?.report?.changedSources)}</div>
        </div>
        <div>
          <div>Baasjooneta</div>
          <div>{formatValue(status?.report?.baselineMissing)}</div>
        </div>
      </div>

      <div>
        <input
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder="slug, nt viimsi-vald"
          aria-label="KOV slug"
        />
        <Button type="button" variant="primary" size="sm" onClick={loadStatus} disabled={busy}>
          Kontrolli seisu
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={runWebCheck} disabled={busy || sourceMonitorDisabled}>
          Käivita allikakontroll
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={applyCheck} disabled={busy || sourceMonitorDisabled || !canApply}>
          Kinnita allikate baasjoon
        </Button>
      </div>

      {message ? <p>{message}</p> : null}
      {items.length > 0 ? (
        <div aria-label="KOV allikate muudatused">
          {items.map((item, index) => (
            <div key={`${item.slug}-${item.sourceKey}-${index}`}>
              <div>{item.slug || "-"}</div>
              <div>{item.title || item.sourceKey || item.url || "-"}</div>
              <div>{item.status || "-"}</div>
            </div>
          ))}
        </div>
      ) : status?.reportExists ? (
        <p>Viimases raportis muutunud allikaid ei olnud.</p>
      ) : null}
      {status?.reportExists ? (
        <p>
          Raport: {status.report.reportFile}; kontrollitud URL-e: {formatValue(status.report.checkedUrls)}.
          {status.report.appliedAt ? ` Rakendatud: ${status.report.appliedAt}.` : ""}
        </p>
      ) : null}
    </section>
  );
}
