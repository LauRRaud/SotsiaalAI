"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import DateField from "@/components/ui/DateField";
import { CARE_REPRESENTATIVE_BASES, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { planDayLabel } from "./HomeCarePlanView";
import { homeCareBase, useHomeCareApi } from "./homeCareClient";

const EMPTY = { name: "", phone: "", basis: "", scope: "", validFrom: "", validUntil: "", copyKept: "", checkedOn: "" };

/** Kehtivus ühe reana: „kehtib kuni 31.12.2026", „kehtib alates 01.11.2026", „tähtajatu". */
export function representativePeriod(t, item) {
  if (item.validFrom && item.validUntil) return t("home_care.representative.period_both", { from: planDayLabel(item.validFrom), until: planDayLabel(item.validUntil) });
  if (item.validUntil) return t("home_care.representative.period_until", { until: planDayLabel(item.validUntil) });
  if (item.validFrom) return t("home_care.representative.period_from", { from: planDayLabel(item.validFrom) });
  return t("home_care.representative.period_open");
}

/**
 * Esindusõigus (K6-i): kes tohib kliendi eest otsustada ja alla kirjutada, mis alusel ja mis
 * ulatuses. Loeb igaüks, kes lehte näeb; lisab ja lõpetab hooldusjuht. Ilma kirjeta näeb
 * jaotist ainult see, kes saab kirje lisada. Platvorm dokumenti ei hoia.
 */
export default function HomeCareRepresentatives({ organizationId, clientId, initial = [], canEdit = false }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const [items, setItems] = useState(initial || []);
  const [adding, setAdding] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/esindajad`;
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const start = () => {
    setForm(EMPTY);
    setError("");
    setConfirmEnd(null);
    setAdding(true);
  };

  const save = async (event) => {
    event.preventDefault();
    const result = await call(base, {
      method: "POST",
      body: { ...form, validFrom: form.validFrom || null, validUntil: form.validUntil || null, checkedOn: form.checkedOn || null },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    setItems(result.data.representatives || []);
    setAdding(false);
  };

  const end = async (item) => {
    const result = await call(`${base}/${encodeURIComponent(item.id)}`, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return;
    setItems(result.data.representatives || []);
    setConfirmEnd(null);
  };

  if (!items.length && !canEdit) return null;

  return (
    <section className="hc-section" aria-labelledby={`${fieldId}-title`}>
      <h2 className="hc-section-title" id={`${fieldId}-title`}>
        {t("home_care.representative.title")}
      </h2>

      {items.length ? (
        <ul className="hc-list hc-list--plain">
          {items.map((item) => (
            <li key={item.id}>
              <span>
                {item.name} · {t(`home_care.representative.bases.${item.basis}`)}
              </span>
              {item.state !== "VALID" ? (
                <>
                  {" "}
                  <span className={item.state === "EXPIRED" ? "hc-badge hc-badge--danger" : "hc-badge"}>{t(`home_care.representative.states.${item.state}`)}</span>
                </>
              ) : null}
              <p className="hc-sub">{item.scope}</p>
              <p className="hc-entry__meta">
                {[
                  representativePeriod(t, item),
                  item.phone,
                  item.copyKept ? t("home_care.representative.copy_line", { place: item.copyKept }) : null,
                  t("home_care.representative.checked_line", { date: planDayLabel(item.checkedOn), name: item.checkedByName || "—" })
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {canEdit && !adding ? (
                confirmEnd === item.id ? (
                  <span className="hc-row">
                    <button className="hc-btn hc-btn--quiet" type="button" onClick={() => end(item)} disabled={busy}>
                      {t("home_care.representative.end_confirm")}
                    </button>
                    <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setConfirmEnd(null)} disabled={busy}>
                      {t("home_care.representative.cancel")}
                    </button>
                  </span>
                ) : (
                  <span className="hc-row">
                    <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setConfirmEnd(item.id)} disabled={busy}>
                      {t("home_care.representative.end")}
                    </button>
                  </span>
                )
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!items.length && !adding ? <p className="hc-hint">{t("home_care.representative.none")}</p> : null}

      {adding ? (
        <form className="hc-form" onSubmit={save} aria-busy={busy}>
          <p className="hc-hint">{t("home_care.representative.form_hint")}</p>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-name`}>
              {t("home_care.representative.name_label")}
            </label>
            <input
              id={`${fieldId}-name`}
              className="hc-input"
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              maxLength={HOME_CARE_LIMITS.RELATIVE_NAME_MAX}
              autoComplete="off"
              required
            />
          </div>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.representative.basis_label")}</span>
            <div className="hc-chips" role="group" aria-label={t("home_care.representative.basis_label")}>
              {CARE_REPRESENTATIVE_BASES.map((basis) => (
                <button key={basis} type="button" className="hc-chip" aria-pressed={form.basis === basis} onClick={() => setField("basis", basis)}>
                  {t(`home_care.representative.bases.${basis}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-scope`}>
              {t("home_care.representative.scope_label")}
            </label>
            <input
              id={`${fieldId}-scope`}
              className="hc-input"
              value={form.scope}
              onChange={(event) => setField("scope", event.target.value)}
              maxLength={HOME_CARE_LIMITS.REPRESENTATIVE_SCOPE_MAX}
              autoComplete="off"
              required
            />
            <p className="hc-hint">{t("home_care.representative.scope_hint")}</p>
          </div>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.representative.from_label")}</span>
            <DateField name="representativeFrom" value={form.validFrom} onChange={(value) => setField("validFrom", value || "")} ariaLabel={t("home_care.representative.from_label")} />
          </div>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.representative.until_label")}</span>
            <DateField name="representativeUntil" value={form.validUntil} onChange={(value) => setField("validUntil", value || "")} ariaLabel={t("home_care.representative.until_label")} />
          </div>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-phone`}>
              {t("home_care.representative.phone_label")}
            </label>
            <input
              id={`${fieldId}-phone`}
              className="hc-input"
              type="tel"
              value={form.phone}
              onChange={(event) => setField("phone", event.target.value)}
              maxLength={HOME_CARE_LIMITS.REFERRAL_PHONE_MAX}
              autoComplete="off"
            />
          </div>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-copy`}>
              {t("home_care.representative.copy_label")}
            </label>
            <input
              id={`${fieldId}-copy`}
              className="hc-input"
              value={form.copyKept}
              onChange={(event) => setField("copyKept", event.target.value)}
              maxLength={HOME_CARE_LIMITS.DECISION_ORIGINAL_MAX}
              autoComplete="off"
            />
          </div>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.representative.checked_label")}</span>
            <DateField name="representativeChecked" value={form.checkedOn} onChange={(value) => setField("checkedOn", value || "")} ariaLabel={t("home_care.representative.checked_label")} />
            <p className="hc-hint">{t("home_care.representative.checked_hint")}</p>
          </div>
          {error ? (
            <p className="hc-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="hc-row">
            <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || !form.name.trim() || !form.basis || !form.scope.trim()}>
              {t("home_care.representative.save")}
            </button>
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setAdding(false)} disabled={busy}>
              {t("home_care.representative.cancel")}
            </button>
          </div>
        </form>
      ) : canEdit ? (
        <div className="hc-row">
          <button className="hc-btn hc-btn--quiet" type="button" onClick={start} disabled={busy}>
            {t("home_care.representative.add")}
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
