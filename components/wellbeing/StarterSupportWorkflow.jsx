"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { buildStarterSupportRecord } from "@/lib/wellbeing/starterSupport";
import SupportRequestPanel from "./SupportRequestPanel";
import WellbeingActionList from "./WellbeingActionList";
import {
  WellbeingOutputCard as OutputCard,
  WellbeingSelectField as SelectField,
  WellbeingToggleGroup as ToggleGroup
} from "./WellbeingControls";

const initialFields = {
  experienceStage: "first_month",
  roleArea: "child_protection",
  unclearTopics: ["role_boundaries", "documentation", "network_work"],
  existingSupport: ["manager_check_in"],
  missingSupport: ["mentor", "covision", "clear_documentation_routine"],
  casesNotCarryAlone: ["complex_family_case"],
  covisionNeedSigns: ["ethical_tension", "role_uncertainty"],
  mentorDiscussionNeed: true,
  managerDiscussionNeed: true,
  workBoundaryNeed: true,
  supportUrgency: "soon"
};

const selectFields = [
  {
    key: "experienceStage",
    label: "Töökogemuse etapp",
    options: [
      ["first_week", "Esimene nädal"],
      ["first_month", "Esimene kuu"],
      ["first_100_days", "Esimesed 100 päeva"],
      ["new_role", "Uus roll samas valdkonnas"]
    ]
  },
  {
    key: "roleArea",
    label: "Rollivaldkond",
    options: [
      ["child_protection", "Lastekaitse"],
      ["adult_support", "Täiskasvanute tugi"],
      ["elderly_support", "Eakate tugi"],
      ["disability_support", "Puuetega inimeste tugi"],
      ["service_coordination", "Teenuste koordineerimine"],
      ["general_social_work", "Üldine sotsiaaltöö"]
    ]
  },
  {
    key: "supportUrgency",
    label: "Toe kokkuleppe kiireloomulisus",
    options: [
      ["stable", "Stabiilne"],
      ["plan_needed", "Plaan vajab täpsustamist"],
      ["soon", "Vaja lähiajal kokku leppida"],
      ["urgent", "Vaja kiiret kokkulepet"]
    ]
  }
];

const multiFields = [
  {
    key: "unclearTopics",
    label: "Ebaselged teemad",
    options: [
      ["role_boundaries", "Roll ja vastutus"],
      ["documentation", "Dokumenteerimine"],
      ["network_work", "Võrgustikutöö"],
      ["service_rules", "Teenuste reeglid"],
      ["risk_escalation", "Riskide eskaleerimine"],
      ["work_boundaries", "Tööpiirid"]
    ]
  },
  {
    key: "existingSupport",
    label: "Olemasolev tugi",
    options: [
      ["manager_check_in", "Juhi kontrollpunkt"],
      ["team_channel", "Tiimi kanal"],
      ["onboarding_material", "Sisseelamismaterjal"],
      ["shadowing", "Kogenuma kolleegi jälgimine"],
      ["case_discussion", "Juhtumiarutelu"]
    ]
  },
  {
    key: "missingSupport",
    label: "Puuduv tugi",
    options: [
      ["mentor", "Mentor"],
      ["covision", "Kovisioon"],
      ["clear_documentation_routine", "Selge dokumenteerimisrutiin"],
      ["role_expectations", "Rolliootuste selgitus"],
      ["boundary_agreement", "Tööpiiride kokkulepe"],
      ["case_escalation_rule", "Juhtumi eskaleerimise reegel"]
    ]
  },
  {
    key: "casesNotCarryAlone",
    label: "Juhtumid, mida ei tohiks üksi kanda",
    options: [
      ["complex_family_case", "Keeruline perejuhtum"],
      ["workplace_violence", "Töövägivalla olukord"],
      ["ethical_tension_case", "Eetilise pingega juhtum"],
      ["high_risk_case", "Kõrge riskiga juhtum"],
      ["unclear_mandate", "Ebaselge mandaadiga juhtum"]
    ]
  },
  {
    key: "covisionNeedSigns",
    label: "Kovisiooni vajaduse märgid",
    options: [
      ["ethical_tension", "Eetiline pinge"],
      ["role_uncertainty", "Rolli ebaselgus"],
      ["emotional_load", "Emotsionaalne koormus"],
      ["repeating_case_pattern", "Korduv juhtumimuster"],
      ["not_to_carry_alone", "Ei peaks üksi kandma"]
    ]
  }
];

const signalCopy = {
  support_available: {
    title: "Tugi on pigem olemas",
    text: "Alustamise tugi on olemas ja vajab peamiselt nähtaval hoidmist."
  },
  needs_clearer_support_plan: {
    title: "Vajab selgemat töötoe plaani",
    text: "Mõni tugi, rolliootus või dokumenteerimise rutiin vajab selgemat kokkulepet."
  },
  needs_urgent_support_agreement: {
    title: "Vajab kiiremat toe kokkulepet",
    text: "Puuduv tugi või keerulised juhtumid vajavad juhiga, mentoriga või kovisioonis kiiremat kokkulepet."
  }
};

const actionRoutes = {
  "role-boundaries": "/tooheaolu/rollipiirid",
  "work-processes": "/tooheaolu/tooprotsessid",
  "work-boundaries": "/tooheaolu/toopiirid",
  covision: "/kovisioon",
  overview: "/tooheaolu/ulevaade"
};

export default function StarterSupportWorkflow({ onNavigate }) {
  const { t } = useI18n();
  const [fields, setFields] = useState(initialFields);
  const [saveState, setSaveState] = useState("idle");
  const record = useMemo(
    () => buildStarterSupportRecord({
      period: "current",
      roleGroup: "SOCIAL_WORKER",
      standardizedFields: fields
    }),
    [fields]
  );
  const signal = record.computedSignal.signalLevel;
  const signalText = signalCopy[signal] || signalCopy.needs_clearer_support_plan;

  function updateField(key, value) {
    setFields((current) => ({ ...current, [key]: value }));
    setSaveState("idle");
  }

  function toggleValue(key, value) {
    setFields((current) => {
      const selected = new Set(current[key]);
      if (selected.has(value)) selected.delete(value);
      else selected.add(value);
      return { ...current, [key]: [...selected] };
    });
    setSaveState("idle");
  }

  async function saveStarterSupport() {
    setSaveState("saving");
    try {
      const response = await fetch("/api/wellbeing/starter-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: "current",
          roleGroup: "SOCIAL_WORKER",
          standardizedFields: fields
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "wellbeing.errors.starter_support_save_failed");
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div>
      <section aria-labelledby="starter-support-heading">
        <div>
          <h2 id="starter-support-heading">{t("wellbeing.starter_support.title", "Alustaja tugi")}</h2>
          <p>
            {t(
              "wellbeing.starter_support.intro",
              "Alustaja tugi aitab koostada esimese nädala, esimese kuu ja 100 päeva töötoe plaani alustavale spetsialistile."
            )}
          </p>
        </div>
        <div>
          <span>{signalText.title}</span>
          <p>{signalText.text}</p>
        </div>
      </section>

      <div>
        <fieldset>
          <legend>{t("wellbeing.starter_support.stage", "Etapp ja roll")}</legend>
          {selectFields.map((field) => (
            <SelectField key={field.key} field={field} value={fields[field.key]} onChange={updateField} />
          ))}
          <div>
            <label>
              <input
                type="checkbox"
                checked={fields.mentorDiscussionNeed}
                onChange={(event) => updateField("mentorDiscussionNeed", event.target.checked)}
              />
              {t("wellbeing.starter_support.mentor_discussion_need", "Vaja on mentori arutelu")}
            </label>
            <label>
              <input
                type="checkbox"
                checked={fields.managerDiscussionNeed}
                onChange={(event) => updateField("managerDiscussionNeed", event.target.checked)}
              />
              {t("wellbeing.starter_support.manager_discussion_need", "Vaja on juhiga arutelu")}
            </label>
            <label>
              <input
                type="checkbox"
                checked={fields.workBoundaryNeed}
                onChange={(event) => updateField("workBoundaryNeed", event.target.checked)}
              />
              {t("wellbeing.starter_support.work_boundary_need", "Vaja on alustaja tööpiiride kokkulepet")}
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>{t("wellbeing.starter_support.unclear_topics", "Ebaselged teemad")}</legend>
          <ToggleGroup field={multiFields[0]} values={fields.unclearTopics} onToggle={toggleValue} />
        </fieldset>
      </div>

      <section aria-labelledby="starter-support-details-heading">
        <h3 id="starter-support-details-heading">
          {t("wellbeing.starter_support.support_map", "Toe vajaduse kaart")}
        </h3>
        <div>
          {multiFields.slice(1).map((field) => (
            <div key={field.key}>
              <h4>{field.label}</h4>
              <ToggleGroup field={field} values={fields[field.key]} onToggle={toggleValue} />
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="starter-support-output-heading">
        <h3 id="starter-support-output-heading">
          {t("wellbeing.starter_support.output_heading", "Praktiline väljund")}
        </h3>
        <div>
          <OutputCard title="Esimese nädala plaan" value={record.outputSummary.firstWeekPlan} />
          <OutputCard title="Esimese kuu fookused" value={record.outputSummary.firstMonthFocus} />
          <OutputCard title="100 päeva töötoe plaan" value={record.outputSummary.hundredDaySupportPlan} />
          <OutputCard title="Küsimused juhile või mentorile" value={record.outputSummary.managerMentorQuestions} />
          <OutputCard title="Kovisiooni vajaduse kontroll" value={record.outputSummary.covisionNeedCheck} />
          <OutputCard title="Alustaja tööpiiride mustand" value={record.outputSummary.boundaryDraft} />
        </div>
        <div>
          <Button type="button" onClick={saveStarterSupport} disabled={saveState === "saving"}>
            {saveState === "saving"
              ? t("wellbeing.starter_support.saving", "Salvestan...")
              : t("wellbeing.starter_support.save", "Salvesta alustaja töötoe plaan")}
          </Button>
          <WellbeingActionList actions={record.recommendedActions} actionRoutes={actionRoutes} onNavigate={onNavigate} />
        </div>
        <p role="status">
          {saveState === "saved"
            ? t("wellbeing.starter_support.saved", "Alustaja töötoe plaan salvestati privaatselt.")
            : saveState === "error"
              ? t("wellbeing.starter_support.save_failed", "Salvestamine ebaõnnestus. Proovi uuesti.")
              : ""}
        </p>
      </section>

      <SupportRequestPanel
        sourceWorkflowType="starter-support"
        context={record}
        onNavigate={onNavigate}
      />
    </div>
  );
}
