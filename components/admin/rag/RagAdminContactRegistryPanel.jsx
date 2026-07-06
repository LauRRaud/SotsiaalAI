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
    <section aria-label="KOV ja LOV kontaktiregister">
      <h2>KOV/LOV kontaktiregister</h2>
      <p>
        Kontrollib keskse kontaktfaili `officialUrl` lehti ja Tallinna `KOV/LOV` lähtefailide URL-e.
        Veebikontroll ei kirjuta põhifaili üle, vaid loob kõrvale `kov_kontaktid_loplik.kontroll.json` faili ja võrdlusraporti.
      </p>

      <div>
        <div>
          <div>Seis</div>
          <div>{statusText(status)}</div>
        </div>
        <div>
          <div>Kontaktfail</div>
          <div>{formatValue(status?.counts?.existingContacts)}</div>
        </div>
        <div>
          <div>Viimati kontrollis</div>
          <div>{formatValue(status?.check?.checkedUrls)}</div>
        </div>
        <div>
          <div>Raporti muutused</div>
          <div>{formatValue(status?.check?.changedContacts)}</div>
        </div>
      </div>

      {status?.serviceMap?.ok ? (
        <p>
          Geokodeerimine: MATCHED {formatValue(geocoding.MATCHED || 0)}, PENDING {formatValue(geocoding.PENDING || 0)},
          FAILED {formatValue(geocoding.FAILED || 0)}.
        </p>
      ) : null}

      <div>
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

      {message ? <p>{message}</p> : null}
      {emailChanges.length > 0 ? (
        <div aria-label="E-posti muudatused">
          {emailChanges.map((change) => (
            <div key={`${change.index}-${change.field}`}>
              <div>
                {change.name || "Kontakt"} <span>({change.slug || "-"})</span>
              </div>
              <div>Vana: {change.oldValue || "-"}</div>
              <div>Uus: {change.newValue || "-"}</div>
            </div>
          ))}
        </div>
      ) : status?.check?.reportExists ? (
        <p>Viimases raportis e-posti muudatusi ei olnud.</p>
      ) : null}
      {status?.check?.reportExists ? (
        <p>
          Viimane raport: {status.check.reportFile}; kandidaatfail: {status.check.outputFile}.
          {status.check.appliedAt ? ` Rakendatud: ${status.check.appliedAt}.` : ""}
        </p>
      ) : null}
      {status?.generatedAt ? <p>Viimane koondamine: {status.generatedAt}</p> : null}
    </section>
  );
}
