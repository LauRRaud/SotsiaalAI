/**
 * Interruptions: küsimused, vastusevariandid ja signaalitekstid.
 *
 * Tõstetud sõna-sõnalt vanast töövormist (`InterruptionsWorkflow.jsx`), et
 * sildid ja väärtused ei muutuks. Väärtused on serveri lepingu osa
 * (`lib/wellbeing/fieldSchemas.js`). `initialFields` on vana vormi näidis-
 * täide; sammuvorm seda ei kasuta (küsimused on alguses vastamata).
 */

export const initialFields = {
  interruptionClass: "negotiable",
  sources: ["phone", "colleague_questions", "documentation_system"],
  frequency: "often",
  workImpact: "moderate",
  immediateResponseNeed: "partial",
  canWait: "many",
  neededAgreement: "focus_time",
  counterpart: "team",
  wrongChannelShare: "some",
  documentationInterruption: true,
  recoveryImpact: "some"
};

export const selectFields = [
  {
    key: "interruptionClass",
    label: "Katkestuse liik",
    options: [
      ["unavoidable", "Vältimatu kiire sekkumine"],
      ["negotiable", "Kokkulepitav katkestus"],
      ["deferrable", "Edasilükatav küsimus"],
      ["wrong_channel", "Vale suhtluskanal"],
      ["role_boundary", "Rollipiiri ületav katkestus"],
      ["documentation_system", "Dokumenteerimise või süsteemi katkestus"],
      ["partner_process", "Koostööpartneri protsessi katkestus"]
    ]
  },
  {
    key: "frequency",
    label: "Sagedus",
    options: [
      ["rare", "Harva"],
      ["sometimes", "Mõnikord"],
      ["often", "Sageli"],
      ["very_often", "Väga sageli"]
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
    key: "immediateResponseNeed",
    label: "Kohe reageerimise vajaduse selgus",
    options: [
      ["clear", "Selge"],
      ["partial", "Osaliselt selge"],
      ["unclear", "Ebaselge"]
    ]
  },
  {
    key: "canWait",
    label: "Kui palju saaks oodata?",
    options: [
      ["few", "Vähesed"],
      ["some", "Osa"],
      ["many", "Paljud"]
    ]
  },
  {
    key: "neededAgreement",
    label: "Vajalik kokkulepe",
    options: [
      ["focus_time", "Fookusaeg"],
      ["channel_rules", "Suhtluskanalite reeglid"],
      ["role_boundary", "Rollipiir"],
      ["process_change", "Tööprotsessi muutus"],
      ["team_agreement", "Tiimi kokkulepe"]
    ]
  },
  {
    key: "counterpart",
    label: "Kokkuleppe osapool",
    options: [
      ["manager", "Juht"],
      ["team", "Tiim"],
      ["colleague", "Kolleeg"],
      ["partner", "Koostööpartner"]
    ]
  },
  {
    key: "wrongChannelShare",
    label: "Valest kanalist tulev osa",
    options: [
      ["none", "Puudub"],
      ["some", "Osa"],
      ["many", "Palju"]
    ]
  },
  {
    key: "recoveryImpact",
    label: "Mõju taastumisele",
    options: [
      ["none", "Puudub"],
      ["some", "Mõningane"],
      ["high", "Kõrge"]
    ]
  }
];

export const sourceOptions = [
  ["phone", "Telefon"],
  ["email", "E-kiri"],
  ["message", "Sõnum"],
  ["colleague_questions", "Kolleegi küsimused"],
  ["manager_requests", "Juhi päringud"],
  ["client_contact", "Kliendikontakt"],
  ["partner_contact", "Koostööpartner"],
  ["documentation_system", "Dokumenteerimissüsteem"],
  ["meetings", "Koosolekud"],
  ["urgent_cases", "Kiired juhtumid"]
];

export const signalCopy = {
  manageable: {
    title: "Juhitav",
    text: "Katkestusi on, kuid need on pigem selged ja vajavad peamiselt kokkuleppe hoidmist."
  },
  needs_workflow_clarification: {
    title: "Vajab töövoo täpsustamist",
    text: "Katkestuste sagedus, kanal või kiireloomulisus vajab selgemat töökorralduslikku kokkulepet."
  },
  needs_reorganization: {
    title: "Vajab ümberkorraldust",
    text: "Katkestused killustavad tööpäeva ja taastumist. Vajalik on fookusaja, kanalite või tööprotsessi kokkulepe."
  }
};

export const actionRoutes = {
  "work-boundaries": "/tooheaolu/toopiirid",
  "work-processes": "/tooheaolu/tooprotsessid",
  recovery: "/tooheaolu/taastumine",
  overview: "/tooheaolu/ulevaade"
};
