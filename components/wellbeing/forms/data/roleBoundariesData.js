/**
 * RoleBoundaries: küsimused, vastusevariandid ja signaalitekstid.
 *
 * Tõstetud sõna-sõnalt vanast töövormist (`RoleBoundariesWorkflow.jsx`), et
 * sildid ja väärtused ei muutuks. Väärtused on serveri lepingu osa
 * (`lib/wellbeing/fieldSchemas.js`). `initialFields` on vana vormi näidis-
 * täide; sammuvorm seda ei kasuta (küsimused on alguses vastamata).
 */

export const initialFields = {
  expectationSource: "client_family",
  expectedAction: "solve_partner_delay",
  myRole: "case_worker",
  outsideRole: "make_other_agency_decision",
  neededResponsibility: "partner_agency",
  roleConflict: "high",
  partnerExplanationNeed: true,
  managerDiscussionNeed: true,
  availabilityPressure: "high",
  ethicalComplexity: "moderate",
  counterpart: "partner"
};

export const selectFields = [
  {
    key: "expectationSource",
    label: "Kes esitab ootuse?",
    options: [
      ["client", "Klient"],
      ["client_family", "Kliendi lähedane"],
      ["manager", "Juht"],
      ["colleague", "Kolleeg"],
      ["partner", "Koostööpartner"],
      ["network", "Võrgustik"]
    ]
  },
  {
    key: "expectedAction",
    label: "Mida oodatakse?",
    options: [
      ["explain_service", "Teenuse või otsuse selgitus"],
      ["solve_partner_delay", "Partneri viivituse lahendamine"],
      ["be_always_available", "Pidev kättesaadavus"],
      ["make_decision", "Otsuse tegemine"],
      ["coordinate_network", "Võrgustiku koordineerimine"],
      ["emotional_support", "Emotsionaalne tugi"]
    ]
  },
  {
    key: "myRole",
    label: "Mis on minu roll?",
    options: [
      ["case_worker", "Juhtumitöö koordineerimine"],
      ["advisor", "Nõustamine ja selgitamine"],
      ["service_link", "Teenuse või kontakti vahendamine"],
      ["assessment_input", "Hindamise sisendi kogumine"],
      ["support_planning", "Toe planeerimine"]
    ]
  },
  {
    key: "outsideRole",
    label: "Mis ei ole minu roll?",
    options: [
      ["none", "Piir on selge"],
      ["make_other_agency_decision", "Teise asutuse otsuse tegemine"],
      ["replace_service_provider", "Teenuseosutaja rolli asendamine"],
      ["be_crisis_contact", "Kriisikontakti roll"],
      ["guarantee_outcome", "Tulemuse garanteerimine"],
      ["carry_partner_responsibility", "Partneri vastutuse kandmine"]
    ]
  },
  {
    key: "neededResponsibility",
    label: "Kelle panus on vajalik?",
    options: [
      ["self", "Minu rolli piires lahendatav"],
      ["manager", "Juhi panus"],
      ["partner_agency", "Koostööpartneri panus"],
      ["service_provider", "Teenuseosutaja panus"],
      ["network", "Võrgustiku ühine panus"],
      ["client_family", "Kliendi või lähedase panus"]
    ]
  },
  {
    key: "roleConflict",
    label: "Rollikonflikti tase",
    options: [
      ["none", "Puudub"],
      ["low", "Madal"],
      ["moderate", "Mõõdukas"],
      ["high", "Kõrge"]
    ]
  },
  {
    key: "availabilityPressure",
    label: "Kättesaadavuse surve",
    options: [
      ["none", "Puudub"],
      ["low", "Madal"],
      ["moderate", "Mõõdukas"],
      ["high", "Kõrge"]
    ]
  },
  {
    key: "ethicalComplexity",
    label: "Eetiline keerukus",
    options: [
      ["low", "Madal"],
      ["moderate", "Mõõdukas"],
      ["high", "Kõrge"]
    ]
  },
  {
    key: "counterpart",
    label: "Selgituse osapool",
    options: [
      ["client", "Klient"],
      ["client_family", "Kliendi lähedane"],
      ["manager", "Juht"],
      ["partner", "Koostööpartner"],
      ["team", "Tiim"]
    ]
  }
];

export const signalCopy = {
  clear: {
    title: "Roll on pigem selge",
    text: "Ootus, roll ja vastutus on piisavalt eristatavad. Vajadusel vormista lühike selgitus."
  },
  needs_clarification: {
    title: "Vajab selgitamist",
    text: "Mõni ootus, vastutus või osapoole panus vajab selgemat sõnastust."
  },
  needs_network_discussion: {
    title: "Vajab töökorralduslikku või võrgustiku arutelu",
    text: "Rollikonflikt või vastutuse nihkumine vajab juhiga, partneriga või kovisioonis läbi rääkimist."
  }
};

export const actionRoutes = {
  "work-boundaries": "/tooheaolu/toopiirid",
  "work-processes": "/tooheaolu/tooprotsessid",
  interruptions: "/tooheaolu/katkestused",
  covision: "/kovisioon",
  overview: "/tooheaolu/ulevaade"
};
