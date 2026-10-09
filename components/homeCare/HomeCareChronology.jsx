"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";

import { newClientActionKey } from "@/components/casework/caseWorkClient";
import { useI18n } from "@/components/i18n/I18nProvider";
import DateField from "@/components/ui/DateField";
import { CareEntryKind, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { clientHref, formatDateTime, homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Kronoloogia koostamine hooldusjuhile.
 *
 * Kolm sammu ühel lehel: ajavahemik, kirjete ülevaatus, dokumendi andmed.
 * Dokumenti lähevad AINULT valitud kirjed. Piiratud nähtavusega kirjed (mure,
 * kahtlus) on vaikimisi välja jäetud: nende väljastamine peab olema teadlik
 * valik. Teksti muutmine siin päeviku kirjet ei muuda; dokumendis on märge, et
 * koostaja on teksti lühendanud.
 *
 * Koostatud dokument on hetkekoopia ja avaneb eraldi vahelehel prinditava
 * lehena (brauser salvestab selle PDF-ina).
 */
export default function HomeCareChronology({ context, client }) {
  const { t } = useI18n();
  const { call, busy, error } = useHomeCareApi();
  const fieldId = useId();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const base = `${homeCareBase(organizationId)}/kliendid/${client.id}/kronoloogia`;

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [draft, setDraft] = useState(null);
  /* entryId -> { included, text (null = päeviku tekst), editing } */
  const [choices, setChoices] = useState({});
  const [requester, setRequester] = useState("");
  const [basis, setBasis] = useState("");
  const [registryRef, setRegistryRef] = useState("");
  const [summary, setSummary] = useState("");
  const [release, setRelease] = useState(null);
  /* Üks koostamiskatse = üks võti. Sama sisuga uuesti saatmine (topeltklõps,
     võrgu kordus) kasutab sama võtit ja saab sama väljastuse; muudetud sisu on
     uus katse. Tööloend on muutmatu, kaht rida sinna jääda ei tohi. */
  const attemptRef = useRef(null);
  /* Dokumendi andmete muutmine pärast koostamist on uus dokument: nupp avaneb uuesti. */
  const editDetail = (setter) => (event) => {
    setRelease(null);
    setter(event.target.value);
  };

  const loadDraft = async (event) => {
    event.preventDefault();
    setRelease(null);
    const result = await call(`${base}/mustand`, {
      method: "POST",
      body: { from, to },
      fallbackKey: "home_care.errors.list_failed"
    });
    if (!result.ok) return;
    const next = {};
    for (const item of result.data.draft.items) {
      next[item.entryId] = { included: !item.coordinatorOnly, text: null, editing: false };
    }
    setChoices(next);
    setDraft(result.data.draft);
  };

  const patchChoice = (entryId, patch) => {
    setRelease(null);
    setChoices((current) => ({ ...current, [entryId]: { ...current[entryId], ...patch } }));
  };

  const items = draft?.items || [];
  const selected = items.filter((item) => choices[item.entryId]?.included);

  const create = async (event) => {
    event.preventDefault();
    const body = {
      from: draft.from,
      to: draft.to,
      requester,
      basis,
      registryRef,
      summary,
      items: selected.map((item) => {
        const choice = choices[item.entryId];
        /* `revision`: versioon, mida koostaja siin nägi. Kui kirjet on vahepeal
           parandatud, keeldub server ja kirjed tuleb uuesti üle vaadata. */
        return choice.text === null || choice.text === item.text
          ? { entryId: item.entryId, revision: item.revision }
          : { entryId: item.entryId, revision: item.revision, text: choice.text };
      })
    };
    const shape = JSON.stringify(body);
    if (attemptRef.current?.shape !== shape) attemptRef.current = { shape, key: newClientActionKey() };
    const result = await call(base, {
      method: "POST",
      body: { ...body, clientRequestId: attemptRef.current.key },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (result.ok) setRelease(result.data.release);
  };

  return (
    <section className="hc-shell">
      <Link className="hc-back" href={clientHref(organizationId, client.id)} prefetch={false}>
        {t("home_care.chronology.back")}
      </Link>

      <header className="hc-head">
        <h1 className="hc-title">{t("home_care.chronology.title")}</h1>
        <p className="hc-sub">{client.displayName}</p>
        <p className="hc-sub">{t("home_care.chronology.intro")}</p>
      </header>

      <form className="hc-section" onSubmit={loadDraft}>
        <h2 className="hc-section-title">{t("home_care.chronology.period_title")}</h2>
        <div className="hc-grid hc-grid--two">
          <div className="hc-field">
            <span className="hc-label">{t("home_care.filter.from")}</span>
            <DateField name="from" value={from} onChange={(value) => setFrom(value || "")} ariaLabel={t("home_care.filter.from")} />
          </div>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.filter.to")}</span>
            <DateField name="to" value={to} onChange={(value) => setTo(value || "")} ariaLabel={t("home_care.filter.to")} />
          </div>
        </div>
        <div className="hc-row">
          <button className="hc-btn" type="submit" disabled={busy || !from || !to}>
            {t("home_care.chronology.load")}
          </button>
        </div>
      </form>

      {draft ? (
        <section className="hc-section">
          <h2 className="hc-section-title">
            {t("home_care.chronology.entries_title", { selected: selected.length, total: items.length })}
          </h2>
          {items.length === 0 ? (
            <p className="hc-sub">{t("home_care.chronology.empty")}</p>
          ) : (
            <ul className="hc-list hc-list--plain">
              {items.map((item) => {
                const choice = choices[item.entryId] || { included: false, text: null, editing: false };
                const shownText = choice.text === null ? item.text : choice.text;
                const edited = choice.text !== null && choice.text !== item.text;
                return (
                  <li key={item.entryId} className="hc-entry">
                    <label className="hc-check">
                      <input
                        type="checkbox"
                        checked={choice.included}
                        onChange={(event) => patchChoice(item.entryId, { included: event.target.checked })}
                      />
                      <span>
                        {t("home_care.chronology.include")}: {formatDateTime(item.occurredAt, timeZone)} · {item.authorName}
                      </span>
                    </label>
                    <div className="hc-entry__head">
                      {item.kind !== CareEntryKind.NOTE ? (
                        <span className="hc-badge">{t(`home_care.entry.kinds.${item.kind}`)}</span>
                      ) : null}
                      {item.incidentType ? (
                        <span className="hc-badge">{t(`home_care.incident.types.${item.incidentType}`)}</span>
                      ) : null}
                      {item.coordinatorOnly ? (
                        <span className="hc-badge hc-badge--warn">{t("home_care.chronology.restricted")}</span>
                      ) : null}
                      {edited ? <span className="hc-badge">{t("home_care.chronology.edited")}</span> : null}
                    </div>
                    {choice.editing ? (
                      <div className="hc-field">
                        <label className="hc-label" htmlFor={`${fieldId}-${item.entryId}`}>
                          {t("home_care.chronology.text_label")}
                        </label>
                        <textarea
                          id={`${fieldId}-${item.entryId}`}
                          className="hc-textarea"
                          value={shownText}
                          onChange={(event) => patchChoice(item.entryId, { text: event.target.value })}
                          maxLength={HOME_CARE_LIMITS.ENTRY_TEXT_MAX}
                          rows={4}
                        />
                      </div>
                    ) : (
                      <p className={`hc-entry__text${choice.included ? "" : " hc-entry__text--muted"}`}>{shownText}</p>
                    )}
                    {choice.included ? (
                      <div className="hc-row">
                        <button
                          className="hc-btn hc-btn--quiet"
                          type="button"
                          onClick={() => patchChoice(item.entryId, { editing: !choice.editing })}
                          aria-expanded={choice.editing}
                        >
                          {t("home_care.chronology.edit_text")}
                        </button>
                        {edited ? (
                          <button
                            className="hc-btn hc-btn--quiet"
                            type="button"
                            onClick={() => patchChoice(item.entryId, { text: null, editing: false })}
                          >
                            {t("home_care.chronology.reset_text")}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {draft && items.length > 0 ? (
        <form className="hc-section" onSubmit={create}>
          <h2 className="hc-section-title">{t("home_care.chronology.details_title")}</h2>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-requester`}>
              {t("home_care.chronology.requester")}
            </label>
            <input
              id={`${fieldId}-requester`}
              className="hc-input"
              value={requester}
              onChange={editDetail(setRequester)}
              maxLength={HOME_CARE_LIMITS.CHRONOLOGY_LINE_MAX}
              required
              autoComplete="off"
              aria-describedby={`${fieldId}-requester-hint`}
            />
            <p className="hc-hint" id={`${fieldId}-requester-hint`}>
              {t("home_care.chronology.requester_hint")}
            </p>
          </div>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-basis`}>
              {t("home_care.chronology.basis")}
            </label>
            <input
              id={`${fieldId}-basis`}
              className="hc-input"
              value={basis}
              onChange={editDetail(setBasis)}
              maxLength={HOME_CARE_LIMITS.CHRONOLOGY_LINE_MAX}
              required
              autoComplete="off"
              aria-describedby={`${fieldId}-basis-hint`}
            />
            <p className="hc-hint" id={`${fieldId}-basis-hint`}>
              {t("home_care.chronology.basis_hint")}
            </p>
          </div>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-ref`}>
              {t("home_care.chronology.registry_ref")}
            </label>
            <input
              id={`${fieldId}-ref`}
              className="hc-input"
              value={registryRef}
              onChange={editDetail(setRegistryRef)}
              maxLength={HOME_CARE_LIMITS.CHRONOLOGY_REF_MAX}
              autoComplete="off"
            />
          </div>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-summary`}>
              {t("home_care.chronology.summary")}
            </label>
            <textarea
              id={`${fieldId}-summary`}
              className="hc-textarea"
              value={summary}
              onChange={editDetail(setSummary)}
              maxLength={HOME_CARE_LIMITS.ENTRY_TEXT_MAX}
              rows={4}
            />
          </div>
          <div className="hc-row">
            <button
              className="hc-btn hc-btn--primary"
              type="submit"
              disabled={busy || selected.length === 0 || Boolean(release) || !context.writable}
            >
              {t("home_care.chronology.create")}
            </button>
          </div>
          {context.writable ? null : <p className="hc-hint">{t("home_care.client.read_only")}</p>}
        </form>
      ) : null}

      {error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}

      {release ? (
        <section className="hc-section hc-section--card" role="status">
          <p className="hc-ok">{t("home_care.chronology.created")}</p>
          <p className="hc-hint">{t("home_care.chronology.print_hint")}</p>
          <div className="hc-row">
            <a
              className="hc-btn hc-btn--primary hc-btn--link"
              href={`${homeCareBase(organizationId)}/valjastused/${release.id}/dokument`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("home_care.chronology.open_document")}
            </a>
            <Link className="hc-btn hc-btn--link" href={`/org/${organizationId}/koduteenus/valjastused`}>
              {t("home_care.releases.link")}
            </Link>
          </div>
        </section>
      ) : null}
    </section>
  );
}
