"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Dropdown from "@/components/ui/Dropdown";

import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Kliendi andmete vorm hooldusjuhile: uus klient või olemasoleva muutmine.
 *
 * Muutmine saadab NÄHTUD VERSIOONI. Kui keegi teine muutis andmeid vahepeal,
 * vastab server konfliktiga ja vorm jääb täidetuna alles, et midagi ei läheks
 * vaikselt üle kirjutatud.
 */
export default function HomeCareClientForm({ organizationId, client = null, unitOptions = null, onSaved, onCancel }) {
  const { t } = useI18n();
  const { call, busy, error } = useHomeCareApi();
  const fieldId = useId();
  const units = unitOptions?.units || [];
  const unitRequired = Boolean(unitOptions?.unitRequired);

  const [displayName, setDisplayName] = useState(client?.displayName || "");
  const [internalCode, setInternalCode] = useState(client?.internalCode || "");
  const [address, setAddress] = useState(client?.address || "");
  const [contactPhone, setContactPhone] = useState(client?.contactPhone || "");
  const [contactNote, setContactNote] = useState(client?.contactNote || "");
  const [unitId, setUnitId] = useState(client?.unitId || (unitRequired && units.length === 1 ? units[0].id : ""));

  const submit = async (event) => {
    event.preventDefault();
    const body = { displayName, internalCode, address, contactPhone, contactNote };
    /* Üksus läheb kaasa ainult siis, kui see muutus. Arhiveeritud üksuses
       kliendi muid andmeid peab saama parandada ilma üksust vahetamata. */
    if (units.length > 0 && (!client || (unitId || null) !== (client.unitId || null))) {
      body.unitId = unitId || null;
    }
    const result = client
      ? await call(`${homeCareBase(organizationId)}/kliendid/${client.id}`, {
          method: "PATCH",
          body: { ...body, version: client.version },
          fallbackKey: "home_care.errors.save_failed"
        })
      : await call(`${homeCareBase(organizationId)}/kliendid`, {
          method: "POST",
          body,
          fallbackKey: "home_care.errors.save_failed"
        });
    if (result.ok) onSaved?.(result.data.client);
  };

  const unitChoices = [
    ...(unitRequired ? [] : [{ value: "", label: t("home_care.client.unit_none") }]),
    ...units.map((unit) => ({ value: unit.id, label: unit.name }))
  ];

  return (
    <form className="hc-form" onSubmit={submit}>
      <div className="hc-field">
        <label className="hc-label" htmlFor={`${fieldId}-name`}>
          {t("home_care.client.name")}
        </label>
        <input
          id={`${fieldId}-name`}
          className="hc-input"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={200}
          required
          autoComplete="off"
        />
      </div>

      <div className="hc-grid hc-grid--two">
        <div className="hc-field">
          <label className="hc-label" htmlFor={`${fieldId}-address`}>
            {t("home_care.client.address")}
          </label>
          <input
            id={`${fieldId}-address`}
            className="hc-input"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            maxLength={300}
            autoComplete="off"
          />
        </div>
        <div className="hc-field">
          <label className="hc-label" htmlFor={`${fieldId}-phone`}>
            {t("home_care.client.phone")}
          </label>
          <input
            id={`${fieldId}-phone`}
            className="hc-input"
            type="tel"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            maxLength={60}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="hc-field">
        <label className="hc-label" htmlFor={`${fieldId}-note`}>
          {t("home_care.client.contact_note")}
        </label>
        <textarea
          id={`${fieldId}-note`}
          className="hc-textarea"
          value={contactNote}
          onChange={(event) => setContactNote(event.target.value)}
          maxLength={1000}
          rows={3}
        />
      </div>

      <div className="hc-grid hc-grid--two">
        <div className="hc-field">
          <label className="hc-label" htmlFor={`${fieldId}-code`}>
            {t("home_care.client.internal_code")}
          </label>
          <input
            id={`${fieldId}-code`}
            className="hc-input"
            value={internalCode}
            onChange={(event) => setInternalCode(event.target.value)}
            maxLength={100}
            autoComplete="off"
            aria-describedby={`${fieldId}-code-hint`}
          />
          <p className="hc-hint" id={`${fieldId}-code-hint`}>
            {t("home_care.client.internal_code_hint")}
          </p>
        </div>
        {units.length > 0 ? (
          <div className="hc-field">
            <span className="hc-label">{t("home_care.client.unit")}</span>
            <Dropdown
              value={unitId}
              onChange={setUnitId}
              ariaLabel={t("home_care.client.unit")}
              options={unitChoices}
              required={unitRequired}
            />
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="hc-row">
        <button className="hc-btn hc-btn--primary" type="submit" disabled={busy}>
          {t("home_care.client.save")}
        </button>
        {onCancel ? (
          <button className="hc-btn" type="button" onClick={onCancel} disabled={busy}>
            {t("home_care.client.cancel")}
          </button>
        ) : null}
      </div>
    </form>
  );
}
