"use client";

/**
 * ActionCard — tegevus pealkirja ja selgitusega.
 *
 * Asendab laia pillnupu, kuhu pealkiri ja selgitus olid ühele reale kokku
 * kirjutatud. Pealkiri ütleb, mis juhtub; selgitus ütleb, mida see inimese
 * jaoks tähendab. `pressed` teeb kaardist valiku (aria-pressed); ilma selleta
 * on kaart tavaline tegevus.
 *
 * Kujundus: ActionCard.module.css.
 */

import styles from "./ActionCard.module.css";

export default function ActionCard({ title, description, pressed, onClick, disabled = false }) {
  return (
    <button
      type="button"
      className={styles.card}
      aria-pressed={pressed === undefined ? undefined : Boolean(pressed)}
      disabled={disabled}
      onClick={onClick}
    >
      <span className={styles.title}>{title}</span>
      {description ? <span className={styles.description}>{description}</span> : null}
    </button>
  );
}

/** Kaartide võrk: kaks veergu, kitsal pinnal üks. */
export function ActionCardGrid({ label, children }) {
  return (
    <div className={styles.grid} role="group" aria-label={label}>
      {children}
    </div>
  );
}
