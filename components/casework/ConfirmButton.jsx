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

import { useEffect, useRef, useState } from "react";

/* Lühim vahe esimese ja teise vajutuse vahel: topeltklõps on alla selle. */
const MIN_GAP_MS = 400;
/* Kinnituse ootus aegub. Laval jääb osa lehele ka siis, kui inimene teise osa
   avab: ilma aegumiseta oleks nupp hiljem tagasi tulles ikka relvastatud ja üks
   vajutus viiks lõpliku teo läbi. Sama aeg mis mentorluse avalehtedel. */
const CONFIRM_MS = 8000;

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
  const armedAt = useRef(0);

  useEffect(() => {
    if (disabled) setArmed(false);
  }, [disabled]);

  useEffect(() => {
    if (!armed) return undefined;
    const timer = window.setTimeout(() => setArmed(false), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);

  /* Esimene ja teine aste on SAMA nupp, mille tekst vahetub: fookus jääb
     nupule. Just seepärast ei tohi üks liigutus mõlemat astet läbida: all
     hoitud Enter (klahvikordus) ja topeltklõps jõuaksid samale nupule kaks
     korda. Klahvikordus ei vajuta nuppu ja kinnitus, mis tuleb vähem kui
     MIN_GAP_MS pärast esimest vajutust, jäetakse vahele. */
  return (
    <>
      <Tag
        {...buttonProps}
        className={className}
        type="button"
        disabled={disabled}
        onKeyDown={(event) => {
          if (event.repeat && (event.key === "Enter" || event.key === " ")) event.preventDefault();
        }}
        onClick={async () => {
          if (!armed) {
            armedAt.current = Date.now();
            setArmed(true);
            return;
          }
          if (Date.now() - armedAt.current < MIN_GAP_MS) return;
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
