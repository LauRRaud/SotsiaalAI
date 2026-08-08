"use client";

/**
 * JTA-V1 (E4) — kohtumise märkme sektsioon juhtumi detailvaates.
 *
 * KAHEKSA KIHTI ON PINNAL KAHEKSA ERALDI PLOKKI, mitte üks loend siltidega.
 * See ei ole kujundusvalik: kui kliendi enda sõnad ja töötaja tõlgendus
 * seisavad ühes voos, loeb inimene neid ühe tekstina ka siis, kui igal real on
 * silt küljes. Eraldi plokk sunnib kirjutamise hetkel valima, KUHU rida käib —
 * ja just see valik ongi kihilise märkme mõte.
 *
 * PRIVAATNE REFLEKSIOON SEISAB LÕPUS ja kannab oma selgitust. Tema kirjeid ei
 * saa teise kihti tõsta (server annab 409) ja liides ei paku selleks nuppu —
 * lubadust ei tohi saada tühistada ümbernimetamisega.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { PROVENANCES, provenanceLabelKey } from "@/lib/workspaces/provenance";

import ConfirmButton from "./ConfirmButton";
import { caseWorkRequest, fromLocalInputValue } from "./caseWorkClient";

/**
 * Ptk 4.4 kaheksa kihti, sama järjekord mis teenuskihis (`NOTE_LAYERS`).
 *
 * Loend on siin oma konstandina, sest `lib/casework/caseWorkMeetingNote.js` toob
 * endaga Prisma kliendi. Et kaks loendit ei saaks lahku minna, kontrollib neid
 * `meetingNoteUi.test.js` teineteise vastu.
 */
export const NOTE_LAYER_ORDER = Object.freeze([
  "KLIENDI_VAADE",
  "FAKTID",
  "TOOTAJA_TAHELEPANEK",
  "KONTROLLIMATA",
  "KOKKULEPPED",
  "JARGMISED_SAMMUD",
  "STAR2_KANTAV",
  "PRIVAATNE_REFLEKSIOON"
]);

const PRIVATE_LAYER = "PRIVAATNE_REFLEKSIOON";
const PAGE_SIZE = 25;

export default function MeetingNoteSection({ caseId, writeDisabled, onChanged }) {
  const { t, locale } = useI18n();

  const [notes, setNotes] = useState([]);
  const [notesCursor, setNotesCursor] = useState(null);
  const [openNote, setOpenNote] = useState(null);
  const [errorKey, setErrorKey] = useState(null);
  const [busy, setBusy] = useState(false);
  const [meetingAt, setMeetingAt] = useState("");

  /* AVATUD MÄRKME ID SEISAB `ref`-is, mitte ainult olekus. Kaks `loadNote()`
     päringut võivad lõppeda VALES JÄRJEKORRAS ja aeglasem vastus kirjutaks
     värskema üle — töötaja vaataks siis märget A ja näeks märkme B sisu. Iga
     vastus kontrollib, kas tema päring on ikka veel see, mida oodatakse. */
  const requestedNoteId = useRef(null);

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

  /**
   * PAGINEERIMINE ON KOHUSTUSLIK. Ilma cursor'ita jäid vanemad kui 25 märget
   * liidesest KÄTTESAAMATUKS — teenuskiht toetab lehekülgi ja pind viskas selle
   * võimaluse ära. Juhtumitöö on pikk: 25 kohtumist ei ole palju.
   */
  const loadNotes = useCallback(
    async ({ cursor = null, append = false } = {}) => {
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (cursor) params.set("cursor", cursor);
        const body = await caseWorkRequest(
          `/cases/${encodeURIComponent(caseId)}/meeting-notes?${params.toString()}`,
          { locale }
        );
        setNotes((previous) => (append ? [...previous, ...(body.items || [])] : body.items || []));
        setNotesCursor(body.nextCursor || null);
      } catch (error) {
        setErrorKey(error?.messageKey || "casework.errors.unexpected");
      }
    },
    [caseId, locale]
  );

  const loadNote = useCallback(
    async (noteId) => {
      requestedNoteId.current = noteId;
      try {
        const body = await caseWorkRequest(
          `/cases/${encodeURIComponent(caseId)}/meeting-notes/${encodeURIComponent(noteId)}`,
          { locale }
        );
        /* Vahepeal avati juba teine märge — see vastus on aegunud ja teda EI
           panda ekraanile. */
        if (requestedNoteId.current !== noteId) return;
        setOpenNote(body.note || null);
      } catch (error) {
        if (requestedNoteId.current !== noteId) return;
        setErrorKey(error?.messageKey || "casework.errors.unexpected");
      }
    },
    [caseId, locale]
  );

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const createNote = useCallback(
    async (event) => {
      event.preventDefault();
      const created = await run(() =>
        caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/meeting-notes`, {
          method: "POST",
          locale,
          body: { meetingAt: fromLocalInputValue(meetingAt) }
        })
      );
      if (!created?.note?.id) return;
      setMeetingAt("");
      await loadNotes();
      await loadNote(created.note.id);
      onChanged?.();
    },
    [caseId, loadNote, loadNotes, locale, meetingAt, onChanged, run]
  );

  const addEntry = useCallback(
    async (layer, text, provenance) => {
      const done = await run(() =>
        caseWorkRequest(
          `/cases/${encodeURIComponent(caseId)}/meeting-notes/${encodeURIComponent(openNote.id)}/entries`,
          { method: "POST", locale, body: { layer, text, provenance } }
        )
      );
      if (!done) return false;
      await loadNote(openNote.id);
      return true;
    },
    [caseId, loadNote, locale, openNote, run]
  );

  const removeEntry = useCallback(
    async (entryId) => {
      const done = await run(() =>
        caseWorkRequest(
          `/cases/${encodeURIComponent(caseId)}/meeting-notes/${encodeURIComponent(openNote.id)}/entries/${encodeURIComponent(entryId)}`,
          { method: "DELETE", locale }
        )
      );
      if (!done) return false;
      await loadNote(openNote.id);
      return true;
    },
    [caseId, loadNote, locale, openNote, run]
  );

  const disabled = writeDisabled || busy;

  return (
    <section className="cw-section">
      <h2 className="cw-section-title">{t("casework.note.section_title", "")}</h2>
      <p className="cw-hint">{t("casework.note.section_hint", "")}</p>

      {errorKey ? (
        <p className="cw-error" role="alert">
          {t(errorKey, "")}
        </p>
      ) : null}

      <form className="cw-form cw-form--inline" onSubmit={createNote}>
        <div className="cw-field">
          <label className="cw-label" htmlFor="cw-note-meeting-at">
            {t("casework.note.meeting_at", "")}
          </label>
          <input
            id="cw-note-meeting-at"
            className="cw-input"
            type="datetime-local"
            value={meetingAt}
            onChange={(event) => setMeetingAt(event.target.value)}
            disabled={disabled}
          />
        </div>
        <button className="cw-button" type="submit" disabled={disabled}>
          {t("casework.note.create", "")}
        </button>
      </form>

      {!notes.length ? <p className="cw-empty">{t("casework.note.empty", "")}</p> : null}

      <ul className="cw-list">
        {notes.map((note) => (
          <li className="cw-case" key={note.id}>
            <span className="cw-case-label">
              {note.meetingAt
                ? new Date(note.meetingAt).toLocaleString(locale || "et", { dateStyle: "short", timeStyle: "short" })
                : t("casework.note.no_meeting_time", "")}
            </span>
            <span className="cw-case-meta">
              {note.meetingPrepId ? <span className="cw-badge">{t("casework.note.linked_prep", "")}</span> : null}
            </span>
            <button className="cw-button" type="button" onClick={() => loadNote(note.id)}>
              {t("casework.note.open", "")}
            </button>
            {/* Kustutusnuppu EI OLE ja see ei ole unustus — märge on kohtumise
                jälg. Marsruuti sinna ka ei ole. */}
          </li>
        ))}
      </ul>

      {notesCursor ? (
        <button
          className="cw-button"
          type="button"
          disabled={busy}
          onClick={() => run(() => loadNotes({ cursor: notesCursor, append: true }))}
        >
          {t("casework.note.load_more", "")}
        </button>
      ) : null}

      {openNote ? (
        /* `key` ON SIIN GARANTII, MITTE OPTIMEERIMINE. Ilma temata jäävad
           `NoteEditor` ja kihiplokid märkme vahetamisel SAMADEKS komponentideks
           ja nende kohalik `text`/`provenance` olek elab üle: märkmes A pooleli
           jäänud rea saaks salvestada märkme B alla. Uus `key` sunnib React'i
           puu maha võtma. */
        <NoteEditor
          key={openNote.id}
          note={openNote}
          locale={locale}
          disabled={disabled}
          t={t}
          onAddEntry={addEntry}
          onRemoveEntry={removeEntry}
          onClose={() => {
            requestedNoteId.current = null;
            setOpenNote(null);
          }}
        />
      ) : null}
    </section>
  );
}

function NoteEditor({ note, locale, disabled, t, onAddEntry, onRemoveEntry, onClose }) {
  const entries = Array.isArray(note.entries) ? note.entries : [];

  return (
    <div className="cw-section">
      {/* AVATUD MÄRKME IDENTITEET ON NÄHTAV. Ilma selleta ei ütle ükski asi
          ekraanil, MILLISE kohtumise alla parasjagu kirjutatakse — ja märkmeid
          on juhtumil mitu. */}
      <h3 className="cw-section-title">
        {t("casework.note.open_note", "")}:{" "}
        {note.meetingAt
          ? new Date(note.meetingAt).toLocaleString(locale || "et", { dateStyle: "short", timeStyle: "short" })
          : t("casework.note.no_meeting_time", "")}
      </h3>

      <button className="cw-button" type="button" onClick={onClose}>
        {t("casework.note.close", "")}
      </button>

      {NOTE_LAYER_ORDER.map((layer) => (
        <NoteLayerBlock
          key={layer}
          layer={layer}
          entries={entries.filter((entry) => entry.layer === layer)}
          disabled={disabled}
          t={t}
          onAdd={onAddEntry}
          onRemove={onRemoveEntry}
        />
      ))}
    </div>
  );
}

function NoteLayerBlock({ layer, entries, disabled, t, onAdd, onRemove }) {
  const [text, setText] = useState("");
  /* PÄRITOLUL EI OLE VAIKEVÄÄRTUST ja see on L4 otsene nõue. Eelvalitud
     `TOOTAJA_TAHELEPANEK` tähendas, et rea sai lisada päritolu TEADLIKULT
     valimata — ja märgis, mille inimene ei valinud, ei ole märgis. Server
     keeldub tühjast; vorm ei lase enne saata. */
  const [provenance, setProvenance] = useState("");
  const isPrivate = layer === PRIVATE_LAYER;

  return (
    <div className="cw-field">
      <h3 className="cw-section-title">{t(`casework.note.layer_${layer}`, "")}</h3>
      {isPrivate ? <p className="cw-hint">{t("casework.note.private_locked_hint", "")}</p> : null}

      {!entries.length ? <p className="cw-empty">{t("casework.note.entries_empty", "")}</p> : null}

      <ul className="cw-list">
        {entries.map((entry) => (
          <li className="cw-item" key={entry.id}>
            {/* Tekst on TEKST: sisu tuleb React'i lapsena, mitte HTML-ina. */}
            <span className="cw-item-text">{entry.text}</span>
            <span className="cw-item-meta">
              <span className="cw-badge">
                {t(provenanceLabelKey(entry.provenance) || "casework.errors.provenance_unknown", "")}
              </span>
            </span>
            {/* KUSTUTUS ON PÖÖRDUMATU ja teda ei auditeerita eraldi — seega
                küsitakse üle. Tagasivõtuakent EI pakuta: lubadus, mille taga ei
                ole mehhanismi, on halvem kui küsimus. */}
            <ConfirmButton
              label={t("casework.note.remove_entry", "")}
              confirmLabel={t("casework.note.confirm_remove_entry", "")}
              cancelLabel={t("casework.note.cancel", "")}
              disabled={disabled}
              onConfirm={() => onRemove(entry.id)}
            />
          </li>
        ))}
      </ul>

      <form
        className="cw-form cw-form--inline"
        onSubmit={async (event) => {
          event.preventDefault();
          const saved = await onAdd(layer, text, provenance);
          /* VÄLI TÜHJENDATAKSE AINULT ÕNNESTUMISEL. Varem käis `setText("")`
             tingimusteta ja ebaõnnestunud salvestus KUSTUTAS kasutaja teksti —
             kõige halvem tulemus, mis vormil olla saab: töö kadus ja põhjust ei
             olnud näha. */
          if (saved) {
            setText("");
            setProvenance("");
          }
        }}
      >
        <input
          className="cw-input"
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={disabled}
          maxLength={4000}
          aria-label={`${t(`casework.note.layer_${layer}`, "")} — ${t("casework.note.entry_text", "")}`}
        />
        <select
          className="cw-input"
          value={provenance}
          onChange={(event) => setProvenance(event.target.value)}
          disabled={disabled}
          required
          aria-label={t("casework.note.provenance_required", "")}
        >
          <option value="">{t("casework.note.provenance_required", "")}</option>
          {PROVENANCES.map((value) => (
            <option key={value} value={value}>
              {t(provenanceLabelKey(value) || "", "")}
            </option>
          ))}
        </select>
        <button className="cw-button" type="submit" disabled={disabled || !text.trim() || !provenance}>
          {t("casework.note.add_entry", "")}
        </button>
      </form>
    </div>
  );
}
