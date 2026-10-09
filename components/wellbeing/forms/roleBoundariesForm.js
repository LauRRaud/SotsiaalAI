/**
 * Rollipiiride kirjeldus sammuvormile.
 * Väljad ja väärtused: serveri leping (`lib/wellbeing/fieldSchemas.js`, `role-boundaries`).
 * Arvutus ja valmis tekstid: `lib/wellbeing/roleBoundaries.js`.
 */

import { buildRoleBoundariesRecord } from "@/lib/wellbeing/roleBoundaries";

import { selectFields, signalCopy } from "./data/roleBoundariesData.js";
import { checkField, enumFields, formText, output, signals } from "./helpers.js";

export const roleBoundariesForm = {
  workflowType: "role-boundaries",
  endpoint: "/api/wellbeing/role-boundaries",
  buildRecord: buildRoleBoundariesRecord,
  text: formText("role_boundaries"),
  steps: [
    {
      key: "expectation",
      title: ["wellbeing.role_boundaries.expectation", "Ootus ja roll"],
      short: "Ootus",
      fields: enumFields(selectFields, ["expectationSource", "expectedAction"])
    },
    {
      key: "role",
      title: "Minu roll ja selle piir",
      short: "Roll",
      fields: enumFields(selectFields, ["myRole", "outsideRole"])
    },
    {
      key: "parties",
      title: "Panus ja osapool",
      short: "Osapooled",
      fields: enumFields(selectFields, ["neededResponsibility", "counterpart"])
    },
    {
      key: "clarification",
      title: ["wellbeing.role_boundaries.clarification", "Selgituse vajadus"],
      short: "Selgitus",
      fields: [
        ...enumFields(selectFields, ["roleConflict", "availabilityPressure", "ethicalComplexity"]),
        checkField("partnerExplanationNeed", [
          "wellbeing.role_boundaries.partner_explanation_need",
          "Vaja on partnerile rolliselgitust"
        ]),
        checkField("managerDiscussionNeed", ["wellbeing.role_boundaries.manager_discussion_need", "Vaja on juhiga arutelu"])
      ]
    }
  ],
  signals: signals(signalCopy, { clear: "ok", needs_clarification: "warn", needs_network_discussion: "risk" }),
  outputs: [
    output("Rollipiiride analüüs", "roleBoundaryAnalysis"),
    output("Kliendile selgitus", "clientExplanation"),
    output("Partnerile rolliselgitus", "partnerClarification"),
    output("Mida saan / mida ei saa teha", "canCannotDoText"),
    output("Juhiga memo", "managerMemo")
  ]
};
