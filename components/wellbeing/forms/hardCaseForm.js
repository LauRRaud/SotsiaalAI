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
      title: "Juhtum ja roll",
      short: "Juhtum",
      fields: enumFields(selectFields, ["caseType", "professionalRole"])
    },
    {
      /* Ohu küsimus on omaette vaates: ohutusteade ilmub kohe selle alla ja
         peab sinna ära mahtuma. */
      key: "safety",
      title: "Ohutus",
      fields: enumFields(selectFields, ["immediateDanger"])
    },
    {
      key: "load",
      title: "Koormus ja taastumine",
      short: "Koormus",
      fields: enumFields(selectFields, ["mainLoad", "recoveryNeed"])
    },
    {
      key: "tension",
      title: "Pinge ja tugi",
      short: "Pinge",
      fields: [
        ...enumFields(selectFields, ["ethicalTension", "moralDistress", "traumaExposure", "roleClarity"]),
        checkField("shouldNotCarryAlone", ["wellbeing.hard_case.do_not_carry_alone", "Juhtumit ei peaks üksi kandma"]),
        checkField("covisionNeed", ["wellbeing.hard_case.covision_need", "Vajan kovisiooni sisendit"])
      ]
    },
    {
      key: "description",
      title: ["wellbeing.hard_case.generalized_description", "Üldistatud kirjeldus"],
      short: "Kirjeldus",
      lead: flowLead("general_text"),
      fields: [textField("generalizedDescription", ["wellbeing.hard_case.generalized_description", "Üldistatud kirjeldus"])]
    },
    {
      key: "next24h",
      title: ["wellbeing.hard_case.next_24h_needs", "Järgmise 24h vajadused"],
      short: "24 tundi",
      lead: flowLead("mark_all"),
      fields: [listField("next24hNeeds", ["wellbeing.hard_case.next_24h_needs", "Järgmise 24h vajadused"], next24hOptions)]
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
