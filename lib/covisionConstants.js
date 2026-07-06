export const COVISION_TOPICS = Object.freeze([
  "laste ja perede heaolu",
  "täiskasvanute hoolekanne",
  "eakad",
  "puue ja erivajadus",
  "vaimne tervis",
  "võrgustikutöö",
  "eetiline küsimus",
  "tööpiirid",
  "riskid",
  "teenustele suunamine",
  "dokumenteerimine",
  "muu"
]);

export const COVISION_JOURNEY_STEP_TYPES = Object.freeze([
  "esimene pöördumine",
  "esmane kontakt",
  "abivajaduse hindamine",
  "kodukülastus",
  "varasem teenus",
  "varasem toetus",
  "võrgustiku kohtumine",
  "teenuseosutajaga kontakt",
  "takistus",
  "teenusest keeldumine",
  "kriisiolukord",
  "uus info",
  "praegune seis",
  "järgmine küsimus"
]);

export const COVISION_PARTY_GROUPS = Object.freeze([
  {
    category: "Rollid ja lähivõrgustik",
    options: [
      "inimene ise",
      "lapsevanem",
      "laps/noor",
      "lähedane",
      "muu võrgustiku osapool"
    ]
  },
  {
    category: "Ametivõrgustik",
    options: [
      "KOV spetsialist",
      "teenuseosutaja",
      "kool",
      "perearst või tervishoiukontakt",
      "tööandja",
      "muu võrgustiku osapool"
    ]
  },
  {
    category: "Muu osapool",
    options: ["muu võrgustiku osapool"]
  }
]);

export const COVISION_PARTY_STATUSES = Object.freeze([
  "kaasatud",
  "vajab kaasamist",
  "info puudub",
  "koostöö toimib",
  "koostöö keeruline",
  "võimalik konflikt",
  "passiivne",
  "ei ole enam asjakohane"
]);

export const COVISION_RISK_OPTIONS = Object.freeze([
  "hoolduskoormuse kasv",
  "vägivalla või väärkohtlemise kahtlus",
  "lapse heaolu risk",
  "eluaseme kaotus",
  "võlgnevused",
  "ravist keeldumine",
  "teenusest keeldumine",
  "isolatsioon",
  "sõltuvus",
  "vaimse tervise kriis",
  "suitsiidirisk",
  "teenuste puudumine piirkonnas",
  "võrgustiku konflikt",
  "lähedaste läbipõlemine",
  "puudulik info",
  "õiguslik ebaselgus",
  "kiire sekkumise vajadus"
]);

export const COVISION_PROTECTIVE_OPTIONS = Object.freeze([
  "olemasolev tugi",
  "toimiv kontakt spetsialistiga",
  "varasem positiivne kogemus",
  "osaleja motivatsioon",
  "võrgustiku tugi",
  "muu toetav asjaolu"
]);

export const COVISION_EXPECTED_HELP_TYPES = Object.freeze([
  "uusi vaatenurki",
  "metoodilist arutelu",
  "eetilist arutelu",
  "riskide läbimõtlemist",
  "järgmiste sammude kaalumist",
  "dokumenteerimise mõtteid",
  "võrgustiku kaasamise mõtteid",
  "kolleegide kogemusi",
  "toimiva praktika näiteid",
  "muu"
]);

export const COVISION_MESSAGE_TYPES = Object.freeze([
  { value: "question", label: "Küsimus" },
  { value: "reflection", label: "Peegeldus" },
  { value: "suggestion", label: "Ettepanek" },
  { value: "risk", label: "Risk" },
  { value: "protective_factor", label: "Kaitsetegur" },
  { value: "next_step", label: "Järgmise sammu ettepanek" },
  { value: "comment", label: "Muu kommentaar" },
  { value: "documentation_note", label: "Dokumenteerimise mõte" },
  { value: "network_note", label: "Võrgustiku kaasamise mõte" }
]);

export const COVISION_PARTICIPANT_ROLES = Object.freeze([
  { value: "participant", label: "osaleja" },
  { value: "observer", label: "vaatleja" },
  { value: "co_moderator", label: "kaasmoderaator" },
  { value: "summary_reviewer", label: "kokkuvõtte ülevaataja" }
]);

export const COVISION_CASE_STATUSES = Object.freeze([
  { value: "draft", label: "mustand" },
  { value: "active", label: "arutelus" },
  { value: "summary_ready", label: "kokkuvõte valmis" },
  { value: "closed", label: "suletud" },
  { value: "archived", label: "arhiveeritud" }
]);

export const EFFECTIVE_PRACTICE_STATUSES = Object.freeze([
  { value: "draft", label: "mustand" },
  { value: "anonymity_check", label: "anonüümsuse kontroll" },
  { value: "review", label: "ülevaatamisel" },
  { value: "published", label: "avaldatud" },
  { value: "hidden", label: "peidetud" },
  { value: "archived", label: "arhiveeritud" }
]);
