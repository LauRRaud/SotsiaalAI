"use client";

/**
 * ChoiceRow — üks küsimus, üks puudutus.
 *
 * Asendab rippvaliku seal, kus vastusevariante on kuni viis-kuus: kõik
 * variandid on kohe näha ja vastamiseks piisab ühest vajutusest.
 *
 * Kaks paigutust, mõlemas on variandid ÜHELAIUSED lahtrid (mitte eri pikkusega
 * nupud, mis murduvad suvaliselt). Lahter on nii lai kui küsimuse pikim silt,
 * mitte paneeli laiune: lühikesi vastuseid ei venitata üle terve akna.
 *  - `layout="scale"`: silt vasakul, lühikese skaala lahtrid paremal ühes reas.
 *    Mitu sellist rida üksteise all annavad tabeli, kus veerud on kohakuti.
 *  - `layout="stack"` (vaikimisi): küsimus üleval, variandid selle all võrgus.
 *    Sobib pikkadele või paljudele variantidele. `columns` sunnib veergude
 *    arvu (nt neli lühikest varianti ühes reas).
 *
 * `labelHidden`: silt on ainult ekraanilugejale (nt valik, mille pealkiri on
 * juba sammu pealkirjas).
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

export default function ChoiceRow({
  label,
  options,
  value,
  onChange,
  layout = "stack",
  columns,
  labelHidden = false,
  disabled = false
}) {
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
    <div
      className={styles.row}
      data-layout={layout}
      style={{ "--choice-count": options.length, "--choice-cols": columns || Math.min(options.length, 3) }}
      role="radiogroup"
      aria-labelledby={labelId}
      ref={groupRef}
    >
      <span className={labelHidden ? "sr-only" : styles.label} id={labelId}>
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
