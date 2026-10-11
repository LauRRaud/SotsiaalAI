"use client";

import { useEffect, useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Külmkapileht (K5-g): prinditav suure kirjaga leht kliendi koju. Leht avaneb uues aknas
 * ja prinditakse brauserist. Asutuse telefoninumber jääb sellesse seadmesse meelde, et
 * seda ei peaks iga kliendi juures uuesti kirjutama; serverisse seda ei salvestata.
 *
 * Sama telefoniväljaga käib kliendi kuuleht (K6-e): hooldusjuht avab siit ühe kliendi lehe
 * eelmise või jooksva kuu kohta. `showFridge` on väär, kui kliendil ei ole käigumustrit.
 */
export default function HomeCareFridgeSheet({ organizationId, clientId, showFridge = true, canStatement = false }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
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

  return (
    <div className="hc-field">
      <label className="hc-label" htmlFor={`${fieldId}-phone`}>
        {t("home_care.fridge.phone_label")}
      </label>
      <input
        id={`${fieldId}-phone`}
        className="hc-input"
        type="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        maxLength={HOME_CARE_LIMITS.REFERRAL_PHONE_MAX}
        autoComplete="off"
      />
      {showFridge ? <p className="hc-hint">{t("home_care.fridge.hint")}</p> : null}
      {canStatement ? <p className="hc-hint">{t("home_care.statement.hint_client")}</p> : null}
      {error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="hc-row">
        {showFridge ? (
          <button className="hc-btn hc-btn--quiet" type="button" onClick={open} disabled={busy}>
            {t("home_care.fridge.open")}
          </button>
        ) : null}
        {canStatement ? (
          <>
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => openStatement("previous")} disabled={busy}>
              {t("home_care.statement.open_previous")}
            </button>
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => openStatement("current")} disabled={busy}>
              {t("home_care.statement.open_current")}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
