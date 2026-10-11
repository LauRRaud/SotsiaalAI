"use client";

/**
 * Mentorlussuhte ja mentorluse halduse ühised tükid: avatavad read, lõpliku teo
 * nupp, avatud kirje tekst ja fookuse hoidmine, kui vaade vahetab oma sisu.
 *
 * MIKS. Mõlemal lehel on sama muster: loend, kust rida avab kirje, ja kirje,
 * kust saab loendisse tagasi. Kui sisu vahetub kohapeal, kaob vajutatud nupp ja
 * klaviatuuri fookus koos sellega; lõplik tegu (tühistamine, kustutamine,
 * tagasilükkamine) ei tohi käivituda ühest vajutusest ega topeltklõpsust.
 * Need kaks asja on siin üks kord.
 *
 * Kujundus: desk.module.css (siin kõrval); märk ja loendi kuju tulevad failist
 * ../entry/entry.module.css.
 */

import { useEffect, useRef } from "react";

import ConfirmButton from "@/components/casework/ConfirmButton";
import Button from "@/components/ui/Button";

import { Chip } from "../entry/EntryParts";
import entry from "../entry/entry.module.css";
import styles from "./desk.module.css";

export const SMALL_BUTTON = Object.freeze({ size: "sm", variant: "secondary" });
/* Lõpliku teo nupp kannab märget, mille järgi fookuse viimine selle vahele jätab. */
const DANGER_BUTTON = Object.freeze({ ...SMALL_BUTTON, "data-danger": "true" });

/**
 * Lõplik tegu platvormi nupuga. Esimene vajutus ei tee midagi peale selle, et
 * nupp küsib kinnitust. Topeltklõpsu ja all hoitud klahvi vastu kaitseb
 * `ConfirmButton`: teine vajutus loeb alles 400 ms pärast esimest ja
 * klahvikordus nuppu ei vajuta.
 */
export function TwoStep({ label, confirmLabel, cancelLabel, disabled, onConfirm }) {
  return (
    <ConfirmButton
      as={Button}
      buttonProps={DANGER_BUTTON}
      className={styles.danger}
      cancelClassName=""
      label={label}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      disabled={disabled}
      onConfirm={onConfirm}
    />
  );
}

/**
 * Kui vaade vahetab oma sisu (loend, avatud kirje, vorm) või avatud kirje seis
 * muutub, läheb fookus uue sisu esimesele väljale või nupule; kui seal midagi ei
 * ole, siis tegevusrea esimesele nupule ja viimaks vaate pealkirjale. Lõpliku
 * teo nupule (`data-danger`) fookust ei viida: all hoitud Enter jõuaks muidu
 * otse järgmise kirje tühistamiseni.
 *
 * `key` on see, mille muutumine tähendab uut sisu. Tagastab viite, mis pannakse
 * vahetuva sisu ümber.
 */
export function useSwapFocus(key) {
  const ref = useRef(null);
  const shown = useRef(key);
  useEffect(() => {
    if (shown.current === key) return;
    shown.current = key;
    const node = ref.current;
    if (!node) return;
    const panel = node.closest("section");
    /* Valikurühmas on tabulatsioonis üks lahter; teised jäävad vahele. */
    const target =
      node.querySelector('textarea:not(:disabled), input:not(:disabled), button:not(:disabled):not([tabindex="-1"]):not([data-danger])') ||
      panel?.querySelector("footer button:not(:disabled):not([data-danger])") ||
      panel?.querySelector("[data-step-heading]");
    target?.focus({ preventScroll: true });
  }, [key]);
  return ref;
}

/** Lähim keriv vanem (halduse lehel klaaspaneeli sisu). */
export function scrollerOf(start) {
  let node = start?.parentElement || null;
  while (node && node !== document.documentElement) {
    const overflowY = window.getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Avatavad read: pealkiri ja tekst vasakul, seis märgina, tee edasi paremal.
 * Üks rida, üks tegevus: rida avab kirje ja kõik muu on avatud kirjes.
 * `rows`: [{ id, title?, text?, chip?, tone?, extra?, time? }]
 */
export function OpenRows({ rows, openText, onOpen }) {
  return (
    <ul className={entry.rows}>
      {rows.map((row) => (
        <li key={row.id} className={entry.rowItem}>
          <button type="button" className={styles.rowButton} data-row={row.id} onClick={() => onOpen(row.id)}>
            <span className={entry.rowMain}>
              {row.title ? <span className={entry.rowTitle}>{row.title}</span> : null}
              {row.text ? <span className={row.title ? styles.rowLine : styles.rowText}>{row.text}</span> : null}
            </span>
            <span className={entry.rowMeta}>
              <Chip tone={row.tone}>{row.chip}</Chip>
              <Chip tone="quiet">{row.extra}</Chip>
              {row.time ? <span className={entry.time}>{row.time}</span> : null}
            </span>
            <span className={entry.rowOpen} aria-hidden="true">
              {openText} ›
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Avatud kirje tekst tervikuna: reavahetused jäävad alles. Tekst on tekst, mitte märgistus. */
export function FullText({ children }) {
  return children ? <p className={entry.text}>{children}</p> : null;
}
