"use client";

import { useEffect, useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Kliendi kuulehed (K6-e): suure kirjaga leht iga kliendi koju selle kohta, mis päevadel
 * käidi ja mis jäi ära. Lehed avanevad uues aknas ja prinditakse brauserist. Asutuse
 * telefoninumber on sama, mis külmkapilehel, ja jääb sellesse seadmesse meelde.
 * Kui kliente on palju, tulevad lehed mitmes osas.
 */
export default function HomeCareMonthStatements({ organizationId, month }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
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

  return (
    <div className="hc-field">
      <label className="hc-label" htmlFor={`${fieldId}-phone`}>
        {t("home_care.statement.phone_label")}
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
      <p className="hc-hint">{t("home_care.statement.hint")}</p>
      {error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="hc-row">
        <button className="hc-btn hc-btn--quiet" type="button" onClick={() => open(1)} disabled={busy}>
          {t(parts > 1 ? "home_care.statement.open_part" : "home_care.statement.open", { part: 1, parts })}
        </button>
        {Array.from({ length: Math.max(0, parts - 1) }, (_, index) => index + 2).map((part) => (
          <button key={part} className="hc-btn hc-btn--quiet" type="button" onClick={() => open(part)} disabled={busy}>
            {t("home_care.statement.open_part", { part, parts })}
          </button>
        ))}
      </div>
      {parts > 1 ? <p className="hc-hint">{t("home_care.statement.parts_hint", { parts })}</p> : null}
    </div>
  );
}
