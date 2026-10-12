"use client";

/**
 * „Enne kui lähed" vaated.
 *
 * MIKS. Kaart oli ukse taga lehe sees: iga rea juures nupp „Muuda", vorm avanes
 * rea sisse ja „Lisa rida" selle alla. Nüüd on ees üks asi korraga.
 *  - `CardView`     kaardi read (liik ja tekst); muutja avab rea ja lisab uue
 *  - `CardLineView` üks rida: liik, tekst ja märk; muutmine ja eemaldamine
 *                   (eemaldamine küsib teist vajutust)
 *  - `CardFormView` rea vorm: liik, tekst ja kas rida läheb transpordikaardile
 *
 * Siin on ainult kuju. Otsused on failis ./cardRows.js, olek ja päringud
 * konksus ./useClientCard.js, kokku paneb need ./ClientCard.jsx. Kujundus:
 * ./card.module.css ja organisatsioonide lehtede ühised osad
 * (../../org/org.module.css).
 */

import { PickOne, SMALL, footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";

import styles from "./card.module.css";

const BackButton = ({ back }) => (
  <Button {...SMALL} data-back="1" onClick={back.onBack}>
    {back.label}
  </Button>
);

/** Märk. `chip`: { text, tone } või null. */
const Chip = ({ chip }) =>
  chip ? (
    <span className={shared.chip} data-tone={chip.tone || undefined}>
      {chip.text}
    </span>
  ) : null;

/** Rea sisu: liik (ja märk) ning selle all tekst täies pikkuses. `row`: { kind, risk, text, chip }. */
const Line = ({ row }) => (
  <span className={styles.main}>
    <span className={styles.who}>
      <span className={row.risk ? `${shared.rowTitle} ${styles.risk}` : shared.rowTitle}>{row.kind}</span>
      <Chip chip={row.chip} />
    </span>
    <span className={styles.sub}>{row.text}</span>
  </span>
);

/**
 * Kaardi read.
 * `rows`: [{ key, kind, risk, text, chip }]; `open`: true, kui rida avab muutmise (muud read on loetavad);
 * `onOpen(key)`; `empty`: lause, kui kaardil ei ole midagi; `limit`: lause, kui kaart on täis (vaikne rida all servas);
 * `add`: { label, onAdd } või null; `back`: { label, onBack } (tagasi ukse taha).
 */
export function CardView({ title, rows, open, onOpen, empty, limit, busy, notice, add, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      note={footNote(notice, limit)}
      actions={
        <>
          <BackButton back={back} />
          {add ? (
            <Button type="button" size="sm" variant="primary" data-card="add" onClick={add.onAdd}>
              {add.label}
            </Button>
          ) : null}
        </>
      }
    >
      <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
        {rows.length ? (
          <ul className={shared.rows}>
            {rows.map((row) => (
              <li key={row.key} className={shared.rowItem}>
                {open ? (
                  <button type="button" className={`${shared.row} ${styles.line}`} data-card-row={row.key} onClick={() => onOpen(row.key)}>
                    <Line row={row} />
                  </button>
                ) : (
                  <div className={`${shared.rowStatic} ${styles.line}`} data-card-row={row.key}>
                    <Line row={row} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className={shared.quiet}>{empty}</p>
        )}
      </div>
    </StepPanel>
  );
}

/**
 * Üks rida. `row`: { kind, risk, text, chip }; `actions`: [{ key, label, armed, onPress }]
 * (eemaldamine küsib teist vajutust samal lahtril); `consequence`: lause, mis juhtub (pärast esimest vajutust).
 */
export function CardLineView({ title, row, actions, consequence, busy, notice, back }) {
  return (
    <StepPanel title={title} note={footNote(notice, consequence)} actions={<BackButton back={back} />}>
      <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
        <header className={shared.headBar}>
          <p className={row.risk ? `${shared.headName} ${styles.risk}` : shared.headName}>{row.kind}</p>
          <Chip chip={row.chip} />
        </header>
        <p className={shared.own} data-card="text">
          {row.text}
        </p>
        <div className={shared.cells} role="group" aria-label={row.kind}>
          {actions.map((action) => (
            <button key={action.key} type="button" className={shared.cellButton} data-armed={action.armed ? "1" : undefined} data-card-action={action.key} onClick={action.onPress}>
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </StepPanel>
  );
}

/**
 * Rea vorm. `form`: { id, onSubmit }; `kind`: { label, options, value, onChange };
 * `text`: { label, value, onChange, max }; `driver`: { label, checked, onChange } (rida läheb transpordikaardile);
 * `save`: { label, busy, disabled }.
 */
export function CardFormView({ title, form, kind, text, driver, save, notice, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      note={footNote(notice)}
      actions={
        <>
          <BackButton back={back} />
          <Button type="submit" form={form.id} size="sm" variant="primary" data-card="save" disabled={save.disabled} aria-busy={save.busy ? "true" : undefined}>
            {save.label}
          </Button>
        </>
      }
    >
      <form id={form.id} className={shared.stack} onSubmit={form.onSubmit} aria-busy={save.busy ? "true" : undefined}>
        <PickOne label={kind.label} options={kind.options} value={kind.value} onChange={kind.onChange} />
        <label className={`${shared.line} ${styles.wide}`}>
          <span className={shared.fieldLabel}>{text.label}</span>
          <input className={shared.input} value={text.value} onChange={(event) => text.onChange(event.target.value)} maxLength={text.max} required autoComplete="off" data-card-field="text" />
        </label>
        {/* „Nähtav autojuhile" (K5-y): rida läheb transpordikaardile; muud read sinna ei lähe. */}
        <Checkbox className={styles.check} label={driver.label} checked={driver.checked} onChange={driver.onChange} data-card-field="driver" />
      </form>
    </StepPanel>
  );
}
