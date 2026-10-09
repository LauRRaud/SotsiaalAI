"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CARE_CRISIS_DEPENDENCIES, CARE_CRISIS_LEVELS, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Kriisivalmidus kliendi juures (K5-b): kui palju tuge inimene kriisis vajab, millest ta
 * sõltub ja kes lähedastest saab aidata. Loeb igaüks, kes lehte näeb; hinnangu paneb
 * hooldusjuht. Ilma hinnanguta näeb jaotist ainult see, kes saab selle panna.
 */
export default function HomeCareCrisis({ organizationId, clientId, initial = null, canEdit = false }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const [crisis, setCrisis] = useState(initial || null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ level: "", dependencies: [], helper: "", note: "" });

  const url = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/kriis`;

  const start = () => {
    setForm({ level: crisis?.level || "", dependencies: crisis?.dependencies || [], helper: crisis?.helper || "", note: crisis?.note || "" });
    setError("");
    setEditing(true);
  };

  const toggle = (code) =>
    setForm((previous) => ({
      ...previous,
      dependencies: previous.dependencies.includes(code) ? previous.dependencies.filter((item) => item !== code) : [...previous.dependencies, code]
    }));

  const save = async (event) => {
    event.preventDefault();
    const result = await call(url, { method: "PUT", body: form, fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return;
    setCrisis(result.data.crisis || null);
    setEditing(false);
  };

  const clear = async () => {
    const result = await call(url, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) {
      setCrisis(null);
      setEditing(false);
    }
  };

  if (!crisis && !canEdit) return null;

  return (
    <section className="hc-section" aria-labelledby={`${fieldId}-title`}>
      <h2 className="hc-section-title" id={`${fieldId}-title`}>
        {t("home_care.crisis.title")}
      </h2>

      {editing ? (
        <form className="hc-form" onSubmit={save} aria-busy={busy}>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.crisis.level_label")}</span>
            <div className="hc-chips" role="group" aria-label={t("home_care.crisis.level_label")}>
              {CARE_CRISIS_LEVELS.map((level) => (
                <button key={level} type="button" className="hc-chip" aria-pressed={form.level === level} onClick={() => setForm((previous) => ({ ...previous, level }))}>
                  {t(`home_care.crisis.levels.${level}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.crisis.dependencies_label")}</span>
            <div className="hc-chips" role="group" aria-label={t("home_care.crisis.dependencies_label")}>
              {CARE_CRISIS_DEPENDENCIES.map((code) => (
                <button key={code} type="button" className="hc-chip" aria-pressed={form.dependencies.includes(code)} onClick={() => toggle(code)}>
                  {t(`home_care.crisis.dependencies.${code}`)}
                </button>
              ))}
            </div>
            <p className="hc-hint">{t("home_care.crisis.dependencies_hint")}</p>
          </div>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-helper`}>
              {t("home_care.crisis.helper_label")}
            </label>
            <input
              id={`${fieldId}-helper`}
              className="hc-input"
              value={form.helper}
              onChange={(event) => setForm((previous) => ({ ...previous, helper: event.target.value }))}
              maxLength={HOME_CARE_LIMITS.CRISIS_HELPER_MAX}
              autoComplete="off"
            />
          </div>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-note`}>
              {t("home_care.crisis.note_label")}
            </label>
            <input
              id={`${fieldId}-note`}
              className="hc-input"
              value={form.note}
              onChange={(event) => setForm((previous) => ({ ...previous, note: event.target.value }))}
              maxLength={HOME_CARE_LIMITS.CRISIS_NOTE_MAX}
              autoComplete="off"
            />
          </div>
          {error ? (
            <p className="hc-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="hc-row">
            <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || !form.level}>
              {t("home_care.crisis.save")}
            </button>
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setEditing(false)} disabled={busy}>
              {t("home_care.crisis.cancel")}
            </button>
            {crisis ? (
              <button className="hc-btn hc-btn--quiet" type="button" onClick={clear} disabled={busy}>
                {t("home_care.crisis.clear")}
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <>
          {crisis ? (
            <ul className="hc-list hc-list--plain">
              <li>
                <strong>{t(`home_care.crisis.levels.${crisis.level}`)}</strong>
              </li>
              {crisis.dependencies.length ? (
                <li>{t("home_care.crisis.depends_on", { list: crisis.dependencies.map((code) => t(`home_care.crisis.dependencies.${code}`)).join(", ") })}</li>
              ) : null}
              {crisis.helper ? <li>{t("home_care.crisis.helper_line", { name: crisis.helper })}</li> : null}
              {crisis.note ? <li>{crisis.note}</li> : null}
            </ul>
          ) : (
            <p className="hc-hint">{t("home_care.crisis.none")}</p>
          )}
          {canEdit ? (
            <div className="hc-row">
              <button className="hc-btn hc-btn--quiet" type="button" onClick={start} disabled={busy}>
                {crisis ? t("home_care.crisis.edit") : t("home_care.crisis.add")}
              </button>
            </div>
          ) : null}
          {error ? (
            <p className="hc-error" role="alert">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
