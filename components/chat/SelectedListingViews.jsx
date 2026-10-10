"use client";

/**
 * Avatud abikuulutuse vaated: laadimine, avamise tõrge, lugemine, ühendamise
 * valik ja muutmise vorm.
 *
 * MIKS. Avatud kuulutus oli üks pikk leht vanal ühisel kihil: oma päis
 * tagasinoolega, seis ja „Minu kuulutus" palja „|" kahel pool, kast kasti sees,
 * selle all korraga faktid, üheksa väljaga vorm rippvalikutega ning ühendamise
 * rippvalik. Nüüd on korraga ees üks asi ja vaated vahetuvad loendi asemel
 * kohapeal (nagu materjalide lehel, `components/materials/views/`):
 *  - `ReadView`     mida kuulutus ütleb: tekst, märgid, faktid ja tegevused.
 *                   Oma kuulutusel „Muuda" ja kustutamine, mis küsib teist
 *                   vajutust samal nupul; võõral tee ühendamise juurde.
 *  - `ConnectView`  millise oma kuulutusega ühendus võetakse, ja saatmine
 *  - `EditView`     muutmise vorm neljas osas (sakid); üks salvestamine katab
 *                   kõik osad, sest server salvestab kuulutuse ühe päringuga
 *
 * Siin on ainult kuju. Otsused (mis vaade, mis faktid, mis valikud) on failis
 * ./selectedListingSheet.js; olek ja vajutuste reeglid failis
 * ./SelectedListingContext.jsx; andmed ja päringud lehel
 * (`components/alalehed/ChatBody.jsx`).
 *
 * Kujundus: selectedListing.module.css (siin kõrval); märk, vaikne lause ja
 * teade on loendi omad (helpListings.module.css).
 */

import { useId } from "react";

import ChoiceChips from "@/components/stage/ChoiceChips";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Form from "@/components/ui/Form";
import Input from "@/components/ui/Input";

import list from "./helpListings.module.css";
import styles from "./selectedListing.module.css";
import {
  EDIT_LIMITS,
  categoryOptions,
  counterText,
  editPartOptions,
  helpTypeOptions,
  targetGroupOptions,
  timeTypeOptions,
  toggleTargetGroup
} from "./selectedListingSheet";

const SMALL_BUTTON = Object.freeze({ type: "button", size: "sm", variant: "secondary" });

/* All hoitud Enter või tühik (klahvikordus) ei tohi sama nuppu teist korda
   vajutada: kustutamise ja loobumise esimene ja teine aste on sama nupp. */
function ignoreKeyRepeat(event) {
  if (event.repeat && (event.key === "Enter" || event.key === " ")) event.preventDefault();
}

/* All hoitud Enter väljal ei saada vormi: klahvikordus jõuab väljale kohe. */
function blockRepeatEnter(event) {
  if (event.repeat && event.key === "Enter") event.preventDefault();
}

/**
 * Vaate teade paneeli all servas (`StepPanel note`): tõrge hoiatava tooniga,
 * muu teade rahulikult. Teate puudumisel vaate enda vaikne lause.
 */
function footNote(notice, quiet = "") {
  if (!notice?.text) return quiet;
  return notice.tone === "risk" ? <span className={styles.footError}>{notice.text}</span> : notice.text;
}

/* Tee tagasi: loendisse (loendi sees) või akna sulgemine (modaalis). */
function BackAction({ back }) {
  return (
    <Button {...SMALL_BUTTON} onClick={back.onClick}>
      {back.label}
    </Button>
  );
}

/** Faktid: nimetus ja väärtus paarina, paarid reas üksteise järel. */
function Facts({ facts }) {
  if (!facts.length) return null;
  return (
    <dl className={styles.facts}>
      {facts.map((fact) => (
        <div key={fact.key} className={styles.fact} data-wide={fact.wide ? "1" : undefined}>
          <dt className={styles.factLabel}>{fact.label}</dt>
          <dd className={styles.factValue}>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Kuulutust alles laaditakse. Tagasitee on olemas: aeglane võrk ei hoia inimest kinni. */
export function LoadingView({ t, ui, back }) {
  return (
    <StepPanel title={t("chat.help.opened.views.read.title")} actions={<BackAction back={back} />}>
      <p className={list.quiet} aria-live="polite">
        {ui.loading}
      </p>
    </StepPanel>
  );
}

/** Kuulutust ei saanud avada: lause ütleb seda ja tagasitee viib loendisse. */
export function MissingView({ t, error, back }) {
  return (
    <StepPanel title={t("chat.help.opened.views.read.title")} actions={<BackAction back={back} />}>
      <p className={list.notice} role="alert">
        {error}
      </p>
    </StepPanel>
  );
}

/**
 * Avatud kuulutus. Esimene rida on kuulutuse enda pealkiri (lehe nime ütleb
 * kiirmenüü), siis märgid, tekst ja faktid.
 *
 * `remove`: kustutamine küsib teist vajutust SAMAL nupul ja tagajärg seisab
 * nupu kõrval. Aste ise on lehe olekus (`remove.armed`): esimene vajutus küsib,
 * teine kustutab, „Loobu" võtab küsimuse tagasi. Nuppu päringu ajaks välja ei
 * lülitata (see viiks klaviatuuri fookuse ära); topeltsaatmist hoiab komponendi
 * lukk.
 */
export function ReadView({ t, ui, sheet, notice, back, onEdit, onConnect, remove }) {
  const noteId = useId();
  return (
    <StepPanel
      title={t("chat.help.opened.views.read.title")}
      question={sheet.title}
      note={footNote(notice)}
      actions={
        <>
          <BackAction back={back} />
          {onEdit ? (
            <Button type="button" size="sm" variant="primary" onClick={onEdit}>
              {ui.edit}
            </Button>
          ) : null}
          {onConnect ? (
            <Button type="button" size="sm" variant="primary" onClick={onConnect}>
              {sheet.connectLabel}
            </Button>
          ) : null}
        </>
      }
    >
      <div className={list.stack}>
        {sheet.chips.length ? (
          <p className={styles.line}>
            {sheet.chips.map((chip) => (
              <span key={chip.key} className={list.chip} data-tone={chip.tone}>
                {chip.text}
              </span>
            ))}
          </p>
        ) : null}
        {/* Tekst on TEKST: sisu tuleb React'i lapsena, mitte HTML-ina. */}
        {sheet.text ? <p className={styles.text}>{sheet.text}</p> : null}
        <Facts facts={sheet.facts} />
        {remove ? (
          <div
            className={remove.busy ? `${styles.confirm} ${styles.busy}` : styles.confirm}
            data-armed={remove.armed ? "1" : undefined}
            aria-busy={remove.busy ? "true" : undefined}
          >
            <span className={styles.buttons}>
              <Button
                {...SMALL_BUTTON}
                data-danger="true"
                className={remove.armed ? `${styles.danger} ${styles.armed}` : styles.danger}
                aria-describedby={noteId}
                onKeyDown={ignoreKeyRepeat}
                onClick={remove.onPress}
              >
                {remove.armed ? t("chat.help.opened.deleteArmed") : ui.delete}
              </Button>
              {remove.armed ? (
                <Button {...SMALL_BUTTON} onClick={remove.onCancel}>
                  {ui.cancel}
                </Button>
              ) : null}
            </span>
            <p className={`${list.quiet} ${styles.confirmNote}`} id={noteId}>
              {t("chat.help.opened.deleteNote")}
            </p>
          </div>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Ühendamise valik: millise oma avatud kuulutusega ühendus võetakse. Saatmine
 * läheb teisele inimesele nõusolekupäringuna, seepärast on see omaette vaade ja
 * mitte üks vajutus loendist.
 *
 * Kui oma sobivat kuulutust ei ole, ütleb vaade, mida on vaja, ja saatmise
 * nuppu ei ole. Kui päring on juba teel (`notice.sent`), ütleb vaade seda ja
 * teist korda saata ei pakuta.
 */
export function ConnectView({ t, ui, sheet, choice, notice, busy, back, onSelect, onSubmit }) {
  const canSend = choice.options.length > 0 && !notice.sent;
  return (
    <StepPanel
      title={t("chat.help.opened.views.connect.title")}
      question={canSend ? choice.question : undefined}
      lead={notice.sent ? undefined : choice.none || undefined}
      note={footNote(notice.sent ? null : notice)}
      actions={
        <>
          <BackAction back={back} />
          {canSend ? (
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={!choice.value}
              aria-busy={busy ? "true" : undefined}
              onKeyDown={ignoreKeyRepeat}
              onClick={onSubmit}
            >
              {busy ? t("chat.help.opened.connectBusy") : sheet.connectLabel}
            </Button>
          ) : null}
        </>
      }
    >
      <div className={busy ? `${list.stack} ${styles.busy}` : list.stack} aria-busy={busy ? "true" : undefined}>
        {/* Millise kuulutusega ühendus võetakse: avatud kuulutuse nimi on igas vaates näha. */}
        <p className={styles.fact}>
          <span className={styles.factLabel}>{t("chat.help.opened.aboutListing")}</span>
          <span className={styles.factValue}>{sheet.title}</span>
        </p>
        {sheet.closed ? <p className={list.quiet}>{ui.statusClosed}</p> : null}
        {notice.sent ? (
          <p className={styles.text} aria-live="polite">
            {notice.text}
          </p>
        ) : null}
        {canSend ? (
          <>
            <ChoiceRow label={choice.question} labelHidden options={choice.options} value={choice.value} onChange={onSelect} columns={choice.columns} />
            <p className={list.quiet}>{t("chat.help.opened.connectLead")}</p>
          </>
        ) : null}
      </div>
    </StepPanel>
  );
}

/* Üherealine väli sildiga; loendur ilmub alles siis, kui väli hakkab täis saama. */
function LineField({ t, label, size, value, max, onChange }) {
  const counter = counterText(value, max, t);
  return (
    <label className={styles.field} data-size={size}>
      <span className={styles.fieldLabel}>{label}</span>
      <Input className={styles.input} value={value} maxLength={max} autoComplete="off" onChange={(event) => onChange(event.target.value)} />
      {counter ? <span className={styles.counter}>{counter}</span> : null}
    </label>
  );
}

/**
 * Muutmise vorm. Üheksa välja ei mahu ühte vaatesse, seepärast on vorm neljas
 * osas ja osad on sakkidena kohe näha (ühelaiused lahtrid): tekst, kategooria,
 * abi liik ja aeg sihtrühmaga, koht ja tingimused. Valikud on lahtrid, mitte
 * rippvalikud; väli on nii lai kui selle sisu, täislai on ainult pikk tekst.
 *
 * ÜKS SALVESTAMINE. Server salvestab kuulutuse ühe päringuga, seega salvestab
 * „Salvesta" kõigi osade muudatused korraga ja vaade ütleb seda all servas.
 * Välju saatmise ajaks ei lukustata (lukustamine viiks fookuse ära).
 *
 * `form`: { part, onPart, values, onField, notice, busy, discardArmed,
 *           onCancel, onSubmit }
 */
export function EditView({ t, ui, form }) {
  const { values } = form;
  const quiet = form.discardArmed ? t("chat.help.opened.discardNote") : t("chat.help.opened.saveAllNote");
  return (
    <Form className={styles.form} validate={false} onSubmit={form.onSubmit} onKeyDown={blockRepeatEnter}>
      <StepPanel
        title={t("chat.help.opened.views.edit.title")}
        /* Kui loobumine küsib teist vajutust, on all servas selle tagajärg, mitte vana tõrge. */
        note={footNote(form.discardArmed ? null : form.notice, quiet)}
        actions={
          <>
            <Button {...SMALL_BUTTON} className={form.discardArmed ? styles.armed : undefined} onKeyDown={ignoreKeyRepeat} onClick={form.onCancel}>
              {form.discardArmed ? t("chat.help.opened.discardArmed") : ui.cancel}
            </Button>
            <Button type="submit" size="sm" variant="primary" aria-busy={form.busy ? "true" : undefined}>
              {form.busy ? t("chat.help.opened.saving") : ui.save}
            </Button>
          </>
        }
      >
        <div className={form.busy ? `${list.stack} ${styles.busy}` : list.stack} aria-busy={form.busy ? "true" : undefined}>
          <ChoiceRow label={t("chat.help.opened.editPartsLabel")} labelHidden options={editPartOptions(t)} value={form.part} onChange={form.onPart} columns={4} />

          {/* Ühe osa väljad: vahe tuleb väljade endi polstrist, mitte vaate üldisest vahest. */}
          <div className={styles.part}>
            {form.part === "text" ? (
              <>
                <LineField t={t} label={ui.title} size="lg" value={values.title} max={EDIT_LIMITS.title} onChange={(value) => form.onField("title", value)} />
                <TextAreaField
                  label={ui.description}
                  hint={counterText(values.description, EDIT_LIMITS.description, t) || undefined}
                  value={values.description}
                  onChange={(value) => form.onField("description", value)}
                  rows={6}
                  maxLength={EDIT_LIMITS.description}
                />
              </>
            ) : null}

            {/* Osa nimi („Kategooria") on sakil: valikurea silt jääb ekraanilugejale. */}
            {form.part === "category" ? (
              <ChoiceRow
                label={ui.category}
                labelHidden
                options={categoryOptions(t)}
                value={values.primaryCategoryCode}
                onChange={(value) => form.onField("primaryCategoryCode", value)}
              />
            ) : null}

            {form.part === "form" ? (
              <>
                <ChoiceRow label={ui.helpType} options={helpTypeOptions(ui, t)} value={values.helpType} onChange={(value) => form.onField("helpType", value)} columns={4} />
                <ChoiceRow label={ui.timeType} options={timeTypeOptions(ui, t)} value={values.timeType} onChange={(value) => form.onField("timeType", value)} columns={4} />
                <ChoiceChips
                  label={ui.targetGroups}
                  options={targetGroupOptions(t)}
                  values={values.targetGroupCodes}
                  onToggle={(code) => form.onField("targetGroupCodes", toggleTargetGroup(values.targetGroupCodes, code))}
                />
              </>
            ) : null}

            {form.part === "terms" ? (
              <>
                <div className={styles.pair}>
                  <LineField t={t} label={ui.location} size="sm" value={values.rawPlace} max={EDIT_LIMITS.rawPlace} onChange={(value) => form.onField("rawPlace", value)} />
                  <LineField
                    t={t}
                    label={ui.compensationDetails}
                    value={values.compensationDetails}
                    max={EDIT_LIMITS.compensationDetails}
                    onChange={(value) => form.onField("compensationDetails", value)}
                  />
                </div>
                <TextAreaField
                  label={ui.availabilityOrStart}
                  hint={counterText(values.availabilityOrStart, EDIT_LIMITS.availabilityOrStart, t) || undefined}
                  value={values.availabilityOrStart}
                  onChange={(value) => form.onField("availabilityOrStart", value)}
                  rows={2}
                  maxLength={EDIT_LIMITS.availabilityOrStart}
                />
                <TextAreaField
                  label={ui.conditions}
                  hint={counterText(values.conditions, EDIT_LIMITS.conditions, t) || undefined}
                  value={values.conditions}
                  onChange={(value) => form.onField("conditions", value)}
                  rows={2}
                  maxLength={EDIT_LIMITS.conditions}
                />
              </>
            ) : null}
          </div>
        </div>
      </StepPanel>
    </Form>
  );
}
