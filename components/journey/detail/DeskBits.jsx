"use client";

/**
 * Avatud Teekonna osade ühised tükid: lahtrirea sakid, teade vaate all servas,
 * teist vajutust küsiv tegevus, sõnade read, inimese enda tekst, üherealine
 * väli ning fookuse ja lava mõõtmise reeglid.
 *
 * MIKS ÜHISED. Laua osad on sama kujuga: osa sees vahetuvad väikesed vaated
 * kohapeal (loend, avatud kirje, vorm). Kui iga osa joonistaks sakid, kinnituse
 * ja väljad ise, läheksid need esimese parandusega lahku.
 *
 * Siin on ainult kuju. Reeglid on failis ./journeyDesk.js.
 *
 * Kujundus: detail.module.css (siin kõrval) ja Teekonna lehtede ühine
 * ../journey.module.css.
 */

import { useEffect, useId, useRef, useState } from "react";

import ChoiceRow from "@/components/stage/ChoiceRow";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import shared from "../journey.module.css";
import styles from "./detail.module.css";
import { CONFIRM_MS, counterNear, pressTooSoon } from "./journeyDesk";

export const SMALL = Object.freeze({ type: "button", size: "sm", variant: "secondary" });

/* All hoitud Enter või tühik (klahvikordus) ei tohi sama nuppu teist korda
   vajutada: esimene ja teine aste on sama nupp. */
export function ignoreKeyRepeat(event) {
  if (event.repeat && (event.key === "Enter" || event.key === " ")) event.preventDefault();
}

/* All hoitud Enter väljal ei saada vormi: klahvikordus jõuab väljale kohe. */
export function blockRepeatEnter(event) {
  if (event.repeat && event.key === "Enter") event.preventDefault();
}

/**
 * Lava mõõdab oma kõrguse osa vahetusel, akna suuruse muutusel ja siis, kui osa
 * tasand kasvab. Osa SEES lühema vaate ette tulles tasand ei kahane, seega jääks
 * lühikese vaate nupurida tühja ruumi taha. Vaate vahetusel palume lava uuesti
 * mõõta: lava kuulab akna `resize` sündmust.
 */
export function useStageRemeasure(key) {
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    return () => window.cancelAnimationFrame(frame);
  }, [key]);
}

/**
 * Osa sisu vahetub kohapeal ja vajutatud nupp kaob koos vana sisuga: fookus
 * läheb väljale, mille vaade on selleks märkinud (`data-autofocus`), muidu vaate
 * pealkirjale. Nupule fookust ei viida (all hoitud Enter vajutaks seda kohe).
 * Esimesel joonistusel fookust ei võeta.
 */
export function useSwapFocus(key) {
  const ref = useRef(null);
  const shown = useRef(key);
  useEffect(() => {
    if (shown.current === key) return;
    shown.current = key;
    const node = ref.current;
    if (!node) return;
    const target =
      node.querySelector("[data-autofocus] textarea, [data-autofocus] input") || node.closest("section")?.querySelector("[data-step-heading]");
    target?.focus({ preventScroll: true });
  }, [key]);
  return ref;
}

/** Vaate teade all servas: tõrge hoiatava tooniga, muu rahulikult. */
export function footNote(notice, quiet = "") {
  if (!notice?.text) return quiet;
  return notice.tone === "risk" ? <span className={shared.footError}>{notice.text}</span> : notice.text;
}

/** Osa sees olevad vaated ühelaiuste lahtritena (sakid). Üksiku valiku korral rida ei ole. */
export function Cells({ label, options, value, onChange }) {
  if (options.length < 2) return null;
  return (
    <div className={styles.cells} data-count={options.length}>
      <ChoiceRow label={label} labelHidden options={options} value={value} onChange={onChange} columns={options.length} keepColumns />
    </div>
  );
}

export function Counter({ t, value, limit }) {
  const near = counterNear(value, limit);
  return near ? <span className={shared.counter}>{t("journey.labels.character_count", near)}</span> : null;
}

/** Märk: seis ühe sõnaga. Tühja teksti korral märki ei ole. */
export function Chip({ tone, children }) {
  if (!children) return null;
  return (
    <span className={shared.chip} data-tone={tone}>
      {children}
    </span>
  );
}

/** Inimese enda kirjutatud tekst: lõigud jäävad lõikudeks. */
export function OwnText({ text }) {
  return <p className={shared.own}>{text}</p>;
}

/** Sõnade read: nimetus ja väärtus. Tühja väärtusega rida ei joonistata. */
export function Facts({ items }) {
  const rows = items.filter((item) => item.value);
  if (!rows.length) return null;
  return (
    <div className={shared.facts}>
      {rows.map((item) => (
        <p key={item.key} className={shared.fact}>
          <span className={shared.factLabel}>{item.label}</span>
          <span className={shared.factValue}>{item.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Üherealine väli sildiga; väli on nii lai, kui sinna kirjutatav sisu vajab. */
export function LineField({ t, label, size, value, max, onChange, type = "text", autoFocus = false, hint, ...rest }) {
  const hintId = useId();
  return (
    <label className={shared.line} data-size={size} data-autofocus={autoFocus ? "" : undefined}>
      <span className={shared.fieldLabel}>{label}</span>
      <Input
        className={shared.input}
        type={type}
        value={value}
        maxLength={max}
        autoComplete="off"
        aria-describedby={hint ? hintId : undefined}
        onChange={(event) => onChange(event.target.value)}
        {...rest}
      />
      {hint ? (
        <span className={shared.small} id={hintId}>
          {hint}
        </span>
      ) : null}
      {max ? <Counter t={t} value={value} limit={max} /> : null}
    </label>
  );
}

/**
 * Tegevus, mis küsib teist vajutust SAMAL nupul; tagajärg seisab nupu kõrval.
 * Topeltklõps ja all hoitud klahv ei vii teist astet läbi, küsimus aegub.
 * Nuppu päringu ajaks välja ei lülitata (see viiks klaviatuuri fookuse ära);
 * topeltsaatmist hoiab kutsuja lukk.
 *
 * `danger`: pöördumatu tegu (kustutamine) hoiatava tooniga.
 */
export function TwoPress({ label, confirmLabel, cancelLabel, note, busy = false, busyLabel, onConfirm, danger = false, compact = false }) {
  const [armed, setArmed] = useState(false);
  const askedAt = useRef(0);
  const button = useRef(null);
  const noteId = useId();

  useEffect(() => {
    if (!armed) return undefined;
    const timer = window.setTimeout(() => setArmed(false), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);

  const press = async () => {
    if (busy) return;
    if (!armed) {
      askedAt.current = Date.now();
      setArmed(true);
      return;
    }
    if (pressTooSoon(askedAt.current)) return;
    setArmed(false);
    await onConfirm();
  };

  /* „Loobu" kaob koos küsimusega: fookus läheb tagasi samale nupule. */
  const withdraw = () => {
    setArmed(false);
    button.current?.focus({ preventScroll: true });
  };

  return (
    <div className={compact ? styles.confirmCompact : styles.confirm} data-armed={armed ? "1" : undefined} aria-busy={busy ? "true" : undefined}>
      <span className={styles.buttons}>
        <Button
          {...SMALL}
          ref={button}
          className={armed ? shared.armed : danger ? styles.danger : undefined}
          data-danger={danger ? "true" : undefined}
          aria-describedby={note ? noteId : undefined}
          onKeyDown={ignoreKeyRepeat}
          onClick={press}
        >
          {busy ? busyLabel || label : armed ? confirmLabel : label}
        </Button>
        {armed ? (
          <Button {...SMALL} onClick={withdraw}>
            {cancelLabel}
          </Button>
        ) : null}
      </span>
      {note ? (
        <p className={styles.confirmNote} id={noteId} data-armed={armed ? "1" : undefined}>
          {note}
        </p>
      ) : null}
    </div>
  );
}
