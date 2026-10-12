"use client";

/**
 * Kliendi lehe otsuse ja mahu vaade.
 *
 * MIKS. Täna kehtiv otsus, osutatud aeg ja püsivuse näit olid pika lehe keskel
 * üks lõik punktidega eraldatud ridadest. Nüüd on see omaette vaade, kus iga
 * asi on oma real nimetuse ja väärtusega.
 *  - `DecisionView` otsus (liik, number, otsustaja; kehtivus, maht, tasu,
 *                   allkiri), selle all osutatud aeg sel nädalal ja sel kuul;
 *                   all servas, mitu töötajat siin viimasel ajal käis
 *
 * Siin on ainult kuju. Otsused on failis ./decisionRows.js, andmed lehel
 * (`../HomeCareClientPage.jsx`). Kujundus: ./decision.module.css ja
 * organisatsioonide lehtede ühised osad (../../org/org.module.css).
 */

import { Facts } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";

import styles from "./decision.module.css";

/**
 * Täna kehtiv otsus ja otsustatud maht.
 * `name`: kliendi nimi vaate ülaservas;
 * `sheet`: { head, chips: [{ key, text, wait }], facts: [{ key, label, value, quiet }], note } või null (otsust ei ole);
 * `empty`: lause, kui otsust ei ole; `provided`: [{ key, text }] (osutatud aeg);
 * `continuity`: lause, mitu töötajat siin käis (vaikne rida all servas);
 * `edit`: { label, href } või null (otsuseid haldab hooldusjuht).
 */
export function DecisionView({ title, name, sheet, empty, provided, continuity, edit }) {
  const providedLines = provided.length ? (
    <div className={shared.facts} data-decision="provided">
      {provided.map((line) => (
        <p key={line.key} className={`${shared.quiet} ${styles.line}`}>
          {line.text}
        </p>
      ))}
    </div>
  ) : null;
  return (
    <StepPanel
      title={title}
      question={name}
      note={continuity}
      actions={
        edit ? (
          <Button as="a" href={edit.href} size="sm" variant="secondary" data-decision="edit">
            {edit.label}
          </Button>
        ) : null
      }
    >
      <div className={shared.stack}>
        {sheet ? (
          <>
            <div className={styles.head}>
              <p data-decision="head">{sheet.head}</p>
              {sheet.chips.length ? (
                <span className={styles.chips}>
                  {sheet.chips.map((chip) => (
                    <span key={chip.key} className={shared.chip} data-tone={chip.wait ? "wait" : undefined}>
                      {chip.text}
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
            {/* Laiemal pinnal on otsuse read vasakul ja osutatud aeg nende kõrval: paneel on lai ja madal. */}
            <div className={styles.cols}>
              <Facts rows={sheet.facts} />
              {providedLines}
            </div>
            {sheet.note ? (
              <p className={shared.own} data-decision="note">
                {sheet.note}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className={shared.quiet}>{empty}</p>
            {providedLines}
          </>
        )}
      </div>
    </StepPanel>
  );
}
