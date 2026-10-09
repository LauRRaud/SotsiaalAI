/**
 * Taastumise (24-72h taastumisplaan) kirjeldus sammuvormile.
 *
 * Väljade võtmed ja väärtused on serveri lepingu osa
 * (`lib/wellbeing/fieldSchemas.js`, töövoog `recovery`). Arvutus ja valmis
 * tekstid: `lib/wellbeing/recovery.js`.
 */

import { buildRecoveryRecord } from "@/lib/wellbeing/recovery";

const options = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const lead = (key, fallback) => [`wellbeing.recovery.steps.${key}`, fallback];

export const recoveryForm = {
  workflowType: "recovery",
  endpoint: "/api/wellbeing/recovery",
  buildRecord: buildRecoveryRecord,
  text: {
    title: ["wellbeing.recovery.title", "Taastumine"],
    save: ["wellbeing.recovery.save", "Salvesta taastumisplaan"],
    saving: ["wellbeing.recovery.saving", "Salvestan..."],
    saved: ["wellbeing.recovery.saved", "Taastumisplaan salvestati privaatselt."],
    failed: ["wellbeing.recovery.save_failed", "Salvestamine ebaõnnestus. Proovi uuesti."]
  },
  steps: [
    {
      key: "situation",
      title: ["wellbeing.recovery.situation", "Olukord"],
      lead: lead("situation", "Kus sa praegu oled? Vali igal real üks."),
      fields: [
        {
          key: "recoveryReason",
          kind: "enum",
          label: "Taastumise põhjus",
          options: options([
            ["heavy_week", "Raske nädal"],
            ["difficult_case", "Raske juhtum"],
            ["workplace_violence", "Töövägivalla kogemus"],
            ["long_overload", "Pikaajaline ülekoormus"]
          ])
        },
        {
          key: "recoveryLevel",
          kind: "enum",
          label: "Taastumisvõimalus",
          options: options([
            ["sufficient", "Piisav"],
            ["partial", "Osaline"],
            ["low", "Vähene"],
            ["none", "Puudub"]
          ])
        },
        {
          key: "workCapacityNext72h",
          kind: "enum",
          label: "Töövõime järgmise 24-72h vaates",
          options: options([
            ["stable", "Stabiilne"],
            ["reduced", "Vähenenud"],
            ["low", "Madal"],
            ["not_sustainable", "Ei ole kestlik"]
          ])
        },
        {
          key: "supportNeed",
          kind: "enum",
          label: "Vajalik tugi",
          options: options([
            ["none", "Ei vaja eraldi tuge"],
            ["manager", "Juhi kokkulepe"],
            ["colleague", "Kolleegitugi"],
            ["supervisor", "Supervisioon või muu kokkulepitud tugi"]
          ])
        },
        {
          key: "nextCheckpoint",
          kind: "enum",
          label: "Järgmine kontrollpunkt",
          options: options([
            ["today", "Täna"],
            ["tomorrow", "Homme"],
            ["in_72h", "72 tunni pärast"],
            ["next_week", "Järgmisel nädalal"]
          ])
        }
      ]
    },
    {
      key: "load",
      title: ["wellbeing.recovery.load_factors", "Peamised koormustegurid"],
      short: "Koormus",
      lead: lead("load", "Märgi kõik, mis sind praegu kõige rohkem koormab."),
      fields: [
        {
          key: "primaryLoadFactors",
          kind: "enum_list",
          label: "Vali kõik, mis kehtivad",
          options: options([
            ["documentation", "Dokumenteerimine"],
            ["interruptions", "Katkestused"],
            ["difficult_case", "Raske juhtum"],
            ["workplace_violence", "Töövägivald"],
            ["after_hours", "Tööväline kättesaadavus"],
            ["role_conflict", "Rollikonflikt"]
          ])
        },
        {
          key: "covisionNeed",
          kind: "boolean",
          label: ["wellbeing.recovery.covision_need", "Vajab kovisiooni või kolleegituge"]
        }
      ]
    },
    {
      key: "tasks",
      title: ["wellbeing.recovery.tasks_heading", "24-72h tööplaan"],
      short: "Tööplaan",
      lead: lead("tasks", "Jaga lähipäevade töö kolmeks. Üks rida on üks ülesanne."),
      fields: [
        { key: "unavoidableTasks", kind: "text_list", label: "Vältimatud ülesanded" },
        { key: "deferrableTasks", kind: "text_list", label: "Edasilükatavad ülesanded" },
        { key: "redistributableTasks", kind: "text_list", label: "Ümberjagatavad ülesanded" }
      ]
    }
  ],
  signals: {
    manageable: {
      tone: "ok",
      title: "Juhitav",
      text: "Taastumine vajab hoidmist, aga plaan püsib praegu töökorralduslikult juhitav."
    },
    prioritize: {
      tone: "warn",
      title: "Vajab prioriseerimist",
      text: "Järgmise 24-72 tunni töö tuleb kitsendada vältimatule ja osa tegevusi edasi lükata."
    },
    organizational_support: {
      tone: "risk",
      title: "Vajab töökorralduslikku tuge",
      text: "Taastumisruum või töövõime on madal. Vaja on kokkulepet toe, ümberjagamise või piiride kohta."
    }
  },
  outputs: [
    { title: "24-72h taastumisplaan", value: (record) => record.outputSummary.recoveryPlan72h },
    { title: "Juhiga arutelu memo", value: (record) => record.outputSummary.managerMemo }
  ],
  links: [{ title: ["wellbeing.recovery.open_boundaries", "Ava tööpiirid"], href: "/tooheaolu/toopiirid" }]
};
