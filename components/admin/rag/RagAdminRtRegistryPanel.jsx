"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return new Intl.NumberFormat("et-EE").format(value);
  return String(value);
}

function statusText(status) {
  if (!status?.reportExists) return "Kontrollimata";
  if ((status?.check?.changedEntries || 0) > 0) return "Vajab ülevaatust";
  return "Ajakohane";
}

function describeFields(fields = []) {
  const names = fields.map((field) => field.field).filter(Boolean);
  return names.length ? names.join(", ") : "muudatus";
}

export default function RagAdminRtRegistryPanel() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadStatus = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/rag/rt-registry", {
        cache: "no-store",
        credentials: "same-origin"
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.message || "RT kontroll ebaõnnestus");
      setStatus(data);
    } catch (error) {
      setMessage(error?.message || "RT kontroll ebaõnnestus");
    } finally {
      setBusy(false);
    }
  }, []);

  const runWebCheck = useCallback(async () => {
    setBusy(true);
    setMessage("Kontrollin Riigi Teataja kehtivaid XML-e ja koostan võrdlusfaili...");
    try {
      const response = await fetch("/api/admin/rag/rt-registry", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "web-check" })
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.message || "RT veebikontroll ebaõnnestus");
      setStatus(data.status);
      setMessage(`RT kontrollfail loodud: ${formatValue(data?.result?.changedEntries || 0)} muudetud akti, ${formatValue(data?.result?.downloadedXml || 0)} XML faili alla laaditud.`);
    } catch (error) {
      setMessage(error?.message || "RT veebikontroll ebaõnnestus");
    } finally {
      setBusy(false);
    }
  }, []);

  const applyCheck = useCallback(async () => {
    setBusy(true);
    setMessage("Rakendan RT kontrollfaili põhimanifestiks...");
    try {
      const response = await fetch("/api/admin/rag/rt-registry", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply-check" })
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.message || "RT kontrollfaili rakendamine ebaõnnestus");
      setStatus(data.status);
      setMessage(`RT põhifail uuendatud. Varukoopia: ${data?.result?.backupDir || "-"}.`);
    } catch (error) {
      setMessage(error?.message || "RT kontrollfaili rakendamine ebaõnnestus");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const changes = useMemo(() => status?.check?.changes || [], [status]);
  const canApplyCheck = Boolean(status?.checkFileExists && status?.reportExists && (status?.check?.changedEntries || 0) > 0);

  return (
    <section aria-label="KOV RT register">
      <h2>KOV/LOV Riigi Teataja register</h2>
      <p>
        Kontrollib `KOV/kov_rt/kov_rt_manifest.json` aktide `?leiaKehtiv` URL-e, leiab kehtiva XML-i ja võrdleb seda kohaliku XML failiga.
        Põhimanifesti ei muudeta enne, kui kontrollfail on üle vaadatud ja kinnitatud.
      </p>

      <div>
        <div>
          <div>Seis</div>
          <div>{statusText(status)}</div>
        </div>
        <div>
          <div>RT kirjed</div>
          <div>{formatValue(status?.counts?.entries)}</div>
        </div>
        <div>
          <div>Viimati kontrollis</div>
          <div>{formatValue(status?.check?.checkedUrls)}</div>
        </div>
        <div>
          <div>Muudetud aktid</div>
          <div>{formatValue(status?.check?.changedEntries)}</div>
        </div>
      </div>

      <div>
        <Button type="button" variant="primary" size="sm" onClick={loadStatus} disabled={busy}>
          Kontrolli seisu
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={runWebCheck} disabled={busy}>
          Käivita RT veebikontroll
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={applyCheck} disabled={busy || !canApplyCheck}>
          Uuenda RT põhifail
        </Button>
      </div>

      {message ? <p>{message}</p> : null}
      {changes.length > 0 ? (
        <div aria-label="RT muudatused">
          {changes.map((change) => (
            <div key={`${change.slug}-${change.newActReference || change.actReference || change.xmlFile}`}>
              <div>
                {change.slug || "KOV"} <span>({change.title || "-"})</span>
              </div>
              <div>
                {change.actReference || "-"} → {change.newActReference || "-"}
              </div>
              <div>
                {describeFields(change.fields)}
                {change.xmlChanged ? "; XML sisu muutus" : ""}
              </div>
            </div>
          ))}
        </div>
      ) : status?.reportExists ? (
        <p>Viimases RT raportis muudatusi ei olnud.</p>
      ) : null}
      {status?.reportExists ? (
        <p>
          Viimane raport: {status.check.reportFile}; kandidaatmanifest: {status.check.outputFile}; XML kandidaadid: {status.check.candidateXmlDir}.
          {status.check.appliedAt ? ` Rakendatud: ${status.check.appliedAt}.` : ""}
        </p>
      ) : null}
    </section>
  );
}
