"use client";

/**
 * Eelpöördumise vastuvõtja vaated: tööjärg ja ühe pöördumise töö.
 *
 * MIKS. Vastuvõtja leht oli üks pikk sektsioonide rida (seaded, loend, valitud
 * pöördumine, tööplaan, struktureeritud eelinfo) ja loend näitas töövoo koodi
 * („READY"). Töö algab aga järjest: mis on uus ja kui kaua see on oodanud, mis
 * on minu töös ja millal on järgmine kontakt.
 *
 * VAATED (StepFlight-i sees, nimed on all kiirmenüüs):
 *  - `QueueView`     tööjärg: uued, minu töös, arhiiv; real seis ja üks põhitegevus
 *  - `InquiryView`   avatud pöördumine: mida inimene kirjutas, ja vastuvõtmine
 *  - `InfoView`      eelkaardistuse vastused ja Teekonnast jagatud info
 *  - `CheckView`     kontrollnimekiri: mis on enne järgmist kontakti üle vaadatud
 *  - `PlanView`      tööplaan: sisemine märge, järgmise kontakti kuupäev, arhiveerimine
 *  - `PrepareView`   kohtumise ettevalmistus (juhtumitöö plokk)
 *  - `NetworkView`   võrgustiku kaasamine sellest pöördumisest
 *  - `SettingsView`  kas võtan eelpöördumisi platvormil vastu
 *
 * Seisu ja järjekorra reegel on failis lib/preInquiryReceiverQueue.js; lehe
 * olek ja salvestamine on failis ../WorkspaceFeaturePage.jsx.
 *
 * Kujundus: receiver.module.css (siin kõrval), loendikaardid lists.module.css,
 * ühised väljad views.module.css.
 */

import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Input from "@/components/ui/Input";

import lists from "./lists.module.css";
import styles from "./receiver.module.css";
import views from "./views.module.css";

function QueueRow({ tr, row }) {
  return (
    <article className={`${lists.card} ${styles.row}`} data-selected={row.selected ? "true" : undefined}>
      <div className={styles.rowMain}>
        <h4 className={lists.cardTitle}>{row.title}</h4>
        <p className={styles.rowState}>
          <span className={lists.chip} data-tone={row.tone}>
            {row.state}
          </span>
          {row.meta ? <span className={lists.cardMeta}>{row.meta}</span> : null}
        </p>
        {row.excerpt ? <p className={styles.excerpt}>{row.excerpt}</p> : null}
      </div>
      <div className={styles.rowActions}>
        <Button type="button" size="sm" variant="primary" onClick={row.onOpen}>
          {tr("actions.open", "Ava")}
        </Button>
        {row.accept ? (
          <Button type="button" size="sm" variant="secondary" disabled={row.accept.busy} onClick={row.accept.onClick}>
            {row.accept.label}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

/** Tööjärg: rühma valik ja selle rühma pöördumised. `children`: lisaloend (võrgustiku jagamised). */
export function QueueView({ tr, groups, group, onGroup, rows, emptyText, children }) {
  return (
    <StepPanel title={tr("views.receiver.queue.title", "Tööjärg")}>
      <div className={views.stack}>
        <ChoiceRow
          label={tr("views.receiver.queue.groups", "Milliseid pöördumisi näidata")}
          labelHidden
          columns={groups.length}
          options={groups}
          value={group}
          onChange={onGroup}
        />
        {rows.length ? (
          <div className={lists.list}>
            {rows.map((row) => (
              <QueueRow key={row.id} tr={tr} row={row} />
            ))}
          </div>
        ) : (
          <p className={views.quiet}>{emptyText}</p>
        )}
        {children}
      </div>
    </StepPanel>
  );
}

/** Avatud pöördumine: teema, seis, inimese kirjeldus ja tema tekst. */
export function InquiryView({ tr, topic, meta, state, tone, situation, text, actions }) {
  return (
    <StepPanel title={tr("views.receiver.inquiry.title", "Pöördumine")} question={topic} lead={meta} actions={actions}>
      <div className={views.stack}>
        <p className={styles.state}>
          <span className={lists.chip} data-tone={tone}>
            {state}
          </span>
        </p>
        {situation ? <p className={styles.situation}>{situation}</p> : null}
        {text ? (
          <details className={views.fold}>
            <summary className={views.foldTitle}>{tr("views.receiver.inquiry.text", "Pöördumise tekst")}</summary>
            <p className={styles.text}>{text}</p>
          </details>
        ) : null}
      </div>
    </StepPanel>
  );
}

/** Eelinfo: eelkaardistuse vastused ja Teekonnast jagatud info (plokid annab leht). */
export function InfoView({ tr, empty, actions, children }) {
  return (
    <StepPanel title={tr("views.receiver.info.title", "Eelinfo")} actions={actions}>
      {empty ? <p className={views.quiet}>{tr("views.receiver.info.empty", "Pöörduja ei täitnud eelkaardistust. Kogu info on pöördumise tekstis.")}</p> : <div className={views.stack}>{children}</div>}
    </StepPanel>
  );
}

/** Kontroll: mis on enne järgmist kontakti üle vaadatud. Salvestub koos tööplaaniga. */
export function CheckView({ tr, checklist, onCheck, note, actions }) {
  return (
    <StepPanel
      title={tr("views.receiver.check.title", "Kontroll")}
      lead={tr("views.receiver.check.lead", "Mis on enne järgmist kontakti üle vaadatud. Seda näed ainult sina.")}
      note={note}
      actions={actions}
    >
      <div className={styles.checks} role="group" aria-label={tr("views.receiver.check.title", "Kontroll")}>
        {checklist.map((item) => (
          <Checkbox key={item.id} name={`receiver-workflow-${item.id}`} checked={item.checked} onChange={(checked) => onCheck(item.id, checked)} label={item.label} />
        ))}
      </div>
    </StepPanel>
  );
}

/** Tööplaan: sisemine märge ja järgmise kontakti kuupäev; siit ka arhiveerimine. */
export function PlanView({ tr, note, onNote, contactOn, onContactOn, footNote, actions }) {
  return (
    <StepPanel
      title={tr("views.receiver.plan.title", "Tööplaan")}
      lead={tr("views.receiver.plan.lead", "Ettevalmistus järgmiseks kontaktiks. Seda näed ainult sina, pöörduja ei näe.")}
      note={footNote}
      actions={actions}
    >
      <div className={styles.planFields}>
        <TextAreaField
          label={tr("fields.receiver_note", "Sisemine märge")}
          hint={tr("placeholders.receiver_note", "Mida on vaja enne järgmist kontakti täpsustada või ette valmistada?")}
          value={note}
          onChange={onNote}
          rows={4}
        />
        <label className={views.field} data-size="sm">
          <span className={views.fieldLabel}>{tr("fields.next_contact_on", "Järgmise kontakti kuupäev")}</span>
          <Input type="date" value={contactOn} onChange={(event) => onContactOn(event.target.value)} />
        </label>
      </div>
    </StepPanel>
  );
}

/** Kohtumise ettevalmistus: juhtumitöö plokk tuleb lehelt. */
export function PrepareView({ tr, children }) {
  return <StepPanel title={tr("views.receiver.prepare.title", "Ettevalmistus")}>{children}</StepPanel>;
}

/** Võrgustiku kaasamine sellest pöördumisest: vorm tuleb lehelt. */
export function NetworkView({ tr, children }) {
  return (
    <StepPanel
      title={tr("views.receiver.network.title", "Võrgustik")}
      lead={tr("views.receiver.network.lead", "Kui selle inimese abistamiseks on vaja teist spetsialisti, kaasa ta siit. Inimene otsustab ise, kas ta jagamisega nõustub.")}
    >
      {children}
    </StepPanel>
  );
}

/** Vastuvõtu seaded: kas minu kontole saab platvormis eelpöördumisi saata. */
export function SettingsView({ tr, canToggle, accepts, onAccepts, note, saving, onSave }) {
  return (
    <StepPanel
      title={tr("sections.receiving_settings", "Vastuvõtt")}
      actions={
        canToggle ? (
          <Button type="button" variant="primary" disabled={saving} onClick={onSave}>
            {saving ? tr("actions.saving", "Salvestan...") : tr("actions.save_preferences", "Salvesta vastuvõtt")}
          </Button>
        ) : null
      }
    >
      <div className={views.stack}>
        {canToggle ? <Checkbox checked={accepts} onChange={(value) => onAccepts(Boolean(value))} label={tr("receiving.accepts_platform", "Võtan eelpöördumisi platvormil vastu")} /> : null}
        <p className={views.quiet}>{note}</p>
      </div>
    </StepPanel>
  );
}
