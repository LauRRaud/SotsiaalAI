"use client";

/**
 * ChoiceRow — üks küsimus, üks rida, üks puudutus.
 *
 * Asendab rippvaliku seal, kus vastusevariante on kuni neli-viis: kõik
 * variandid on kohe näha ja vastamiseks piisab ühest vajutusest.
 *
 * Ligipääsetavus: `radiogroup` rändava tabulatsiooniga. Nooled liiguvad
 * variantide vahel ja valivad (nagu päris raadionuppudel); vastamata reale
 * tabuleerides saab fookuse esimene variant, valimata midagi.
 *
 * Kujundus: ChoiceRow.module.css.
 */

import { useId, useRef } from "react";

import styles from "./ChoiceRow.module.css";

const ARROW_STEP = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

export default function ChoiceRow({ label, options, value, onChange, disabled = false }) {
  const labelId = useId();
  const groupRef = useRef(null);
  const selectedIndex = options.findIndex((option) => option.value === value);

  const onKeyDown = (event, index) => {
    const step = ARROW_STEP[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange?.(options[next].value);
    groupRef.current?.querySelectorAll("button")[next]?.focus();
  };

  return (
    <div className={styles.row} role="radiogroup" aria-labelledby={labelId} ref={groupRef}>
      <span className={styles.label} id={labelId}>
        {label}
      </span>
      <div className={styles.options}>
        {options.map((option, index) => {
          const checked = index === selectedIndex;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              className={styles.option}
              aria-checked={checked}
              tabIndex={checked || (selectedIndex < 0 && index === 0) ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange?.(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
