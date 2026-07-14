"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";

export default function RagAdminSourceFeedbackScreen({ locale = "en" }) {
  const et = String(locale).startsWith("et");
  const [items, setItems] = useState([]);
  const [state, setState] = useState("loading");
  const [notes, setNotes] = useState({});

  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch("/api/admin/source-feedback?status=OPEN", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error("load_failed");
      setItems(payload.items || []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function resolve(item) {
    const resolutionNote = String(notes[item.id] || "").trim();
    if (!resolutionNote) return;
    setState(`resolving:${item.id}`);
    try {
      const response = await fetch(`/api/admin/source-feedback/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutionNote })
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error("resolve_failed");
      setItems(current => current.filter(entry => entry.id !== item.id));
      setState("ready");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="ra-grid" aria-busy={state === "loading" ? "true" : "false"}>
      <section className="ra-card ra-col-12">
        <div className="ra-card-head">
          <h2>{et ? "Avatud teated" : "Open reports"}</h2>
          <Button type="button" size="sm" onClick={load}>{et ? "Värskenda" : "Refresh"}</Button>
        </div>
        {state === "loading" ? <p>{et ? "Laadin…" : "Loading…"}</p> : null}
        {state === "error" ? <p role="alert">{et ? "Toiming ebaõnnestus." : "The action failed."}</p> : null}
        {state !== "loading" && items.length === 0 ? <p>{et ? "Avatud teateid ei ole." : "There are no open reports."}</p> : null}
        <div className="ra-source-feedback-list">
          {items.map(item => (
            <article key={item.id} className="ra-source-feedback-item">
              <div>
                <strong>{item.category}</strong>
                <code>{item.sourceId}</code>
                <span>{item.sourceType}</span>
                <time dateTime={item.createdAt}>{new Intl.DateTimeFormat(et ? "et-EE" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</time>
              </div>
              {item.note ? <p>{item.note}</p> : null}
              <label>
                <span>{et ? "Lahenduse auditi märkus" : "Resolution audit note"}</span>
                <textarea rows={2} maxLength={1000} value={notes[item.id] || ""} onChange={event => setNotes(current => ({ ...current, [item.id]: event.target.value }))} />
              </label>
              <Button type="button" onClick={() => resolve(item)} disabled={!String(notes[item.id] || "").trim() || state === `resolving:${item.id}`}>
                {state === `resolving:${item.id}` ? (et ? "Lahendan…" : "Resolving…") : (et ? "Märgi lahendatuks" : "Resolve")}
              </Button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
