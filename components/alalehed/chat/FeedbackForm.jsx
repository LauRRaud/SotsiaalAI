"use client";

/**
 * FeedbackForm — tagasiside vorm vestluses: üks põhjus ühelaiuste lahtritena, soovi korral märkus ja „Saada".
 *
 * Kaks kasutust: vastuse tagasiside kaart (AnswerFeedbackCard) ja allika veateade allikate paneelis
 * (ChatSourcesPanel). Midagi ei lähe teele enne „Saada" nuppu; põhjuseta saatmine ütleb seda vormis.
 * `onSubmit` vastab { ok, messageKey }: serveri keeldumise võti (`errorPrefix` + …) on kataloogis lausena,
 * muu tõrge saab üldise lause. Õnnestunud saatmise järel kutsutakse `onDone` ja edasise otsustab kutsuja.
 *
 * Kujundus: FeedbackForm.module.css; lahtrid, väli ja saatmisnupp on platvormi omad.
 */

import { useId, useState } from "react";

import ChoiceRow from "@/components/stage/ChoiceRow";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";

import styles from "./FeedbackForm.module.css";

export default function FeedbackForm({ t, title, reasons, columns = 2, noteMax = 500, noteRows = 3, texts, notice = null, errorPrefix, onSubmit, onDone, onCancel }) {
  const noteId = useId();
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const submit = async event => {
    event.preventDefault();
    if (sending) return;
    if (!category) {
      setError(texts.chooseReason);
      return;
    }
    setSending(true);
    setError("");
    const result = await onSubmit?.({ category, note: note.trim() });
    if (result?.ok) {
      onDone?.(result);
      return;
    }
    setSending(false);
    const known = typeof result?.messageKey === "string" && result.messageKey.startsWith(errorPrefix) ? t(result.messageKey) : "";
    setError(known && known !== result.messageKey ? known : texts.failed);
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <ChoiceRow
        label={title}
        columns={columns}
        value={category}
        disabled={sending}
        options={reasons}
        onChange={value => {
          setCategory(value);
          setError("");
        }}
      />
      <div className={styles.noteField}>
        <label className="sr-only" htmlFor={noteId}>
          {texts.noteLabel}
        </label>
        <Textarea
          id={noteId}
          className={styles.note}
          rows={noteRows}
          maxLength={noteMax}
          placeholder={texts.notePlaceholder}
          value={note}
          disabled={sending}
          onChange={event => setNote(event.target.value)}
        />
        <div className={styles.meta}>
          <span className={styles.error} role="alert">
            {error}
          </span>
          <span className={styles.count} aria-hidden="true">
            {note.length}/{noteMax}
          </span>
        </div>
      </div>
      {notice ? <p className={styles.notice}>{notice}</p> : null}
      <div className={styles.actions}>
        <Button type="submit" size="sm" glow={false} disabled={sending}>
          {sending ? texts.sending : texts.send}
        </Button>
        <button type="button" className={styles.cancel} onClick={() => onCancel?.()}>
          {texts.cancel}
        </button>
      </div>
    </form>
  );
}
