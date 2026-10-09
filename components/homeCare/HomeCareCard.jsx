"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Dropdown from "@/components/ui/Dropdown";
import { CARE_CARD_LINE_KINDS, CareCardLineKind, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Püsikaart „enne kui lähed": kuni viis rida, mida asendaja peab teadma enne
 * ukse taha jõudmist. Kaart on lehe esimene plokk ja ei keri päevikuga ära.
 *
 * Rea muutmine ei kirjuta vana üle: server lõpetab vana rea ja lisab uue samale
 * kohale, nii et kaardi ajalugu jääb alles.
 */
export default function HomeCareCard({ organizationId, clientId, lines, canEdit, onChange }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState(CareCardLineKind.ACCESS);
  const [text, setText] = useState("");

  const base = `${homeCareBase(organizationId)}/kliendid/${clientId}/kaart`;
  const kindOptions = CARE_CARD_LINE_KINDS.map((value) => ({ value, label: t(`home_care.card.kinds.${value}`) }));
  const full = lines.length >= HOME_CARE_LIMITS.CARD_LINES_MAX;

  const close = () => {
    setEditingId(null);
    setAdding(false);
    setText("");
    setKind(CareCardLineKind.ACCESS);
    setError("");
  };

  const startEdit = (line) => {
    setAdding(false);
    setEditingId(line.id);
    setKind(line.kind);
    setText(line.text);
    setError("");
  };

  const save = async (event) => {
    event.preventDefault();
    const result = editingId
      ? await call(`${base}/${editingId}`, { method: "PATCH", body: { kind, text }, fallbackKey: "home_care.errors.save_failed" })
      : await call(base, { method: "POST", body: { kind, text }, fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) {
      onChange(result.data.card || []);
      close();
    }
  };

  const remove = async (lineId) => {
    const result = await call(`${base}/${lineId}`, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) {
      onChange(result.data.card || []);
      close();
    }
  };

  const form = (
    <form className="hc-form" onSubmit={save}>
      <div className="hc-field">
        <span className="hc-label">{t("home_care.card.kind_label")}</span>
        <Dropdown value={kind} onChange={setKind} ariaLabel={t("home_care.card.kind_label")} options={kindOptions} />
      </div>
      <div className="hc-field">
        <label className="hc-label" htmlFor={`${fieldId}-text`}>
          {t("home_care.card.text_label")}
        </label>
        <input
          id={`${fieldId}-text`}
          className="hc-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={HOME_CARE_LIMITS.CARD_LINE_TEXT_MAX}
          required
          autoComplete="off"
        />
      </div>
      <div className="hc-row">
        <button className="hc-btn hc-btn--primary" type="submit" disabled={busy}>
          {t("home_care.card.save")}
        </button>
        <button className="hc-btn" type="button" onClick={close} disabled={busy}>
          {t("home_care.card.cancel")}
        </button>
        {editingId ? (
          <button className="hc-btn hc-btn--danger" type="button" onClick={() => remove(editingId)} disabled={busy}>
            {t("home_care.card.remove")}
          </button>
        ) : null}
      </div>
    </form>
  );

  return (
    <section className="hc-section hc-section--card" aria-labelledby={`${fieldId}-title`}>
      <h2 className="hc-section-title" id={`${fieldId}-title`}>
        {t("home_care.card.title")}
      </h2>

      {lines.length === 0 ? (
        <p className="hc-sub">{t("home_care.card.empty")}</p>
      ) : (
        <ul className="hc-list hc-list--plain">
          {lines.map((line) =>
            editingId === line.id ? (
              <li key={line.id} className="hc-cardline">
                {form}
              </li>
            ) : (
              <li key={line.id} className="hc-cardline">
                <span className={`hc-badge${line.kind === CareCardLineKind.RISK ? " hc-badge--warn" : ""}`}>
                  {t(`home_care.card.kinds.${line.kind}`)}
                </span>
                <span className="hc-cardline__text">{line.text}</span>
                {canEdit ? (
                  <button className="hc-btn hc-btn--quiet" type="button" onClick={() => startEdit(line)} disabled={busy}>
                    {t("home_care.card.edit")}
                  </button>
                ) : null}
              </li>
            )
          )}
        </ul>
      )}

      {error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}

      {canEdit && adding ? form : null}
      {canEdit && !adding && !editingId ? (
        full ? (
          <p className="hc-hint">{t("home_care.card.limit", { limit: HOME_CARE_LIMITS.CARD_LINES_MAX })}</p>
        ) : (
          <div className="hc-row">
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setAdding(true)}>
              {t("home_care.card.add")}
            </button>
          </div>
        )
      ) : null}
    </section>
  );
}
