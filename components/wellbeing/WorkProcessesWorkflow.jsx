"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { buildWorkProcessesRecord } from "@/lib/wellbeing/workProcesses";
import SupportRequestPanel from "./SupportRequestPanel";
import WellbeingActionList from "./WellbeingActionList";
import {
  WellbeingOutputCard as OutputCard,
  WellbeingSelectField as SelectField,
  WellbeingToggleGroup as ToggleGroup
} from "./WellbeingControls";

const initialFields = {
  analysisFocus: "documentation_flow",
  categories: ["documentation", "duplicate_entry", "information_search", "repetitive_tasks"],
  timeCostSources: ["same_data_multiple_places", "searching_partner_info", "manual_status_updates"],
  lowValueActivities: ["same_data_multiple_places", "manual_copying"],
  informationBlockers: ["unclear_owner", "missing_shared_view"],
  unfinishedWork: ["client_followup", "case_notes"],
  simplificationNeeds: ["single_entry", "shared_status_view"],
  documentationDuplication: "high",
  switchingLoad: "high",
  processImpact: "high",
  counterpart: "manager"
};

const selectFields = [
  {
    key: "analysisFocus",
    label: "Analüüsi fookus",
    options: [
      ["documentation_flow", "Dokumenteerimise töövoog"],
      ["case_flow", "Juhtumitöö töövoog"],
      ["partner_coordination", "Partneritega kooskõlastamine"],
      ["team_routine", "Tiimi korduv rutiin"],
      ["information_flow", "Info liikumine"]
    ]
  },
  {
    key: "documentationDuplication",
    label: "Dubleeriva dokumenteerimise tase",
    options: [
      ["none", "Puudub"],
      ["low", "Madal"],
      ["moderate", "Mõõdukas"],
      ["high", "Kõrge"]
    ]
  },
  {
    key: "switchingLoad",
    label: "Ümberlülitumise koormus",
    options: [
      ["low", "Madal"],
      ["moderate", "Mõõdukas"],
      ["high", "Kõrge"]
    ]
  },
  {
    key: "processImpact",
    label: "Tööprotsessi mõju",
    options: [
      ["low", "Madal"],
      ["moderate", "Mõõdukas"],
      ["high", "Kõrge"]
    ]
  },
  {
    key: "counterpart",
    label: "Arutelu osapool",
    options: [
      ["manager", "Juht"],
      ["team", "Tiim"],
      ["colleague", "Kolleeg"],
      ["partner", "Koostööpartner"]
    ]
  }
];

const multiFields = [
  {
    key: "categories",
    label: "Kategooriad",
    options: [
      ["client_value_work", "Väärtust loov klienditöö"],
      ["necessary_burden", "Vajalik, kuid koormav töö"],
      ["duplicate_entry", "Dubleeriv sisestamine"],
      ["documentation", "Dokumenteerimine"],
      ["information_search", "Info otsimine"],
      ["partner_coordination", "Partneritega kooskõlastamine"],
      ["waiting", "Ootamine"],
      ["repetitive_tasks", "Korduvtegevused"],
      ["low_value_work", "Vähese väärtusega tegevused"]
    ]
  },
  {
    key: "timeCostSources",
    label: "Peamised ajakulu allikad",
    options: [
      ["same_data_multiple_places", "Sama info mitmesse kohta"],
      ["searching_partner_info", "Partneri info otsimine"],
      ["manual_status_updates", "Käsitsi staatuse uuendamine"],
      ["waiting_for_answers", "Vastuste ootamine"],
      ["copying_between_systems", "Süsteemide vahel kopeerimine"],
      ["unclear_next_step", "Ebaselge järgmine samm"]
    ]
  },
  {
    key: "lowValueActivities",
    label: "Vähese väärtusega või dubleerivad tegevused",
    options: [
      ["same_data_multiple_places", "Sama andme korduv sisestus"],
      ["manual_copying", "Käsitsi kopeerimine"],
      ["status_chasing", "Seisu tagaajamine"],
      ["duplicate_meetings", "Dubleerivad arutelud"],
      ["unclear_templates", "Ebaselged mallid"]
    ]
  },
  {
    key: "informationBlockers",
    label: "Info liikumise takistused",
    options: [
      ["unclear_owner", "Ebaselge omanik"],
      ["missing_shared_view", "Puudub ühine vaade"],
      ["partner_delay", "Partneri viivitus"],
      ["system_gap", "Süsteemide vahe"],
      ["role_confusion", "Rollisegadus"]
    ]
  },
  {
    key: "unfinishedWork",
    label: "Mis jääb pooleli",
    options: [
      ["client_followup", "Kliendi järeltegevus"],
      ["case_notes", "Juhtumimärkmed"],
      ["partner_reply", "Partnerile vastamine"],
      ["planning", "Planeerimine"],
      ["recovery_pause", "Paus või taastumine"]
    ]
  },
  {
    key: "simplificationNeeds",
    label: "Mis võiks lihtsustada",
    options: [
      ["single_entry", "Ühekordne sisestus"],
      ["shared_status_view", "Ühine seisuvaade"],
      ["clear_owner", "Selge omanik"],
      ["template_cleanup", "Malli korrastus"],
      ["meeting_rule", "Koosolekureegel"]
    ]
  }
];

const signalCopy = {
  manageable: {
    title: "Töövoog on pigem juhitav",
    text: "Ajaröövleid on vähe või mõju on madal. Hoia nähtaval üks lihtsustus ja jälgi mustrit."
  },
  needs_simplification: {
    title: "Vajab lihtsustamist",
    text: "Mõni korduv samm, info liikumine või dokumenteerimine vajab väikest töökorralduslikku lihtsustust."
  },
  needs_organizational_change: {
    title: "Vajab töökorralduslikku muutust",
    text: "Dubleerimine, ümberlülitumine või pooleli jäävad tegevused vajavad juhiga või tiimiga selget muudatust."
  }
};

const actionRoutes = {
  interruptions: "/tooheaolu/katkestused",
  "work-boundaries": "/tooheaolu/toopiirid",
  "role-boundaries": "/tooheaolu/rollipiirid",
  overview: "/tooheaolu/ulevaade"
};

export default function WorkProcessesWorkflow({ onNavigate }) {
  const { t } = useI18n();
  const [fields, setFields] = useState(initialFields);
  const [saveState, setSaveState] = useState("idle");
  const [savedRecordId, setSavedRecordId] = useState(null);
  const record = useMemo(
    () => buildWorkProcessesRecord({
      period: "current",
      roleGroup: "SOCIAL_WORKER",
      standardizedFields: fields
    }),
    [fields]
  );
  const signal = record.computedSignal.signalLevel;
  const signalText = signalCopy[signal] || signalCopy.needs_simplification;

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

  async function saveWorkProcesses() {
    setSaveState("saving");
    try {
      const response = await fetch("/api/wellbeing/work-processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: "current",
          roleGroup: "SOCIAL_WORKER",
          standardizedFields: fields
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "wellbeing.errors.work_processes_save_failed");
      setSavedRecordId(payload.record?.id || null);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div>
      <section aria-labelledby="work-processes-heading">
        <div>
          <h2 id="work-processes-heading">{t("wellbeing.work_processes.title", "Tööprotsessid")}</h2>
          <p>
            {t(
              "wellbeing.work_processes.intro",
              "Tööprotsesside audit aitab kaardistada ajaröövleid, dubleerimist, info liikumise takistusi ja lihtsustamise kohti."
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
          <legend>{t("wellbeing.work_processes.situation", "Töövoo üldpilt")}</legend>
          {selectFields.map((field) => (
            <SelectField key={field.key} field={field} value={fields[field.key]} onChange={updateField} />
          ))}
        </fieldset>

        <fieldset>
          <legend>{t("wellbeing.work_processes.categories", "Kategooriad")}</legend>
          <ToggleGroup field={multiFields[0]} values={fields.categories} onToggle={toggleValue} />
        </fieldset>
      </div>

      <section aria-labelledby="work-processes-details-heading">
        <h3 id="work-processes-details-heading">
          {t("wellbeing.work_processes.details", "Ajaröövlid ja lihtsustamise kohad")}
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

      <section aria-labelledby="work-processes-output-heading">
        <h3 id="work-processes-output-heading">
          {t("wellbeing.work_processes.output_heading", "Praktiline väljund")}
        </h3>
        <div>
          <OutputCard title="Tööprotsessi kaart" value={record.outputSummary.processMap} />
          <OutputCard title="Kolm suurimat ajaröövlit" value={record.outputSummary.topTimeThieves} />
          <OutputCard title="Dokumenteerimise lihtsustamise ettepanek" value={record.outputSummary.documentationSimplification} />
          <OutputCard title="Info liikumise kokkuvõte" value={record.outputSummary.informationFlowSummary} />
          <OutputCard title="Töökorralduse arutelu memo" value={record.outputSummary.managerMemo} />
        </div>
        <div>
          <Button type="button" onClick={saveWorkProcesses} disabled={saveState === "saving"}>
            {saveState === "saving"
              ? t("wellbeing.work_processes.saving", "Salvestan...")
              : t("wellbeing.work_processes.save", "Salvesta tööprotsessi audit")}
          </Button>
          <WellbeingActionList actions={record.recommendedActions} actionRoutes={actionRoutes} onNavigate={onNavigate} />
        </div>
        <p role="status">
          {saveState === "saved"
            ? t("wellbeing.work_processes.saved", "Tööprotsessi audit salvestati privaatselt.")
            : saveState === "error"
              ? t("wellbeing.work_processes.save_failed", "Salvestamine ebaõnnestus. Proovi uuesti.")
              : ""}
        </p>
      </section>

      <SupportRequestPanel
        sourceWorkflowType="work-processes"
        sourceRecordId={saveState === "saved" ? savedRecordId : null}
        context={record}
        onNavigate={onNavigate}
      />
    </div>
  );
}
