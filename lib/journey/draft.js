import { JOURNEY_PRIMARY_PATHS } from "./constants.js";
import { buildAssistiveDevicesHandoff } from "./assistiveDevices.js";
import { buildHelpMediationHandoff } from "./helpMediationHandoff.js";
import { normalizeJourneyDraftInput, normalizeJourneyText } from "./validation.js";

const DOMAIN_RULES = Object.freeze([
  ["kodune abivajadus", ["koduteenus", "abi kodus", "pesemine", "söömine", "soomine", "igapäeva", "igapaeva"]],
  ["hoolduskoormus", ["hooldus", "hooldan", "hooldaja", "lähedane", "lahedane"]],
  ["igapäevaelu toimingud", ["pesemine", "söömine", "soomine", "toit", "korist", "riiet", "liikumine"]],
  ["abivahendid ja kohandused", ["abivahend", "rollaator", "ratastool", "dušitool", "dusitool", "kuuldeaparaat", "kodukohandus", "kukkumisrisk", "trepp"]],
  ["vaimne tervis", ["vaimne", "ärevus", "arevus", "depress", "läbipõle", "labipole", "ei jaksa"]],
  ["lapse heaolu", ["laps", "pere", "vanem", "kool", "lasteaed"]],
  ["eluasememure", ["elukoht", "korter", "üür", "uur", "kodutu", "eluase"]],
  ["asjaajamine", ["taotlus", "avaldus", "otsus", "kiri", "asjaajamine", "dokument"]],
  ["võlad", ["võlg", "volg", "arve", "laen", "makse", "sissetulek"]],
  ["turvalisus", ["oht", "vägivald", "vagivald", "ähvard", "ahvard", "kriis", "kiire"]]
]);

const LIFE_DOMAIN_RULES = Object.freeze([
  ["suhtlemine", ["suhtle", "kontakt", "üksild", "uksild", "lähedane", "lahedane"]],
  ["vaimne tervis", ["vaimne", "ärevus", "arevus", "depress", "ei jaksa", "läbipõle", "labipole"]],
  ["füüsiline tervis", ["tervis", "haigus", "ravim", "puue", "liikumine", "abivahend"]],
  ["elukeskkond", ["elukoht", "korter", "üür", "uur", "eluase", "kodu"]],
  ["hõivatus", ["töö", "too", "töötu", "tootu", "õpp", "opp", "töötukassa", "tootukassa"]],
  ["vaba aeg ja huvitegevus", ["huvi", "vaba aeg", "tegevus", "kogukond"]],
  ["igapäevaelu toimingud", ["pesemine", "söömine", "soomine", "toit", "korist", "riiet"]],
  ["võrgustik ja kõrvalabi", ["hooldus", "hooldan", "hooldaja", "abi", "naaber", "sugulane"]],
  ["kriis ja turvalisus", ["oht", "vägivald", "vagivald", "ähvard", "ahvard", "kriis", "kiire"]]
]);

const RISK_RULES = Object.freeze([
  ["Kirjelduses on võimalik kiire ohu või turvalisuse teema. Kui inimene on vahetus ohus, tuleb kasutada hädaabinumbrit 112.", ["oht", "vägivald", "vagivald", "ähvard", "ahvard", "enesetapp", "kriis"]],
  ["Kirjelduses võib olla teenuse või abi katkemise risk, mis vajab järgmises sammus täpsustamist.", ["lõpeb", "lopeb", "katkeb", "katkem", "otsus", "tähtaeg", "tahtaeg"]]
]);

const STOP_WORDS = new Set([
  "ning",
  "olen",
  "oleme",
  "vajan",
  "vajab",
  "palun",
  "soovin",
  "kuidas",
  "kuhu",
  "mida",
  "kelle",
  "poole",
  "pöörduda",
  "poorduda",
  "minu",
  "tema",
  "meie",
  "selle",
  "kohta"
]);

function normalizedSearchText(value) {
  return String(value || "").toLocaleLowerCase("et");
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function inferDomains(situation) {
  const text = normalizedSearchText(situation);
  const domains = DOMAIN_RULES
    .filter(([, keywords]) => includesAny(text, keywords))
    .map(([domain]) => domain);
  return domains.length ? domains : ["Olukorra täpsustamine"];
}

function inferLifeDomains(situation, domains = []) {
  const text = normalizedSearchText(`${situation} ${domains.join(" ")}`);
  const lifeDomains = LIFE_DOMAIN_RULES
    .filter(([, keywords]) => includesAny(text, keywords))
    .map(([domain]) => domain);
  return lifeDomains.length ? lifeDomains : ["igapäevaelu toimingud"];
}

function inferRiskSignals(situation) {
  const text = normalizedSearchText(situation);
  return RISK_RULES
    .filter(([, keywords]) => includesAny(text, keywords))
    .map(([message]) => message);
}

function inferPrimaryPath(domains, riskSignals) {
  if (riskSignals.length) return "PRE_INQUIRY";
  if (domains.some((domain) => /tervis|perearst|tervisekeskus|tervisen[õo]u|ravij[äa]rgne/i.test(domain))) {
    return "HEALTH_CONTACT";
  }
  if (domains.some((domain) => /toimetulek|elukoht|hooldus|tervis|laps|abivahend|kohandus/i.test(domain))) {
    return "SERVICE_MAP";
  }
  return "GENERAL_SUPPORT";
}

function extractKeywords(situation) {
  const seen = new Set();
  const words = normalizedSearchText(situation)
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  const result = [];

  for (const word of words) {
    if (word.length < 4 || STOP_WORDS.has(word) || seen.has(word)) continue;
    seen.add(word);
    result.push(word);
    if (result.length >= 10) break;
  }

  return result;
}

function buildTitle(summary, domains) {
  const firstDomain = domains[0] && domains[0] !== "Olukorra täpsustamine" ? domains[0] : "";
  if (firstDomain) return firstDomain;
  return normalizeJourneyText(summary, 72, "Teekond");
}

function buildSuggestedActions(primaryPath, options = {}) {
  const hasPracticalNeed = options?.hasPracticalNeed === true;
  const hasAssistiveDeviceNeed = options?.hasAssistiveDeviceNeed === true;
  const actions = [
    {
      type: "REVIEW",
      title: "Täpsusta ja kinnita teekonna kokkuvõte",
      description: "Vaata üle, kas kokkuvõte ja puuduolev info kirjeldavad olukorda õigesti."
    }
  ];

  if (primaryPath === "SERVICE_MAP") {
    actions.push({
      type: "SERVICE_MAP",
      title: "Vaata sobivaid kontakte teenusekaardilt",
      description: "Järgmises etapis saab teekond avada olemasoleva teenusekaardi eelfiltriga."
    });
  }

  if (primaryPath === "HEALTH_CONTACT" || primaryPath === "COMBINED_SOCIAL_HEALTH") {
    actions.push({
      type: "CREATE_HEALTH_CONTACT_QUESTIONS",
      title: "Koosta küsimused tervisekontaktile",
      description: "SotsiaalAI ei anna meditsiinilist hinnangut, kuid aitab küsimused perearstikeskusele, tervisekeskusele või ametlikule tervisenõu kontaktile selgelt sõnastada."
    });
    actions.push({
      type: "OPEN_SERVICE_MAP",
      title: "Ava teenusekaart tervisekontakti leidmiseks",
      description: "Teenusekaart võib aidata leida sobiva kontakti või ametliku allika, kui see on olemas."
    });
  }

  if (primaryPath === "PRE_INQUIRY") {
    actions.push({
      type: "PRE_INQUIRY",
      title: "Valmista vajadusel eelpöördumine",
      description: "Järgmises etapis saab teekond anda eelpöördumisele eelinfo."
    });
  }

  if (primaryPath === "GENERAL_SUPPORT") {
    actions.push({
      type: "REVIEW",
      title: "Otsusta järgmine tööriist",
      description: "Pärast täpsustamist saab valida teenusekaardi, eelpöördumise või muu tööriista."
    });
  }

  if (hasPracticalNeed) {
    actions.push({
      type: "HELP_MEDIATION",
      title: "Vaata Abivahenduse võimalusi",
      description: "Teekonna signaalid viitavad praktilisele abile. Järgmises sammus saab vaadata abipakkumisi või alustada abisoovi loomist."
    });
  }

  if (hasAssistiveDeviceNeed) {
    actions.push({
      type: "ASSISTIVE_DEVICES",
      title: "Täpsusta abivahendi või kodukohanduse vajadus",
      description: "Abivahendi või kohanduse info aitab avada Teenusekaardi, koostada eelpöördumist või lisada asjakohase dokumendi."
    });
  }

  return actions;
}

export function buildJourneyDraft(input = {}) {
  const { situation } = normalizeJourneyDraftInput(input);
  const domains = inferDomains(situation);
  const riskSignals = inferRiskSignals(situation);
  const primaryPath = inferPrimaryPath(domains, riskSignals);
  const safePrimaryPath = JOURNEY_PRIMARY_PATHS.includes(primaryPath) ? primaryPath : "UNKNOWN";
  const keywords = extractKeywords(situation);
  const lifeDomains = inferLifeDomains(situation, domains);
  const helpMediation = buildHelpMediationHandoff({
    summary: situation,
    domains,
    context: {
      lifeDomains,
      needTags: domains,
      keywords
    }
  });
  const assistiveDevices = buildAssistiveDevicesHandoff({
    summary: situation,
    domains,
    context: {
      lifeDomains,
      needTags: domains,
      keywords
    }
  });

  return {
    title: buildTitle(situation, domains),
    summary: situation,
    primaryPath: safePrimaryPath,
    domains,
    missingInfo: [
      "Millises omavalitsuses või piirkonnas abi vajatakse?",
      "Kas abi on vaja inimesele endale või lähedasele?",
      "Kas mõni teenus, otsus või kontakt on juba olemas?"
    ],
    riskSignals,
    suggestedActions: buildSuggestedActions(safePrimaryPath, {
      hasPracticalNeed: helpMediation.hasPracticalNeed,
      hasAssistiveDeviceNeed: assistiveDevices.hasAssistiveDeviceNeed
    }),
    context: {
      source: "manual_structured_journey_start",
      overviewType: "structured",
      lifeDomains,
      needTags: domains,
      ...(assistiveDevices.hasAssistiveDeviceNeed
        ? {
            assistiveDevices: assistiveDevices.devices
          }
        : {}),
      ...(helpMediation.hasPracticalNeed
        ? {
            helpMediation: {
              categoryCode: helpMediation.categoryCode,
              needTags: helpMediation.taxonomy?.needTags || [],
              lifeDomains: helpMediation.taxonomy?.lifeDomains || [],
              relatedServiceCategories: helpMediation.taxonomy?.relatedServiceCategories || []
            }
          }
        : {}),
      activityLog: [
        {
          type: "created_overview",
          title: "teekonna ülevaade koostatud"
        }
      ],
      keywords
    }
  };
}
