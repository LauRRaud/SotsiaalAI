"use client";

/**
 * Organisatsioonide lehtede ühised väikesed osad: vaate teade all servas,
 * sõnade read (nimetus ja väärtus) ja nupp, mis küsib teist vajutust.
 * Kujundus: ./org.module.css.
 */

import ChoiceRow from "@/components/stage/ChoiceRow";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";

import shared from "./org.module.css";

/** Väikese kõrvaltegevuse nupu kuju. */
export const SMALL = Object.freeze({ type: "button", size: "sm", variant: "secondary" });

/* All hoitud Enter või tühik (klahvikordus) ei tohi sama nuppu teist korda
   vajutada: esimene ja teine aste on sama nupp. */
export function ignoreKeyRepeat(event) {
  if (event.repeat && (event.key === "Enter" || event.key === " ")) event.preventDefault();
}

/** Vaate teade all servas: tõrge hoiatava tooniga, muu rahulikult. */
export function footNote(notice, quiet = "") {
  if (!notice?.text) return quiet;
  return notice.tone === "risk" ? <span className={shared.footError}>{notice.text}</span> : notice.text;
}

/**
 * Sõnade read: `rows` on `[{ key, label, value, quiet? }]`. Tühja väärtusega
 * rida jääb välja (tühja rida ega kriipsu ei näidata).
 */
export function Facts({ rows, busy = false }) {
  return (
    <div className={shared.facts} aria-busy={busy ? "true" : undefined}>
      {rows
        .filter((row) => row.value)
        .map((row) => (
          <p key={row.key} className={shared.fact}>
            <span className={shared.factLabel}>{row.label}</span>
            <span className={shared.factValue} data-quiet={row.quiet ? "1" : undefined}>
              {row.value}
            </span>
          </p>
        ))}
    </div>
  );
}

/**
 * Nupp, mis küsib teist vajutust samal nupul: pärast esimest vajutust on sõnad
 * teised (`confirm`) ja raam tugevam. Tagajärje lause ütleb vaade ise (all servas).
 */
export function ArmedButton({ armed, label, confirm, onPress, busy = false, mark }) {
  return (
    <Button
      {...SMALL}
      className={armed ? shared.armed : undefined}
      data-armed-button={mark}
      aria-busy={busy ? "true" : undefined}
      onKeyDown={ignoreKeyRepeat}
      onClick={onPress}
    >
      {armed ? confirm : label}
    </Button>
  );
}

/* Kuni nii palju variante on korraga näha lahtritena; rohkem läheb rippvalikusse. */
const PICK_CELLS_MAX = 6;

/**
 * Üks valik organisatsiooni enda andmetest (üksus, liige), mille pikkust ette ei
 * tea. Kuni kuus varianti on ühelaiused lahtrid (kõik kohe näha, kaks rida), pikem
 * loend on platvormi rippvalik: kolmkümmend lahtrit ei mahuks ühtegi vaatesse.
 */
export function PickOne({ label, options, value, onChange, columns = 3, disabled = false }) {
  if (options.length <= PICK_CELLS_MAX) {
    return <ChoiceRow label={label} options={options} value={value} onChange={onChange} columns={columns} keepColumns disabled={disabled} />;
  }
  return (
    <label className={shared.line}>
      <span className={shared.fieldLabel}>{label}</span>
      <Dropdown value={value} onChange={onChange} ariaLabel={label} options={options} disabled={disabled} />
    </label>
  );
}
