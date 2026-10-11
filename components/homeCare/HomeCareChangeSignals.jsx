"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CARE_CHANGE_OUTCOMES, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { formatDateTime, homeCareBase, useHomeCareApi } from "./homeCareClient";

/** Üks rida märkamise kohta: valdkond ja miks see tekkis. Sama tekst kliendi lehel ja tähtaegade lehel. */
export function changeSignalLine(t, signal) {
  return `${t(`home_care.change.areas.${signal.area}`)} · ${t(`home_care.change.reasons.${signal.reason}`)}`;
}

/** Kui kaua märkamine on vastust oodanud. */
export function changeWaitingText(t, signal) {
  return signal.days > 0 ? t("home_care.change.waiting_days", { days: signal.days }) : t("home_care.change.waiting_today");
}

/**
 * Märkamised, mis vajavad vastust (K5-a). Ainult hooldusjuhile. Märkamine tekib, kui kaks
 * eri hooldajat märgivad 14 päeva jooksul sama valdkonna või üks märgib suure muutuse.
 * Vastus ütleb, mida tehti; vastatud märkamist enam ei muudeta.
 */
export default function HomeCareChangeSignals({ organizationId, initial = null, timeZone }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const [signals, setSignals] = useState(initial || { open: [], handled: [] });
  const [answering, setAnswering] = useState("");
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");

  const start = (signal) => {
    setOutcome("");
    setNote("");
    setError("");
    setAnswering(signal.id);
  };

  const save = async (event) => {
    event.preventDefault();
    const result = await call(`${homeCareBase(organizationId)}/muutused/${encodeURIComponent(answering)}`, {
      method: "PATCH",
      body: { outcome, note },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    setSignals(result.data.changeSignals || { open: [], handled: [] });
    setAnswering("");
  };

  if (!signals.open.length && !signals.handled.length) return null;

  return (
    <section className="hc-section" aria-labelledby={`${fieldId}-title`}>
      <h2 className="hc-section-title" id={`${fieldId}-title`}>
        {t("home_care.change.signals_title")}
        {signals.open.length ? ` · ${signals.open.length}` : ""}
      </h2>

      {signals.open.length ? <p className="hc-notice hc-notice--warn">{t("home_care.change.signals_hint")}</p> : null}
      <ul className="hc-list hc-list--plain">
        {signals.open.map((signal) => (
          <li key={signal.id}>
            <span>
              {changeSignalLine(t, signal)} · {changeWaitingText(t, signal)}
            </span>
            {answering === signal.id ? (
              <form className="hc-form" onSubmit={save} aria-busy={busy}>
                <div className="hc-field">
                  <span className="hc-label">{t("home_care.change.outcome_label")}</span>
                  <div className="hc-chips" role="group" aria-label={t("home_care.change.outcome_label")}>
                    {CARE_CHANGE_OUTCOMES.map((value) => (
                      <button key={value} type="button" className="hc-chip" aria-pressed={outcome === value} onClick={() => setOutcome(value)}>
                        {t(`home_care.change.outcomes.${value}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="hc-field">
                  <label className="hc-label" htmlFor={`${fieldId}-note`}>
                    {t("home_care.change.note_label")}
                  </label>
                  <input
                    id={`${fieldId}-note`}
                    className="hc-input"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={HOME_CARE_LIMITS.CHANGE_NOTE_MAX}
                    autoComplete="off"
                  />
                </div>
                {error ? (
                  <p className="hc-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="hc-row">
                  <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || !outcome}>
                    {t("home_care.change.answer_save")}
                  </button>
                  <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setAnswering("")} disabled={busy}>
                    {t("home_care.usual.cancel")}
                  </button>
                </div>
              </form>
            ) : (
              <span className="hc-row">
                <button className="hc-btn hc-btn--quiet" type="button" onClick={() => start(signal)} disabled={busy}>
                  {t("home_care.change.answer")}
                </button>
              </span>
            )}
          </li>
        ))}
        {signals.handled.map((signal) => (
          <li key={signal.id} className="hc-sub">
            {changeSignalLine(t, signal)} · {t(`home_care.change.outcomes.${signal.outcome}`)}
            {signal.note ? `: ${signal.note}` : ""} ·{" "}
            {t("home_care.change.answered_by", { name: signal.handledByName || "—", date: formatDateTime(signal.handledAt, timeZone) })}
          </li>
        ))}
      </ul>
    </section>
  );
}
