"use client";

/**
 * JTA-V1 (E5) — STAR2 mustandi ahela sektsioon juhtumi detailvaates.
 *
 * OLEKUTEE ON NÄHTAV, MITTE PEIDETUD. Iga element kannab oma seisu ja liigub
 * ühes suunas; liides pakub AINULT neid siirdeid, mida olekumasin lubab
 * (`ALLOWED_TRANSITIONS`). Vaba valik koos serveri veateatega õpetaks kasutajat
 * arvama, et viga on tema tehtud.
 *
 * `ULE_KANTUD` EI OLE SIIN VALIK ja see ei ole väljajätt (L19): sinna viib
 * ainult E6 „Märgi üle kantuks", mis loob samas tehingus auditirea. Sektsioon
 * ütleb selle välja, et puuduv nupp ei näeks välja nagu puudujääk.
 *
 * TERMINAALSE ELEMENDI SISU EI MUUDETA. `ULE_KANTUD` ja `EI_KANTA` on ptk 2.2
 * lõpp-punktid — vorm on kinni ja lause ütleb, miks.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { PROVENANCES, provenanceLabelKey } from "@/lib/workspaces/provenance";

import ConfirmButton from "./ConfirmButton";
import { TransferActions, TransferHistory } from "./TransferPanel";
import { caseWorkRequest } from "./caseWorkClient";

/**
 * Ptk 4.5 kaheksa elementi, sama järjekord mis teenuskihis (`DRAFT_TYPES`).
 * Loend on oma konstandina, sest teenuskiht toob Prisma kliendi; kahe loendi
 * lahkuminekut hoiab ära `draftUi.test.js`.
 */
export const DRAFT_TYPE_ORDER = Object.freeze([
  "POORDUMISE_KOKKUVOTE",
  "ABIVAJADUSE_HINDAMINE",
  "ELUVALDKONNA_KIRJELDUS",
  "EESMARGI_SONASTUS",
  "TEGEVUS",
  "VASTUTAJA_JA_TAHTAEG",
  "KOHTUMISE_MARGE",
  "TEENUSE_SUUNAMISE_ALUS"
]);

/**
 * Lubatud siirded — sama kaart mis `STAR2_TRANSFER_TRANSITIONS`
 * `lib/workspaces/provenance.js`-is, MIINUS `ULE_KANTUD` (L19).
 *
 * `VALMIS_ULEKANDEKS` juurest jääb liidesesse ainult `EI_KANTA`, ja see on
 * õige: ülekantuks märkimine on eraldi tegu eraldi marsruudil.
 */
const ALLOWED_TRANSITIONS = Object.freeze({
  MUSTAND: Object.freeze(["VAJAB_KONTROLLI", "EI_KANTA"]),
  VAJAB_KONTROLLI: Object.freeze(["KONTROLLITUD", "EI_KANTA"]),
  KONTROLLITUD: Object.freeze(["VALMIS_ULEKANDEKS", "EI_KANTA"]),
  VALMIS_ULEKANDEKS: Object.freeze(["EI_KANTA"]),
  ULE_KANTUD: Object.freeze([]),
  EI_KANTA: Object.freeze([])
});

const REVIEW_KINDS = ["KLIENDIGA", "DOKUMENDIGA"];
const PAGE_SIZE = 25;

function isTerminal(state) {
  return (ALLOWED_TRANSITIONS[state] || []).length === 0;
}

export default function DraftSection({ caseId, writeDisabled, onChanged }) {
  const { t, locale } = useI18n();

  const [drafts, setDrafts] = useState([]);
  const [draftsCursor, setDraftsCursor] = useState(null);
  const [openDraft, setOpenDraft] = useState(null);
  const [errorKey, setErrorKey] = useState(null);
  const [busy, setBusy] = useState(false);
  const [draftType, setDraftType] = useState("");
  /* Ülekandeajalugu laetakse uuesti iga teo järel — ta on TÕEND ja vananenud
     ajalugu ütleks, et jälge ei tekkinud. */
  const [transferToken, setTransferToken] = useState(0);

  const requestedDraftId = useRef(null);

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

  const loadDrafts = useCallback(
    async ({ cursor = null, append = false } = {}) => {
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (cursor) params.set("cursor", cursor);
        const body = await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/drafts?${params.toString()}`, {
          locale
        });
        setDrafts((previous) => (append ? [...previous, ...(body.items || [])] : body.items || []));
        setDraftsCursor(body.nextCursor || null);
      } catch (error) {
        setErrorKey(error?.messageKey || "casework.errors.unexpected");
      }
    },
    [caseId, locale]
  );

  const loadDraft = useCallback(
    async (draftId) => {
      requestedDraftId.current = draftId;
      try {
        const body = await caseWorkRequest(
          `/cases/${encodeURIComponent(caseId)}/drafts/${encodeURIComponent(draftId)}`,
          { locale }
        );
        /* Aegunud vastus ei kirjuta värskemat üle — vt sama valvurit märkme ja
           ettevalmistuse sektsioonis. */
        if (requestedDraftId.current !== draftId) return;
        setOpenDraft(body.draft || null);
      } catch (error) {
        if (requestedDraftId.current !== draftId) return;
        setErrorKey(error?.messageKey || "casework.errors.unexpected");
      }
    },
    [caseId, locale]
  );

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const createDraft = useCallback(
    async (event) => {
      event.preventDefault();
      const created = await run(() =>
        caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/drafts`, {
          method: "POST",
          locale,
          body: { draftType }
        })
      );
      if (!created?.draft?.id) return;
      setDraftType("");
      await loadDrafts();
      await loadDraft(created.draft.id);
      onChanged?.();
    },
    [caseId, draftType, loadDraft, loadDrafts, locale, onChanged, run]
  );

  const saveField = useCallback(
    async (fieldKey, text, provenance) => {
      const done = await run(() =>
        caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/drafts/${encodeURIComponent(openDraft.id)}/fields`, {
          method: "PUT",
          locale,
          body: { fieldKey, text, provenance }
        })
      );
      if (!done) return false;
      await loadDraft(openDraft.id);
      return true;
    },
    [caseId, loadDraft, locale, openDraft, run]
  );

  const removeField = useCallback(
    async (fieldKey) => {
      const params = new URLSearchParams({ fieldKey });
      const done = await run(() =>
        caseWorkRequest(
          `/cases/${encodeURIComponent(caseId)}/drafts/${encodeURIComponent(openDraft.id)}/fields?${params.toString()}`,
          { method: "DELETE", locale }
        )
      );
      if (!done) return false;
      await loadDraft(openDraft.id);
      return true;
    },
    [caseId, loadDraft, locale, openDraft, run]
  );

  const transition = useCallback(
    async (expectedFrom, to, reviewKind) => {
      const done = await run(() =>
        caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/drafts/${encodeURIComponent(openDraft.id)}/transition`, {
          method: "POST",
          locale,
          /* `expectedFrom` tuleb AVATUD ELEMENDI seisust, mitte vormist: nii
             kannab ta seda, mida kasutaja ekraanil nägi, ja vahepealne muutus
             annab ausa 409. */
          body: { expectedFrom, to, reviewKind: reviewKind || undefined }
        })
      );
      if (!done) return false;
      await Promise.all([loadDraft(openDraft.id), loadDrafts()]);
      onChanged?.();
      return true;
    },
    [caseId, loadDraft, loadDrafts, locale, onChanged, openDraft, run]
  );

  /**
   * Ülekandetegu muutis midagi: mustandi seis, ajalugu ja laud käivad kõik
   * kaasa. Ajalugu värskendatakse ka siis, kui seis EI MUUTUNUD (kopeerimine ei
   * liiguta olekumasinat, L9) — just seepärast on tal oma märk.
   */
  const onTransferChanged = useCallback(async () => {
    setTransferToken((value) => value + 1);
    if (openDraft?.id) await Promise.all([loadDraft(openDraft.id), loadDrafts()]);
    onChanged?.();
  }, [loadDraft, loadDrafts, onChanged, openDraft]);

  const disabled = writeDisabled || busy;

  return (
    <section className="cw-section">
      <h2 className="cw-section-title">{t("casework.draft.section_title", "")}</h2>
      <p className="cw-hint">{t("casework.draft.section_hint", "")}</p>

      {errorKey ? (
        <p className="cw-error" role="alert">
          {t(errorKey, "")}
        </p>
      ) : null}

      <form className="cw-form cw-form--inline" onSubmit={createDraft}>
        <select
          className="cw-input"
          value={draftType}
          onChange={(event) => setDraftType(event.target.value)}
          disabled={disabled}
          required
          aria-label={t("casework.draft.choose_type", "")}
        >
          <option value="">{t("casework.draft.choose_type", "")}</option>
          {DRAFT_TYPE_ORDER.map((value) => (
            <option key={value} value={value}>
              {t(`casework.draft.type_${value}`, "")}
            </option>
          ))}
        </select>
        <button className="cw-button" type="submit" disabled={disabled || !draftType}>
          {t("casework.draft.create", "")}
        </button>
      </form>

      {!drafts.length ? <p className="cw-empty">{t("casework.draft.empty", "")}</p> : null}

      <ul className="cw-list">
        {drafts.map((draft) => (
          <li className="cw-case" key={draft.id}>
            <span className="cw-case-label">{t(`casework.draft.type_${draft.draftType}`, "")}</span>
            <span className="cw-case-meta">
              <span className="cw-badge">{t(`casework.star2.${draft.transferState}`, "")}</span>
              {draft.reviewKind ? <span className="cw-badge">{t(`casework.star2.${draft.reviewKind}`, "")}</span> : null}
            </span>
            <button className="cw-button" type="button" onClick={() => loadDraft(draft.id)}>
              {t("casework.draft.open", "")}
            </button>
            {/* Kustutusnuppu EI OLE: mustand on ahela lüli ja tema jälg on
                tõend. Lõpetamise tee on „Ei kanta" — teadlik lõpp. */}
          </li>
        ))}
      </ul>

      {draftsCursor ? (
        <button
          className="cw-button"
          type="button"
          disabled={busy}
          onClick={() => run(() => loadDrafts({ cursor: draftsCursor, append: true }))}
        >
          {t("casework.draft.load_more", "")}
        </button>
      ) : null}

      {openDraft ? (
        <DraftEditor
          key={openDraft.id}
          caseId={caseId}
          draft={openDraft}
          locale={locale}
          disabled={disabled}
          t={t}
          onSaveField={saveField}
          onRemoveField={removeField}
          onTransition={transition}
          onTransferChanged={onTransferChanged}
          onClose={() => {
            requestedDraftId.current = null;
            setOpenDraft(null);
          }}
        />
      ) : null}

      {/* Ajalugu on JUHTUMI oma, mitte avatud mustandi oma: ülekanne on juhtumi
          sündmus ja töötaja peab teda nägema ka siis, kui ükski element ei ole
          lahti. */}
      <TransferHistory caseId={caseId} locale={locale} t={t} refreshToken={transferToken} />
    </section>
  );
}

function DraftEditor({
  caseId,
  draft,
  locale,
  disabled,
  t,
  onSaveField,
  onRemoveField,
  onTransition,
  onTransferChanged,
  onClose
}) {
  const fields = Array.isArray(draft.fields) ? draft.fields : [];
  const terminal = isTerminal(draft.transferState);
  const writable = disabled || terminal;

  return (
    <div className="cw-section">
      <h3 className="cw-section-title">
        {t("casework.draft.open_draft", "")}: {t(`casework.draft.type_${draft.draftType}`, "")} —{" "}
        {t(`casework.star2.${draft.transferState}`, "")}
      </h3>

      {draft.transferredAt ? (
        <p className="cw-hint">
          {t("casework.draft.transferred_at", "")}:{" "}
          {new Date(draft.transferredAt).toLocaleString(locale || "et", { dateStyle: "short", timeStyle: "short" })}
        </p>
      ) : null}

      {terminal ? <p className="cw-notice">{t("casework.draft.terminal_notice", "")}</p> : null}

      <button className="cw-button" type="button" onClick={onClose}>
        {t("casework.draft.close", "")}
      </button>

      {!fields.length ? <p className="cw-empty">{t("casework.draft.fields_empty", "")}</p> : null}

      <ul className="cw-list">
        {fields.map((field) => (
          <li className="cw-item" key={field.id}>
            {/* Tekst on TEKST: sisu tuleb React'i lapsena, mitte HTML-ina. */}
            <span className="cw-item-text">
              {field.fieldKey}: {field.text}
            </span>
            <span className="cw-item-meta">
              <span className="cw-badge">
                {t(provenanceLabelKey(field.provenance) || "casework.errors.provenance_unknown", "")}
              </span>
            </span>
            <ConfirmButton
              label={t("casework.draft.remove_field", "")}
              confirmLabel={t("casework.draft.confirm_remove_field", "")}
              cancelLabel={t("casework.draft.cancel", "")}
              disabled={writable}
              onConfirm={() => onRemoveField(field.fieldKey)}
            />
          </li>
        ))}
      </ul>

      {!terminal ? <FieldForm disabled={disabled} t={t} onSave={onSaveField} /> : null}

      <TransitionForm draft={draft} disabled={disabled} t={t} onTransition={onTransition} />

      {/* Kopeerimine on lubatud KA terminaalses seisus: `ULE_KANTUD` mustandi
          sisu võib olla vaja teist korda STAR-i viia ja kopeerimine ei muuda
          midagi (L9). Ülekantuks märkimise nupu näitab paneel ise ainult sealt,
          kust olekumasin edasi lubab. */}
      <TransferActions
        caseId={caseId}
        draft={draft}
        locale={locale}
        disabled={disabled}
        t={t}
        onChanged={onTransferChanged}
      />
    </div>
  );
}

function FieldForm({ disabled, t, onSave }) {
  const [fieldKey, setFieldKey] = useState("");
  const [text, setText] = useState("");
  /* Päritolul EI OLE vaikeväärtust (L4) — märgis, mille inimene ei valinud, ei
     ole märgis. */
  const [provenance, setProvenance] = useState("");

  return (
    <form
      className="cw-form cw-form--inline"
      onSubmit={async (event) => {
        event.preventDefault();
        const saved = await onSave(fieldKey, text, provenance);
        /* Väli tühjendatakse AINULT õnnestumisel — tõrge ei tohi kasutaja
           teksti ära kustutada. */
        if (saved) {
          setFieldKey("");
          setText("");
          setProvenance("");
        }
      }}
    >
      <input
        className="cw-input"
        type="text"
        value={fieldKey}
        onChange={(event) => setFieldKey(event.target.value.toUpperCase())}
        disabled={disabled}
        maxLength={64}
        placeholder="EESMARK"
        aria-label={t("casework.draft.field_key", "")}
      />
      <input
        className="cw-input"
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={disabled}
        maxLength={4000}
        aria-label={t("casework.draft.field_text", "")}
      />
      <select
        className="cw-input"
        value={provenance}
        onChange={(event) => setProvenance(event.target.value)}
        disabled={disabled}
        required
        aria-label={t("casework.draft.provenance_required", "")}
      >
        <option value="">{t("casework.draft.provenance_required", "")}</option>
        {PROVENANCES.map((value) => (
          <option key={value} value={value}>
            {t(provenanceLabelKey(value) || "", "")}
          </option>
        ))}
      </select>
      <button className="cw-button" type="submit" disabled={disabled || !fieldKey.trim() || !text.trim() || !provenance}>
        {t("casework.draft.save_field", "")}
      </button>
    </form>
  );
}

function TransitionForm({ draft, disabled, t, onTransition }) {
  const targets = ALLOWED_TRANSITIONS[draft.transferState] || [];
  const [to, setTo] = useState("");
  const [reviewKind, setReviewKind] = useState("");

  if (!targets.length) return null;

  return (
    <form
      className="cw-form cw-form--inline"
      onSubmit={async (event) => {
        event.preventDefault();
        const moved = await onTransition(draft.transferState, to, reviewKind);
        if (moved) {
          setTo("");
          setReviewKind("");
        }
      }}
    >
      <select
        className="cw-input"
        value={to}
        onChange={(event) => setTo(event.target.value)}
        disabled={disabled}
        required
        aria-label={t("casework.draft.transition_to", "")}
      >
        <option value="">{t("casework.draft.transition_to", "")}</option>
        {targets.map((value) => (
          <option key={value} value={value}>
            {t(`casework.star2.${value}`, "")}
          </option>
        ))}
      </select>

      {/* `reviewKind` on AINULT `VAJAB_KONTROLLI` täpsustus — mujal ei küsita
          ja server nullib ta niikuinii. */}
      {to === "VAJAB_KONTROLLI" ? (
        <select
          className="cw-input"
          value={reviewKind}
          onChange={(event) => setReviewKind(event.target.value)}
          disabled={disabled}
          aria-label={t("casework.draft.review_kind", "")}
        >
          <option value="">{t("casework.draft.review_kind", "")}</option>
          {REVIEW_KINDS.map((value) => (
            <option key={value} value={value}>
              {t(`casework.star2.${value}`, "")}
            </option>
          ))}
        </select>
      ) : null}

      <button className="cw-button" type="submit" disabled={disabled || !to}>
        {t("casework.draft.transition", "")}
      </button>

      {/* Puuduv „STAR2-sse kantud" valik ütleb end ise välja, et ta ei näeks
          välja nagu puudujääk. */}
      {draft.transferState === "VALMIS_ULEKANDEKS" ? (
        <span className="cw-muted">{t("casework.draft.mark_transferred_elsewhere", "")}</span>
      ) : null}
    </form>
  );
}
