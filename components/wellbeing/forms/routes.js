/**
 * Kuhu viib soovitatud järgmine samm.
 *
 * Arvutus (`lib/wellbeing/*.js`) nimetab töövoo liigi; tee tuleb tööriistade
 * loendist (`lib/wellbeingTools.js`), et see oleks kirjas ühes kohas.
 */

import { wellbeingTools } from "@/lib/wellbeingTools";

export function wellbeingActionRoute(workflowType) {
  if (workflowType === "covision") return "/kovisioon";
  return wellbeingTools.find((tool) => tool.id === workflowType)?.route || "/tooheaolu";
}
