/**
 * Alustaja toe kirjeldus sammuvormile.
 * Väljad ja väärtused: serveri leping (`lib/wellbeing/fieldSchemas.js`, `starter-support`).
 * Arvutus ja valmis tekstid: `lib/wellbeing/starterSupport.js`.
 */

import { buildStarterSupportRecord } from "@/lib/wellbeing/starterSupport";

import { multiFields, selectFields, signalCopy } from "./data/starterSupportData.js";
import { checkField, enumFields, flowLead, formText, multiField, output, signals } from "./helpers.js";

const multi = (key) => multiField(multiFields.find((field) => field.key === key));

export const starterSupportForm = {
  workflowType: "starter-support",
  endpoint: "/api/wellbeing/starter-support",
  buildRecord: buildStarterSupportRecord,
  text: formText("starter_support"),
  steps: [
    {
      key: "stage",
      title: ["wellbeing.starter_support.stage", "Etapp ja roll"],
      short: "Etapp",
      lead: flowLead("choose_one"),
      fields: enumFields(selectFields, ["experienceStage", "roleArea"])
    },
    {
      key: "talks",
      title: "Toe kiireloomulisus ja arutelud",
      short: "Arutelud",
      fields: [
        ...enumFields(selectFields, ["supportUrgency"]),
        checkField("mentorDiscussionNeed", ["wellbeing.starter_support.mentor_discussion_need", "Vaja on mentori arutelu"]),
        checkField("managerDiscussionNeed", ["wellbeing.starter_support.manager_discussion_need", "Vaja on juhiga arutelu"]),
        checkField("workBoundaryNeed", [
          "wellbeing.starter_support.work_boundary_need",
          "Vaja on alustaja tööpiiride kokkulepet"
        ])
      ]
    },
    {
      key: "unclear",
      title: ["wellbeing.starter_support.unclear_topics", "Ebaselged teemad"],
      short: "Ebaselge",
      lead: flowLead("mark_all"),
      fields: [multi("unclearTopics")]
    },
    {
      key: "support",
      title: ["wellbeing.starter_support.support_map", "Toe vajaduse kaart"],
      short: "Tugi praegu",
      lead: flowLead("mark_all"),
      fields: [multi("existingSupport"), multi("missingSupport")]
    },
    {
      key: "shared",
      title: "Mida ei tohiks üksi kanda",
      short: "Jagamine",
      lead: flowLead("mark_all"),
      fields: [multi("casesNotCarryAlone"), multi("covisionNeedSigns")]
    }
  ],
  signals: signals(signalCopy, {
    support_available: "ok",
    needs_clearer_support_plan: "warn",
    needs_urgent_support_agreement: "risk"
  }),
  outputs: [
    output("Esimese nädala plaan", "firstWeekPlan"),
    output("Esimese kuu fookused", "firstMonthFocus"),
    output("100 päeva töötoe plaan", "hundredDaySupportPlan"),
    output("Küsimused juhile või mentorile", "managerMentorQuestions"),
    output("Kovisiooni vajaduse kontroll", "covisionNeedCheck"),
    output("Alustaja tööpiiride mustand", "boundaryDraft")
  ]
};
