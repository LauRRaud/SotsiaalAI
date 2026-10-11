"use client";

/**
 * Eelpöördumise eelinfo vaated: üks vaade, üks asi.
 *
 * Varem oli kogu eelinfo üks pikk leht: kolm rippvalikut, tekstiväli, 21
 * küsimusega peidetud plokk ja vestlus üksteise all. Siin on igaüks omaette
 * vaade sammulaval (`StepFlight`): viis, olukord, kelle kohta, kiireloomulisus,
 * taust. Eluvaldkondade küsimused on failis `DomainsView.jsx`.
 *
 * Vaade ise olekut ei hoia: väärtused ja muutjad tulevad lehelt
 * (`PreInquiriesSurface` failis ../WorkspaceFeaturePage.jsx). `tr(võti, varu)`
 * loeb teksti nimeruumist `workspace_feature_pages.pre_inquiries`.
 *
 * Kujundus: views.module.css; ehitusklotsid kaustast components/stage.
 */

import ActionCard from "@/components/stage/ActionCard";
import CheckCard from "@/components/stage/CheckCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Input from "@/components/ui/Input";

import styles from "./views.module.css";

const asOptions = (items) => items.map((item) => ({ value: item, label: item }));

/** Üherealine väli sildiga. */
export function LineField({ label, hint, value, onChange, maxLength, placeholder, size }) {
  return (
    <label className={styles.field} data-size={size}>
      <span className={styles.fieldLabel}>{label}</span>
      {hint ? <span className={styles.fieldHint}>{hint}</span> : null}
      <Input value={value} maxLength={maxLength} placeholder={placeholder} onChange={(event) => onChange?.(event.target.value)} />
    </label>
  );
}

/** Kuidas inimene soovib olukorda kirjeldada: kolm viisi kaartidena. */
export function PathView({ tr, paths, value, chosen, onChoose }) {
  return (
    <StepPanel
      title={tr("steps.path.title", "Kirjeldamise viis")}
      question={tr("views.path.title", "Kuidas soovid olukorda kirjeldada?")}
      lead={tr("views.path.lead", "See ei ole ametlik hindamine. Viisi saad hiljem muuta.")}
    >
      <div className={styles.cards} role="group" aria-label={tr("views.path.title", "Kuidas soovid olukorda kirjeldada?")}>
        {paths.map((path) => (
          <ActionCard
            key={path.id}
            title={path.title}
            description={path.description}
            pressed={chosen && value === path.id}
            onClick={() => onChoose(path.id)}
          />
        ))}
      </div>
    </StepPanel>
  );
}

/** Olukord inimese enda sõnadega ja piirkond: nendest kahest piisab kontakti leidmiseks. */
export function SituationView({ tr, situation, onSituation, municipality, onMunicipality }) {
  return (
    <StepPanel
      title={tr("views.situation.title", "Olukord")}
      lead={tr("views.situation.lead", "Kirjelda oma sõnadega, mis toimub. Teenuse nime ei pea teadma.")}
    >
      <div className={styles.stack}>
        <TextAreaField
          label={tr("fields.situation", "Olukorra kirjeldus inimese sõnadega")}
          value={situation}
          rows={4}
          maxLength={12000}
          onChange={onSituation}
        />
        <LineField
          label={tr("fields.municipality", "KOV või piirkond")}
          value={municipality}
          size="sm"
          maxLength={180}
          placeholder={tr("views.situation.municipality_placeholder", "Näiteks Põltsamaa vald")}
          onChange={onMunicipality}
        />
      </div>
    </StepPanel>
  );
}

/** Kelle kohta pöördumine käib ja mis alusel. */
export function WhoView({ tr, subjectOptions, consentOptions, subject, onSubject, childNote }) {
  return (
    <StepPanel title={tr("views.who.title", "Kelle kohta")}>
      <ChoiceRow
        label={tr("fields.concerns_about", "Kelle kohta pöördumine käib")}
        options={asOptions(subjectOptions)}
        value={subject.concernsAbout}
        onChange={(value) => onSubject("concernsAbout", value)}
      />
      {childNote ? <p className={styles.notice}>{childNote}</p> : null}
      <ChoiceRow
        label={tr("fields.consent", "Nõusolek või pöördumise alus")}
        options={asOptions(consentOptions)}
        value={subject.consentStatus}
        onChange={(value) => onSubject("consentStatus", value)}
      />
    </StepPanel>
  );
}

/** Kiireloomulisus; ohu korral ilmub teade kohe küsimuse alla. */
export function UrgencyView({ tr, urgencyOptions, urgency, onUrgency, riskMessage }) {
  return (
    <StepPanel title={tr("fields.urgency", "Kiireloomulisus")}>
      <ChoiceRow
        label={tr("views.urgency.question", "Kui kiire olukord on?")}
        options={asOptions(urgencyOptions)}
        value={urgency}
        onChange={onUrgency}
      />
      {riskMessage ? (
        <p className={styles.notice} data-tone="risk" role="alert">
          {riskMessage}
        </p>
      ) : null}
    </StepPanel>
  );
}

/** Taust: mis abi juba on, kas sellest piisab ja mida inimene ise soovib. */
export function ContextView({ tr, support, onSupport }) {
  return (
    <StepPanel
      title={tr("views.context.title", "Taust")}
      lead={tr("views.context.lead", "Võid kõik tühjaks jätta. Täpsem taust säästab vastuvõtjat üle küsimast.")}
    >
      <div className={styles.stack}>
        {/* Kaks tekstivälja kõrvuti: vaade mahub paneeli ära; kitsal ekraanil üksteise all. */}
        <div className={styles.pair}>
          <TextAreaField
            label={tr("fields.person_wish", "Inimese enda soov")}
            value={support.personWish}
            rows={3}
            maxLength={4000}
            onChange={(value) => onSupport("personWish", value)}
          />
          <TextAreaField
            label={tr("fields.existing_support", "Olemasolev abi")}
            value={support.existingSupport}
            rows={3}
            maxLength={4000}
            onChange={(value) => onSupport("existingSupport", value)}
          />
        </div>
        <LineField
          label={tr("fields.support_adequacy", "Kas abist piisab")}
          value={support.supportAdequacy}
          maxLength={180}
          placeholder={tr("placeholders.support_adequacy", "Näiteks piisab, ei piisa või abistaja on ülekoormatud")}
          onChange={(value) => onSupport("supportAdequacy", value)}
        />
      </div>
    </StepPanel>
  );
}

/** Teekonnast kaasa tulnud info: inimene märgib, mida selles eelpöördumises kasutada. */
export function JourneyView({ tr, options, labels, selected, busy, onToggle, children }) {
  return (
    <StepPanel
      title={tr("views.journey.title", "Mida Teekonnast kasutada")}
      lead={tr("journey_share.lead", "Teekonna info on privaatne. Märgi ainult need osad, mida soovid selle eelpöördumise koostamisel kasutada.")}
    >
      <div className={styles.stack}>
        {options.length ? (
          <div className={styles.cards}>
            {options.map((id) => (
              <CheckCard key={id} title={labels[id] || id} checked={selected.includes(id)} disabled={busy} onChange={(checked) => onToggle(id, checked)} />
            ))}
          </div>
        ) : null}
        {children}
      </div>
    </StepPanel>
  );
}
