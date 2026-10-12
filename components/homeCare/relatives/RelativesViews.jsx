"use client";

/**
 * Kliendi lehe lähedaste ja esindusõiguse vaated.
 *
 * MIKS. Lähedased ja esindusõigus olid pika lehe keskel kaks lõiku: iga nime
 * all nupud ning vormid kuue ja kaheksa väljaga loendi sees. Nüüd on ees üks
 * asi korraga.
 *  - `RelativesView`           lähedased ridadena (mida talle rääkida võib ja
 *                              millest mitte) ja rida, mis viib esindusõiguse juurde
 *  - `RelativeView`            üks lähedane: telefon, aste, kahtlus; eemaldamine
 *                              küsib teist vajutust
 *  - `RelativeWhoView`         vormi esimene vaade: kes ta on
 *  - `RelativeShareView`       vormi teine vaade: mida klient lubab talle rääkida
 *  - `SharingCardView`         jagamiskaart: mis leht see on ja selle avamine
 *  - `RepresentativesView`     esindajad ridadena
 *  - `RepresentativeView`      üks esindaja; lõpetamine küsib teist vajutust
 *  - `RepresentativeWhoView`   uue esindaja esimene vaade: kes ja mille alusel
 *  - `RepresentativeMoreView`  teine vaade: kehtivus ja dokument
 *
 * Siin on ainult kuju. Otsused on failis ./relativeRows.js, olek ja päringud
 * konksudes ./useClientRelatives.js, kokku paneb need ./ClientRelatives.jsx.
 * Kujundus: ./relatives.module.css ja organisatsioonide lehtede ühised osad
 * (../../org/org.module.css).
 */

import { useRef } from "react";

import { Facts, SMALL, footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import styles from "./relatives.module.css";

const BackButton = ({ back }) => (
  <Button {...SMALL} data-back="1" onClick={back.onBack}>
    {back.label}
  </Button>
);

/** Põhitegevus all servas: vormi saatmine (`form`) või vajutus (`onPress`). `action`: { label, onPress, busy, disabled }. */
const MainButton = ({ action, form, mark }) => (
  <Button type={form ? "submit" : "button"} form={form} size="sm" variant="primary" data-relatives={mark} disabled={action.disabled} aria-busy={action.busy ? "true" : undefined} onClick={form ? undefined : action.onPress}>
    {action.label}
  </Button>
);

/** Märk. `chip`: { text, tone } või null. */
const Chip = ({ chip }) =>
  chip ? (
    <span className={shared.chip} data-tone={chip.tone || undefined}>
      {chip.text}
    </span>
  ) : null;

/** Tekstiväli sildiga. `field`: { label, value, onChange, max, required, type }; `size`: "wide" (lause) või "name" (nimi, telefon). */
function TextField({ field, mark, size = "name" }) {
  return (
    <label className={`${shared.line} ${size === "wide" ? styles.wide : styles.name}`}>
      <span className={shared.fieldLabel}>{field.label}</span>
      <input className={shared.input} type={field.type || "text"} value={field.value} onChange={(event) => field.onChange(event.target.value)} maxLength={field.max} required={field.required} autoComplete="off" data-relative-field={mark} />
    </label>
  );
}

/** Päev brauseri enda valijaga. `field`: { label, value, onChange }. */
function DayField({ field, mark }) {
  return (
    <label className={`${shared.line} ${styles.day}`}>
      <span className={shared.fieldLabel}>{field.label}</span>
      <Input className={shared.input} type="date" value={field.value} onChange={(event) => field.onChange(event.target.value)} data-relative-field={mark} />
    </label>
  );
}

/** Tegevuslahtrid. `actions`: [{ key, label, armed, onPress }]; lahter, mis kustutab või lõpetab, küsib teist vajutust. */
function ActionCells({ actions, label }) {
  if (!actions.length) return null;
  return (
    <div className={shared.cells} role="group" aria-label={label}>
      {actions.map((action) => (
        <button key={action.key} type="button" className={shared.cellButton} data-armed={action.armed ? "1" : undefined} data-relative-action={action.key} onClick={action.onPress}>
          {action.label}
        </button>
      ))}
    </div>
  );
}

const ARROW_STEP = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

/**
 * Jagamisaste: kolm lauset üksteise all (aste ja mida see lubab). Raadiorühm
 * rändava tabulatsiooniga nagu valikulahtritel; laused on liiga pikad, et
 * seista kõrvuti.
 */
function LevelPick({ pick }) {
  const groupRef = useRef(null);
  const selected = pick.options.findIndex((option) => option.value === pick.value);
  const onKeyDown = (event, index) => {
    const step = ARROW_STEP[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + pick.options.length) % pick.options.length;
    pick.onChange(pick.options[next].value);
    groupRef.current?.querySelectorAll("button")[next]?.focus();
  };
  return (
    <div className={shared.group} role="radiogroup" aria-label={pick.label} ref={groupRef}>
      <p className={shared.groupTitle}>{pick.label}</p>
      <div className={styles.levels}>
        {pick.options.map((option, index) => {
          const checked = index === selected;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              className={styles.levelOption}
              aria-checked={checked}
              tabIndex={checked || (selected < 0 && index === 0) ? 0 : -1}
              data-relative-level={option.value}
              onClick={() => pick.onChange(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {/* Lause algab suure tähega; esitähe reegel ei kehti lahtril endal (see on joondatud rida), küll aga selle sees oleval tekstil. */}
              <span className={styles.made}>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* --- Lähedased ---------------------------------------------------------------------- */

/**
 * Lähedased.
 * `name`: kliendi nimi vaate ülaservas; `rows`: [{ key, title, lines, chip }]; `onOpen(key)` avab lähedase;
 * `empty`: lause, kui lähedasi ei ole; `rule`: mida lähedasele rääkida tohib (vaikne rida all servas);
 * `representation`: { title, line, chip, onOpen } või null (rida, mis viib esindusõiguse juurde);
 * `card`: { label, onOpen } või null (jagamiskaart); `add`: { label, onAdd } või null.
 */
export function RelativesView({ title, name, rows, onOpen, empty, rule, representation, busy, notice, card, add }) {
  return (
    <StepPanel
      title={title}
      question={name}
      note={footNote(notice, rule)}
      actions={
        card || add ? (
          <>
            {card ? (
              <Button {...SMALL} data-relatives="card" onClick={card.onOpen}>
                {card.label}
              </Button>
            ) : null}
            {add ? (
              <Button type="button" size="sm" variant="primary" data-relatives="add" onClick={add.onAdd}>
                {add.label}
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
        {rows.length ? (
          <ul className={shared.rows}>
            {rows.map((row) => (
              <li key={row.key} className={shared.rowItem}>
                <button type="button" className={`${shared.row} ${styles.relative}`} data-relative-row={row.key} onClick={() => onOpen(row.key)}>
                  {/* Märk käib nime juurde: ta ei tohi teksti veergu kitsaks suruda. */}
                  <span className={styles.who}>
                    <span className={shared.rowTitle}>{row.title}</span>
                    <Chip chip={row.chip} />
                  </span>
                  {/* Mida rääkida võib ja millest mitte: read murduvad, midagi ei lõigata. */}
                  <span className={styles.main}>
                    {row.lines.map((line) => (
                      <span key={line} className={`${styles.sub} ${styles.made}`}>
                        {line}
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={shared.quiet}>{empty}</p>
        )}
        {representation ? (
          <ul className={shared.rows}>
            <li className={shared.rowItem}>
              <button type="button" className={shared.row} data-relatives="representation" onClick={representation.onOpen}>
                <span className={shared.rowMain}>
                  <span className={shared.rowTitle}>{representation.title}</span>
                  <span className={shared.rowSub}>{representation.line}</span>
                </span>
                <Chip chip={representation.chip} />
              </button>
            </li>
          </ul>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Üks lähedane. `sheet`: { name, chip, phone: { text, href } | null, level, noTell, agreed, doubt };
 * `actions`: [{ key, label, armed, onPress }]; `consequence`: lause, mis juhtub (pärast esimest vajutust).
 */
export function RelativeView({ title, sheet, actions, consequence, busy, notice, back }) {
  return (
    <StepPanel title={title} note={footNote(notice, consequence)} actions={<BackButton back={back} />}>
      <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
        <header className={shared.headBar}>
          <p className={shared.headName}>{sheet.name}</p>
          <Chip chip={sheet.chip} />
        </header>
        {sheet.doubt ? (
          <p className={shared.notice} data-relative="doubt">
            {sheet.doubt}
          </p>
        ) : null}
        <p className={`${styles.level} ${styles.made}`} data-relative="level">
          {sheet.level}
        </p>
        {sheet.noTell ? (
          <p className={`${shared.notice} ${styles.made}`} data-relative="no-tell">
            {sheet.noTell}
          </p>
        ) : null}
        <div className={styles.contact}>
          {sheet.phone ? (
            <a className={styles.tel} href={sheet.phone.href} data-relative="tel">
              {sheet.phone.text}
            </a>
          ) : null}
          <span className={`${shared.quiet} ${styles.made}`}>{sheet.agreed}</span>
        </div>
        <ActionCells actions={actions} label={sheet.name} />
      </div>
    </StepPanel>
  );
}

/**
 * Vormi esimene vaade: kes ta on. `form`: { id, onSubmit } (saatmine viib edasi);
 * `name`, `relation`, `phone`: { label, value, onChange, max }; `next`: { label, disabled }.
 */
export function RelativeWhoView({ title, form, name, relation, phone, next, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      actions={
        <>
          <BackButton back={back} />
          <MainButton action={next} form={form.id} mark="next" />
        </>
      }
    >
      <form id={form.id} className={shared.stack} onSubmit={form.onSubmit}>
        <TextField field={{ ...name, required: true }} mark="name" />
        <div className={shared.pair}>
          <TextField field={relation} mark="relation" />
          <TextField field={{ ...phone, type: "tel" }} mark="phone" />
        </div>
      </form>
    </StepPanel>
  );
}

/**
 * Vormi teine vaade: mida klient lubab talle rääkida. `who`: kelle kohta;
 * `level`: { label, options, value, onChange }; `noTell`: { label, value, onChange, max };
 * `hint`: kuidas kokkulepe sünnib (vaikne rida all servas).
 */
export function RelativeShareView({ title, who, form, level, noTell, hint, save, notice, back }) {
  return (
    <StepPanel
      title={title}
      question={who}
      note={footNote(notice, hint)}
      actions={
        <>
          <BackButton back={back} />
          <MainButton action={save} form={form.id} mark="save" />
        </>
      }
    >
      <form id={form.id} className={shared.stack} onSubmit={form.onSubmit} aria-busy={save.busy ? "true" : undefined}>
        <LevelPick pick={level} />
        <TextField field={noTell} mark="no-tell" size="wide" />
      </form>
    </StepPanel>
  );
}

/**
 * Jagamiskaart: kokkulepe paberil kliendi koju. `text`: mis sellel lehel on;
 * `open`: { label, onPress, busy } (leht avaneb uues aknas ja prinditakse brauserist).
 */
export function SharingCardView({ title, text, open, notice, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      note={footNote(notice)}
      actions={
        <>
          <BackButton back={back} />
          <MainButton action={open} mark="card-open" />
        </>
      }
    >
      <p className={shared.quiet}>{text}</p>
    </StepPanel>
  );
}

/* --- Esindusõigus ------------------------------------------------------------------- */

/**
 * Esindajad. `rows`: [{ key, title, line, chip }]; `onOpen(key)` avab esindaja;
 * `empty`: lause, kui esindajat ei ole; `add`: { label, onAdd } või null (lisab hooldusjuht).
 */
export function RepresentativesView({ title, rows, onOpen, empty, busy, notice, add, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      note={footNote(notice)}
      actions={
        <>
          <BackButton back={back} />
          {add ? (
            <Button type="button" size="sm" variant="primary" data-relatives="rep-add" onClick={add.onAdd}>
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
                <button type="button" className={shared.row} data-representative-row={row.key} onClick={() => onOpen(row.key)}>
                  <span className={shared.rowMain}>
                    <span className={shared.rowTitle}>{row.title}</span>
                    <span className={`${shared.rowSub} ${styles.made}`}>{row.line}</span>
                  </span>
                  <Chip chip={row.chip} />
                </button>
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
 * Üks esindaja. `sheet`: { name, chip, basis, scope, period, phone, lines };
 * `labels`: { basis, scope } (ridade nimetused); `actions`: [{ key, label, armed, onPress }];
 * `consequence`: lause, mis juhtub (pärast esimest vajutust).
 */
export function RepresentativeView({ title, sheet, labels, actions, consequence, busy, notice, back }) {
  return (
    <StepPanel title={title} note={footNote(notice, consequence)} actions={<BackButton back={back} />}>
      <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
        <header className={shared.headBar}>
          <p className={shared.headName}>{sheet.name}</p>
          <Chip chip={sheet.chip} />
        </header>
        <Facts
          rows={[
            { key: "basis", label: labels.basis, value: sheet.basis },
            { key: "scope", label: labels.scope, value: sheet.scope }
          ]}
        />
        <div className={styles.contact}>
          {sheet.phone ? (
            <a className={styles.tel} href={sheet.phone.href} data-relative="tel">
              {sheet.phone.text}
            </a>
          ) : null}
          <span className={`${shared.quiet} ${styles.made}`}>{sheet.period}</span>
        </div>
        <div className={shared.facts}>
          {sheet.lines.map((line) => (
            <p key={line} className={`${shared.quiet} ${styles.made}`}>
              {line}
            </p>
          ))}
        </div>
        <ActionCells actions={actions} label={sheet.name} />
      </div>
    </StepPanel>
  );
}

/**
 * Uue esindaja esimene vaade: kes ja mille alusel. `form`: { id, onSubmit } (saatmine viib edasi);
 * `name`: { label, value, onChange, max }; `basis`: { label, options, value, onChange };
 * `scope`: { label, hint, value, onChange, max }; `next`: { label, disabled }.
 */
export function RepresentativeWhoView({ title, form, name, basis, scope, next, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      note={scope.hint}
      actions={
        <>
          <BackButton back={back} />
          <MainButton action={next} form={form.id} mark="rep-next" />
        </>
      }
    >
      <form id={form.id} className={shared.stack} onSubmit={form.onSubmit}>
        <TextField field={{ ...name, required: true }} mark="rep-name" />
        <ChoiceRow label={basis.label} options={basis.options} value={basis.value} onChange={basis.onChange} columns={3} />
        <TextField field={{ ...scope, required: true }} mark="rep-scope" size="wide" />
      </form>
    </StepPanel>
  );
}

/**
 * Uue esindaja teine vaade: kehtivus ja dokument. `who`: kelle kohta;
 * `from`, `until`, `checked`: { label, value, onChange } (päev kujul 2026-10-14);
 * `phone`, `copy`: { label, value, onChange, max }; `hints`: vaiksed laused all servas.
 */
export function RepresentativeMoreView({ title, who, form, from, until, checked, phone, copy, hints, save, notice, back }) {
  return (
    <StepPanel
      title={title}
      question={who}
      note={footNote(notice, hints)}
      actions={
        <>
          <BackButton back={back} />
          <MainButton action={save} form={form.id} mark="rep-save" />
        </>
      }
    >
      <form id={form.id} className={shared.stack} onSubmit={form.onSubmit} aria-busy={save.busy ? "true" : undefined}>
        <div className={styles.days}>
          <DayField field={from} mark="rep-from" />
          <DayField field={until} mark="rep-until" />
          <DayField field={checked} mark="rep-checked" />
        </div>
        <div className={shared.pair}>
          <TextField field={{ ...phone, type: "tel" }} mark="rep-phone" />
          <TextField field={copy} mark="rep-copy" />
        </div>
      </form>
    </StepPanel>
  );
}
