"use client";

/**
 * Kliendi lehe päeviku vaated.
 *
 * MIKS. Päevik oli üks pikk keritav osa (telefonis umbes 6900 px): otsing,
 * filter, kõik kirjed täies pikkuses koos oma tegevustega, otsingu tabamused
 * varasemast ajaloost ja varasem ajalugu ise üksteise all. Nüüd on ees üks asi
 * korraga.
 *  - `DiaryView`       loend: kirjed madalate ridadena (aeg ja autor, teksti
 *                      algus, märgid), esimene lehekülg ja „Näita varasemaid"
 *  - `DiarySearchView` otsing ja filter omaette vaatena
 *  - `HistoryHitsView` otsingu tabamused varasemast ajaloost
 *
 * Siin on ainult kuju. Otsused on failis ./diaryRows.js, olek ja päringud lehel
 * (`../HomeCareClientPage.jsx`). Kujundus: ./diary.module.css ja
 * organisatsioonide lehtede ühised osad (../../org/org.module.css).
 */

import { SMALL, footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import styles from "./diary.module.css";

/** Rida, mis viib päevikust kõrvale (tabamused varasemast ajaloost, varasem ajalugu ise). */
function SideRow({ mark, row }) {
  return (
    <li className={shared.rowItem}>
      <button type="button" className={shared.row} data-diary={mark} onClick={row.onOpen}>
        <span className={shared.rowMain}>
          <span className={shared.rowTitle}>{row.title}</span>
          <span className={shared.rowSub}>{row.line}</span>
        </span>
      </button>
    </li>
  );
}

/**
 * Päeviku loend.
 * `name`: kliendi nimi vaate ülaservas;
 * `filter`: { line, clear: { label, onClear } } või null (otsingut ei ole);
 * `rows`: [{ key, when, who, line: { text, muted, made }, chips }]; `onOpen(key)` avab kirje;
 * `empty`: lause, kui kirjeid ei ole; `notice`: { text, tone } või null; `busy`: päring on teel;
 * `hits`, `history`: { title, line, onOpen } või null (read loendi all);
 * `search`: { label, onOpen }; `more`: { label, onMore } või null.
 */
export function DiaryView({ title, name, filter, rows, onOpen, empty, notice, busy, hits, history, search, more }) {
  return (
    <StepPanel
      title={title}
      question={name}
      note={footNote(notice)}
      actions={
        <>
          <Button {...SMALL} data-diary="search" onClick={search.onOpen}>
            {search.label}
          </Button>
          {more ? (
            <Button {...SMALL} data-diary="more" aria-busy={busy ? "true" : undefined} onClick={more.onMore}>
              {more.label}
            </Button>
          ) : null}
        </>
      }
    >
      <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
        {filter ? (
          <p className={shared.notice} data-diary="filter">
            {filter.line}{" "}
            <button type="button" className={styles.textButton} data-diary="clear" onClick={filter.clear.onClear}>
              {filter.clear.label}
            </button>
          </p>
        ) : null}
        {rows.length ? (
          <ul className={shared.rows} aria-live="polite">
            {rows.map((row) => (
              <li key={row.key} className={shared.rowItem}>
                <button type="button" className={`${shared.row} ${styles.entry}`} data-entry-row={row.key} onClick={() => onOpen(row.key)}>
                  <span className={styles.main}>
                    <span className={styles.title}>
                      <span className={styles.when}>{row.when}</span>
                      {row.who ? <span className={styles.who}>{row.who}</span> : null}
                    </span>
                    {row.line.text ? (
                      <span className={styles.text} data-muted={row.line.muted ? "1" : undefined} data-made={row.line.made ? "1" : undefined}>
                        {row.line.text}
                      </span>
                    ) : null}
                  </span>
                  {row.chips.length ? (
                    <span className={`${shared.rowMeta} ${styles.chips}`}>
                      {row.chips.map((chip) => (
                        <span key={chip.key} className={shared.chip} data-tone={chip.wait ? "wait" : undefined}>
                          {chip.text}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={shared.quiet} aria-live="polite">
            {empty}
          </p>
        )}
        {hits || history ? (
          <ul className={shared.rows}>
            {hits ? <SideRow mark="hits" row={hits} /> : null}
            {history ? <SideRow mark="history" row={history} /> : null}
          </ul>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Otsing ja filter.
 * `form`: { id, onSubmit }; `query`: { label, hint, value, onChange } (selgitus on vaate all servas);
 * `kind`: { label, options, value, onChange }; `from`, `to`: { label, value, onChange } (päev kujul 2026-10-14);
 * `notice`: { text, tone } või null; `busy`: päring on teel;
 * `clear`: { label, onClear } või null; `back`: { label, onBack }; `submit`: nupu sõna.
 */
export function DiarySearchView({ title, name, form, query, kind, from, to, notice, busy, clear, back, submit }) {
  return (
    <StepPanel
      title={title}
      question={name}
      note={footNote(notice, query.hint)}
      actions={
        <>
          <Button {...SMALL} data-back="1" onClick={back.onBack}>
            {back.label}
          </Button>
          {clear ? (
            <Button {...SMALL} data-diary="clear" onClick={clear.onClear}>
              {clear.label}
            </Button>
          ) : null}
          <Button type="submit" form={form.id} size="sm" variant="primary" data-diary="apply" aria-busy={busy ? "true" : undefined}>
            {submit}
          </Button>
        </>
      }
    >
      <form id={form.id} className={shared.stack} role="search" onSubmit={form.onSubmit}>
        <label className={`${shared.line} ${styles.query}`}>
          <span className={shared.fieldLabel}>{query.label}</span>
          <input
            className={shared.input}
            type="search"
            value={query.value}
            onChange={(event) => query.onChange(event.target.value)}
            maxLength={80}
            autoComplete="off"
            enterKeyHint="search"
            data-diary="query"
          />
        </label>
        <ChoiceRow label={kind.label} options={kind.options} value={kind.value} onChange={kind.onChange} columns={3} />
        <div className={shared.pair}>
          {[from, to].map((field, index) => (
            <label key={index === 0 ? "from" : "to"} className={shared.line}>
              <span className={shared.fieldLabel}>{field.label}</span>
              <Input className={shared.input} type="date" value={field.value} onChange={(event) => field.onChange(event.target.value)} data-diary={index === 0 ? "from" : "to"} />
            </label>
          ))}
        </div>
      </form>
    </StepPanel>
  );
}

/**
 * Otsingu tabamused varasemast ajaloost (teisest kohast üle toodud tekst).
 * `items`: [{ key, title, text }]; `mark`: märge, et autorid ja ajad on
 * kontrollimata; `note`: lause, kui tabamusi on rohkem, kui server näitab;
 * `more`: { label, onMore } või null (ülejäänud lõigud).
 */
export function HistoryHitsView({ title, lead, items, mark, note, more, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      lead={lead}
      note={note}
      actions={
        <>
          <Button {...SMALL} data-back="1" onClick={back.onBack}>
            {back.label}
          </Button>
          {more ? (
            <Button {...SMALL} data-diary="more-hits" onClick={more.onMore}>
              {more.label}
            </Button>
          ) : null}
        </>
      }
    >
      <ul className={shared.lines}>
        {items.map((item) => (
          <li key={item.key} className={`${shared.lineItem} ${styles.hit}`} data-hit={item.key}>
            <span className={styles.hitTitle}>{item.title}</span>
            <span className={styles.meta}>{mark}</span>
            <span className={shared.own}>{item.text}</span>
          </li>
        ))}
      </ul>
    </StepPanel>
  );
}
