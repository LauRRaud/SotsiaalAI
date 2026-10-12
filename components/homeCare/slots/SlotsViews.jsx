"use client";

/**
 * Kliendi lehe käikude vaated.
 *
 * MIKS. Käigud olid pika lehe keskel üks lõik, mille all seisis kohe ka
 * prinditavate lehtede vorm. Nüüd on ees üks asi korraga.
 *  - `SlotsView`  kas eile ja täna käidi; korduvad käigud nädalapäevade kaupa
 *  - `SheetsView` lehed kliendi koju (külmkapileht, kuuleht): asutuse telefon
 *                 ja lehe valik
 *
 * Siin on ainult kuju. Otsused on failis ./slotRows.js, olek ja päringud
 * konksus ./useClientSheets.js, kokku paneb need ./ClientSlots.jsx. Kujundus:
 * ./slots.module.css ja organisatsioonide lehtede ühised osad
 * (../../org/org.module.css).
 */

import { Facts, SMALL, footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";

import styles from "./slots.module.css";

/**
 * Käigud.
 * `name`: kliendi nimi vaate ülaservas; `recent`: [{ key, label, value }] (eile ja täna);
 * `caption`: korduvate käikude pealkiri; `days`: [{ key, name, rows: [{ key, line, inactive }] }];
 * `empty`: lause, kui korduvaid käike ei ole; `inactive`: märgi sõnad (töötaja liikmesus ei kehti);
 * `sheets`: { label, onOpen } või null (lehed kliendi koju);
 * `edit`: { label, href } või null (käike muudab hooldusjuht).
 */
export function SlotsView({ title, name, recent, caption, days, empty, inactive, sheets, edit }) {
  return (
    <StepPanel
      title={title}
      question={name}
      actions={
        sheets || edit ? (
          <>
            {sheets ? (
              <Button {...SMALL} data-slots="sheets" onClick={sheets.onOpen}>
                {sheets.label}
              </Button>
            ) : null}
            {edit ? (
              <Button as="a" href={edit.href} size="sm" variant="secondary" data-slots="edit">
                {edit.label}
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      <div className={shared.stack}>
        {recent.length ? <Facts rows={recent} inline /> : null}
        <section className={shared.group} aria-label={caption}>
          <p className={styles.caption}>{caption}</p>
          {days.length ? (
            <ul className={styles.days}>
              {days.map((day) => (
                <li key={day.key} className={styles.day} data-slot-day={day.key}>
                  <span className={styles.dayName}>{day.name}</span>
                  <span className={styles.daySlots}>
                    {day.rows.map((row) => (
                      <span key={row.key} className={styles.slot} data-slot={row.key}>
                        <span>{row.line}</span>
                        {row.inactive ? (
                          <span className={shared.chip} data-tone="wait">
                            {inactive}
                          </span>
                        ) : null}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={shared.quiet}>{empty}</p>
          )}
        </section>
      </div>
    </StepPanel>
  );
}

/**
 * Lehed kliendi koju: leht avaneb uues aknas ja prinditakse brauserist.
 * `phone`: { label, value, onChange, max } (asutuse telefon lehele; jääb sellesse seadmesse meelde);
 * `choices`: [{ key, label, onPress }] (mis leht avada); `hints`: selgitused;
 * `busy`: päring on teel; `notice`: { text, tone } või null; `back`: { label, onBack }.
 */
export function SheetsView({ title, phone, choices, hints, busy, notice, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      note={footNote(notice)}
      actions={
        <Button {...SMALL} data-back="1" onClick={back.onBack}>
          {back.label}
        </Button>
      }
    >
      <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
        <label className={`${shared.line} ${styles.phone}`}>
          <span className={shared.fieldLabel}>{phone.label}</span>
          <input
            className={shared.input}
            type="tel"
            value={phone.value}
            onChange={(event) => phone.onChange(event.target.value)}
            maxLength={phone.max}
            autoComplete="off"
            data-sheets="phone"
          />
        </label>
        <div className={shared.cells} role="group" aria-label={title}>
          {choices.map((choice) => (
            <button key={choice.key} type="button" className={shared.cellButton} data-sheet={choice.key} onClick={choice.onPress}>
              {choice.label}
            </button>
          ))}
        </div>
        {hints.map((hint) => (
          <p key={hint} className={shared.small}>
            {hint}
          </p>
        ))}
      </div>
    </StepPanel>
  );
}
