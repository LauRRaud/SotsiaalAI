"use client";

import { useEffect, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { HOME_CARE_LIMITS } from "@/lib/homeCare/constants";
import { composeMonthSheet, monthSheetState } from "@/lib/homeCare/monthSheet";

import { formatDateTime, homeCareBase, useHomeCareApi } from "../homeCareClient";
import { planDayLabel } from "../plan/planRows";

/**
 * Kuu kokkuvõte: olek ja päringud. Kolm konksu ühes osas, igaüks oma asja kohta;
 * vaated on ühised (../client/PartViews.jsx), kokku paneb need ./Month.jsx.
 *  - `useMonth`            kuu andmed, kuu vahetus ja tabel failina
 *  - `useMonthLock`        kuu lukustamine ja uuesti avamine (K5-p)
 *  - `useMonthStatements`  kliendi kuulehed paberil (K6-e)
 */
export function useMonth({ organizationId, timeZone, initial }) {
  const { t } = useI18n();
  const { call, busy, error } = useHomeCareApi();
  const [data, setData] = useState(initial);

  /* Tagastab true, kui kuu on laaditud. */
  const load = async (month) => {
    if (!month) return false;
    const result = await call(`${homeCareBase(organizationId)}/kuu?kuu=${encodeURIComponent(month)}`, {
      fallbackKey: "home_care.errors.list_failed"
    });
    if (result.ok) setData(result.data);
    return result.ok;
  };

  const sheetState = monthSheetState(data);

  /* Kuu tabel failina (K5-q): sellest, mida leht näitab; faili teisel real on kirjas, kas arvud on lukus. */
  const download = () => {
    const text = composeMonthSheet(t, data, { dateTime: (value) => formatDateTime(value, timeZone), day: planDayLabel });
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `koduteenus-kuu-${data.month}${sheetState === "LOCKED" ? "-lukus" : ""}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return { data, setData, load, download, sheetState, busy, error };
}

/**
 * Kuu lukustamine (K5-p): lukustamata kuu kahe sammuga lukustamine (hooldusjuht näeb enne kinnitamist, mis arvud
 * lukku lähevad); lukustatud kuu uuesti avamine põhjusega.
 */
export function useMonthLock({ organizationId, data, onChange, onReload }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const [reason, setReason] = useState("");
  const lock = data.lock;
  const url = `${homeCareBase(organizationId)}/kuu/lukk`;

  /* Tagastab true, kui kuu on lukus. */
  const doLock = async () => {
    const result = await call(url, {
      method: "POST",
      body: { month: data.month, seen: { visits: data.totals.visits, minutes: data.totals.minutes, open: lock.openItemCount } },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (result.ok) {
      onChange(result.data);
      return true;
    }
    /* Arvud muutusid vahepeal või keegi jõudis ette: näita uut seisu; veateade jääb ette. */
    if (result.status === 409) onReload?.();
    return false;
  };

  /* Tagastab true, kui kuu on uuesti avatud. */
  const doReopen = async () => {
    const result = await call(url, { method: "PATCH", body: { month: data.month, reason }, fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) {
      onChange(result.data);
      setReason("");
    }
    return result.ok;
  };

  return { reason, setReason, doLock, doReopen, busy, error, setError, limit: HOME_CARE_LIMITS.MONTH_REOPEN_REASON_MAX };
}

/**
 * Kliendi kuulehed (K6-e): suure kirjaga leht iga kliendi koju selle kohta, mis päevadel käidi ja mis jäi ära. Lehed
 * avanevad uues aknas ja prinditakse brauserist. Asutuse telefoninumber on sama, mis külmkapilehel, ja jääb sellesse
 * seadmesse meelde. Kui kliente on palju, tulevad lehed mitmes osas.
 */
export function useMonthStatements({ organizationId, month }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const [phone, setPhone] = useState("");
  const [parts, setParts] = useState(1);
  const storageKey = `hc-fridge-phone:${organizationId}`;

  useEffect(() => {
    try {
      setPhone(window.localStorage.getItem(storageKey) || "");
    } catch {
      /* Privaatses aknas võib salvestus puududa: väli jääb tühjaks. */
    }
  }, [storageKey]);

  /* Teise kuu lehtede osade arv selgub alles esimese avamisega. */
  useEffect(() => {
    setParts(1);
  }, [month]);

  const open = async (part) => {
    /* Aken avatakse KOHE vajutuse peale: pärast päringut avatud akna blokeeriks brauser hüpikaknana. */
    const sheet = window.open("", "_blank");
    const result = await call(`${homeCareBase(organizationId)}/kuu/kuuleht`, {
      method: "POST",
      body: { month, part, phone },
      fallbackKey: "home_care.errors.open_failed"
    });
    if (!result.ok) {
      sheet?.close();
      return;
    }
    setParts(result.data.parts || 1);
    try {
      window.localStorage.setItem(storageKey, phone.trim());
    } catch {
      /* Meeldejätmine on mugavus, mitte nõue. */
    }
    if (!sheet) {
      setError(t("home_care.fridge.popup_blocked"));
      return;
    }
    sheet.document.open();
    sheet.document.write(result.data.html);
    sheet.document.close();
  };

  return { phone, setPhone, parts, open, busy, error, setError };
}
