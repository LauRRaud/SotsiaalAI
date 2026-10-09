"use client";

/**
 * TextAreaField — vabatekst sildi ja vihjega.
 *
 * Silt on väljaga seotud (`htmlFor`), vihje on väljale kirjelduseks
 * (`aria-describedby`). `lines` teeb väljast loendi: üks rida on üks kirje
 * (kasutus: ülesannete loendid), `onChange` annab siis massiivi. Tühi rida jääb
 * kirjutamise ajal alles (muidu ei saaks uut rida alustada); kutsuja puhastab
 * loendi enne salvestamist (`cleanLines` failis `lines.js`).
 * `labelHidden`: silt on ainult ekraanilugejale (sammu pealkiri ütleb sama).
 *
 * Kujundus: TextAreaField.module.css. Väli ise on platvormi `Textarea`.
 */

import { useId } from "react";

import Textarea from "@/components/ui/Textarea";

import styles from "./TextAreaField.module.css";

const toLines = (value) => (Array.isArray(value) ? value.join("\n") : String(value || ""));
const fromLines = (text) => String(text || "").split("\n");

export default function TextAreaField({
  label,
  hint,
  value,
  onChange,
  lines = false,
  rows = 4,
  maxLength,
  labelHidden = false,
  disabled = false
}) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label className={labelHidden ? "sr-only" : styles.label} htmlFor={id}>
        {label}
      </label>
      {hint ? (
        <span className={styles.hint} id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
      <Textarea
        id={id}
        className={styles.input}
        value={lines ? toLines(value) : value || ""}
        onChange={(event) => onChange?.(lines ? fromLines(event.target.value) : event.target.value)}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
    </div>
  );
}
