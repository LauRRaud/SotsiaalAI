"use client";

import { useCallback, useEffect, useState } from "react";

import Button from "@/components/ui/Button";

import { getRagAdminCopy } from "./ragAdminCopy";

export default function RagAdminMasterSourcesPanel({ locale }) {
  const copy = getRagAdminCopy(locale).masterSources;
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/rag/master-sources", { cache: "no-store", credentials: "same-origin" });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.message || copy.loadError);
      setStatus(data);
    } catch (loadError) {
      setError(loadError?.message || copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError]);
  useEffect(() => { load(); }, [load]);
  const rows = status?.queue || [];
  return <section aria-label={copy.title} className="ra-card">
    <h2 className="ra-card-title">{copy.title}</h2>
    <p className="ra-card-sub">{copy.body}</p>
    <div className="ra-actions"><Button type="button" variant="primary" size="sm" onClick={load} disabled={loading}>{copy.refresh}</Button></div>
    {loading ? <p className="ra-status">{copy.loading}</p> : null}
    {error ? <p role="alert" className="ra-status">{error}</p> : null}
    {!loading && !error && status?.state === "degraded" ? <p className="ra-status">{copy.degraded}</p> : null}
    {!loading && !error && status?.state === "empty" ? <p className="ra-log">{copy.empty}</p> : null}
    {!loading && !error && rows.length ? <div className="ra-changes" aria-label={copy.queueLabel}>
      {rows.map(row => <div className="ra-change" key={row.source_id}><div>{row.status}</div><div>{row.source_id}</div><div>{row.candidate_status || row.route || copy.review}</div></div>)}
    </div> : null}
    {status?.truncated ? <p className="ra-log">{copy.truncated}</p> : null}
  </section>;
}
