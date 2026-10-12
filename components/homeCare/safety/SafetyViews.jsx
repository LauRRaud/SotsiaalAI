"use client";

/**
 * Kliendi lehe osa „Ohutus" vaated.
 *
 * MIKS. Viis teemat (eeltingimused, ohutuskaart, tavaline seis, töö iseloom,
 * kriisivalmidus) seisid pika lehe keskel üksteise all, igaüks oma vormiga;
 * ohutuskaardi kümme küsimust olid üks pikk vorm. Nüüd on ees üks asi korraga.
 *  - `TopicsView`           teemad ridadena, real teema seis
 *  - `TopicView`            ühe teema lugemisvaade (sisu annab teema)
 *  - `PreconditionsBody`    täitmata eeltingimused
 *  - `PreconditionItemView` üks eeltingimus ja selle lõpetamine (teine vajutus)
 *  - `PreconditionAddView`  uus eeltingimus
 *  - `CardBody`             ohutuskaart: „jah"-vastused ees
 *  - `CardEditView`         kaardi küsimused ridadena
 *  - `CardQuestionView`     üks küsimus: jah või ei ja märkus
 *  - `UsualBody`, `UsualEditView`   tavaline seis kuues valdkonnas
 *  - `WorkBody`, `WorkEditView`     töö iseloom
 *  - `CrisisBody`, `CrisisEditView`, `CrisisMoreView` kriisivalmidus (hinnang kahes vaates)
 *
 * Siin on ainult kuju. Otsused on failis ./safetyRows.js, olek ja päringud
 * konksudes (./useSafetyParts.js), kokku paneb need ./ClientSafety.jsx.
 * Kujundus: ./safety.module.css ja organisatsioonide lehtede ühised osad
 * (../../org/org.module.css).
 */

import { Facts, SMALL, footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import ChoiceChips from "@/components/stage/ChoiceChips";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import styles from "./safety.module.css";

const BackButton = ({ back }) => (
  <Button {...SMALL} data-back="1" onClick={back.onBack}>
    {back.label}
  </Button>
);

const SaveButton = ({ save, form }) => (
  <Button type={form ? "submit" : "button"} form={form} size="sm" variant="primary" data-safety="save" disabled={save.disabled} aria-busy={save.busy ? "true" : undefined} onClick={form ? undefined : save.onSave}>
    {save.label}
  </Button>
);

/** Tekstiväli sildi ja vihjega. `field`: { label, hint, value, onChange, max, example, required }. */
function TextField({ field, mark, wide = false }) {
  return (
    <label className={`${shared.line} ${wide ? styles.wide : styles.field}`}>
      <span className={shared.fieldLabel}>{field.label}</span>
      <input
        className={shared.input}
        value={field.value}
        onChange={(event) => field.onChange(event.target.value)}
        maxLength={field.max}
        placeholder={field.example}
        required={field.required}
        autoComplete="off"
        data-safety-field={mark}
      />
      {field.hint ? <span className={shared.hint}>{field.hint}</span> : null}
    </label>
  );
}

/** Nupp, mis võtab kirja maha: küsib teist vajutust samal lahtril. */
function ClearCell({ clear }) {
  return (
    <div className={shared.cells}>
      <button type="button" className={shared.cellButton} data-armed={clear.armed ? "1" : undefined} data-safety="clear" onClick={clear.onPress}>
        {clear.label}
      </button>
    </div>
  );
}

/**
 * Teemad ridadena. `rows`: [{ key, title, line, wait, chip }]; rida, kus midagi
 * ootab, on tugevama raamiga.
 */
export function TopicsView({ title, name, rows, onOpen }) {
  return (
    <StepPanel title={title} question={name}>
      <ul className={shared.rows}>
        {rows.map((row) => (
          <li key={row.key} className={shared.rowItem}>
            <button type="button" className={`${shared.row} ${row.wait ? styles.waiting : ""}`} data-topic={row.key} data-wait={row.wait ? "1" : undefined} onClick={() => onOpen(row.key)}>
              <span className={shared.rowMain}>
                <span className={shared.rowTitle}>{row.title}</span>
                <span className={shared.rowSub}>{row.line}</span>
              </span>
              {row.chip ? (
                <span className={shared.rowMeta}>
                  <span className={shared.chip} data-tone="wait">
                    {row.chip}
                  </span>
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </StepPanel>
  );
}

/**
 * Ühe teema lugemisvaade. `chip`: märk pealkirja kõrval (nt „vaata üle");
 * `empty`: lause, kui teemas ei ole midagi kirjas (siis sisu ei joonistata);
 * `edit`: { label, onEdit } või null; `notice`: { text, tone } või null.
 */
export function TopicView({ title, chip = "", empty = "", edit = null, busy = false, notice = null, back, children }) {
  return (
    <StepPanel
      title={title}
      note={footNote(notice)}
      actions={
        <>
          <BackButton back={back} />
          {edit ? (
            <Button {...SMALL} data-safety="edit" onClick={edit.onEdit}>
              {edit.label}
            </Button>
          ) : null}
        </>
      }
    >
      <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
        <header className={shared.headBar}>
          <p className={shared.headName}>{title}</p>
          {chip ? (
            <span className={shared.chip} data-tone="wait">
              {chip}
            </span>
          ) : null}
        </header>
        {empty ? <p className={shared.quiet}>{empty}</p> : children}
      </div>
    </StepPanel>
  );
}

/* --- Eeltingimused ---------------------------------------------------------------- */

/**
 * Täitmata eeltingimused. `waiting`: hoiatus, et teenust ei alustata;
 * `rows`: [{ key, title, line, overdue }]; `overdue`: märgi sõnad;
 * `onOpen(key)` avab eeltingimuse (hooldusjuhil) või null (rida on lugemiseks).
 */
export function PreconditionsBody({ waiting, rows, overdue, onOpen }) {
  const body = (row) => (
    <>
      <span className={styles.main}>
        <span className={shared.rowTitle}>{row.title}</span>
        <span className={styles.sub}>{row.line}</span>
      </span>
      {row.overdue ? (
        <span className={shared.rowMeta}>
          <span className={shared.chip} data-tone="wait">
            {overdue}
          </span>
        </span>
      ) : null}
    </>
  );
  return (
    <>
      <p className={shared.notice}>{waiting}</p>
      <ul className={shared.rows}>
        {rows.map((row) => (
          <li key={row.key} className={shared.rowItem}>
            {onOpen ? (
              <button type="button" className={shared.row} data-precondition={row.key} onClick={() => onOpen(row.key)}>
                {body(row)}
              </button>
            ) : (
              <div className={shared.rowStatic} data-precondition={row.key}>
                {body(row)}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Üks eeltingimus ja selle lõpetamine. `actions`: [{ key, label, armed, onPress }]
 * (lahter küsib teist vajutust); `consequence`: lause, mis juhtub (pärast esimest vajutust).
 */
export function PreconditionItemView({ title, row, overdue, actions, consequence, busy, notice, back }) {
  return (
    <StepPanel title={title} note={footNote(notice, consequence)} actions={<BackButton back={back} />}>
      <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
        <header className={shared.headBar}>
          <p className={shared.headName}>{row.title}</p>
          {row.overdue ? (
            <span className={shared.chip} data-tone="wait">
              {overdue}
            </span>
          ) : null}
        </header>
        <p className={`${shared.quiet} ${styles.made}`}>{row.line}</p>
        <div className={shared.cells} role="group" aria-label={title}>
          {actions.map((action) => (
            <button key={action.key} type="button" className={shared.cellButton} data-armed={action.armed ? "1" : undefined} data-precondition-action={action.key} onClick={action.onPress}>
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </StepPanel>
  );
}

/**
 * Uus eeltingimus. `form`: { id, onSubmit }; `kind`: { label, options, value, onChange };
 * `note`, `responsible`: tekstiväljad; `due`: { label, value, onChange } (päev kujul 2026-10-14).
 */
export function PreconditionAddView({ title, form, kind, note, responsible, due, save, notice, back }) {
  return (
    <StepPanel
      title={title}
      note={footNote(notice)}
      actions={
        <>
          <BackButton back={back} />
          <SaveButton save={save} form={form.id} />
        </>
      }
    >
      <form id={form.id} className={styles.split} onSubmit={form.onSubmit} aria-busy={save.busy ? "true" : undefined}>
        <div data-area="choice">
          <ChoiceRow label={kind.label} options={kind.options} value={kind.value} onChange={kind.onChange} columns={2} />
        </div>
        <div className={shared.stack} data-area="fields">
          <TextField field={note} mark="note" wide />
          <TextField field={responsible} mark="responsible" wide />
          <label className={`${shared.line} ${styles.field}`}>
            <span className={shared.fieldLabel}>{due.label}</span>
            <Input className={shared.input} type="date" value={due.value} onChange={(event) => due.onChange(event.target.value)} data-safety-field="due" />
          </label>
        </div>
      </form>
    </StepPanel>
  );
}

/* --- Ohutuskaart -------------------------------------------------------------------- */

/** Ohutuskaart lugemiseks. `rows`: [{ key, name, text }] („jah"-vastused); `notes`: vaiksed read nende all. */
export function CardBody({ rows, notes }) {
  return (
    <>
      {rows.length ? (
        <ul className={styles.lines}>
          {rows.map((row) => (
            <li key={row.key} className={styles.line} data-card-yes={row.key}>
              <span className={styles.name}>{row.name}</span>
              {row.text ? <span className={styles.text}>{row.text}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {notes.length ? (
        <div className={shared.facts}>
          {notes.map((note) => (
            <p key={note} className={`${shared.small} ${styles.made}`}>
              {note}
            </p>
          ))}
        </div>
      ) : null}
    </>
  );
}

/**
 * Kaardi küsimused ridadena: real teema, vastus ja märkus; vajutus avab küsimuse.
 * `rows`: [{ key, name, answer, note }]; `answers`: { YES, NO, open } (vastuse sõnad).
 */
export function CardEditView({ title, rows, answers, onOpen, save, notice, back }) {
  return (
    <StepPanel
      title={title}
      note={footNote(notice)}
      actions={
        <>
          <BackButton back={back} />
          <SaveButton save={save} />
        </>
      }
    >
      <ul className={`${shared.rows} ${styles.questions}`} aria-busy={save.busy ? "true" : undefined}>
        {rows.map((row) => (
          <li key={row.key} className={shared.rowItem}>
            <button type="button" className={shared.row} data-question={row.key} onClick={() => onOpen(row.key)}>
              <span className={shared.rowMain}>
                <span className={shared.rowTitle}>{row.name}</span>
                {row.note ? <span className={`${shared.rowSub} ${styles.questionNote}`}>{row.note}</span> : null}
              </span>
              {/* Märk on rea enda teine veerg (mitte märkide rühm): telefonis jääb see nime kõrvale ja rida on madal. */}
              <span className={shared.chip} data-tone={row.answer === "YES" ? "wait" : undefined} data-answer={row.answer || "open"}>
                {answers[row.answer] || answers.open}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </StepPanel>
  );
}

/**
 * Üks küsimus: jah või ei (teine vajutus samale vastusele võtab selle maha) ja
 * märkus, kui vastus on antud. `hint`: mida märkusesse kirjutada;
 * `next`: { label, onNext } või null (viimane küsimus).
 */
export function CardQuestionView({ title, question, answer, note, hint, next, back }) {
  return (
    <StepPanel
      title={title}
      note={hint}
      actions={
        <>
          <BackButton back={back} />
          {next ? (
            <Button type="button" size="sm" variant="primary" data-safety="next" onClick={next.onNext}>
              {next.label}
            </Button>
          ) : null}
        </>
      }
    >
      <div className={shared.stack}>
        <ChoiceRow label={question} options={answer.options} value={answer.value} onChange={answer.onChange} columns={2} keepColumns />
        {note ? <TextField field={note} mark="note" wide /> : null}
      </div>
    </StepPanel>
  );
}

/* --- Tavaline seis --------------------------------------------------------------------- */

/** Tavaline seis lugemiseks. `rows`: [{ key, label, value }]. */
export function UsualBody({ rows }) {
  return <Facts rows={rows} />;
}

/** Tavalise seisu kuus valdkonda. `fields`: [{ key, label, example, value, onChange, max }]. */
export function UsualEditView({ title, hint, form, fields, save, notice, back }) {
  return (
    <StepPanel
      title={title}
      note={footNote(notice, hint)}
      actions={
        <>
          <BackButton back={back} />
          <SaveButton save={save} form={form.id} />
        </>
      }
    >
      <form id={form.id} className={styles.grid} onSubmit={form.onSubmit} aria-busy={save.busy ? "true" : undefined}>
        {fields.map((field) => (
          <TextField key={field.key} field={field} mark={field.key} wide />
        ))}
      </form>
    </StepPanel>
  );
}

/* --- Töö iseloom ------------------------------------------------------------------------ */

/** Töö iseloomu märge lugemiseks. `chips`: [{ key, text }]; `reason`: miks; `meta`: ülevaatus ja kes märkis. */
export function WorkBody({ chips, reason, meta }) {
  return (
    <>
      <p className={styles.chips}>
        {chips.map((chip) => (
          <span key={chip.key} className={shared.chip} data-tone="wait">
            {chip.text}
          </span>
        ))}
      </p>
      {reason ? <p className={shared.own}>{reason}</p> : null}
      {meta ? <p className={shared.small}>{meta}</p> : null}
    </>
  );
}

/**
 * Töö iseloomu märge. `kinds`: { label, hint, options, values, onToggle };
 * `reason`: tekstiväli; `review`: { label, value, onChange };
 * `clear`: { label, armed, onPress } või null (märget ei ole).
 */
export function WorkEditView({ title, form, kinds, reason, review, save, clear, consequence, notice, back }) {
  return (
    <StepPanel
      title={title}
      note={footNote(notice, consequence)}
      actions={
        <>
          <BackButton back={back} />
          <SaveButton save={save} form={form.id} />
        </>
      }
    >
      <form id={form.id} className={styles.split} onSubmit={form.onSubmit} aria-busy={save.busy ? "true" : undefined}>
        <div data-area="choice">
          <ChoiceChips label={kinds.label} hint={kinds.hint} options={kinds.options} values={kinds.values} onToggle={kinds.onToggle} columns={2} />
        </div>
        <div className={shared.stack} data-area="fields">
          <TextField field={reason} mark="reason" wide />
          <label className={`${shared.line} ${styles.field}`}>
            <span className={shared.fieldLabel}>{review.label}</span>
            <Input className={shared.input} type="date" value={review.value} onChange={(event) => review.onChange(event.target.value)} data-safety-field="review" />
          </label>
          {clear ? <ClearCell clear={clear} /> : null}
        </div>
      </form>
    </StepPanel>
  );
}

/* --- Kriisivalmidus ----------------------------------------------------------------------- */

/** Kriisivalmiduse hinnang lugemiseks. `level`: kui palju tuge vaja on; `lines`: millest sõltub, kes aitab, märkus. */
export function CrisisBody({ level, lines }) {
  return (
    <>
      <p className={styles.level}>{level}</p>
      {lines.length ? (
        <div className={shared.facts}>
          {lines.map((line) => (
            <p key={line} className={`${shared.quiet} ${styles.made}`}>
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </>
  );
}

/**
 * Kriisivalmiduse hinnang, esimene vaade: kui palju tuge vaja on ja millest klient sõltub.
 * `level`: { label, options, value, onChange }; `dependencies`: { label, hint, options, values, onToggle };
 * `next`: { label, onNext, disabled } (teine vaade: kes aitab, märkus ja salvestamine).
 */
export function CrisisEditView({ title, level, dependencies, next, back }) {
  return (
    <StepPanel
      title={title}
      note={dependencies.hint}
      actions={
        <>
          <BackButton back={back} />
          <Button type="button" size="sm" variant="primary" data-safety="next" disabled={next.disabled} onClick={next.onNext}>
            {next.label}
          </Button>
        </>
      }
    >
      <div className={styles.split}>
        <ChoiceRow label={level.label} options={level.options} value={level.value} onChange={level.onChange} columns={1} />
        <ChoiceChips label={dependencies.label} options={dependencies.options} values={dependencies.values} onToggle={dependencies.onToggle} columns={2} />
      </div>
    </StepPanel>
  );
}

/**
 * Kriisivalmiduse hinnang, teine vaade: kes lähedastest saab aidata, märkus ja salvestamine.
 * `helper`, `note`: tekstiväljad; `clear`: { label, armed, onPress } või null (hinnangut ei ole).
 */
export function CrisisMoreView({ title, form, helper, note, save, clear, consequence, notice, back }) {
  return (
    <StepPanel
      title={title}
      note={footNote(notice, consequence)}
      actions={
        <>
          <BackButton back={back} />
          <SaveButton save={save} form={form.id} />
        </>
      }
    >
      <form id={form.id} className={shared.stack} onSubmit={form.onSubmit} aria-busy={save.busy ? "true" : undefined}>
        <TextField field={helper} mark="helper" wide />
        <TextField field={note} mark="note" wide />
        {clear ? <ClearCell clear={clear} /> : null}
      </form>
    </StepPanel>
  );
}
