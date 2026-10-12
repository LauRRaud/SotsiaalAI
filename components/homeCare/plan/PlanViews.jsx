"use client";

/**
 * Kliendi lehe hoolduskava vaade.
 *
 * MIKS. Kehtiv kava on see, mille järgi hooldaja ukse taga töötab: mida siin
 * tehakse, kui sageli ja kuidas. Vanal lehel oli see üks lõik pika lehe keskel;
 * nüüd on see omaette vaade, kus iga toiming on üks rida ja ridu ei lõigata.
 *  - `PlanView` ülal kliendi nimi, kava number ja ülevaatuse päev; eesmärgid,
 *               toimingud koduabi ja isikuabi kaupa, märkus; kava all read, mis
 *               ütlevad, kas kava vastab sellele, mis kohapeal toimub
 *
 * Siin on ainult kuju. Otsused on failis ./planRows.js, andmed lehel
 * (`../HomeCareClientPage.jsx`). Kujundus: ./plan.module.css ja
 * organisatsioonide lehtede ühised osad (../../org/org.module.css).
 */

import shared from "@/components/org/org.module.css";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";

import styles from "./plan.module.css";

/**
 * Kehtiv hoolduskava.
 * `name`: kliendi nimi vaate ülaservas;
 * `sheet`: { goals, groups: [{ key, title, rows: [{ key, name, must, how, note }] }], note, foot } või null (kava ei ole);
 * `labels`: { goals, must }; `empty`: lause, kui kava ei ole;
 * `signals`: [{ key, text, wait }] (read kava all; rida, mis ei oota midagi, on vaikne lause all servas);
 * `edit`: { label, href } või null (kava muutmine on hooldusjuhi teha).
 */
export function PlanView({ title, name, sheet, labels, empty, signals, edit }) {
  return (
    <StepPanel
      title={title}
      note={signals
        .filter((signal) => !signal.wait)
        .map((signal) => signal.text)
        .join(" ")}
      actions={
        edit ? (
          <Button as="a" href={edit.href} size="sm" variant="secondary" data-plan="edit">
            {edit.label}
          </Button>
        ) : null
      }
    >
      <div className={shared.stack}>
        <header className={shared.headBar}>
          <p className={shared.headName}>{name}</p>
          {sheet?.foot ? (
            <p className={`${shared.small} ${styles.made}`} data-plan="meta">
              {sheet.foot}
            </p>
          ) : null}
        </header>
        {sheet ? (
          <>
            {sheet.goals ? (
              <section className={shared.group} data-plan="goals" aria-label={labels.goals}>
                <p className={styles.caption}>{labels.goals}</p>
                <p className={shared.own}>{sheet.goals}</p>
              </section>
            ) : null}
            {/* Laiemal pinnal on koduabi ja isikuabi kõrvuti: paneel on lai ja madal. */}
            <div className={styles.domains} data-cols={sheet.groups.length > 1 ? "2" : undefined}>
              {sheet.groups.map((group) => (
                <section key={group.key} className={shared.group} data-plan-group={group.key} aria-label={group.title}>
                  <p className={styles.caption}>{group.title}</p>
                  <ul className={styles.lines}>
                    {group.rows.map((row) => (
                      <li key={row.key} className={styles.line} data-plan-line={row.key}>
                        <span className={styles.name}>{row.name}</span>
                        {row.must ? (
                          <span className={shared.chip} data-tone="wait">
                            {labels.must}
                          </span>
                        ) : null}
                        <span className={styles.how}>{row.how}</span>
                        {row.note ? <span className={styles.lineNote}>{row.note}</span> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            {sheet.note ? (
              <p className={shared.own} data-plan="note">
                {sheet.note}
              </p>
            ) : null}
          </>
        ) : (
          <p className={shared.quiet}>{empty}</p>
        )}
        {signals
          .filter((signal) => signal.wait)
          .map((signal) => (
            <p key={signal.key} className={shared.notice} data-plan-signal={signal.key}>
              {signal.text}
            </p>
          ))}
      </div>
    </StepPanel>
  );
}
