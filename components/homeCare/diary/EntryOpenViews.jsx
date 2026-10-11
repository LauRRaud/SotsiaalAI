"use client";

/**
 * Avatud päevikukirje vaated kliendi lehel.
 *
 * MIKS. Iga kirje seisis päevikus täies pikkuses koos oma nuppude, vormide,
 * ajaloo ja erijuhtumi käiguga: loend oli telefonis ligi 7000 px. Nüüd on kirje
 * omaette vaade ja iga tegevus, mis küsib midagi juurde, on omakorda väike vaade.
 *  - `EntryOpenView`  kirje: kogu tekst, käigu toimingud ja kestus, mis oli
 *                     teisiti, erijuhtumi andmed; tegevused selle all
 *  - `RetractView`    tühistamine: põhjus ja teine vajutus
 *  - `CloseView`      erijuhtumi sulgemine: mida tehti
 *  - `RevisionsView`  varasem sisu (parandused ja tühistus)
 *  - `TrailView`      erijuhtumi käik: täiendused, seisumuutused, vastutaja
 *  - `TrailAddView`   täienduse lisamine
 *  - `AssignView`     vastutaja valik
 *
 * Siin on ainult kuju. Otsused on failis ./entryOpen.js, olek ja päringud
 * konksudes; kokku paneb need ./EntryOpen.jsx. Kujundus: ./diary.module.css ja
 * organisatsioonide lehtede ühised osad (../../org/org.module.css).
 */

import Link from "next/link";

import { ArmedButton, PickOne, SMALL, footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";

import styles from "./diary.module.css";

const Chips = ({ chips }) =>
  chips.map((chip) => (
    <span key={chip.key} className={shared.chip} data-tone={chip.wait ? "wait" : undefined}>
      {chip.text}
    </span>
  ));

const BackButton = ({ back, primary = false }) => (
  <Button type="button" size="sm" variant={primary ? "primary" : "secondary"} data-back="1" onClick={back.onBack}>
    {back.label}
  </Button>
);

/**
 * Avatud kirje.
 * `head`: { when, who, chips }; `notes`: vaiksed read ülaserva all;
 * `text`: { value, muted } (tühistatud kirjel lause, et see on tühistatud);
 * `facts`: [{ key, label, value, chip }]; `activities`: { label, rows: [{ key, name, line, wait, outside }], outsideLabel };
 * `talk`: { state, line, wait, busy, hint, link: { label, href }, action: { label, onPress } | null } või null;
 * `actions`: [{ key, label, onPress }] (lahtrid kirje all); `busy`: päring on teel;
 * `notice`: { text, tone } või null; `back`: { label, onBack }.
 */
export function EntryOpenView({ title, head, notes, text, facts, activities, talk, actions, busy, notice, back }) {
  return (
    <StepPanel title={title} note={footNote(notice)} actions={<BackButton back={back} />}>
      <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
        <header className={styles.openHead}>
          <p className={styles.openTitle} data-entry-open="head">
            <span className={styles.when}>{head.when}</span>
            {head.who ? <span className={styles.openWho}>{head.who}</span> : null}
          </p>
          {head.chips.length ? (
            <span className={styles.openChips}>
              <Chips chips={head.chips} />
            </span>
          ) : null}
          {notes.map((note) => (
            <p key={note} className={shared.small} data-note="1">
              {note}
            </p>
          ))}
        </header>
        {text.value ? (
          <p className={text.muted ? shared.quiet : shared.own} data-entry-open="text">
            {text.value}
          </p>
        ) : null}
        {facts.length ? (
          <div className={shared.facts}>
            {facts.map((fact) => (
              <p key={fact.key} className={shared.fact} data-fact={fact.key}>
                <span className={shared.factLabel}>{fact.label}</span>
                <span className={shared.factValue}>{fact.value}</span>
                {fact.chip ? (
                  <span className={shared.chip} data-tone="wait">
                    {fact.chip}
                  </span>
                ) : null}
              </p>
            ))}
          </div>
        ) : null}
        {activities.rows.length ? (
          <div className={shared.group}>
            <p className={shared.factLabel}>{activities.label}</p>
            <ul className={styles.activities}>
              {activities.rows.map((row) => (
                <li key={row.key} className={styles.activity} data-wait={row.wait ? "1" : undefined}>
                  <span className={styles.activityName}>{row.name}</span>
                  <span className={styles.activityLine}>{row.line}</span>
                  {row.outside ? <span className={shared.chip}>{activities.outsideLabel}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {talk ? (
          <div className={shared.group} data-talk={talk.state}>
            {talk.line ? (
              <p className={talk.wait ? shared.notice : shared.small} data-tone={talk.wait ? "risk" : undefined}>
                {talk.line}
              </p>
            ) : null}
            {talk.action ? (
              <div>
                <Button {...SMALL} data-talk-action={talk.state} aria-busy={talk.busy ? "true" : undefined} onClick={talk.action.onPress}>
                  {talk.action.label}
                </Button>
              </div>
            ) : null}
            {talk.hint ? (
              <>
                <p className={shared.small}>{talk.hint}</p>
                <div>
                  <Link className={styles.link} href={talk.link.href} prefetch={false} data-talk-link="1">
                    {talk.link.label}
                  </Link>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
        {actions.length ? (
          <div className={shared.cells} role="group" aria-label={title}>
            {actions.map((action) => (
              <button key={action.key} type="button" className={shared.cellButton} data-entry-action={action.key} onClick={action.onPress}>
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Tühistamine: põhjus ja teine vajutus samal nupul.
 * `reason`: { label, value, onChange, max }; `armed`: esimene vajutus on tehtud;
 * `press`: { label, confirm, onPress, busy }; `consequence`: lause, mis juhtub (pärast esimest vajutust).
 */
export function RetractView({ title, lead, reason, armed, press, consequence, notice, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      lead={lead}
      note={footNote(notice, armed ? consequence : "")}
      actions={
        <>
          <BackButton back={back} />
          <ArmedButton armed={armed} label={press.label} confirm={press.confirm} onPress={press.onPress} busy={press.busy} mark="retract" />
        </>
      }
    >
      <label className={`${shared.line} ${styles.reason}`}>
        <span className={shared.fieldLabel}>{reason.label}</span>
        <input className={shared.input} value={reason.value} onChange={(event) => reason.onChange(event.target.value)} maxLength={reason.max} autoComplete="off" data-entry-open="reason" />
      </label>
    </StepPanel>
  );
}

/** Erijuhtumi sulgemine: mida tehti. `note`: { label, value, onChange, max }; `save`: { label, onSave, busy }. */
export function CloseView({ title, note, save, notice, back }) {
  return (
    <StepPanel
      title={title}
      note={footNote(notice)}
      actions={
        <>
          <BackButton back={back} />
          <Button type="button" size="sm" variant="primary" data-entry-open="close-save" aria-busy={save.busy ? "true" : undefined} onClick={save.onSave}>
            {save.label}
          </Button>
        </>
      }
    >
      <TextAreaField label={note.label} value={note.value} onChange={note.onChange} rows={3} maxLength={note.max} />
    </StepPanel>
  );
}

/** Loend sündmustest (varasem sisu, juhtumi käik): märk, kes ja millal, selle all tekst. */
function Events({ rows }) {
  return (
    <ul className={shared.lines}>
      {rows.map((row) => (
        <li key={row.key} className={`${shared.lineItem} ${styles.hit}`} data-event={row.key}>
          <span className={styles.eventHead}>
            <span className={shared.chip}>{row.kind}</span>
            <span className={styles.meta}>{row.meta}</span>
          </span>
          {row.reason ? <span className={shared.small}>{row.reason}</span> : null}
          {row.text ? <span className={row.old ? `${shared.own} ${styles.old}` : shared.own}>{row.text}</span> : null}
          {row.visit ? <span className={shared.small}>{row.visit}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** Varasem sisu: `rows`: [{ key, kind, meta, reason, text, visit }] või null (laadimisel); `empty`: lause, kui parandusi ei ole. */
export function RevisionsView({ title, rows, empty, busy, notice, back }) {
  return (
    <StepPanel title={title} question={title} note={footNote(notice)} actions={<BackButton back={back} />}>
      <div aria-busy={busy ? "true" : undefined}>{rows ? rows.length ? <Events rows={rows.map((row) => ({ ...row, old: true }))} /> : <p className={shared.quiet}>{empty}</p> : null}</div>
    </StepPanel>
  );
}

/**
 * Erijuhtumi käik. `rows`: [{ key, kind, meta, text }] või null (laadimisel);
 * `assign`: { label, onOpen } või null; `add`: { label, onOpen } või null.
 */
export function TrailView({ title, lead, rows, empty, busy, notice, assign, add, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      lead={lead}
      note={footNote(notice)}
      actions={
        <>
          <BackButton back={back} />
          {assign ? (
            <Button {...SMALL} data-trail="assign" onClick={assign.onOpen}>
              {assign.label}
            </Button>
          ) : null}
          {add ? (
            <Button type="button" size="sm" variant="primary" data-trail="add" onClick={add.onOpen}>
              {add.label}
            </Button>
          ) : null}
        </>
      }
    >
      <div aria-busy={busy ? "true" : undefined}>{rows ? rows.length ? <Events rows={rows} /> : <p className={shared.quiet}>{empty}</p> : null}</div>
    </StepPanel>
  );
}

/** Täienduse lisamine. `field`: { label, hint, value, onChange, max }; `save`: { label, onSave, busy, disabled }. */
export function TrailAddView({ title, field, save, notice, back }) {
  return (
    <StepPanel
      title={title}
      note={footNote(notice)}
      actions={
        <>
          <BackButton back={back} />
          <Button type="button" size="sm" variant="primary" data-trail="save" disabled={save.disabled} aria-busy={save.busy ? "true" : undefined} onClick={save.onSave}>
            {save.label}
          </Button>
        </>
      }
    >
      <TextAreaField label={field.label} hint={field.hint} value={field.value} onChange={field.onChange} rows={3} maxLength={field.max} />
    </StepPanel>
  );
}

/** Vastutaja valik: valik salvestub kohe. `pick`: { label, options, value, onChange, disabled }. */
export function AssignView({ title, pick, notice, back }) {
  return (
    <StepPanel title={title} note={footNote(notice)} actions={<BackButton back={back} />}>
      <PickOne label={pick.label} options={pick.options} value={pick.value} onChange={pick.onChange} columns={2} disabled={pick.disabled} />
    </StepPanel>
  );
}
