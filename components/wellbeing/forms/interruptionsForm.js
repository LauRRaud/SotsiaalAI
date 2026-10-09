/**
 * Katkestuste kirjeldus sammuvormile.
 * Väljad ja väärtused: serveri leping (`lib/wellbeing/fieldSchemas.js`, `interruptions`).
 * Arvutus ja valmis tekstid: `lib/wellbeing/interruptions.js`.
 */

import { buildInterruptionsRecord } from "@/lib/wellbeing/interruptions";

import { selectFields, signalCopy, sourceOptions } from "./data/interruptionsData.js";
import { checkField, enumFields, flowLead, formText, listField, output, signals } from "./helpers.js";

export const interruptionsForm = {
  workflowType: "interruptions",
  endpoint: "/api/wellbeing/interruptions",
  buildRecord: buildInterruptionsRecord,
  text: formText("interruptions"),
  steps: [
    {
      key: "class",
      title: "Katkestuse liik",
      short: "Liik",
      fields: enumFields(selectFields, ["interruptionClass"])
    },
    {
      key: "pattern",
      title: ["wellbeing.interruptions.situation", "Katkestuse muster"],
      short: "Muster",
      fields: enumFields(selectFields, ["frequency", "workImpact", "immediateResponseNeed", "canWait"])
    },
    {
      key: "agreement",
      title: ["wellbeing.interruptions.agreement", "Kokkuleppe raam"],
      short: "Raam",
      fields: enumFields(selectFields, ["neededAgreement", "counterpart"])
    },
    {
      key: "effect",
      title: "Kanal ja taastumine",
      short: "Mõju",
      fields: [
        ...enumFields(selectFields, ["wrongChannelShare", "recoveryImpact"]),
        checkField("documentationInterruption", [
          "wellbeing.interruptions.documentation_interruption",
          "Dokumenteerimine või süsteem katkestab töövoogu"
        ])
      ]
    },
    {
      key: "sources",
      title: ["wellbeing.interruptions.sources", "Katkestuste allikad"],
      short: "Allikad",
      lead: flowLead("mark_all"),
      fields: [listField("sources", "Kust katkestused tulevad", sourceOptions)]
    }
  ],
  signals: signals(signalCopy, { manageable: "ok", needs_workflow_clarification: "warn", needs_reorganization: "risk" }),
  outputs: [
    output("Katkestuste kaart", "interruptionMap"),
    output("Fookusaja kokkulepe", "focusTimeAgreement"),
    output("Suhtluskanalite kokkulepe", "channelAgreement"),
    output("Juhiga arutelu memo", "managerMemo")
  ]
};
