"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CARE_CHANGE_AREAS, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Kliendi tavaline seis (K5-a): kuidas tal tavaliselt läheb, kuues valdkonnas. Selle
 * järgi hindab iga hooldaja, kas täna oli midagi teisiti. Loeb igaüks, kes lehte näeb;
 * muudavad meeskond ja hooldusjuht. Tühja kirjeldusega näeb jaotist ainult muutja.
 */
export default function HomeCareUsualState({ organizationId, clientId, initial = [], canEdit = false, onChanged }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const [items, setItems] = useState(initial || []);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});

  const textOf = (area) => items.find((item) => item.area === area)?.text || "";

  const start = () => {
    setForm(Object.fromEntries(CARE_CHANGE_AREAS.map((area) => [area, textOf(area)])));
    setError("");
    setEditing(true);
  };

  const save = async (event) => {
    event.preventDefault();
    const result = await call(`${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/tavaline-seis`, {
      method: "PUT",
      body: { areas: form },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    setItems(result.data.usualState || []);
    onChanged?.(result.data.usualState || []);
    setEditing(false);
  };

  if (!items.length && !canEdit) return null;

  return (
    <section className="hc-section" aria-labelledby={`${fieldId}-title`}>
      <h2 className="hc-section-title" id={`${fieldId}-title`}>
        {t("home_care.usual.title")}
      </h2>

      {editing ? (
        <form className="hc-form" onSubmit={save} aria-busy={busy}>
          <p className="hc-hint">{t("home_care.usual.edit_hint")}</p>
          {CARE_CHANGE_AREAS.map((area) => (
            <div className="hc-field" key={area}>
              <label className="hc-label" htmlFor={`${fieldId}-${area}`}>
                {t(`home_care.change.areas.${area}`)}
              </label>
              <input
                id={`${fieldId}-${area}`}
                className="hc-input"
                value={form[area] || ""}
                onChange={(event) => setForm((previous) => ({ ...previous, [area]: event.target.value }))}
                maxLength={HOME_CARE_LIMITS.USUAL_STATE_TEXT_MAX}
                placeholder={t(`home_care.usual.examples.${area}`)}
                autoComplete="off"
              />
            </div>
          ))}
          {error ? (
            <p className="hc-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="hc-row">
            <button className="hc-btn hc-btn--primary" type="submit" disabled={busy}>
              {t("home_care.usual.save")}
            </button>
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setEditing(false)} disabled={busy}>
              {t("home_care.usual.cancel")}
            </button>
          </div>
        </form>
      ) : (
        <>
          {items.length ? (
            <ul className="hc-list hc-list--plain">
              {items.map((item) => (
                <li key={item.area}>
                  <strong>{t(`home_care.change.areas.${item.area}`)}:</strong> {item.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="hc-hint">{t("home_care.usual.none")}</p>
          )}
          {canEdit ? (
            <div className="hc-row">
              <button className="hc-btn hc-btn--quiet" type="button" onClick={start} disabled={busy}>
                {items.length ? t("home_care.usual.edit") : t("home_care.usual.add")}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
