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
    setMessage("Käin kontaktfailis olevad ametlikud lehed läbi ja koostan kontrollfaili...");
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
      setMessage(`Kontrollfail loodud: ${formatValue(data?.result?.changedContacts || 0)} muutust, ${formatValue(data?.result?.protectedEmailsDecoded || 0)} kaitstud e-posti dekodeeritud.`);
    } catch (error) {
      setMessage(error?.message || "Veebikontroll ebaõnnestus");
    } finally {
      setBusy(false);
    }
  }, []);

  const applyCheck = useCallback(async () => {
    setBusy(true);
    setMessage("Rakendan kontrollfaili põhifailiks...");
    try {
      const response = await fetch("/api/admin/rag/contact-registry", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply-check" })
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.message || "Kontrollfaili rakendamine ebaõnnestus");
      setStatus(data.status);
      setMessage(`Põhifail uuendatud. Varukoopia: ${data?.result?.backupFile || "-"}.`);
    } catch (error) {
      setMessage(error?.message || "Kontrollfaili rakendamine ebaõnnestus");
    } finally {
      setBusy(false);
    }
  }, []);

  const confirmBaseline = useCallback(async () => {
    setBusy(true);
    setMessage("Kinnitan kontaktiregistri praeguse seisu baasjooneks...");
    try {
      const response = await fetch("/api/admin/rag/contact-registry", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "baseline" })
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.message || "Baasjoone kinnitamine ebaõnnestus");
      setStatus(data.status);
      setMessage(`Baasjoon kinnitatud: ${data?.result?.summaryFile || "KOV/kov_kontaktid_loplik.summary.json"}.`);
    } catch (error) {
      setMessage(error?.message || "Baasjoone kinnitamine ebaõnnestus");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const geocoding = useMemo(() => status?.serviceMap?.geocodingStatus || {}, [status]);
  const emailChanges = status?.check?.emailChanges || [];
  const canApplyCheck = Boolean(status?.check?.fileExists && status?.check?.reportExists && status?.check?.changedContacts > 0);

  return (
    <section aria-label="KOV ja LOV kontaktiregister" className="ra-card">
      <h2 className="ra-card-title">KOV/LOV kontaktiregister</h2>
      <p className="ra-card-sub">
        Kontrollib keskse kontaktfaili `officialUrl` lehti ja Tallinna `KOV/LOV` lähtefailide URL-e.
        Veebikontroll ei kirjuta põhifaili üle, vaid loob kõrvale `kov_kontaktid_loplik.kontroll.json` faili ja võrdlusraporti.
      </p>

      <div className="ra-stats ra-stats--mini">
        <div className="ra-stat" data-tone={status?.needsRefresh || status?.check?.sourceChanged ? "warn" : "ok"}>
          <span className="ra-stat-label">Seis</span>
          <span className="ra-stat-value ra-stat-value--text">{statusText(status)}</span>
        </div>
        <div className="ra-stat">
          <span className="ra-stat-label">Kontaktfail</span>
          <span className="ra-stat-value">{formatValue(status?.counts?.existingContacts)}</span>
        </div>
        <div className="ra-stat">
          <span className="ra-stat-label">Viimati kontrollis</span>
          <span className="ra-stat-value">{formatValue(status?.check?.checkedUrls)}</span>
        </div>
        <div className="ra-stat" data-tone={Number(status?.check?.changedContacts || 0) > 0 ? "warn" : "neutral"}>
          <span className="ra-stat-label">Raporti muutused</span>
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
        {status?.needsRefresh ? (
          <Button type="button" variant="primary" size="sm" onClick={confirmBaseline} disabled={busy}>
            Kinnita baasjoon
          </Button>
        ) : null}
        <Button type="button" variant="primary" size="sm" onClick={applyCheck} disabled={busy || !canApplyCheck}>
          Uuenda põhifail
        </Button>
      </div>

      {message ? <p className="ra-status">{message}</p> : null}
      {emailChanges.length > 0 ? (
        <div aria-label="E-posti muudatused" className="ra-changes">
          {emailChanges.map((change) => (
            <div key={`${change.index}-${change.field}`} className="ra-change">
              <div>
                {change.name || "Kontakt"} <span className="ra-mono">({change.slug || "-"})</span>
              </div>
              <div>Vana: {change.oldValue || "-"}</div>
              <div>Uus: {change.newValue || "-"}</div>
            </div>
          ))}
        </div>
      ) : status?.check?.reportExists ? (
        <p className="ra-log">Viimases raportis e-posti muudatusi ei olnud.</p>
      ) : null}
      {status?.check?.reportExists ? (
        <p className="ra-log">
          Viimane raport: {status.check.reportFile}; kandidaatfail: {status.check.outputFile}.
          {status.check.appliedAt ? ` Rakendatud: ${status.check.appliedAt}.` : ""}
        </p>
      ) : null}
      {status?.generatedAt ? <p className="ra-log">Viimane koondamine: {status.generatedAt}</p> : null}
    </section>
  );
}
