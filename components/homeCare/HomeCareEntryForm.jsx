"use client";

import { useId } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Dropdown from "@/components/ui/Dropdown";
import {
  CARE_ACTIVITY_SKIP_REASONS,
  CARE_CHANGE_AREAS,
  CARE_CONTACT_MODES,
  CARE_INCIDENT_ACTIONS,
  CARE_INCIDENT_TYPES,
  CARE_MEDICATION_ACTIONS,
  CARE_PLAN_MODES,
  HOME_CARE_LIMITS
} from "@/lib/homeCare/constants";

import { VISIT_MINUTE_CHOICES, useEntryForm } from "./entry/useEntryForm";
import HomeCareDictation from "./HomeCareDictation";
import { formatDateTime, toZonedInputValue } from "./homeCareClient";

/**
 * Päevikukirje vorm vanal kihil: kirje PARANDUS päevikus.
 *
 * Uus kirje on sammudena (`./entry/EntryFlow.jsx`). See vorm jääb kirje
 * paranduse jaoks, kuni päevik ehitatakse ümber. Olek, mustand, kordussaatmise
 * võti ja päringud on konksus `./entry/useEntryForm.js` (seal on ka reeglite
 * selgitus); siin on ainult märgistus.
 */
export default function HomeCareEntryForm({
  organizationId,
  clientId,
  team = [],
  viewerMembershipId = null,
  clientName = "",
  timeZone,
  entry = null,
  plan = null,
  usualState = [],
  onSaved,
  onCancel
}) {
  const { t } = useI18n();
  const fieldId = useId();
  const {
    busy, error, catalogueApi, correcting, kind, setKind, contactMode, setContactMode, text, setText, occurredLocal, setOccurredLocal, companion,
    setCompanion, incidentType, setIncidentType, assessment, setAssessment, actions, visitMinutes, setVisitMinutes, done, skipped, medication,
    setMedication, different, setDifferent, diffAreas, setDiffAreas, diffMajor, setDiffMajor, catalogue, reason, setReason, saved, queued,
    dictationCut, restored, sending, isIncident, isVisit, planChoices, visitChoices, isMedication,
    askChange, changed, textRequired, unmarked, otherOptions, coordinatorOnly, kindChoices, companionOptions, touch, addDictated, toggleAction,
    toggleDone, toggleSkipped, setSkipReason, markRest, setDoneMode, loadCatalogue, addOther, reset, submit
  } = useEntryForm({ organizationId, clientId, team, viewerMembershipId, clientName, timeZone, entry, plan, onSaved });

  const textLabel = isIncident ? t("home_care.incident.text_label") : t("home_care.entry.text_label");

  return (
    <form className="hc-form" onSubmit={submit} inert={sending} aria-busy={sending}>
      {restored ? (
        <div className="hc-notice" role="status">
          <p>
            {restored === "-"
              ? t("home_care.entry.draft_restored")
              : t("home_care.entry.draft_restored_at", { time: formatDateTime(restored, timeZone) })}
          </p>
          <div className="hc-row">
            <button className="hc-btn hc-btn--quiet" type="button" onClick={reset} disabled={busy}>
              {t("home_care.entry.draft_clear")}
            </button>
          </div>
        </div>
      ) : null}
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

      {isVisit ? (
        <fieldset className="hc-fieldset">
          <legend className="hc-label">{t("home_care.visit.title")}</legend>
          {visitChoices.length === 0 ? <p className="hc-hint">{t("home_care.visit.no_plan")}</p> : null}
          {visitChoices.map((choice) => (
            <div key={choice.activityId}>
              <button
                type="button"
                className="hc-chip"
                aria-pressed={Boolean(done[choice.activityId])}
                onClick={() => toggleDone(choice)}
              >
                {choice.name}
              </button>
              {planChoices.includes(choice) ? (
                <>
                  {" "}
                  <button
                    type="button"
                    className="hc-chip"
                    aria-pressed={choice.activityId in skipped}
                    aria-label={t("home_care.visit.skip_label", { name: choice.name })}
                    onClick={() => toggleSkipped(choice)}
                  >
                    {t("home_care.visit.skip")}
                  </button>
                </>
              ) : null}
              {choice.critical && !done[choice.activityId] ? (
                <>
                  {" "}
                  <span className="hc-badge hc-badge--warn">{t("home_care.plan.critical_badge")}</span>
                </>
              ) : null}
              {choice.activityId in skipped ? (
                <div className="hc-chips" role="group" aria-label={t("home_care.visit.skip_reason_label", { name: choice.name })}>
                  {CARE_ACTIVITY_SKIP_REASONS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className="hc-chip"
                      aria-pressed={skipped[choice.activityId] === value}
                      onClick={() => setSkipReason(choice.activityId, value)}
                    >
                      {t(`home_care.visit.outcomes.${value}`)}
                    </button>
                  ))}
                </div>
              ) : null}
              {skipped[choice.activityId] === "" ? (
                <p className="hc-hint" role="status">
                  {t("home_care.visit.reason_pick")}
                </p>
              ) : null}
              {/* Ravimitoiming (K5-d): mida tegid. Need on eri toimingud, seepärast vaikimisi valikut ei ole. */}
              {done[choice.activityId] && isMedication(choice) ? (
                <>
                  <div className="hc-chips" role="group" aria-label={t("home_care.medication.action_label", { name: choice.name })}>
                    {CARE_MEDICATION_ACTIONS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className="hc-chip"
                        aria-pressed={medication[choice.activityId] === value}
                        onClick={() => {
                          touch();
                          setMedication((current) => ({ ...current, [choice.activityId]: value }));
                        }}
                      >
                        {t(`home_care.medication.actions.${value}`)}
                      </button>
                    ))}
                  </div>
                  {!medication[choice.activityId] ? (
                    <p className="hc-hint" role="status">
                      {t("home_care.medication.pick")}
                    </p>
                  ) : null}
                </>
              ) : null}
              {done[choice.activityId] ? (
                <div className="hc-chips" role="group" aria-label={t("home_care.visit.mode_label", { name: choice.name })}>
                  {CARE_PLAN_MODES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className="hc-chip"
                      aria-pressed={done[choice.activityId] === value}
                      onClick={() => setDoneMode(choice.activityId, value)}
                    >
                      {t(`home_care.visit.modes.${value}`)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {unmarked.length > 0 ? (
            <button className="hc-btn hc-btn--quiet" type="button" onClick={markRest}>
              {t("home_care.visit.mark_rest", { count: unmarked.length })}
            </button>
          ) : null}
          {catalogue ? (
            otherOptions.length > 0 ? (
              <Dropdown
                value=""
                onChange={addOther}
                ariaLabel={t("home_care.visit.add_other")}
                placeholder={t("home_care.visit.other_placeholder")}
                options={otherOptions}
              />
            ) : (
              <p className="hc-hint">{t("home_care.visit.catalogue_done")}</p>
            )
          ) : (
            <button className="hc-btn hc-btn--quiet" type="button" onClick={loadCatalogue} disabled={catalogueApi.busy}>
              {t("home_care.visit.add_other")}
            </button>
          )}
          {catalogueApi.error ? (
            <p className="hc-error" role="alert">
              {catalogueApi.error}
            </p>
          ) : null}
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-minutes`}>
              {t("home_care.visit.minutes_label")}
            </label>
            <input
              id={`${fieldId}-minutes`}
              className="hc-input"
              type="number"
              inputMode="numeric"
              min={1}
              max={HOME_CARE_LIMITS.VISIT_MINUTES_MAX}
              value={visitMinutes}
              onChange={(event) => {
                touch();
                setVisitMinutes(event.target.value);
              }}
            />
            <div className="hc-chips" role="group" aria-label={t("home_care.visit.minutes_quick")}>
              {VISIT_MINUTE_CHOICES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="hc-chip"
                  aria-pressed={visitMinutes === String(value)}
                  onClick={() => {
                    touch();
                    setVisitMinutes(visitMinutes === String(value) ? "" : String(value));
                  }}
                >
                  {t("home_care.visit.minutes", { minutes: value })}
                </button>
              ))}
            </div>
          </div>
        </fieldset>
      ) : null}

      {/* „Kas midagi oli teisiti?" (K5-a): „ei" on üks puudutus; „jah" küsib valdkonna ja ühe lause. */}
      {askChange ? (
        <fieldset className="hc-fieldset">
          <legend className="hc-label">{t("home_care.change.question")}</legend>
          <div className="hc-chips" role="group" aria-label={t("home_care.change.question")}>
            {["NO", "YES"].map((value) => (
              <button
                key={value}
                type="button"
                className="hc-chip"
                aria-pressed={different === value}
                onClick={() => {
                  touch();
                  setDifferent(different === value ? "" : value);
                }}
              >
                {t(`home_care.change.answers.${value}`)}
              </button>
            ))}
          </div>
          {changed ? (
            <>
              <span className="hc-label">{t("home_care.change.area_label")}</span>
              <div className="hc-chips" role="group" aria-label={t("home_care.change.area_label")}>
                {CARE_CHANGE_AREAS.map((area) => (
                  <button
                    key={area}
                    type="button"
                    className="hc-chip"
                    aria-pressed={diffAreas.includes(area)}
                    onClick={() => {
                      touch();
                      setDiffAreas((current) => (current.includes(area) ? current.filter((item) => item !== area) : [...current, area]));
                    }}
                  >
                    {t(`home_care.change.areas.${area}`)}
                  </button>
                ))}
              </div>
              {usualState.filter((item) => diffAreas.includes(item.area)).length ? (
                <ul className="hc-list hc-list--plain">
                  {usualState
                    .filter((item) => diffAreas.includes(item.area))
                    .map((item) => (
                      <li key={item.area} className="hc-sub">
                        {t("home_care.change.usually", { area: t(`home_care.change.areas.${item.area}`), text: item.text })}
                      </li>
                    ))}
                </ul>
              ) : null}
              <label className="hc-check">
                <input
                  type="checkbox"
                  checked={diffMajor}
                  onChange={() => {
                    touch();
                    setDiffMajor((current) => !current);
                  }}
                />
                <span>{t("home_care.change.major")}</span>
              </label>
              <p className="hc-hint">{t("home_care.change.yes_hint")}</p>
            </>
          ) : null}
        </fieldset>
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
          required={textRequired}
          aria-describedby={`${fieldId}-text-hint`}
        />
        <p className="hc-hint" id={`${fieldId}-text-hint`}>
          {textRequired ? t("home_care.entry.write_what_you_saw") : t("home_care.visit.text_optional")}
        </p>
        <HomeCareDictation onText={addDictated} disabled={busy || sending} describedBy={`${fieldId}-dictation-hint`} />
        <p className="hc-hint" id={`${fieldId}-dictation-hint`}>
          {t("home_care.dictation.hint")}
        </p>
        {dictationCut ? (
          <p className="hc-notice hc-notice--warn" role="status">
            {t("home_care.dictation.cut", { limit: HOME_CARE_LIMITS.ENTRY_TEXT_MAX })}
          </p>
        ) : null}
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
            value={occurredLocal || (correcting ? toZonedInputValue(entry.occurredAt, timeZone) : "")}
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
      {queued ? (
        <p className="hc-ok" role="status">
          {t("home_care.entry.queued")}
        </p>
      ) : null}

      <div className="hc-row">
        <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || sending}>
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
