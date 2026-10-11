"use client";

/**
 * AnswerFeedbackCard — „Anna tagasisidet" assistendi vastuse kohta (omanik 11.10.2026).
 *
 * Avaneb sõnumi ikooniriba asemel samas klaasis (MessageActionsMenu): üks põhjus neljast,
 * soovi korral märkus, teele läheb alles „Saada" nupuga. Hinnanguid ega loendureid ei ole.
 * Sulgemisnuppu nurgas ei ole: kaart sulgub „Loobu" nupust, mujale vajutades või Esc-klahviga.
 *
 * Põhjuste loend on serveriga ühine (lib/answerFeedbackReasons.js).
 * Kujundus: AnswerFeedbackCard.module.css; lahtrid, väli ja nupud on platvormi omad.
 */

import { useEffect, useId, useRef, useState } from "react";

import ChoiceRow from "@/components/stage/ChoiceRow";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { ANSWER_FEEDBACK_CATEGORIES, ANSWER_FEEDBACK_NOTE_MAX } from "@/lib/answerFeedbackReasons";

import styles from "./AnswerFeedbackCard.module.css";

const CLOSE_AFTER_SENT_MS = 1800;

export default function AnswerFeedbackCard({ t, onSubmit, onClose }) {
  const noteId = useId();
  const closeTimerRef = useRef(0);
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState("");
  const text = key => t(`chat.answer_feedback.${key}`);

  useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);

  const submit = async event => {
    event.preventDefault();
    if (phase === "sending") return;
    if (!category) {
      setError(text("choose_reason"));
      return;
    }
    setPhase("sending");
    setError("");
    const result = await onSubmit?.({ category, note: note.trim() });
    if (result?.ok) {
      setPhase("sent");
      closeTimerRef.current = window.setTimeout(() => onClose?.(true), CLOSE_AFTER_SENT_MS);
      return;
    }
    setPhase("idle");
    // Server ütleb põhjuse võtmega, millel on lause (api.answer_feedback.*); muu tõrge saab üldise lause.
    const known = typeof result?.messageKey === "string" && result.messageKey.startsWith("api.answer_feedback.") ? t(result.messageKey) : "";
    setError(known && known !== result.messageKey ? known : text("failed"));
  };

  if (phase === "sent") {
    return (
      <p className={styles.done} role="status">
        {text("sent")}
      </p>
    );
  }

  return (
    <form className={styles.card} onSubmit={submit} noValidate>
      <ChoiceRow
        label={text("title")}
        columns={2}
        value={category}
        disabled={phase === "sending"}
        options={ANSWER_FEEDBACK_CATEGORIES.map(reason => ({ value: reason, label: text(`reason_${reason}`) }))}
        onChange={value => {
          setCategory(value);
          setError("");
        }}
      />
      <div className={styles.noteField}>
        <label className="sr-only" htmlFor={noteId}>
          {text("note_label")}
        </label>
        <Textarea
          id={noteId}
          className={styles.note}
          rows={3}
          maxLength={ANSWER_FEEDBACK_NOTE_MAX}
          placeholder={text("note_placeholder")}
          value={note}
          disabled={phase === "sending"}
          onChange={event => setNote(event.target.value)}
        />
        <div className={styles.meta}>
          <span className={styles.error} role="alert">
            {error}
          </span>
          <span className={styles.count} aria-hidden="true">
            {note.length}/{ANSWER_FEEDBACK_NOTE_MAX}
          </span>
        </div>
      </div>
      <p className={styles.notice}>{text("notice")}</p>
      <div className={styles.actions}>
        <Button type="submit" size="sm" glow={false} disabled={phase === "sending"}>
          {phase === "sending" ? text("sending") : text("send")}
        </Button>
        <button type="button" className={styles.cancel} onClick={() => onClose?.(true)}>
          {text("cancel")}
        </button>
      </div>
    </form>
  );
}
