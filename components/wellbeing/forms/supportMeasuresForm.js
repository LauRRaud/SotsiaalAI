/**
 * „Minu tugivõimalused" kirjeldus sammuvormile.
 *
 * Meetmed tulevad kataloogist (`lib/wellbeing/supportMeasureCatalog.js`); iga
 * rühm on kaks vaadet (mida tööandja võimaldab, mida vajan), et üks vaade
 * mahuks paneeli. Arvutus ja valmis tekstid: `lib/wellbeing/supportMeasures.js`.
 */

import { SUPPORT_MEASURE_GROUPS } from "@/lib/wellbeing/supportMeasureCatalog";
import { buildSupportMeasuresRecord, SUPPORT_MEASURES_FIELDS } from "@/lib/wellbeing/supportMeasures";

import { formText, listField, output, signals } from "./helpers.js";
import { wellbeingActionRoute } from "./routes.js";

const msg = (key, fallback) => [`wellbeing.support_measures.${key}`, fallback];

const groupTitles = {
  development: ["Tugi ja areng", "Areng"],
  health: ["Tervis ja turvalisus", "Tervis"],
  organisation: ["Töökorraldus ja tunnustus", "Korraldus"]
};

const steps = Object.entries(SUPPORT_MEASURES_FIELDS).flatMap(([group, [offeredKey, neededKey]]) => {
  const [title, short] = groupTitles[group];
  const pairs = SUPPORT_MEASURE_GROUPS[group];
  return [
    {
      key: offeredKey,
      title: msg(`steps.${group}.offered_title`, `${title}: mis on olemas`),
      short: msg(`steps.${group}.offered_short`, `${short}: on`),
      lead: msg("offered_lead", "Mida tööandja sinu teada võimaldab? Kui ei tea, jäta märkimata."),
      fields: [listField(offeredKey, msg("offered_label", "Võimaldab"), pairs)]
    },
    {
      key: neededKey,
      title: msg(`steps.${group}.needed_title`, `${title}: mida vajan`),
      short: msg(`steps.${group}.needed_short`, `${short}: vajan`),
      lead: msg("needed_lead", "Mida neist vajad või vajaksid rohkem?"),
      fields: [listField(neededKey, msg("needed_label", "Vajan"), pairs)]
    }
  ];
});

/* Platvormil endal olevad tugivormid viivad nende lehele. */
const platformRoutes = { supervision: "/supervisioon", mentoring: "/mentorlus" };

export const supportMeasuresForm = {
  workflowType: "support-measures",
  endpoint: "/api/wellbeing/support-measures",
  buildRecord: buildSupportMeasuresRecord,
  text: formText("support_measures"),
  steps,
  actionRoute: (workflowType) => platformRoutes[workflowType] || wellbeingActionRoute(workflowType),
  signals: signals(
    {
      support_available: {
        title: msg("signals.available_title", "Vajatud tugi on olemas"),
        text: msg("signals.available_text", "Kõik, mida märkisid vajavat, on sinu teada olemas. Kasuta seda julgelt.")
      },
      needs_clearer_support_plan: {
        title: msg("signals.gap_title", "Osa vajatud toest puudub"),
        text: msg("signals.gap_text", "Mõnda tuge, mida vajad, sinu teada ei ole. Valmis tekstidest leiad sisendi arenguvestluseks või juhiga arutelu jaoks.")
      },
      insufficient_data: {
        title: msg("signals.none_title", "Vajadusi ei märkinud"),
        text: msg("signals.none_text", "Märgi, mida vajad, et näha, mis on olemas ja mis puudub.")
      }
    },
    { support_available: "ok", needs_clearer_support_plan: "warn", insufficient_data: "none" }
  ),
  outputs: [
    output(msg("outputs.overview", "Minu tugivõimalused"), "overview"),
    output(msg("outputs.discussion", "Arenguvestluse sisend"), "discussionInput")
  ]
};
