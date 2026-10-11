"use client";

/**
 * AnswerFeedbackCard — „Anna tagasisidet" assistendi vastuse kohta (omanik 11.10.2026).
 *
 * Avaneb sõnumi ikooniriba asemel samas klaasis (MessageActionsMenu): üks põhjus neljast,
 * soovi korral märkus, teele läheb alles „Saada" nupuga. Hinnanguid ega loendureid ei ole.
 * Sulgemisnuppu nurgas ei ole: kaart sulgub „Loobu" nupust, mujale vajutades või Esc-klahviga.
 *
 * Põhjuste loend on serveriga ühine (lib/answerFeedbackReasons.js). Vorm ise on FeedbackForm,
 * sama mis allika veateatel.
 */

import { useEffect, useRef, useState } from "react";

import { ANSWER_FEEDBACK_CATEGORIES, ANSWER_FEEDBACK_NOTE_MAX } from "@/lib/answerFeedbackReasons";

import FeedbackForm from "./FeedbackForm";
import styles from "./AnswerFeedbackCard.module.css";

const CLOSE_AFTER_SENT_MS = 1800;

export default function AnswerFeedbackCard({ t, onSubmit, onClose }) {
  const closeTimerRef = useRef(0);
  const [sent, setSent] = useState(false);
  const text = key => t(`chat.answer_feedback.${key}`);

  useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);

  if (sent) {
    return (
      <p className={styles.done} role="status">
        {text("sent")}
      </p>
    );
  }

  return (
    <FeedbackForm
      t={t}
      title={text("title")}
      columns={2}
      noteMax={ANSWER_FEEDBACK_NOTE_MAX}
      reasons={ANSWER_FEEDBACK_CATEGORIES.map(reason => ({ value: reason, label: text(`reason_${reason}`) }))}
      texts={{
        noteLabel: text("note_label"),
        notePlaceholder: text("note_placeholder"),
        send: text("send"),
        sending: text("sending"),
        cancel: text("cancel"),
        chooseReason: text("choose_reason"),
        failed: text("failed")
      }}
      notice={text("notice")}
      errorPrefix="api.answer_feedback."
      onSubmit={onSubmit}
      onDone={() => {
        setSent(true);
        closeTimerRef.current = window.setTimeout(() => onClose?.(true), CLOSE_AFTER_SENT_MS);
      }}
      onCancel={() => onClose?.(true)}
    />
  );
}
