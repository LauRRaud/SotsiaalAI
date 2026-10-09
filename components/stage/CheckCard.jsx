"use client";

/**
 * CheckCard — märkeruut kaardina: pealkiri ja selgitus eraldi ridadel.
 *
 * Kasuta seal, kus valik vajab selgitust (tavaline Checkbox kannab ainult
 * silti). Terve kaart on vajutatav.
 *
 * Kujundus: CheckCard.module.css.
 */

import styles from "./CheckCard.module.css";

export default function CheckCard({ title, description, checked = false, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="checkbox"
      className={styles.card}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
    >
      <span className={styles.box} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 12.5l4 4 8-8" />
        </svg>
      </span>
      <span className={styles.title}>{title}</span>
      {description ? <span className={styles.description}>{description}</span> : null}
    </button>
  );
}
