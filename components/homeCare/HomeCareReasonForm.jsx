"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CARE_ACCESS_REASONS, CareAccessReason } from "@/lib/homeCare/constants";

import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Põhjuse küsimine meeskonda mittekuuluvalt hooldajalt.
 *
 * Kaks kohta kasutavad sama vormi: lehe avamine (sisu asemel) ja juba lahti
 * olev leht, kui päevane luba lõppes või inimene eemaldati meeskonnast. Teisel
 * juhul jääb leht alles, et pooleli olev kirje ei kaoks.
 */
export default function HomeCareReasonForm({ organizationId, clientId, writable, heading = "h1", onGranted }) {
  const { t } = useI18n();
  const { call, busy, error } = useHomeCareApi();
  const fieldId = useId();
  const [reasonCode, setReasonCode] = useState(CareAccessReason.COVERING);
  const [reasonText, setReasonText] = useState("");
  const Heading = heading;

  const submit = async (event) => {
    event.preventDefault();
    const result = await call(`${homeCareBase(organizationId)}/kliendid/${clientId}/ava`, {
      method: "POST",
      body: { reasonCode, reason: reasonText },
      fallbackKey: "home_care.errors.open_failed"
    });
    if (result.ok) await onGranted?.();
  };

  return (
    <form className="hc-section" onSubmit={submit}>
      <Heading className={heading === "h1" ? "hc-title" : "hc-section-title"}>{t("home_care.reason.title")}</Heading>
      <p className="hc-sub">{t("home_care.reason.intro")}</p>
      <div className="hc-field">
        <span className="hc-label" id={`${fieldId}-reason`}>
          {t("home_care.reason.code_label")}
        </span>
        <div className="hc-chips" role="group" aria-labelledby={`${fieldId}-reason`}>
          {CARE_ACCESS_REASONS.map((code) => (
            <button
              key={code}
              type="button"
              className="hc-chip"
              aria-pressed={reasonCode === code}
              onClick={() => setReasonCode(code)}
            >
              {t(`home_care.reason.codes.${code}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="hc-field">
        <label className="hc-label" htmlFor={`${fieldId}-reason-text`}>
          {t("home_care.reason.text_label")}
        </label>
        <input
          id={`${fieldId}-reason-text`}
          className="hc-input"
          value={reasonText}
          onChange={(event) => setReasonText(event.target.value)}
          maxLength={300}
          autoComplete="off"
        />
      </div>
      {error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="hc-row">
        <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || !writable}>
          {t("home_care.reason.submit")}
        </button>
      </div>
      {writable ? null : <p className="hc-hint">{t("home_care.client.read_only")}</p>}
    </form>
  );
}
