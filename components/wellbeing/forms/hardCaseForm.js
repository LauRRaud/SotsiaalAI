/**
 * Raske juhtumi kirjeldus sammuvormile.
 * Väljad ja väärtused: serveri leping (`lib/wellbeing/fieldSchemas.js`, `hard-case`).
 * Arvutus ja valmis tekstid: `lib/wellbeing/hardCase.js`.
 */

import { buildHardCaseRecord } from "@/lib/wellbeing/hardCase";

import { next24hOptions, selectFields, signalCopy } from "./data/hardCaseData.js";
import { checkField, enumFields, flowLead, formText, listField, output, signals, textField } from "./helpers.js";

export const hardCaseForm = {
  workflowType: "hard-case",
  endpoint: "/api/wellbeing/hard-case",
  buildRecord: buildHardCaseRecord,
  text: formText("hard_case"),
  steps: [
    {
      key: "situation",
      title: ["wellbeing.hard_case.situation", "Olukord"],
      lead: ["wellbeing.hard_case.intro", ""],
      fields: enumFields(selectFields, ["caseType", "immediateDanger"])
    },
    {
      key: "role",
      title: "Roll ja koormus",
      short: "Roll",
      lead: flowLead("choose_one"),
      fields: enumFields(selectFields, ["professionalRole", "mainLoad", "ethicalTension"])
    },
    {
      key: "load",
      title: ["wellbeing.hard_case.load_and_support", "Koormus ja tugi"],
      short: "Koormus",
      lead: flowLead("choose_one"),
      fields: [
        ...enumFields(selectFields, ["moralDistress", "traumaExposure", "roleClarity", "recoveryNeed"]),
        checkField("shouldNotCarryAlone", ["wellbeing.hard_case.do_not_carry_alone", "Juhtumit ei peaks üksi kandma"]),
        checkField("covisionNeed", ["wellbeing.hard_case.covision_need", "Vajan kovisiooni sisendit"])
      ]
    },
    {
      key: "description",
      title: ["wellbeing.hard_case.generalized_heading", "Üldistatud kirjeldus ja 24h vajadused"],
      short: "Kirjeldus",
      lead: flowLead("general_text"),
      fields: [
        textField("generalizedDescription", ["wellbeing.hard_case.generalized_description", "Üldistatud kirjeldus"]),
        listField("next24hNeeds", ["wellbeing.hard_case.next_24h_needs", "Järgmise 24h vajadused"], next24hOptions)
      ]
    }
  ],
  signals: signals(signalCopy, { no_immediate_danger: "ok", needs_attention: "warn", urgent_attention: "risk" }),
  /* Ohutusteade kohe ohu küsimuse all, mitte alles tulemuse sammul. */
  safetyNotice: {
    fieldKey: "immediateDanger",
    when: (fields) => fields.immediateDanger === "yes" || fields.immediateDanger === "uncertain",
    title: ["wellbeing.hard_case.safety_title", "Ohutustekst"],
    text: ["wellbeing.hard_case.safety_text", ""]
  },
  outputs: [
    output("24h järelplaan", "aftercarePlan24h"),
    output("Neutraalne kokkuvõte", "neutralSummary"),
    output("Juhiga arutelu memo", "managerMemo"),
    output("Kovisiooni sisend", "covisionInput")
  ]
};
