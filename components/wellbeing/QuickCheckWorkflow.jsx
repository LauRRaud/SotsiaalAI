"use client";

/**
 * Kiirkontroll sammudena.
 *
 * Viis sammu lennulaval (StepFlight): töö nõudmised, tööressursid, riskimärgid,
 * tulemus, tugi. Ekraanil on üks samm korraga; „Kõik sammud" näitab tervikut.
 *
 * MIS ON TEISITI KUI VAREM (kujundusaudit 08.10):
 *  - küsimused on vastamata, kuni inimene valib (enne olid eeltäidetud ja
 *    „Kollane" paistis tema hinnanguna enne ühtki vastust);
 *  - signaal ilmub alles siis, kui kõik küsimused on vastatud;
 *  - rippvalikute asemel on vastusevariandid kohe näha (üks puudutus);
 *  - toe küsimine on eraldi viimane samm, mitte pikk nupurida lehe lõpus.
 *
 * Arvutus, salvestamine ja toe mustandid on samad mis enne
 * (`lib/wellbeing/quickCheck.js`, `/api/wellbeing/quick-check`,
 * `SupportRequestPanel`).
 *
 * Kujundus: QuickCheckWorkflow.module.css (selle faili kõrval); ühised osad
 * tulevad kaustast components/stage.
 */

import { useMemo, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import ActionCard, { ActionCardGrid } from "@/components/stage/ActionCard";
import CheckCard from "@/components/stage/CheckCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepFlight from "@/components/stage/StepFlight";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import { buildQuickCheckRecord, computeQuickCheckResult, formatQuickCheckFactor } from "@/lib/wellbeing/quickCheck";

import { QUICK_CHECK_EMPTY, QUICK_CHECK_GROUPS, QUICK_CHECK_RISKS, QUICK_CHECK_WORKFLOW_SLUGS } from "./quickCheckFields";
import styles from "./QuickCheckWorkflow.module.css";
import SupportRequestPanel from "./SupportRequestPanel";

const QUESTION_STEPS = ["demands", "resources"];

const signalCopy = {
  green: {
    title: "Roheline",
    text: "Töökoormus paistab praegu juhitav. Hoia tähelepanu taastumisel ja kokkulepetel."
  },
  yellow: {
    title: "Kollane",
    text: "Mitmes töötegur vajab tähelepanu. Vali üks konkreetne järgmine samm."
  },
  red: {
    title: "Punane",
    text: "Koormus vajab töökorralduslikku arutelu või kiiremat toe kokkulepet."
  }
};

const lowerFirst = (text) => (text ? text.charAt(0).toLocaleLowerCase() + text.slice(1) : "");
const answeredIn = (group, fields) => group.filter((field) => fields[field.key]).length;

export default function QuickCheckWorkflow({ onNavigate }) {
  const { t } = useI18n();
  const [fields, setFields] = useState(QUICK_CHECK_EMPTY);
  const [saveState, setSaveState] = useState("idle");
  const [savedRecordId, setSavedRecordId] = useState(null);

  const answered = {
    demands: answeredIn(QUICK_CHECK_GROUPS.demands, fields),
    resources: answeredIn(QUICK_CHECK_GROUPS.resources, fields)
  };
  const missing = {
    demands: QUICK_CHECK_GROUPS.demands.length - answered.demands,
    resources: QUICK_CHECK_GROUPS.resources.length - answered.resources
  };
  const complete = missing.demands + missing.resources === 0;
  const marks = QUICK_CHECK_RISKS.filter((risk) => fields[risk.key]).length;

  /* Tegurid juba antud vastuste põhjal (vastamata väli ei anna tegurit). */
  const factors = useMemo(() => computeQuickCheckResult(fields), [fields]);
  /* Terviklik kirje ainult siis, kui kõik küsimused on vastatud. */
  const record = useMemo(
    () => (complete ? buildQuickCheckRecord({ period: "current", roleGroup: "SOCIAL_WORKER", standardizedFields: fields }) : null),
    [complete, fields]
  );
  const signal = record ? signalCopy[record.computedSignal.signalLevel] || signalCopy.yellow : null;

  function updateField(key, value) {
    setFields((current) => ({ ...current, [key]: value }));
    setSaveState("idle");
  }

  async function saveQuickCheck() {
    if (!complete) return;
    setSaveState("saving");
    try {
      const response = await fetch("/api/wellbeing/quick-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: "current",
          roleGroup: "SOCIAL_WORKER",
          standardizedFields: fields
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

  const stepText = (key, part) => t(`wellbeing.quick_check.steps.${key}.${part}`);
  const questionStep = (key, factorKeys, emptySummaryKey) => {
    const total = QUICK_CHECK_GROUPS[key].length;
    const done = answered[key];
    const state = done === 0 ? "empty" : done === total ? "done" : "partial";
    const summary =
      done === 0
        ? t("wellbeing.quick_check.summary.questions_empty", { total })
        : done < total
          ? t("wellbeing.quick_check.summary.questions_left", { left: total - done })
          : factorKeys.length
            ? factorKeys.map(formatQuickCheckFactor).join(" · ")
            : t(emptySummaryKey);
    return {
      key,
      label: stepText(key, "title"),
      short: stepText(key, "short"),
      state,
      stateLabel:
        state === "done"
          ? t("wellbeing.quick_check.state.done")
          : state === "partial"
            ? `${done}/${total}`
            : t("wellbeing.quick_check.state.empty"),
      summary
    };
  };

  const steps = [
    questionStep("demands", factors.loadFactors, "wellbeing.quick_check.summary.no_high_load"),
    questionStep("resources", factors.resourceFactors, "wellbeing.quick_check.summary.resources_ok"),
    {
      key: "risks",
      label: stepText("risks", "title"),
      short: stepText("risks", "short"),
      state: marks ? "done" : "empty",
      stateLabel: marks ? t("wellbeing.quick_check.state.marked", { count: marks }) : t("wellbeing.quick_check.state.optional"),
      summary: marks
        ? QUICK_CHECK_RISKS.filter((risk) => fields[risk.key])
            .map((risk) => t(risk.labelKey))
            .join(" · ")
        : t("wellbeing.quick_check.summary.no_marks")
    },
    {
      key: "result",
      label: stepText("result", "title"),
      short: stepText("result", "short"),
      state: saveState === "saved" ? "done" : complete ? "partial" : "empty",
      stateLabel:
        saveState === "saved"
          ? t("wellbeing.quick_check.state.saved")
          : signal
            ? lowerFirst(signal.title)
            : t("wellbeing.quick_check.state.waiting"),
      summary: signal ? signal.text : t("wellbeing.quick_check.summary.result_waiting")
    },
    {
      key: "support",
      label: stepText("support", "title"),
      short: stepText("support", "short"),
      state: "empty",
      stateLabel: t("wellbeing.quick_check.state.optional"),
      summary: t("wellbeing.quick_check.summary.support")
    }
  ];

  const nextButton = (flight) => (
    <Button type="button" onClick={flight.next}>
      {t("wellbeing.quick_check.next_to", { label: lowerFirst(steps[flight.index + 1]?.label) })}
    </Button>
  );

  /* Kui küsimusi on vastamata: ütle seda ja vii puuduva sammu juurde. */
  const waitingForAnswers = (flight) => (
    <div className={styles.waiting}>
      <div className={styles.signal} data-level="none">
        <span className={styles.signalDot} aria-hidden="true" />
        <div>
          <strong className={styles.signalTitle}>{t("wellbeing.quick_check.result.none_title")}</strong>
          <p className={styles.signalText}>{t("wellbeing.quick_check.result.none_text")}</p>
        </div>
      </div>
      <div className={styles.missing}>
        {QUESTION_STEPS.map((key, index) =>
          missing[key] ? (
            <Button key={key} type="button" variant="secondary" onClick={() => flight.goTo(index)}>
              {t("wellbeing.quick_check.result.missing", { label: steps[index].label, left: missing[key] })}
            </Button>
          ) : null
        )}
      </div>
    </div>
  );

  const renderStep = (step, index, flight) => {
    if (step.key === "demands" || step.key === "resources") {
      const group = QUICK_CHECK_GROUPS[step.key];
      return (
        <StepPanel
          title={step.label}
          lead={stepText(step.key, "lead")}
          note={t("wellbeing.quick_check.progress", { done: answered[step.key], total: group.length })}
          actions={nextButton(flight)}
        >
          {group.map((field) => (
            <ChoiceRow
              key={field.key}
              label={field.label}
              options={field.options}
              value={fields[field.key]}
              onChange={(value) => updateField(field.key, value)}
            />
          ))}
        </StepPanel>
      );
    }

    if (step.key === "risks") {
      return (
        <StepPanel
          title={step.label}
          lead={stepText("risks", "lead")}
          note={t("wellbeing.quick_check.risks_note")}
          actions={nextButton(flight)}
        >
          <div className={styles.checks}>
            {QUICK_CHECK_RISKS.map((risk) => (
              <CheckCard
                key={risk.key}
                title={t(risk.labelKey)}
                description={t(risk.hintKey)}
                checked={Boolean(fields[risk.key])}
                onChange={(checked) => updateField(risk.key, checked)}
              />
            ))}
          </div>
        </StepPanel>
      );
    }

    if (step.key === "result") {
      if (!record) {
        return (
          <StepPanel title={step.label} lead={stepText("result", "lead")}>
            {waitingForAnswers(flight)}
          </StepPanel>
        );
      }
      const note =
        saveState === "saved"
          ? t("wellbeing.quick_check.saved", "Kiirkontroll salvestati privaatselt.")
          : saveState === "error"
            ? t("wellbeing.quick_check.save_failed", "Salvestamine ebaõnnestus. Proovi uuesti.")
            : t(
                "wellbeing.quick_check.privacy",
                "Sisestus on vaikimisi privaatne. Seda ei jagata juhile, kolleegile ega kovisiooni ilma sinu kinnituse ja eraldi jagatava versioonita."
              );
      return (
        <StepPanel
          title={step.label}
          lead={stepText("result", "lead")}
          note={note}
          actions={
            <>
              <Button type="button" variant="secondary" onClick={flight.next}>
                {t("wellbeing.quick_check.next_to", { label: lowerFirst(steps[index + 1].label) })}
              </Button>
              <Button type="button" onClick={saveQuickCheck} disabled={saveState === "saving"}>
                {saveState === "saving"
                  ? t("wellbeing.quick_check.saving", "Salvestan...")
                  : t("wellbeing.quick_check.save", "Salvesta kiirkontroll")}
              </Button>
            </>
          }
        >
          <div className={styles.result}>
            <div className={styles.signal} data-level={record.computedSignal.signalLevel}>
              <span className={styles.signalDot} aria-hidden="true" />
              <div>
                <strong className={styles.signalTitle}>{signal.title}</strong>
                <p className={styles.signalText}>{signal.text}</p>
              </div>
            </div>

            <div className={styles.factors}>
              <FactorList
                title={t("wellbeing.quick_check.load_factors", "Koormustegurid")}
                items={record.loadFactors}
                emptyText={t("wellbeing.quick_check.no_load_factors", "Kõrgeid koormustegureid ei ilmnenud.")}
              />
              <FactorList
                title={t("wellbeing.quick_check.resource_factors", "Puuduvad ressursid")}
                items={record.resourceFactors}
                emptyText={t("wellbeing.quick_check.no_resource_factors", "Põhiressursid paistavad olemas.")}
              />
              <FactorList
                title={t("wellbeing.quick_check.risk_markers", "Riskimärgid")}
                items={record.riskMarkers}
                emptyText={t("wellbeing.quick_check.no_risk_markers", "Eraldi riskimärki ei märgitud.")}
              />
            </div>

            <div className={styles.nextSteps}>
              <h4 className={styles.subheading}>{t("wellbeing.quick_check.result.next_steps")}</h4>
              {record.recommendedActions.length > 0 ? (
                <ActionCardGrid label={t("wellbeing.quick_check.result.next_steps")}>
                  {record.recommendedActions.map((action) => (
                    <ActionCard
                      key={action.workflowType}
                      title={action.label}
                      description={action.reason}
                      onClick={() =>
                        onNavigate?.(
                          action.workflowType === "covision"
                            ? "/kovisioon"
                            : `/tooheaolu/${QUICK_CHECK_WORKFLOW_SLUGS[action.workflowType] || action.workflowType}`
                        )
                      }
                    />
                  ))}
                </ActionCardGrid>
              ) : (
                <p className={styles.quiet}>
                  {t("wellbeing.quick_check.no_actions", "Jätka praeguste kokkulepete hoidmist ja tee uus kiirkontroll hiljem.")}
                </p>
              )}
            </div>
          </div>
        </StepPanel>
      );
    }

    return (
      <StepPanel title={step.label} lead={stepText("support", "lead")}>
        {record ? (
          /* Toe paneel on ühine kõigile tööheaolu töövormidele ja kannab veel
             vana ühist kujunduskihti; `wellbeing-workflow` hoiab selle siin kehtivana. */
          <div className={`wellbeing-workflow ${styles.support}`}>
            <SupportRequestPanel
              headless
              sourceWorkflowType="quick-check"
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
    <StepFlight label={t("wellbeing.quick_check.title", "Kiirkontroll")} steps={steps}>
      {renderStep}
    </StepFlight>
  );
}

function FactorList({ title, items, emptyText }) {
  return (
    <div>
      <h4 className={styles.subheading}>{title}</h4>
      {items.length > 0 ? (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item}>{formatQuickCheckFactor(item)}</li>
          ))}
        </ul>
      ) : (
        <p className={styles.quiet}>{emptyText}</p>
      )}
    </div>
  );
}
