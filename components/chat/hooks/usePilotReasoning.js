'use client';
import { useCallback, useEffect, useState } from 'react';
import { initialReasoning, readSavedReasoning, reasoningChoiceAvailable, saveReasoning, toggledReasoning } from '@/lib/chat/m4PilotReasoning';

// ADR-092: the state of the composer's menu item "Mõtle põhjalikumalt". The page renders with the plan's own effort;
// the remembered choice is read after mounting, so the server's and the browser's first render agree.
export function usePilotReasoning(offer) {
  const available = reasoningChoiceAvailable(offer);
  const quick = offer?.quick, thorough = offer?.thorough, fallback = offer?.fallback;
  const [effort, setEffort] = useState(() => initialReasoning(offer));
  useEffect(() => {
    if (available) setEffort(initialReasoning({ quick, thorough, fallback }, readSavedReasoning(() => window.localStorage)));
  }, [available, quick, thorough, fallback]);
  const toggle = useCallback(() => {
    if (!available) return;
    const next = toggledReasoning({ quick, thorough, fallback }, effort);
    saveReasoning(() => window.localStorage, next);
    setEffort(next);
  }, [available, quick, thorough, fallback, effort]);
  return { available, effort: available ? effort : null, thorough: available && effort === thorough, toggle };
}
