/**
 * Tööpiiride kirjeldus sammuvormile.
 * Väljad ja väärtused: serveri leping (`lib/wellbeing/fieldSchemas.js`, `work-boundaries`).
 * Arvutus ja valmis tekstid: `lib/wellbeing/workBoundaries.js`.
 */

import { buildWorkBoundariesRecord } from "@/lib/wellbeing/workBoundaries";

import { selectFields, signalCopy } from "./data/workBoundariesData.js";
import { enumFields, flowLead, formText, output, signals, textField } from "./helpers.js";

export const workBoundariesForm = {
  workflowType: "work-boundaries",
  endpoint: "/api/wellbeing/work-boundaries",
  buildRecord: buildWorkBoundariesRecord,
  text: formText("work_boundaries"),
  steps: [
    {
      key: "focus",
      title: "Kokkuleppe fookus",
      short: "Fookus",
      fields: enumFields(selectFields, ["agreementType"])
    },
    {
      key: "situation",
      title: ["wellbeing.work_boundaries.situation", "Olukord"],
      fields: enumFields(selectFields, [
        "boundaryClarity",
        "afterHoursPressure",
        "pauseProtection",
        "replacementCoverage",
        "urgentExceptionClarity"
      ])
    },
    {
      key: "agreement",
      title: ["wellbeing.work_boundaries.agreement", "Kokkuleppe raam"],
      short: "Raam",
      fields: enumFields(selectFields, ["counterpart", "reviewTime", "supportNeed"])
    },
    {
      key: "wording",
      title: ["wellbeing.work_boundaries.text_heading", "Kokkuleppe sõnastus"],
      short: "Sõnastus",
      lead: flowLead("own_words"),
      fields: [
        textField("currentConcern", "Praegune mure", undefined, 2),
        textField("desiredPrinciple", "Soovitud põhimõte", undefined, 2)
      ]
    },
    {
      key: "exceptions",
      title: "Kriisiolukorra erandid",
      short: "Erandid",
      lead: flowLead("own_words"),
      fields: [textField("exceptions", "Kriisiolukorra erandid", undefined, 4)]
    }
  ],
  signals: signals(signalCopy, { clear: "ok", needs_clarification: "warn", needs_agreement: "risk" }),
  outputs: [
    output("Tööpiiride kokkuleppe mustand", "boundaryAgreement"),
    output("Juhiga arutelu memo", "managerMemo"),
    output("Dokumendi koostamise sisend", "documentInput")
  ]
};
