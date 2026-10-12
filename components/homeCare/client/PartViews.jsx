"use client";

/**
 * Kliendi lehe osade ühised vaated: loend ridadena, üks kirje lahtritega ja vorm
 * väljadena. Osa ise otsustab, mis ridadel ja väljadel seisab (reeglite fail) ja
 * mis juhtub vajutusega (kokkupanija); siin on ainult kuju.
 *
 *  - `RowsView`   read (avatavad või loetavad), vajadusel rühm ridu all ja
 *                 „Näita veel"
 *  - `DetailView` üks kirje: nimi ja märk, laused, sõnade read ja tegevuslahtrid
 *                 (kustutav või lõpetav lahter küsib teist vajutust)
 *  - `FormView`   vorm väljadena: tekst, tekstiala, päev ja kellaaeg, valik,
 *                 märkeruut ja vaikne rida
 *
 * Reeglid, mis kehtivad kõigil vaadetel: üks vaade hoiab ühte asja; midagi ei
 * venitata paneeli laiuseks peale pika teksti; märk käib rea pealkirja juurde;
 * tagajärje lause on vaate all servas. Kujundus: ./partViews.module.css ja
 * organisatsioonide lehtede ühised osad (../../org/org.module.css).
 */

import Link from "next/link";

import { Facts, PickOne, SMALL, footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";

import styles from "./partViews.module.css";

/** Tagasi-nupp. `back`: { label, onBack }. */
export const BackButton = ({ back }) => (
  <Button {...SMALL} data-back="1" onClick={back.onBack}>
    {back.label}
  </Button>
);

/** Märk. `chip`: { text, tone } või null. */
export const Chip = ({ chip }) =>
  chip ? (
    <span className={shared.chip} data-tone={chip.tone || undefined}>
      {chip.text}
    </span>
  ) : null;

/** Tegevused all servas: `[{ key, label, onPress, primary, busy, mark }]`; tagasi-nupp on esimene. */
function Actions({ back, actions = [] }) {
  if (!back && !actions.length) return null;
  return (
    <>
      {back ? <BackButton back={back} /> : null}
      {actions.map((action) =>
        action.primary ? (
          <Button key={action.key} type="button" size="sm" variant="primary" data-part-action={action.key} disabled={action.disabled} aria-busy={action.busy ? "true" : undefined} onClick={action.onPress}>
            {action.label}
          </Button>
        ) : (
          <Button key={action.key} {...SMALL} data-part-action={action.key} disabled={action.disabled} onClick={action.onPress}>
            {action.label}
          </Button>
        )
      )}
    </>
  );
}

/** Rea sisu: pealkiri (ja märk selle kõrval) ning selle all read täies pikkuses. `row`: { title, chip, line, lines }. */
function RowBody({ row }) {
  const lines = row.lines || (row.line ? [row.line] : []);
  return (
    <span className={styles.main}>
      <span className={styles.who}>
        <span className={row.tone === "risk" ? `${shared.rowTitle} ${styles.risk}` : shared.rowTitle}>{row.title}</span>
        <Chip chip={row.chip} />
      </span>
      {lines.map((line) => (
        <span key={line} className={styles.sub}>
          {line}
        </span>
      ))}
    </span>
  );
}

/**
 * Read. `rows`: [{ key, title, chip, line, lines, tone, open }] (`open`: rida avab kirje, muidu on see loetav);
 * `onOpen(key)`; `empty`: lause, kui ridu ei ole; `hint`: vaikne rida all servas;
 * `links`: [{ key, title, line, chip, onOpen, href }] (rühm ridu all: need viivad mujale; `href`: link, mis ei eellaadi);
 * `more`: { label, onMore } või null; `actions`: [{ key, label, onPress, primary, busy }]; `back`: { label, onBack } või null;
 * `lead`: lühike juhis vaate ülaservas.
 */
export function RowsView({ title, question, lead, rows, onOpen, empty, hint, notice, busy, more, links = [], actions = [], back, mark = "rows" }) {
  const all = more ? [{ key: "more", label: more.label, onPress: more.onMore }, ...actions] : actions;
  return (
    <StepPanel title={title} question={question ?? title} lead={lead} note={footNote(notice, hint)} actions={<Actions back={back} actions={all} />}>
      <div className={shared.stack} aria-busy={busy ? "true" : undefined} data-part-view={mark}>
        {rows.length ? (
          <ul className={shared.rows}>
            {rows.map((row) => (
              <li key={row.key} className={shared.rowItem}>
                {row.open === false ? (
                  <div className={`${shared.rowStatic} ${styles.row}`} data-part-row={row.key}>
                    <RowBody row={row} />
                  </div>
                ) : (
                  <button type="button" className={`${shared.row} ${styles.row}`} data-part-row={row.key} onClick={() => onOpen(row.key)}>
                    <RowBody row={row} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : empty ? (
          <p className={shared.quiet}>{empty}</p>
        ) : null}
        {links.length ? (
          <ul className={shared.rows}>
            {links.map((link) => (
              <li key={link.key} className={shared.rowItem}>
                {link.href ? (
                  <Link href={link.href} prefetch={false} className={`${shared.row} ${styles.row}`} data-part-link={link.key}>
                    <RowBody row={link} />
                  </Link>
                ) : (
                  <button type="button" className={`${shared.row} ${styles.row}`} data-part-link={link.key} onClick={link.onOpen}>
                    <RowBody row={link} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Üks kirje. `head`: { name, chip }; `notices`: [{ key, text }] (rahulikud laused); `facts`: [{ key, label, value }];
 * `body`: tekst täies pikkuses või tühi; `cells`: [{ key, label, armed, onPress }] (kustutav või lõpetav lahter küsib teist vajutust);
 * `consequence`: lause, mis juhtub (pärast esimest vajutust); `actions`, `back`: nagu `RowsView`-l.
 */
export function DetailView({ title, question, head, notices = [], facts = [], body = "", cells = [], consequence = "", notice, busy, actions = [], back, children, mark = "detail" }) {
  return (
    <StepPanel title={title} question={question} note={footNote(notice, consequence)} actions={<Actions back={back} actions={actions} />}>
      <div className={shared.stack} aria-busy={busy ? "true" : undefined} data-part-view={mark}>
        {head ? (
          <header className={shared.headBar}>
            <p className={shared.headName}>{head.name}</p>
            <Chip chip={head.chip} />
          </header>
        ) : null}
        {notices.map((item) => (
          <p key={item.key} className={shared.notice} data-part-notice={item.key}>
            {item.text}
          </p>
        ))}
        {body ? (
          <p className={shared.own} data-part-body="1">
            {body}
          </p>
        ) : null}
        {facts.length ? <Facts rows={facts} /> : null}
        {children}
        {cells.length ? (
          <div className={shared.cells} role="group" aria-label={title}>
            {cells.map((cell) => (
              <button key={cell.key} type="button" className={shared.cellButton} data-armed={cell.armed ? "1" : undefined} data-part-cell={cell.key} onClick={cell.onPress}>
                {cell.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Väli. `field`: { kind, key, label, value, onChange, ... }:
 *  - "text":  { max, required, type ("text" | "tel" | "number"), size ("wide" | "name" | "short") }
 *  - "area":  { max, rows, required, readOnly }
 *  - "day" / "time": { min, max, required }
 *  - "pick":  { options: [{ value, label }], columns }
 *  - "check": { label } (märkeruut; `value` on tõene või väär)
 *  - "note":  { text } (vaikne rida)
 */
function Field({ field }) {
  const mark = field.key;
  if (field.kind === "note") return <p className={shared.quiet}>{field.text}</p>;
  if (field.kind === "pick") return <PickOne label={field.label} options={field.options} value={field.value} onChange={field.onChange} columns={field.columns || 3} />;
  if (field.kind === "check") return <Checkbox className={styles.check} label={field.label} checked={Boolean(field.value)} disabled={field.disabled} onChange={field.onChange} data-part-field={mark} />;
  if (field.kind === "area") {
    return (
      <label className={`${shared.line} ${styles.wide}`}>
        <span className={shared.fieldLabel}>{field.label}</span>
        <Textarea className={shared.input} value={field.value} onChange={(event) => field.onChange(event.target.value)} rows={field.rows || 3} maxLength={field.max} required={field.required} readOnly={field.readOnly} data-part-field={mark} />
      </label>
    );
  }
  if (field.kind === "day" || field.kind === "time") {
    return (
      <label className={`${shared.line} ${styles.short}`}>
        <span className={shared.fieldLabel}>{field.label}</span>
        <Input className={shared.input} type={field.kind === "day" ? "date" : "time"} value={field.value} min={field.min || undefined} max={field.max || undefined} onChange={(event) => field.onChange(event.target.value)} required={field.required} data-part-field={mark} />
      </label>
    );
  }
  const size = field.size === "short" ? styles.short : field.size === "name" ? styles.name : styles.wide;
  return (
    <label className={`${shared.line} ${size}`}>
      <span className={shared.fieldLabel}>{field.label}</span>
      <input className={shared.input} type={field.type || "text"} value={field.value} onChange={(event) => field.onChange(event.target.value)} maxLength={field.max} required={field.required} autoComplete="off" data-part-field={mark} />
    </label>
  );
}

/**
 * Vorm. `form`: { id, onSubmit }; `fields`: väljade kirjeldused (vt `Field`); `hint`: vaikne rida all servas (või tagajärje lause);
 * `save`: { label, busy, disabled, armed } (põhitegevus all servas); `back`: { label, onBack }; `extra`: [{ key, label, onPress }] (kõrvaltegevused).
 */
export function FormView({ title, question, lead, form, fields, hint, save, notice, back, extra = [] }) {
  return (
    <StepPanel
      title={title}
      question={question ?? title}
      lead={lead}
      note={footNote(notice, hint)}
      actions={
        <>
          <Actions back={back} actions={extra} />
          <Button type="submit" form={form.id} size="sm" variant="primary" className={save.armed ? shared.armed : undefined} data-part-action="save" disabled={save.disabled} aria-busy={save.busy ? "true" : undefined}>
            {save.label}
          </Button>
        </>
      }
    >
      <form id={form.id} className={shared.stack} onSubmit={form.onSubmit} aria-busy={save.busy ? "true" : undefined}>
        {fields.map((field) => (
          <Field key={field.key} field={field} />
        ))}
      </form>
    </StepPanel>
  );
}
