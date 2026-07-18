"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { buildWorkBoundariesRecord } from "@/lib/wellbeing/workBoundaries";
import SupportRequestPanel from "./SupportRequestPanel";
import WellbeingActionList from "./WellbeingActionList";
import { WellbeingOutputCard as OutputCard, WellbeingSelectField as SelectField } from "./WellbeingControls";

const initialFields = {
  agreementType: "after_hours_availability",
  currentConcern: "Töövälised sõnumid katkestavad taastumist ja tekitavad ebaselgust.",
  boundaryClarity: "partly_clear",
  afterHoursPressure: "moderate",
  pauseProtection: "partial",
  replacementCoverage: "unclear",
  urgentExceptionClarity: "partly_clear",
  counterpart: "manager",
  desiredPrinciple: "Tööväline kontakt toimub ainult vahetu ohu või eelnevalt kokku lepitud erandi korral.",
  exceptions: "Kriisiolukorra erandid: vahetu oht inimese elule, tervisele või turvalisusele.",
  reviewTime: "two_weeks",
  supportNeed: "manager"
};

const selectFields = [
  {
    key: "agreementType",
    label: "Kokkuleppe fookus",
    options: [
      ["after_hours_availability", "Töövälise kättesaadavuse piir"],
      ["work_time_boundary", "Tööaja piir"],
      ["evening_messages", "Õhtuste sõnumite kokkulepe"],
      ["pause_agreement", "Pauside kaitsmine"],
      ["replacement_agreement", "Asenduse kokkulepe"],
      ["crisis_exception", "Kriisiolukorra erandid"],
      ["focus_time", "Keskendumisaja kaitsmine"],
      ["urgent_requests", "Kiirete päringute piir"]
    ]
  },
  {
    key: "boundaryClarity",
    label: "Piiri selgus",
    options: [
      ["clear", "Selge"],
      ["partly_clear", "Osaliselt selge"],
      ["unclear", "Ebaselge"]
    ]
  },
  {
    key: "afterHoursPressure",
    label: "Töövälise kättesaadavuse surve",
    options: [
      ["none", "Puudub"],
      ["low", "Madal"],
      ["moderate", "Mõõdukas"],
      ["high", "Kõrge"]
    ]
  },
  {
    key: "pauseProtection",
    label: "Pauside kaitstus",
    options: [
      ["protected", "Kaitstud"],
      ["partial", "Osaline"],
      ["unclear", "Ebaselge"],
      ["none", "Puudub"]
    ]
  },
  {
    key: "replacementCoverage",
    label: "Asenduse või info liikumise selgus",
    options: [
      ["clear", "Selge"],
      ["partial", "Osaline"],
      ["unclear", "Ebaselge"],
      ["missing", "Puudub"]
    ]
  },
  {
    key: "urgentExceptionClarity",
    label: "Kiireloomuliste erandite selgus",
    options: [
      ["clear", "Selge"],
      ["partly_clear", "Osaliselt selge"],
      ["unclear", "Ebaselge"]
    ]
  },
  {
    key: "counterpart",
    label: "Kokkuleppe osapool",
    options: [
      ["manager", "Juht"],
      ["colleague", "Kolleeg"],
      ["team", "Tiim"],
      ["partner", "Koostööpartner"]
    ]
  },
  {
    key: "reviewTime",
    label: "Ülevaatamise aeg",
    options: [
      ["one_week", "Ühe nädala pärast"],
      ["two_weeks", "Kahe nädala pärast"],
      ["one_month", "Kuu aja pärast"],
      ["next_meeting", "Järgmisel kohtumisel"]
    ]
  },
  {
    key: "supportNeed",
    label: "Vajalik tugi",
    options: [
      ["none", "Ei vaja eraldi tuge"],
      ["manager", "Juhi kokkulepe"],
      ["colleague", "Kolleegitugi"],
      ["team", "Tiimi kokkulepe"]
    ]
  }
];

const signalCopy = {
  clear: {
    title: "Piir on pigem selge",
    text: "Kokkulepe vajab hoidmist ja ülevaatamist, aga töökorralduslik risk on praegu madal."
  },
  needs_clarification: {
    title: "Vajab täpsustamist",
    text: "Mõni piir, erand või asendus vajab selgemat sõnastust, et katkestused ei jääks korduma."
  },
  needs_agreement: {
    title: "Vajab kokkulepet",
    text: "Tööväline surve või ebaselged erandid vajavad juhiga või tiimiga konkreetset töökorralduslikku kokkulepet."
  }
};

const actionRoutes = {
  recovery: "/tooheaolu/taastumine",
  overview: "/tooheaolu/ulevaade",
  "work-processes": "/tooheaolu/tooprotsessid"
};

export default function WorkBoundariesWorkflow({ onNavigate }) {
  const { t } = useI18n();
  const [fields, setFields] = useState(initialFields);
  const [saveState, setSaveState] = useState("idle");
  const [savedRecordId, setSavedRecordId] = useState(null);
  const record = useMemo(
    () => buildWorkBoundariesRecord({
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

  async function saveWorkBoundaries() {
    setSaveState("saving");
    try {
      const response = await fetch("/api/wellbeing/work-boundaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: "current",
          roleGroup: "SOCIAL_WORKER",
          standardizedFields: fields
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "wellbeing.errors.work_boundaries_save_failed");
      setSavedRecordId(payload.record?.id || null);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div>
      <section aria-labelledby="work-boundaries-heading">
        <div>
          <h2 id="work-boundaries-heading">{t("wellbeing.work_boundaries.title", "Tööpiirid")}</h2>
          <p>
            {t(
              "wellbeing.work_boundaries.intro",
              "Tööpiiride töövoog aitab sõnastada töövälise kättesaadavuse, pauside, asenduse ja kriisiolukorra erandid kokkuleppeks."
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
          <legend>{t("wellbeing.work_boundaries.situation", "Olukord")}</legend>
          {selectFields.slice(0, 5).map((field) => (
            <SelectField key={field.key} field={field} value={fields[field.key]} onChange={updateField} />
          ))}
        </fieldset>

        <fieldset>
          <legend>{t("wellbeing.work_boundaries.agreement", "Kokkuleppe raam")}</legend>
          {selectFields.slice(5).map((field) => (
            <SelectField key={field.key} field={field} value={fields[field.key]} onChange={updateField} />
          ))}
        </fieldset>
      </div>

      <section aria-labelledby="work-boundaries-text-heading">
        <h3 id="work-boundaries-text-heading">
          {t("wellbeing.work_boundaries.text_heading", "Kokkuleppe sõnastus")}
        </h3>
        <div>
          <TextCard
            title="Praegune mure"
            value={fields.currentConcern}
            onChange={(value) => updateField("currentConcern", value)}
          />
          <TextCard
            title="Soovitud põhimõte"
            value={fields.desiredPrinciple}
            onChange={(value) => updateField("desiredPrinciple", value)}
          />
          <TextCard
            title="Kriisiolukorra erandid"
            value={fields.exceptions}
            onChange={(value) => updateField("exceptions", value)}
          />
        </div>
      </section>

      <section aria-labelledby="work-boundaries-output-heading">
        <h3 id="work-boundaries-output-heading">
          {t("wellbeing.work_boundaries.output_heading", "Praktiline väljund")}
        </h3>
        <div>
          <OutputCard title="Tööpiiride kokkuleppe mustand" value={record.outputSummary.boundaryAgreement} />
          <OutputCard title="Juhiga arutelu memo" value={record.outputSummary.managerMemo} />
          <OutputCard title="Dokumendi koostamise sisend" value={record.outputSummary.documentInput} />
        </div>
        <div>
          <Button type="button" onClick={saveWorkBoundaries} disabled={saveState === "saving"}>
            {saveState === "saving"
              ? t("wellbeing.work_boundaries.saving", "Salvestan...")
              : t("wellbeing.work_boundaries.save", "Salvesta tööpiiride kokkulepe")}
          </Button>
          <WellbeingActionList actions={record.recommendedActions} actionRoutes={actionRoutes} onNavigate={onNavigate} />
        </div>
        <p role="status">
          {saveState === "saved"
            ? t("wellbeing.work_boundaries.saved", "Tööpiiride kokkulepe salvestati privaatselt.")
            : saveState === "error"
              ? t("wellbeing.work_boundaries.save_failed", "Salvestamine ebaõnnestus. Proovi uuesti.")
              : ""}
        </p>
      </section>

      <SupportRequestPanel
        sourceWorkflowType="work-boundaries"
        sourceRecordId={saveState === "saved" ? savedRecordId : null}
        context={record}
        onNavigate={onNavigate}
      />
    </div>
  );
}

function TextCard({ title, value, onChange }) {
  return (
    <label>
      <h4>{title}</h4>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={5} />
    </label>
  );
}
