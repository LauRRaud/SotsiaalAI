/**
 * Kiirkontrolli kirjeldus sammuvormile (WellbeingStepForm).
 *
 * Küsimused ja vastusevariandid on failis `../quickCheckFields.js`; võtmed ja
 * väärtused on serveri lepingu osa. Arvutus: `lib/wellbeing/quickCheck.js`.
 */

import { buildQuickCheckRecord, formatQuickCheckFactor } from "@/lib/wellbeing/quickCheck";

import { QUICK_CHECK_GROUPS, QUICK_CHECK_RISKS } from "../quickCheckFields.js";

const questions = (group) => group.map((field) => ({ key: field.key, kind: "enum", label: field.label, options: field.options }));
const step = (key) => ({
  title: [`wellbeing.quick_check.steps.${key}.title`, ""],
  short: [`wellbeing.quick_check.steps.${key}.short`, ""],
  lead: [`wellbeing.quick_check.steps.${key}.lead`, ""]
});

export const quickCheckForm = {
  workflowType: "quick-check",
  endpoint: "/api/wellbeing/quick-check",
  buildRecord: buildQuickCheckRecord,
  text: {
    title: ["wellbeing.quick_check.title", "Kiirkontroll"],
    save: ["wellbeing.quick_check.save", "Salvesta kiirkontroll"],
    saving: ["wellbeing.quick_check.saving", "Salvestan..."],
    saved: ["wellbeing.quick_check.saved", "Kiirkontroll salvestati privaatselt."],
    failed: ["wellbeing.quick_check.save_failed", "Salvestamine ebaõnnestus. Proovi uuesti."],
    noActions: ["wellbeing.quick_check.no_actions", "Jätka praeguste kokkulepete hoidmist ja tee uus kiirkontroll hiljem."]
  },
  steps: [
    { key: "demands", ...step("demands"), fields: questions(QUICK_CHECK_GROUPS.demands) },
    { key: "resources", ...step("resources"), fields: questions(QUICK_CHECK_GROUPS.resources) },
    {
      key: "risks",
      ...step("risks"),
      fields: QUICK_CHECK_RISKS.map((risk) => ({
        key: risk.key,
        kind: "boolean",
        label: [risk.labelKey, ""],
        hint: [risk.hintKey, ""]
      }))
    }
  ],
  signals: {
    green: {
      tone: "ok",
      title: "Roheline",
      text: "Töökoormus paistab praegu juhitav. Hoia tähelepanu taastumisel ja kokkulepetel."
    },
    yellow: {
      tone: "warn",
      title: "Kollane",
      text: "Mitmes töötegur vajab tähelepanu. Vali üks konkreetne järgmine samm."
    },
    red: {
      tone: "risk",
      title: "Punane",
      text: "Koormus vajab töökorralduslikku arutelu või kiiremat toe kokkulepet."
    }
  },
  factors: (record, tx) => [
    {
      title: tx(["wellbeing.quick_check.load_factors", "Koormustegurid"]),
      items: record.loadFactors.map(formatQuickCheckFactor),
      empty: tx(["wellbeing.quick_check.no_load_factors", "Kõrgeid koormustegureid ei ilmnenud."])
    },
    {
      title: tx(["wellbeing.quick_check.resource_factors", "Puuduvad ressursid"]),
      items: record.resourceFactors.map(formatQuickCheckFactor),
      empty: tx(["wellbeing.quick_check.no_resource_factors", "Põhiressursid paistavad olemas."])
    },
    {
      title: tx(["wellbeing.quick_check.risk_markers", "Riskimärgid"]),
      items: record.riskMarkers.map(formatQuickCheckFactor),
      empty: tx(["wellbeing.quick_check.no_risk_markers", "Eraldi riskimärki ei märgitud."])
    }
  ]
};
