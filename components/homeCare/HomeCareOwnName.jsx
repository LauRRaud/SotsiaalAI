"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { SMALL, footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import { OWN_NAME_MAX } from "@/lib/homeCare/ownNameLimits";

import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Inimese enda nimi kolleegidele. Koduteenus näitab töötajat nime järgi igal
 * pool (päevaplaan, võtmeraamat, teated, kliendi külmkapileht); kuni nimi on
 * kirjas panemata, seisab seal kriips.
 *
 * See on nime vorm omaette vaatena. Nimeta inimesele avab koduteenus selle
 * kohe; kui nimi on olemas, jõuab siia klientide vaate all servas olevast reast.
 * `onDone`: kuhu pärast salvestamist või loobumist minna.
 */
export default function HomeCareOwnName({ organizationId, initial = null, onDone }) {
  const { t } = useI18n();
  const router = useRouter();
  const { call, busy, error } = useHomeCareApi();
  const fieldId = useId();
  const name = initial || { firstName: "", lastName: "", complete: false };
  const [form, setForm] = useState({ firstName: name.firstName, lastName: name.lastName });

  const save = async (event) => {
    event.preventDefault();
    const result = await call(`${homeCareBase(organizationId)}/minu-nimi`, {
      method: "PUT",
      body: form,
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    /* Nimi on lehel mitmes kohas (meeskond, käigud): loe need serverist uuesti. */
    router.refresh();
    onDone?.();
  };

  return (
    <form onSubmit={save} aria-busy={busy}>
      <StepPanel
        title={t("home_care.desk.names.name")}
        lead={name.complete ? t("home_care.own_name.edit_hint") : t("home_care.own_name.missing")}
        note={footNote(error ? { text: error, tone: "risk" } : null)}
        actions={
          <>
            {name.complete ? (
              <Button {...SMALL} data-name="cancel" onClick={onDone}>
                {t("home_care.own_name.cancel")}
              </Button>
            ) : null}
            <Button type="submit" size="sm" variant="primary" data-name="save" aria-busy={busy ? "true" : undefined}>
              {t("home_care.own_name.save")}
            </Button>
          </>
        }
      >
        <div className={shared.pair}>
          <label className={shared.line} data-size="sm" htmlFor={`${fieldId}-first`}>
            <span className={shared.fieldLabel}>{t("home_care.own_name.first")}</span>
            <input
              id={`${fieldId}-first`}
              className={shared.input}
              value={form.firstName}
              onChange={(event) => setForm((previous) => ({ ...previous, firstName: event.target.value }))}
              maxLength={OWN_NAME_MAX}
              autoComplete="given-name"
              required
            />
          </label>
          <label className={shared.line} data-size="sm" htmlFor={`${fieldId}-last`}>
            <span className={shared.fieldLabel}>{t("home_care.own_name.last")}</span>
            <input
              id={`${fieldId}-last`}
              className={shared.input}
              value={form.lastName}
              onChange={(event) => setForm((previous) => ({ ...previous, lastName: event.target.value }))}
              maxLength={OWN_NAME_MAX}
              autoComplete="family-name"
              required
            />
          </label>
        </div>
      </StepPanel>
    </form>
  );
}
