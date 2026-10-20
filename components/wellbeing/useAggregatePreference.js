"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Tööheaolu anonüümses koondis osalemise valik (TO-3): loeb ja salvestab
 * `GET/PUT /api/wellbeing/aggregate-preference`. Otsus jõustub serveris koondi
 * päringus (`lib/wellbeing/aggregatePreference.js`); siin on ainult näitamine
 * ja valiku saatmine.
 *
 * `status`: "loading" | "ready" | "error" | "saving" | "save_error".
 */
export function useWellbeingAggregatePreference() {
  const [state, setState] = useState({ status: "loading", enabled: null, chosen: false });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/wellbeing/aggregate-preference", { cache: "no-store" })
      .then((response) => response.json().catch(() => ({})).then((payload) => ({ response, payload })))
      .then(({ response, payload }) => {
        if (cancelled) return;
        if (!response.ok || !payload?.ok) {
          setState((current) => ({ ...current, status: "error" }));
          return;
        }
        setState({ status: "ready", enabled: payload.enabled !== false, chosen: payload.chosen === true });
      })
      .catch(() => {
        if (!cancelled) setState((current) => ({ ...current, status: "error" }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (enabled) => {
    setState((current) => ({ ...current, status: "saving" }));
    try {
      const response = await fetch("/api/wellbeing/aggregate-preference", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ enabled })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "save_failed");
      setState({ status: "ready", enabled: payload.enabled !== false, chosen: true });
    } catch {
      setState((current) => ({ ...current, status: "save_error" }));
    }
  }, []);

  return { ...state, save };
}
