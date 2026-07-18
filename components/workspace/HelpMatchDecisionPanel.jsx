"use client";

import { useCallback, useEffect, useState } from "react";

import Button from "@/components/ui/Button";

function text(t, key, fallback) {
  const value = t?.(key);
  return typeof value === "string" && value !== key ? value : fallback;
}

export default function HelpMatchDecisionPanel({ t }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch("/api/help/matches", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      // The service map itself is public. An anonymous visitor simply has no
      // private consent queue; this must not turn the public page into an error.
      if (response.status === 401) {
        setItems([]);
        setStatus("ready");
        return;
      }
      if (!response.ok || payload?.ok === false) throw new Error("load");
      setItems(Array.isArray(payload?.items) ? payload.items : []);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = useCallback(async (id, decision) => {
    setBusyId(id);
    try {
      const response = await fetch(`/api/help/matches/${encodeURIComponent(id)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error("decision");
      setItems((current) => current.filter((item) => item.id !== id));
    } finally {
      setBusyId("");
    }
  }, []);

  if (status === "loading") return <p className="service-map-match-status" aria-live="polite">{text(t, "workspace_feature_pages.service_map.match.loading", "Kontrollin nõusolekupäringuid…")}</p>;
  if (status === "error") return <p className="service-map-match-status" role="status">{text(t, "workspace_feature_pages.service_map.match.error", "Nõusolekupäringuid ei saanud praegu laadida.")}</p>;
  if (!items.length) return null;

  return (
    <section className="service-map-match-panel" aria-label={text(t, "workspace_feature_pages.service_map.match.title", "Ootavad nõusolekupäringud")}>
      <h2>{text(t, "workspace_feature_pages.service_map.match.title", "Ootavad nõusolekupäringud")}</h2>
      <p>{text(t, "workspace_feature_pages.service_map.match.note", "Ruum avaneb alles pärast sinu nõusolekut.")}</p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <span>{[item.categoryCode, item.regionLabel].filter(Boolean).join(" · ") || text(t, "workspace_feature_pages.service_map.match.generic", "Abikontakt")}</span>
            <div>
              <Button type="button" size="sm" onClick={() => decide(item.id, "ACCEPT")} disabled={busyId === item.id}>{text(t, "workspace_feature_pages.service_map.match.accept", "Nõustu")}</Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => decide(item.id, "DECLINE")} disabled={busyId === item.id}>{text(t, "workspace_feature_pages.service_map.match.decline", "Keeldu")}</Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
