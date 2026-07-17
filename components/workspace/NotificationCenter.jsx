"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

function text(t, key, fallback) {
  return typeof t === "function" ? t(key, fallback) : fallback;
}

function formatDate(value, locale) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale || "et", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Tallinn"
  }).format(date);
}

export default function NotificationCenter({ t, locale = "et", onOpen, onStale, refreshKey = "" }) {
  const [state, setState] = useState({ status: "loading", events: [] });
  const [announcement, setAnnouncement] = useState("");

  const load = useCallback(async (signal) => {
    try {
      const response = await fetch("/api/notifications?limit=7", {
        cache: "no-store", headers: { Accept: "application/json" }, signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok !== true) throw new Error("notification_load_failed");
      setState({ status: "ready", events: Array.isArray(payload.events) ? payload.events : [] });
    } catch (error) {
      if (error?.name !== "AbortError") setState({ status: "error", events: [] });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading", events: [] });
    setAnnouncement("");
    load(controller.signal);
    return () => controller.abort();
  }, [load, refreshKey]);

  const unread = useMemo(
    () => state.events.reduce((count, event) => count + (event.readAt ? 0 : 1), 0),
    [state.events]
  );

  const update = useCallback(async (eventId, operation) => {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ eventId, operation })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true) {
      const error = new Error("notification_update_failed");
      error.status = response.status;
      throw error;
    }
  }, []);

  const openEvent = useCallback(async (event) => {
    if (!event?.href?.startsWith("/")) return;
    if (!event.readAt && event.ackMode === "read") {
      try {
        await update(event.id, "read");
        setState((current) => ({
          ...current,
          events: current.events.map((item) => item.id === event.id
            ? { ...item, readAt: new Date().toISOString() } : item)
        }));
      } catch (error) {
        if (error?.status === 404) {
          setState((current) => ({ status: "ready", events: current.events.filter((item) => item.id !== event.id) }));
          setAnnouncement(text(t, "notifications.center.target_gone", "See tegevus ei ole enam saadaval. Töölaud on värskendatud."));
          onStale?.();
          return;
        }
        setState((current) => ({ ...current, status: "error" }));
        return;
      }
    }
    onOpen?.(event.href);
  }, [onOpen, onStale, t, update]);

  const dismiss = useCallback(async (eventId) => {
    try {
      await update(eventId, "dismiss");
      setState((current) => ({
        status: "ready", events: current.events.filter((event) => event.id !== eventId)
      }));
    } catch (error) {
      if (error?.status === 404) {
        setState((current) => ({ status: "ready", events: current.events.filter((event) => event.id !== eventId) }));
        setAnnouncement(text(t, "notifications.center.target_gone", "See tegevus ei ole enam saadaval. Töölaud on värskendatud."));
        onStale?.();
        return;
      }
      setState((current) => ({ ...current, status: "error" }));
    }
  }, [onStale, t, update]);

  return (
    <section className="notification-center" aria-labelledby="notification-center-title" aria-busy={state.status === "loading"}>
      <header>
        <div>
          <span aria-hidden="true">✦</span>
          <h2 id="notification-center-title">{text(t, "notifications.center.title", "Teavitused")}</h2>
          {unread ? <span className="notification-center-badge" aria-label={text(t, "notifications.center.unread", "Lugemata")}>{unread}</span> : null}
        </div>
        <small>{text(t, "notifications.center.limit", "Viimased 7")}</small>
      </header>

      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>

      {state.status === "loading" ? (
        <p className="notification-center-state" role="status">{text(t, "notifications.center.loading", "Laadin teavitusi…")}</p>
      ) : state.status === "error" ? (
        <div className="notification-center-state" role="alert">
          <span>{text(t, "notifications.center.error", "Teavitusi ei saanud laadida.")}</span>
          <button type="button" onClick={() => load()}>{text(t, "notifications.center.retry", "Proovi uuesti")}</button>
        </div>
      ) : state.events.length ? (
        <ul>
          {state.events.map((event) => (
            <li key={event.id} data-unread={event.readAt ? "false" : "true"}>
              <button type="button" className="notification-center-open" onClick={() => openEvent(event)}>
                <span className="notification-center-dot" aria-hidden="true" />
                <span>{text(t, event.labelKey, event.type)}</span>
                <time dateTime={event.createdAt}>{formatDate(event.createdAt, locale)}</time>
                <span aria-hidden="true">→</span>
              </button>
              <button type="button" className="notification-center-dismiss" onClick={() => dismiss(event.id)} aria-label={text(t, "notifications.center.dismiss", "Peida teavitus")}>×</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="notification-center-state">{text(t, "notifications.center.empty", "Uusi teavitusi ei ole.")}</p>
      )}
    </section>
  );
}
