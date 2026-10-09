"use client";

/**
 * Minu mentoriprofiili vaated: vorm väikeste sammudena ja profiili seis.
 *
 * MIKS. Leht oli üks pikk vorm: kümme välja üksteise all, nende järel
 * „Salvesta” ja „Esita ülevaatusele” ning lehe lõpus rida nuppe (mahutavus,
 * peatamine, lõpetamine). Nüüd on igas vaates üks asi:
 *  - `WhoView`    nimi kataloogis, amet ja organisatsioon
 *  - `ListsView`  kaks loendit kõrvuti (valdkonnad ja teemad; keeled ja vormid)
 *  - `TextView`   üks tekst (lühitutvustus, pikem tutvustus, kogemus)
 *  - `StateView`  profiili seis, esitamine ülevaatusele ja seisu tegevused
 *
 * „Salvesta” on iga vormivaate all servas samas kohas: vorm salvestub tervikuna
 * ja inimene ei pea salvestamiseks viimase sammuni minema.
 *
 * Siin on ainult kuju. Andmed, päringud ja olek on failis
 * ../MyMentorProfilePage.jsx; otsused (mis on puudu, mida selles seisus teha
 * saab) teeb ./entryRows.js.
 *
 * Kujundus: entry.module.css (siin kõrval).
 */

import ActionCard from "@/components/stage/ActionCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Input from "@/components/ui/Input";

import { Chip, Notice, TextLink } from "./EntryParts";
import styles from "./entry.module.css";

/** Üherealine väli: silt, väli ja vihje selle all (nii on kõrvuti väljad ühel joonel). */
function LineField({ label, hint, value, onChange, onEnter, maxLength, disabled }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <Input
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          /* Enter salvestab nagu vanas vormis; kirjamärgi koostamise ajal (IME) mitte. */
          if (event.key === "Enter" && !event.nativeEvent.isComposing) onEnter?.();
        }}
      />
      {hint ? <span className={styles.fieldHint}>{hint}</span> : null}
    </label>
  );
}

/** Kes sa oled: nimi kataloogis, amet ja organisatsioon. */
export function WhoView({ t, form, onField, onEnter, maxLength, disabled, note, actions }) {
  return (
    <StepPanel
      title={t("mentoring.my_profile.views.who.title")}
      lead={t("mentoring.my_profile.views.who.lead")}
      note={note}
      actions={actions}
    >
      <div className={styles.stack}>
        <LineField
          label={t("mentoring.my_profile.display_name")}
          value={form.displayName}
          maxLength={maxLength}
          disabled={disabled}
          onChange={onField("displayName")}
          onEnter={onEnter}
        />
        <div className={styles.pair}>
          <LineField
            label={t("mentoring.my_profile.job_title")}
            value={form.title}
            maxLength={maxLength}
            disabled={disabled}
            onChange={onField("title")}
            onEnter={onEnter}
          />
          <LineField
            label={t("mentoring.my_profile.organization")}
            hint={t("mentoring.my_profile.organization_hint")}
            value={form.organization}
            maxLength={maxLength}
            disabled={disabled}
            onChange={onField("organization")}
            onEnter={onEnter}
          />
        </div>
      </div>
    </StepPanel>
  );
}

/** Kaks loendit kõrvuti: üks kirje real. `left` ja `right`: { label, hint, value, onChange }. */
export function ListsView({ title, lead, left, right, rows = 4, disabled, note, actions }) {
  return (
    <StepPanel title={title} lead={lead} note={note} actions={actions}>
      <div className={styles.pair}>
        {[left, right].map((field) => (
          <TextAreaField
            key={field.label}
            label={field.label}
            hint={field.hint}
            value={field.value}
            rows={rows}
            disabled={disabled}
            onChange={field.onChange}
          />
        ))}
      </div>
    </StepPanel>
  );
}

/**
 * Üks tekst vaate kohta. Välja silt on sama mis vaate nimi („Lühitutvustus"
 * kiirmenüüs ja uuesti paneelil), seepärast jääb silt ekraanilugejale ja
 * paneel algab juhisega.
 */
export function TextView({ title, label, hint, value, onChange, rows, maxLength, disabled, note, actions }) {
  return (
    <StepPanel title={title} note={note} actions={actions}>
      <TextAreaField
        label={label}
        labelHidden
        hint={hint}
        value={value}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        onChange={onChange}
      />
    </StepPanel>
  );
}

/**
 * Seis: märk ja selgitus, mis on esitamiseks puudu (`review`), kas võtan taotlusi vastu,
 * ning peatamine, taastamine ja lõpetamine kaartidena. Lõpetamine on jäädav:
 * kaardi pealkiri küsib teist vajutust (silt tuleb lehelt).
 */
export function StateView({ t, chip, reason, help, review, capacity, cards, backHref, note, actions }) {
  return (
    <StepPanel title={t("mentoring.my_profile.views.state.title")} note={note} actions={actions}>
      <div className={styles.stack}>
        {chip?.text ? (
          <p className={styles.line}>
            <Chip tone={chip.tone}>{chip.text}</Chip>
            {reason ? <span className={styles.lineText}>{reason}</span> : null}
          </p>
        ) : null}
        {help ? <p className={styles.quiet}>{help}</p> : null}
        <Notice text={review?.text} tone={review?.tone} />
        {capacity ? (
          <ChoiceRow
            label={t("mentoring.my_profile.capacity_question")}
            columns={capacity.options.length}
            options={capacity.options}
            value={capacity.value}
            disabled={capacity.disabled}
            onChange={capacity.onChange}
          />
        ) : null}
        {cards.length ? (
          <div className={styles.actionCards} role="group" aria-label={t("mentoring.my_profile.state_actions")}>
            {cards.map((card) => (
              <ActionCard key={card.key} title={card.title} description={card.description} disabled={card.disabled} onClick={card.onClick} />
            ))}
          </div>
        ) : null}
        <TextLink href={backHref}>{t("mentoring.labels.back_to_mentoring")}</TextLink>
      </div>
    </StepPanel>
  );
}
