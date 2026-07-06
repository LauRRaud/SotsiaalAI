"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { buildRoleBoundariesRecord } from "@/lib/wellbeing/roleBoundaries";
import SupportRequestPanel from "./SupportRequestPanel";
import WellbeingActionList from "./WellbeingActionList";
import { WellbeingOutputCard as OutputCard, WellbeingSelectField as SelectField } from "./WellbeingControls";

const initialFields = {
  expectationSource: "client_family",
  expectedAction: "solve_partner_delay",
  myRole: "case_worker",
  outsideRole: "make_other_agency_decision",
  neededResponsibility: "partner_agency",
  roleConflict: "high",
  partnerExplanationNeed: true,
  managerDiscussionNeed: true,
  availabilityPressure: "high",
  ethicalComplexity: "moderate",
  counterpart: "partner"
};

const selectFields = [
  {
    key: "expectationSource",
    label: "Kes esitab ootuse?",
    options: [
      ["client", "Klient"],
      ["client_family", "Kliendi lähedane"],
      ["manager", "Juht"],
      ["colleague", "Kolleeg"],
      ["partner", "Koostööpartner"],
      ["network", "Võrgustik"]
    ]
  },
  {
    key: "expectedAction",
    label: "Mida oodatakse?",
    options: [
      ["explain_service", "Teenuse või otsuse selgitus"],
      ["solve_partner_delay", "Partneri viivituse lahendamine"],
      ["be_always_available", "Pidev kättesaadavus"],
      ["make_decision", "Otsuse tegemine"],
      ["coordinate_network", "Võrgustiku koordineerimine"],
      ["emotional_support", "Emotsionaalne tugi"]
    ]
  },
  {
    key: "myRole",
    label: "Mis on minu roll?",
    options: [
      ["case_worker", "Juhtumitöö koordineerimine"],
      ["advisor", "Nõustamine ja selgitamine"],
      ["service_link", "Teenuse või kontakti vahendamine"],
      ["assessment_input", "Hindamise sisendi kogumine"],
      ["support_planning", "Toe planeerimine"]
    ]
  },
  {
    key: "outsideRole",
    label: "Mis ei ole minu roll?",
    options: [
      ["none", "Piir on selge"],
      ["make_other_agency_decision", "Teise asutuse otsuse tegemine"],
      ["replace_service_provider", "Teenuseosutaja rolli asendamine"],
      ["be_crisis_contact", "Kriisikontakti roll"],
      ["guarantee_outcome", "Tulemuse garanteerimine"],
      ["carry_partner_responsibility", "Partneri vastutuse kandmine"]
    ]
  },
  {
    key: "neededResponsibility",
    label: "Kelle panus on vajalik?",
    options: [
      ["self", "Minu rolli piires lahendatav"],
      ["manager", "Juhi panus"],
      ["partner_agency", "Koostööpartneri panus"],
      ["service_provider", "Teenuseosutaja panus"],
      ["network", "Võrgustiku ühine panus"],
      ["client_family", "Kliendi või lähedase panus"]
    ]
  },
  {
    key: "roleConflict",
    label: "Rollikonflikti tase",
    options: [
      ["none", "Puudub"],
      ["low", "Madal"],
      ["moderate", "Mõõdukas"],
      ["high", "Kõrge"]
    ]
  },
  {
    key: "availabilityPressure",
    label: "Kättesaadavuse surve",
    options: [
      ["none", "Puudub"],
      ["low", "Madal"],
      ["moderate", "Mõõdukas"],
      ["high", "Kõrge"]
    ]
  },
  {
    key: "ethicalComplexity",
    label: "Eetiline keerukus",
    options: [
      ["low", "Madal"],
      ["moderate", "Mõõdukas"],
      ["high", "Kõrge"]
    ]
  },
  {
    key: "counterpart",
    label: "Selgituse osapool",
    options: [
      ["client", "Klient"],
      ["client_family", "Kliendi lähedane"],
      ["manager", "Juht"],
      ["partner", "Koostööpartner"],
      ["team", "Tiim"]
    ]
  }
];

const signalCopy = {
  clear: {
    title: "Roll on pigem selge",
    text: "Ootus, roll ja vastutus on piisavalt eristatavad. Vajadusel vormista lühike selgitus."
  },
  needs_clarification: {
    title: "Vajab selgitamist",
    text: "Mõni ootus, vastutus või osapoole panus vajab selgemat sõnastust."
  },
  needs_network_discussion: {
    title: "Vajab töökorralduslikku või võrgustiku arutelu",
    text: "Rollikonflikt või vastutuse nihkumine vajab juhiga, partneriga või kovisioonis läbi rääkimist."
  }
};

const actionRoutes = {
  "work-boundaries": "/tooheaolu/toopiirid",
  "work-processes": "/tooheaolu/tooprotsessid",
  interruptions: "/tooheaolu/katkestused",
  covision: "/kovisioon",
  overview: "/tooheaolu/ulevaade"
};

export default function RoleBoundariesWorkflow({ onNavigate }) {
  const { t } = useI18n();
  const [fields, setFields] = useState(initialFields);
  const [saveState, setSaveState] = useState("idle");
  const record = useMemo(
    () => buildRoleBoundariesRecord({
      period: "current",
      roleGroup: "SOCIAL_WORKER",
      standardizedFields: fields
    }),
    [fields]
  );
  const signal = record.computedSignal.signalLevel;
  const signalText = signalCopy[signal] || signalCopy.needs_clarification;

  function updateField(key, value) {
    setFields((current) => ({ ...current, [key]: value }));
    setSaveState("idle");
  }

  async function saveRoleBoundaries() {
    setSaveState("saving");
    try {
      const response = await fetch("/api/wellbeing/role-boundaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: "current",
          roleGroup: "SOCIAL_WORKER",
          standardizedFields: fields
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "wellbeing.errors.role_boundaries_save_failed");
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div>
      <section aria-labelledby="role-boundaries-heading">
        <div>
          <h2 id="role-boundaries-heading">{t("wellbeing.role_boundaries.title", "Rollipiirid")}</h2>
          <p>
            {t(
              "wellbeing.role_boundaries.intro",
              "Rollipiiride töövoog aitab enne selgituse koostamist eristada ootust, vastutust, minu rolli ja teise osapoole panust."
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
          <legend>{t("wellbeing.role_boundaries.expectation", "Ootus ja roll")}</legend>
          {selectFields.slice(0, 5).map((field) => (
            <SelectField key={field.key} field={field} value={fields[field.key]} onChange={updateField} />
          ))}
        </fieldset>

        <fieldset>
          <legend>{t("wellbeing.role_boundaries.clarification", "Selgituse vajadus")}</legend>
          {selectFields.slice(5).map((field) => (
            <SelectField key={field.key} field={field} value={fields[field.key]} onChange={updateField} />
          ))}
          <div>
            <label>
              <input
                type="checkbox"
                checked={fields.partnerExplanationNeed}
                onChange={(event) => updateField("partnerExplanationNeed", event.target.checked)}
              />
              {t("wellbeing.role_boundaries.partner_explanation_need", "Vaja on partnerile rolliselgitust")}
            </label>
            <label>
              <input
                type="checkbox"
                checked={fields.managerDiscussionNeed}
                onChange={(event) => updateField("managerDiscussionNeed", event.target.checked)}
              />
              {t("wellbeing.role_boundaries.manager_discussion_need", "Vaja on juhiga arutelu")}
            </label>
          </div>
        </fieldset>
      </div>

      <section aria-labelledby="role-boundaries-output-heading">
        <h3 id="role-boundaries-output-heading">
          {t("wellbeing.role_boundaries.output_heading", "Praktiline väljund")}
        </h3>
        <div>
          <OutputCard title="Rollipiiride analüüs" value={record.outputSummary.roleBoundaryAnalysis} />
          <OutputCard title="Kliendile selgitus" value={record.outputSummary.clientExplanation} />
          <OutputCard title="Partnerile rolliselgitus" value={record.outputSummary.partnerClarification} />
          <OutputCard title="Mida saan / mida ei saa teha" value={record.outputSummary.canCannotDoText} />
          <OutputCard title="Juhiga memo" value={record.outputSummary.managerMemo} />
        </div>
        <div>
          <Button type="button" onClick={saveRoleBoundaries} disabled={saveState === "saving"}>
            {saveState === "saving"
              ? t("wellbeing.role_boundaries.saving", "Salvestan...")
              : t("wellbeing.role_boundaries.save", "Salvesta rollipiiride selgitus")}
          </Button>
          <WellbeingActionList actions={record.recommendedActions} actionRoutes={actionRoutes} onNavigate={onNavigate} />
        </div>
        <p role="status">
          {saveState === "saved"
            ? t("wellbeing.role_boundaries.saved", "Rollipiiride selgitus salvestati privaatselt.")
            : saveState === "error"
              ? t("wellbeing.role_boundaries.save_failed", "Salvestamine ebaõnnestus. Proovi uuesti.")
              : ""}
        </p>
      </section>

      <SupportRequestPanel
        sourceWorkflowType="role-boundaries"
        context={record}
        onNavigate={onNavigate}
      />
    </div>
  );
}
