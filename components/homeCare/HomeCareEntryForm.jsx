"use client";

import { useId, useRef, useState } from "react";

import { fromLocalInputValue, newClientActionKey, toLocalInputValue } from "@/components/casework/caseWorkClient";
import { useI18n } from "@/components/i18n/I18nProvider";
import Dropdown from "@/components/ui/Dropdown";
import {
  CARE_CONTACT_MODES,
  CARE_ENTRY_KINDS,
  CARE_INCIDENT_ACTIONS,
  CARE_INCIDENT_TYPES,
  COORDINATOR_ONLY_INCIDENT_TYPES,
  CareContactMode,
  CareEntryKind,
  HOME_CARE_LIMITS
} from "@/lib/homeCare/constants";

import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Päevikukirje vorm: uus kirje või olemasoleva parandus.
 *
 * KORDUSSAATMINE. Esimesel katsel pannakse paika päringu võti, sündmuse aeg ja
 * tehtud sammude kellaajad. Kui salvestus ebaõnnestub ja inimene vajutab
 * uuesti, läheb teele TÄPSELT sama keha: server tunneb korduse ära ja teist
 * kirjet ei teki. Uus võti tekib alles siis, kui sisu muudetakse.
 *
 * VEA KORRAL JÄÄB TEKST ALLES. Vorm tühjendatakse ainult õnnestumise järel.
 *
 * PARANDUS nõuab põhjust. Erijuhtumit ei saa parandusega tavaliseks kirjeks
 * muuta ega vastupidi, seepärast on liigivalik paranduses kitsam.
 */
export default function HomeCareEntryForm({
  organizationId,
  clientId,
  team = [],
  viewerMembershipId = null,
  entry = null,
  onSaved,
  onCancel
}) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const attemptRef = useRef(null);
  const correcting = Boolean(entry);
  const wasIncident = entry?.kind === CareEntryKind.INCIDENT;

  const [kind, setKind] = useState(entry?.kind || CareEntryKind.NOTE);
  const [contactMode, setContactMode] = useState(entry?.contactMode || CareContactMode.VISIT);
  const [text, setText] = useState(entry?.text || "");
  const [occurredLocal, setOccurredLocal] = useState("");
  const [companion, setCompanion] = useState(entry?.companionMembershipId || "");
  const [incidentType, setIncidentType] = useState(entry?.incident?.type || "");
  const [assessment, setAssessment] = useState(entry?.incident?.assessment || "");
  const [actions, setActions] = useState(() => {
    const map = {};
    for (const action of entry?.incident?.actions || []) map[action.code] = action.at || null;
    return map;
  });
  const [reason, setReason] = useState("");
  const [saved, setSaved] = useState(false);

  const isIncident = kind === CareEntryKind.INCIDENT;
  const coordinatorOnly =
    kind === CareEntryKind.CONCERN || (isIncident && COORDINATOR_ONLY_INCIDENT_TYPES.includes(incidentType));

  const kindChoices = CARE_ENTRY_KINDS.filter((value) => {
    if (!correcting) return true;
    return wasIncident ? value === CareEntryKind.INCIDENT : value !== CareEntryKind.INCIDENT;
  });

  const companionOptions = [
    { value: "", label: t("home_care.entry.companion_none") },
    ...team
      .filter((member) => member.active && member.membershipId !== viewerMembershipId)
      .map((member) => ({ value: member.membershipId, label: member.name }))
  ];
  /* Parandatava kirje kaaslane võib olla meeskonnast lahkunud; valik peab
     teda siiski näitama, muidu võtaks parandus ta kirjelt vaikselt maha. */
  if (entry?.companionMembershipId && !companionOptions.some((option) => option.value === entry.companionMembershipId)) {
    companionOptions.push({ value: entry.companionMembershipId, label: entry.companionName || "" });
  }

  const touch = () => {
    setSaved(false);
    if (error) setError("");
  };

  const toggleAction = (code) => {
    touch();
    setActions((current) => {
      const next = { ...current };
      if (code in next) delete next[code];
      else next[code] = null;
      return next;
    });
  };

  const reset = () => {
    attemptRef.current = null;
    setKind(CareEntryKind.NOTE);
    setContactMode(CareContactMode.VISIT);
    setText("");
    setOccurredLocal("");
    setCompanion("");
    setIncidentType("");
    setAssessment("");
    setActions({});
    setReason("");
  };

  const buildBody = () => {
    const actionCodes = CARE_INCIDENT_ACTIONS.filter((code) => code in actions);
    const signature = JSON.stringify([
      kind,
      contactMode,
      text,
      occurredLocal,
      companion,
      isIncident ? incidentType : "",
      isIncident ? assessment : "",
      isIncident ? actionCodes : [],
      reason
    ]);
    if (attemptRef.current?.signature === signature) return attemptRef.current.body;

    const nowIso = new Date().toISOString();
    const occurredAt = occurredLocal
      ? fromLocalInputValue(occurredLocal)
      : correcting
        ? entry.occurredAt
        : nowIso;
    const body = {
      kind,
      contactMode,
      text,
      occurredAt,
      companionMembershipId: companion || null
    };
    if (isIncident) {
      body.incidentType = incidentType;
      body.incidentAssessment = assessment;
      body.incidentActions = actionCodes.map((code) => ({ code, at: actions[code] || nowIso }));
    }
    if (correcting) {
      body.reason = reason;
    } else {
      body.deviceCreatedAt = nowIso;
      body.clientRequestId = newClientActionKey();
    }
    attemptRef.current = { signature, body };
    return body;
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaved(false);
    const body = buildBody();
    const base = `${homeCareBase(organizationId)}/kliendid/${clientId}/kirjed`;
    const result = correcting
      ? await call(`${base}/${entry.id}`, { method: "PATCH", body, fallbackKey: "home_care.errors.save_failed" })
      : await call(base, { method: "POST", body, fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return;
    onSaved?.(result.data.entry);
    if (!correcting) {
      reset();
      setSaved(true);
    }
  };

  const textLabel = isIncident ? t("home_care.incident.text_label") : t("home_care.entry.text_label");

  return (
    <form className="hc-form" onSubmit={submit}>
      <div className="hc-field">
        <span className="hc-label" id={`${fieldId}-kind`}>
          {t("home_care.entry.kind_label")}
        </span>
        <div className="hc-chips" role="group" aria-labelledby={`${fieldId}-kind`}>
          {kindChoices.map((value) => (
            <button
              key={value}
              type="button"
              className="hc-chip"
              aria-pressed={kind === value}
              onClick={() => {
                touch();
                setKind(value);
              }}
            >
              {t(`home_care.entry.kinds.${value}`)}
            </button>
          ))}
        </div>
      </div>

      {isIncident ? (
        <>
          <p className="hc-notice hc-notice--warn">{t("home_care.incident.notice")}</p>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.incident.type_label")}</span>
            <Dropdown
              value={incidentType}
              onChange={(value) => {
                touch();
                setIncidentType(value);
              }}
              ariaLabel={t("home_care.incident.type_label")}
              placeholder={t("home_care.incident.type_label")}
              options={CARE_INCIDENT_TYPES.map((value) => ({ value, label: t(`home_care.incident.types.${value}`) }))}
              required
            />
          </div>
        </>
      ) : null}

      <div className="hc-field">
        <label className="hc-label" htmlFor={`${fieldId}-text`}>
          {textLabel}
        </label>
        <textarea
          id={`${fieldId}-text`}
          className="hc-textarea"
          value={text}
          onChange={(event) => {
            touch();
            setText(event.target.value);
          }}
          maxLength={HOME_CARE_LIMITS.ENTRY_TEXT_MAX}
          rows={4}
          required
          aria-describedby={`${fieldId}-text-hint`}
        />
        <p className="hc-hint" id={`${fieldId}-text-hint`}>
          {t("home_care.entry.write_what_you_saw")}
        </p>
      </div>

      {isIncident ? (
        <>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-assessment`}>
              {t("home_care.incident.assessment_label")}
            </label>
            <textarea
              id={`${fieldId}-assessment`}
              className="hc-textarea hc-textarea--short"
              value={assessment}
              onChange={(event) => {
                touch();
                setAssessment(event.target.value);
              }}
              maxLength={HOME_CARE_LIMITS.ASSESSMENT_MAX}
              rows={2}
            />
          </div>
          <fieldset className="hc-fieldset">
            <legend className="hc-label">{t("home_care.incident.actions_label")}</legend>
            {CARE_INCIDENT_ACTIONS.map((code) => (
              <label key={code} className="hc-check">
                <input type="checkbox" checked={code in actions} onChange={() => toggleAction(code)} />
                <span>{t(`home_care.incident.actions.${code}`)}</span>
              </label>
            ))}
          </fieldset>
        </>
      ) : null}

      <div className="hc-field">
        <span className="hc-label" id={`${fieldId}-contact`}>
          {t("home_care.entry.contact_label")}
        </span>
        <div className="hc-chips" role="group" aria-labelledby={`${fieldId}-contact`}>
          {CARE_CONTACT_MODES.map((value) => (
            <button
              key={value}
              type="button"
              className="hc-chip"
              aria-pressed={contactMode === value}
              onClick={() => {
                touch();
                setContactMode(value);
              }}
            >
              {t(`home_care.entry.contact.${value}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="hc-grid hc-grid--two">
        <div className="hc-field">
          <label className="hc-label" htmlFor={`${fieldId}-occurred`}>
            {t("home_care.entry.occurred_label")}
          </label>
          <input
            id={`${fieldId}-occurred`}
            className="hc-input"
            type="datetime-local"
            value={occurredLocal || (correcting ? toLocalInputValue(entry.occurredAt) : "")}
            onChange={(event) => {
              touch();
              setOccurredLocal(event.target.value);
            }}
            aria-describedby={correcting ? undefined : `${fieldId}-occurred-hint`}
          />
          {correcting ? null : (
            <p className="hc-hint" id={`${fieldId}-occurred-hint`}>
              {t("home_care.entry.occurred_hint")}
            </p>
          )}
        </div>
        {companionOptions.length > 1 ? (
          <div className="hc-field">
            <span className="hc-label">{t("home_care.entry.companion_label")}</span>
            <Dropdown
              value={companion}
              onChange={(value) => {
                touch();
                setCompanion(value);
              }}
              ariaLabel={t("home_care.entry.companion_label")}
              options={companionOptions}
            />
          </div>
        ) : null}
      </div>

      {correcting ? (
        <div className="hc-field">
          <label className="hc-label" htmlFor={`${fieldId}-reason`}>
            {t("home_care.entry.reason_label")}
          </label>
          <input
            id={`${fieldId}-reason`}
            className="hc-input"
            value={reason}
            onChange={(event) => {
              touch();
              setReason(event.target.value);
            }}
            maxLength={HOME_CARE_LIMITS.REASON_MAX}
            required
            autoComplete="off"
          />
        </div>
      ) : null}

      <p className="hc-hint">
        {coordinatorOnly
          ? t("home_care.entry.visibility_coordinator")
          : t("home_care.entry.visibility_team", { count: team.filter((member) => member.active).length })}
      </p>

      {error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="hc-ok" role="status">
          {t("home_care.entry.saved")}
        </p>
      ) : null}

      <div className="hc-row">
        <button className="hc-btn hc-btn--primary" type="submit" disabled={busy}>
          {correcting ? t("home_care.entry.correct_save") : t("home_care.entry.save")}
        </button>
        {onCancel ? (
          <button className="hc-btn" type="button" onClick={onCancel} disabled={busy}>
            {t("home_care.entry.cancel")}
          </button>
        ) : null}
      </div>
    </form>
  );
}
