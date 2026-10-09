"use client";

/**
 * Isikliku paki vaated: kogu paki sissejuhatus ja üks külmutatud tekst.
 *
 * MIKS. Paki leht oli üks pikk veerg teise klaaskasti sees: kontrakt ja kõik
 * kokkuvõtted üksteise all kastides. Nüüd avaneb pakk sisukorrana (plaat iga
 * teksti kohta) ja iga tekst on omaette vaade sammulaval (`components/stage`):
 * üks vaade, üks tekst.
 *
 *  - `PackLead`      kogu paki vaate kohal: paki nimi, kes seda näeb, mis see on
 *  - `PackTextView`  kinnitatud kontrakt või üks kinnitatud kokkuvõte
 *
 * Sisu on KÜLMUTATUD koopia sulgemishetkest: siin ei ole ühtegi muutmisteed.
 * Privaatsusmärk on püsielement igas vaates, mis kannab sisu.
 *
 * Siin on ainult kuju. Päring on failis ../SupervisionOutcomePage.jsx, osad
 * teeb ./entryRows.js (`packParts`).
 *
 * Kujundus: entry.module.css (siin kõrval).
 */

import StepPanel from "@/components/stage/StepPanel";

import PrivacyBadge from "../PrivacyBadge";
import styles from "./entry.module.css";

/** `note`: mis pakist puudub (nt kokkuvõtteid ei ole). `back`: tee pakkide loendisse. */
export function PackLead({ t, title, note, back }) {
  return (
    <div className={styles.packLead}>
      <p className={styles.name}>{title}</p>
      <p className={styles.line}>
        <PrivacyBadge scope="private" />
      </p>
      <p className={styles.lead}>{t("supervision.outcome.intro")}</p>
      {note ? <p className={styles.quiet}>{note}</p> : null}
      {back}
    </div>
  );
}

/**
 * `part`: { label, meta, body } (vt `packParts`). Vaate nime paneelil ei korrata:
 * see on kiirmenüüs ja kõigi osade vaate plaadil. Paneelil on kinnitamise kuupäev
 * ja privaatsusmärk.
 */
export function PackTextView({ part }) {
  return (
    <StepPanel title={part.label}>
      <div className={styles.stack}>
        <p className={styles.line}>
          {part.meta ? <span className={styles.time}>{part.meta}</span> : null}
          <PrivacyBadge scope="private" />
        </p>
        <p className={styles.text}>{part.body}</p>
      </div>
    </StepPanel>
  );
}
