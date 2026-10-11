/**
 * WorkProcesses: küsimused, vastusevariandid ja signaalitekstid.
 *
 * Tõstetud sõna-sõnalt vanast töövormist (`WorkProcessesWorkflow.jsx`), et
 * sildid ja väärtused ei muutuks. Väärtused on serveri lepingu osa
 * (`lib/wellbeing/fieldSchemas.js`). `initialFields` on vana vormi näidis-
 * täide; sammuvorm seda ei kasuta (küsimused on alguses vastamata).
 */

export const initialFields = {
  analysisFocus: "documentation_flow",
  categories: ["documentation", "duplicate_entry", "information_search", "repetitive_tasks"],
  timeCostSources: ["same_data_multiple_places", "searching_partner_info", "manual_status_updates"],
  lowValueActivities: ["same_data_multiple_places", "manual_copying"],
  informationBlockers: ["unclear_owner", "missing_shared_view"],
  unfinishedWork: ["client_followup", "case_notes"],
  simplificationNeeds: ["single_entry", "shared_status_view"],
  documentationDuplication: "high",
  switchingLoad: "high",
  processImpact: "high",
  counterpart: "manager"
};

export const selectFields = [
  {
    key: "analysisFocus",
    label: "Analüüsi fookus",
    options: [
      ["documentation_flow", "Dokumenteerimise töövoog"],
      ["case_flow", "Juhtumitöö töövoog"],
      ["partner_coordination", "Partneritega kooskõlastamine"],
      ["team_routine", "Tiimi korduv rutiin"],
      ["information_flow", "Info liikumine"]
    ]
  },
  {
    key: "documentationDuplication",
    label: "Dubleeriva dokumenteerimise tase",
    options: [
      ["none", "Puudub"],
      ["low", "Madal"],
      ["moderate", "Mõõdukas"],
      ["high", "Kõrge"]
    ]
  },
  {
    key: "switchingLoad",
    label: "Ümberlülitumise koormus",
    options: [
      ["low", "Madal"],
      ["moderate", "Mõõdukas"],
      ["high", "Kõrge"]
    ]
  },
  {
    key: "processImpact",
    label: "Tööprotsessi mõju",
    options: [
      ["low", "Madal"],
      ["moderate", "Mõõdukas"],
      ["high", "Kõrge"]
    ]
  },
  {
    key: "counterpart",
    label: "Arutelu osapool",
    options: [
      ["manager", "Juht"],
      ["team", "Tiim"],
      ["colleague", "Kolleeg"],
      ["partner", "Koostööpartner"]
    ]
  }
];

export const multiFields = [
  {
    key: "categories",
    label: "Kategooriad",
    options: [
      ["client_value_work", "Väärtust loov klienditöö"],
      ["necessary_burden", "Vajalik, kuid koormav töö"],
      ["duplicate_entry", "Dubleeriv sisestamine"],
      ["documentation", "Dokumenteerimine"],
      ["information_search", "Info otsimine"],
      ["partner_coordination", "Partneritega kooskõlastamine"],
      ["waiting", "Ootamine"],
      ["repetitive_tasks", "Korduvtegevused"],
      ["low_value_work", "Vähese väärtusega tegevused"]
    ]
  },
  {
    key: "timeCostSources",
    label: "Peamised ajakulu allikad",
    options: [
      ["same_data_multiple_places", "Sama info mitmesse kohta"],
      ["searching_partner_info", "Partneri info otsimine"],
      ["manual_status_updates", "Käsitsi staatuse uuendamine"],
      ["waiting_for_answers", "Vastuste ootamine"],
      ["copying_between_systems", "Süsteemide vahel kopeerimine"],
      ["unclear_next_step", "Ebaselge järgmine samm"]
    ]
  },
  {
    key: "lowValueActivities",
    label: "Vähese väärtusega või dubleerivad tegevused",
    options: [
      ["same_data_multiple_places", "Sama andme korduv sisestus"],
      ["manual_copying", "Käsitsi kopeerimine"],
      ["status_chasing", "Seisu tagaajamine"],
      ["duplicate_meetings", "Dubleerivad arutelud"],
      ["unclear_templates", "Ebaselged mallid"]
    ]
  },
  {
    key: "informationBlockers",
    label: "Info liikumise takistused",
    options: [
      ["unclear_owner", "Ebaselge omanik"],
      ["missing_shared_view", "Puudub ühine vaade"],
      ["partner_delay", "Partneri viivitus"],
      ["system_gap", "Süsteemide vahe"],
      ["role_confusion", "Rollisegadus"]
    ]
  },
  {
    key: "unfinishedWork",
    label: "Mis jääb pooleli",
    options: [
      ["client_followup", "Kliendi järeltegevus"],
      ["case_notes", "Juhtumimärkmed"],
      ["partner_reply", "Partnerile vastamine"],
      ["planning", "Planeerimine"],
      ["recovery_pause", "Paus või taastumine"]
    ]
  },
  {
    key: "simplificationNeeds",
    label: "Mis võiks lihtsustada",
    options: [
      ["single_entry", "Ühekordne sisestus"],
      ["shared_status_view", "Ühine seisuvaade"],
      ["clear_owner", "Selge omanik"],
      ["template_cleanup", "Malli korrastus"],
      ["meeting_rule", "Koosolekureegel"]
    ]
  }
];

export const signalCopy = {
  manageable: {
    title: "Töövoog on pigem juhitav",
    text: "Ajaröövleid on vähe või mõju on madal. Hoia nähtaval üks lihtsustus ja jälgi mustrit."
  },
  needs_simplification: {
    title: "Vajab lihtsustamist",
    text: "Mõni korduv samm, info liikumine või dokumenteerimine vajab väikest töökorralduslikku lihtsustust."
  },
  needs_organizational_change: {
    title: "Vajab töökorralduslikku muutust",
    text: "Dubleerimine, ümberlülitumine või pooleli jäävad tegevused vajavad juhiga või tiimiga selget muudatust."
  }
};

export const actionRoutes = {
  interruptions: "/tooheaolu/katkestused",
  "work-boundaries": "/tooheaolu/toopiirid",
  "role-boundaries": "/tooheaolu/rollipiirid",
  overview: "/tooheaolu/ulevaade"
};
