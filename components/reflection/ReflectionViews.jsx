"use client";

/**
 * Meetodipeegli vaated: kirjete loend, avatud kirje väljade vaated, kahe
 * versiooni võrdlus ja kirje andmed.
 *
 * MIKS. Leht oli klaaspaneeli sees veel üks tume kaart oma pealkirjaga ning
 * vorm üks pikk veerg: kaksteist tekstikasti ja kaks rippvalikut, salvestamine
 * lehe lõpus. Nüüd on igal asjal oma vaade sammulaval (`components/stage`):
 * üks loend, kuni kolm välja või üks võrdlus korraga.
 *
 * Siin on ainult kuju. Andmed, päringud ja olek on failis ./ReflectionPage.jsx,
 * vormi kirjeldus ja arvutused failis ./reflectionForm.js; vaade saab valmis
 * read, väljad ja tegevused.
 *
 * PRIVAATSUSMÄRGIS ON PÜSIELEMENT (sama reegel mis supervisioonis): kirje on
 * alati ainult omaniku oma ja seda ütleb märk igas vaates, mitte kohtspikker.
 * Loendis seisab märk ülal, avatud kirje vaadetes paneeli alaservas (`FootNote`).
 *
 * Kujundus: reflection.module.css (siin kõrval).
 */

import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";

import styles from "./reflection.module.css";

function PrivacyChip({ text }) {
  return (
    <span className={styles.chip} data-privacy="private">
      {text}
    </span>
  );
}

/**
 * Paneeli alaserva rida: privaatsusmärgis, seotud tegevus ja viimase toimingu
 * teade. Läheb `StepPanel`-i `note` kohale, mis on juba `aria-live` piirkond.
 */
export function FootNote({ privacy, source, status }) {
  return (
    <span className={styles.footNote}>
      <PrivacyChip text={privacy} />
      {source ? <span className={styles.chip}>{source}</span> : null}
      {status?.text ? (
        <span className={styles.status} data-tone={status.tone}>
          {status.text}
        </span>
      ) : null}
    </span>
  );
}

/* Teade loendi kohal. `aria-live`, mitte status-roll: ühine lehekiht joonistab
   iga status-rolliga elemendi omal moel (värv ja vahed), mida see teade ei taha. */
function Notice({ text, tone, action }) {
  if (!text) return null;
  return (
    <div className={styles.notice} data-tone={tone} aria-live="polite">
      <span className={styles.noticeText}>{text}</span>
      {action ? (
        <Button type="button" size="sm" variant="secondary" disabled={action.busy} onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

/** Kirjete loend: uus kirje, read (rida avab kirje) ja järgmine lehekülg. */
export function ListView({ title, lead, privacy, loading, loadingText, error, create, notice, undo, rows, emptyText, more }) {
  return (
    <StepPanel title={title} lead={lead}>
      <div className={styles.stack}>
        <div className={styles.top}>
          {create ? (
            <Button type="button" size="sm" variant="primary" onClick={create.onClick}>
              {create.label}
            </Button>
          ) : (
            <span />
          )}
          <PrivacyChip text={privacy} />
        </div>
        <Notice text={notice?.text} tone={notice?.tone} />
        {/* Kustutatud kirje: teade ja tagasivõtmine seisavad koos, kuni tagasivõtmise aeg kestab. */}
        <Notice text={undo?.text} action={undo} />
        {loading ? <p className={styles.quiet}>{loadingText}</p> : null}
        {error ? <Notice text={error.text} tone="risk" action={error.retry} /> : null}
        {!loading && !error ? (
          rows.length ? (
            <ul className={styles.rows}>
              {rows.map((row) => (
                <li key={row.id} className={styles.item}>
                  <button type="button" className={styles.row} data-selected={row.selected ? "true" : undefined} aria-busy={row.busy || undefined} onClick={row.onOpen}>
                    <span className={styles.rowTitle}>{row.title}</span>
                    <span className={styles.rowMeta}>
                      {row.outcome ? <span className={styles.chip}>{row.outcome}</span> : null}
                      <span className={styles.time}>{row.date}</span>
                    </span>
                    <span className={styles.rowOpen}>
                      {row.openText}
                      <span aria-hidden="true"> ›</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.quiet}>{emptyText}</p>
          )
        ) : null}
        {!loading && !error && more ? (
          <Button type="button" size="sm" variant="secondary" className={styles.more} disabled={more.busy} onClick={more.onClick}>
            {more.label}
          </Button>
        ) : null}
      </div>
    </StepPanel>
  );
}

function Field({ field, onChange }) {
  if (field.kind === "choice") {
    return (
      <div className={styles.choice}>
        <ChoiceRow label={field.label} options={field.options} columns={field.columns} value={field.value} onChange={(next) => onChange(field.key, next)} />
        {/* Valik ei ole kohustuslik. Rida on alati olemas, et vaade valimisel ei hüppaks. */}
        <div className={styles.clearLine}>
          {field.value ? (
            <button type="button" className={styles.textButton} onClick={() => onChange(field.key, "")}>
              {field.clearLabel}
            </button>
          ) : null}
        </div>
      </div>
    );
  }
  /* Päritolumärgis on välja nime küljes ja struktuurne: kasutaja ei saa seda
     ümber valida (kliendi öeldu, töötaja tähelepanek ja tõlgendus ei segune). */
  const label = field.chip ? (
    <>
      {field.label}
      <span className={styles.provenance} data-provenance={field.provenance}>
        {field.chip}
      </span>
    </>
  ) : (
    field.label
  );
  return <TextAreaField label={label} value={field.value} rows={field.rows} maxLength={field.maxLength} onChange={(next) => onChange(field.key, next)} />;
}

/** Avatud kirje üks vaade: kuni kolm välja; rida on üks väli või kaks kõrvuti. */
export function FormView({ title, lead, layout, onChange, note, actions }) {
  return (
    <StepPanel title={title} lead={lead} note={note} actions={actions}>
      <div className={styles.fields}>
        {layout.map((row) =>
          row.length > 1 ? (
            <div key={row[0].key} className={styles.pair}>
              {row.map((field) => (
                <Field key={field.key} field={field} onChange={onChange} />
              ))}
            </div>
          ) : (
            <Field key={row[0].key} field={row[0]} onChange={onChange} />
          )
        )}
      </div>
    </StepPanel>
  );
}

/** Kaks versiooni: ainult väljad, mis erinevad, minu tekst ja serveri tekst kõrvuti. */
export function ConflictView({ title, lead, rows, mineLabel, serverLabel, emptyText, sameText, note, actions }) {
  const side = (who, text) => (
    <div className={styles.diffSide}>
      <span className={styles.diffWho}>{who}</span>
      <p className={styles.diffText} data-empty={text ? undefined : "true"}>
        {text || emptyText}
      </p>
    </div>
  );
  return (
    <StepPanel title={title} lead={lead} note={note} actions={actions}>
      {rows.length ? (
        <ul className={styles.diffs}>
          {rows.map((row) => (
            <li key={row.key} className={styles.diff}>
              <h4 className={styles.diffField}>{row.label}</h4>
              <div className={styles.diffPair}>
                {side(mineLabel, row.mine)}
                {side(serverLabel, row.theirs)}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.quiet}>{sameText}</p>
      )}
    </StepPanel>
  );
}

/** Kirje andmed: millega kirje on seotud, millal see loodi ja salvestati; siit ka kustutamine ja sulgemine. */
export function EntryView({ title, newText, facts, hint, note, actions }) {
  return (
    <StepPanel title={title} note={note} actions={actions}>
      <div className={styles.stack}>
        {newText ? <p className={styles.quiet}>{newText}</p> : null}
        {facts.length ? (
          <dl className={styles.facts}>
            {facts.map((fact) => (
              <div key={fact.key} className={styles.fact}>
                <dt className={styles.factLabel}>{fact.label}</dt>
                <dd className={styles.factValue}>
                  {fact.value}
                  {fact.note ? <span className={styles.factNote}>{fact.note}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        {hint ? <p className={styles.quiet}>{hint}</p> : null}
      </div>
    </StepPanel>
  );
}
