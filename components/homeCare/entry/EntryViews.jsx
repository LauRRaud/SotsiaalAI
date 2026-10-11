"use client";

/**
 * Uue kirje vaated kliendi lehel.
 *
 * MIKS. Kirje vorm oli üks pikk vorm (telefonis 1800 px): liik, toimingud,
 * kestus, küsimus muutuse kohta, tekst, erijuhtumi väljad, kontakt, aeg ja
 * kaaslane üksteise all. Hooldaja kirjutab kirje kliendi juures ühe käega: ees
 * on üks asi korraga ja sammud on kiirmenüüs.
 *  - `KindView`     1/4 mis kirje see on ja kuidas kokku puututi
 *  - `DoneView`     2/4 mida tehti: käigul kava toimingud, erijuhtumil tehtud sammud
 *  - `ActivityView` üks toiming: kuidas tehti või miks jäi tegemata
 *  - `TimeView`     3/4 käigu kestus, sündmuse aeg ja kes oli kaasas
 *  - `TextView`     4/4 mida nähti, kes kirjet näeb ja salvestamine
 *  - `ChangeView`   mis oli teisiti kui tavaliselt (vastuse „jah" järel)
 *
 * Siin on ainult kuju. Otsused on failis ./entryRules.js, olek ja päringud
 * konksus ./useEntryForm.js; kokku paneb need ./EntryFlow.jsx. Kujundus:
 * ./entry.module.css ja organisatsioonide lehtede ühised osad (../../org/org.module.css).
 */

import { PickOne, SMALL, footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import CheckCard from "@/components/stage/CheckCard";
import ChoiceChips from "@/components/stage/ChoiceChips";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";

import styles from "./entry.module.css";

/** Paranduse katkestamine: `cancel`: { label, onCancel } või null (uuel kirjel seda ei ole). */
const Cancel = ({ cancel }) =>
  cancel ? (
    <Button {...SMALL} data-entry="cancel" onClick={cancel.onCancel}>
      {cancel.label}
    </Button>
  ) : null;

/** Taastatud pooleli kirje: teade ja tee selle tühjendamiseks. `draft`: { text, clear, onClear } või null. */
function Draft({ draft }) {
  if (!draft) return null;
  return (
    <p className={shared.notice} data-entry="draft">
      {draft.text}{" "}
      <button type="button" className={styles.textButton} data-entry="draft-clear" onClick={draft.onClear}>
        {draft.clear}
      </button>
    </p>
  );
}

/**
 * 1/4 Liik. `kind`, `contact`: { label, options, value, onChange };
 * `incident`: { notice, label, options, value, onChange } või null;
 * `quick`: [{ key, label, onOpen }] (kirjed, mis vormi ei vaja: kõne, „peaaegu juhtus").
 */
export function KindView({ title, draft, kind, contact, incident, quick, cancel = null }) {
  return (
    <StepPanel
      title={title}
      actions={
        quick.length || cancel ? (
          <>
            <Cancel cancel={cancel} />
            {quick.map((item) => (
              <Button key={item.key} {...SMALL} data-entry-quick={item.key} onClick={item.onOpen}>
                {item.label}
              </Button>
            ))}
          </>
        ) : null
      }
    >
      <div className={shared.stack}>
        <Draft draft={draft} />
        {/* Erijuhtumi lisa on telefonis valikute all, laiemal pinnal nende kõrval. */}
        <div className={styles.sides} data-side={incident ? "1" : undefined}>
          <div>
            <ChoiceRow label={kind.label} options={kind.options} value={kind.value} onChange={kind.onChange} columns={incident ? 2 : 3} />
            <ChoiceRow label={contact.label} options={contact.options} value={contact.value} onChange={contact.onChange} columns={3} keepColumns />
          </div>
          {incident ? (
            <div className={shared.stack}>
              <p className={shared.notice}>{incident.notice}</p>
              <label className={shared.line}>
                <span className={shared.fieldLabel}>{incident.label}</span>
                <Dropdown value={incident.value} onChange={incident.onChange} ariaLabel={incident.label} placeholder={incident.label} options={incident.options} />
              </label>
            </div>
          ) : null}
        </div>
      </div>
    </StepPanel>
  );
}

/**
 * 2/4 Mida tegid.
 * `visit`: { question, rows, empty, onToggle(row), onDetail(row), detailLabel, doneLabel, criticalLabel,
 *   rest: { label, onRest } | null, other: { label, placeholder, options, loaded, busy, error, done, onLoad, onAdd } } või null;
 * `incident`: { label, options, values, onToggle } või null; `idle`: lause, kui märkida ei ole midagi.
 */
export function DoneView({ title, draft, visit, incident, idle, cancel = null }) {
  return (
    <StepPanel
      title={title}
      note={visit?.other.error ? footNote({ text: visit.other.error, tone: "risk" }) : ""}
      actions={
        visit?.rest || cancel ? (
          <>
            <Cancel cancel={cancel} />
            {visit?.rest ? (
              <Button type="button" size="sm" variant="primary" data-entry="rest" onClick={visit.rest.onRest}>
                {visit.rest.label}
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      <div className={shared.stack}>
        <Draft draft={draft} />
        {/* Käigul tehtud erijuhtumi kirje: toimingud ja erijuhtumi sammud on laiemal pinnal kõrvuti. */}
        <div className={styles.sides} data-side={visit && incident ? "1" : undefined}>
          {visit ? (
            <div className={shared.group}>
              <p className={shared.groupTitle}>{visit.question}</p>
              {visit.rows.length ? (
                <ul className={shared.rows}>
                  {visit.rows.map((row) => (
                    <li key={row.id} className={shared.item} data-activity={row.id}>
                      <button type="button" className={`${shared.row} ${styles.activity}`} aria-pressed={row.state === "done"} data-state={row.state || undefined} onClick={() => visit.onToggle(row)}>
                        <span className={styles.main}>
                          <span className={shared.rowTitle}>{row.name}</span>
                          {row.line ? (
                            <span className={styles.sub} data-wait={row.wait ? "1" : undefined}>
                              {row.line}
                            </span>
                          ) : null}
                        </span>
                        <span className={shared.rowMeta}>
                          {row.critical ? (
                            <span className={shared.chip} data-tone="wait">
                              {visit.criticalLabel}
                            </span>
                          ) : null}
                          {row.state === "done" ? <span className={shared.chip}>{visit.doneLabel}</span> : null}
                        </span>
                      </button>
                      <span className={shared.itemAside}>
                        <Button {...SMALL} className={shared.aside} data-activity-detail={row.id} aria-label={`${visit.detailLabel}: ${row.name}`} onClick={() => visit.onDetail(row)}>
                          {visit.detailLabel}
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={shared.quiet}>{visit.empty}</p>
              )}
              {/* Kavaväline toiming on harv: sõna loendi all, mitte nupp all servas. Kataloog laaditakse alles vajutusel. */}
              {visit.other.loaded ? null : (
                <div>
                  <button type="button" className={styles.wordButton} data-entry="other" aria-busy={visit.other.busy ? "true" : undefined} onClick={visit.other.onLoad}>
                    {visit.other.label}
                  </button>
                </div>
              )}
              {visit.other.loaded ? (
                visit.other.options.length ? (
                  <label className={shared.line}>
                    <span className={shared.fieldLabel}>{visit.other.label}</span>
                    <Dropdown value="" onChange={visit.other.onAdd} ariaLabel={visit.other.label} placeholder={visit.other.placeholder} options={visit.other.options} />
                  </label>
                ) : (
                  <p className={shared.hint}>{visit.other.done}</p>
                )
              ) : null}
            </div>
          ) : null}
          {incident ? <ChoiceChips label={incident.label} options={incident.options} values={incident.values} onToggle={incident.onToggle} columns={visit ? 1 : 2} /> : null}
        </div>
        {idle ? <p className={shared.quiet}>{idle}</p> : null}
      </div>
    </StepPanel>
  );
}

/**
 * Üks toiming: kuidas tehti, ravimitoimingul mida tehti, või miks jäi tegemata.
 * `mode`, `medication`, `skip`: { label, options, value, onChange } (kaks viimast võivad olla null).
 */
export function ActivityView({ title, name, mode, medication, skip, hint, clear, back }) {
  return (
    <StepPanel
      title={title}
      question={name}
      note={hint}
      actions={
        <>
          {clear ? (
            <Button {...SMALL} data-activity-clear="1" onClick={clear.onClear}>
              {clear.label}
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="primary" data-back="1" onClick={back.onBack}>
            {back.label}
          </Button>
        </>
      }
    >
      <div>
        <ChoiceRow label={mode.label} options={mode.options} value={mode.value} onChange={mode.onChange} columns={2} />
        {medication ? <ChoiceRow label={medication.label} options={medication.options} value={medication.value} onChange={medication.onChange} columns={3} keepColumns /> : null}
        {skip ? <ChoiceRow label={skip.label} options={skip.options} value={skip.value} onChange={skip.onChange} columns={3} keepColumns /> : null}
      </div>
    </StepPanel>
  );
}

/**
 * 3/4 Kestus ja aeg.
 * `minutes`: { label, options, value, onPick, inputLabel, onInput, max } või null (ei ole käik);
 * `occurred`: { label, hint, value, onChange }; `companion`: { label, options, value, onChange } või null.
 */
export function TimeView({ title, draft, minutes, occurred, companion, cancel = null }) {
  return (
    <StepPanel title={title} actions={cancel ? <Cancel cancel={cancel} /> : null}>
      <div className={shared.stack}>
        <Draft draft={draft} />
        {minutes ? (
          <div className={styles.minutes}>
            <ChoiceRow label={minutes.label} options={minutes.options} value={minutes.value} onChange={minutes.onPick} columns={5} keepColumns />
            <label className={shared.line} data-size="sm">
              <span className={shared.fieldLabel}>{minutes.inputLabel}</span>
              <Input className={shared.input} type="number" inputMode="numeric" min={1} max={minutes.max} value={minutes.value} onChange={(event) => minutes.onInput(event.target.value)} data-entry="minutes" />
            </label>
          </div>
        ) : null}
        <label className={`${shared.line} ${styles.when}`}>
          <span className={shared.fieldLabel}>{occurred.label}</span>
          <Input className={shared.input} type="datetime-local" value={occurred.value} onChange={(event) => occurred.onChange(event.target.value)} data-entry="occurred" />
          {occurred.hint ? <span className={shared.hint}>{occurred.hint}</span> : null}
        </label>
        {companion ? <PickOne label={companion.label} options={companion.options} value={companion.value} onChange={companion.onChange} columns={3} /> : null}
      </div>
    </StepPanel>
  );
}

/**
 * 4/4 Mida nägid.
 * `summary`: kokkuvõtte rida; `change`: { label, options, value, onAnswer, line, edit: { label, onEdit } | null } või null;
 * `text`: { label, hint, value, onChange, max }; `dictation`: dikteerimise osa; `cut`: teade, kui dikteeritud tekst ei mahtunud;
 * `assessment`: { label, value, onChange, max } või null; `reason`: { label, value, onChange, max } või null (paranduse põhjus);
 * `visibility`: kes kirjet näeb; `cancel`: { label, onCancel } või null;
 * `problem`: { text, fix: { label, onFix } | null } või null; `notice`: { text, tone } või null;
 * `save`: { label, busy, onSave }.
 */
export function TextView({ title, draft, summary, change, text, dictation, cut, assessment, reason = null, visibility, problem, notice, cancel = null, save }) {
  return (
    <StepPanel
      title={title}
      note={footNote(notice, problem ? problem.text : visibility)}
      actions={
        <>
          <Cancel cancel={cancel} />
          {problem?.fix ? (
            <Button {...SMALL} data-entry="fix" onClick={problem.fix.onFix}>
              {problem.fix.label}
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="primary" data-entry="save" aria-busy={save.busy ? "true" : undefined} onClick={save.onSave}>
            {save.label}
          </Button>
        </>
      }
    >
      <div className={shared.stack} aria-busy={save.busy ? "true" : undefined} inert={save.busy}>
        <Draft draft={draft} />
        {summary ? <p className={shared.small}>{summary}</p> : null}
        {/* Telefonis üksteise all (küsimus, tekst, dikteerimine, hinnang); laiemal pinnal on tekst vasakul
            ning küsimus ja dikteerimine selle kõrval, et vaade mahuks madalasse paneeli. */}
        <div className={styles.write}>
          {change ? (
            <div data-area="change">
              <ChoiceRow label={change.label} options={change.options} value={change.value} onChange={change.onAnswer} columns={2} keepColumns />
              {change.line ? (
                <p className={shared.small} data-entry="change-line">
                  {change.line}{" "}
                  {change.edit ? (
                    <button type="button" className={styles.textButton} data-entry="change-edit" onClick={change.edit.onEdit}>
                      {change.edit.label}
                    </button>
                  ) : null}
                </p>
              ) : null}
            </div>
          ) : null}
          <div data-area="text">
            <TextAreaField label={text.label} hint={text.hint} value={text.value} onChange={text.onChange} rows={4} maxLength={text.max} />
          </div>
          <div data-area="dictation">
            {dictation}
            {cut ? <p className={shared.notice}>{cut}</p> : null}
          </div>
          {assessment ? (
            <div data-area="assessment">
              <TextAreaField label={assessment.label} value={assessment.value} onChange={assessment.onChange} rows={2} maxLength={assessment.max} />
            </div>
          ) : null}
          {reason ? (
            <label className={shared.line} data-area="reason">
              <span className={shared.fieldLabel}>{reason.label}</span>
              <input className={shared.input} value={reason.value} onChange={(event) => reason.onChange(event.target.value)} maxLength={reason.max} autoComplete="off" data-entry="reason" />
            </label>
          ) : null}
        </div>
      </div>
    </StepPanel>
  );
}

/**
 * Mis oli teisiti kui tavaliselt. `areas`: { label, options, values, onToggle };
 * `usual`: [{ key, text }] (kuidas kliendil selles valdkonnas tavaliselt läheb);
 * `major`: { title, checked, onChange }; `back`: { label, onBack }.
 */
export function ChangeView({ title, areas, usual, major, hint, back }) {
  return (
    <StepPanel
      title={title}
      note={hint}
      actions={
        <Button type="button" size="sm" variant="primary" data-back="1" onClick={back.onBack}>
          {back.label}
        </Button>
      }
    >
      <div className={shared.stack}>
        <ChoiceChips label={areas.label} options={areas.options} values={areas.values} onToggle={areas.onToggle} columns={2} />
        {usual.length ? (
          <ul className={shared.lines}>
            {usual.map((item) => (
              <li key={item.key} className={shared.lineItem}>
                {item.text}
              </li>
            ))}
          </ul>
        ) : null}
        <CheckCard title={major.title} checked={major.checked} onChange={major.onChange} />
      </div>
    </StepPanel>
  );
}
