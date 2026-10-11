"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { SMALL, footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";

import styles from "./clients/clients.module.css";
import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Kliendi andmete vorm hooldusjuhile: uus klient või olemasoleva muutmine.
 *
 * Muutmine saadab NÄHTUD VERSIOONI. Kui keegi teine muutis andmeid vahepeal,
 * vastab server konfliktiga ja vorm jääb täidetuna alles, et midagi ei läheks
 * vaikselt üle kirjutatud.
 *
 * Väli on nii lai kui sinna kirjutatav sisu: nimi ja aadress laiemad, telefon ja
 * tunnus lühikesed. Täislaius on ainult märkuste väljal.
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
    <form onSubmit={submit} aria-busy={busy}>
      <StepPanel
        title={client ? t("home_care.client.details") : t("home_care.client.create_title")}
        note={footNote(error ? { text: error, tone: "risk" } : null)}
        actions={
          <>
            {onCancel ? (
              <Button {...SMALL} data-client-form="cancel" onClick={onCancel}>
                {t("home_care.client.cancel")}
              </Button>
            ) : null}
            <Button type="submit" size="sm" variant="primary" data-client-form="save" aria-busy={busy ? "true" : undefined}>
              {t("home_care.client.save")}
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <div className={styles.formRow}>
            <label className={styles.grow} htmlFor={`${fieldId}-name`}>
              <span className={shared.fieldLabel}>{t("home_care.client.name")}</span>
              <input id={`${fieldId}-name`} className={shared.input} value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={200} required autoComplete="off" />
            </label>
            <label className={styles.short} htmlFor={`${fieldId}-phone`}>
              <span className={shared.fieldLabel}>{t("home_care.client.phone")}</span>
              <input id={`${fieldId}-phone`} className={shared.input} type="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} maxLength={60} autoComplete="off" />
            </label>
          </div>
          <div className={styles.formRow}>
            <label className={styles.grow} htmlFor={`${fieldId}-address`}>
              <span className={shared.fieldLabel}>{t("home_care.client.address")}</span>
              <input id={`${fieldId}-address`} className={shared.input} value={address} onChange={(event) => setAddress(event.target.value)} maxLength={300} autoComplete="off" />
            </label>
            {units.length > 0 ? (
              <div className={styles.short}>
                <span className={shared.fieldLabel}>{t("home_care.client.unit")}</span>
                <Dropdown value={unitId} onChange={setUnitId} ariaLabel={t("home_care.client.unit")} options={unitChoices} required={unitRequired} />
              </div>
            ) : null}
          </div>
          <label className={styles.wide} htmlFor={`${fieldId}-note`}>
            <span className={shared.fieldLabel}>{t("home_care.client.contact_note")}</span>
            <textarea id={`${fieldId}-note`} className={shared.input} value={contactNote} onChange={(event) => setContactNote(event.target.value)} maxLength={1000} rows={2} />
          </label>
          <div className={styles.formRow}>
            <label className={styles.short} htmlFor={`${fieldId}-code`}>
              <span className={shared.fieldLabel}>{t("home_care.client.internal_code")}</span>
              <input
                id={`${fieldId}-code`}
                className={shared.input}
                value={internalCode}
                onChange={(event) => setInternalCode(event.target.value)}
                maxLength={100}
                autoComplete="off"
                aria-describedby={`${fieldId}-code-hint`}
              />
            </label>
            <p className={styles.beside} id={`${fieldId}-code-hint`}>
              {t("home_care.client.internal_code_hint")}
            </p>
          </div>
        </div>
      </StepPanel>
    </form>
  );
}
