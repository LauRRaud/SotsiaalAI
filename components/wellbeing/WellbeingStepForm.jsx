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
 *   steps: [{ key, title, short, lead, fields: [{ key, kind, label, hint?, options?, rows? }] }]
 *   kind: "enum" (üks valik) | "boolean" | "enum_list" (mitu valikut) | "text" | "text_list"
 *   Tekst on kas sõne või [tõlkevõti, varutekst].
 *
 * REEGLID
 *  - Üks valik (`enum`) on alguses vastamata. Signaal ja väljundid ilmuvad
 *    alles siis, kui kõik sellised küsimused on vastatud; enne seda vorm midagi
 *    ei oleta ega salvesta.
 *  - Ohutusteade (`safetyNotice`) ilmub KOHE selle küsimuse all, mille vastus
 *    selle tingib, mitte alles tulemuse sammul.
 *  - Lõpus on alati kaks sammu: tulemus ja tugi.
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
import { wellbeingActionRoute } from "./forms/routes";
import SupportRequestPanel from "./SupportRequestPanel";
import styles from "./WellbeingStepForm.module.css";

const lowerFirst = (text) => (text ? text.charAt(0).toLocaleLowerCase() + text.slice(1) : "");

export default function WellbeingStepForm({ definition, onNavigate }) {
  const { t } = useI18n();
  const tx = (entry, vars) => (Array.isArray(entry) ? t(entry[0], vars || entry[1], vars ? entry[1] : undefined) : entry);

  const [fields, setFields] = useState(() => emptyFields(definition));
  const [saveState, setSaveState] = useState("idle");
  const [savedRecordId, setSavedRecordId] = useState(null);

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

  function updateField(key, value) {
    setFields((current) => ({ ...current, [key]: value }));
    setSaveState("idle");
  }
  function toggleInList(key, value) {
    setFields((current) => {
      const selected = new Set(current[key] || []);
      if (selected.has(value)) selected.delete(value);
      else selected.add(value);
      return { ...current, [key]: [...selected] };
    });
    setSaveState("idle");
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

  /* ---------- sammude kirjeldused sammuribale ja laiale vaatele ---------- */
  const describeInputStep = (step, index) => {
    const required = step.fields.filter((field) => field.kind === "enum").length;
    const left = missing[index];
    const filled = step.fields.filter((field) => hasValue(field, fields[field.key]));
    if (required === 0) {
      return {
        state: filled.length ? "done" : "empty",
        stateLabel: filled.length
          ? t("wellbeing.flow.state.marked", { count: filled.length })
          : t("wellbeing.flow.state.optional"),
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
      stateLabel:
        state === "done"
          ? t("wellbeing.flow.state.done")
          : state === "partial"
            ? `${done}/${required}`
            : t("wellbeing.flow.state.empty"),
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
      stateLabel:
        saveState === "saved"
          ? t("wellbeing.flow.state.saved")
          : signal
            ? lowerFirst(tx(signal.title))
            : t("wellbeing.flow.state.waiting"),
      summary: signal ? tx(signal.text) : t("wellbeing.flow.summary.result_waiting")
    },
    {
      key: "__support",
      label: t("wellbeing.flow.support.title"),
      short: t("wellbeing.flow.support.title"),
      state: "empty",
      stateLabel: t("wellbeing.flow.state.optional"),
      summary: t("wellbeing.flow.summary.support")
    }
  ];

  const nextButton = (flight, variant) => (
    <Button type="button" variant={variant} onClick={flight.next}>
      {t("wellbeing.flow.next_to", { label: lowerFirst(steps[flight.index + 1]?.label) })}
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

  const renderField = (field) => {
    const value = fields[field.key];
    const label = tx(field.label);
    const hint = field.hint ? tx(field.hint) : undefined;
    let control;
    if (field.kind === "enum") {
      control = (
        <ChoiceRow
          label={label}
          options={field.options.map((option) => ({ value: option.value, label: tx(option.label) }))}
          value={value}
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
          options={field.options.map((option) => ({ value: option.value, label: tx(option.label) }))}
          values={value || []}
          onToggle={(next) => toggleInList(field.key, next)}
        />
      );
    } else {
      control = (
        <TextAreaField
          label={label}
          hint={hint}
          value={value}
          lines={field.kind === "text_list"}
          rows={field.rows || (field.kind === "text_list" ? 3 : 4)}
          maxLength={field.kind === "text" ? 4000 : undefined}
          onChange={(next) => updateField(field.key, next)}
        />
      );
    }
    return (
      <div key={field.key} className={field.kind === "boolean" ? styles.checkField : undefined}>
        {control}
        {safetyActive && definition.safetyNotice.fieldKey === field.key ? safetyNotice() : null}
      </div>
    );
  };

  const renderStep = (step, index, flight) => {
    if (index < inputSteps.length) {
      const definitionStep = inputSteps[index];
      const required = definitionStep.fields.filter((field) => field.kind === "enum").length;
      return (
        <StepPanel
          title={step.label}
          lead={tx(definitionStep.lead)}
          note={
            required
              ? t("wellbeing.flow.progress", { done: required - missing[index], total: required })
              : t("wellbeing.flow.optional_note")
          }
          actions={nextButton(flight)}
        >
          {definitionStep.fields.map(renderField)}
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
      const outputs = (definition.outputs || [])
        .map((output) => ({ title: tx(output.title), value: output.value(record) }))
        .filter((output) => output.value);
      const routeOf = definition.actionRoute || wellbeingActionRoute;
      const actions = record.recommendedActions || [];
      /* Püsilink jääb ära, kui soovitus viib juba samasse kohta. */
      const links = (definition.links || []).filter(
        (link) => !actions.some((action) => routeOf(action.workflowType) === link.href)
      );
      return (
        <StepPanel
          title={step.label}
          lead={t("wellbeing.flow.result.lead")}
          note={note}
          actions={
            <>
              {nextButton(flight, "secondary")}
              <Button type="button" onClick={save} disabled={saveState === "saving"}>
                {saveState === "saving" ? tx(definition.text.saving) : tx(definition.text.save)}
              </Button>
            </>
          }
        >
          <div className={styles.block}>
            {signal ? (
              <div className={styles.signal} data-tone={signal.tone}>
                <span className={styles.signalDot} aria-hidden="true" />
                <div>
                  <strong className={styles.signalTitle}>{tx(signal.title)}</strong>
                  <p className={styles.signalText}>{tx(signal.text)}</p>
                </div>
              </div>
            ) : null}
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

            {outputs.length ? (
              <div className={styles.outputs}>
                <h4 className={styles.subheading}>{t("wellbeing.flow.result.outputs")}</h4>
                {outputs.map((output, outputIndex) => (
                  <details key={output.title} className={styles.output} open={outputIndex === 0}>
                    <summary className={styles.outputTitle}>{output.title}</summary>
                    <pre className={styles.outputText}>{output.value}</pre>
                  </details>
                ))}
              </div>
            ) : null}

            {actions.length || links.length ? (
              <div className={styles.nextSteps}>
                <h4 className={styles.subheading}>{t("wellbeing.flow.result.next_steps")}</h4>
                <ActionCardGrid label={t("wellbeing.flow.result.next_steps")}>
                  {actions.map((action) => (
                    <ActionCard
                      key={action.workflowType}
                      title={action.label}
                      description={action.reason}
                      onClick={() => onNavigate?.(routeOf(action.workflowType))}
                    />
                  ))}
                  {links.map((link) => (
                    <ActionCard
                      key={link.href}
                      title={tx(link.title)}
                      description={link.description ? tx(link.description) : undefined}
                      onClick={() => onNavigate?.(link.href)}
                    />
                  ))}
                </ActionCardGrid>
              </div>
            ) : definition.text.noActions ? (
              <p className={styles.quiet}>{tx(definition.text.noActions)}</p>
            ) : null}
          </div>
        </StepPanel>
      );
    }

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
