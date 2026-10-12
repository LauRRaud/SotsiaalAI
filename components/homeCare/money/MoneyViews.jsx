"use client";

/**
 * Kliendi lehe raha vaated.
 *
 * MIKS. Kliendi raha oli pika lehe keskel üks lõik: jääk, kõik read üksteise
 * all ja vorm nende järel. Nüüd on ees üks asi korraga.
 *  - `MoneyView`      jääk, hooldusjuhil ka see, kelle käes raha on, ja arvestuse
 *                     read (esimene lehekülg ja „Näita veel"); oma värske rida
 *                     avaneb
 *  - `MoneyEntryView` üks rida ja selle tühistamine (küsib teist vajutust)
 *  - `MoneyAddView`   uus rida: mis rahaga juhtus, summa ja mille jaoks
 *
 * See on arvestus, mitte makse. Siin on ainult kuju. Otsused on failis
 * ./moneyRows.js, olek ja päringud konksus ./useClientMoney.js, kokku paneb
 * need ./ClientMoney.jsx. Kujundus: ./money.module.css ja organisatsioonide
 * lehtede ühised osad (../../org/org.module.css).
 */

import { SMALL, footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";

import styles from "./money.module.css";

/**
 * Jääk ja arvestuse read.
 * `balance`: { text, held }; `holders`: { title, rows: [{ key, text }] } või null (hooldusjuhile);
 * `rows`: [{ key, title, line, amount, retract }]; `onOpen(key)` avab rea, mille saab tühistada;
 * `empty`: lause, kui ridu ei ole; `hint`: vaikne rida all servas;
 * `more`: { label, onMore } või null; `add`: { label, onAdd } või null.
 */
export function MoneyView({ title, balance, holders, rows, onOpen, empty, busy, notice, hint, more, add }) {
  const body = (row) => (
    <>
      <span className={styles.main}>
        <span className={shared.rowTitle}>{row.title}</span>
        {row.line ? <span className={shared.rowSub}>{row.line}</span> : null}
      </span>
      {/* Summa on rea enda teine veerg (mitte märkide rühm): telefonis jääb see pealkirja kõrvale. */}
      <span className={styles.amount}>{row.amount}</span>
    </>
  );
  return (
    <StepPanel
      title={title}
      question={balance.text}
      note={footNote(notice, hint)}
      actions={
        more || add ? (
          <>
            {more ? (
              <Button {...SMALL} data-money="more" onClick={more.onMore}>
                {more.label}
              </Button>
            ) : null}
            {add ? (
              <Button type="button" size="sm" variant="primary" data-money="add" onClick={add.onAdd}>
                {add.label}
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
        {holders ? (
          <section className={shared.group} data-money="holders" aria-label={holders.title}>
            <p className={styles.caption}>{holders.title}</p>
            <div className={shared.facts}>
              {holders.rows.map((row) => (
                <p key={row.key} className={`${shared.quiet} ${styles.line}`}>
                  {row.text}
                </p>
              ))}
            </div>
          </section>
        ) : null}
        {rows.length ? (
          <ul className={shared.rows}>
            {rows.map((row) => (
              <li key={row.key} className={shared.rowItem}>
                {row.retract ? (
                  <button type="button" className={`${shared.row} ${styles.entry}`} data-money-row={row.key} onClick={() => onOpen(row.key)}>
                    {body(row)}
                  </button>
                ) : (
                  <div className={`${shared.rowStatic} ${styles.entry}`} data-money-row={row.key}>
                    {body(row)}
                  </div>
                )}
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
 * Üks rida ja selle tühistamine. `row`: { title, line, amount };
 * `retract`: { label, armed, onPress } (lahter küsib teist vajutust);
 * `consequence`: lause, mis juhtub (pärast esimest vajutust).
 */
export function MoneyEntryView({ title, row, retract, consequence, busy, notice, back }) {
  return (
    <StepPanel
      title={title}
      note={footNote(notice, consequence)}
      actions={
        <Button {...SMALL} data-back="1" onClick={back.onBack}>
          {back.label}
        </Button>
      }
    >
      <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
        <header className={shared.headBar}>
          <p className={shared.headName}>{row.title}</p>
          <span className={styles.amount}>{row.amount}</span>
        </header>
        {row.line ? <p className={shared.own}>{row.line}</p> : null}
        <div className={shared.cells}>
          <button type="button" className={shared.cellButton} data-armed={retract.armed ? "1" : undefined} data-money="retract" onClick={retract.onPress}>
            {retract.label}
          </button>
        </div>
      </div>
    </StepPanel>
  );
}

/**
 * Uus rida. `form`: { id, onSubmit }; `kind`: { label, options, value, onChange };
 * `amount`: { label, value, onChange }; `note`: { label, hint, value, onChange, max, required };
 * `intro`: mis see arvestus on (vaikne rida all servas).
 */
export function MoneyAddView({ title, form, kind, amount, note, intro, save, notice, back }) {
  return (
    <StepPanel
      title={title}
      note={footNote(notice, intro)}
      actions={
        <>
          <Button {...SMALL} data-back="1" onClick={back.onBack}>
            {back.label}
          </Button>
          <Button type="submit" form={form.id} size="sm" variant="primary" data-money="save" disabled={save.disabled} aria-busy={save.busy ? "true" : undefined}>
            {save.label}
          </Button>
        </>
      }
    >
      <form id={form.id} className={shared.stack} onSubmit={form.onSubmit} aria-busy={save.busy ? "true" : undefined}>
        <ChoiceRow label={kind.label} options={kind.options} value={kind.value} onChange={kind.onChange} columns={3} />
        <div className={shared.pair}>
          <label className={`${shared.line} ${styles.sum}`}>
            <span className={shared.fieldLabel}>{amount.label}</span>
            <input className={shared.input} value={amount.value} onChange={(event) => amount.onChange(event.target.value)} inputMode="decimal" maxLength={10} autoComplete="off" required data-money-field="amount" />
          </label>
          <label className={`${shared.line} ${styles.what}`}>
            <span className={shared.fieldLabel}>{note.label}</span>
            <input className={shared.input} value={note.value} onChange={(event) => note.onChange(event.target.value)} maxLength={note.max} autoComplete="off" required={note.required} data-money-field="note" />
            {note.hint ? <span className={shared.hint}>{note.hint}</span> : null}
          </label>
        </div>
      </form>
    </StepPanel>
  );
}
