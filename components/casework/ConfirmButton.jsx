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
 *
 * KAKS VÄLIMUST, ÜKS LOOGIKA. Vana kihi sektsioonid (ettevalmistus, märge,
 * STAR2 järjekord) kasutavad vaikimisi `cw-*` nuppe. Sammulava vaated annavad
 * platvormi nupu (`as`, `buttonProps`) ja oma klassid: teine aste ja selle
 * nullimine jäävad samaks, muutub ainult see, mis nupp joonistatakse.
 */

import { useEffect, useState } from "react";

export default function ConfirmButton({
  label,
  confirmLabel,
  cancelLabel,
  onConfirm,
  disabled = false,
  className = "cw-button cw-button--danger",
  cancelClassName = "cw-button",
  as: Tag = "button",
  buttonProps = null
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (disabled) setArmed(false);
  }, [disabled]);

  /* Esimene ja teine aste on SAMA nupp, mille tekst vahetub. Varem joonistati
     teise astme jaoks uus nupp ja vajutatud nupp kadus: klaviatuuriga töötaja
     fookus kukkus lehe algusse täpselt selle teo ees, mis vajab tähelepanu. */
  return (
    <>
      <Tag
        {...buttonProps}
        className={className}
        type="button"
        disabled={disabled}
        onClick={async () => {
          if (!armed) {
            setArmed(true);
            return;
          }
          setArmed(false);
          await onConfirm();
        }}
      >
        {armed ? confirmLabel : label}
      </Tag>
      {armed ? (
        <Tag {...buttonProps} className={cancelClassName} type="button" disabled={disabled} onClick={() => setArmed(false)}>
          {cancelLabel}
        </Tag>
      ) : null}
    </>
  );
}
