"use client";

import { useCallback, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

/**
 * KODUTEENUS K1 — brauseripoolne API kutsuja ja ajavormingud.
 *
 * Erinevus `useOrgApi`-st: tagastab ka ebaõnnestunud vastuse `status` ja
 * `messageKey`. Kliendi leht peab eristama „vali põhjus" (403 kindla võtmega)
 * tavalisest veast, ja kirje vorm peab vea korral teksti alles hoidma.
 */
export const ACCESS_REASON_REQUIRED = "home_care.errors.access_reason_required";

export function homeCareBase(organizationId) {
  return `/api/org/${encodeURIComponent(organizationId)}/koduteenus`;
}

export function useHomeCareApi() {
  const { t, locale } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const call = useCallback(
    async (url, { method = "GET", body, fallbackKey = "home_care.errors.request_failed", quiet = false } = {}) => {
      setBusy(true);
      if (!quiet) setError("");
      try {
        const headers = { "x-ui-locale": locale || "et" };
        if (body !== undefined) headers["Content-Type"] = "application/json";
        const response = await fetch(url, {
          method,
          headers,
          cache: "no-store",
          body: body !== undefined ? JSON.stringify(body) : undefined
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
          const messageKey = typeof payload?.messageKey === "string" ? payload.messageKey : "";
          const message = resolveApiMessage({ payload, t, fallbackKey });
          if (!quiet) setError(message);
          return { ok: false, status: response.status, messageKey, message };
        }
        return { ok: true, status: response.status, data: payload };
      } catch {
        const message = t(fallbackKey);
        if (!quiet) setError(message);
        return { ok: false, status: 0, messageKey: "", message };
      } finally {
        setBusy(false);
      }
    },
    [locale, t]
  );

  return { call, busy, error, setError };
}

/**
 * Kuupäev ja kellaaeg ASUTUSE ajavööndis kujul `09.10.2026 14:05`.
 *
 * Numbriline kuju on meelega käsitsi kokku pandud: `toLocaleString` annab
 * serveris ja brauseris eri ICU versiooniga eri tühikuid ja hüdreerimine läheb
 * lahku. Ajavöönd tuleb asutuselt, mitte seadmelt, et sama kirje näitaks
 * kõigile sama kellaaega.
 */
export function formatDateTime(isoValue, timeZone) {
  const parts = dateParts(isoValue, timeZone);
  if (!parts) return "";
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}

export function formatTime(isoValue, timeZone) {
  const parts = dateParts(isoValue, timeZone);
  return parts ? `${parts.hour}:${parts.minute}` : "";
}

function dateParts(isoValue, timeZone) {
  if (!isoValue) return null;
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return null;
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone || "Europe/Tallinn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    });
  } catch {
    return null;
  }
  const out = {};
  for (const part of formatter.formatToParts(date)) out[part.type] = part.value;
  return out.year ? out : null;
}

/** Kliendi lehe aadress. Organisatsiooni ID on teel, kliendi nimi ei ole. */
export function clientHref(organizationId, clientId) {
  return `/org/${organizationId}/koduteenus/kliendid/${clientId}`;
}
