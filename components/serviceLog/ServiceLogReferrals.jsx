"use client";

/**
 * TEENUSPÄEVIK-V1 E3 UI — suunamised ja jääk.
 *
 * DoD punkt 4: „suunamise jääk ALATI nähtav, ületamine hoiatab." Seepärast on
 * jääk siin iga rea juures, mitte eraldi klõpsu taga — ja ta tuleb loendiga
 * KOOS, ilma teise päringuta.
 *
 * KOLM ASJA, MIS PEAVAD OLEMA ERALDI NÄHTAVAD:
 *   1. kinnitatud maht (`used`) — see läheb arvele;
 *   2. kinnitamata maht (`pending`) — see on tehtud töö, mis arvele veel ei lähe;
 *   3. jääk (`remaining`) — ja kui ta on negatiivne, siis kui palju üle.
 * Ühte numbrisse kokku surutuna kaob just see, mille pärast osutaja vaatab.
 *
 * MÄÄRAMATA MAHT EI OLE NULL. Kui suunamisel mahtu ei ole, ütleme seda välja;
 * „0" tähendaks, et maht on otsas, ja see on vastupidine olukord.
 *
 * KEELEPÄIS ON KLIENDI KOHUSTUS. `localeFromRequest` loeb päringut ja päiseid,
   AGA MITTE keeleküpsist — ilma `x-ui-locale`-ta tuleb serveri veateade
   inglise keeles keset eestikeelset pinda. Brauserikontroll näitas seda
   („The entry is already final."); `i18n:check` ei saa seda püüda, sest
   võtmed on kõigis keeltes olemas — vale on KUTSE, mitte sõnastik.
   Sama muster, mida kasutab admin-kiht (`x-ui-locale: locale`).
 */

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import DateField from "@/components/ui/DateField";
import Form from "@/components/ui/Form";
import { ALLOCATION_PERIODS, SERVICE_UNITS } from "@/lib/serviceLog/constants";

function formatQuantity(value, unit, t) {
  if (value === null || value === undefined) return "—";
  const unitLabel = t(`service_log.units.${String(unit || "").toLowerCase()}`, unit || "");
  return `${value} ${unitLabel}`;
}

export default function ServiceLogReferrals({ month }) {
  const { t, locale } = useI18n();
  const [referrals, setReferrals] = useState(null);
  const [loadError, setLoadError] = useState(false);
  /* LISAMISVORM. Ilma temata oli see vaade AINULT lugemiseks ja suunamist ei
     saanud tootest üldse tekitada — API-l oli CRUD olemas, UI-l mitte. Ahel
     jäi katki kohe alguses: ilma suunamiseta ei ole KOV-i mahtu, saldot,
     sisulist aruannet ega saajapõhist eksporti. Leidis produktsioonis
     klikkimine. */
  const [avatud, setAvatud] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [vorm, setVorm] = useState({
    kovName: "",
    referralNumber: "",
    clientDisplayName: "",
    unit: "HOUR",
    allocatedQuantity: "",
    allocationPeriod: "MONTH",
    periodStart: "",
    periodEnd: "",
    goalsText: ""
  });

  const muuda = (vali, vaartus) => setVorm((eelmine) => ({ ...eelmine, [vali]: vaartus }));

  const load = useCallback(async () => {
    try {
      setLoadError(false);
      const params = new URLSearchParams();
      if (month) params.set("month", month);
      const response = await fetch(`/api/service-referrals?${params}`, { headers: { "x-ui-locale": locale || "et" } });
      if (!response.ok) throw new Error("load_failed");
      const body = await response.json();
      setReferrals(Array.isArray(body.referrals) ? body.referrals : []);
    } catch {
      setLoadError(true);
      setReferrals((current) => current || []);
    }
  }, [locale, month]);

  useEffect(() => {
    load();
  }, [load]);

  const salvesta = useCallback(
    async (event) => {
      event.preventDefault();
      setFormError("");
      if (!vorm.kovName.trim()) {
        setFormError(t("service_log.errors.kov_required", ""));
        return;
      }
      if (!vorm.clientDisplayName.trim()) {
        setFormError(t("service_log.errors.client_required", ""));
        return;
      }
      setSaving(true);
      try {
        const response = await fetch("/api/service-referrals", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" },
          body: JSON.stringify({
            kovName: vorm.kovName.trim(),
            referralNumber: vorm.referralNumber.trim() || null,
            clientDisplayName: vorm.clientDisplayName.trim(),
            unit: vorm.unit,
            allocatedQuantity: vorm.allocatedQuantity === "" ? null : vorm.allocatedQuantity,
            allocationPeriod: vorm.allocationPeriod,
            periodStart: vorm.periodStart || null,
            periodEnd: vorm.periodEnd || null,
            goalsText: vorm.goalsText.trim() || null
          })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          /* Serveri teade on juba lokaliseeritud — oma üldist teadet siia ei
             kirjutata, muidu kaob põhjus. */
          setFormError(body?.message || t("service_log.errors.invalid_input", ""));
          return;
        }
        setVorm({
          kovName: "",
          referralNumber: "",
          clientDisplayName: "",
          unit: "HOUR",
          allocatedQuantity: "",
          allocationPeriod: "MONTH",
          periodStart: "",
          periodEnd: "",
          goalsText: ""
        });
        setAvatud(false);
        await load();
      } catch {
        setFormError(t("service_log.errors.invalid_input", ""));
      } finally {
        setSaving(false);
      }
    },
    [load, locale, t, vorm]
  );

  const lisamisplokk = (
    <div className="sl-referral-add">
      {avatud ? (
        /* `noValidate`: brauseri oma valideerimismull on ingliskeelne ja teda ei
           saa kujundada — vt ServiceLogDay. Puuduva välja ütleb meie teade. */
        <Form className="sl-form" noValidate validate={false} onSubmit={salvesta}>
          <h3 className="sl-group-title">{t("service_log.referrals.add_title", "")}</h3>

          <label className="sl-field">
            <span className="sl-label">{t("service_log.referrals.kov", "")}</span>
            <input
              name="kovName"
              className="sl-input"
              value={vorm.kovName}
              onChange={(event) => muuda("kovName", event.target.value)}
              autoComplete="off"
              required
            />
          </label>

          <div className="sl-row">
            <label className="sl-field">
              <span className="sl-label">{t("service_log.referrals.number", "")}</span>
              <input
                name="referralNumber"
                className="sl-input"
                value={vorm.referralNumber}
                onChange={(event) => muuda("referralNumber", event.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="sl-field">
              <span className="sl-label">{t("service_log.referrals.client", "")}</span>
              <input
                name="clientDisplayName"
                className="sl-input"
                value={vorm.clientDisplayName}
                onChange={(event) => muuda("clientDisplayName", event.target.value)}
                autoComplete="off"
                required
              />
            </label>
          </div>

          <div className="sl-row">
            <label className="sl-field">
              <span className="sl-label">{t("service_log.referrals.allocated", "")}</span>
              <input
                name="allocatedQuantity"
                className="sl-input"
                type="number"
                step="0.01"
                min="0"
                value={vorm.allocatedQuantity}
                onChange={(event) => muuda("allocatedQuantity", event.target.value)}
              />
              <span className="sl-hint">{t("service_log.referrals.allocated_hint", "")}</span>
            </label>
            <label className="sl-field">
              <span className="sl-label">{t("service_log.form.unit", "")}</span>
              <Dropdown
                name="unit"
                value={vorm.unit}
                onChange={(next) => muuda("unit", next)}
                ariaLabel={t("service_log.form.unit", "")}
                options={SERVICE_UNITS.map((value) => ({
                  value,
                  label: t(`service_log.units.${value.toLowerCase()}`, value)
                }))}
              />
            </label>
            <label className="sl-field">
              <span className="sl-label">{t("service_log.referrals.period_kind", "")}</span>
              <Dropdown
                name="allocationPeriod"
                value={vorm.allocationPeriod}
                onChange={(next) => muuda("allocationPeriod", next)}
                ariaLabel={t("service_log.referrals.period_kind", "")}
                options={ALLOCATION_PERIODS.map((value) => ({
                  value,
                  label: t(`service_log.allocation.${value.toLowerCase()}`, value)
                }))}
              />
            </label>
          </div>

          <div className="sl-row">
            <label className="sl-field">
              <span className="sl-label">{t("service_log.referrals.period_start", "")}</span>
              <DateField
                name="periodStart"
                value={vorm.periodStart}
                onChange={(next) => muuda("periodStart", next)}
              />
            </label>
            <label className="sl-field">
              <span className="sl-label">{t("service_log.referrals.period_end", "")}</span>
              <DateField
                name="periodEnd"
                value={vorm.periodEnd}
                onChange={(next) => muuda("periodEnd", next)}
              />
            </label>
          </div>

          <label className="sl-field">
            <span className="sl-label">{t("service_log.referrals.goals", "")}</span>
            <textarea
              name="goalsText"
              className="sl-input sl-textarea"
              rows={3}
              value={vorm.goalsText}
              onChange={(event) => muuda("goalsText", event.target.value)}
            />
            {/* Eesmärgid on sisulise aruande TUGI: mall C mõõdab edenemist
                nende vastu. Ilma nendeta muutub „edenemine" arvamuseks. */}
            <span className="sl-hint">{t("service_log.referrals.goals_hint", "")}</span>
          </label>

          {formError ? (
            <p className="sl-error" role="alert">
              {formError}
            </p>
          ) : null}

          <Button type="submit" disabled={saving}>
            {saving ? t("service_log.form.saving", "") : t("service_log.referrals.save", "")}
          </Button>
          <button type="button" className="sl-flow-undo" onClick={() => setAvatud(false)}>
            {t("service_log.referrals.cancel", "")}
          </button>
        </Form>
      ) : (
        <Button onClick={() => setAvatud(true)}>{t("service_log.referrals.add", "")}</Button>
      )}
    </div>
  );

  if (loadError) {
    return <p className="sl-error">{t("service_log.referrals.load_error", "")}</p>;
  }
  if (referrals === null) return null;

  /* Lisamisplokk on MÕLEMAS harus. Tühjas vaates on ta ainus tee edasi; täies
     vaates peab uue suunamise saama lisada ilma kuskilt mujalt alustamata. */
  if (!referrals.length) {
    return (
      <div className="sl-referrals-empty">
        <p className="sl-empty">{t("service_log.referrals.empty", "")}</p>
        {lisamisplokk}
      </div>
    );
  }

  return (
    <>
    {lisamisplokk}
    <ul className="sl-referrals">
      {referrals.map((referral) => {
        const balance = referral.balance || {};
        const undefinedAllocation = balance.remaining === null || balance.remaining === undefined;
        return (
          <li
            key={referral.id}
            className={`sl-referral${balance.overrun ? " is-overrun" : ""}${
              referral.status === "ENDED" ? " is-ended" : ""
            }`}
          >
            <div className="sl-referral-head">
              <span className="sl-referral-client">
                {referral.clientDisplayName || referral.clientUserId || "—"}
              </span>
              <span className="sl-referral-kov">{referral.kovName}</span>
            </div>

            {undefinedAllocation ? (
              /* „Maht määramata" ja „maht otsas" on vastandlikud olukorrad —
                 nulli kuvamine oleks vale info, mitte lihtsustus. */
              <p className="sl-referral-note">{t("service_log.referrals.no_allocation", "")}</p>
            ) : (
              <dl className="sl-balance">
                <div>
                  <dt>{t("service_log.referrals.allocated", "")}</dt>
                  <dd>{formatQuantity(balance.allocated, referral.unit, t)}</dd>
                </div>
                <div>
                  <dt>{t("service_log.referrals.used", "")}</dt>
                  <dd>{formatQuantity(balance.used, referral.unit, t)}</dd>
                </div>
                <div>
                  <dt>{t("service_log.referrals.pending", "")}</dt>
                  <dd>{formatQuantity(balance.pending, referral.unit, t)}</dd>
                </div>
                <div className={balance.overrun ? "sl-balance-bad" : "sl-balance-good"}>
                  <dt>{t("service_log.referrals.remaining", "")}</dt>
                  <dd>{formatQuantity(balance.remaining, referral.unit, t)}</dd>
                </div>
              </dl>
            )}

            {balance.overrun ? (
              <p className="sl-warn" role="status">
                {t("service_log.referrals.overrun", "")} {formatQuantity(balance.overrunBy, referral.unit, t)}
              </p>
            ) : null}

            {referral.status === "ENDED" ? (
              <p className="sl-referral-note">{t("service_log.referrals.ended", "")}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
    </>
  );
}
