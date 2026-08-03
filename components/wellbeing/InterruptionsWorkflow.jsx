"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import { buildInterruptionsRecord } from "@/lib/wellbeing/interruptions";
import SupportRequestPanel from "./SupportRequestPanel";
import WellbeingActionList from "./WellbeingActionList";
import { WellbeingOutputCard as OutputCard, WellbeingSelectField as SelectField } from "./WellbeingControls";

const initialFields = {
  interruptionClass: "negotiable",
  sources: ["phone", "colleague_questions", "documentation_system"],
  frequency: "often",
  workImpact: "moderate",
  immediateResponseNeed: "partial",
  canWait: "many",
  neededAgreement: "focus_time",
  counterpart: "team",
  wrongChannelShare: "some",
  documentationInterruption: true,
  recoveryImpact: "some"
};

const selectFields = [
  {
    key: "interruptionClass",
    label: "Katkestuse liik",
    options: [
      ["unavoidable", "Vältimatu kiire sekkumine"],
      ["negotiable", "Kokkulepitav katkestus"],
      ["deferrable", "Edasilükatav küsimus"],
      ["wrong_channel", "Vale suhtluskanal"],
      ["role_boundary", "Rollipiiri ületav katkestus"],
      ["documentation_system", "Dokumenteerimise või süsteemi katkestus"],
      ["partner_process", "Koostööpartneri protsessi katkestus"]
    ]
  },
  {
    key: "frequency",
    label: "Sagedus",
    options: [
      ["rare", "Harva"],
      ["sometimes", "Mõnikord"],
      ["often", "Sageli"],
      ["very_often", "Väga sageli"]
    ]
  },
  {
    key: "workImpact",
    label: "Mõju tööle",
    options: [
      ["low", "Madal"],
      ["moderate", "Mõõdukas"],
      ["high", "Kõrge"]
    ]
  },
  {
    key: "immediateResponseNeed",
    label: "Kohe reageerimise vajaduse selgus",
    options: [
      ["clear", "Selge"],
      ["partial", "Osaliselt selge"],
      ["unclear", "Ebaselge"]
    ]
  },
  {
    key: "canWait",
    label: "Kui palju saaks oodata?",
    options: [
      ["few", "Vähesed"],
      ["some", "Osa"],
      ["many", "Paljud"]
    ]
  },
  {
    key: "neededAgreement",
    label: "Vajalik kokkulepe",
    options: [
      ["focus_time", "Fookusaeg"],
      ["channel_rules", "Suhtluskanalite reeglid"],
      ["role_boundary", "Rollipiir"],
      ["process_change", "Tööprotsessi muutus"],
      ["team_agreement", "Tiimi kokkulepe"]
    ]
  },
  {
    key: "counterpart",
    label: "Kokkuleppe osapool",
    options: [
      ["manager", "Juht"],
      ["team", "Tiim"],
      ["colleague", "Kolleeg"],
      ["partner", "Koostööpartner"]
    ]
  },
  {
    key: "wrongChannelShare",
    label: "Valest kanalist tulev osa",
    options: [
      ["none", "Puudub"],
      ["some", "Osa"],
      ["many", "Palju"]
    ]
  },
  {
    key: "recoveryImpact",
    label: "Mõju taastumisele",
    options: [
      ["none", "Puudub"],
      ["some", "Mõningane"],
      ["high", "Kõrge"]
    ]
  }
];

const sourceOptions = [
  ["phone", "Telefon"],
  ["email", "E-kiri"],
  ["message", "Sõnum"],
  ["colleague_questions", "Kolleegi küsimused"],
  ["manager_requests", "Juhi päringud"],
  ["client_contact", "Kliendikontakt"],
  ["partner_contact", "Koostööpartner"],
  ["documentation_system", "Dokumenteerimissüsteem"],
  ["meetings", "Koosolekud"],
  ["urgent_cases", "Kiired juhtumid"]
];

const signalCopy = {
  manageable: {
    title: "Juhitav",
    text: "Katkestusi on, kuid need on pigem selged ja vajavad peamiselt kokkuleppe hoidmist."
  },
  needs_workflow_clarification: {
    title: "Vajab töövoo täpsustamist",
    text: "Katkestuste sagedus, kanal või kiireloomulisus vajab selgemat töökorralduslikku kokkulepet."
  },
  needs_reorganization: {
    title: "Vajab ümberkorraldust",
    text: "Katkestused killustavad tööpäeva ja taastumist. Vajalik on fookusaja, kanalite või tööprotsessi kokkulepe."
  }
};

const actionRoutes = {
  "work-boundaries": "/tooheaolu/toopiirid",
  "work-processes": "/tooheaolu/tooprotsessid",
  recovery: "/tooheaolu/taastumine",
  overview: "/tooheaolu/ulevaade"
};

export default function InterruptionsWorkflow({ onNavigate }) {
  const { t } = useI18n();
  const [fields, setFields] = useState(initialFields);
  const [saveState, setSaveState] = useState("idle");
  const [savedRecordId, setSavedRecordId] = useState(null);
  const record = useMemo(
    () => buildInterruptionsRecord({
      period: "current",
      roleGroup: "SOCIAL_WORKER",
      standardizedFields: fields
    }),
    [fields]
  );
  const signal = record.computedSignal.signalLevel;
  const signalText = signalCopy[signal] || signalCopy.needs_workflow_clarification;

  function updateField(key, value) {
    setFields((current) => ({ ...current, [key]: value }));
    setSaveState("idle");
  }

  function toggleSource(value) {
    setFields((current) => {
      const selected = new Set(current.sources);
      if (selected.has(value)) selected.delete(value);
      else selected.add(value);
      return { ...current, sources: [...selected] };
    });
    setSaveState("idle");
  }

  async function saveInterruptionsPlan() {
    setSaveState("saving");
    try {
      const response = await fetch("/api/wellbeing/interruptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: "current",
          roleGroup: "SOCIAL_WORKER",
          standardizedFields: fields
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "wellbeing.errors.interruptions_save_failed");
      setSavedRecordId(payload.record?.id || null);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div>
      <section aria-labelledby="interruptions-heading">
        <div>
          <h2 id="interruptions-heading">{t("wellbeing.interruptions.title", "Katkestused")}</h2>
          <p>
            {t(
              "wellbeing.interruptions.intro",
              "Katkestuste töövoog aitab eristada vältimatut, kokkulepitavat ja edasi lükatavat suhtlust ning vormistada fookusaja ja kanalite kokkuleppe."
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
          <legend>{t("wellbeing.interruptions.situation", "Katkestuse muster")}</legend>
          {selectFields.slice(0, 5).map((field) => (
            <SelectField key={field.key} field={field} value={fields[field.key]} onChange={updateField} />
          ))}
        </fieldset>

        <fieldset>
          <legend>{t("wellbeing.interruptions.agreement", "Kokkuleppe raam")}</legend>
          {selectFields.slice(5).map((field) => (
            <SelectField key={field.key} field={field} value={fields[field.key]} onChange={updateField} />
          ))}
          <div>
            <Checkbox
              checked={fields.documentationInterruption}
              onChange={(checked) => updateField("documentationInterruption", checked)}
              label={t("wellbeing.interruptions.documentation_interruption", "Dokumenteerimine või süsteem katkestab töövoogu")}
            />
          </div>
        </fieldset>
      </div>

      <section aria-labelledby="interruptions-sources-heading">
        <h3 id="interruptions-sources-heading">{t("wellbeing.interruptions.sources", "Katkestuste allikad")}</h3>
        <div>
          {sourceOptions.map(([value, label]) => (
            <Checkbox
              key={value}
              checked={fields.sources.includes(value)}
              onChange={() => toggleSource(value)}
              label={label}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="interruptions-output-heading">
        <h3 id="interruptions-output-heading">
          {t("wellbeing.interruptions.output_heading", "Praktiline väljund")}
        </h3>
        <div>
          <OutputCard title="Katkestuste kaart" value={record.outputSummary.interruptionMap} />
          <OutputCard title="Fookusaja kokkulepe" value={record.outputSummary.focusTimeAgreement} />
          <OutputCard title="Suhtluskanalite kokkulepe" value={record.outputSummary.channelAgreement} />
          <OutputCard title="Juhiga arutelu memo" value={record.outputSummary.managerMemo} />
        </div>
        <div>
          <Button type="button" onClick={saveInterruptionsPlan} disabled={saveState === "saving"}>
            {saveState === "saving"
              ? t("wellbeing.interruptions.saving", "Salvestan...")
              : t("wellbeing.interruptions.save", "Salvesta katkestuste kokkulepe")}
          </Button>
          <WellbeingActionList actions={record.recommendedActions} actionRoutes={actionRoutes} onNavigate={onNavigate} />
        </div>
        <p role="status">
          {saveState === "saved"
            ? t("wellbeing.interruptions.saved", "Katkestuste töövoog salvestati privaatselt.")
            : saveState === "error"
              ? t("wellbeing.interruptions.save_failed", "Salvestamine ebaõnnestus. Proovi uuesti.")
              : ""}
        </p>
      </section>

      <SupportRequestPanel
        sourceWorkflowType="interruptions"
        sourceRecordId={saveState === "saved" ? savedRecordId : null}
        context={record}
        onNavigate={onNavigate}
      />
    </div>
  );
}
