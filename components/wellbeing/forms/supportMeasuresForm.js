/**
 * „Minu tugivõimalused" kirjeldus sammuvormile.
 *
 * Meetmed tulevad kataloogist (`lib/wellbeing/supportMeasureCatalog.js`); iga
 * rühm on kaks vaadet (mida tööandja võimaldab, mida vajan), et üks vaade
 * mahuks paneeli. Arvutus ja valmis tekstid: `lib/wellbeing/supportMeasures.js`.
 */

import { LEARNING_AREAS } from "@/lib/wellbeing/learningAreaCatalog";
import { SUPPORT_MEASURE_GROUPS, SUPPORT_MEASURE_LABELS } from "@/lib/wellbeing/supportMeasureCatalog";
import {
  buildSupportMeasuresRecord,
  classifySupportMeasures,
  SUPPORT_MEASURES_FIELDS,
  SUPPORT_MEASURES_LEARNING_FIELD
} from "@/lib/wellbeing/supportMeasures";

import { formText, listField, output, signals } from "./helpers.js";
import { wellbeingActionRoute } from "./routes.js";

const msg = (key, fallback) => [`wellbeing.support_measures.${key}`, fallback];

const groupTitles = {
  development: ["Tugi ja areng", "Areng"],
  health: ["Tervis ja turvalisus", "Tervis"],
  organisation: ["Töökorraldus ja tunnustus", "Korraldus"]
};

/* Meetme ja õpivaldkonna nimi tõlkekataloogist; kataloogi eestikeelne nimi on varutekst. */
const measureText = (value, label) => msg(`measures.${value}`, label);
const learningPairs = LEARNING_AREAS.map(([value, label]) => [value, msg(`learning_areas.${value}`, label)]);

const steps = Object.entries(SUPPORT_MEASURES_FIELDS).flatMap(([group, [offeredKey, neededKey]]) => {
  const [title, short] = groupTitles[group];
  const pairs = SUPPORT_MEASURE_GROUPS[group].map(([value, label]) => [value, measureText(value, label)]);
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

/* „Mida tahaksin õppida" (TÜ küsitluse küsimus 16): kõigile, mitte ainult
   alustajatele. Jääb töötajale; valik suunab platvormi olemasolevatesse kohtadesse. */
steps.push({
  key: SUPPORT_MEASURES_LEARNING_FIELD,
  title: msg("steps.learning.title", "Mida tahaksin õppida"),
  short: msg("steps.learning.short", "Õppimine"),
  lead: msg("learning_lead", "Milles tahaksid end täiendada? Märgi kõik, mis sobib. See on arenguvestluse sisendis ja jääb sulle."),
  fields: [listField(SUPPORT_MEASURES_LEARNING_FIELD, msg("learning_label", "Tahaksin õppida"), learningPairs)]
});

/* Platvormil endal olevad tugivormid ja õppimise kohad viivad nende lehele. */
const platformRoutes = {
  supervision: "/supervisioon",
  mentoring: "/mentorlus",
  luna: "/vestlus",
  method_mirror: "/refleksioon",
  ethics_room: "/eetikaruum",
  materials: "/materjalid"
};

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

/**
 * Vorm koos töötaja asutuse(te) kirjeldusega (`/api/wellbeing/support-measures/organization`):
 * „mis on olemas" on eeltäidetud asutuse märgitud meetmetega ja tulemus näitab
 * vajatud ja pakutud meetme juures asutuse juhist. Töötaja saab eeltäidet muuta:
 * tema kirje ütleb, mis on TEMA teada olemas. Kirjeldusteta asutuse korral on
 * vorm sama mis enne.
 */
export function supportMeasuresFormWithOrganizations(organizations) {
  const list = (Array.isArray(organizations) ? organizations : []).filter((org) => org?.measures?.length);
  const offered = new Map();
  for (const org of list) {
    for (const measure of org.measures) {
      if (!SUPPORT_MEASURE_LABELS[measure?.measureKey]) continue;
      const notes = offered.get(measure.measureKey) || [];
      const details = String(measure.details || "").trim();
      if (details) notes.push(list.length > 1 ? `${org.name}: ${details}` : details);
      offered.set(measure.measureKey, notes);
    }
  }
  if (!offered.size) return supportMeasuresForm;

  const initialFields = Object.fromEntries(
    Object.entries(SUPPORT_MEASURES_FIELDS).map(([group, [offeredKey]]) => [
      offeredKey,
      SUPPORT_MEASURE_GROUPS[group].map(([value]) => value).filter((value) => offered.has(value))
    ])
  );

  return {
    ...supportMeasuresForm,
    initialFields,
    steps: supportMeasuresForm.steps.map((step) =>
      Object.values(SUPPORT_MEASURES_FIELDS).some(([offeredKey]) => offeredKey === step.key)
        ? { ...step, lead: msg("offered_lead_org", "Märgitud on see, mida asutus enda kirjelduse järgi pakub. Muuda, kui sinu teada on teisiti.") }
        : step
    ),
    factors: (record, tx) => {
      const { usedNeeded } = classifySupportMeasures(record.standardizedFields);
      const items = usedNeeded
        .filter((value) => offered.has(value))
        .map((value) => [tx(measureText(value, SUPPORT_MEASURE_LABELS[value])), ...offered.get(value)].join(" — "));
      return items.length ? [{ title: tx(msg("org_offers_title", "Asutus pakub ja sa vajad")), items, empty: "" }] : [];
    }
  };
}
