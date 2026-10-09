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
      key: "situation",
      title: ["wellbeing.work_boundaries.situation", "Olukord"],
      lead: ["wellbeing.work_boundaries.intro", ""],
      fields: enumFields(selectFields, ["agreementType", "boundaryClarity", "afterHoursPressure", "pauseProtection", "replacementCoverage"])
    },
    {
      key: "agreement",
      title: ["wellbeing.work_boundaries.agreement", "Kokkuleppe raam"],
      short: "Raam",
      lead: flowLead("choose_one"),
      fields: enumFields(selectFields, ["urgentExceptionClarity", "counterpart", "reviewTime", "supportNeed"])
    },
    {
      key: "wording",
      title: ["wellbeing.work_boundaries.text_heading", "Kokkuleppe sõnastus"],
      short: "Sõnastus",
      lead: flowLead("own_words"),
      fields: [
        textField("currentConcern", "Praegune mure", undefined, 2),
        textField("desiredPrinciple", "Soovitud põhimõte", undefined, 2),
        textField("exceptions", "Kriisiolukorra erandid", undefined, 2)
      ]
    }
  ],
  signals: signals(signalCopy, { clear: "ok", needs_clarification: "warn", needs_agreement: "risk" }),
  outputs: [
    output("Tööpiiride kokkuleppe mustand", "boundaryAgreement"),
    output("Juhiga arutelu memo", "managerMemo"),
    output("Dokumendi koostamise sisend", "documentInput")
  ]
};
