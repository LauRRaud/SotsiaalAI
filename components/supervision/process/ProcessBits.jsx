"use client";

/**
 * Supervisiooni protsessi vaadete ühised tükid: kahe vajutusega nupp, fookus
 * osa sisu vahetumisel, avatavate ridade loend, faktide loend, päis lava kohal.
 *
 * Siin on ainult kuju. Read teeb `processRows.js`, andmed ja päringud on lehtede
 * ja osade hoidjate failides (`../SupervisionProcessPage.jsx`, `../*Panel.jsx`).
 * Märk, takistuse lause ja laadimise seis tulevad avalehtede tükkidest
 * (`../entry/EntryBits.jsx`): protsessi leht näeb välja nagu laud, kust sinna tuldi.
 *
 * Kujundus: process.module.css (siin kõrval).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Button from "@/components/ui/Button";

import { Chip } from "../entry/EntryBits";
import styles from "./process.module.css";

/* Teine vajutus peab tulema selle aja sees; muidu on nupp jälle algseisus. */
const CONFIRM_MS = 8000;
/* Lühim vahe esimese ja teise vajutuse vahel: topeltklõps on alla selle. */
const MIN_GAP_MS = 400;
const NOT_ARMED = Object.freeze({ key: "", note: "" });

/**
 * Ühe vaate kahe vajutusega nuppude ühine seis.
 *
 * MIKS ÜHINE. Vaates võib olla mitu tagasivõtmatut tegu (kokkuvõtte saatmine ja
 * kõrvale jätmine). Korraga küsib kinnitust üks nupp ja tagajärg seisab nupu
 * kõrval tegevusrea teates (`note`): kahe nupu kaks lauset ei mahuks sinna ja
 * inimene ei teaks, kumma kohta lause käib.
 *
 * `resetKey`: kui vaate sisu vahetub (teine kirje, teine seis), ei tohi vana
 * kirje kinnituse ootus uuele üle kanduda.
 */
export function useTwoPress(resetKey = "") {
  const [state, setState] = useState(NOT_ARMED);
  const armedAt = useRef(0);
  const timer = useRef(0);

  const disarm = useCallback(() => {
    window.clearTimeout(timer.current);
    setState(NOT_ARMED);
  }, []);
  const arm = useCallback((key, note) => {
    window.clearTimeout(timer.current);
    armedAt.current = Date.now();
    setState({ key, note: note || "" });
    timer.current = window.setTimeout(() => setState(NOT_ARMED), CONFIRM_MS);
  }, []);
  /* Teine vajutus loeb alles siis, kui esimesest on möödas MIN_GAP_MS. */
  const settled = useCallback(() => Date.now() - armedAt.current >= MIN_GAP_MS, []);

  useEffect(() => {
    disarm();
  }, [disarm, resetKey]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return useMemo(() => ({ key: state.key, note: state.note, arm, disarm, settled }), [arm, disarm, settled, state]);
}

/**
 * Tagasivõtmatu teo nupp: esimene vajutus küsib kinnitust ja toob tagajärje
 * nupu kõrvale, teine vajutus teeb teo.
 *
 * Esimene ja teine aste on SAMA nupp, mille tekst vahetub, seega jääb fookus
 * nupule. Just seepärast ei tohi üks liigutus mõlemat astet läbida: all hoitud
 * Enter (klahvikordus) ei vajuta nuppu ja vajutus, mis tuleb vähem kui
 * MIN_GAP_MS pärast esimest, jäetakse vahele (sama reegel mis
 * `components/casework/ConfirmButton.jsx`-il). Kui nupp keelatakse (päring
 * käib), kinnituse ootus nullitakse: muidu jääks see ripakile.
 *
 * `press`: `useTwoPress()` vaatest. `name`: selle nupu võti vaates.
 * `busyLabel`: nupu tekst, kuni selle teo päring käib („Sulgen…").
 * `data-danger`: fookuse viimine osa sisu vahetumisel jätab selle nupu vahele.
 */
export function TwoPress({ press, name, label, confirmLabel, cancelLabel, consequence, onConfirm, disabled = false, busyLabel = "", variant = "secondary", glow }) {
  const armed = press.key === name;
  const { disarm } = press;
  useEffect(() => {
    if (disabled && armed) disarm();
  }, [armed, disabled, disarm]);
  /* Kas just SEE nupp kinnitati: päringu ajal on osa kõik nupud keelatud, aga
     „Salvestan…" kuulub ainult vajutatud nupule. */
  const [fired, setFired] = useState(false);
  useEffect(() => {
    if (fired && !disabled) setFired(false);
  }, [disabled, fired]);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={variant}
        glow={variant === "primary" ? glow : undefined}
        className={variant === "primary" ? undefined : styles.danger}
        data-danger="true"
        disabled={disabled}
        onKeyDown={(event) => {
          if (event.repeat && (event.key === "Enter" || event.key === " ")) event.preventDefault();
        }}
        onClick={() => {
          if (!armed) {
            press.arm(name, consequence);
            return;
          }
          if (!press.settled()) return;
          press.disarm();
          setFired(true);
          onConfirm();
        }}
      >
        {/* `busyLabel`: päringu ajal ei tohi nupp näida vajutamata. */}
        {armed ? confirmLabel : fired && disabled && busyLabel ? busyLabel : label}
      </Button>
      {armed ? (
        <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={press.disarm}>
          {cancelLabel}
        </Button>
      ) : null}
    </>
  );
}

/**
 * Kui osa vahetab oma sisu (loend → kirje → vorm → loend), kaob vajutatud nupp
 * ja klaviatuuri fookus koos sellega. Fookus läheb uue sisu esimesele väljale
 * või nupule; kui seal midagi ei ole, siis osa pealkirjale. Tagasivõtmatu teo
 * nupule (`data-danger`) fookust ei viida: all hoitud Enter jõuaks muidu vormi
 * „Loobu" nupult otse kustutamise nupule.
 */
export function useSwapFocus(mode) {
  const ref = useRef(null);
  const shown = useRef(mode);
  useEffect(() => {
    if (shown.current === mode) return;
    shown.current = mode;
    const node = ref.current;
    if (!node) return;
    /* Valikurühmas on tabulatsioonis üks lahter; teised jäävad vahele. */
    const target =
      node.querySelector('textarea:not(:disabled), input:not(:disabled), button:not(:disabled):not([tabindex="-1"]):not([data-danger])') ||
      node.closest("section")?.querySelector("[data-step-heading]");
    target?.focus({ preventScroll: true });
  }, [mode]);
  return ref;
}

/** Lava kohal: milline protsess on lahti, minu roll, protsessi seis ja tee tagasi lauale. */
export function ProcessHead({ head, backText, onBack }) {
  return (
    <header className={styles.head}>
      <h1 className={styles.processName}>{head.title}</h1>
      {head.chips.map((chip) => (
        <Chip key={chip.key} tone={chip.tone} prefix={chip.prefix}>
          {chip.text}
        </Chip>
      ))}
      <button type="button" className={styles.back} onClick={onBack}>
        {backText}
      </button>
    </header>
  );
}

/**
 * Avatavad read: terve rida on üks nupp. `meta(row)` joonistab rea märgid
 * (seis, privaatsusmärk, kuupäev).
 * `rows`: [{ id, title, sub? }]
 */
export function OpenRows({ rows, openText, onOpen, meta }) {
  return (
    <ul className={styles.rows}>
      {rows.map((row) => (
        <li key={row.id} className={styles.rowItem}>
          <button type="button" className={styles.row} onClick={() => onOpen(row.id)}>
            <span className={styles.rowMain}>
              <span className={styles.rowTitle}>{row.title}</span>
              {row.sub ? <span className={styles.rowSub}>{row.sub}</span> : null}
            </span>
            <span className={styles.rowMeta}>{meta ? meta(row) : null}</span>
            <span className={styles.rowOpen} aria-hidden="true">
              {`${openText} ›`}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Nimetus vasakul, väärtus paremal. `facts`: [{ key, label, value, missing?, long? }]. */
export function Facts({ facts }) {
  return (
    <dl className={styles.facts}>
      {facts.map((fact) => (
        <div key={fact.key} className={styles.fact}>
          <dt className={styles.factLabel}>{fact.label}</dt>
          <dd className={styles.factValue} data-missing={fact.missing ? "true" : undefined} data-long={fact.long ? "true" : undefined}>
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Väli sildi, vihje ja veaga; lapseks on väli ise. `size="sm"` on lühike väli (kellaaeg, tunnus).
    `labelHidden`: vaate küsimus ütleb juba, mida väli küsib; silt jääb ekraanilugejale. */
export function Field({ id, label, labelHidden = false, hint, error, size, children }) {
  return (
    <div className={styles.field} data-size={size}>
      <label className={labelHidden ? "sr-only" : styles.fieldLabel} htmlFor={id}>
        {label}
      </label>
      {hint ? (
        <span className={styles.fieldHint} id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
      {children}
      {error ? (
        <span className={styles.fieldError} id={`${id}-error`} aria-live="polite">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** Välja `aria-describedby`: vihje ja viga, kui need on olemas. */
export const describedBy = (id, { hint, error } = {}) => [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
