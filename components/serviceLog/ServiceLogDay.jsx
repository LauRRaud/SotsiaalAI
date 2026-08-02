"use client";

/**
 * TEENUSPÄEVIK-V1 E2 — „Päev": kiirsisestus ja neli märget.
 *
 * KOLM ASJA, MIS SIIN ON TEADLIKUD:
 *
 * 1. KLIENT ENNE, teenus tuletatakse. Osutaja mõtleb „käisin Mardi juures kaks
 *    tundi", mitte „osutasin teenust X". Teenuse valik ilmub AINULT siis, kui
 *    server ütleb `askService` — reeglid elavad serveris
 *    (`lib/serviceLog/entryDerivation.js`), mitte siin. Kaks eri „mida küsida"
 *    loogikat lahkneksid vaikselt.
 *
 * 2. NELI MÄRGET on suured nupud. Iga puude on ajatempel; kestus ja kogus
 *    tuletatakse. LÄKSIN ja TAGASI on VALIKULISED — järjestikuste klientide
 *    puhul ei ole tagasisõitu ja nende nõudmine teeks voost bürokraatia.
 *
 * 3. MÄRKUSE PIIRANG ON NÄHTAV. Väli ütleb otse, et siia ei kirjutata tundlikku
 *    sisu. ⓘ ütleb sedasama pikemalt. Ilma selleta muutub „lühike faktimärge"
 *    juhtumilooks ja säilitusaeg (7 aastat) hakkab kandma valet sisu.
 *
 * KEELEPÄIS ON KLIENDI KOHUSTUS. `localeFromRequest` loeb päringut ja päiseid,
   AGA MITTE keeleküpsist — ilma `x-ui-locale`-ta tuleb serveri veateade
   inglise keeles keset eestikeelset pinda. Brauserikontroll näitas seda
   („The entry is already final."); `i18n:check` ei saa seda püüda, sest
   võtmed on kõigis keeltes olemas — vale on KUTSE, mitte sõnastik.
   Sama muster, mida kasutab admin-kiht (`x-ui-locale: locale`).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useEffectiveRole } from "@/components/auth/useEffectiveRole";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { SERVICE_UNITS, VISIT_STAMP } from "@/lib/serviceLog/constants";

const STAMP_SEQUENCE = [
  { key: VISIT_STAMP.DEPARTED, labelKey: "service_log.stamps.departed", optional: true },
  { key: VISIT_STAMP.ARRIVED, labelKey: "service_log.stamps.arrived", optional: false },
  { key: VISIT_STAMP.LEFT, labelKey: "service_log.stamps.left", optional: false },
  { key: VISIT_STAMP.RETURNED, labelKey: "service_log.stamps.returned", optional: true }
];

function todayIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
    .toISOString()
    .slice(0, 10);
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function ServiceLogDay() {
  const { t, locale } = useI18n();
  /* Roll tuleb platvormi ROLLIVAATEST, mitte toorest sessioonist — vt
     `ServiceLogShell` ja `lib/serviceLog/access.js`. */
  const { effectiveRole, isRoleResolved } = useEffectiveRole();
  const allowed = effectiveRole === "SERVICE_PROVIDER";

  const [entries, setEntries] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [overrunNotice, setOverrunNotice] = useState(null);
  const [referralId, setReferralId] = useState("");
  const [finalizing, setFinalizing] = useState("");
  const [finalizeError, setFinalizeError] = useState("");

  const [clientName, setClientName] = useState("");
  const [date, setDate] = useState(todayIso());
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("HOUR");
  const [serviceId, setServiceId] = useState("");
  const [note, setNote] = useState("");
  const [stamps, setStamps] = useState({});
  const [defaults, setDefaults] = useState(null);

  const loadEntries = useCallback(async () => {
    try {
      setLoadError(false);
      const response = await fetch("/api/service-entries?take=50", { headers: { "x-ui-locale": locale || "et" } });
      const body = await response.json().catch(() => ({}));
      /* PÕHJUS, MITTE ÜLDINE TÕRGE. „Kirjete laadimine ebaõnnestus" ei ütle
         kasutajale midagi: kõige tavalisem juhtum on hoopis see, et tal ei ole
         veel teenuseprofiili, ja seda oskab ta ise parandada. */
      if (!response.ok) {
        setLoadError(body?.message || true);
        setEntries((current) => current || []);
        return;
      }
      setEntries(Array.isArray(body.entries) ? body.entries : []);
    } catch {
      setLoadError(true);
      setEntries((current) => current || []);
    }
  }, [locale]);

  useEffect(() => {
    if (allowed) loadEntries();
  }, [allowed, loadEntries]);

  /* Tuletamisotsus küsitakse serverilt kohe, kui klient on teada — see on see
     koht, kus küsimused kaovad (või jäävad). */
  useEffect(() => {
    if (!allowed || !clientName.trim()) {
      setDefaults(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ defaults: "1", clientDisplayName: clientName.trim() });
        const response = await fetch(`/api/service-entries?${params}`, { headers: { "x-ui-locale": locale || "et" } });
        if (!response.ok) return;
        const body = await response.json();
        if (cancelled) return;
        setDefaults(body.defaults || null);
        /* TULETAMISVASTUS ON TÕDE, ka siis kui ta on TÜHI. Varem jäid siia
           eelmise kliendi väärtused alles: server ütles `askUnit`, aga vormis
           seisis endiselt eelmise kliendi ühik ja kasutaja salvestas selle
           märkamata. Tühi vastus peab välja puhastama, mitte vaikima. */
        setServiceId(body.defaults?.serviceId || "");
        setUnit(body.defaults?.unit || "");
        /* Ühese suunamise korral seome kirje ise; mitme korral jääb valik
           kasutajale ja vorm KÜSIB — varem läks siit `referralId: null` ja
           kirje jäi KOV-i ekspordist ning saldost välja. */
        setReferralId(body.defaults?.referralId || "");
      } catch {
        /* Tuletamise ebaõnnestumine ei tohi sisestust blokeerida: kasutaja
           täidab väljad käsitsi ja server valideerib niikuinii. */
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [allowed, clientName, locale]);

  const derivedQuantity = useMemo(() => {
    const arrived = stamps[VISIT_STAMP.ARRIVED];
    const left = stamps[VISIT_STAMP.LEFT];
    if (!arrived || !left || unit !== "HOUR") return null;
    const minutes = (new Date(left).getTime() - new Date(arrived).getTime()) / 60000;
    if (minutes <= 0) return null;
    return Math.round((minutes / 60) * 100) / 100;
  }, [stamps, unit]);

  const stampNow = useCallback((key) => {
    setStamps((current) => ({ ...current, [key]: new Date().toISOString() }));
  }, []);

  /* KINNITAMINE PEAB OLEMA UI-s. Kirje sünnib mustandina ja eksport jätab
     mustandid vaikimisi välja — ilma selle nuputa võis osutaja sisestada terve
     kuu ja eksportida NULL rida, ilma et miski oleks katki paistnud. */
  const finalize = useCallback(
    async (entryId) => {
      setFinalizing(entryId);
      setFinalizeError("");
      try {
        const response = await fetch(`/api/service-entries/${entryId}/lifecycle`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" },
          body: JSON.stringify({ action: "finalize" })
        });
        if (response.ok) {
          await loadEntries();
          return;
        }
        /* TÕRGE EI TOHI OLLA VAIKNE. Varem neelati vastus alla: kasutaja
           vajutas „Kinnita", mitte midagi ei juhtunud ja kirje jäi mustandiks —
           ta saanuks sellest teada alles kuu lõpus tühjast ekspordist. */
        const body = await response.json().catch(() => ({}));
        setFinalizeError(body?.message || t("service_log.errors.invalid_input", ""));
      } catch {
        setFinalizeError(t("service_log.errors.invalid_input", ""));
      } finally {
        setFinalizing("");
      }
    },
    [loadEntries, locale, t]
  );

  const resetForm = useCallback(() => {
    setClientName("");
    setQuantity("");
    setNote("");
    setStamps({});
    setDefaults(null);
    setServiceId("");
    setReferralId("");
    setDate(todayIso());
  }, []);

  const submit = useCallback(
    async (event) => {
      event.preventDefault();
      setFormError("");
      setSaving(true);
      try {
        const response = await fetch("/api/service-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" },
          body: JSON.stringify({
            clientDisplayName: clientName.trim(),
            date,
            unit,
            serviceId: serviceId || null,
            referralId: referralId || null,
            quantity: quantity === "" ? null : quantity,
            note: note.trim() || null,
            ...stamps
          })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setFormError(body?.message || t("service_log.errors.invalid_input", ""));
          return;
        }
        /* ÜLETAMISE HOIATUS (DoD 4). Server tagastab ta kirjega KOOS ja ta ei
           ole viga: kirje SALVESTUS. Osutaja näeb numbrit ja otsustab ise, kas
           ta räägib KOV-iga — dokumenteerimata töö oleks halvem. */
        if (body?.entry?.overrun?.warn) {
          setOverrunNotice(body.entry.overrun);
        } else {
          setOverrunNotice(null);
        }
        resetForm();
        await loadEntries();
      } catch {
        setFormError(t("service_log.errors.invalid_input", ""));
      } finally {
        setSaving(false);
      }
    },
    [clientName, date, loadEntries, locale, note, quantity, referralId, resetForm, serviceId, stamps, t, unit]
  );

  if (!isRoleResolved) return null;

  return (
    <div className="sl-day">
      <form className="sl-form" onSubmit={submit}>
        {/* KLIENT ENNE — see väli on esimene ja fookuses. */}
        <label className="sl-field">
          <span className="sl-label">{t("service_log.form.client", "")}</span>
          <input
            name="clientDisplayName"
            className="sl-input"
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            autoComplete="off"
            required
          />
        </label>

        {/* SUUNAMISE VALIK. Server ütleb `askReferral`, kui kliendil on mitu
            aktiivset suunamist — siis EI TOHI masin valida, sest vale
            suunamine tähendab valele KOV-ile esitatud mahtu. */}
        {defaults?.askReferral && Array.isArray(defaults.referrals) && defaults.referrals.length > 1 ? (
          <label className="sl-field">
            <span className="sl-label">{t("service_log.form.referral", "")}</span>
            <select
              name="referralId"
              className="sl-input"
              value={referralId}
              onChange={(event) => setReferralId(event.target.value)}
              required
            >
              <option value="">{t("service_log.form.referral_choose", "")}</option>
              {defaults.referrals.map((referral) => (
                <option key={referral.id} value={referral.id}>
                  {referral.kovName}
                  {referral.referralNumber ? ` · ${referral.referralNumber}` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {/* Teenuse valik ilmub AINULT siis, kui server ütleb, et küsida tuleb. */}
        {defaults?.askService && Array.isArray(defaults.services) && defaults.services.length > 1 ? (
          <label className="sl-field">
            <span className="sl-label">{t("service_log.form.service", "")}</span>
            <select
              name="serviceId"
              className="sl-input"
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
            >
              <option value="">{t("service_log.form.service_choose", "")}</option>
              {defaults.services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="sl-stamps" role="group" aria-label={t("service_log.stamps.group", "")}>
          {STAMP_SEQUENCE.map((stamp) => (
            <button
              key={stamp.key}
              type="button"
              className={`sl-stamp${stamps[stamp.key] ? " is-done" : ""}`}
              onClick={() => stampNow(stamp.key)}
            >
              <span className="sl-stamp-label">{t(stamp.labelKey, "")}</span>
              <span className="sl-stamp-time">
                {stamps[stamp.key]
                  ? formatTime(stamps[stamp.key])
                  : stamp.optional
                    ? t("service_log.stamps.optional", "")
                    : ""}
              </span>
            </button>
          ))}
        </div>

        <div className="sl-row">
          <label className="sl-field">
            <span className="sl-label">{t("service_log.form.date", "")}</span>
            <input
              name="date"
              className="sl-input"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>

          <label className="sl-field">
            <span className="sl-label">{t("service_log.form.quantity", "")}</span>
            <input
              name="quantity"
              className="sl-input"
              type="number"
              step="0.25"
              min="0"
              inputMode="decimal"
              value={quantity}
              placeholder={derivedQuantity !== null ? String(derivedQuantity) : ""}
              onChange={(event) => setQuantity(event.target.value)}
            />
            {derivedQuantity !== null && quantity === "" ? (
              <span className="sl-hint">{t("service_log.form.quantity_derived", "")}</span>
            ) : null}
          </label>

          <label className="sl-field">
            <span className="sl-label">{t("service_log.form.unit", "")}</span>
            <select
              name="unit"
              className="sl-input"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
            >
              {SERVICE_UNITS.map((value) => (
                <option key={value} value={value}>
                  {t(`service_log.units.${value.toLowerCase()}`, value)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="sl-field">
          <span className="sl-label">{t("service_log.form.note", "")}</span>
          <textarea
            name="note"
            className="sl-input sl-textarea"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          {/* Piirang on NÄHTAV, mitte ainult ⓘ-s peidus. */}
          <span className="sl-hint">{t("service_log.form.note_hint", "")}</span>
        </label>

        {overrunNotice ? (
          <p className="sl-warn" role="status">
            {t("service_log.form.overrun_saved", "")} {overrunNotice.overBy}
          </p>
        ) : null}

        {formError ? (
          <p className="sl-error" role="alert">
            {formError}
          </p>
        ) : null}

        <Button type="submit" disabled={saving || !clientName.trim()}>
          {saving ? t("service_log.form.saving", "") : t("service_log.form.save", "")}
        </Button>
      </form>

      <div className="sl-list">
        <h2 className="sl-list-title">{t("service_log.list.title", "")}</h2>
        {finalizeError ? (
          <p className="sl-error" role="alert" aria-live="assertive">
            {finalizeError}
          </p>
        ) : null}
        {loadError ? (
          <p className="sl-error" role="alert">
            {typeof loadError === "string" ? loadError : t("service_log.list.load_error", "")}
          </p>
        ) : null}
        {entries === null ? null : entries.length === 0 ? (
          <p className="sl-empty">{t("service_log.list.empty", "")}</p>
        ) : (
          <ul className="sl-entries">
            {entries.map((entry) => (
              <li key={entry.id} className="sl-entry">
                <span className="sl-entry-client">{entry.clientDisplayName || "—"}</span>
                <span className="sl-entry-meta">
                  {entry.date} · {entry.quantity}{" "}
                  {t(`service_log.units.${String(entry.unit).toLowerCase()}`, entry.unit)}
                  {entry.travelMinutes !== null
                    ? ` · ${t("service_log.list.travel", "")} ${entry.travelMinutes} min`
                    : ""}
                  {" · "}
                  {t(`service_log.status.${String(entry.status || "DRAFT").toLowerCase()}`, entry.status)}
                </span>
                {entry.status === "DRAFT" ? (
                  <button
                    type="button"
                    className="sl-tab"
                    disabled={finalizing === entry.id}
                    onClick={() => finalize(entry.id)}
                  >
                    {finalizing === entry.id
                      ? t("service_log.form.saving", "")
                      : t("service_log.list.finalize", "")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
