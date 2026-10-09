"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { HOME_CARE_LIMITS } from "@/lib/homeCare/constants";
import { phoneHref } from "@/lib/homeCare/phone";

import { homeCareBase, useHomeCareApi } from "./homeCareClient";

const EMPTY_ROW = Object.freeze({ name: "", phone: "", note: "" });

/**
 * „Kuhu suunata" (K5-c): asutuse enda loend kohtadest, kuhu hooldaja saab inimese
 * suunata, kui küsimus ei ole hooldaja töö. Loeb iga koduteenuse liige; muudab kogu
 * asutuse hooldusjuht. Tühja loendit näeb ainult see, kes saab selle täita.
 */
export default function HomeCareReferrals({ organizationId, initial = [], canEdit = false }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const [items, setItems] = useState(initial || []);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState([]);

  const start = () => {
    setRows(items.length ? items.map((item) => ({ name: item.name, phone: item.phone || "", note: item.note || "" })) : [{ ...EMPTY_ROW }]);
    setError("");
    setEditing(true);
  };

  const setCell = (index, key, value) => setRows((previous) => previous.map((row, at) => (at === index ? { ...row, [key]: value } : row)));

  const save = async (event) => {
    event.preventDefault();
    const result = await call(`${homeCareBase(organizationId)}/kuhu-suunata`, {
      method: "PUT",
      body: { contacts: rows },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    setItems(result.data.referrals || []);
    setEditing(false);
  };

  if (!items.length && !canEdit) return null;

  return (
    <div className="hc-section">
      <h3 className="hc-section-title" id={`${fieldId}-title`}>
        {t("home_care.referrals.title")}
      </h3>

      {editing ? (
        <form className="hc-form" onSubmit={save} aria-busy={busy}>
          <p className="hc-hint">{t("home_care.referrals.edit_hint")}</p>
          {rows.map((row, index) => (
            <fieldset className="hc-fieldset" key={index}>
              <legend className="hc-label">{t("home_care.referrals.row", { number: index + 1 })}</legend>
              <input
                className="hc-input"
                value={row.name}
                onChange={(event) => setCell(index, "name", event.target.value)}
                maxLength={HOME_CARE_LIMITS.REFERRAL_NAME_MAX}
                placeholder={t("home_care.referrals.name_label")}
                aria-label={t("home_care.referrals.name_label")}
                autoComplete="off"
              />
              <input
                className="hc-input"
                type="tel"
                value={row.phone}
                onChange={(event) => setCell(index, "phone", event.target.value)}
                maxLength={HOME_CARE_LIMITS.REFERRAL_PHONE_MAX}
                placeholder={t("home_care.referrals.phone_label")}
                aria-label={t("home_care.referrals.phone_label")}
                autoComplete="off"
              />
              <input
                className="hc-input"
                value={row.note}
                onChange={(event) => setCell(index, "note", event.target.value)}
                maxLength={HOME_CARE_LIMITS.REFERRAL_NOTE_MAX}
                placeholder={t("home_care.referrals.note_label")}
                aria-label={t("home_care.referrals.note_label")}
                autoComplete="off"
              />
            </fieldset>
          ))}
          {error ? (
            <p className="hc-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="hc-row">
            <button className="hc-btn hc-btn--primary" type="submit" disabled={busy}>
              {t("home_care.referrals.save")}
            </button>
            {rows.length < HOME_CARE_LIMITS.REFERRALS_MAX ? (
              <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setRows((previous) => [...previous, { ...EMPTY_ROW }])} disabled={busy}>
                {t("home_care.referrals.add_row")}
              </button>
            ) : null}
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setEditing(false)} disabled={busy}>
              {t("home_care.referrals.cancel")}
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
                  {item.phone ? (
                    <>
                      {" · "}
                      <a href={phoneHref(item.phone) || undefined}>{item.phone}</a>
                    </>
                  ) : null}
                  {item.note ? <span className="hc-sub"> · {item.note}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="hc-hint">{t("home_care.referrals.none")}</p>
          )}
          {items.length ? <p className="hc-hint">{t("home_care.referrals.emergency")}</p> : null}
          {canEdit ? (
            <div className="hc-row">
              <button className="hc-btn hc-btn--quiet" type="button" onClick={start} disabled={busy}>
                {items.length ? t("home_care.referrals.edit") : t("home_care.referrals.add")}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
