const HELP_TAXONOMY_BRIDGE = Object.freeze({
  TRANSPORT: {
    relatedServiceCategories: ["Transport ja liikumisabi", "KOV sotsiaalteenus"],
    needTags: ["liikumisabi", "arsti juurde jõudmine", "teenusele jõudmine"],
    lifeDomains: ["füüsiline tervis", "igapäevaelu toimingud"],
    locationSensitivity: "HIGH"
  },
  DAILY_TASKS: {
    relatedServiceCategories: ["Kodune abi ja hooldus", "Digi- ja asjaajamisabi", "Toimetulek ja võlanõustamine"],
    needTags: ["poes käimine", "igapäevased toimingud", "asjaajamine"],
    lifeDomains: ["igapäevaelu toimingud", "suhtlemine"],
    locationSensitivity: "HIGH"
  },
  HOME_HELP: {
    relatedServiceCategories: ["Kodune abi ja hooldus", "KOV sotsiaalteenus"],
    needTags: ["kodune toimetulek", "majapidamine", "koristamine", "kõrvalabi"],
    lifeDomains: ["igapäevaelu toimingud", "elukeskkond"],
    locationSensitivity: "HIGH"
  },
  DIGITAL_HELP: {
    relatedServiceCategories: ["Digi- ja asjaajamisabi", "Nõustamine ja juhendamine"],
    needTags: ["e-teenused", "digiasjaajamine", "arvuti või telefoni kasutamine"],
    lifeDomains: ["igapäevaelu toimingud", "suhtlemine"],
    locationSensitivity: "LOW"
  },
  CARE_SUPPORT: {
    relatedServiceCategories: ["Kodune abi ja hooldus", "Puue, rehabilitatsioon ja abivahendid", "Nõustamine ja juhendamine"],
    needTags: ["hoolduskoormus", "kõrvalabi", "toetav kohalolu"],
    lifeDomains: ["igapäevaelu toimingud", "füüsiline tervis", "võrgustik ja kõrvalabi"],
    locationSensitivity: "HIGH"
  },
  CHILD_YOUTH_SUPPORT: {
    relatedServiceCategories: ["Pere, lapse ja noore tugi", "KOV sotsiaalteenus"],
    needTags: ["lapse heaolu", "lapse või noore saatmine", "juhendamine", "peretugi"],
    lifeDomains: ["suhtlemine", "vaba aeg ja huvitegevus", "igapäevaelu toimingud"],
    locationSensitivity: "MEDIUM"
  },
  LEARNING_GUIDANCE: {
    relatedServiceCategories: ["Töö, õppimine ja osalemine", "Pere, lapse ja noore tugi"],
    needTags: ["õppimine", "juhendamine", "oskuste arendamine"],
    lifeDomains: ["hõivatus", "vaba aeg ja huvitegevus"],
    locationSensitivity: "MEDIUM"
  },
  SOCIAL_SUPPORT: {
    relatedServiceCategories: ["Töö, õppimine ja osalemine", "Nõustamine ja juhendamine"],
    needTags: ["üksildus", "suhtlemine", "sotsiaalne osalemine", "kogukondlik tugi"],
    lifeDomains: ["suhtlemine", "vaba aeg ja huvitegevus"],
    locationSensitivity: "MEDIUM"
  },
  ADMIN_FORM_HELP: {
    relatedServiceCategories: ["Digi- ja asjaajamisabi", "Nõustamine ja juhendamine"],
    needTags: ["avaldused", "vormid", "dokumendid", "asjaajamine"],
    lifeDomains: ["igapäevaelu toimingud", "suhtlemine"],
    locationSensitivity: "LOW"
  },
  OTHER: {
    relatedServiceCategories: ["Muu teenus"],
    needTags: ["vajab täpsustamist"],
    lifeDomains: [],
    locationSensitivity: "UNKNOWN"
  }
});

function normalizeCategoryCode(value = "") {
  const normalized = String(value || "").trim().toUpperCase();
  return HELP_TAXONOMY_BRIDGE[normalized] ? normalized : "OTHER";
}

function unique(values = []) {
  const result = [];
  const seen = new Set();
  for (const value of values) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    const key = text.toLocaleLowerCase("et");
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

export function getHelpTaxonomyBridge(categoryCode = "") {
  const code = normalizeCategoryCode(categoryCode);
  const bridge = HELP_TAXONOMY_BRIDGE[code] || HELP_TAXONOMY_BRIDGE.OTHER;
  return {
    categoryCode: code,
    relatedServiceCategories: [...bridge.relatedServiceCategories],
    needTags: [...bridge.needTags],
    lifeDomains: [...bridge.lifeDomains],
    locationSensitivity: bridge.locationSensitivity
  };
}

export function enrichHelpTaxonomy({ categoryCode = "", needTags = [], lifeDomains = [] } = {}) {
  const bridge = getHelpTaxonomyBridge(categoryCode);
  return {
    ...bridge,
    needTags: unique([...(Array.isArray(needTags) ? needTags : []), ...bridge.needTags]),
    lifeDomains: unique([...(Array.isArray(lifeDomains) ? lifeDomains : []), ...bridge.lifeDomains])
  };
}

export function buildServiceRecommendationSummary(categoryCode = "") {
  const bridge = getHelpTaxonomyBridge(categoryCode);
  return {
    title: "Võimalikud teenused ja kontaktid",
    description: "Sarnase vajadusega võib olla seotud ka KOV teenus või teenuseosutaja kontakt. Ava Teenusekaart.",
    relatedServiceCategories: bridge.relatedServiceCategories,
    needTags: bridge.needTags,
    lifeDomains: bridge.lifeDomains,
    locationSensitivity: bridge.locationSensitivity
  };
}
