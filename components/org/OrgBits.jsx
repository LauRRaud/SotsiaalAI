"use client";

/**
 * Organisatsioonide lehtede ühised väikesed osad: vaate teade all servas,
 * sõnade read (nimetus ja väärtus) ja nupp, mis küsib teist vajutust.
 * Kujundus: ./org.module.css.
 */

import Button from "@/components/ui/Button";

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
