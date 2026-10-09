"use client";

/**
 * Teenuseprofiili vaadete ühised tükid: üherealine väli, tekstiväli, märgitav
 * valikurühm, märk, teade, loendirida ja paneeli alumise serva olekurida.
 *
 * MÄRKIDE LOENDUR on vaikne rida kohe oma välja all (kujundusaudit K08: vanal
 * lehel seisis „12 / 1000" järgmise välja sildi küljes ja luges nagu selle
 * osa). Väljade vahe on loenduri ja järgmise sildi vahel selgelt suurem kui
 * välja ja tema loenduri vahel.
 *
 * Siin ei ole olekut ega päringuid: kõik tuleb lehelt
 * (`ServiceProfileSurface` failis ../WorkspaceFeaturePage.jsx).
 *
 * Kujundus: profile.module.css (siin kõrval); ehitusklotsid kaustast components/stage.
 */

import { useId } from "react";

import ChoiceChips from "@/components/stage/ChoiceChips";
import TextAreaField from "@/components/stage/TextAreaField";
import Input from "@/components/ui/Input";
import { SERVICE_PROFILE_LIMITS } from "@/lib/serviceProviderProfileLimits";

import { optionsWithSelected, splitList, toggleListValue } from "./profileModel";
import styles from "./profile.module.css";

const lengthOf = (value) => (typeof value === "string" ? value.length : 0);

/** Märkide loendur: vaikne rida välja all. */
function Counter({ id, value, max }) {
  return (
    <span className={styles.counter} id={id}>
      {lengthOf(value)} / {max}
    </span>
  );
}

/** Üherealine väli sildi, vihje ja loenduriga. `size` ütleb, kui lai sisu on (sm, lg). */
export function LineField({ label, hint, value, onChange, size, type, maxLength = SERVICE_PROFILE_LIMITS.shortText, placeholder, autoComplete, onFocus }) {
  const id = useId();
  return (
    <div className={styles.field} data-size={size}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}
      </label>
      <Input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        describedBy={hint ? `${id}-hint ${id}-count` : `${id}-count`}
        onFocus={onFocus}
        onChange={(event) => onChange?.(event.target.value)}
      />
      <Counter id={`${id}-count`} value={value} max={maxLength} />
      {hint ? (
        <span className={styles.fieldHint} id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** Mitmerealine tekst loenduriga (väli ise on `TextAreaField`). */
export function TextField({ label, hint, value, onChange, rows = 3, maxLength = SERVICE_PROFILE_LIMITS.text }) {
  return (
    <div className={styles.counted}>
      <TextAreaField label={label} hint={hint} value={value} rows={rows} maxLength={maxLength} onChange={onChange} />
      <Counter value={value} max={maxLength} />
    </div>
  );
}

/**
 * Mitu valikut korraga. Vormis on väärtus komadega tekst (nii nagu see serverist
 * tuli); lahtrid on ühelaiused ja märgitud lahter on kohe näha, seepärast ei
 * ole all enam eraldi rida „Valitud: …".
 */
export function ChipsField({ label, hint, value, options, onChange }) {
  return (
    <ChoiceChips
      label={label}
      hint={hint}
      options={optionsWithSelected(options, value)}
      values={splitList(value)}
      onToggle={(option) => onChange(toggleListValue(value, option))}
    />
  );
}

/** Seisu märk loendireal. */
export function Chip({ tone, children }) {
  return (
    <span className={styles.chip} data-tone={tone}>
      {children}
    </span>
  );
}

/** Teade vaate sees. `aria-live`, mitte status-roll: ühine lehekiht joonistab iga status-rolliga elemendi kastina. */
export function Notice({ tone, alert = false, children }) {
  if (!children) return null;
  return (
    <p className={styles.notice} data-tone={tone} role={alert ? "alert" : undefined} aria-live={alert ? undefined : "polite"}>
      {children}
    </p>
  );
}

/** Loendirida: pealkiri, märgid ja tee edasi. Terve rida on üks vajutatav lahter. */
export function ItemRow({ title, meta, chips = [], openText, onOpen }) {
  return (
    <li className={styles.item}>
      <button type="button" className={styles.row} onClick={onOpen}>
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{title}</span>
          {meta ? <span className={styles.rowMeta}>{meta}</span> : null}
        </span>
        <span className={styles.rowChips}>
          {chips.map((chip) => (
            <Chip key={chip.key} tone={chip.tone}>
              {chip.text}
            </Chip>
          ))}
        </span>
        <span className={styles.rowOpen} aria-hidden="true">
          {openText} ›
        </span>
      </button>
    </li>
  );
}

/**
 * Paneeli alumise serva olekurida (`StepPanel note`): kus ma olen (avatud
 * teenuse või koha nimi ja tee tagasi loendisse), mis seisus on salvestamine ja
 * vajadusel tee vaatesse, kus puuduv asi parandada.
 */
export function footNote({ crumb, text, go }) {
  if (!crumb && !text && !go) return "";
  return (
    <span className={styles.footNote}>
      {crumb ? (
        <>
          <button type="button" className={styles.textButton} aria-label={crumb.backLabel} onClick={crumb.onBack}>
            ‹ {crumb.list}
          </button>
          <span className={styles.crumbName}>{crumb.name}</span>
        </>
      ) : null}
      {text ? <span>{text}</span> : null}
      {go ? (
        <button type="button" className={styles.textButton} onClick={go.onClick}>
          {go.label} ›
        </button>
      ) : null}
    </span>
  );
}
