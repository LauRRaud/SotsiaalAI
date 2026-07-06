"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { buildHardCaseRecord } from "@/lib/wellbeing/hardCase";
import SupportRequestPanel from "./SupportRequestPanel";
import WellbeingActionList from "./WellbeingActionList";
import { WellbeingOutputCard as OutputCard, WellbeingSelectField as SelectField } from "./WellbeingControls";

const initialFields = {
  caseType: "emotionally_heavy",
  immediateDanger: "no",
  generalizedDescription: "Keeruline kohtumine, mis jättis tööalase pinge ja vajab järeltegevuse korrastamist.",
  professionalRole: "case_worker",
  mainLoad: "emotional_load",
  ethicalTension: "moderate",
  moralDistress: "some",
  traumaExposure: "indirect",
  roleClarity: "partly_clear",
  shouldNotCarryAlone: true,
  next24hNeeds: ["manager_check_in", "document_key_facts"],
  covisionNeed: true,
  recoveryNeed: "partial"
};

const selectFields = [
  {
    key: "caseType",
    label: "Juhtumi tüüp",
    options: [
      ["emotionally_heavy", "Emotsionaalselt raske"],
      ["ethical_dilemma", "Eetiline dilemma"],
      ["complex_case", "Töökorralduslikult keeruline"],
      ["trauma_related", "Traumaga kokkupuude"],
      ["role_conflict", "Rolli või vastutuse konflikt"]
    ]
  },
  {
    key: "immediateDanger",
    label: "Vahetu oht",
    options: [
      ["no", "Vahetut ohtu ei ole"],
      ["uncertain", "Pole kindel"],
      ["yes", "Oht võib jätkuda"]
    ]
  },
  {
    key: "professionalRole",
    label: "Minu tööalane roll",
    options: [
      ["case_worker", "Juhtumikorraldaja"],
      ["child_protection", "Lastekaitse spetsialist"],
      ["social_worker", "Sotsiaaltöötaja"],
      ["advisor", "Nõustaja"],
      ["coordinator", "Koordinaator"]
    ]
  },
  {
    key: "mainLoad",
    label: "Mis jäi koormama",
    options: [
      ["emotional_load", "Emotsionaalne koormus"],
      ["ethical_tension", "Eetiline pinge"],
      ["moral_distress", "Moraalne stress"],
      ["trauma_exposure", "Traumaga kokkupuude"],
      ["role_conflict", "Rollikonflikt"],
      ["workload_followup", "Järeltegevuste töömaht"]
    ]
  },
  {
    key: "ethicalTension",
    label: "Eetiline pinge",
    options: [
      ["none", "Puudub"],
      ["low", "Madal"],
      ["moderate", "Mõõdukas"],
      ["high", "Kõrge"]
    ]
  },
  {
    key: "moralDistress",
    label: "Moraalse stressi tunne",
    options: [
      ["none", "Puudub"],
      ["some", "Mõningane"],
      ["strong", "Tugev"]
    ]
  },
  {
    key: "traumaExposure",
    label: "Traumaga kokkupuude",
    options: [
      ["none", "Ei märgi"],
      ["indirect", "Kaudne"],
      ["direct", "Otsene"]
    ]
  },
  {
    key: "roleClarity",
    label: "Rolli või vastutuse selgus",
    options: [
      ["clear", "Selge"],
      ["partly_clear", "Osaliselt selge"],
      ["unclear", "Ebaselge"]
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

const next24hOptions = [
  ["manager_check_in", "Juhiga lühike järelkontakt"],
  ["document_key_facts", "Tööks vajalikud faktid kirja"],
  ["reduce_next_day_load", "Järgmise päeva koormuse vähendamine"],
  ["colleague_debrief", "Kolleegiga tööalane järelarutelu"],
  ["safety_followup", "Ohutuse järelkontroll"],
  ["covision_input", "Kovisiooni sisendi ettevalmistus"]
];

const signalCopy = {
  no_immediate_danger: {
    title: "Vahetut ohtu ei ole",
    text: "Olukord vajab tööalast korrastamist, kuid kiire ohutegevus ei ole praegu märgitud."
  },
  needs_attention: {
    title: "Vajab tähelepanu",
    text: "Juhtum vajab 24h järelplaani, et koormus, roll ja järgmised sammud ei jääks üksi kanda."
  },
  urgent_attention: {
    title: "Kiire tähelepanu vajalik",
    text: "Vahetu oht või tugev risk vajab esmalt turvalisuse ja vastutava osapoolega seotud tegevust."
  }
};

const actionRoutes = {
  recovery: "/tooheaolu/taastumine",
  covision: "/kovisioon",
  "role-boundaries": "/tooheaolu/rollipiirid",
  overview: "/tooheaolu/ulevaade"
};

export default function HardCaseWorkflow({ onNavigate }) {
  const { t } = useI18n();
  const [fields, setFields] = useState(initialFields);
  const [saveState, setSaveState] = useState("idle");
  const record = useMemo(
    () => buildHardCaseRecord({
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

  function toggleNeed(value) {
    setFields((current) => {
      const selected = new Set(current.next24hNeeds);
      if (selected.has(value)) selected.delete(value);
      else selected.add(value);
      return { ...current, next24hNeeds: [...selected] };
    });
    setSaveState("idle");
  }

  async function saveHardCase() {
    setSaveState("saving");
    try {
      const response = await fetch("/api/wellbeing/hard-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: "current",
          roleGroup: "SOCIAL_WORKER",
          standardizedFields: fields
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "wellbeing.errors.hard_case_save_failed");
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div>
      <section aria-labelledby="hard-case-heading">
        <div>
          <h2 id="hard-case-heading">{t("wellbeing.hard_case.title", "Raske juhtum")}</h2>
          <p>
            {t(
              "wellbeing.hard_case.intro",
              "Raske juhtumi töövoog aitab koostada 24h järelplaani, neutraalse kokkuvõtte ja kovisiooni sisendi ilma kliendiandmeid automaatselt jagamata."
            )}
          </p>
        </div>
        <div>
          <span>{signalText.title}</span>
          <p>{signalText.text}</p>
        </div>
      </section>

      {record.computedSignal.safetyNoticeRequired ? (
        <section aria-labelledby="hard-case-safety-heading">
          <h3 id="hard-case-safety-heading">{t("wellbeing.hard_case.safety_title", "Ohutustekst")}</h3>
          <p>
            {t(
              "wellbeing.hard_case.safety_text",
              "Kui vahetu oht võib jätkuda või keegi võib saada viga, tegutse esmalt oma töökoha ohutuskorra, vastutava juhi või hädaabi juhiste järgi. See töövoog ei asenda kriisiabi ega tööandja ohutuskohustust."
            )}
          </p>
        </section>
      ) : null}

      <div>
        <fieldset>
          <legend>{t("wellbeing.hard_case.situation", "Olukord")}</legend>
          {selectFields.slice(0, 5).map((field) => (
            <SelectField key={field.key} field={field} value={fields[field.key]} onChange={updateField} />
          ))}
        </fieldset>

        <fieldset>
          <legend>{t("wellbeing.hard_case.load_and_support", "Koormus ja tugi")}</legend>
          {selectFields.slice(5).map((field) => (
            <SelectField key={field.key} field={field} value={fields[field.key]} onChange={updateField} />
          ))}
          <label>
            <span>{t("wellbeing.hard_case.do_not_carry_alone", "Juhtumit ei peaks üksi kandma")}</span>
            <input
              type="checkbox"
              checked={fields.shouldNotCarryAlone}
              onChange={(event) => updateField("shouldNotCarryAlone", event.target.checked)}
            />
          </label>
          <label>
            <span>{t("wellbeing.hard_case.covision_need", "Vajan kovisiooni sisendit")}</span>
            <input
              type="checkbox"
              checked={fields.covisionNeed}
              onChange={(event) => updateField("covisionNeed", event.target.checked)}
            />
          </label>
        </fieldset>
      </div>

      <section aria-labelledby="hard-case-generalized-heading">
        <h3 id="hard-case-generalized-heading">
          {t("wellbeing.hard_case.generalized_heading", "Üldistatud kirjeldus ja 24h vajadused")}
        </h3>
        <label>
          <h4>{t("wellbeing.hard_case.generalized_description", "Üldistatud kirjeldus")}</h4>
          <textarea
            value={fields.generalizedDescription}
            onChange={(event) => updateField("generalizedDescription", event.target.value)}
            rows={5}
          />
        </label>
        <fieldset>
          <legend>{t("wellbeing.hard_case.next_24h_needs", "Järgmise 24h vajadused")}</legend>
          {next24hOptions.map(([value, label]) => (
            <label key={value}>
              <input
                type="checkbox"
                checked={fields.next24hNeeds.includes(value)}
                onChange={() => toggleNeed(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
      </section>

      <section aria-labelledby="hard-case-output-heading">
        <h3 id="hard-case-output-heading">
          {t("wellbeing.hard_case.output_heading", "Praktiline väljund")}
        </h3>
        <div>
          <OutputCard title="24h järelplaan" value={record.outputSummary.aftercarePlan24h} />
          <OutputCard title="Neutraalne kokkuvõte" value={record.outputSummary.neutralSummary} />
          <OutputCard title="Juhiga arutelu memo" value={record.outputSummary.managerMemo} />
          <OutputCard title="Kovisiooni sisend" value={record.outputSummary.covisionInput} />
        </div>
        <div>
          <Button type="button" onClick={saveHardCase} disabled={saveState === "saving"}>
            {saveState === "saving"
              ? t("wellbeing.hard_case.saving", "Salvestan...")
              : t("wellbeing.hard_case.save", "Salvesta 24h järelplaan")}
          </Button>
          <WellbeingActionList actions={record.recommendedActions} actionRoutes={actionRoutes} onNavigate={onNavigate} />
        </div>
        <p role="status">
          {saveState === "saved"
            ? t("wellbeing.hard_case.saved", "Raske juhtumi järelplaan salvestati privaatselt.")
            : saveState === "error"
              ? t("wellbeing.hard_case.save_failed", "Salvestamine ebaõnnestus. Proovi uuesti.")
              : ""}
        </p>
      </section>

      <SupportRequestPanel
        sourceWorkflowType="hard-case"
        context={record}
        onNavigate={onNavigate}
      />
    </div>
  );
}
