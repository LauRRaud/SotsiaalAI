"use client";

/**
 * „Kui uks ei avane" vaated.
 *
 * MIKS. See oli ukse taga lehe sees üks lõik, mis vahetas oma sisu: sammude
 * loend, sammude tekstiala ja märkimise vorm (hädaabi lause, kõik sammud nuppudena
 * ja märkus) kõik ühes. Nüüd on ees üks asi korraga.
 *  - `NoAnswerView` kokkulepitud sammud; „Ei saa sisse" ja sammude muutmine
 *  - `StepsView`    sammude muutmine: iga samm eraldi real
 *  - `RunView`      märkimise esimene vaade: puuduta samme, mille tegid
 *  - `RecordView`   märkimise teine vaade: märkus ja „Salvesta erijuhtumina"
 *
 * Hädaabi lause (112) on märkimise mõlema vaate all servas, ka tõrke ajal.
 * Siin on ainult kuju. Otsused on failis ./noAnswerRows.js, olek ja päringud
 * konksus ./useNoAnswer.js, kokku paneb need ./ClientNoAnswer.jsx. Kujundus:
 * ./noAnswer.module.css ja organisatsioonide lehtede ühised osad
 * (../../org/org.module.css).
 */

import { SMALL, footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";

import styles from "./noAnswer.module.css";

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

/** Hädaabi lause all servas koos tõrkega: tõrge ei võta hädaabi lauset ära. `emergency`: { text, call }. */
const EmergencyNote = ({ notice, emergency }) => (
  <>
    {notice?.text ? <span className={shared.footError}>{notice.text} </span> : null}
    {emergency.text}{" "}
    <a className={styles.call} href="tel:112" data-no-answer="call">
      {emergency.call}
    </a>
  </>
);

/**
 * Kokkulepitud sammud.
 * `rows`: [{ key, title }]; `empty`: lause, kui samme ei ole; `status`: lause pärast märkimist või tühi;
 * `edit`: { label, onEdit } või null; `start`: { label, onStart } või null („Ei saa sisse");
 * `back`: { label, onBack } (tagasi ukse taha).
 */
export function NoAnswerView({ title, rows, empty, status, edit, start, busy, notice, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      note={footNote(notice)}
      actions={
        <>
          <BackButton back={back} />
          {edit ? (
            <Button {...SMALL} data-no-answer="edit" onClick={edit.onEdit}>
              {edit.label}
            </Button>
          ) : null}
          {start ? (
            <Button type="button" size="sm" variant="primary" data-no-answer="start" onClick={start.onStart}>
              {start.label}
            </Button>
          ) : null}
        </>
      }
    >
      <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
        {status ? (
          <p className={shared.notice} role="status" data-no-answer="status">
            {status}
          </p>
        ) : null}
        {rows.length ? (
          <ul className={shared.rows}>
            {rows.map((row) => (
              <li key={row.key} className={shared.rowItem}>
                <div className={`${shared.rowStatic} ${styles.step}`} data-step={row.key}>
                  <span className={styles.stepText}>{row.title}</span>
                </div>
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
 * Sammude muutmine. `form`: { id, onSubmit }; `steps`: { label, value, onChange, max, rows };
 * `hint`: kuidas sammud kirja panna (vaikne rida all servas); `save`: { label, busy }.
 */
export function StepsView({ title, form, steps, hint, save, notice, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      note={footNote(notice, hint)}
      actions={
        <>
          <BackButton back={back} />
          <Button type="submit" form={form.id} size="sm" variant="primary" data-no-answer="save" aria-busy={save.busy ? "true" : undefined}>
            {save.label}
          </Button>
        </>
      }
    >
      <form id={form.id} className={shared.stack} onSubmit={form.onSubmit} aria-busy={save.busy ? "true" : undefined}>
        <label className={`${shared.line} ${styles.wide}`}>
          <span className={shared.fieldLabel}>{steps.label}</span>
          <Textarea className={shared.input} value={steps.value} onChange={(event) => steps.onChange(event.target.value)} rows={steps.rows} maxLength={steps.max} data-no-answer-field="steps" />
        </label>
      </form>
    </StepPanel>
  );
}

/**
 * Märkimise esimene vaade. `lead`: mida teha („Puuduta samme, mille tegid");
 * `rows`: [{ key, title, done: { text, tone } | null }]; `onTap(key)` märgib sammu või võtab märke ära;
 * `emergency`: { text, call }; `next`: { label, onNext }.
 */
export function RunView({ title, lead, rows, onTap, emergency, next, notice, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      lead={lead}
      note={<EmergencyNote notice={notice} emergency={emergency} />}
      actions={
        <>
          <BackButton back={back} />
          <Button type="button" size="sm" variant="primary" data-no-answer="next" onClick={next.onNext}>
            {next.label}
          </Button>
        </>
      }
    >
      <ul className={shared.rows}>
        {rows.map((row) => (
          <li key={row.key} className={shared.rowItem}>
            <button type="button" className={`${shared.row} ${styles.step}`} aria-pressed={row.done ? "true" : "false"} data-step={row.key} onClick={() => onTap(row.key)}>
              <span className={styles.stepMain}>
                <span className={styles.stepText}>{row.title}</span>
                {/* Märk käib sammu juurde: ta ei tohi teksti veergu kitsaks suruda. */}
                <Chip chip={row.done} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </StepPanel>
  );
}

/**
 * Märkimise teine vaade. `lead`: lause, kui kokkulepitud samme ei ole; `form`: { id, onSubmit };
 * `note`: { label, value, onChange, max, rows }; `emergency`: { text, call }; `save`: { label, busy }.
 */
export function RecordView({ title, lead, form, note, emergency, save, notice, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      lead={lead}
      note={<EmergencyNote notice={notice} emergency={emergency} />}
      actions={
        <>
          <BackButton back={back} />
          <Button type="submit" form={form.id} size="sm" variant="primary" data-no-answer="record" aria-busy={save.busy ? "true" : undefined}>
            {save.label}
          </Button>
        </>
      }
    >
      <form id={form.id} className={shared.stack} onSubmit={form.onSubmit} aria-busy={save.busy ? "true" : undefined}>
        <label className={`${shared.line} ${styles.wide}`}>
          <span className={shared.fieldLabel}>{note.label}</span>
          <Textarea className={shared.input} value={note.value} onChange={(event) => note.onChange(event.target.value)} rows={note.rows} maxLength={note.max} data-no-answer-field="note" />
        </label>
      </form>
    </StepPanel>
  );
}
