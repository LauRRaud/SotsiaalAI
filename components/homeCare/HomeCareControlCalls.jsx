"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import DateField from "@/components/ui/DateField";
import { CARE_CONTROL_CALL_OUTCOMES, CARE_CONTROL_CALL_PARTIES, CareControlCallOutcome, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { planDayLabel } from "./HomeCarePlanView";
import { homeCareBase, useHomeCareApi } from "./homeCareClient";

const EMPTY = { calledOn: "", outcome: "", spokeWith: "", note: "" };

/**
 * Hooldusjuhi kontrollkõne kliendile (K6-l): kord kvartalis helistab hooldusjuht ise ja küsib,
 * kas käigud on toimunud nii, nagu kirjas. Jaotist näeb ainult hooldusjuht; meeskonnale seda
 * ei näidata. Ekslik kirje tühistatakse, ei kustutata.
 */
export default function HomeCareControlCalls({ organizationId, clientId, initial = null, canEdit = false }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const [view, setView] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);

  if (!view) return null;

  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/kontrollkoned`;
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const reached = form.outcome && form.outcome !== CareControlCallOutcome.NOT_REACHED;
  const noteRequired = form.outcome === CareControlCallOutcome.DIFFERS;

  const start = () => {
    setForm(EMPTY);
    setError("");
    setAdding(true);
  };

  const save = async (event) => {
    event.preventDefault();
    const result = await call(base, {
      method: "POST",
      body: { calledOn: form.calledOn || null, outcome: form.outcome, spokeWith: reached ? form.spokeWith : null, note: form.note },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    setView(result.data.controlCalls);
    setAdding(false);
  };

  const retract = async (item) => {
    const result = await call(`${base}/${encodeURIComponent(item.id)}`, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) setView(result.data.controlCalls);
  };

  return (
    <section className="hc-section" aria-labelledby={`${fieldId}-title`}>
      <h2 className="hc-section-title" id={`${fieldId}-title`}>
        {t("home_care.control_call.title")}
      </h2>
      <p className="hc-hint">{t("home_care.control_call.hint")}</p>
      <p className={view.due ? "hc-notice hc-notice--warn" : "hc-sub"}>
        {view.lastReachedOn ? t("home_care.control_call.last_line", { date: planDayLabel(view.lastReachedOn) }) : t("home_care.control_call.never")}
        {view.due ? ` ${t("home_care.control_call.due")}` : ""}
      </p>

      {view.items.length ? (
        <ul className="hc-list hc-list--plain">
          {view.items.map((item) => (
            <li key={item.id}>
              <span>
                {planDayLabel(item.calledOn)} · {t(`home_care.control_call.outcomes.${item.outcome}`)}
                {item.spokeWith ? ` · ${t(`home_care.control_call.parties.${item.spokeWith}`)}` : ""}
                {item.byName ? ` · ${item.byName}` : ""}
              </span>
              {item.note ? <p className="hc-sub">{item.note}</p> : null}
              {canEdit && !adding ? (
                <span className="hc-row">
                  <button className="hc-btn hc-btn--quiet" type="button" onClick={() => retract(item)} disabled={busy}>
                    {t("home_care.control_call.retract")}
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {adding ? (
        <form className="hc-form" onSubmit={save} aria-busy={busy}>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.control_call.day_label")}</span>
            <DateField name="controlCallOn" value={form.calledOn} onChange={(value) => setField("calledOn", value || "")} ariaLabel={t("home_care.control_call.day_label")} />
            <p className="hc-hint">{t("home_care.control_call.day_hint")}</p>
          </div>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.control_call.outcome_label")}</span>
            <div className="hc-chips" role="group" aria-label={t("home_care.control_call.outcome_label")}>
              {CARE_CONTROL_CALL_OUTCOMES.map((outcome) => (
                <button key={outcome} type="button" className="hc-chip" aria-pressed={form.outcome === outcome} onClick={() => setField("outcome", outcome)}>
                  {t(`home_care.control_call.outcomes.${outcome}`)}
                </button>
              ))}
            </div>
          </div>
          {reached ? (
            <div className="hc-field">
              <span className="hc-label">{t("home_care.control_call.party_label")}</span>
              <div className="hc-chips" role="group" aria-label={t("home_care.control_call.party_label")}>
                {CARE_CONTROL_CALL_PARTIES.map((party) => (
                  <button key={party} type="button" className="hc-chip" aria-pressed={form.spokeWith === party} onClick={() => setField("spokeWith", party)}>
                    {t(`home_care.control_call.parties.${party}`)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-note`}>
              {t("home_care.control_call.note_label")}
            </label>
            <input
              id={`${fieldId}-note`}
              className="hc-input"
              value={form.note}
              onChange={(event) => setField("note", event.target.value)}
              maxLength={HOME_CARE_LIMITS.CONTROL_CALL_NOTE_MAX}
              autoComplete="off"
              required={noteRequired}
            />
            {noteRequired ? <p className="hc-hint">{t("home_care.control_call.note_hint")}</p> : null}
          </div>
          {error ? (
            <p className="hc-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="hc-row">
            <button
              className="hc-btn hc-btn--primary"
              type="submit"
              disabled={busy || !form.outcome || (reached && !form.spokeWith) || (noteRequired && !form.note.trim())}
            >
              {t("home_care.control_call.save")}
            </button>
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setAdding(false)} disabled={busy}>
              {t("home_care.control_call.cancel")}
            </button>
          </div>
        </form>
      ) : canEdit ? (
        <div className="hc-row">
          <button className="hc-btn hc-btn--quiet" type="button" onClick={start} disabled={busy}>
            {t("home_care.control_call.add")}
          </button>
        </div>
      ) : null}
      {!adding && error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
