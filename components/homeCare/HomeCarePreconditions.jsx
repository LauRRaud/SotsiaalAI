"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import DateField from "@/components/ui/DateField";
import { CARE_PRECONDITION_KINDS, CarePreconditionKind, CarePreconditionOutcome, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { daysLabel } from "./HomeCareDecisionView";
import { planDayLabel } from "./HomeCarePlanView";
import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/** Üks rida: mis peab korras olema, kes korraldab ja mis ajaks. Sama tekst kliendi lehel ja tähtaegade lehel. */
export function preconditionLine(t, item) {
  return [
    item.note ? `${t(`home_care.precondition.kinds.${item.kind}`)}: ${item.note}` : t(`home_care.precondition.kinds.${item.kind}`),
    t("home_care.precondition.arranged_by", { name: item.responsible }),
    item.dueOn
      ? t("home_care.precondition.due_on", { date: planDayLabel(item.dueOn), when: daysLabel(t, item.daysLeft) })
      : t("home_care.precondition.no_due")
  ].join(" · ");
}

/**
 * Eeltingimus enne teenuse algust (K4-a): mida oodatakse, kes korraldab ja mis ajaks.
 * Loeb igaüks, kes lehte näeb; lisab ja lõpetab hooldusjuht. Ilma täitmata
 * eeltingimuseta näeb jaotist ainult see, kes saab eeltingimuse lisada.
 */
export default function HomeCarePreconditions({ organizationId, clientId, initial = [], canEdit = false }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const [items, setItems] = useState(initial || []);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ kind: "", note: "", responsible: "", dueOn: "" });

  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/eeltingimused`;
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const start = () => {
    setForm({ kind: "", note: "", responsible: "", dueOn: "" });
    setError("");
    setAdding(true);
  };

  const save = async (event) => {
    event.preventDefault();
    const result = await call(base, {
      method: "POST",
      body: { kind: form.kind, note: form.note, responsible: form.responsible, dueOn: form.dueOn || null },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    setItems(result.data.preconditions || []);
    setAdding(false);
  };

  const close = async (item, outcome) => {
    const result = await call(`${base}/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      body: { outcome },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (result.ok) setItems(result.data.preconditions || []);
  };

  if (!items.length && !canEdit) return null;
  const noteRequired = form.kind === CarePreconditionKind.OTHER;

  return (
    <section className="hc-section" aria-labelledby={`${fieldId}-title`}>
      <h2 className="hc-section-title" id={`${fieldId}-title`}>
        {t("home_care.precondition.title")}
      </h2>

      {items.length ? <p className="hc-notice hc-notice--warn">{t("home_care.precondition.waiting")}</p> : null}
      {items.length ? (
        <ul className="hc-list hc-list--plain">
          {items.map((item) => (
            <li key={item.id}>
              <span>{preconditionLine(t, item)}</span>
              {item.overdue ? (
                <>
                  {" "}
                  <span className="hc-badge hc-badge--danger">{t("home_care.deadlines.overdue_badge")}</span>
                </>
              ) : null}
              {canEdit && !adding ? (
                <span className="hc-row">
                  <button className="hc-btn hc-btn--quiet" type="button" onClick={() => close(item, CarePreconditionOutcome.DONE)} disabled={busy}>
                    {t("home_care.precondition.done")}
                  </button>
                  <button className="hc-btn hc-btn--quiet" type="button" onClick={() => close(item, CarePreconditionOutcome.DROPPED)} disabled={busy}>
                    {t("home_care.precondition.drop")}
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!items.length && !adding ? <p className="hc-hint">{t("home_care.precondition.none")}</p> : null}

      {adding ? (
        <form className="hc-form" onSubmit={save} aria-busy={busy}>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.precondition.kind_label")}</span>
            <div className="hc-chips" role="group" aria-label={t("home_care.precondition.kind_label")}>
              {CARE_PRECONDITION_KINDS.map((kind) => (
                <button key={kind} type="button" className="hc-chip" aria-pressed={form.kind === kind} onClick={() => setField("kind", kind)}>
                  {t(`home_care.precondition.kinds.${kind}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-note`}>
              {t("home_care.precondition.note_label")}
            </label>
            <input
              id={`${fieldId}-note`}
              className="hc-input"
              value={form.note}
              onChange={(event) => setField("note", event.target.value)}
              maxLength={HOME_CARE_LIMITS.PRECONDITION_NOTE_MAX}
              autoComplete="off"
              required={noteRequired}
            />
            {noteRequired ? <p className="hc-hint">{t("home_care.precondition.note_hint")}</p> : null}
          </div>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-responsible`}>
              {t("home_care.precondition.responsible_label")}
            </label>
            <input
              id={`${fieldId}-responsible`}
              className="hc-input"
              value={form.responsible}
              onChange={(event) => setField("responsible", event.target.value)}
              maxLength={HOME_CARE_LIMITS.PRECONDITION_RESPONSIBLE_MAX}
              autoComplete="off"
              required
            />
            <p className="hc-hint">{t("home_care.precondition.responsible_hint")}</p>
          </div>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.precondition.due_label")}</span>
            <DateField
              name="preconditionDueOn"
              value={form.dueOn}
              onChange={(value) => setField("dueOn", value || "")}
              ariaLabel={t("home_care.precondition.due_label")}
            />
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
              disabled={busy || !form.kind || !form.responsible.trim() || (noteRequired && !form.note.trim())}
            >
              {t("home_care.precondition.save")}
            </button>
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setAdding(false)} disabled={busy}>
              {t("home_care.precondition.cancel")}
            </button>
          </div>
        </form>
      ) : canEdit ? (
        <div className="hc-row">
          <button className="hc-btn hc-btn--quiet" type="button" onClick={start} disabled={busy}>
            {t("home_care.precondition.add")}
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
