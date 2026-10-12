"use client";

/**
 * Kliendi lehe meeskonna vaated.
 *
 * MIKS. Meeskond oli pika lehe keskel üks lõik: nimede all nupud, lisamise vorm
 * ja selle all „Viimati avasid" ning „Seisu ajalugu" kõik üksteise all. Nüüd on
 * ees üks asi korraga.
 *  - `TeamView`   meeskond ridadena ja kaks rida, mis viivad „Viimati avasid" ja
 *                 „Seisu ajalugu" juurde; hooldusjuht avab liikme ja lisab töötaja
 *  - `MemberView` üks liige: eemaldamine küsib teist vajutust
 *  - `AddView`    „Lisa töötaja": valik asutuse töötajatest
 *  - `ListView`   „Viimati avasid" või „Seisu ajalugu": read täies pikkuses
 *
 * Siin on ainult kuju. Otsused on failis ./teamRows.js, olek ja päringud
 * konksus ./useClientTeam.js, kokku paneb need ./ClientTeam.jsx. Kujundus:
 * ./team.module.css ja organisatsioonide lehtede ühised osad
 * (../../org/org.module.css).
 */

import { PickOne, SMALL, footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";

import styles from "./team.module.css";

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

/** Nimi ja selle märk samal real; märk ei suru nime kitsaks, vaid murdub nime alla. */
const Who = ({ title, chip }) => (
  <span className={styles.who}>
    <span className={shared.rowTitle}>{title}</span>
    <Chip chip={chip} />
  </span>
);

/**
 * Meeskond.
 * `name`: kliendi nimi vaate ülaservas; `rows`: [{ key, title, chip, open }] (`open`: rida avab liikme);
 * `onOpen(key)` avab liikme; `empty`: lause, kui meeskonnas ei ole kedagi;
 * `lists`: [{ key, title, line, onOpen }] (read, mis viivad „Viimati avasid" ja „Seisu ajalugu" juurde);
 * `hint`: kes meeskonda näeb ja mida see annab (vaikne rida all servas) või tühi;
 * `more`: { label, onMore } või null; `add`: { label, busy, onAdd } või null.
 */
export function TeamView({ title, name, rows, onOpen, empty, lists, hint, busy, notice, more, add }) {
  return (
    <StepPanel
      title={title}
      question={name}
      note={footNote(notice, hint)}
      actions={
        more || add ? (
          <>
            {more ? (
              <Button {...SMALL} data-team="more" onClick={more.onMore}>
                {more.label}
              </Button>
            ) : null}
            {add ? (
              <Button type="button" size="sm" variant="primary" data-team="add" aria-busy={add.busy ? "true" : undefined} onClick={add.onAdd}>
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
                {row.open ? (
                  <button type="button" className={`${shared.row} ${styles.member}`} data-team-row={row.key} onClick={() => onOpen(row.key)}>
                    <Who title={row.title} chip={row.chip} />
                  </button>
                ) : (
                  <div className={`${shared.rowStatic} ${styles.member}`} data-team-row={row.key}>
                    <Who title={row.title} chip={row.chip} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className={shared.quiet}>{empty}</p>
        )}
        {lists.length ? (
          <ul className={shared.rows}>
            {lists.map((list) => (
              <li key={list.key} className={shared.rowItem}>
                <button type="button" className={shared.row} data-team-list={list.key} onClick={list.onOpen}>
                  <span className={shared.rowMain}>
                    <span className={shared.rowTitle}>{list.title}</span>
                    <span className={shared.rowSub}>{list.line}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Üks liige. `sheet`: { name, chip }; `actions`: [{ key, label, armed, onPress }]
 * (eemaldamine küsib teist vajutust samal lahtril); `consequence`: lause, mis juhtub (pärast esimest vajutust).
 */
export function MemberView({ title, sheet, actions, consequence, busy, notice, back }) {
  return (
    <StepPanel title={title} note={footNote(notice, consequence)} actions={<BackButton back={back} />}>
      <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
        <header className={shared.headBar}>
          <p className={shared.headName}>{sheet.name}</p>
          <Chip chip={sheet.chip} />
        </header>
        {actions.length ? (
          <div className={shared.cells} role="group" aria-label={sheet.name}>
            {actions.map((action) => (
              <button key={action.key} type="button" className={shared.cellButton} data-armed={action.armed ? "1" : undefined} data-team-action={action.key} onClick={action.onPress}>
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
 * „Lisa töötaja". `pick`: { label, options, value, onChange } (asutuse töötajad, kes ei ole veel meeskonnas);
 * `none`: lause, kui lisada ei ole kedagi; `form`: { id, onSubmit }; `save`: { label, busy, disabled }.
 */
export function AddView({ title, form, pick, none, save, notice, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      note={footNote(notice)}
      actions={
        <>
          <BackButton back={back} />
          {pick.options.length ? (
            <Button type="submit" form={form.id} size="sm" variant="primary" data-team="save" disabled={save.disabled} aria-busy={save.busy ? "true" : undefined}>
              {save.label}
            </Button>
          ) : null}
        </>
      }
    >
      <form id={form.id} className={shared.stack} onSubmit={form.onSubmit} aria-busy={save.busy ? "true" : undefined}>
        {pick.options.length ? <PickOne label={pick.label} options={pick.options} value={pick.value} onChange={pick.onChange} /> : <p className={shared.quiet}>{none}</p>}
      </form>
    </StepPanel>
  );
}

/**
 * „Viimati avasid" või „Seisu ajalugu". `rows`: [{ key, title, line }];
 * `more`: { label, onMore } või null. Vaatesse viib rida, mis on olemas ainult siis, kui ridu on.
 */
export function ListView({ title, rows, more, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      actions={
        <>
          <BackButton back={back} />
          {more ? (
            <Button {...SMALL} data-team="more" onClick={more.onMore}>
              {more.label}
            </Button>
          ) : null}
        </>
      }
    >
      <ul className={shared.rows}>
        {rows.map((row) => (
          <li key={row.key} className={shared.rowItem}>
            <div className={shared.rowStatic} data-team-entry={row.key}>
              <span className={styles.main}>
                <span className={shared.rowTitle}>{row.title}</span>
                {row.line ? <span className={styles.sub}>{row.line}</span> : null}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </StepPanel>
  );
}
