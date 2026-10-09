/**
 * StarterSupport: küsimused, vastusevariandid ja signaalitekstid.
 *
 * Tõstetud sõna-sõnalt vanast töövormist (`StarterSupportWorkflow.jsx`), et
 * sildid ja väärtused ei muutuks. Väärtused on serveri lepingu osa
 * (`lib/wellbeing/fieldSchemas.js`). `initialFields` on vana vormi näidis-
 * täide; sammuvorm seda ei kasuta (küsimused on alguses vastamata).
 */

export const initialFields = {
  experienceStage: "first_month",
  roleArea: "child_protection",
  unclearTopics: ["role_boundaries", "documentation", "network_work"],
  existingSupport: ["manager_check_in"],
  missingSupport: ["mentor", "covision", "clear_documentation_routine"],
  casesNotCarryAlone: ["complex_family_case"],
  covisionNeedSigns: ["ethical_tension", "role_uncertainty"],
  mentorDiscussionNeed: true,
  managerDiscussionNeed: true,
  workBoundaryNeed: true,
  supportUrgency: "soon"
};

export const selectFields = [
  {
    key: "experienceStage",
    label: "Töökogemuse etapp",
    options: [
      ["first_week", "Esimene nädal"],
      ["first_month", "Esimene kuu"],
      ["first_100_days", "Esimesed 100 päeva"],
      ["new_role", "Uus roll samas valdkonnas"]
    ]
  },
  {
    key: "roleArea",
    label: "Rollivaldkond",
    options: [
      ["child_protection", "Lastekaitse"],
      ["adult_support", "Täiskasvanute tugi"],
      ["elderly_support", "Eakate tugi"],
      ["disability_support", "Puuetega inimeste tugi"],
      ["service_coordination", "Teenuste koordineerimine"],
      ["general_social_work", "Üldine sotsiaaltöö"]
    ]
  },
  {
    key: "supportUrgency",
    label: "Toe kokkuleppe kiireloomulisus",
    options: [
      ["stable", "Stabiilne"],
      ["plan_needed", "Plaan vajab täpsustamist"],
      ["soon", "Vaja lähiajal kokku leppida"],
      ["urgent", "Vaja kiiret kokkulepet"]
    ]
  }
];

export const multiFields = [
  {
    key: "unclearTopics",
    label: "Ebaselged teemad",
    options: [
      ["role_boundaries", "Roll ja vastutus"],
      ["documentation", "Dokumenteerimine"],
      ["network_work", "Võrgustikutöö"],
      ["service_rules", "Teenuste reeglid"],
      ["risk_escalation", "Riskide eskaleerimine"],
      ["work_boundaries", "Tööpiirid"]
    ]
  },
  {
    key: "existingSupport",
    label: "Olemasolev tugi",
    options: [
      ["manager_check_in", "Juhi kontrollpunkt"],
      ["team_channel", "Tiimi kanal"],
      ["onboarding_material", "Sisseelamismaterjal"],
      ["shadowing", "Kogenuma kolleegi jälgimine"],
      ["case_discussion", "Juhtumiarutelu"]
    ]
  },
  {
    key: "missingSupport",
    label: "Puuduv tugi",
    options: [
      ["mentor", "Mentor"],
      ["covision", "Kovisioon"],
      ["clear_documentation_routine", "Selge dokumenteerimisrutiin"],
      ["role_expectations", "Rolliootuste selgitus"],
      ["boundary_agreement", "Tööpiiride kokkulepe"],
      ["case_escalation_rule", "Juhtumi eskaleerimise reegel"]
    ]
  },
  {
    key: "casesNotCarryAlone",
    label: "Juhtumid, mida ei tohiks üksi kanda",
    options: [
      ["complex_family_case", "Keeruline perejuhtum"],
      ["workplace_violence", "Töövägivalla olukord"],
      ["ethical_tension_case", "Eetilise pingega juhtum"],
      ["high_risk_case", "Kõrge riskiga juhtum"],
      ["unclear_mandate", "Ebaselge mandaadiga juhtum"]
    ]
  },
  {
    key: "covisionNeedSigns",
    label: "Kovisiooni vajaduse märgid",
    options: [
      ["ethical_tension", "Eetiline pinge"],
      ["role_uncertainty", "Rolli ebaselgus"],
      ["emotional_load", "Emotsionaalne koormus"],
      ["repeating_case_pattern", "Korduv juhtumimuster"],
      ["not_to_carry_alone", "Ei peaks üksi kandma"]
    ]
  }
];

export const signalCopy = {
  support_available: {
    title: "Tugi on pigem olemas",
    text: "Alustamise tugi on olemas ja vajab peamiselt nähtaval hoidmist."
  },
  needs_clearer_support_plan: {
    title: "Vajab selgemat töötoe plaani",
    text: "Mõni tugi, rolliootus või dokumenteerimise rutiin vajab selgemat kokkulepet."
  },
  needs_urgent_support_agreement: {
    title: "Vajab kiiremat toe kokkulepet",
    text: "Puuduv tugi või keerulised juhtumid vajavad juhiga, mentoriga või kovisioonis kiiremat kokkulepet."
  }
};

export const actionRoutes = {
  "role-boundaries": "/tooheaolu/rollipiirid",
  "work-processes": "/tooheaolu/tooprotsessid",
  "work-boundaries": "/tooheaolu/toopiirid",
  covision: "/kovisioon",
  overview: "/tooheaolu/ulevaade"
};
