"use client";

/**
 * Seadmes ootavate kirjete vaated.
 *
 * MIKS. Kast ootavate kirjetega seisis lehe ülaservas täies pikkuses: iga
 * kirje tekst, veateade, selgitused ja nupud. Kliendi lehel lükkas see vaate
 * „Ukse taga" ekraanilt välja just siis, kui hooldajal ei olnud levi.
 *  - `OutboxNoticeRow` üks lause vaate kohal: mitu kirjet ootab ja kas mõni
 *                      vajab inimese sammu; sõna lause lõpus avab loendi
 *  - `OutboxListView`  ootavad kirjed: kelle kohta, mis seisus, tekst ja mida
 *                      teha; all „Saada kohe"
 *
 * Siin on ainult kuju. Otsused on failis ./outboxRows.js, järjekord ise failis
 * `../homeCareOutbox.js`; kokku paneb need ./OutboxPanel.jsx. Kujundus:
 * ./outbox.module.css ja organisatsioonide lehtede ühised osad.
 */

import { ArmedButton, SMALL, footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";

import styles from "./outbox.module.css";

/**
 * Lause vaate kohal. `notice`: { title, line, wait }; `open`: sõna, mis avab loendi.
 * Lause, mitte rida: laud ja „Ukse taga" on mõõdetud paneeli täpselt täis ja
 * terve rea kõrgus lükkaks need üle serva.
 */
export function OutboxNoticeRow({ notice, open, onOpen }) {
  return (
    <p className={`${shared.notice} ${styles.notice}`} data-outbox="notice" data-wait={notice.wait ? "1" : undefined}>
      <span className={styles.title}>{notice.title}</span> <span>{notice.line}</span>{" "}
      <button type="button" className={styles.textButton} data-outbox="open" onClick={onOpen}>
        {open}
      </button>
    </p>
  );
}

/**
 * Ootavad kirjed.
 * `rows`: [{ key, name, chip: { text, wait }, written, text, reason, hint, canRetry, canDelete }];
 * `retry`: { label, onRetry(key), busy }; `remove`: { armedKey, label, confirm, consequence, onPress(key) }
 *   (pärast esimest vajutust seisab kirje all lause, mis juhtub);
 * `done`: lause, kui midagi enam ei oota; `problem`: lause, kui järjekord on täis;
 * `send`: { label, onSend, busy } või null; `hint`: selgitus all servas.
 */
export function OutboxListView({ title, rows, retry, remove, done, problem, hint, send, back }) {
  return (
    <StepPanel
      title={title}
      question={rows.length ? title : done}
      note={footNote(problem ? { text: problem, tone: "risk" } : null, rows.length ? hint : "")}
      actions={
        <>
          <Button {...SMALL} data-back="1" onClick={back.onBack}>
            {back.label}
          </Button>
          {send ? (
            <Button type="button" size="sm" variant="primary" data-outbox="send" aria-busy={send.busy ? "true" : undefined} onClick={send.onSend}>
              {send.label}
            </Button>
          ) : null}
        </>
      }
    >
      {rows.length ? (
        <ul className={shared.lines} aria-live="polite">
          {rows.map((row) => (
            <li key={row.key} className={`${shared.lineItem} ${styles.item}`} data-outbox-item={row.key}>
              <span className={styles.head}>
                <span className={shared.rowTitle}>{row.name}</span>
                <span className={shared.chip} data-tone={row.chip.wait ? "wait" : undefined}>
                  {row.chip.text}
                </span>
              </span>
              <span className={styles.meta}>{row.written}</span>
              {row.text ? <span className={shared.own}>{row.text}</span> : null}
              {row.reason ? <span className={styles.meta}>{row.reason}</span> : null}
              {row.hint ? <span className={shared.small}>{row.hint}</span> : null}
              {row.canRetry || row.canDelete ? (
                <span className={styles.actions}>
                  {row.canRetry ? (
                    <Button {...SMALL} data-outbox-retry={row.key} aria-busy={retry.busy ? "true" : undefined} onClick={() => retry.onRetry(row.key)}>
                      {retry.label}
                    </Button>
                  ) : null}
                  {row.canDelete ? (
                    <ArmedButton armed={remove.armedKey === row.key} label={remove.label} confirm={remove.confirm} onPress={() => remove.onPress(row.key)} mark={`outbox-delete:${row.key}`} />
                  ) : null}
                </span>
              ) : null}
              {remove.armedKey === row.key ? (
                <span className={styles.consequence} data-outbox-note="1">
                  {remove.consequence}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </StepPanel>
  );
}
