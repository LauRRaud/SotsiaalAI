/**
 * Nädala peegelduse kirjeldus sammuvormile.
 *
 * Kolm lühikese skaalaga küsimust (tabel) ja üks vaba rida. Arvutus ja valmis
 * tekst: `lib/wellbeing/weeklyReflection.js`.
 */

import { buildWeeklyReflectionRecord } from "@/lib/wellbeing/weeklyReflection";

import { formText, options, output, signals, textField } from "./helpers.js";

const msg = (key, fallback) => [`wellbeing.weekly_reflection.${key}`, fallback];

export const weeklyReflectionForm = {
  workflowType: "weekly-reflection",
  endpoint: "/api/wellbeing/weekly-reflection",
  buildRecord: buildWeeklyReflectionRecord,
  text: formText("weekly_reflection"),
  steps: [
    {
      key: "week",
      title: msg("steps.week.title", "Minu nädal"),
      short: msg("steps.week.short", "Nädal"),
      lead: msg("steps.week.lead", "Mõtle möödunud nädalale. Vali igal real üks."),
      fields: [
        { key: "weeklyLoad", kind: "enum", label: "Töökoormus", options: options([["low", "Madal"], ["moderate", "Mõõdukas"], ["high", "Kõrge"], ["critical", "Kriitiline"]]) },
        { key: "weeklyRecovery", kind: "enum", label: "Jõudsin taastuda", options: options([["sufficient", "Piisavalt"], ["partial", "Osaliselt"], ["low", "Vähe"], ["none", "Üldse mitte"]]) },
        { key: "weeklyMeaning", kind: "enum", label: "Tööl oli mõte", options: options([["yes", "Jah"], ["partly", "Osaliselt"], ["no", "Praegu mitte"]]) }
      ]
    },
    {
      key: "meaning",
      title: msg("steps.meaning.title", "Mis andis tööle mõtte"),
      short: msg("steps.meaning.short", "Mõte"),
      lead: msg("steps.meaning.lead", "Üks rida on piisav. Võid ka vahele jätta; see jääb ainult sulle."),
      fields: [textField("meaningNote", msg("meaning_note", "Mis andis sel nädalal tööle mõtte?"), undefined, 3)]
    }
  ],
  signals: signals(
    {
      green: { title: msg("signals.green_title", "Nädal oli kandev"), text: msg("signals.green_text", "Koormus ja taastumine olid tasakaalus. Hoia seda, mis toimis.") },
      yellow: { title: msg("signals.yellow_title", "Nädal oli pingeline"), text: msg("signals.yellow_text", "Koormus või taastumine vajab tähelepanu. Vali järgmiseks nädalaks üks väike muutus.") },
      red: { title: msg("signals.red_title", "Nädal oli väga raske"), text: msg("signals.red_text", "Koormus oli kõrge ja taastumist vähe. Tasub teha põhjalikum kiirkontroll või rääkida juhiga.") }
    },
    { green: "ok", yellow: "warn", red: "risk" }
  ),
  outputs: [output(msg("outputs.summary", "Minu nädal"), "weekSummary")]
};
