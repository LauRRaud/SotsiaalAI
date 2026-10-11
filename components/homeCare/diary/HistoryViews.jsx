"use client";

/**
 * Kliendi varasema ajaloo vaated (teisest kohast üle toodud päevik).
 *
 * MIKS. Varasem ajalugu seisis päeviku lõpus ühe osana: dokumentide loend,
 * avatud tekst ja üle toomise vorm üksteise all. Nüüd on ees üks asi korraga.
 *  - `HistoryListView` üle toodud dokumendid ridadena
 *  - `HistoryDocView`  ühe dokumendi tekst lehekülgede kaupa; eemaldamine küsib
 *                      teist vajutust
 *  - `HistoryAddView`  üle toomine: kust see pärit on ja tekst (või tekstifail)
 *
 * Siin on ainult kuju. Olek ja päringud on konksus ./useImportedHistory.js,
 * kokku paneb need ./ImportedHistory.jsx. Kujundus: ./diary.module.css ja
 * organisatsioonide lehtede ühised osad (../../org/org.module.css).
 */

import { ArmedButton, SMALL, footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";

import styles from "./diary.module.css";

const BackButton = ({ back }) => (
  <Button {...SMALL} data-back="1" onClick={back.onBack}>
    {back.label}
  </Button>
);

/**
 * Üle toodud dokumendid. `rows`: [{ key, title, line }]; `onOpen(key)` avab teksti;
 * `mark`: märge, et autorid ja ajad on kontrollimata; `empty`: lause, kui midagi
 * ei ole üle toodud; `add`: { label, onOpen } või null.
 */
export function HistoryListView({ title, mark, rows, onOpen, empty, add, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      lead={rows.length ? mark : ""}
      actions={
        <>
          <BackButton back={back} />
          {add ? (
            <Button {...SMALL} data-history="add" onClick={add.onOpen}>
              {add.label}
            </Button>
          ) : null}
        </>
      }
    >
      {rows.length ? (
        <ul className={shared.rows}>
          {rows.map((row) => (
            <li key={row.key} className={shared.rowItem}>
              <button type="button" className={shared.row} data-history-row={row.key} onClick={() => onOpen(row.key)}>
                <span className={styles.main}>
                  <span className={shared.rowTitle}>{row.title}</span>
                  <span className={styles.sub}>{row.line}</span>
                </span>
              </button>
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
 * Ühe dokumendi tekst. `blocks`: [{ key, text }] või null (laadimisel);
 * `more`: { label, onMore } või null (järgmine lehekülg);
 * `remove`: { armed, label, confirm, consequence, onPress, busy } või null (eemaldab hooldusjuht).
 */
export function HistoryDocView({ title, meta, mark, blocks, busy, more, remove, notice, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      note={footNote(notice, remove?.armed ? remove.consequence : "")}
      actions={
        <>
          <BackButton back={back} />
          {remove ? <ArmedButton armed={remove.armed} label={remove.label} confirm={remove.confirm} onPress={remove.onPress} busy={remove.busy} mark="history-remove" /> : null}
          {more ? (
            <Button {...SMALL} data-history="more" aria-busy={busy ? "true" : undefined} onClick={more.onMore}>
              {more.label}
            </Button>
          ) : null}
        </>
      }
    >
      <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
        <div>
          <p className={shared.small}>{meta}</p>
          <p className={shared.small}>{mark}</p>
        </div>
        {(blocks || []).map((block) => (
          <p key={block.key} className={shared.own} data-history-block={block.key}>
            {block.text}
          </p>
        ))}
      </div>
    </StepPanel>
  );
}

/**
 * Senise päeviku üle toomine.
 * `name`: { label, hint, value, onChange, max }; `text`: { label, value, onChange };
 * `file`: { label, inputRef, onFile, note } (failivalija on peidus, seda avab nupp all servas);
 * `problem`: lause, kui tekst on liiga pikk; `save`: { label, onSave, busy, disabled }.
 */
export function HistoryAddView({ title, lead, name, text, file, problem, notice, save, back }) {
  return (
    <StepPanel
      title={title}
      lead={lead}
      note={footNote(notice, problem || file.note)}
      actions={
        <>
          <BackButton back={back} />
          <Button {...SMALL} data-history="file" onClick={() => file.inputRef.current?.click()}>
            {file.label}
          </Button>
          <Button type="button" size="sm" variant="primary" data-history="save" disabled={save.disabled} aria-busy={save.busy ? "true" : undefined} onClick={save.onSave}>
            {save.label}
          </Button>
        </>
      }
    >
      <div className={styles.importForm}>
        {/* Failivalija ise on peidus; väli tühjendatakse kohe pärast lugemist, et sama faili saaks uuesti valida. */}
        <input
          ref={file.inputRef}
          className="sr-only"
          type="file"
          tabIndex={-1}
          aria-hidden="true"
          accept=".txt,.md,text/plain"
          onChange={(event) => {
            const picked = event.target.files?.[0] || null;
            event.target.value = "";
            file.onFile(picked);
          }}
        />
        <label className={shared.line} data-area="name">
          <span className={shared.fieldLabel}>{name.label}</span>
          <input className={shared.input} value={name.value} onChange={(event) => name.onChange(event.target.value)} maxLength={name.max} autoComplete="off" data-history="name" />
          <span className={shared.hint}>{name.hint}</span>
        </label>
        <div data-area="text">
          <TextAreaField label={text.label} value={text.value} onChange={text.onChange} rows={5} />
        </div>
      </div>
    </StepPanel>
  );
}
