"use client";

/**
 * TEENUSPÄEVIK-V1 E5 UI — kuunarratiiv.
 *
 * KOOND ON KIRJUTAJA EES, TEKST ON TEMA KIRJUTADA. Vasakul (mobiilis ülal) on
 * perioodi faktid — kestused, tegevused ja märkmed KOOS PÄRITOLUGA. Neid ei
 * kopeerita tekstivälja: masin ei kirjuta inimese eest lugu, mille põhjal KOV
 * teenuse jätkamise otsustab.
 *
 * PÄRITOLU ON EKRAANIL. „Ta ütles, et ei saa hakkama" ja „mulle tundus, et ta
 * ei saa hakkama" näevad koondis erinevad välja — see vahe ongi aruande
 * väärtus ja ta kaoks, kui märkmed oleks lihtsalt loetelu.
 *
 * ETTEPANEK ON ERALDI VÄLI, mitte lõigu lõpulause: see on ainus koht, mida KOV
 * loeb otsusena, ja tema järgi sünnib järgmine suunamisotsus.
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
import Form from "@/components/ui/Form";
import { PROVENANCE } from "@/lib/serviceLog/constants";

const PROPOSALS = ["CONTINUE", "CHANGE_VOLUME", "END"];

export default function ServiceLogNarrative({ month, referrals = [] }) {
  const { t, locale } = useI18n();
  const [referralId, setReferralId] = useState("");
  const [seed, setSeed] = useState(null);
  const [bodyText, setBodyText] = useState("");
  const [proposal, setProposal] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loadedId, setLoadedId] = useState(null);
  const [drafting, setDrafting] = useState(false);
  /* Kas praegune tekst tuli masinalt. Kaob niipea, kui inimene teksti
     puudutab — siis on ta juba tema oma. */
  const [isAiDraft, setIsAiDraft] = useState(false);

  const [year, monthNumber] = String(month || "").split("-");

  /**
   * MUSTAND EI SALVESTU ISE. Ta läheb samasse välja, mida inimene toimetab, ja
   * alles tema „Salvesta" teeb temast narratiivi — aruanne, mille all on
   * inimese nimi, ei tohi tekkida ilma, et ta oleks selle läbi lugenud.
   */
  const generateDraft = useCallback(async () => {
    setDrafting(true);
    setError("");
    try {
      const response = await fetch("/api/service-narratives/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" },
        body: JSON.stringify({ month, referralId: referralId || null })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body?.message || t("service_log.errors.invalid_input", ""));
        return;
      }
      setBodyText(body?.draft?.content || "");
      setIsAiDraft(true);
      setSaved(false);
    } catch {
      setError(t("service_log.errors.invalid_input", ""));
    } finally {
      setDrafting(false);
    }
  }, [locale, month, referralId, t]);

  const load = useCallback(async () => {
    if (!referralId || !year || !monthNumber) {
      setSeed(null);
      return;
    }
    try {
      const params = new URLSearchParams({
        seed: "1",
        referralId,
        periodYear: year,
        periodMonth: String(Number(monthNumber))
      });
      const response = await fetch(`/api/service-narratives?${params}`, { headers: { "x-ui-locale": locale || "et" } });
      if (!response.ok) return;
      const body = await response.json();
      setSeed(body.seed || null);

      /* OLEMASOLEV TEKST TULEB TAGASI. Ilma selleta avanes vorm TÜHJANA ka
         siis, kui narratiiv oli juba kirjutatud — ja järgmine salvestus
         kirjutas selle vaikselt üle. Kirjutaja peab saama teksti juurde
         PÄRISELT naasta, mitte alustada iga kord otsast. */
      const existing = await fetch(
        `/api/service-narratives?${new URLSearchParams({ periodYear: year, periodMonth: String(Number(monthNumber)) })}`
      );
      if (existing.ok) {
        const list = await existing.json();
        const match = (list.narratives || []).find((row) => row.referralId === referralId);
        if (match) {
          setBodyText(match.bodyText || "");
          setProposal(match.proposal || "");
          /* Salvestatud paeritolu tuleb tagasi: kord AI-ga alustatud aruanne
             jaeaeb margistatuks ka jaergmisel avamisel. */
          setIsAiDraft(match.draftSource === PROVENANCE.AI_MUSTAND);
          setLoadedId(match.id);
        } else {
          setBodyText("");
          setProposal("");
          setLoadedId(null);
        }
      }
    } catch {
      /* Koondi puudumine ei tohi kirjutamist blokeerida — tekst on inimese oma
         ja ta võib kirjutada ka ilma koondita. */
    }
  }, [locale, referralId, year, monthNumber]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = useCallback(
    async (event) => {
      event.preventDefault();
      setError("");
      setSaved(false);
      setSaving(true);
      try {
        const response = await fetch("/api/service-narratives", {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" },
          body: JSON.stringify({
            referralId,
            periodYear: Number(year),
            periodMonth: Number(monthNumber),
            bodyText,
            proposal: proposal || null,
            /* AI-PAERITOLU EI TOHI SALVESTAMISEL KAUDA. Ilma selleta naeb
               AI abil alustatud aruanne hiljem valja taeiesti inimese
               kirjutatuna — ja `draftSource` on olemas taepselt selleks, et
               seda ei juhtuks. Marge saadetakse ainult siis, kui tekst PAERINEB
               mustandist: inimene, kes kirjutas ise, ei kanna vott margist. */
            draftSource: isAiDraft ? PROVENANCE.AI_MUSTAND : null
          })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(body?.message || t("service_log.errors.invalid_input", ""));
          return;
        }
        setSaved(true);
      } catch {
        setError(t("service_log.errors.invalid_input", ""));
      } finally {
        setSaving(false);
      }
    },
    [bodyText, isAiDraft, locale, monthNumber, proposal, referralId, t, year]
  );

  if (!referrals.length) return null;

  return (
    <section className="sl-narrative">
      <h3 className="sl-list-title">{t("service_log.narrative.title", "")}</h3>

      <label className="sl-field">
        <span className="sl-label">{t("service_log.narrative.referral", "")}</span>
        <Dropdown
          name="referralId"
          value={referralId}
          onChange={setReferralId}
          placeholder={t("service_log.narrative.choose", "")}
          options={referrals.map((referral) => ({
            value: referral.id,
            label: `${referral.clientDisplayName || referral.clientUserId || "—"} · ${referral.kovName}`
          }))}
        />
      </label>

      {seed ? (
        <div className="sl-seed">
          <p className="sl-seed-line">
            {t("service_log.narrative.period", "")}: {seed.periodFrom || "—"} … {seed.periodTo || "—"} ·{" "}
            {seed.entryCount} {t("service_log.narrative.entries", "")}
            {seed.hasUnconfirmed
              ? ` · ${t("service_log.narrative.unconfirmed", "")}: ${seed.draftCount}`
              : ""}
          </p>

          {seed.goalsText ? (
            <p className="sl-seed-line">
              <strong>{t("service_log.narrative.goals", "")}:</strong> {seed.goalsText}
            </p>
          ) : (
            /* Ilma eesmärkideta muutub „edenemine" arvamuseks — ütleme seda välja. */
            <p className="sl-seed-line sl-hint">{t("service_log.narrative.no_goals", "")}</p>
          )}

          {seed.activities.length ? (
            <p className="sl-seed-line">
              {seed.activities.map((activity) => `${activity.name} ×${activity.count}`).join(" · ")}
            </p>
          ) : null}

          {seed.notes.length ? (
            <ul className="sl-seed-notes">
              {seed.notes.map((note, index) => (
                <li key={`${note.date}-${index}`}>
                  <span className="sl-seed-date">{note.date}</span>
                  <span>{note.note}</span>
                  {/* PÄRITOLU ON EKRAANIL, mitte ainult andmebaasis. */}
                  <span className="sl-source">
                    {t(`service_log.provenance.${note.provenance}`, note.provenance)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* `noValidate`: brauseri oma valideerimismull („Please fill out this
          field.") joonistab OPERATSIOONISÜSTEEM — teda ei saa kujundada ega
          tõlkida ja eestikeelsel lehel ilmus ingliskeelne kollane mull klaasi
          keskele. Sama põhjus, miks siin ei ole natiivset `select`-i ega
          kuupäevavälja. Nõue ise jääb alles: väli kannab endiselt `required`-i
          (ekraanilugeja jaoks) ja puuduva välja ütleb meie oma teade. */}
      <Form className="sl-form" noValidate validate={false} onSubmit={submit}>
        <label className="sl-field">
          <span className="sl-label">{t("service_log.narrative.body", "")}</span>
          <textarea
            name="bodyText"
            className="sl-input sl-textarea"
            rows={6}
            value={bodyText}
            onChange={(event) => {
              setBodyText(event.target.value);
              setIsAiDraft(false);
            }}
            required
          />
          <span className="sl-hint">{t("service_log.narrative.body_hint", "")}</span>

          {/* AI-MUSTAND (E5). Nupp on VORMI SEES ja tekst läheb samasse välja,
              mida inimene toimetab — mustand ei ole eraldi objekt, vaid
              lähtepunkt. Salvestamine käib endiselt inimese nupu alt. */}
          {seed?.entryCount ? (
            <div className="sl-draft-actions">
              <button
                type="button"
                className="sl-tab"
                disabled={drafting}
                onClick={generateDraft}
              >
                {drafting
                  ? t("service_log.narrative.drafting", "")
                  : t("service_log.narrative.draft_button", "")}
              </button>
              {/* MASINA TEKST ON MÄRGISTATUD kuni inimene teda puudutab. Ilma
                  selleta oleks masina lõik aruandes eristamatu inimese omast. */}
              {isAiDraft ? (
                <p className="sl-source" role="status">
                  {t("service_log.narrative.draft_marker", "")}
                </p>
              ) : null}
            </div>
          ) : null}
        </label>

        <label className="sl-field">
          <span className="sl-label">{t("service_log.narrative.proposal", "")}</span>
          <Dropdown
            name="proposal"
            value={proposal}
            onChange={setProposal}
            placeholder={t("service_log.narrative.proposal_none", "")}
            options={PROPOSALS.map((value) => ({
              value,
              label: t(`service_log.proposals.${value}`, value)
            }))}
          />
          <span className="sl-hint">{t("service_log.narrative.proposal_hint", "")}</span>
        </label>

        {error ? (
          <p className="sl-error" role="alert">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="sl-warn" role="status" aria-live="polite">
            {t("service_log.narrative.saved", "")}
          </p>
        ) : null}
        {loadedId && !saved ? (
          <p className="sl-hint">{t("service_log.narrative.loaded", "")}</p>
        ) : null}

        <Button type="submit" disabled={saving || !referralId || !bodyText.trim()}>
          {saving ? t("service_log.form.saving", "") : t("service_log.narrative.save", "")}
        </Button>
      </Form>
    </section>
  );
}
