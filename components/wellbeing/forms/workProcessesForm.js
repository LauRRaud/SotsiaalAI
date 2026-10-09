/**
 * Tööprotsesside kirjeldus sammuvormile.
 * Väljad ja väärtused: serveri leping (`lib/wellbeing/fieldSchemas.js`, `work-processes`).
 * Arvutus ja valmis tekstid: `lib/wellbeing/workProcesses.js`.
 */

import { buildWorkProcessesRecord } from "@/lib/wellbeing/workProcesses";

import { multiFields, selectFields, signalCopy } from "./data/workProcessesData.js";
import { enumFields, flowLead, formText, multiField, output, signals } from "./helpers.js";

const multi = (key) => multiField(multiFields.find((field) => field.key === key));

export const workProcessesForm = {
  workflowType: "work-processes",
  endpoint: "/api/wellbeing/work-processes",
  buildRecord: buildWorkProcessesRecord,
  text: formText("work_processes"),
  steps: [
    {
      key: "overview",
      title: ["wellbeing.work_processes.situation", "Töövoo üldpilt"],
      short: "Üldpilt",
      lead: flowLead("choose_one"),
      fields: enumFields(selectFields, ["analysisFocus", "counterpart"])
    },
    {
      key: "load",
      title: "Koormus ja mõju",
      short: "Koormus",
      fields: enumFields(selectFields, ["documentationDuplication", "switchingLoad", "processImpact"])
    },
    {
      key: "categories",
      title: ["wellbeing.work_processes.categories", "Kategooriad"],
      lead: flowLead("mark_all"),
      fields: [multi("categories")]
    },
    {
      key: "time",
      title: "Ajaröövlid",
      lead: flowLead("mark_all"),
      fields: [multi("timeCostSources"), multi("lowValueActivities")]
    },
    {
      key: "blockers",
      title: "Takistused",
      lead: flowLead("mark_all"),
      fields: [multi("informationBlockers"), multi("unfinishedWork")]
    },
    {
      key: "simplify",
      title: "Lihtsustamine",
      lead: flowLead("mark_all"),
      fields: [multi("simplificationNeeds")]
    }
  ],
  signals: signals(signalCopy, { manageable: "ok", needs_simplification: "warn", needs_organizational_change: "risk" }),
  outputs: [
    output("Tööprotsessi kaart", "processMap"),
    output("Kolm suurimat ajaröövlit", "topTimeThieves"),
    output("Dokumenteerimise lihtsustamise ettepanek", "documentationSimplification"),
    output("Info liikumise kokkuvõte", "informationFlowSummary"),
    output("Töökorralduse arutelu memo", "managerMemo")
  ]
};
