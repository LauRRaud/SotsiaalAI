"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { buildQuickCheckRecord, formatQuickCheckFactor } from "@/lib/wellbeing/quickCheck";
import SupportRequestPanel from "./SupportRequestPanel";
import WellbeingActionList from "./WellbeingActionList";
import { WellbeingSelectField } from "./WellbeingControls";

const fieldGroups = [
  {
    title: "Töö nõudmised",
    fields: [
      {
        key: "workloadLevel",
        label: "Töömaht",
        options: [
          ["low", "Madal"],
          ["moderate", "Mõõdukas"],
          ["high", "Kõrge"],
          ["critical", "Kriitiline"]
        ]
      },
      {
        key: "caseComplexityLevel",
        label: "Juhtumite keerukus",
        options: [
          ["routine", "Rutiinne"],
          ["moderate", "Mõõdukas"],
          ["complex", "Keerukas"],
          ["very_complex", "Väga keerukas"]
        ]
      },
      {
        key: "emotionalLoad",
        label: "Emotsionaalne koormus",
        options: [
          ["low", "Madal"],
          ["moderate", "Mõõdukas"],
          ["high", "Kõrge"],
          ["very_high", "Väga kõrge"]
        ]
      },
      {
        key: "documentationLoad",
        label: "Dokumenteerimise koormus",
        options: [
          ["low", "Madal"],
          ["moderate", "Mõõdukas"],
          ["high", "Kõrge"],
          ["very_high", "Väga kõrge"]
        ]
      },
      {
        key: "interruptionsLevel",
        label: "Katkestused",
        options: [
          ["low", "Madalad"],
          ["moderate", "Mõõdukad"],
          ["high", "Kõrged"],
          ["very_high", "Väga kõrged"]
        ]
      },
      {
        key: "afterHoursImpact",
        label: "Töövälise kättesaadavuse mõju",
        options: [
          ["none", "Puudub"],
          ["low", "Madal"],
          ["moderate", "Mõõdukas"],
          ["high", "Kõrge"]
        ]
      }
    ]
  },
  {
    title: "Tööressursid",
    fields: [
      {
        key: "recoveryLevel",
        label: "Taastumisvõimalus",
        options: [
          ["sufficient", "Piisav"],
          ["partial", "Osaline"],
          ["low", "Vähene"],
          ["none", "Puudub"]
        ]
      },
      {
        key: "decisionControl",
        label: "Otsustusruum töö üle",
        options: [
          ["high", "Kõrge"],
          ["moderate", "Mõõdukas"],
          ["low", "Madal"],
          ["none", "Puudub"]
        ]
      },
      {
        key: "priorityClarity",
        label: "Prioriteetide selgus",
        options: [
          ["clear", "Selge"],
          ["partly_clear", "Osaliselt selge"],
          ["unclear", "Ebaselge"]
        ]
      },
      {
        key: "supportAvailability",
        label: "Juhi või kolleegi tugi",
        options: [
          ["available", "Kättesaadav"],
          ["partial", "Osaline"],
          ["unclear", "Ebaselge"],
          ["not_available", "Pole kättesaadav"]
        ]
      },
      {
        key: "workBoundaryClarity",
        label: "Tööpiiride selgus",
        options: [
          ["clear", "Selge"],
          ["partly_clear", "Osaliselt selge"],
          ["unclear", "Ebaselge"]
        ]
      }
    ]
  }
];

const initialFields = {
  workloadLevel: "moderate",
  caseComplexityLevel: "moderate",
  emotionalLoad: "moderate",
  documentationLoad: "moderate",
  interruptionsLevel: "moderate",
  recoveryLevel: "partial",
  afterHoursImpact: "low",
  decisionControl: "moderate",
  priorityClarity: "partly_clear",
  supportAvailability: "partial",
  covisionNeed: false,
  workBoundaryClarity: "partly_clear",
  difficultCaseMarker: false,
  supportNeed: false
};

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

export default function QuickCheckWorkflow({ onNavigate }) {
  const { t } = useI18n();
  const [fields, setFields] = useState(initialFields);
  const [saveState, setSaveState] = useState("idle");
  const [savedRecordId, setSavedRecordId] = useState(null);
  const record = useMemo(
    () => buildQuickCheckRecord({
      period: "current",
      roleGroup: "SOCIAL_WORKER",
      standardizedFields: fields
    }),
    [fields]
  );
  const signal = record.computedSignal.signalLevel;
  const signalText = signalCopy[signal] || signalCopy.yellow;

  function updateField(key, value) {
    setFields((current) => ({ ...current, [key]: value }));
    setSaveState("idle");
  }

  async function saveQuickCheck() {
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

  return (
    <div>
      <section aria-labelledby="quick-check-heading">
        <div>
          <h2 id="quick-check-heading">{t("wellbeing.quick_check.title", "Kiirkontroll")}</h2>
          <p>
            {t(
              "wellbeing.quick_check.intro",
              "Töökoormuse radar kasutab standardvälju, et anda roheline, kollane või punane töökorralduslik signaal."
            )}
          </p>
        </div>
        <div>
          <span>{signalText.title}</span>
          <p>{signalText.text}</p>
        </div>
      </section>

      <div>
        {fieldGroups.map((group) => (
          <fieldset key={group.title}>
            <legend>{group.title}</legend>
            {group.fields.map((field) => (
              <WellbeingSelectField key={field.key} field={field} value={fields[field.key]} onChange={updateField} />
            ))}
          </fieldset>
        ))}
      </div>

      <fieldset>
        <legend>{t("wellbeing.quick_check.risk_support", "Riskimärgid ja toe vajadus")}</legend>
        <label>
          <input
            type="checkbox"
            checked={fields.difficultCaseMarker}
            onChange={(event) => updateField("difficultCaseMarker", event.target.checked)}
          />
          {t("wellbeing.quick_check.difficult_case_marker", "Raske juhtum, mida ei peaks üksi kandma")}
        </label>
        <label>
          <input
            type="checkbox"
            checked={fields.covisionNeed}
            onChange={(event) => updateField("covisionNeed", event.target.checked)}
          />
          {t("wellbeing.quick_check.covision_need", "Vajab kovisiooni või kolleegituge")}
        </label>
        <label>
          <input
            type="checkbox"
            checked={fields.supportNeed}
            onChange={(event) => updateField("supportNeed", event.target.checked)}
          />
          {t("wellbeing.quick_check.support_need", "Vajab juhiga toe kokkulepet")}
        </label>
      </fieldset>

      <section aria-labelledby="quick-check-output-heading">
        <h3 id="quick-check-output-heading">{t("wellbeing.quick_check.output_heading", "Praktiline väljund")}</h3>
        <div>
          <OutputList
            title={t("wellbeing.quick_check.load_factors", "Koormustegurid")}
            items={record.loadFactors}
            emptyText={t("wellbeing.quick_check.no_load_factors", "Kõrgeid koormustegureid ei ilmnenud.")}
          />
          <OutputList
            title={t("wellbeing.quick_check.resource_factors", "Puuduvad ressursid")}
            items={record.resourceFactors}
            emptyText={t("wellbeing.quick_check.no_resource_factors", "Põhiressursid paistavad olemas.")}
          />
          <OutputList
            title={t("wellbeing.quick_check.risk_markers", "Riskimärgid")}
            items={record.riskMarkers}
            emptyText={t("wellbeing.quick_check.no_risk_markers", "Eraldi riskimärki ei märgitud.")}
          />
        </div>

        <div>
          <Button
            type="button"
           
            onClick={saveQuickCheck}
            disabled={saveState === "saving"}
          >
            {saveState === "saving"
              ? t("wellbeing.quick_check.saving", "Salvestan...")
              : t("wellbeing.quick_check.save", "Salvesta kiirkontroll")}
          </Button>
          {record.recommendedActions.length > 0 ? (
            <WellbeingActionList
              actions={record.recommendedActions}
              actionRoutes={Object.fromEntries(
                record.recommendedActions.map((action) => [
                  action.workflowType,
                  action.workflowType === "covision" ? "/kovisioon" : `/tooheaolu/${workflowSlug(action.workflowType)}`
                ])
              )}
              onNavigate={onNavigate}
            />
          ) : (
            <p>{t("wellbeing.quick_check.no_actions", "Jätka praeguste kokkulepete hoidmist ja tee uus kiirkontroll hiljem.")}</p>
          )}
        </div>
        <p role="status">
          {saveState === "saved"
            ? t("wellbeing.quick_check.saved", "Kiirkontroll salvestati privaatselt.")
            : saveState === "error"
              ? t("wellbeing.quick_check.save_failed", "Salvestamine ebaõnnestus. Proovi uuesti.")
              : ""}
        </p>
      </section>

      <p>
        {t(
          "wellbeing.quick_check.privacy",
          "Sisestus on vaikimisi privaatne. Seda ei jagata juhile, kolleegile ega kovisiooni ilma sinu kinnituse ja eraldi jagatava versioonita."
        )}
      </p>

      <SupportRequestPanel
        sourceWorkflowType="quick-check"
        sourceRecordId={saveState === "saved" ? savedRecordId : null}
        context={record}
        onNavigate={onNavigate}
      />
    </div>
  );
}

function OutputList({ title, items, emptyText }) {
  return (
    <div>
      <h4>{title}</h4>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => <li key={item}>{formatQuickCheckFactor(item)}</li>)}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </div>
  );
}

function workflowSlug(workflowType) {
  return {
    "hard-case": "raske-juhtum",
    "work-processes": "tooprotsessid",
    interruptions: "katkestused",
    recovery: "taastumine",
    "work-boundaries": "toopiirid",
    "role-boundaries": "rollipiirid"
  }[workflowType] || workflowType;
}
