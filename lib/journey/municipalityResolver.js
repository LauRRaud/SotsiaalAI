const MUNICIPALITY_ALIASES = Object.freeze([
  ["tartus", "Tartu"],
  ["tartu", "Tartu"],
  ["tallinnas", "Tallinn"],
  ["tallinn", "Tallinn"],
  ["pärnus", "Pärnu"],
  ["parnus", "Pärnu"],
  ["pärnu", "Pärnu"],
  ["parnu", "Pärnu"],
  ["narvas", "Narva"],
  ["narva", "Narva"]
]);

function cleanText(value, limit = 160) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function contextObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function firstText(source, keys) {
  for (const key of keys) {
    const value = cleanText(source[key]);
    if (value) return value;
  }
  return "";
}

export function resolveMunicipalityNameFromText(value) {
  const text = cleanText(value, 12000).toLocaleLowerCase("et");
  for (const [alias, label] of MUNICIPALITY_ALIASES) {
    if (new RegExp(`\\b${alias}\\b`, "iu").test(text)) return label;
  }
  const match = text.match(/\b([a-z0-9õäöüšž-]{3,40}\s+(?:vald|linn|maakond))\b/iu);
  return match ? cleanText(match[1], 80) : "";
}

export function resolveJourneyMunicipality(journey = {}) {
  const context = contextObject(journey.context);
  const continuity = contextObject(context.serviceContinuity);
  const municipalityId = cleanText(context.municipalityId, 120);
  const explicitName = firstText(context, [
    "municipalityName",
    "municipalityText",
    "municipality",
    "kov",
    "region"
  ]) || cleanText(continuity.municipality, 160);
  const municipalityName = explicitName || resolveMunicipalityNameFromText([
    journey.title,
    journey.summary
  ].filter(Boolean).join(" "));

  return {
    municipalityId,
    municipalityName,
    source: explicitName ? "context" : municipalityName ? "text" : municipalityId ? "id_only" : "none"
  };
}
