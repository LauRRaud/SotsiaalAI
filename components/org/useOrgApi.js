"use client";

import { useCallback, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

/**
 * Ühine org-API kutsuja. Kaks asja, mida ta teeb ja mida iga vaade muidu ise
 * valesti teeks:
 *   1. tõlgib serveri `messageKey` kasutaja keelde — server saadab VÕTME, mitte
 *      teksti, sest veateade ei tohi kanda serveri sisu;
 *   2. hoiab `busy` seisu, et topeltklikk ei saadaks kahte kirjutust.
 */
export function useOrgApi() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const call = useCallback(
    async (url, { method = "GET", body, fallbackKey = "org.errors.request_failed" } = {}) => {
      setBusy(true);
      setError("");
      try {
        const response = await fetch(url, {
          method,
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
          setError(resolveApiMessage({ payload, t, fallbackKey }));
          return null;
        }
        return payload;
      } catch {
        setError(t(fallbackKey));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [t]
  );

  return { call, busy, error, setError };
}
