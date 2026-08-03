"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import { buildRecoveryRecord } from "@/lib/wellbeing/recovery";
import SupportRequestPanel from "./SupportRequestPanel";
import { WellbeingOutputCard as OutputCard, WellbeingSelectField as SelectField } from "./WellbeingControls";

const initialFields = {
  recoveryReason: "heavy_week",
  recoveryLevel: "partial",
  workCapacityNext72h: "reduced",
  unavoidableTasks: ["kriitiline juhtumikontakt"],
  deferrableTasks: ["aruande viimistlus"],
  redistributableTasks: ["partneri järelpärimine"],
  primaryLoadFactors: ["documentation"],
  supportNeed: "manager",
  covisionNeed: false,
  nextCheckpoint: "tomorrow"
};

const selectFields = [
  {
    key: "recoveryReason",
    label: "Taastumise põhjus",
    options: [
      ["heavy_week", "Raske nädal"],
      ["difficult_case", "Raske juhtum"],
      ["workplace_violence", "Töövägivalla kogemus"],
      ["long_overload", "Pikaajaline ülekoormus"]
    ]
  },
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
    key: "workCapacityNext72h",
    label: "Töövõime järgmise 24-72h vaates",
    options: [
      ["stable", "Stabiilne"],
      ["reduced", "Vähenenud"],
      ["low", "Madal"],
      ["not_sustainable", "Ei ole kestlik"]
    ]
  },
  {
    key: "supportNeed",
    label: "Vajalik tugi",
    options: [
      ["none", "Ei vaja eraldi tuge"],
      ["manager", "Juhi kokkulepe"],
      ["colleague", "Kolleegitugi"],
      ["supervisor", "Supervisioon või muu kokkulepitud tugi"]
    ]
  },
  {
    key: "nextCheckpoint",
    label: "Järgmine kontrollpunkt",
    options: [
      ["today", "Täna"],
      ["tomorrow", "Homme"],
      ["in_72h", "72 tunni pärast"],
      ["next_week", "Järgmisel nädalal"]
    ]
  }
];

const loadOptions = [
  ["documentation", "Dokumenteerimine"],
  ["interruptions", "Katkestused"],
  ["difficult_case", "Raske juhtum"],
  ["workplace_violence", "Töövägivald"],
  ["after_hours", "Tööväline kättesaadavus"],
  ["role_conflict", "Rollikonflikt"]
];

const signalCopy = {
  manageable: {
    title: "Juhitav",
    text: "Taastumine vajab hoidmist, aga plaan püsib praegu töökorralduslikult juhitav."
  },
  prioritize: {
    title: "Vajab prioriseerimist",
    text: "Järgmise 24-72 tunni töö tuleb kitsendada vältimatule ja osa tegevusi edasi lükata."
  },
  organizational_support: {
    title: "Vajab töökorralduslikku tuge",
    text: "Taastumisruum või töövõime on madal. Vaja on kokkulepet toe, ümberjagamise või piiride kohta."
  }
};

function toLines(value) {
  return Array.isArray(value) ? value.join("\n") : String(value || "");
}

function fromLines(value) {
  return String(value || "")
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function RecoveryWorkflow({ onNavigate }) {
  const { t } = useI18n();
  const [fields, setFields] = useState(initialFields);
  const [saveState, setSaveState] = useState("idle");
  const [savedRecordId, setSavedRecordId] = useState(null);
  const record = useMemo(
    () => buildRecoveryRecord({
      period: "current",
      roleGroup: "SOCIAL_WORKER",
      standardizedFields: fields
    }),
    [fields]
  );
  const signal = record.computedSignal.signalLevel;
  const signalText = signalCopy[signal] || signalCopy.prioritize;

  function updateField(key, value) {
    setFields((current) => ({ ...current, [key]: value }));
    setSaveState("idle");
  }

  function toggleLoadFactor(value) {
    setFields((current) => {
      const selected = new Set(current.primaryLoadFactors);
      if (selected.has(value)) selected.delete(value);
      else selected.add(value);
      return { ...current, primaryLoadFactors: [...selected] };
    });
    setSaveState("idle");
  }

  async function saveRecoveryPlan() {
    setSaveState("saving");
    try {
      const response = await fetch("/api/wellbeing/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: "current",
          roleGroup: "SOCIAL_WORKER",
          standardizedFields: fields
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "wellbeing.errors.recovery_save_failed");
      setSavedRecordId(payload.record?.id || null);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div>
      <section aria-labelledby="recovery-heading">
        <div>
          <h2 id="recovery-heading">{t("wellbeing.recovery.title", "Taastumine")}</h2>
          <p>
            {t(
              "wellbeing.recovery.intro",
              "24-72h taastumisplaan aitab eristada vältimatud ülesanded, edasilükatavad ülesanded ja ümberjagatavad ülesanded."
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
          <legend>{t("wellbeing.recovery.situation", "Olukord")}</legend>
          {selectFields.map((field) => (
            <SelectField key={field.key} field={field} value={fields[field.key]} onChange={updateField} />
          ))}
        </fieldset>

        <fieldset>
          <legend>{t("wellbeing.recovery.load_factors", "Peamised koormustegurid")}</legend>
          <div>
            {loadOptions.map(([value, label]) => (
              <Checkbox
                key={value}
                checked={fields.primaryLoadFactors.includes(value)}
                onChange={() => toggleLoadFactor(value)}
                label={label}
              />
            ))}
            <Checkbox
              checked={fields.covisionNeed}
              onChange={(checked) => updateField("covisionNeed", checked)}
              label={t("wellbeing.recovery.covision_need", "Vajab kovisiooni või kolleegituge")}
            />
          </div>
        </fieldset>
      </div>

      <section aria-labelledby="recovery-tasks-heading">
        <h3 id="recovery-tasks-heading">{t("wellbeing.recovery.tasks_heading", "24-72h tööplaan")}</h3>
        <div>
          <TaskTextarea
            title="Vältimatud ülesanded"
            value={fields.unavoidableTasks}
            onChange={(value) => updateField("unavoidableTasks", fromLines(value))}
          />
          <TaskTextarea
            title="Edasilükatavad ülesanded"
            value={fields.deferrableTasks}
            onChange={(value) => updateField("deferrableTasks", fromLines(value))}
          />
          <TaskTextarea
            title="Ümberjagatavad ülesanded"
            value={fields.redistributableTasks}
            onChange={(value) => updateField("redistributableTasks", fromLines(value))}
          />
        </div>
      </section>

      <section aria-labelledby="recovery-output-heading">
        <h3 id="recovery-output-heading">{t("wellbeing.recovery.output_heading", "Praktiline väljund")}</h3>
        <div>
          <OutputCard title="24-72h taastumisplaan" value={record.outputSummary.recoveryPlan72h} />
          <OutputCard title="Juhiga arutelu memo" value={record.outputSummary.managerMemo} />
        </div>
        <div>
          <Button type="button" onClick={saveRecoveryPlan} disabled={saveState === "saving"}>
            {saveState === "saving"
              ? t("wellbeing.recovery.saving", "Salvestan...")
              : t("wellbeing.recovery.save", "Salvesta taastumisplaan")}
          </Button>
          <Button type="button" onClick={() => onNavigate?.("/tooheaolu/toopiirid")}>
            {t("wellbeing.recovery.open_boundaries", "Ava tööpiirid")}
          </Button>
        </div>
        <p role="status">
          {saveState === "saved"
            ? t("wellbeing.recovery.saved", "Taastumisplaan salvestati privaatselt.")
            : saveState === "error"
              ? t("wellbeing.recovery.save_failed", "Salvestamine ebaõnnestus. Proovi uuesti.")
              : ""}
        </p>
      </section>

      <SupportRequestPanel
        sourceWorkflowType="recovery"
        sourceRecordId={saveState === "saved" ? savedRecordId : null}
        context={record}
        onNavigate={onNavigate}
      />
    </div>
  );
}

function TaskTextarea({ title, value, onChange }) {
  return (
    <label>
      <h4>{title}</h4>
      <textarea value={toLines(value)} onChange={(event) => onChange(event.target.value)} rows={5} />
    </label>
  );
}
