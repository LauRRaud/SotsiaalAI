"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import DateField from "@/components/ui/DateField";
import { CARE_WORK_NATURE_KINDS, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { planDayLabel } from "./HomeCarePlanView";
import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Töö iseloom kliendi juures (K3-g): kas töö on siin füüsiliselt raske, vaimselt kurnav,
 * raskes kodukeskkonnas või ainult kahekesi tehtav, ja miks. Kirjeldab tööd, mitte
 * inimest. Loeb igaüks, kes lehte näeb; paneb ja muudab hooldusjuht.
 */
export default function HomeCareWorkNature({ organizationId, clientId, initial = null, canEdit = false }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const [mark, setMark] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ kinds: [], reason: "", reviewOn: "" });

  const url = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/too-iseloom`;

  const start = () => {
    setForm({ kinds: mark?.kinds || [], reason: mark?.reason || "", reviewOn: mark?.reviewOn || "" });
    setError("");
    setEditing(true);
  };

  const toggle = (kind) =>
    setForm((previous) => ({
      ...previous,
      kinds: previous.kinds.includes(kind) ? previous.kinds.filter((value) => value !== kind) : [...previous.kinds, kind]
    }));

  const save = async (event) => {
    event.preventDefault();
    const result = await call(url, {
      method: "PUT",
      body: { kinds: form.kinds, reason: form.reason, reviewOn: form.reviewOn || null },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    setMark(result.data.workNature || null);
    setEditing(false);
  };

  const clear = async () => {
    const result = await call(url, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return;
    setMark(null);
    setEditing(false);
  };

  /* Märketa kliendi lehel näeb jaotist ainult see, kes saab märke panna. */
  if (!mark && !canEdit) return null;

  return (
    <section className="hc-section" aria-labelledby={`${fieldId}-title`}>
      <h2 className="hc-section-title" id={`${fieldId}-title`}>
        {t("home_care.work_nature.title")}
      </h2>

      {mark && !editing ? (
        <>
          <p className="hc-row">
            {mark.kinds.map((kind) => (
              <span key={kind} className="hc-badge hc-badge--warn">
                {t(`home_care.work_nature.kinds.${kind}`)}
              </span>
            ))}
          </p>
          <p className="hc-notice">{mark.reason}</p>
          <p className="hc-hint">
            {[
              mark.reviewOn ? t("home_care.work_nature.review_on", { date: planDayLabel(mark.reviewOn) }) : null,
              mark.setByName ? t("home_care.work_nature.set_by", { name: mark.setByName }) : null
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </>
      ) : null}
      {!mark && !editing ? <p className="hc-hint">{t("home_care.work_nature.none")}</p> : null}

      {editing ? (
        <form className="hc-form" onSubmit={save} aria-busy={busy}>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.work_nature.kinds_label")}</span>
            <div className="hc-chips" role="group" aria-label={t("home_care.work_nature.kinds_label")}>
              {CARE_WORK_NATURE_KINDS.map((kind) => (
                <button key={kind} type="button" className="hc-chip" aria-pressed={form.kinds.includes(kind)} onClick={() => toggle(kind)}>
                  {t(`home_care.work_nature.kinds.${kind}`)}
                </button>
              ))}
            </div>
            <p className="hc-hint">{t("home_care.work_nature.kinds_hint")}</p>
          </div>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-reason`}>
              {t("home_care.work_nature.reason_label")}
            </label>
            <input
              id={`${fieldId}-reason`}
              className="hc-input"
              value={form.reason}
              onChange={(event) => setForm((previous) => ({ ...previous, reason: event.target.value }))}
              maxLength={HOME_CARE_LIMITS.WORK_NATURE_REASON_MAX}
              autoComplete="off"
              required
            />
            <p className="hc-hint">{t("home_care.work_nature.reason_hint")}</p>
          </div>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.work_nature.review_label")}</span>
            <DateField
              name="workNatureReviewOn"
              value={form.reviewOn}
              onChange={(value) => setForm((previous) => ({ ...previous, reviewOn: value || "" }))}
              ariaLabel={t("home_care.work_nature.review_label")}
            />
          </div>
          {error ? (
            <p className="hc-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="hc-row">
            <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || !form.kinds.length || !form.reason.trim()}>
              {t("home_care.work_nature.save")}
            </button>
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setEditing(false)} disabled={busy}>
              {t("home_care.work_nature.cancel")}
            </button>
            {mark ? (
              <button className="hc-btn hc-btn--quiet" type="button" onClick={clear} disabled={busy}>
                {t("home_care.work_nature.clear")}
              </button>
            ) : null}
          </div>
        </form>
      ) : canEdit ? (
        <div className="hc-row">
          <button className="hc-btn hc-btn--quiet" type="button" onClick={start} disabled={busy}>
            {t(mark ? "home_care.work_nature.edit" : "home_care.work_nature.add")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
