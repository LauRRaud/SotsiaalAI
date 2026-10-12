"use client";

/**
 * Kliendi lehe varude vaated.
 *
 * MIKS. Varud olid pika lehe keskel üks lõik: iga varu all seisu nupud, märkuse
 * nupp ja vorm, mis avanes rea sisse. Nüüd on ees üks asi korraga.
 *  - `SuppliesView`    jälgitavad varud: iga varu seis on üks puudutus; rida
 *                      avab varu
 *  - `SupplyView`      üks varu: märkus seisu juurde; jälgimise lõpetamine
 *                      küsib teist vajutust
 *  - `SupplyTrackView` uus jälgitav varu (hooldusjuht)
 *
 * Siin on ainult kuju. Otsused on failis ./supplyRows.js, olek ja päringud
 * konksus ./useClientSupplies.js, kokku paneb need ./ClientSupplies.jsx.
 * Kujundus: ./supplies.module.css ja organisatsioonide lehtede ühised osad
 * (../../org/org.module.css).
 */

import { PickOne, SMALL, footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";

import styles from "./supplies.module.css";

const BackButton = ({ back }) => (
  <Button {...SMALL} data-back="1" onClick={back.onBack}>
    {back.label}
  </Button>
);

/**
 * Jälgitavad varud.
 * `name`: kliendi nimi vaate ülaservas; `rows`: [{ key, name, state, chip, line, short, open }];
 * `states`: [{ value, label }] või null (inimene ei saa seisu märkida); `stateLabel(name)`: lahtrite rühma nimi;
 * `onMark(key, state)` salvestab seisu ühe puudutusega; `onOpen(key)` avab varu;
 * `empty`: lause, kui varusid ei jälgita; `hint`: vaikne rida all servas; `track`: { label, onTrack } või null.
 */
export function SuppliesView({ title, name, rows, states, stateLabel, onMark, onOpen, empty, hint, busy, notice, track }) {
  const head = (row) => (
    <>
      <span className={styles.main}>
        <span className={`${shared.rowTitle} ${styles.made}`}>{row.name}</span>
        {/* Lahtritega real on üks lühike rida (terve seis on varu vaates); ilma lahtriteta real kogu seis. */}
        <span className={`${states ? shared.rowSub : styles.sub} ${styles.made}`}>{states ? row.short : row.line}</span>
      </span>
      {/* Märk on rea enda teine veerg (mitte märkide rühm): telefonis jääb see nime kõrvale. */}
      {row.chip ? (
        <span className={shared.chip} data-tone="wait">
          {row.chip}
        </span>
      ) : null}
    </>
  );
  return (
    <StepPanel
      title={title}
      question={name}
      note={footNote(notice, hint)}
      actions={
        track ? (
          <Button {...SMALL} data-supplies="track" onClick={track.onTrack}>
            {track.label}
          </Button>
        ) : null
      }
    >
      {rows.length ? (
        <ul className={styles.supplies} aria-busy={busy ? "true" : undefined}>
          {rows.map((row) => (
            <li key={row.key} className={styles.supply} data-supply={row.key} data-plain={states ? undefined : "1"}>
              {row.open ? (
                <button type="button" className={shared.row} data-supply-open={row.key} onClick={() => onOpen(row.key)}>
                  {head(row)}
                </button>
              ) : (
                <div className={shared.rowStatic}>{head(row)}</div>
              )}
              {states ? (
                <div className={styles.states} role="radiogroup" aria-label={stateLabel(row.name)}>
                  {states.map((state) => (
                    <button
                      key={state.value}
                      type="button"
                      role="radio"
                      className={styles.state}
                      aria-checked={row.state === state.value}
                      data-supply-state={state.value}
                      onClick={() => onMark(row.key, state.value)}
                    >
                      {state.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className={shared.quiet}>{empty}</p>
      )}
    </StepPanel>
  );
}

/**
 * Üks varu. `chip`: lõppeva või otsa saanud varu märk; `lines`: märkus, kes märkis, kes täiendab;
 * `form`: { id, onSubmit }; `note`: { label, value, onChange, max } või null (seisu ei ole veel märgitud);
 * `save`: { label, busy } või null; `untrack`: { label, armed, onPress } või null (lõpetab hooldusjuht);
 * `consequence`: lause, mis juhtub (pärast esimest vajutust).
 */
export function SupplyView({ title, chip, lines, form, note, save, untrack, consequence, busy, notice, back }) {
  return (
    <StepPanel
      title={title}
      note={footNote(notice, consequence)}
      actions={
        <>
          <BackButton back={back} />
          {save ? (
            <Button type="submit" form={form.id} size="sm" variant="primary" data-supplies="save-note" aria-busy={save.busy ? "true" : undefined}>
              {save.label}
            </Button>
          ) : null}
        </>
      }
    >
      <form id={form.id} className={shared.stack} onSubmit={form.onSubmit} aria-busy={busy ? "true" : undefined}>
        <header className={shared.headBar}>
          <p className={`${shared.headName} ${styles.made}`}>{title}</p>
          {chip ? (
            <span className={shared.chip} data-tone="wait">
              {chip}
            </span>
          ) : null}
        </header>
        <div className={shared.facts}>
          {lines.map((line) => (
            <p key={line} className={`${shared.quiet} ${styles.made}`}>
              {line}
            </p>
          ))}
        </div>
        {note ? (
          <label className={`${shared.line} ${styles.note}`}>
            <span className={shared.fieldLabel}>{note.label}</span>
            <input className={shared.input} value={note.value} onChange={(event) => note.onChange(event.target.value)} maxLength={note.max} autoComplete="off" data-supply-field="note" />
          </label>
        ) : null}
        {untrack ? (
          <div className={shared.cells}>
            <button type="button" className={shared.cellButton} data-armed={untrack.armed ? "1" : undefined} data-supplies="untrack" onClick={untrack.onPress}>
              {untrack.label}
            </button>
          </div>
        ) : null}
      </form>
    </StepPanel>
  );
}

/**
 * Uus jälgitav varu. `kind`: { label, options, value, onChange } (varud, mida veel ei jälgita);
 * `responsible`: { label, hint, value, onChange, max }.
 */
export function SupplyTrackView({ title, form, kind, responsible, save, notice, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      note={footNote(notice, responsible.hint)}
      actions={
        <>
          <BackButton back={back} />
          <Button type="submit" form={form.id} size="sm" variant="primary" data-supplies="save" disabled={save.disabled} aria-busy={save.busy ? "true" : undefined}>
            {save.label}
          </Button>
        </>
      }
    >
      <form id={form.id} className={shared.stack} onSubmit={form.onSubmit} aria-busy={save.busy ? "true" : undefined}>
        <PickOne label={kind.label} options={kind.options} value={kind.value} onChange={kind.onChange} columns={2} />
        <label className={`${shared.line} ${styles.note}`}>
          <span className={shared.fieldLabel}>{responsible.label}</span>
          <input className={shared.input} value={responsible.value} onChange={(event) => responsible.onChange(event.target.value)} maxLength={responsible.max} autoComplete="off" required data-supply-field="responsible" />
        </label>
      </form>
    </StepPanel>
  );
}
