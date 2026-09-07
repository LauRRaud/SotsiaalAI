'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { readPilotIntentContext } from '@/lib/chat/m4PilotIntent';

const INITIAL = Object.freeze({ contextMode: 'same' });

export function usePilotDialogue({ enabled, convId }) {
  const [loaded, setLoaded] = useState(null), [choice, setChoice] = useState(null);
  const sequence = useRef(0);
  const activeConversation = useRef(null);
  const invalidate = useCallback(() => { sequence.current++; activeConversation.current = null; }, []);
  const refresh = useCallback(async ({ accepted = false } = {}) => {
    if (!enabled || !convId || activeConversation.current !== convId) return;
    const request = ++sequence.current;
    if (accepted) setChoice({ convId, value: INITIAL });
    try {
      const response = await fetch(`/api/chat/pilot?context=1&convId=${encodeURIComponent(convId)}`, { cache: 'no-store' });
      const value = await response.json();
      if (!response.ok) throw Error('context_unavailable');
      if (request === sequence.current) setLoaded({ convId, value });
    } catch {
      if (request === sequence.current) setLoaded({ convId, error: true });
    }
  }, [enabled, convId]);
  useEffect(() => {
    if (enabled && convId) {
      activeConversation.current = convId;
      const pending = readPilotIntentContext(window.sessionStorage, convId);
      setChoice({ convId, value: pending || INITIAL });
      void refresh();
    }
    return invalidate;
  }, [enabled, convId, refresh, invalidate]);
  return { enabled, data: loaded?.convId === convId ? loaded.value : null,
    ready: !enabled || !convId || loaded?.convId === convId && !!loaded.value,
    error: loaded?.convId === convId && loaded.error,
    selection: choice?.convId === convId ? choice.value : INITIAL,
    select: value => setChoice({ convId, value }), refresh };
}
