"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import { buildWorkplaceViolenceRecord } from "@/lib/wellbeing/workplaceViolence";
import SupportRequestPanel from "./SupportRequestPanel";
import WellbeingActionList from "./WellbeingActionList";
import { WellbeingOutputCard as OutputCard, WellbeingSelectField as SelectField } from "./WellbeingControls";

const initialFields = {
  violenceType: "aggression",
  dangerStatus: "ended",
  generalizedDescription: "Tööalane olukord, kus suhtlus muutus ähvardavaks ja vajab neutraalset järelkirjeldust.",
  locationOrChannel: "office",
  documentedStatus: "not_yet",
  workImpact: "moderate",
  safetyImpact: "some",
  nextStepNeed: "manager_followup",
  safetyAgreementNeed: "yes",
  covisionNeed: true,
  recoveryNeed: "partial"
};

const selectFields = [
  {
    key: "violenceType",
    label: "Olukorra liik",
    options: [
      ["insult_or_humiliation", "Solvamine või alandamine"],
      ["aggression", "Agressioon"],
      ["threat", "Ähvardus"],
      ["physical_danger", "Füüsiline oht"],
      ["stalking_or_intimidation", "Jälitamine või hirmutamine"],
      ["repeated_harassment", "Korduv ahistav suhtlus"],
      ["threatening_message", "Ähvardav sõnum või e-kiri"],
      ["lone_work_risk", "Kodukülastuse või üksi töötamise risk"]
    ]
  },
  {
    key: "dangerStatus",
    label: "Kas oht kestab praegu?",
    options: [
      ["ended", "Ei kesta"],
      ["uncertain", "Pole kindel"],
      ["ongoing", "Võib jätkuda"]
    ]
  },
  {
    key: "locationOrChannel",
    label: "Koht või kanal",
    options: [
      ["office", "Kontor või vastuvõtt"],
      ["home_visit", "Kodukülastus"],
      ["phone", "Telefon"],
      ["email_or_message", "E-kiri või sõnum"],
      ["public_space", "Avalik ruum"],
      ["partner_channel", "Koostööpartneri kanal"]
    ]
  },
  {
    key: "documentedStatus",
    label: "Dokumenteerimise seis",
    options: [
      ["yes", "Tööks vajalik info kirjas"],
      ["partial", "Osaliselt kirjas"],
      ["not_yet", "Veel kirja panemata"]
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
    key: "safetyImpact",
    label: "Mõju turvatundele",
    options: [
      ["none", "Ei märgi"],
      ["some", "Mõningane"],
      ["high", "Kõrge"]
    ]
  },
  {
    key: "nextStepNeed",
    label: "Järgmine samm",
    options: [
      ["manager_followup", "Juhiga järelkontakt"],
      ["safety_followup", "Ohutuse järelkontroll"],
      ["document_neutral_facts", "Neutraalsed faktid kirja"],
      ["change_channel", "Suhtluskanali muutmine"],
      ["colleague_presence", "Kolleegi kaasamine"],
      ["work_arrangement_change", "Töökorralduse muutmine"]
    ]
  },
  {
    key: "safetyAgreementNeed",
    label: "Turvalisuse kokkuleppe vajadus",
    options: [
      ["no", "Ei vaja eraldi kokkulepet"],
      ["unclear", "Vajab täpsustamist"],
      ["yes", "Vajab kokkulepet"]
    ]
  },
  {
    key: "recoveryNeed",
    label: "Taastumise vajadus",
    options: [
      ["none", "Ei vaja eraldi plaani"],
      ["partial", "Vajab lühikest plaani"],
      ["high", "Vajab töökorralduslikku tuge"]
    ]
  }
];

const signalCopy = {
  no_immediate_danger: {
    title: "Vahetut ohtu ei ole",
    text: "Olukord vajab neutraalset järelkirjeldust ja kokkulepete hoidmist."
  },
  needs_attention: {
    title: "Vajab tähelepanu",
    text: "Olukord vajab töökorralduslikku järeltegevust, ohutuse täpsustamist või tuge."
  },
  urgent_attention: {
    title: "Kiire tähelepanu vajalik",
    text: "Kui oht võib jätkuda, tuleb esmalt tegutseda ohutuse ja vastutava osapoole juhiste järgi."
  }
};

const actionRoutes = {
  recovery: "/tooheaolu/taastumine",
  covision: "/kovisioon",
  "work-boundaries": "/tooheaolu/toopiirid",
  overview: "/tooheaolu/ulevaade"
};

export default function WorkplaceViolenceWorkflow({ onNavigate }) {
  const { t } = useI18n();
  const [fields, setFields] = useState(initialFields);
  const [saveState, setSaveState] = useState("idle");
  const [savedRecordId, setSavedRecordId] = useState(null);
  const record = useMemo(
    () => buildWorkplaceViolenceRecord({
      period: "current",
      roleGroup: "SOCIAL_WORKER",
      standardizedFields: fields
    }),
    [fields]
  );
  const signal = record.computedSignal.signalLevel;
  const signalText = signalCopy[signal] || signalCopy.needs_attention;

  function updateField(key, value) {
    setFields((current) => ({ ...current, [key]: value }));
    setSaveState("idle");
  }

  async function saveWorkplaceViolence() {
    setSaveState("saving");
    try {
      const response = await fetch("/api/wellbeing/workplace-violence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: "current",
          roleGroup: "SOCIAL_WORKER",
          standardizedFields: fields
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "wellbeing.errors.workplace_violence_save_failed");
      setSavedRecordId(payload.record?.id || null);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div>
      <section aria-labelledby="workplace-violence-heading">
        <div>
          <h2 id="workplace-violence-heading">{t("wellbeing.workplace_violence.title", "Töövägivald")}</h2>
          <p>
            {t(
              "wellbeing.workplace_violence.intro",
              "Töövägivalla töövoog aitab hoida fookust ohutusel, neutraalsel dokumenteerimisel ja töökorralduslikul järeltegevusel."
            )}
          </p>
        </div>
        <div>
          <span>{signalText.title}</span>
          <p>{signalText.text}</p>
        </div>
      </section>

      {record.computedSignal.safetyNoticeRequired ? (
        <section aria-labelledby="workplace-violence-safety-heading">
          <h3 id="workplace-violence-safety-heading">{t("wellbeing.workplace_violence.safety_title", "Ohutustekst")}</h3>
          <p>
            {t(
              "wellbeing.workplace_violence.safety_text",
              "Kui oht kestab praegu või pole kindel, kas see on lõppenud, tegutse esmalt oma töökoha ohutuskorra, vastutava juhi või hädaabi juhiste järgi. See töövoog ei asenda kriisiabi ega tööandja ohutuskohustust."
            )}
          </p>
        </section>
      ) : null}

      <div>
        <fieldset>
          <legend>{t("wellbeing.workplace_violence.situation", "Olukord")}</legend>
          {selectFields.slice(0, 5).map((field) => (
            <SelectField key={field.key} field={field} value={fields[field.key]} onChange={updateField} />
          ))}
        </fieldset>

        <fieldset>
          <legend>{t("wellbeing.workplace_violence.followup", "Järeltegevus")}</legend>
          {selectFields.slice(5).map((field) => (
            <SelectField key={field.key} field={field} value={fields[field.key]} onChange={updateField} />
          ))}
          <Checkbox
            labelPosition="before"
            label={t("wellbeing.workplace_violence.covision_need", "Vajan kovisiooni sisendit")}
            checked={fields.covisionNeed}
            onChange={(checked) => updateField("covisionNeed", checked)}
          />
        </fieldset>
      </div>

      <section aria-labelledby="workplace-violence-description-heading">
        <h3 id="workplace-violence-description-heading">
          {t("wellbeing.workplace_violence.generalized_heading", "Üldistatud kirjeldus")}
        </h3>
        <label>
          <h4>{t("wellbeing.workplace_violence.generalized_description", "Neutraalne kirjeldus ilma tuvastatavate detailideta")}</h4>
          <textarea
            value={fields.generalizedDescription}
            onChange={(event) => updateField("generalizedDescription", event.target.value)}
            rows={5}
          />
        </label>
      </section>

      <section aria-labelledby="workplace-violence-output-heading">
        <h3 id="workplace-violence-output-heading">
          {t("wellbeing.workplace_violence.output_heading", "Praktiline väljund")}
        </h3>
        <div>
          <OutputCard title="Neutraalne juhtumikirjeldus" value={record.outputSummary.neutralIncidentDescription} />
          <OutputCard title="Turvalisuse kokkuleppe sisend" value={record.outputSummary.safetyAgreementInput} />
          <OutputCard title="Juhiga arutelu memo" value={record.outputSummary.managerMemo} />
          <OutputCard title="Kovisiooni sisend" value={record.outputSummary.covisionInput} />
          <OutputCard title="Töökorralduse muutmise soovitus" value={record.outputSummary.workArrangementRecommendation} />
        </div>
        <div>
          <Button type="button" onClick={saveWorkplaceViolence} disabled={saveState === "saving"}>
            {saveState === "saving"
              ? t("wellbeing.workplace_violence.saving", "Salvestan...")
              : t("wellbeing.workplace_violence.save", "Salvesta töövägivalla järeltegevus")}
          </Button>
          <WellbeingActionList actions={record.recommendedActions} actionRoutes={actionRoutes} onNavigate={onNavigate} />
        </div>
        <p role="status">
          {saveState === "saved"
            ? t("wellbeing.workplace_violence.saved", "Töövägivalla järeltegevus salvestati privaatselt.")
            : saveState === "error"
              ? t("wellbeing.workplace_violence.save_failed", "Salvestamine ebaõnnestus. Proovi uuesti.")
              : ""}
        </p>
      </section>

      <SupportRequestPanel
        sourceWorkflowType="workplace-violence"
        sourceRecordId={saveState === "saved" ? savedRecordId : null}
        context={record}
        onNavigate={onNavigate}
      />
    </div>
  );
}
