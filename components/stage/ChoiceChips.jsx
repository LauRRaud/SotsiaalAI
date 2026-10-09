"use client";

/**
 * ChoiceChips — mitu valikut korraga (märgi kõik, mis sobivad).
 *
 * Sama välimus mis `ChoiceRow` variantidel, aga iga variant on eraldi lüliti:
 * vajutus märgib, teine vajutus võtab märke maha. Kasuta loendi jaoks, kust
 * inimene valib mitu (nt „peamised koormustegurid").
 *
 * Ligipääsetavus: rühm (`group`) nimega, iga variant on `checkbox`.
 *
 * Kujundus: ChoiceChips.module.css.
 */

import { useId } from "react";

import styles from "./ChoiceChips.module.css";

export default function ChoiceChips({ label, hint, options, values = [], onToggle, disabled = false }) {
  const labelId = useId();
  return (
    <div className={styles.field} role="group" aria-labelledby={labelId}>
      <span className={styles.label} id={labelId}>
        {label}
      </span>
      {hint ? <span className={styles.hint}>{hint}</span> : null}
      <div className={styles.options}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="checkbox"
            className={styles.option}
            aria-checked={values.includes(option.value)}
            disabled={disabled}
            onClick={() => onToggle?.(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
