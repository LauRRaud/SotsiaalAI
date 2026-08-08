"use client";

/**
 * JTA-V1 (E3) — kohtumise ettevalmistuse sektsioon juhtumi detailvaates.
 *
 * MIKS SIIN, MITTE OMAL MARSRUUDIL. Leping ütles „uus `app/juhtumid/[caseId]/page.jsx`
 * — juhtumi detailvaade (**täna ei ole**)". Koodist mõõdetuna oli see väide vale:
 * detailvaade ON olemas (`CaseWorkDetail.jsx`, `/juhtumid?juhtum=<id>`), ja
 * JUHTUM-V1 E6 valis teadlikult ÜHE marsruudi — „kaks eri marsruuti tähendaks
 * kahte kohta, kust sama asja otsida". Uus tee samale objektile oleks tühistanud
 * juba tehtud otsuse, mitte täitnud lepingut. Leping on parandatud.
 *
 * PÄRITOLU ON SIIN LIIDESE TASEMEL NÄHTAV, mitte peidetud. Iga väli ja iga
 * küsimus kannab oma märgist, ja AI mustandi kõrval seisab kinnitusnupp —
 * see on ainus koht, kust märgis muutub. Teksti parandamine EI muuda teda
 * (server eirab saadetud `provenance`-i) ja seda tõendab teenuskihi test.
 */

import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { PROVENANCE, PROVENANCES, provenanceLabelKey } from "@/lib/workspaces/provenance";

import { caseWorkRequest, fromLocalInputValue } from "./caseWorkClient";

/** Sama hulk mis `CaseWorkPrepFieldKey` skeemis ja `PREP_FIELD_KEYS` teenuskihis. */
const FIELD_KEYS = ["GOAL", "REQUIRED_DOCUMENTS", "LIFE_DOMAINS", "AGENDA", "PLAIN_LANGUAGE_NOTES"];
const QUESTION_KINDS = ["CLARIFYING_QUESTION", "CLAIM_TO_VERIFY"];

/**
 * Märgised, milleks AI mustandi saab kinnitada.
 *
 * `AI_MUSTAND` ise puudub loendist ja see ei ole väljajätt: tagasitee masina
 * märgise juurde kirjutaks inimese kinnituse ümber ja server annab 400.
 */
const CONFIRM_TARGETS = PROVENANCES.filter((value) => value !== PROVENANCE.AI_MUSTAND);

export default function MeetingPrepSection({ caseId, writeDisabled, onChanged }) {
  const { t, locale } = useI18n();

  const [preps, setPreps] = useState([]);
  const [openPrep, setOpenPrep] = useState(null);
  const [errorKey, setErrorKey] = useState(null);
  const [busy, setBusy] = useState(false);
  const [meetingAt, setMeetingAt] = useState("");

  const run = useCallback(async (task) => {
    setBusy(true);
    setErrorKey(null);
    try {
      return await task();
    } catch (error) {
      setErrorKey(error?.messageKey || "casework.errors.unexpected");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const loadPreps = useCallback(async () => {
    try {
      const body = await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/meeting-preps?limit=25`, { locale });
      setPreps(body.items || []);
    } catch (error) {
      setErrorKey(error?.messageKey || "casework.errors.unexpected");
    }
  }, [caseId, locale]);

  const loadPrep = useCallback(
    async (prepId) => {
      try {
        const body = await caseWorkRequest(
          `/cases/${encodeURIComponent(caseId)}/meeting-preps/${encodeURIComponent(prepId)}`,
          { locale }
        );
        setOpenPrep(body.prep || null);
      } catch (error) {
        setErrorKey(error?.messageKey || "casework.errors.unexpected");
      }
    },
    [caseId, locale]
  );

  useEffect(() => {
    loadPreps();
  }, [loadPreps]);

  const createPrep = useCallback(
    async (event) => {
      event.preventDefault();
      const created = await run(() =>
        caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/meeting-preps`, {
          method: "POST",
          locale,
          body: { meetingAt: fromLocalInputValue(meetingAt) }
        })
      );
      if (!created?.prep?.id) return;
      setMeetingAt("");
      await loadPreps();
      await loadPrep(created.prep.id);
      onChanged?.();
    },
    [caseId, loadPrep, loadPreps, locale, meetingAt, onChanged, run]
  );

  const deletePrep = useCallback(
    async (prepId) => {
      const done = await run(() =>
        caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/meeting-preps/${encodeURIComponent(prepId)}`, {
          method: "DELETE",
          locale
        })
      );
      if (!done) return;
      if (openPrep?.id === prepId) setOpenPrep(null);
      await loadPreps();
      onChanged?.();
    },
    [caseId, loadPreps, locale, onChanged, openPrep, run]
  );

  const saveField = useCallback(
    async (fieldKey, text, provenance) => {
      const done = await run(() =>
        caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/meeting-preps/${encodeURIComponent(openPrep.id)}/fields`, {
          method: "PUT",
          locale,
          body: { fieldKey, text, provenance }
        })
      );
      if (done) await loadPrep(openPrep.id);
    },
    [caseId, loadPrep, locale, openPrep, run]
  );

  const confirmField = useCallback(
    async (fieldKey, from, to) => {
      const done = await run(() =>
        caseWorkRequest(
          `/cases/${encodeURIComponent(caseId)}/meeting-preps/${encodeURIComponent(openPrep.id)}/fields/${encodeURIComponent(fieldKey)}/confirm-provenance`,
          { method: "POST", locale, body: { from, to } }
        )
      );
      if (done) await loadPrep(openPrep.id);
    },
    [caseId, loadPrep, locale, openPrep, run]
  );

  const addQuestion = useCallback(
    async (kind, text, provenance) => {
      const done = await run(() =>
        caseWorkRequest(
          `/cases/${encodeURIComponent(caseId)}/meeting-preps/${encodeURIComponent(openPrep.id)}/questions`,
          { method: "POST", locale, body: { kind, text, provenance } }
        )
      );
      if (done) await loadPrep(openPrep.id);
    },
    [caseId, loadPrep, locale, openPrep, run]
  );

  const removeQuestion = useCallback(
    async (questionId) => {
      const done = await run(() =>
        caseWorkRequest(
          `/cases/${encodeURIComponent(caseId)}/meeting-preps/${encodeURIComponent(openPrep.id)}/questions/${encodeURIComponent(questionId)}`,
          { method: "DELETE", locale }
        )
      );
      if (done) await loadPrep(openPrep.id);
    },
    [caseId, loadPrep, locale, openPrep, run]
  );

  const confirmQuestion = useCallback(
    async (questionId, from, to) => {
      const done = await run(() =>
        caseWorkRequest(
          `/cases/${encodeURIComponent(caseId)}/meeting-preps/${encodeURIComponent(openPrep.id)}/questions/${encodeURIComponent(questionId)}/confirm-provenance`,
          { method: "POST", locale, body: { from, to } }
        )
      );
      if (done) await loadPrep(openPrep.id);
    },
    [caseId, loadPrep, locale, openPrep, run]
  );

  const disabled = writeDisabled || busy;

  return (
    <section className="cw-section">
      <h2 className="cw-section-title">{t("casework.prep.section_title", "")}</h2>
      <p className="cw-hint">{t("casework.prep.section_hint", "")}</p>

      {errorKey ? (
        <p className="cw-error" role="alert">
          {t(errorKey, "")}
        </p>
      ) : null}

      <form className="cw-form cw-form--inline" onSubmit={createPrep}>
        <div className="cw-field">
          <label className="cw-label" htmlFor="cw-prep-meeting-at">
            {t("casework.prep.meeting_at", "")}
          </label>
          <input
            id="cw-prep-meeting-at"
            className="cw-input"
            type="datetime-local"
            value={meetingAt}
            onChange={(event) => setMeetingAt(event.target.value)}
            disabled={disabled}
          />
        </div>
        <button className="cw-button" type="submit" disabled={disabled}>
          {t("casework.prep.create", "")}
        </button>
      </form>

      {!preps.length ? <p className="cw-empty">{t("casework.prep.empty", "")}</p> : null}

      <ul className="cw-list">
        {preps.map((prep) => (
          <li className="cw-case" key={prep.id}>
            <span className="cw-case-label">
              {prep.meetingAt
                ? new Date(prep.meetingAt).toLocaleString(locale || "et", { dateStyle: "short", timeStyle: "short" })
                : t("casework.prep.no_meeting_time", "")}
            </span>
            <button className="cw-button" type="button" onClick={() => loadPrep(prep.id)}>
              {t("casework.prep.open", "")}
            </button>
            <button className="cw-button" type="button" onClick={() => deletePrep(prep.id)} disabled={disabled}>
              {t("casework.prep.delete", "")}
            </button>
          </li>
        ))}
      </ul>

      {openPrep ? (
        <PrepEditor
          prep={openPrep}
          disabled={disabled}
          t={t}
          onSaveField={saveField}
          onConfirmField={confirmField}
          onAddQuestion={addQuestion}
          onRemoveQuestion={removeQuestion}
          onConfirmQuestion={confirmQuestion}
          onClose={() => setOpenPrep(null)}
        />
      ) : null}
    </section>
  );
}

function PrepEditor({
  prep,
  disabled,
  t,
  onSaveField,
  onConfirmField,
  onAddQuestion,
  onRemoveQuestion,
  onConfirmQuestion,
  onClose
}) {
  const byKey = new Map((prep.fields || []).map((row) => [row.fieldKey, row]));

  return (
    <div className="cw-section">
      <h3 className="cw-section-title">{t("casework.prep.editor_title", "")}</h3>
      <button className="cw-button" type="button" onClick={onClose}>
        {t("casework.prep.close", "")}
      </button>

      {FIELD_KEYS.map((fieldKey) => (
        <PrepField
          key={fieldKey}
          fieldKey={fieldKey}
          row={byKey.get(fieldKey) || null}
          disabled={disabled}
          t={t}
          onSave={onSaveField}
          onConfirm={onConfirmField}
        />
      ))}

      <h3 className="cw-section-title">{t("casework.prep.questions_title", "")}</h3>
      <p className="cw-hint">{t("casework.prep.questions_hint", "")}</p>

      <QuestionForm disabled={disabled} t={t} onAdd={onAddQuestion} />

      {!(prep.questions || []).length ? <p className="cw-empty">{t("casework.prep.questions_empty", "")}</p> : null}

      <ul className="cw-list">
        {(prep.questions || []).map((question) => (
          <li className="cw-case" key={question.id}>
            {/* Tekst on PLAIN TEXT ja renderdub tekstina — HTML-i sisestust siin
                ei ole ega tule. */}
            <span className="cw-case-label">{question.text}</span>
            <span className="cw-case-meta">
              <span className="cw-badge">{t(`casework.prep.kind_${question.kind}`, "")}</span>
              <span className="cw-badge">{t(provenanceLabelKey(question.provenance) || "", "")}</span>
            </span>
            {question.provenance === PROVENANCE.AI_MUSTAND ? (
              <ConfirmControl
                disabled={disabled}
                t={t}
                onConfirm={(to) => onConfirmQuestion(question.id, question.provenance, to)}
              />
            ) : null}
            <button className="cw-button" type="button" onClick={() => onRemoveQuestion(question.id)} disabled={disabled}>
              {t("casework.prep.remove", "")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrepField({ fieldKey, row, disabled, t, onSave, onConfirm }) {
  const [text, setText] = useState(row?.text || "");
  const [provenance, setProvenance] = useState(row?.provenance || PROVENANCE.TOOTAJA_TAHELEPANEK);

  useEffect(() => {
    setText(row?.text || "");
    if (row?.provenance) setProvenance(row.provenance);
  }, [row?.text, row?.provenance]);

  return (
    <div className="cw-field">
      <label className="cw-label" htmlFor={`cw-prep-${fieldKey}`}>
        {t(`casework.prep.field_${fieldKey}`, "")}
      </label>
      <textarea
        id={`cw-prep-${fieldKey}`}
        className="cw-input"
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={disabled}
        rows={3}
        maxLength={4000}
      />

      {row ? (
        <span className="cw-case-meta">
          <span className="cw-badge">{t(provenanceLabelKey(row.provenance) || "", "")}</span>
          {/* Märgis EI muutu teksti salvestamisega — server eirab saadetud
              väärtust. Kinnitus on eraldi tegu, sest just tema tähendab „ma
              vaatasin selle üle ja võtan vastutuse". */}
          {row.provenance === PROVENANCE.AI_MUSTAND ? (
            <ConfirmControl disabled={disabled} t={t} onConfirm={(to) => onConfirm(fieldKey, row.provenance, to)} />
          ) : null}
        </span>
      ) : (
        <select
          className="cw-input"
          value={provenance}
          onChange={(event) => setProvenance(event.target.value)}
          disabled={disabled}
          aria-label={t("casework.page.provenance_placeholder", "")}
        >
          {PROVENANCES.map((value) => (
            <option key={value} value={value}>
              {t(provenanceLabelKey(value) || "", "")}
            </option>
          ))}
        </select>
      )}

      <button
        className="cw-button"
        type="button"
        onClick={() => onSave(fieldKey, text, row?.provenance || provenance)}
        disabled={disabled || !text.trim()}
      >
        {t("casework.prep.save_field", "")}
      </button>
    </div>
  );
}

function QuestionForm({ disabled, t, onAdd }) {
  const [kind, setKind] = useState(QUESTION_KINDS[0]);
  const [text, setText] = useState("");
  const [provenance, setProvenance] = useState(PROVENANCE.TOOTAJA_TAHELEPANEK);

  return (
    <form
      className="cw-form cw-form--inline"
      onSubmit={async (event) => {
        event.preventDefault();
        await onAdd(kind, text, provenance);
        setText("");
      }}
    >
      <select className="cw-input" value={kind} onChange={(event) => setKind(event.target.value)} disabled={disabled} aria-label={t("casework.prep.questions_title", "")}>
        {QUESTION_KINDS.map((value) => (
          <option key={value} value={value}>
            {t(`casework.prep.kind_${value}`, "")}
          </option>
        ))}
      </select>
      <input
        className="cw-input"
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={disabled}
        maxLength={4000}
        aria-label={t("casework.prep.question_text", "")}
      />
      <select
        className="cw-input"
        value={provenance}
        onChange={(event) => setProvenance(event.target.value)}
        disabled={disabled}
        aria-label={t("casework.page.provenance_placeholder", "")}
      >
        {PROVENANCES.map((value) => (
          <option key={value} value={value}>
            {t(provenanceLabelKey(value) || "", "")}
          </option>
        ))}
      </select>
      <button className="cw-button" type="submit" disabled={disabled || !text.trim()}>
        {t("casework.prep.add_question", "")}
      </button>
    </form>
  );
}

/** AI mustandi kinnitamine inimese märgiseks. Suund on ühesuunaline (L4). */
function ConfirmControl({ disabled, t, onConfirm }) {
  const [target, setTarget] = useState(CONFIRM_TARGETS[0]);

  return (
    <>
      <select
        className="cw-input"
        value={target}
        onChange={(event) => setTarget(event.target.value)}
        disabled={disabled}
        aria-label={t("casework.prep.confirm_provenance", "")}
      >
        {CONFIRM_TARGETS.map((value) => (
          <option key={value} value={value}>
            {t(provenanceLabelKey(value) || "", "")}
          </option>
        ))}
      </select>
      <button className="cw-button" type="button" onClick={() => onConfirm(target)} disabled={disabled}>
        {t("casework.prep.confirm_provenance", "")}
      </button>
    </>
  );
}
