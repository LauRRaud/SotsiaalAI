"use client";

/**
 * Pöördumatu teo kaheastmeline nupp.
 *
 * MIKS OMA KOMPONENT, MITTE `window.confirm`: brauseri dialoog ei ole tõlgitav,
 * ei kanna meie sõnastust ega ütle, MIS täpselt kaob — ja teda ei saa testida.
 * Siin on tekst i18n-võtmest ja teine aste on päris DOM, mille test leiab.
 *
 * MIKS KAHEASTMELINE, MITTE „võta tagasi" teade: casework'i kustutused on
 * PÄRIS kustutused (kliendiviide ei tule tagasi ka konto kustutamise rajalt,
 * märkme kirjet ei auditeerita). Tagasivõtuaken lubaks midagi, mida meil ei ole
 * — ja lubadus, mille taga ei ole mehhanismi, on halvem kui küsimus.
 *
 * TEINE ASTE NULLITAKSE, kui nupp keelatakse (nt kirjutuskaitse jõustub või
 * eelmine päring käib): muidu jääks „kinnita" ripakile ja järgmine klõps
 * käivitaks teo, mille kasutaja juba unustas.
 */

import { useEffect, useState } from "react";

export default function ConfirmButton({
  label,
  confirmLabel,
  cancelLabel,
  onConfirm,
  disabled = false,
  className = "cw-button cw-button--danger"
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (disabled) setArmed(false);
  }, [disabled]);

  if (!armed) {
    return (
      <button className={className} type="button" disabled={disabled} onClick={() => setArmed(true)}>
        {label}
      </button>
    );
  }

  return (
    <>
      <button
        className={className}
        type="button"
        disabled={disabled}
        onClick={async () => {
          setArmed(false);
          await onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button className="cw-button" type="button" disabled={disabled} onClick={() => setArmed(false)}>
        {cancelLabel}
      </button>
    </>
  );
}
