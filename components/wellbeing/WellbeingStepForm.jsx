"use client";

/**
 * WellbeingStepForm — tööheaolu töövorm sammudena, kirjelduse järgi.
 *
 * Tööheaolu töövormid on ühe kujuga: inimene vastab küsimustele, saab
 * töökorraldusliku signaali ja valmis tekstid, salvestab privaatselt ning võib
 * soovi korral tuge küsida. Varem oli igal vormil sama asi oma failis käsitsi
 * kokku pandud; siin on see üks komponent ja iga vorm on KIRJELDUS
 * (`components/wellbeing/forms/*.js`): sammud, väljad, signaalide tekstid ja
 * väljundid. Serveri leping ei muutu: väljade võtmed ja väärtused on samad, mis
 * failis `lib/wellbeing/fieldSchemas.js`.
 *
 * KIRJELDUS
 *   { workflowType, endpoint, buildRecord, text, steps, signals, factors?,
 *     outputs?, links?, actionRoute?, safetyNotice? }
 *   steps: [{ key, title, short?, lead?, columns?, fields: [{ key, kind, label, hint?, options?, rows? }] }]
 *   `columns`: sammu väljad kõrvuti (nt kolm loendit, mille vahel inimene jagab).
 *   kind: "enum" (üks valik) | "boolean" | "enum_list" (mitu valikut) | "text" | "text_list"
 *   Tekst on kas sõne või [tõlkevõti, varutekst].
 *
 * REEGLID
 *  - Üks valik (`enum`) on alguses vastamata. Signaal ja väljundid ilmuvad
 *    alles siis, kui kõik sellised küsimused on vastatud; enne seda vorm midagi
 *    ei oleta ega salvesta.
 *  - Ohutusteade (`safetyNotice`) ilmub KOHE selle küsimuse all, mille vastus
 *    selle tingib, mitte alles tulemuse sammul.
 *  - Üks samm = üks asi ja see mahub paneeli ära: kerimine vahetab sammu
 *    kohapeal, mitte ei keri pikka lehte. Seepärast on lõpus eraldi sammud:
 *    tulemus (signaal ja salvestamine), valmis tekstid (üks korraga, pika
 *    teksti algus, kopeeritav), soovitused ja toe küsimine.
 *  - Küsimuste paigutus tuleb vastusevariantidest, mitte käsitsi: kui sammu kõik
 *    küsimused on lühikese skaalaga, on need tabel (silt vasakul, skaala
 *    paremal); muidu on küsimus üleval ja variandid selle all ühelaiuste
 *    lahtritena. Reeglid ja vaate lubatud „kaal": `forms/layout.js`.
 *
 * Kujundus: WellbeingStepForm.module.css; ühised osad kaustast components/stage.
 */

import { useMemo, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import ActionCard, { ActionCardGrid } from "@/components/stage/ActionCard";
import CheckCard from "@/components/stage/CheckCard";
import ChoiceChips from "@/components/stage/ChoiceChips";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepFlight from "@/components/stage/StepFlight";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";

import { cleanFields, emptyFields, hasValue, missingInStep } from "./forms/formState";
import { isTableStep, stackColumns } from "./forms/layout";
import { wellbeingActionRoute } from "./forms/routes";
import SupportRequestPanel from "./SupportRequestPanel";
import styles from "./WellbeingStepForm.module.css";

const lowerFirst = (text) => (text ? text.charAt(0).toLocaleLowerCase() + text.slice(1) : "");

/* Valmis tekst, mis on sellest pikem, näitab algul ainult algust (vaade mahub
   siis paneeli ära); „Näita kogu teksti" avab terve teksti. */
const TEXT_PREVIEW_LINES = 7;
const TEXT_PREVIEW_CHARS = 420;
const isLongText = (text) => text.split("\n").length > TEXT_PREVIEW_LINES || text.length > TEXT_PREVIEW_CHARS;

export default function WellbeingStepForm({ definition, onNavigate }) {
  const { t } = useI18n();
  const tx = (entry, vars) => (Array.isArray(entry) ? t(entry[0], vars || entry[1], vars ? entry[1] : undefined) : entry);

  const [fields, setFields] = useState(() => emptyFields(definition));
  const [saveState, setSaveState] = useState("idle");
  const [savedRecordId, setSavedRecordId] = useState(null);
  const [shownOutput, setShownOutput] = useState(0);
  const [copyState, setCopyState] = useState("idle");
  const [textOpen, setTextOpen] = useState(false);

  const inputSteps = definition.steps;
  const missing = inputSteps.map((step) => missingInStep(step, fields));
  const complete = missing.every((count) => count === 0);

  const record = useMemo(
    () =>
      complete
        ? definition.buildRecord({
            period: "current",
            roleGroup: "SOCIAL_WORKER",
            standardizedFields: cleanFields(definition, fields)
          })
        : null,
    [complete, definition, fields]
  );
  const signal = record ? definition.signals[record.computedSignal.signalLevel] || null : null;
  const safetyActive = Boolean(definition.safetyNotice?.when(fields));
  const hasOutputs = Boolean(definition.outputs?.length);
  const outputs = record
    ? (definition.outputs || [])
        .map((output) => ({ title: tx(output.title), value: output.value(record) }))
        .filter((output) => output.value)
    : [];
  const currentOutput = outputs[Math.min(shownOutput, Math.max(outputs.length - 1, 0))] || null;

  /* Soovitused: arvutuse soovitatud töövormid ja vormi püsilingid. Püsilink jääb
     ära, kui soovitus viib juba samasse kohta. */
  const routeOf = definition.actionRoute || wellbeingActionRoute;
  const recommended = record?.recommendedActions || [];
  const nextCards = record
    ? [
        ...recommended.map((action) => ({
          key: action.workflowType,
          title: action.label,
          description: action.reason,
          href: routeOf(action.workflowType)
        })),
        ...(definition.links || [])
          .filter((link) => !recommended.some((action) => routeOf(action.workflowType) === link.href))
          .map((link) => ({
            key: link.href,
            title: tx(link.title),
            description: link.description ? tx(link.description) : undefined,
            href: link.href
          }))
      ]
    : [];

  function updateField(key, value) {
    setFields((current) => ({ ...current, [key]: value }));
    setSaveState("idle");
    setCopyState("idle");
  }
  function toggleInList(key, value) {
    setFields((current) => {
      const selected = new Set(current[key] || []);
      if (selected.has(value)) selected.delete(value);
      else selected.add(value);
      return { ...current, [key]: [...selected] };
    });
    setSaveState("idle");
    setCopyState("idle");
  }

  async function copyOutput() {
    if (!currentOutput) return;
    try {
      await navigator.clipboard.writeText(currentOutput.value);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  async function save() {
    if (!complete) return;
    setSaveState("saving");
    try {
      const response = await fetch(definition.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: "current",
          roleGroup: "SOCIAL_WORKER",
          standardizedFields: cleanFields(definition, fields)
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "wellbeing.errors.save_failed");
      setSavedRecordId(payload.record?.id || null);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  /* ---------- sammude kirjeldused kiirmenüüle ja vaatele „Kõik sammud" ---------- */
  const describeInputStep = (step, index) => {
    const required = step.fields.filter((field) => field.kind === "enum").length;
    const left = missing[index];
    const filled = step.fields.filter((field) => hasValue(field, fields[field.key]));
    if (required === 0) {
      return {
        state: filled.length ? "done" : "empty",
        summary: filled.length ? filled.map((field) => tx(field.label)).join(" · ") : t("wellbeing.flow.summary.nothing_marked")
      };
    }
    const done = required - left;
    const state = done === 0 ? "empty" : left === 0 ? "done" : "partial";
    const answers = step.fields
      .filter((field) => field.kind === "enum" && fields[field.key])
      .map((field) => `${tx(field.label)}: ${lowerFirst(tx(field.options.find((option) => option.value === fields[field.key])?.label || ""))}`);
    return {
      state,
      summary:
        state === "empty"
          ? t("wellbeing.flow.summary.questions_empty", { total: required })
          : state === "partial"
            ? t("wellbeing.flow.summary.questions_left", { left })
            : step.summary
              ? step.summary(fields, tx)
              : answers.slice(0, 3).join(" · ")
    };
  };

  const steps = [
    ...inputSteps.map((step, index) => ({
      key: step.key,
      label: tx(step.title),
      short: tx(step.short || step.title),
      ...describeInputStep(step, index)
    })),
    {
      key: "__result",
      label: t("wellbeing.flow.result.title"),
      short: t("wellbeing.flow.result.title"),
      state: saveState === "saved" ? "done" : complete ? "partial" : "empty",
      summary: signal ? `${tx(signal.title)}. ${tx(signal.text)}` : t("wellbeing.flow.summary.result_waiting")
    },
    ...(hasOutputs
      ? [
          {
            key: "__texts",
            label: t("wellbeing.flow.texts.title"),
            short: t("wellbeing.flow.texts.short"),
            state: "empty",
            summary: record ? outputs.map((output) => output.title).join(" · ") : t("wellbeing.flow.summary.result_waiting")
          }
        ]
      : []),
    {
      key: "__next",
      label: t("wellbeing.flow.next.title"),
      short: t("wellbeing.flow.next.title"),
      state: "empty",
      summary: nextCards.length ? nextCards.map((card) => card.title).join(" · ") : t("wellbeing.flow.summary.next")
    },
    {
      key: "__support",
      label: t("wellbeing.flow.support.title"),
      short: t("wellbeing.flow.support.title"),
      state: "empty",
      summary: t("wellbeing.flow.summary.support")
    }
  ];

  const nextButton = (flight, variant) => (
    <Button type="button" variant={variant} onClick={flight.next}>
      {/* Lühike nimi (sama mis kiirmenüüs): nupp jääb lühike ja ütleb sama sõna. */}
      {t("wellbeing.flow.next_to", { label: lowerFirst(steps[flight.index + 1]?.short || steps[flight.index + 1]?.label) })}
    </Button>
  );

  const safetyNotice = () => (
    <div className={styles.safety} role="alert">
      <strong className={styles.safetyTitle}>{tx(definition.safetyNotice.title)}</strong>
      <p className={styles.safetyText}>{tx(definition.safetyNotice.text)}</p>
    </div>
  );

  /* Kui küsimusi on vastamata: ütle seda ja vii puuduva sammu juurde. */
  const waitingForAnswers = (flight) => (
    <div className={styles.block}>
      <div className={styles.signal} data-tone="none">
        <span className={styles.signalDot} aria-hidden="true" />
        <div>
          <strong className={styles.signalTitle}>{t("wellbeing.flow.result.none_title")}</strong>
          <p className={styles.signalText}>{t("wellbeing.flow.result.none_text")}</p>
        </div>
      </div>
      <div className={styles.buttons}>
        {inputSteps.map((step, index) =>
          missing[index] ? (
            <Button key={step.key} type="button" variant="secondary" onClick={() => flight.goTo(index)}>
              {t("wellbeing.flow.result.missing", { label: tx(step.title), left: missing[index] })}
            </Button>
          ) : null
        )}
      </div>
    </div>
  );

  const optionsOf = (field) => field.options.map((option) => ({ value: option.value, label: tx(option.label) }));

  /* `stepTitle`: kui sammus on üks väli ja selle silt kordab sammu pealkirja,
     jääb silt ainult ekraanilugejale. */
  const renderField = (field, table, stepTitle) => {
    const value = fields[field.key];
    const label = tx(field.label);
    const labelHidden = Boolean(stepTitle) && label === stepTitle;
    const hint = field.hint ? tx(field.hint) : undefined;
    let control;
    if (field.kind === "enum") {
      control = (
        <ChoiceRow
          label={label}
          options={optionsOf(field)}
          value={value}
          layout={table ? "scale" : "stack"}
          labelHidden={labelHidden}
          /* Neli lühikest varianti virnas: kõik ühes reas, mitte 3 + 1. */
          columns={table ? undefined : stackColumns(field, tx)}
          onChange={(next) => updateField(field.key, next)}
        />
      );
    } else if (field.kind === "boolean") {
      control = <CheckCard title={label} description={hint} checked={Boolean(value)} onChange={(next) => updateField(field.key, next)} />;
    } else if (field.kind === "enum_list") {
      control = (
        <ChoiceChips
          label={label}
          hint={hint}
          labelHidden={labelHidden}
          options={optionsOf(field)}
          values={value || []}
          onToggle={(next) => toggleInList(field.key, next)}
        />
      );
    } else {
      control = (
        <TextAreaField
          label={label}
          hint={hint}
          labelHidden={labelHidden}
          value={value}
          lines={field.kind === "text_list"}
          rows={field.rows || (field.kind === "text_list" ? 3 : 4)}
          maxLength={field.kind === "text" ? 4000 : undefined}
          onChange={(next) => updateField(field.key, next)}
        />
      );
    }
    if (safetyActive && definition.safetyNotice.fieldKey === field.key) {
      return (
        <div key={field.key}>
          {control}
          {safetyNotice()}
        </div>
      );
    }
    return <div key={field.key}>{control}</div>;
  };

  /* Sammu väljad: järjestikused märkekaardid lähevad ühte võrku, küsimused on
     kas tabel (kõik lühikese skaalaga) või virn. */
  const renderFields = (definitionStep, stepTitle) => {
    const stepFields = definitionStep.fields;
    const onlyTitle = stepFields.length === 1 ? stepTitle : undefined;
    const table = isTableStep(definitionStep, tx);
    const groups = [];
    stepFields.forEach((field) => {
      const last = groups[groups.length - 1];
      if (field.kind === "boolean" && last?.checks) last.fields.push(field);
      else groups.push({ checks: field.kind === "boolean", fields: [field] });
    });
    return groups.map((group) =>
      group.checks ? (
        <div key={group.fields[0].key} className={styles.checks}>
          {group.fields.map((field) => renderField(field, table, onlyTitle))}
        </div>
      ) : (
        renderField(group.fields[0], table, onlyTitle)
      )
    );
  };

  const signalBlock = () =>
    signal ? (
      <div className={styles.signal} data-tone={signal.tone}>
        <span className={styles.signalDot} aria-hidden="true" />
        <div>
          <strong className={styles.signalTitle}>{tx(signal.title)}</strong>
          <p className={styles.signalText}>{tx(signal.text)}</p>
        </div>
      </div>
    ) : null;

  const renderStep = (step, index, flight) => {
    if (index < inputSteps.length) {
      const definitionStep = inputSteps[index];
      const required = definitionStep.fields.filter((field) => field.kind === "enum").length;
      return (
        <StepPanel
          title={step.label}
          lead={tx(definitionStep.lead)}
          /* Valikulisel sammul ütleb juhis ise, et selle võib tühjaks jätta. */
          note={required ? t("wellbeing.flow.progress", { done: required - missing[index], total: required }) : undefined}
          actions={nextButton(flight)}
        >
          {definitionStep.columns ? (
            <div className={styles.columns} style={{ "--columns": definitionStep.columns }}>
              {renderFields(definitionStep, step.label)}
            </div>
          ) : (
            renderFields(definitionStep, step.label)
          )}
        </StepPanel>
      );
    }

    if (step.key === "__result") {
      if (!record) {
        return (
          <StepPanel title={step.label} lead={t("wellbeing.flow.result.lead")}>
            {waitingForAnswers(flight)}
          </StepPanel>
        );
      }
      const note =
        saveState === "saved"
          ? tx(definition.text.saved)
          : saveState === "error"
            ? tx(definition.text.failed)
            : t("wellbeing.flow.privacy");
      const factorLists = definition.factors ? definition.factors(record, tx) : [];
      return (
        <StepPanel
          title={step.label}
          lead={t("wellbeing.flow.result.lead")}
          note={note}
          actions={
            <>
              <Button type="button" variant="secondary" onClick={save} disabled={saveState === "saving"}>
                {saveState === "saving" ? tx(definition.text.saving) : tx(definition.text.save)}
              </Button>
              {nextButton(flight)}
            </>
          }
        >
          <div className={styles.block}>
            {signalBlock()}
            {safetyActive ? safetyNotice() : null}
            {factorLists.length ? (
              <div className={styles.factors}>
                {factorLists.map((list) => (
                  <div key={list.title}>
                    <h4 className={styles.subheading}>{list.title}</h4>
                    {list.items.length ? (
                      <ul className={styles.list}>
                        {list.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className={styles.quiet}>{list.empty}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </StepPanel>
      );
    }

    if (step.key === "__texts") {
      if (!record || !currentOutput) {
        return (
          <StepPanel title={step.label} lead={t("wellbeing.flow.texts.lead")}>
            {waitingForAnswers(flight)}
          </StepPanel>
        );
      }
      const long = isLongText(currentOutput.value);
      const copyNote =
        copyState === "copied"
          ? t("wellbeing.support.status_copied")
          : copyState === "error"
            ? t("wellbeing.support.status_copy_failed")
            : undefined;
      return (
        <StepPanel
          title={step.label}
          lead={t("wellbeing.flow.texts.lead")}
          note={copyNote}
          actions={
            <>
              <Button type="button" variant="secondary" onClick={copyOutput}>
                {t("wellbeing.support.copy_text")}
              </Button>
              {nextButton(flight)}
            </>
          }
        >
          <div className={styles.block}>
            {outputs.length > 1 ? (
              <ChoiceRow
                label={t("wellbeing.flow.texts.choose")}
                labelHidden
                columns={outputs.length <= 4 ? outputs.length : 3}
                options={outputs.map((output, outputIndex) => ({ value: String(outputIndex), label: output.title }))}
                value={String(outputs.indexOf(currentOutput))}
                onChange={(next) => {
                  setShownOutput(Number(next));
                  setTextOpen(false);
                  setCopyState("idle");
                }}
              />
            ) : null}
            <div className={styles.output}>
              <pre
                className={styles.outputText}
                data-clamped={long && !textOpen ? "1" : "0"}
                /* Kahe rea tekstivaliku all on eelvaatel vähem ridu, et vaade mahuks ära. */
                style={{ "--preview-lines": outputs.length > 4 ? 3 : 6 }}
                tabIndex={0}
                aria-label={currentOutput.title}
              >
                {currentOutput.value}
              </pre>
              {long ? (
                <button type="button" className={styles.outputToggle} aria-expanded={textOpen} onClick={() => setTextOpen((open) => !open)}>
                  {textOpen ? t("wellbeing.flow.texts.show_less") : t("wellbeing.flow.texts.show_all")}
                </button>
              ) : null}
            </div>
          </div>
        </StepPanel>
      );
    }

    if (step.key === "__next") {
      if (!record) {
        return (
          <StepPanel title={step.label} lead={t("wellbeing.flow.next.lead")}>
            {waitingForAnswers(flight)}
          </StepPanel>
        );
      }
      return (
        <StepPanel title={step.label} lead={nextCards.length ? t("wellbeing.flow.next.lead") : undefined} actions={nextButton(flight)}>
          {nextCards.length ? (
            <ActionCardGrid label={step.label}>
              {nextCards.map((card) => (
                <ActionCard key={card.key} title={card.title} description={card.description} onClick={() => onNavigate?.(card.href)} />
              ))}
            </ActionCardGrid>
          ) : (
            <p className={styles.quiet}>{definition.text.noActions ? tx(definition.text.noActions) : t("wellbeing.flow.next.none")}</p>
          )}
        </StepPanel>
      );
    }

    /* Viimane samm: toe küsimine. Siit edasi ei ole kuhugi kerida, seega võib
       see samm olla teistest pikem (avatud mustand). */
    return (
      <StepPanel title={step.label} lead={t("wellbeing.flow.support.lead")}>
        {record ? (
          /* Toe paneel on ühine kõigile töövormidele ja kannab veel vana ühist
             kujunduskihti; `wellbeing-workflow` hoiab selle siin kehtivana. */
          <div className={`wellbeing-workflow ${styles.support}`}>
            <SupportRequestPanel
              headless
              sourceWorkflowType={definition.workflowType}
              sourceRecordId={saveState === "saved" ? savedRecordId : null}
              context={record}
              onNavigate={onNavigate}
            />
          </div>
        ) : (
          waitingForAnswers(flight)
        )}
      </StepPanel>
    );
  };

  return (
    <StepFlight label={tx(definition.text.title)} steps={steps}>
      {renderStep}
    </StepFlight>
  );
}
