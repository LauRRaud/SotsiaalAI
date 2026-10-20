/**
 * Kiirkontrolli kirjeldus sammuvormile (WellbeingStepForm).
 *
 * Küsimused ja vastusevariandid on failis `../quickCheckFields.js`; võtmed ja
 * väärtused on serveri lepingu osa. Arvutus: `lib/wellbeing/quickCheck.js`.
 */

import { wellbeingFactorEntry } from "@/lib/wellbeing/factorLabels";
import { buildQuickCheckRecord } from "@/lib/wellbeing/quickCheck";

import { QUICK_CHECK_GROUPS, QUICK_CHECK_RISKS, QUICK_CHECK_SAFETY } from "../quickCheckFields.js";

const questions = (group) => group.map((field) => ({ key: field.key, kind: "enum", label: field.label, options: field.options }));
const checks = (list) => list.map((item) => ({ key: item.key, kind: "boolean", label: [item.labelKey, ""], hint: [item.hintKey, ""] }));
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
    /* Kuus nõudmiste küsimust on kaks vaadet (3 + 3) ning ressursid ja tugi samuti
       kaks (4 + 3): üks vaade mahub paneeli ära. */
    { key: "demands", ...step("demands"), fields: questions(QUICK_CHECK_GROUPS.demands.slice(0, 3)) },
    {
      key: "pressure",
      title: ["wellbeing.quick_check.steps.pressure.title", ""],
      short: ["wellbeing.quick_check.steps.pressure.short", ""],
      fields: questions(QUICK_CHECK_GROUPS.demands.slice(3))
    },
    { key: "resources", ...step("resources"), fields: questions(QUICK_CHECK_GROUPS.resources) },
    { key: "support", ...step("support"), fields: questions(QUICK_CHECK_GROUPS.support) },
    { key: "safety", ...step("safety"), fields: checks(QUICK_CHECK_SAFETY) },
    { key: "risks", ...step("risks"), fields: checks(QUICK_CHECK_RISKS) }
  ],
  /* Kolleegi või juhi ebaväärikas kohtlemine: Töövägivalla töövoog eeldab praegu
     kliendist tegijat ja juhimemo võib minna osapoolele. Seepärast ütleb teade
     märke all, kuhu saab pöörduda, ja et märk jääb ainult töötajale. */
  safetyNotice: {
    fieldKey: "colleagueMistreatmentMarker",
    when: (fields) => fields.colleagueMistreatmentMarker === true,
    /* Teade on juba märke all loetud; tulemuse sammul lükkaks ta salvestusnupu
       paneelist välja (1536 × 640: sisu 672 px, paneel 522 px). */
    repeatOnResult: false,
    title: ["wellbeing.quick_check.mistreatment_notice.title", "Sa ei pea sellega üksi jääma"],
    text: [
      "wellbeing.quick_check.mistreatment_notice.text",
      "Kui see puudutab sinu juhti, ei pea esimene samm olema tema: räägi kõrgema juhi, personalitöötaja, töökeskkonnavoliniku või töötervishoiuarstiga. Pane toimunu kuupäevaga kirja. See märk jääb ainult sulle."
    ]
  },
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
      items: record.loadFactors.map((value) => tx(wellbeingFactorEntry(value))),
      empty: tx(["wellbeing.quick_check.no_load_factors", "Kõrgeid koormustegureid ei ilmnenud."])
    },
    {
      title: tx(["wellbeing.quick_check.resource_factors", "Puuduvad ressursid"]),
      items: record.resourceFactors.map((value) => tx(wellbeingFactorEntry(value))),
      empty: tx(["wellbeing.quick_check.no_resource_factors", "Põhiressursid paistavad olemas."])
    },
    {
      title: tx(["wellbeing.quick_check.risk_markers", "Riskimärgid"]),
      items: record.riskMarkers.map((value) => tx(wellbeingFactorEntry(value))),
      empty: tx(["wellbeing.quick_check.no_risk_markers", "Eraldi riskimärki ei märgitud."])
    }
  ]
};
