"use client";

/**
 * Kliendi lehe võtmete vaated.
 *
 * MIKS. Võtmed olid pika lehe keskel üks lõik: iga võtme all kolm nuppu ja
 * üleandmise vorm avanes rea sisse. Nüüd on ees üks asi korraga.
 *  - `KeysView`        võtmed ridadena: mis võti ja kelle käes
 *  - `KeyView`         üks võti ja mida sellega teha saab; lõpetamine
 *                      (tagastatud, kadunud) küsib teist vajutust
 *  - `KeyHandOverView` kellele võti antakse
 *  - `KeyAddView`      uus võti
 *
 * Siin on ainult kuju. Otsused on failis ./keyRows.js, olek ja päringud konksus
 * ./useClientKeys.js, kokku paneb need ./ClientKeys.jsx. Kujundus:
 * ./keys.module.css ja organisatsioonide lehtede ühised osad
 * (../../org/org.module.css).
 */

import { PickOne, SMALL, footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";

import styles from "./keys.module.css";

const BackButton = ({ back }) => (
  <Button {...SMALL} data-back="1" onClick={back.onBack}>
    {back.label}
  </Button>
);

/**
 * Võtmed. `name`: kliendi nimi vaate ülaservas; `rows`: [{ key, title, line, open }];
 * `onOpen(key)` avab võtme; `empty`: lause, kui võtmeid ei ole;
 * `hint`: vaikne rida all servas; `add`: { label, onAdd } või null (võtme lisab hooldusjuht).
 */
export function KeysView({ title, name, rows, onOpen, empty, hint, add }) {
  const body = (row) => (
    <span className={shared.rowMain}>
      <span className={`${shared.rowTitle} ${styles.made}`}>{row.title}</span>
      <span className={`${shared.rowSub} ${styles.made}`}>{row.line}</span>
    </span>
  );
  return (
    <StepPanel
      title={title}
      question={name}
      note={hint}
      actions={
        add ? (
          <Button {...SMALL} data-keys="add" onClick={add.onAdd}>
            {add.label}
          </Button>
        ) : null
      }
    >
      {rows.length ? (
        <ul className={shared.rows}>
          {rows.map((row) => (
            <li key={row.key} className={shared.rowItem}>
              {row.open ? (
                <button type="button" className={shared.row} data-key-row={row.key} onClick={() => onOpen(row.key)}>
                  {body(row)}
                </button>
              ) : (
                <div className={shared.rowStatic} data-key-row={row.key}>
                  {body(row)}
                </div>
              )}
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
 * Üks võti. `line`: kelle käes; `actions`: [{ key, label, armed, onPress }]
 * (lahtrid; lõpetamine küsib teist vajutust); `consequence`: lause, mis juhtub
 * (pärast esimest vajutust).
 */
export function KeyView({ title, line, actions, consequence, busy, notice, back }) {
  return (
    <StepPanel title={title} note={footNote(notice, consequence)} actions={<BackButton back={back} />}>
      <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
        <header className={shared.headBar}>
          <p className={`${shared.headName} ${styles.made}`}>{title}</p>
        </header>
        <p className={`${shared.quiet} ${styles.made}`} data-key="holder">
          {line}
        </p>
        <div className={shared.cells} role="group" aria-label={title}>
          {actions.map((action) => (
            <button key={action.key} type="button" className={shared.cellButton} data-armed={action.armed ? "1" : undefined} data-key-action={action.key} onClick={action.onPress}>
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </StepPanel>
  );
}

/** Kellele võti antakse. `pick`: { label, options, value, onChange }; `save`: { label, onSave, busy, disabled }. */
export function KeyHandOverView({ title, pick, save, notice, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      note={footNote(notice)}
      actions={
        <>
          <BackButton back={back} />
          <Button type="button" size="sm" variant="primary" data-keys="hand-over" disabled={save.disabled} aria-busy={save.busy ? "true" : undefined} onClick={save.onSave}>
            {save.label}
          </Button>
        </>
      }
    >
      <PickOne label={pick.label} options={pick.options} value={pick.value} onChange={pick.onChange} columns={2} />
    </StepPanel>
  );
}

/**
 * Uus võti. `form`: { id, onSubmit }; `tag`: { label, value, onChange, max } (ripatsi number);
 * `label`: { label, value, onChange, max } (mille võti); `holder`: { label, options, value, onChange };
 * `hint`: miks ripatsil on ainult number (vaikne rida all servas).
 */
export function KeyAddView({ title, form, tag, label, holder, hint, save, notice, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      note={footNote(notice, hint)}
      actions={
        <>
          <BackButton back={back} />
          <Button type="submit" form={form.id} size="sm" variant="primary" data-keys="save" disabled={save.disabled} aria-busy={save.busy ? "true" : undefined}>
            {save.label}
          </Button>
        </>
      }
    >
      <form id={form.id} className={shared.stack} onSubmit={form.onSubmit} aria-busy={save.busy ? "true" : undefined}>
        <div className={shared.pair}>
          <label className={`${shared.line} ${styles.tag}`}>
            <span className={shared.fieldLabel}>{tag.label}</span>
            <input className={shared.input} value={tag.value} onChange={(event) => tag.onChange(event.target.value)} maxLength={tag.max} autoComplete="off" required data-key-field="tag" />
          </label>
          <label className={shared.line}>
            <span className={shared.fieldLabel}>{label.label}</span>
            <input className={shared.input} value={label.value} onChange={(event) => label.onChange(event.target.value)} maxLength={label.max} autoComplete="off" data-key-field="label" />
          </label>
        </div>
        <PickOne label={holder.label} options={holder.options} value={holder.value} onChange={holder.onChange} columns={2} />
      </form>
    </StepPanel>
  );
}
