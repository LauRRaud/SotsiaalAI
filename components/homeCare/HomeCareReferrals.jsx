"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { SMALL, footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import { HOME_CARE_LIMITS } from "@/lib/homeCare/constants";
import { phoneHref } from "@/lib/homeCare/phone";

import styles from "./clients/clients.module.css";
import { homeCareBase, useHomeCareApi } from "./homeCareClient";

const EMPTY_ROW = Object.freeze({ name: "", phone: "", note: "" });

/**
 * „Kuhu suunata" (K5-c): asutuse enda loend kohtadest, kuhu hooldaja saab inimese
 * suunata, kui küsimus ei ole hooldaja töö. Loeb iga koduteenuse liige; muudab kogu
 * asutuse hooldusjuht. Tühja loendit näeb ainult see, kes saab selle täita.
 *
 * Kaks vaadet: loend (nimi, millal pöörduda, telefon) ja hooldusjuhi muutmisvorm,
 * kus iga rida on üks koht. Pikk vorm kerib tervet paneeli nagu dokument.
 */
export default function HomeCareReferrals({ organizationId, initial = [], canEdit = false }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
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

  if (editing) {
    return (
      <form onSubmit={save} aria-busy={busy}>
        <StepPanel
          title={t("home_care.referrals.title")}
          lead={t("home_care.referrals.edit_hint")}
          note={footNote(error ? { text: error, tone: "risk" } : null)}
          actions={
            <>
              <Button {...SMALL} data-refer="cancel" onClick={() => setEditing(false)}>
                {t("home_care.referrals.cancel")}
              </Button>
              {rows.length < HOME_CARE_LIMITS.REFERRALS_MAX ? (
                <Button {...SMALL} data-refer="add-row" onClick={() => setRows((previous) => [...previous, { ...EMPTY_ROW }])}>
                  {t("home_care.referrals.add_row")}
                </Button>
              ) : null}
              <Button type="submit" size="sm" variant="primary" data-refer="save" aria-busy={busy ? "true" : undefined}>
                {t("home_care.referrals.save")}
              </Button>
            </>
          }
        >
          <div className={shared.stack}>
            {rows.map((row, index) => (
              <fieldset className={styles.contact} key={index}>
                <legend className="sr-only">{t("home_care.referrals.row", { number: index + 1 })}</legend>
                <input
                  className={shared.input}
                  value={row.name}
                  onChange={(event) => setCell(index, "name", event.target.value)}
                  maxLength={HOME_CARE_LIMITS.REFERRAL_NAME_MAX}
                  placeholder={t("home_care.referrals.name_label")}
                  aria-label={t("home_care.referrals.name_label")}
                  autoComplete="off"
                />
                <input
                  className={shared.input}
                  type="tel"
                  value={row.phone}
                  onChange={(event) => setCell(index, "phone", event.target.value)}
                  maxLength={HOME_CARE_LIMITS.REFERRAL_PHONE_MAX}
                  placeholder={t("home_care.referrals.phone_label")}
                  aria-label={t("home_care.referrals.phone_label")}
                  autoComplete="off"
                />
                <input
                  className={shared.input}
                  value={row.note}
                  onChange={(event) => setCell(index, "note", event.target.value)}
                  maxLength={HOME_CARE_LIMITS.REFERRAL_NOTE_MAX}
                  placeholder={t("home_care.referrals.note_label")}
                  aria-label={t("home_care.referrals.note_label")}
                  autoComplete="off"
                />
              </fieldset>
            ))}
          </div>
        </StepPanel>
      </form>
    );
  }

  return (
    <StepPanel
      title={t("home_care.referrals.title")}
      note={items.length ? t("home_care.referrals.emergency") : ""}
      actions={
        canEdit ? (
          <Button {...SMALL} data-refer="edit" onClick={start}>
            {items.length ? t("home_care.referrals.edit") : t("home_care.referrals.add")}
          </Button>
        ) : null
      }
    >
      {items.length ? (
        <ul className={shared.rows}>
          {items.map((item) => (
            <li key={item.id} className={shared.rowItem}>
              <div className={shared.rowStatic}>
                <span className={styles.main}>
                  <span className={shared.rowTitle}>{item.name}</span>
                  {item.note ? <span className={styles.sub}>{item.note}</span> : null}
                </span>
                {item.phone ? (
                  <span className={shared.rowMeta}>
                    <a className={styles.tel} href={phoneHref(item.phone) || undefined}>
                      {item.phone}
                    </a>
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={shared.quiet}>{t("home_care.referrals.none")}</p>
      )}
    </StepPanel>
  );
}
