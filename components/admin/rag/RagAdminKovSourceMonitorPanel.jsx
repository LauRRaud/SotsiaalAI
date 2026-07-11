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
    <section aria-label="KOV veebiallikate seire" className="ra-card">
      <h2 className="ra-card-title">KOV veebiallikate seire</h2>
      <p className="ra-card-sub">
        Kontrollib kõigi `KOV/*/*.sources.json` allikate ametlikke URL-e ja kirjutab kõrvale kandidaatfailid.
        See ei uuenda teenuste JSON-i ega RAG markdowni, vaid loob lehtede muutuste baasjoone ja raporti.
      </p>

      <div className="ra-stats ra-stats--mini">
        <div
          className="ra-stat"
          data-tone={
            sourceMonitorDisabled
              ? "dim"
              : (status?.report?.baselineMissing || 0) > 0 || (status?.report?.changedSources || 0) > 0
                ? "warn"
                : "ok"
          }
        >
          <span className="ra-stat-label">Seis</span>
          <span className="ra-stat-value ra-stat-value--text">{statusText(status)}</span>
        </div>
        <div className="ra-stat">
          <span className="ra-stat-label">KOV failid</span>
          <span className="ra-stat-value">{formatValue(status?.sourceFiles)}</span>
        </div>
        <div className="ra-stat" data-tone={Number(status?.report?.changedSources || 0) > 0 ? "warn" : "neutral"}>
          <span className="ra-stat-label">Muudatused</span>
          <span className="ra-stat-value">{formatValue(status?.report?.changedSources)}</span>
        </div>
        <div className="ra-stat" data-tone={Number(status?.report?.baselineMissing || 0) > 0 ? "warn" : "neutral"}>
          <span className="ra-stat-label">Baasjooneta</span>
          <span className="ra-stat-value">{formatValue(status?.report?.baselineMissing)}</span>
        </div>
      </div>

      <div className="ra-form-row">
        <input
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder="slug, nt viimsi-vald"
          aria-label="KOV slug"
        />
      </div>
      <div className="ra-actions">
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

      {message ? <p className="ra-status">{message}</p> : null}
      {items.length > 0 ? (
        <div aria-label="KOV allikate muudatused" className="ra-changes">
          {items.map((item, index) => (
            <div key={`${item.slug}-${item.sourceKey}-${index}`} className="ra-change">
              <div>{item.slug || "-"}</div>
              <div>{item.title || item.sourceKey || item.url || "-"}</div>
              <div>{item.status || "-"}</div>
            </div>
          ))}
        </div>
      ) : status?.reportExists ? (
        <p className="ra-log">Viimases raportis muutunud allikaid ei olnud.</p>
      ) : null}
      {status?.reportExists ? (
        <p className="ra-log">
          Raport: {status.report.reportFile}; kontrollitud URL-e: {formatValue(status.report.checkedUrls)}.
          {status.report.appliedAt ? ` Rakendatud: ${status.report.appliedAt}.` : ""}
        </p>
      ) : null}
    </section>
  );
}
