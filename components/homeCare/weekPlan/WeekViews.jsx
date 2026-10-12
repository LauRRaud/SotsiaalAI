"use client";

/**
 * Nädalaplaani vaated.
 *
 * MIKS. Nädalaplaan oli üks pikk leht: seitse päeva ühel real, selle all iga
 * töötaja oma seitsmest lahtrist koosnev plokk. Nüüd on ees üks asi korraga.
 *  - `WeekView`   nädala päevad ühel real (iga lahter viib selle päeva plaani),
 *                 selle all töötajad ridadena (määramata käigud ees); nädalate vahetus
 *  - `WorkerView` ühe töötaja nädal: kokkuvõte ja tema seitse päeva ühel real
 *
 * Siin on ainult kuju. Otsused on failis ./weekPlanRows.js, päring konksus
 * ./useWeekPlan.js, kokku paneb need ./WeekPlan.jsx. Kujundus: ./weekPlan.module.css
 * ja organisatsioonide lehtede ühised osad (../../org/org.module.css).
 */

import Link from "next/link";

import { footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import StepPanel from "@/components/stage/StepPanel";

import { Actions, Chip } from "../client/PartViews";
import styles from "./weekPlan.module.css";

/** Seitse päeva ühel real; iga lahter on link selle päeva plaani. `cells`: [{ key, day, letter, count, note, tone, label, today }]. */
function Strip({ cells, label, hrefOf }) {
  return (
    <div className={styles.strip} role="group" aria-label={label}>
      {cells.map((cell) => (
        <Link key={cell.key} href={hrefOf(cell.day)} prefetch={false} className={styles.cell} data-tone={cell.tone || undefined} data-today={cell.today ? "1" : undefined} aria-label={cell.label} data-week-cell={cell.key}>
          <span className={styles.letter} aria-hidden="true">
            {cell.letter}
          </span>
          <span className={styles.count} aria-hidden="true">
            {cell.count}
          </span>
          {cell.note ? (
            <span className={styles.note} aria-hidden="true">
              {cell.note}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

/**
 * Nädal. `heading`: nädala pealkiri; `totals`: nädala kokkuvõte; `days`: päevade lahtrid; `hrefOf(day)`: päeva plaani aadress;
 * `rows`: [{ key, title, chip, line, tone }] (töötajad); `onOpen(key)`; `empty`: lause, kui nädalal ei ole midagi (või tühi);
 * `legend`: mida lahtrid ütlevad (vaikne rida lahtrite all); `hint`: vaikne rida all servas;
 * `actions`: [{ key, label, onPress, disabled }] (nädalate vahetus).
 */
export function WeekView({ title, heading, totals, days, hrefOf, daysLabel, rows, onOpen, empty, legend, hint, busy, notice, actions }) {
  return (
    <StepPanel title={title} question={heading} lead={totals} note={footNote(notice, hint)} actions={<Actions actions={actions} />}>
      <div className={shared.stack} aria-busy={busy ? "true" : undefined} data-part-view="week">
        <Strip cells={days} label={daysLabel} hrefOf={hrefOf} />
        {empty ? <p className={shared.quiet}>{empty}</p> : legend ? <p className={shared.quiet}>{legend}</p> : null}
        {rows.length ? (
          <ul className={shared.rows}>
            {rows.map((row) => (
              <li key={row.key} className={shared.rowItem}>
                <button type="button" className={`${shared.row} ${styles.row}`} data-part-row={row.key} onClick={() => onOpen(row.key)}>
                  <span className={styles.main}>
                    <span className={styles.who}>
                      <span className={row.tone === "risk" ? `${shared.rowTitle} ${styles.risk}` : shared.rowTitle}>{row.title}</span>
                      <Chip chip={row.chip} />
                    </span>
                    <span className={styles.sub}>{row.line}</span>
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

/** Ühe töötaja (või määramata käikude) nädal. `name`, `chip`, `totals`, `days`, `hrefOf`; `back`: { label, onBack }. */
export function WorkerView({ title, name, chip, totals, days, hrefOf, back, notice }) {
  return (
    <StepPanel title={title} note={footNote(notice)} actions={<Actions back={back} />}>
      <div className={shared.stack} data-part-view="worker">
        <header className={shared.headBar}>
          <p className={shared.headName}>{name}</p>
          <Chip chip={chip} />
        </header>
        <p className={shared.quiet}>{totals}</p>
        <Strip cells={days} label={name} hrefOf={hrefOf} />
      </div>
    </StepPanel>
  );
}
