/**
 * Töövägivalla kirjeldus sammuvormile.
 * Väljad ja väärtused: serveri leping (`lib/wellbeing/fieldSchemas.js`, `workplace-violence`).
 * Arvutus ja valmis tekstid: `lib/wellbeing/workplaceViolence.js`.
 */

import { buildWorkplaceViolenceRecord } from "@/lib/wellbeing/workplaceViolence";

import { selectFields, signalCopy } from "./data/workplaceViolenceData.js";
import { checkField, enumFields, flowLead, formText, output, signals, textField } from "./helpers.js";

export const workplaceViolenceForm = {
  workflowType: "workplace-violence",
  endpoint: "/api/wellbeing/workplace-violence",
  buildRecord: buildWorkplaceViolenceRecord,
  text: formText("workplace_violence"),
  steps: [
    {
      key: "situation",
      title: ["wellbeing.workplace_violence.situation", "Olukord"],
      fields: enumFields(selectFields, ["violenceType"])
    },
    {
      /* Ohu küsimus on omaette vaates: ohutusteade ilmub kohe selle alla ja
         peab sinna ära mahtuma. */
      key: "safety",
      title: "Ohutus",
      fields: enumFields(selectFields, ["dangerStatus"])
    },
    {
      key: "impact",
      title: "Koht ja mõju",
      short: "Mõju",
      fields: enumFields(selectFields, ["locationOrChannel", "workImpact", "safetyImpact"])
    },
    {
      key: "followup",
      title: ["wellbeing.workplace_violence.followup", "Järeltegevus"],
      fields: enumFields(selectFields, ["documentedStatus", "nextStepNeed", "safetyAgreementNeed"])
    },
    {
      key: "support",
      title: "Taastumine ja tugi",
      short: "Taastumine",
      fields: [
        ...enumFields(selectFields, ["recoveryNeed"]),
        checkField("covisionNeed", ["wellbeing.workplace_violence.covision_need", "Vajan kovisiooni sisendit"])
      ]
    },
    {
      key: "description",
      title: ["wellbeing.workplace_violence.generalized_heading", "Üldistatud kirjeldus"],
      short: "Kirjeldus",
      lead: flowLead("general_text"),
      fields: [
        textField(
          "generalizedDescription",
          ["wellbeing.workplace_violence.generalized_description", "Neutraalne kirjeldus ilma tuvastatavate detailideta"],
          undefined,
          5
        )
      ]
    }
  ],
  signals: signals(signalCopy, { no_immediate_danger: "ok", needs_attention: "warn", urgent_attention: "risk" }),
  /* Ohutusteade kohe ohu küsimuse all, mitte alles tulemuse sammul. */
  safetyNotice: {
    fieldKey: "dangerStatus",
    when: (fields) => fields.dangerStatus === "ongoing" || fields.dangerStatus === "uncertain",
    title: ["wellbeing.workplace_violence.safety_title", "Ohutustekst"],
    text: ["wellbeing.workplace_violence.safety_text", ""]
  },
  outputs: [
    output("Neutraalne juhtumikirjeldus", "neutralIncidentDescription"),
    output("Turvalisuse kokkuleppe sisend", "safetyAgreementInput"),
    output("Juhiga arutelu memo", "managerMemo"),
    output("Kovisiooni sisend", "covisionInput"),
    output("Töökorralduse muutmise soovitus", "workArrangementRecommendation")
  ]
};
