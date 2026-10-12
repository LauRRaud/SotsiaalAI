"use client";

import { useEffect, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";

/**
 * Lehed kliendi koju: olek ja päringud. Vaade on failis ./SlotsViews.jsx, kokku
 * paneb need ./ClientSlots.jsx.
 *
 * Külmkapileht (K5-g): prinditav suure kirjaga leht kliendi koju. Leht avaneb uues aknas
 * ja prinditakse brauserist. Asutuse telefoninumber jääb sellesse seadmesse meelde, et
 * seda ei peaks iga kliendi juures uuesti kirjutama; serverisse seda ei salvestata.
 *
 * Sama telefoniväljaga käib kliendi kuuleht (K6-e): hooldusjuht avab siit ühe kliendi lehe
 * eelmise või jooksva kuu kohta.
 */
export function useClientSheets({ organizationId, clientId }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const [phone, setPhone] = useState("");
  const storageKey = `hc-fridge-phone:${organizationId}`;

  useEffect(() => {
    try {
      setPhone(window.localStorage.getItem(storageKey) || "");
    } catch {
      /* Privaatses aknas võib salvestus puududa: väli jääb tühjaks. */
    }
  }, [storageKey]);

  const openDocument = async (path, body) => {
    /* Aken avatakse KOHE vajutuse peale: pärast päringut avatud akna blokeeriks brauser hüpikaknana. */
    const sheet = window.open("", "_blank");
    const result = await call(`${homeCareBase(organizationId)}${path}`, {
      method: "POST",
      body,
      fallbackKey: "home_care.errors.open_failed"
    });
    if (!result.ok) {
      sheet?.close();
      return;
    }
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
  const open = () => openDocument(`/kliendid/${encodeURIComponent(clientId)}/kulmkapileht`, { phone });
  const openStatement = (month) => openDocument("/kuu/kuuleht", { month, clientId, phone });

  return { phone, setPhone, busy, error, setError, open, openStatement };
}
