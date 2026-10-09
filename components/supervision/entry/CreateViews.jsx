"use client";

/**
 * Uue supervisiooni protsessi sammud.
 *
 * MIKS. Loomine oli üks vorm teise klaaskasti sees: rippvalik kahe variandiga,
 * kaks täislaiuses välja ja kõrge tekstikast korraga. Nüüd on igal asjal oma
 * vaade sammulaval (`components/stage`):
 *
 *  - `TypeView`    üks küsimus kahe lahtriga; esimene vastus viib ise edasi
 *  - `TitleView`   pealkiri ja kavandatud kohtumiste arv (kaks lühikest välja)
 *  - `GoalView`    eesmärk (valikuline pikk tekst)
 *  - `ReviewView`  ülevaade ja „Loo protsess"; siin on ka keeldumise selgitus,
 *                  kui superviisori õigust ei ole
 *
 * Siin on ainult kuju. Vormi seis, kontroll ja päring on failis
 * ../SupervisionCreatePage.jsx; kontrolli reeglid ./entryRows.js.
 *
 * Kujundus: entry.module.css (siin kõrval).
 */

import { useId } from "react";

import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Input from "@/components/ui/Input";

import { Problem } from "./EntryBits";
import { GOAL_MAX, MEETING_COUNT_MAX, TITLE_MAX } from "./entryRows";
import styles from "./entry.module.css";

/** Tüüp: individuaalne või grupp. Küsimus on paneeli ülaservas, lahtrid selle all. */
export function TypeView({ t, value, options, onChange, note, actions }) {
  return (
    <StepPanel
      title={t("supervision.create.views.type.title")}
      question={t("supervision.create.views.type.question")}
      lead={t("supervision.create.views.type.lead")}
      note={note}
      actions={actions}
    >
      <ChoiceRow
        label={t("supervision.create.views.type.question")}
        labelHidden
        columns={options.length}
        options={options}
        value={value}
        onChange={onChange}
      />
    </StepPanel>
  );
}

/**
 * Pealkiri ja kohtumiste arv. Enter väljal viib järgmise sammu juurde: kahe
 * väljaga vorm ilma saatmisnuputa ei saada end ise.
 */
export function TitleView({ t, title, onTitle, meetings, onMeetings, titleError, meetingsError, onEnter, actions }) {
  const id = useId();
  return (
    <StepPanel title={t("supervision.create.views.title.title")} note={titleError || meetingsError} actions={actions}>
      <form
        className={styles.fields}
        noValidate
        onSubmit={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent?.isComposing || event.target?.tagName !== "INPUT") return;
          event.preventDefault();
          onEnter();
        }}
      >
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={`${id}-title`}>
            {t("supervision.create.titleLabel")}
          </label>
          <span className={styles.fieldHint} id={`${id}-title-hint`}>
            {t("supervision.create.views.title.titleHint")}
          </span>
          <Input
            id={`${id}-title`}
            className={styles.input}
            type="text"
            value={title}
            maxLength={TITLE_MAX}
            placeholder={t("supervision.create.titlePlaceholder")}
            invalid={Boolean(titleError)}
            describedBy={`${id}-title-hint`}
            onChange={(event) => onTitle(event.target.value)}
          />
        </div>
        <div className={styles.field} data-size="sm">
          <label className={styles.fieldLabel} htmlFor={`${id}-meetings`}>
            {t("supervision.create.meetingsLabel")}
          </label>
          <span className={styles.fieldHint} id={`${id}-meetings-hint`}>
            {t("supervision.create.views.title.meetingsHint")}
          </span>
          <Input
            id={`${id}-meetings`}
            className={styles.input}
            /* Tekstiväli numbriklahvistikuga, mitte type="number": numbriväli annab
               loetamatu sisestuse korral tühja väärtuse ja viga jääks nägemata. */
            type="text"
            inputMode="numeric"
            maxLength={String(MEETING_COUNT_MAX).length}
            value={meetings}
            invalid={Boolean(meetingsError)}
            describedBy={`${id}-meetings-hint`}
            onChange={(event) => onMeetings(event.target.value)}
          />
        </div>
      </form>
    </StepPanel>
  );
}

/** Eesmärk: valikuline pikk tekst. */
export function GoalView({ t, value, onChange, actions }) {
  return (
    <StepPanel title={t("supervision.create.views.goal.title")} actions={actions}>
      <TextAreaField
        label={t("supervision.create.goalLabel")}
        hint={t("supervision.create.views.goal.hint")}
        value={value}
        onChange={onChange}
        rows={7}
        maxLength={GOAL_MAX}
      />
    </StepPanel>
  );
}

/**
 * Ülevaade ja loomine. `facts`: [{ key, label, value, missing }].
 * `problem`: keeldumise või vea lause (õiguse puudumine, serveri vastus).
 */
export function ReviewView({ t, facts, problem, actions }) {
  return (
    <StepPanel title={t("supervision.create.views.create.title")} lead={t("supervision.create.views.create.lead")} actions={actions}>
      <div className={styles.stack}>
        <Problem text={problem} />
        <dl className={styles.facts}>
          {facts.map((fact) => (
            <div key={fact.key} className={styles.fact}>
              <dt className={styles.factLabel}>{fact.label}</dt>
              <dd className={styles.factValue} data-missing={fact.missing ? "true" : undefined}>
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </StepPanel>
  );
}
