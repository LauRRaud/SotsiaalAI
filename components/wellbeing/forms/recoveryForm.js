/**
 * Taastumise kirjeldus sammuvormile.
 *
 * 1.1: kõigepealt eemaldumine ja taastumiskogemused (mis puudu jääb, üks
 * kokkulepe iseendaga), siis olukord ja 24–72 h tööplaan neile, kellel on vaja
 * koormust jagada.
 *
 * Väljade võtmed ja väärtused on serveri lepingu osa
 * (`lib/wellbeing/fieldSchemas.js`, töövoog `recovery`). Arvutus ja valmis
 * tekstid: `lib/wellbeing/recovery.js`.
 */

import { buildRecoveryRecord, recoverySleepOrAnxietyFrequent } from "@/lib/wellbeing/recovery";

const options = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const lead = (key, fallback) => [`wellbeing.recovery.steps.${key}`, fallback];
const frequency = (key, label) => ({
  key,
  kind: "enum",
  label,
  options: options([
    ["rarely", "Harva"],
    ["sometimes", "Mõnikord"],
    ["often", "Sageli"],
    ["almost_always", "Peaaegu alati"]
  ])
});

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
      key: "detachment",
      title: ["wellbeing.recovery.detachment_heading", "Eemaldumine"],
      lead: lead("detachment", "Mõtle viimasele kahele nädalale. Kui sageli?"),
      fields: [
        frequency("workThoughtsOffHours", "Mõtlen tööle ka vabal ajal"),
        frequency("endOfDayExhaustion", "Olen tööpäeva lõpuks vaimselt kurnatud"),
        frequency("sleepAffected", "Töö segab mu und"),
        frequency("workAnxiety", "Tööle mõtlemine tekitab ärevust")
      ]
    },
    {
      key: "experiences",
      title: ["wellbeing.recovery.experiences_heading", "Mis sind taastab"],
      short: ["wellbeing.recovery.experiences_short", "Taastumine"],
      lead: lead("experiences", "Märgi, mis sul praegu puudu jääb, ja vali üks kokkulepe iseendaga."),
      fields: [
        {
          key: "missingRecoveryExperiences",
          kind: "enum_list",
          label: "Mis praegu puudu jääb?",
          options: options([
            ["detachment", "Tööst mõtetes eemaldumine"],
            ["relaxation", "Lõõgastus ja puhkus"],
            ["mastery", "Midagi uut ja jõukohast väljaspool tööd"],
            ["control", "Kontroll oma vaba aja üle"]
          ])
        },
        {
          key: "selfAgreement",
          kind: "enum",
          label: "Üks kokkulepe iseendaga",
          options: options([
            ["write_unfinished", "Kirjutan päeva lõpus pooleli asjad üles"],
            ["close_channels", "Panen vabal ajal töökanalid kinni"],
            ["transition", "Teen pärast tööd väikese ülemineku"],
            ["free_evening", "Hoian ühe õhtu nädalas tööst vaba"],
            ["none_now", "Praegu ei vali"]
          ])
        }
      ]
    },
    {
      key: "situation",
      title: ["wellbeing.recovery.situation", "Olukord"],
      lead: lead("situation", "Kus sa praegu oled? Vali igale küsimusele üks vastus."),
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
          key: "supportNeed",
          kind: "enum",
          label: "Vajalik tugi",
          options: options([
            ["none", "Ei vaja eraldi tuge"],
            ["manager", "Juhi kokkulepe"],
            ["colleague", "Kolleegitugi"],
            ["supervisor", "Supervisioon või muu kokkulepitud tugi"]
          ])
        }
      ]
    },
    {
      key: "state",
      title: "Seis ja kontrollpunkt",
      short: "Seis",
      fields: [
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
      lead: lead("tasks", "Kui lähipäevad on liiga täis, jaga töö kolmeks. Üks rida on üks ülesanne; võid ka vahele jätta."),
      /* Kolm loendit kõrvuti: jagamine kolmeks on näha ühe pilguga. */
      columns: 3,
      fields: [
        { key: "unavoidableTasks", kind: "text_list", label: "Vältimatud ülesanded" },
        { key: "deferrableTasks", kind: "text_list", label: "Edasilükatavad ülesanded" },
        { key: "redistributableTasks", kind: "text_list", label: "Ümberjagatavad ülesanded" }
      ]
    }
  ],
  /* Sage unehäire või ärevus: teade kohe küsimuste all ja uuesti tulemuse
     juures. Diagnoosi ega skoori ei ole; vastused jäävad ainult töötajale. */
  safetyNotice: {
    fieldKey: "workAnxiety",
    when: recoverySleepOrAnxietyFrequent,
    title: ["wellbeing.recovery.sleep_notice.title", "Seda tasub tõsiselt võtta"],
    text: [
      "wellbeing.recovery.sleep_notice.text",
      "Sage unehäire või ärevus ei ole diagnoos. Kui see kestab, räägi perearsti, töötervishoiuarsti või psühholoogiga. Kui olukord vajab kiiret abi, helista 112 või pöördu kriisiabi poole."
    ]
  },
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
    { title: "Taastumisplaan", value: (record) => record.outputSummary.recoveryPlan72h },
    { title: "Juhiga arutelu memo", value: (record) => record.outputSummary.managerMemo }
  ],
  links: [{ title: ["wellbeing.recovery.open_boundaries", "Ava tööpiirid"], href: "/tooheaolu/toopiirid" }]
};
