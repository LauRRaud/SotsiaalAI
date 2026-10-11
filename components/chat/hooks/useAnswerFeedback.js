"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Vastuse tagasiside ühe vestluse piires: millise pöörde kohta on teade juba saadetud, ja saatmine.
 * `enabled` on tõene alles siis, kui vestluses on vähemalt üks vastus, mille pöörde tunnus on teada:
 * muu vestlus (ruum, tervitus) ühtegi päringut ei tee.
 */
export function useAnswerFeedback({ convId, enabled }) {
  const [sentTurns, setSentTurns] = useState(() => new Set());
  const convRef = useRef(convId);

  useEffect(() => {
    convRef.current = convId;
    setSentTurns(new Set());
    if (!enabled || !convId) return undefined;
    const controller = new AbortController();
    fetch(`/api/answer-feedback?convId=${encodeURIComponent(convId)}`, { cache: "no-store", signal: controller.signal })
      .then(response => (response.ok ? response.json() : null))
      .then(payload => {
        if (!payload?.ok || !Array.isArray(payload.items) || convRef.current !== convId) return;
        const turns = payload.items.map(item => item?.turnId).filter(Boolean);
        if (turns.length) setSentTurns(current => new Set([...current, ...turns]));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [convId, enabled]);

  const submit = useCallback(async (turnId, { category, note }) => {
    if (!convId || !turnId) return { ok: false, messageKey: null };
    try {
      const response = await fetch("/api/answer-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ convId, turnId, category, note })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        return { ok: false, messageKey: typeof payload?.message === "string" ? payload.message : null };
      }
      if (convRef.current === convId) setSentTurns(current => new Set(current).add(turnId));
      return { ok: true, duplicate: !!payload.duplicate };
    } catch {
      return { ok: false, messageKey: null };
    }
  }, [convId]);

  return { sentTurns, submit };
}
