"use client";

/**
 * ChoiceChips — mitu valikut korraga (märgi kõik, mis sobivad).
 *
 * Sama ühelaiuste lahtrite võrk mis `ChoiceRow` paigutusel „stack", aga iga
 * lahter on eraldi lüliti: vajutus märgib, teine vajutus võtab märke maha.
 * Lahtris on märkekast, et mitme valiku küsimus eristuks ühe valiku omast.
 * Kasuta loendi jaoks, kust inimene valib mitu (nt „peamised koormustegurid").
 *
 * Ligipääsetavus: rühm (`group`) nimega, iga variant on `checkbox`.
 * `labelHidden`: silt on ainult ekraanilugejale (sammu pealkiri ütleb sama).
 * `columns` sunnib veergude arvu (vaikimisi kuni kolm) ja `keepColumns` hoiab
 * seda ka kitsas töölaua paneelis, nagu `ChoiceRow`-l.
 *
 * Kujundus: ChoiceChips.module.css.
 */

import { useId } from "react";

import styles from "./ChoiceChips.module.css";

export default function ChoiceChips({ label, hint, options, values = [], onToggle, columns, keepColumns = false, labelHidden = false, disabled = false }) {
  const labelId = useId();
  return (
    <div className={styles.field} role="group" aria-labelledby={labelId}>
      <span className={labelHidden ? "sr-only" : styles.label} id={labelId}>
        {label}
      </span>
      {hint ? <span className={styles.hint}>{hint}</span> : null}
      <div className={styles.options} data-keep={keepColumns ? "1" : undefined} style={{ "--choice-cols": columns || Math.min(options.length, 3) }}>
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
            <span className={styles.box} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 12.5l4 4 8-8" />
              </svg>
            </span>
            <span className={styles.text}>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
