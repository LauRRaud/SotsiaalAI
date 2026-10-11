/**
 * WorkplaceViolence: küsimused, vastusevariandid ja signaalitekstid.
 *
 * Tõstetud sõna-sõnalt vanast töövormist (`WorkplaceViolenceWorkflow.jsx`), et
 * sildid ja väärtused ei muutuks. Väärtused on serveri lepingu osa
 * (`lib/wellbeing/fieldSchemas.js`). `initialFields` on vana vormi näidis-
 * täide; sammuvorm seda ei kasuta (küsimused on alguses vastamata).
 */

export const initialFields = {
  violenceType: "aggression",
  dangerStatus: "ended",
  generalizedDescription: "Tööalane olukord, kus suhtlus muutus ähvardavaks ja vajab neutraalset järelkirjeldust.",
  locationOrChannel: "office",
  documentedStatus: "not_yet",
  workImpact: "moderate",
  safetyImpact: "some",
  nextStepNeed: "manager_followup",
  safetyAgreementNeed: "yes",
  covisionNeed: true,
  recoveryNeed: "partial"
};

export const selectFields = [
  {
    key: "violenceType",
    label: "Olukorra liik",
    options: [
      ["insult_or_humiliation", "Solvamine või alandamine"],
      ["aggression", "Agressioon"],
      ["threat", "Ähvardus"],
      ["physical_danger", "Füüsiline oht"],
      ["stalking_or_intimidation", "Jälitamine või hirmutamine"],
      ["repeated_harassment", "Korduv ahistav suhtlus"],
      ["threatening_message", "Ähvardav sõnum või e-kiri"],
      ["lone_work_risk", "Kodukülastuse või üksi töötamise risk"]
    ]
  },
  {
    key: "dangerStatus",
    label: "Kas oht kestab praegu?",
    options: [
      ["ended", "Ei kesta"],
      ["uncertain", "Pole kindel"],
      ["ongoing", "Võib jätkuda"]
    ]
  },
  {
    key: "locationOrChannel",
    label: "Koht või kanal",
    options: [
      ["office", "Kontor või vastuvõtt"],
      ["home_visit", "Kodukülastus"],
      ["phone", "Telefon"],
      ["email_or_message", "E-kiri või sõnum"],
      ["public_space", "Avalik ruum"],
      ["partner_channel", "Koostööpartneri kanal"]
    ]
  },
  {
    key: "documentedStatus",
    label: "Dokumenteerimise seis",
    options: [
      ["yes", "Tööks vajalik info kirjas"],
      ["partial", "Osaliselt kirjas"],
      ["not_yet", "Veel kirja panemata"]
    ]
  },
  {
    key: "workImpact",
    label: "Mõju tööle",
    options: [
      ["low", "Madal"],
      ["moderate", "Mõõdukas"],
      ["high", "Kõrge"]
    ]
  },
  {
    key: "safetyImpact",
    label: "Mõju turvatundele",
    options: [
      ["none", "Ei märgi"],
      ["some", "Mõningane"],
      ["high", "Kõrge"]
    ]
  },
  {
    key: "nextStepNeed",
    label: "Järgmine samm",
    options: [
      ["manager_followup", "Juhiga järelkontakt"],
      ["safety_followup", "Ohutuse järelkontroll"],
      ["document_neutral_facts", "Neutraalsed faktid kirja"],
      ["change_channel", "Suhtluskanali muutmine"],
      ["colleague_presence", "Kolleegi kaasamine"],
      ["work_arrangement_change", "Töökorralduse muutmine"]
    ]
  },
  {
    key: "safetyAgreementNeed",
    label: "Turvalisuse kokkuleppe vajadus",
    options: [
      ["no", "Ei vaja eraldi kokkulepet"],
      ["unclear", "Vajab täpsustamist"],
      ["yes", "Vajab kokkulepet"]
    ]
  },
  {
    key: "recoveryNeed",
    label: "Taastumise vajadus",
    options: [
      ["none", "Ei vaja eraldi plaani"],
      ["partial", "Vajab lühikest plaani"],
      ["high", "Vajab töökorralduslikku tuge"]
    ]
  }
];

export const signalCopy = {
  no_immediate_danger: {
    title: "Vahetut ohtu ei ole",
    text: "Olukord vajab neutraalset järelkirjeldust ja kokkulepete hoidmist."
  },
  needs_attention: {
    title: "Vajab tähelepanu",
    text: "Olukord vajab töökorralduslikku järeltegevust, ohutuse täpsustamist või tuge."
  },
  urgent_attention: {
    title: "Kiire tähelepanu vajalik",
    text: "Kui oht võib jätkuda, tuleb esmalt tegutseda ohutuse ja vastutava osapoole juhiste järgi."
  }
};

export const actionRoutes = {
  recovery: "/tooheaolu/taastumine",
  covision: "/kovisioon",
  "work-boundaries": "/tooheaolu/toopiirid",
  overview: "/tooheaolu/ulevaade"
};
