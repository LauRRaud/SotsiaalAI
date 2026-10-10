"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { OWN_NAME_MAX } from "@/lib/homeCare/ownNameLimits";

import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Inimese enda nimi kolleegidele. Koduteenus näitab töötajat nime järgi igal
 * pool (päevaplaan, võtmeraamat, teated, kliendi külmkapileht); kuni nimi on
 * kirjas panemata, seisab seal kriips.
 *
 * Nimeta inimesele on vorm kohe lahti. Kui nimi on olemas, on siin üks vaikne
 * rida ja tee nime muutmiseks.
 */
export default function HomeCareOwnName({ organizationId, initial = null }) {
  const { t } = useI18n();
  const router = useRouter();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const [name, setName] = useState(initial || { firstName: "", lastName: "", complete: false });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: name.firstName, lastName: name.lastName });

  const open = !name.complete || editing;

  const save = async (event) => {
    event.preventDefault();
    const result = await call(`${homeCareBase(organizationId)}/minu-nimi`, {
      method: "PUT",
      body: form,
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    setName(result.data.name);
    setEditing(false);
    /* Nimi on lehel mitmes kohas (meeskond, käigud): loe need serverist uuesti. */
    router.refresh();
  };

  if (!open) {
    return (
      <p className="hc-sub">
        {t("home_care.own_name.line", { name: `${name.firstName} ${name.lastName}` })}{" "}
        <button
          type="button"
          className="hc-btn hc-btn--link"
          onClick={() => {
            setForm({ firstName: name.firstName, lastName: name.lastName });
            setError("");
            setEditing(true);
          }}
        >
          {t("home_care.own_name.change")}
        </button>
      </p>
    );
  }

  return (
    <form className="hc-form hc-notice" onSubmit={save} aria-busy={busy}>
      <p className="hc-hint">{name.complete ? t("home_care.own_name.edit_hint") : t("home_care.own_name.missing")}</p>
      <div className="hc-row">
        <label className="hc-field" htmlFor={`${fieldId}-first`}>
          <span className="hc-label">{t("home_care.own_name.first")}</span>
          <input
            id={`${fieldId}-first`}
            className="hc-input"
            value={form.firstName}
            onChange={(event) => setForm((previous) => ({ ...previous, firstName: event.target.value }))}
            maxLength={OWN_NAME_MAX}
            autoComplete="given-name"
            required
          />
        </label>
        <label className="hc-field" htmlFor={`${fieldId}-last`}>
          <span className="hc-label">{t("home_care.own_name.last")}</span>
          <input
            id={`${fieldId}-last`}
            className="hc-input"
            value={form.lastName}
            onChange={(event) => setForm((previous) => ({ ...previous, lastName: event.target.value }))}
            maxLength={OWN_NAME_MAX}
            autoComplete="family-name"
            required
          />
        </label>
      </div>
      {error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="hc-row">
        <button type="submit" className="hc-btn hc-btn--primary" disabled={busy}>
          {t("home_care.own_name.save")}
        </button>
        {name.complete ? (
          <button type="button" className="hc-btn" disabled={busy} onClick={() => setEditing(false)}>
            {t("home_care.own_name.cancel")}
          </button>
        ) : null}
      </div>
    </form>
  );
}
