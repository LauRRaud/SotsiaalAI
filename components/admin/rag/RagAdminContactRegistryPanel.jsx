"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return new Intl.NumberFormat("et-EE").format(value);
  return String(value);
}

function statusText(status) {
  if (!status) return "Kontrollimata";
  if (status.sourceChanged === true) return "Vajab uuendust";
  if (status.needsRefresh) return "Vajab esmast räsi";
  return "Ajakohane";
}

export default function RagAdminContactRegistryPanel() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadStatus = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/rag/contact-registry", {
        cache: "no-store",
        credentials: "same-origin"
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.message || "Kontroll ebaõnnestus");
      setStatus(data);
    } catch (error) {
      setMessage(error?.message || "Kontroll ebaõnnestus");
    } finally {
      setBusy(false);
    }
  }, []);

  const runWebCheck = useCallback(async () => {
    setBusy(true);
    setMessage("Käin avaldatud kontaktide ametlikud lehed läbi ja koostan ülevaatusjärjekorra...");
    try {
      const response = await fetch("/api/admin/rag/contact-registry", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "web-check" })
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.message || "Veebikontroll ebaõnnestus");
      setStatus(data.status);
      setMessage(`Kontroll valmis: ${formatValue(data?.result?.verifiedContacts || 0)} kinnitatud kontakti ja ${formatValue(data?.result?.changedContacts || 0)} ülevaatuse kandidaati.`);
    } catch (error) {
      setMessage(error?.message || "Veebikontroll ebaõnnestus");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const geocoding = useMemo(() => status?.serviceMap?.geocodingStatus || {}, [status]);
  const changes = status?.check?.changes || [];

  return (
    <section aria-label="KOV ja LOV kontaktiregister" className="ra-card">
      <h2 className="ra-card-title">KOV/LOV kontaktiregister</h2>
      <p className="ra-card-sub">
        Kontrollib kord nädalas kõigi avaldatud KOV-kontaktide ametlikke veebilehti.
        Täpne vaste uuendab kontrolliaega; võimalik muutus läheb inimese ülevaatusse ega muuda kontakti automaatselt.
      </p>

      <div className="ra-stats ra-stats--mini">
        <div className="ra-stat" data-tone={status?.needsRefresh || status?.check?.sourceChanged ? "warn" : "ok"}>
          <span className="ra-stat-label">Seis</span>
          <span className="ra-stat-value ra-stat-value--text">{statusText(status)}</span>
        </div>
        <div className="ra-stat">
          <span className="ra-stat-label">Avaldatud kontaktid</span>
          <span className="ra-stat-value">{formatValue(status?.counts?.existingContacts)}</span>
        </div>
        <div className="ra-stat">
          <span className="ra-stat-label">Kontrollitud URL-id</span>
          <span className="ra-stat-value">{formatValue(status?.check?.checkedUrls)}</span>
        </div>
        <div className="ra-stat" data-tone={Number(status?.check?.changedContacts || 0) > 0 ? "warn" : "neutral"}>
          <span className="ra-stat-label">Ülevaatuse kandidaadid</span>
          <span className="ra-stat-value">{formatValue(status?.check?.changedContacts)}</span>
        </div>
      </div>

      {status?.serviceMap?.ok ? (
        <div className="ra-chiprow">
          <span className="ra-chip" data-tone="ok">MATCHED {formatValue(geocoding.MATCHED || 0)}</span>
          <span className="ra-chip" data-tone={Number(geocoding.PENDING || 0) > 0 ? "warn" : "dim"}>PENDING {formatValue(geocoding.PENDING || 0)}</span>
          <span className="ra-chip" data-tone={Number(geocoding.FAILED || 0) > 0 ? "err" : "dim"}>FAILED {formatValue(geocoding.FAILED || 0)}</span>
        </div>
      ) : null}

      <div className="ra-actions">
        <Button type="button" variant="primary" size="sm" onClick={loadStatus} disabled={busy}>
          Kontrolli seisu
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={runWebCheck} disabled={busy}>
          Käivita veebikontroll
        </Button>
      </div>

      {message ? <p className="ra-status">{message}</p> : null}
      {changes.length > 0 ? (
        <div aria-label="Kontakti ülevaatuse kandidaadid" className="ra-changes">
          {changes.map((change) => (
            <div key={change.id} className="ra-change">
              <div>
                {change.name || "Kontakt"} <span className="ra-mono">({change.municipality || "-"})</span>
              </div>
              <div>Põhjus: {Array.isArray(change.reasons) ? change.reasons.join(", ") : "vajab ülevaatust"}</div>
              <div className="ra-mono">{change.sourceUrl || "-"}</div>
            </div>
          ))}
        </div>
      ) : status?.check?.reportExists ? (
        <p className="ra-log">Viimases kontrollis ülevaatuse kandidaate ei tekkinud.</p>
      ) : null}
      {status?.check?.reportExists ? (
        <p className="ra-log">
          Viimane kontroll: {status.check.generatedAt}; kontrollitud kontakte: {formatValue(status.check.checkedContacts)};
          kinnitatud: {formatValue(status.check.verifiedContacts)}; ebaõnnestunud URL-e: {formatValue(status.check.fetchedFailed)}.
        </p>
      ) : null}
      <p className="ra-log">Ajastus: kord nädalas (`{status?.schedule?.timer || "sotsiaalai-service-map-contact-check.timer"}`).</p>
      {status?.generatedAt ? <p className="ra-log">Viimane koondamine: {status.generatedAt}</p> : null}
    </section>
  );
}
