"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CARE_SHARING_LEVELS, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";
import { phoneHref } from "@/lib/homeCare/phone";

import { planDayLabel } from "./HomeCarePlanView";
import { homeCareBase, useHomeCareApi } from "./homeCareClient";

const EMPTY = Object.freeze({ relativeId: "", name: "", relation: "", phone: "", level: 0, noTell: "" });

/**
 * Lähedased ja jagamisaste (K5-k): kellele ja mida klient on lubanud rääkida. Loevad
 * meeskond ja hooldusjuht; muudab hooldusjuht. Kokkulepe tehakse kliendiga ilma
 * lähedaseta; siin on selle tulemus. Ilma lähedasteta näeb jaotist ainult see, kes saab
 * neid lisada.
 */
export default function HomeCareRelatives({ organizationId, clientId, initial = [], canEdit = false, canFlag = false }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const [items, setItems] = useState(initial || []);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });

  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/lahedased`;
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const start = (item = null) => {
    setForm(item ? { relativeId: item.id, name: item.name, relation: item.relation || "", phone: item.phone || "", level: item.level, noTell: item.noTell || "" } : { ...EMPTY });
    setError("");
    setEditing(true);
  };

  const save = async (event) => {
    event.preventDefault();
    /* Salvestamine kinnitab kokkuleppe tänase päevaga: klient ütles seda nüüd. */
    const result = await call(base, {
      method: "POST",
      body: { relativeId: form.relativeId || null, name: form.name, relation: form.relation, phone: form.phone, level: form.level, noTell: form.noTell },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    setItems(result.data.relatives || []);
    setEditing(false);
  };

  /* „Klient ei mäleta, et lubas" (K5-u): kuni hooldusjuht üle küsib, kehtib kõige kitsam aste. */
  const flagDoubt = async (item) => {
    const result = await call(`${base}/${encodeURIComponent(item.id)}/kahtlus`, { method: "POST", fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) setItems(result.data.relatives || []);
  };

  /* Jagamiskaart paberil (K5-u): aken avatakse KOHE vajutuse peale, muidu blokeerib brauser selle hüpikaknana. */
  const openCard = async () => {
    const sheet = window.open("", "_blank");
    const result = await call(`${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/jagamiskaart`, {
      method: "POST",
      fallbackKey: "home_care.errors.open_failed"
    });
    if (!result.ok) {
      sheet?.close();
      return;
    }
    if (!sheet) {
      setError(t("home_care.fridge.popup_blocked"));
      return;
    }
    sheet.document.open();
    sheet.document.write(result.data.html);
    sheet.document.close();
  };

  const remove = async (item) => {
    const result = await call(`${base}/${encodeURIComponent(item.id)}`, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) setItems(result.data.relatives || []);
  };

  if (!items.length && !canEdit && !canFlag) return null;

  return (
    <section className="hc-section" aria-labelledby={`${fieldId}-title`}>
      <h2 className="hc-section-title" id={`${fieldId}-title`}>
        {t("home_care.relatives.title")}
      </h2>

      {editing ? (
        <form className="hc-form" onSubmit={save} aria-busy={busy}>
          <p className="hc-hint">{t("home_care.relatives.edit_hint")}</p>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-name`}>
              {t("home_care.relatives.name_label")}
            </label>
            <input id={`${fieldId}-name`} className="hc-input" value={form.name} onChange={(event) => setField("name", event.target.value)} maxLength={HOME_CARE_LIMITS.RELATIVE_NAME_MAX} autoComplete="off" required />
          </div>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-relation`}>
              {t("home_care.relatives.relation_label")}
            </label>
            <input id={`${fieldId}-relation`} className="hc-input" value={form.relation} onChange={(event) => setField("relation", event.target.value)} maxLength={HOME_CARE_LIMITS.RELATIVE_RELATION_MAX} autoComplete="off" />
          </div>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-phone`}>
              {t("home_care.relatives.phone_label")}
            </label>
            <input id={`${fieldId}-phone`} className="hc-input" type="tel" value={form.phone} onChange={(event) => setField("phone", event.target.value)} maxLength={HOME_CARE_LIMITS.REFERRAL_PHONE_MAX} autoComplete="off" />
          </div>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.relatives.level_label")}</span>
            <div className="hc-chips" role="group" aria-label={t("home_care.relatives.level_label")}>
              {CARE_SHARING_LEVELS.map((level) => (
                <button key={level} type="button" className="hc-chip" aria-pressed={form.level === level} onClick={() => setField("level", level)}>
                  {t(`home_care.relatives.levels.${level}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-notell`}>
              {t("home_care.relatives.no_tell_label")}
            </label>
            <input id={`${fieldId}-notell`} className="hc-input" value={form.noTell} onChange={(event) => setField("noTell", event.target.value)} maxLength={HOME_CARE_LIMITS.RELATIVE_NO_TELL_MAX} autoComplete="off" />
          </div>
          {error ? (
            <p className="hc-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="hc-row">
            <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || !form.name.trim() || !form.level}>
              {t("home_care.relatives.save")}
            </button>
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setEditing(false)} disabled={busy}>
              {t("home_care.relatives.cancel")}
            </button>
          </div>
        </form>
      ) : (
        <>
          {items.length ? (
            <ul className="hc-list hc-list--plain">
              {items.map((item) => (
                <li key={item.id}>
                  <strong>{item.name}</strong>
                  {item.relation ? ` (${item.relation})` : ""}
                  {item.phone ? (
                    <>
                      {" · "}
                      <a href={phoneHref(item.phone) || undefined}>{item.phone}</a>
                    </>
                  ) : null}
                  {" · "}
                  {t(`home_care.relatives.levels.${item.level}`)}
                  {item.noTell ? <span className="hc-sub"> · {t("home_care.relatives.no_tell_line", { text: item.noTell })}</span> : null}
                  <span className="hc-sub"> · {t("home_care.relatives.agreed_on", { date: planDayLabel(item.agreedOn) })}</span>
                  {item.reviewDue ? (
                    <>
                      {" "}
                      <span className="hc-badge hc-badge--warn">{t("home_care.relatives.review_due")}</span>
                    </>
                  ) : null}
                  {item.doubt ? <span className="hc-notice">{t("home_care.relatives.doubt_line", { name: item.doubt.byName || "—" })}</span> : null}
                  {canFlag && !item.doubt ? (
                    <span className="hc-row">
                      <button className="hc-btn hc-btn--quiet" type="button" onClick={() => flagDoubt(item)} disabled={busy}>
                        {t("home_care.relatives.doubt_flag")}
                      </button>
                    </span>
                  ) : null}
                  {canEdit ? (
                    <span className="hc-row">
                      <button className="hc-btn hc-btn--quiet" type="button" onClick={() => start(item)} disabled={busy}>
                        {t("home_care.relatives.edit")}
                      </button>
                      <button className="hc-btn hc-btn--quiet" type="button" onClick={() => remove(item)} disabled={busy}>
                        {t("home_care.relatives.remove")}
                      </button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="hc-hint">{t("home_care.relatives.none")}</p>
          )}
          {items.length ? <p className="hc-hint">{t("home_care.relatives.rule")}</p> : null}
          {canEdit || canFlag ? (
            <div className="hc-row">
              {canEdit ? (
                <button className="hc-btn hc-btn--quiet" type="button" onClick={() => start()} disabled={busy}>
                  {t("home_care.relatives.add")}
                </button>
              ) : null}
              {canFlag ? (
                <button className="hc-btn hc-btn--quiet" type="button" onClick={openCard} disabled={busy}>
                  {t("home_care.relatives.card_open")}
                </button>
              ) : null}
            </div>
          ) : null}
          {canFlag ? <p className="hc-hint">{t("home_care.relatives.card_hint")}</p> : null}
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
