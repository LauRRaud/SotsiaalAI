/**
 * HardCase: küsimused, vastusevariandid ja signaalitekstid.
 *
 * Tõstetud sõna-sõnalt vanast töövormist (`HardCaseWorkflow.jsx`), et
 * sildid ja väärtused ei muutuks. Väärtused on serveri lepingu osa
 * (`lib/wellbeing/fieldSchemas.js`). `initialFields` on vana vormi näidis-
 * täide; sammuvorm seda ei kasuta (küsimused on alguses vastamata).
 */

export const initialFields = {
  caseType: "emotionally_heavy",
  immediateDanger: "no",
  generalizedDescription: "Keeruline kohtumine, mis jättis tööalase pinge ja vajab järeltegevuse korrastamist.",
  professionalRole: "case_worker",
  mainLoad: "emotional_load",
  ethicalTension: "moderate",
  moralDistress: "some",
  traumaExposure: "indirect",
  roleClarity: "partly_clear",
  shouldNotCarryAlone: true,
  next24hNeeds: ["manager_check_in", "document_key_facts"],
  covisionNeed: true,
  recoveryNeed: "partial"
};

export const selectFields = [
  {
    key: "caseType",
    label: "Juhtumi tüüp",
    options: [
      ["emotionally_heavy", "Emotsionaalselt raske"],
      ["ethical_dilemma", "Eetiline dilemma"],
      ["complex_case", "Töökorralduslikult keeruline"],
      ["trauma_related", "Traumaga kokkupuude"],
      ["role_conflict", "Rolli või vastutuse konflikt"]
    ]
  },
  {
    key: "immediateDanger",
    label: "Vahetu oht",
    options: [
      ["no", "Vahetut ohtu ei ole"],
      ["uncertain", "Pole kindel"],
      ["yes", "Oht võib jätkuda"]
    ]
  },
  {
    key: "professionalRole",
    label: "Minu tööalane roll",
    options: [
      ["case_worker", "Juhtumikorraldaja"],
      ["child_protection", "Lastekaitse spetsialist"],
      ["social_worker", "Sotsiaaltöötaja"],
      ["advisor", "Nõustaja"],
      ["coordinator", "Koordinaator"]
    ]
  },
  {
    key: "mainLoad",
    label: "Mis jäi koormama",
    options: [
      ["emotional_load", "Emotsionaalne koormus"],
      ["ethical_tension", "Eetiline pinge"],
      ["moral_distress", "Moraalne stress"],
      ["trauma_exposure", "Traumaga kokkupuude"],
      ["role_conflict", "Rollikonflikt"],
      ["workload_followup", "Järeltegevuste töömaht"]
    ]
  },
  {
    key: "ethicalTension",
    label: "Eetiline pinge",
    options: [
      ["none", "Puudub"],
      ["low", "Madal"],
      ["moderate", "Mõõdukas"],
      ["high", "Kõrge"]
    ]
  },
  {
    key: "moralDistress",
    label: "Moraalse stressi tunne",
    options: [
      ["none", "Puudub"],
      ["some", "Mõningane"],
      ["strong", "Tugev"]
    ]
  },
  {
    key: "traumaExposure",
    label: "Traumaga kokkupuude",
    options: [
      ["none", "Ei märgi"],
      ["indirect", "Kaudne"],
      ["direct", "Otsene"]
    ]
  },
  {
    key: "roleClarity",
    label: "Rolli või vastutuse selgus",
    options: [
      ["clear", "Selge"],
      ["partly_clear", "Osaliselt selge"],
      ["unclear", "Ebaselge"]
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

export const next24hOptions = [
  ["manager_check_in", "Juhiga lühike järelkontakt"],
  ["document_key_facts", "Tööks vajalikud faktid kirja"],
  ["reduce_next_day_load", "Järgmise päeva koormuse vähendamine"],
  ["colleague_debrief", "Kolleegiga tööalane järelarutelu"],
  ["safety_followup", "Ohutuse järelkontroll"],
  ["covision_input", "Kovisiooni sisendi ettevalmistus"]
];

export const signalCopy = {
  no_immediate_danger: {
    title: "Vahetut ohtu ei ole",
    text: "Olukord vajab tööalast korrastamist, kuid kiire ohutegevus ei ole praegu märgitud."
  },
  needs_attention: {
    title: "Vajab tähelepanu",
    text: "Juhtum vajab 24h järelplaani, et koormus, roll ja järgmised sammud ei jääks üksi kanda."
  },
  urgent_attention: {
    title: "Kiire tähelepanu vajalik",
    text: "Vahetu oht või tugev risk vajab esmalt turvalisuse ja vastutava osapoolega seotud tegevust."
  }
};

export const actionRoutes = {
  recovery: "/tooheaolu/taastumine",
  covision: "/kovisioon",
  "role-boundaries": "/tooheaolu/rollipiirid",
  overview: "/tooheaolu/ulevaade"
};
