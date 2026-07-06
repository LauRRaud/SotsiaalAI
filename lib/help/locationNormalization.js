import prisma from "../prisma.js";
import { geocodePlace } from "./geocoding.js";
import { findLocationAliasMatches } from "./locationAliases.js";
import {
  findMunicipalityByDisplayName,
  findMunicipalityByName,
  findMunicipalityMatchesFromText
} from "./municipalities.js";
import { normalizeMunicipalitySearchText } from "./municipalityData.js";

const PLACE_PREFIX_PATTERN = /\b(?:asukohas|asukoht|piirkonnas|piirkond|linnaosas|linnajaos|külas|alevis|alevikus|vallas|linnas|in|at|near|around)\s+([\p{L}\d][\p{L}\d.-]*(?:\s+[\p{L}\d][\p{L}\d.-]*){0,3})/iu;
const MUNICIPALITY_PHRASE_PATTERN = /\b([\p{L}-]+(?:\s+[\p{L}-]+)?\s+(?:vald|linn))\b/iu;

function normalizeText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizedEquality(left = "", right = "") {
  return normalizeMunicipalitySearchText(left) === normalizeMunicipalitySearchText(right);
}

function toCandidate(municipality, extra = {}) {
  if (!municipality?.id || !municipality?.displayName) return null;
  return {
    id: municipality.id,
    displayName: municipality.displayName,
    county: municipality.county || "",
    type: municipality.type || "",
    ...extra
  };
}

function dedupeCandidates(items = []) {
  const unique = [];
  const seen = new Set();
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return unique;
}

function extractPlaceFromText(input = {}) {
  const explicit = normalizeText(
    typeof input === "string"
      ? input
      : input?.place || input?.location || input?.message || input?.text || input?.rawPlace
  );
  if (!explicit) return null;

  const aliasMatches = findLocationAliasMatches(explicit);
  if (aliasMatches.length === 1) {
    return aliasMatches[0].place;
  }

  const municipalityPhrase = explicit.match(MUNICIPALITY_PHRASE_PATTERN);
  if (municipalityPhrase?.[1]) {
    return normalizeText(municipalityPhrase[1]);
  }

  const prefixMatch = explicit.match(PLACE_PREFIX_PATTERN);
  if (prefixMatch?.[1]) {
    return normalizeText(prefixMatch[1]);
  }

  if (explicit.length <= 64 && !/[\n,.!?]/.test(explicit)) {
    return explicit;
  }

  return explicit;
}

async function normalizeOfficialMunicipality(rawPlace, prismaClient = prisma) {
  const exact = await findMunicipalityByDisplayName(rawPlace, prismaClient)
    || await findMunicipalityByName({ displayName: rawPlace }, prismaClient)
    || await findMunicipalityByName({ baseName: rawPlace }, prismaClient);
  if (exact) {
    return {
      rawPlace,
      municipality: exact,
      municipalityId: exact.id,
      municipalityDisplayName: exact.displayName,
      confidence: "high",
      source: "official"
    };
  }

  const matches = await findMunicipalityMatchesFromText(rawPlace, { limit: 5 }, prismaClient);
  if (matches.length === 1) {
    const match = matches[0];
    const exactish = normalizedEquality(rawPlace, match.displayName)
      || normalizedEquality(rawPlace, match.baseName)
      || normalizedEquality(rawPlace, match.slug);
    return {
      rawPlace,
      municipality: match,
      municipalityId: match.id,
      municipalityDisplayName: match.displayName,
      confidence: exactish ? "high" : "medium",
      source: "official_text"
    };
  }
  if (matches.length > 1) {
    return {
      rawPlace,
      municipality: null,
      municipalityId: null,
      municipalityDisplayName: null,
      confidence: "low",
      source: "official_ambiguous",
      candidates: dedupeCandidates(matches.map((item) => toCandidate(item))).filter(Boolean)
    };
  }

  return null;
}

async function normalizeAliasMunicipality(rawPlace, prismaClient = prisma) {
  const aliasMatches = findLocationAliasMatches(rawPlace);
  if (!aliasMatches.length) return null;

  const candidates = [];
  for (const alias of aliasMatches) {
    const municipality = await findMunicipalityByDisplayName(alias.municipalityDisplayName, prismaClient)
      || await findMunicipalityByName({ displayName: alias.municipalityDisplayName }, prismaClient);
    const candidate = toCandidate(municipality, {
      rawMatchedPlace: alias.place,
      aliasKind: alias.kind
    });
    if (candidate) candidates.push(candidate);
  }

  const uniqueCandidates = dedupeCandidates(candidates);
  if (uniqueCandidates.length === 1) {
    return {
      rawPlace,
      municipality: uniqueCandidates[0],
      municipalityId: uniqueCandidates[0].id,
      municipalityDisplayName: uniqueCandidates[0].displayName,
      confidence: "high",
      source: "alias",
      rawMatchedPlace: uniqueCandidates[0].rawMatchedPlace || rawPlace
    };
  }
  if (uniqueCandidates.length > 1) {
    return {
      rawPlace,
      municipality: null,
      municipalityId: null,
      municipalityDisplayName: null,
      confidence: "low",
      source: "alias_ambiguous",
      candidates: uniqueCandidates
    };
  }

  return null;
}

async function normalizeGeocodedMunicipality(rawPlace, options = {}, prismaClient = prisma) {
  const geocoded = await geocodePlace(rawPlace, options);
  if (!geocoded) return null;

  const candidateStrings = [
    geocoded.municipalityDisplayName,
    ...(Array.isArray(geocoded.candidateStrings) ? geocoded.candidateStrings : [])
  ]
    .map((item) => normalizeText(item))
    .filter(Boolean);

  for (const candidateText of candidateStrings) {
    const exact = await findMunicipalityByDisplayName(candidateText, prismaClient)
      || await findMunicipalityByName({ displayName: candidateText }, prismaClient)
      || await findMunicipalityByName({ baseName: candidateText }, prismaClient);
    if (exact) {
      return {
        rawPlace,
        municipality: exact,
        municipalityId: exact.id,
        municipalityDisplayName: exact.displayName,
        confidence: geocoded.confidence || "medium",
        source: "geocoding",
        rawMatchedPlace: geocoded.matchedPlace || rawPlace,
        geocoded
      };
    }

    const matches = await findMunicipalityMatchesFromText(candidateText, { limit: 5 }, prismaClient);
    if (matches.length === 1) {
      const match = matches[0];
      return {
        rawPlace,
        municipality: match,
        municipalityId: match.id,
        municipalityDisplayName: match.displayName,
        confidence: "medium",
        source: "geocoding_text",
        rawMatchedPlace: geocoded.matchedPlace || candidateText,
        geocoded
      };
    }
  }

  const candidates = dedupeCandidates(
    (await Promise.all(
      candidateStrings.map(async (candidateText) => {
        const municipality = await findMunicipalityByName({ name: candidateText }, prismaClient);
        return toCandidate(municipality);
      })
    )).filter(Boolean)
  );

  return {
    rawPlace,
    municipality: null,
    municipalityId: null,
    municipalityDisplayName: null,
    confidence: "low",
    source: "geocoding_unmapped",
    rawMatchedPlace: geocoded.matchedPlace || rawPlace,
    geocoded,
    candidates
  };
}

export async function normalizePlaceToMunicipality(input = {}, options = {}, prismaClient = prisma) {
  const rawPlace = extractPlaceFromText(input);
  if (!rawPlace) {
    return {
      rawPlace: "",
      municipality: null,
      municipalityId: null,
      municipalityDisplayName: null,
      confidence: "none",
      source: "none",
      candidates: []
    };
  }

  const officialResult = await normalizeOfficialMunicipality(rawPlace, prismaClient);
  if (officialResult) {
    return {
      ...officialResult,
      candidates: officialResult.candidates || (officialResult.municipality ? [toCandidate(officialResult.municipality)].filter(Boolean) : [])
    };
  }

  const aliasResult = await normalizeAliasMunicipality(rawPlace, prismaClient);
  if (aliasResult) {
    return {
      ...aliasResult,
      candidates: aliasResult.candidates || (aliasResult.municipality ? [toCandidate(aliasResult.municipality)].filter(Boolean) : [])
    };
  }

  const geocodedResult = await normalizeGeocodedMunicipality(rawPlace, options, prismaClient);
  if (geocodedResult) {
    return {
      ...geocodedResult,
      candidates: geocodedResult.candidates || (geocodedResult.municipality ? [toCandidate(geocodedResult.municipality)].filter(Boolean) : [])
    };
  }

  return {
    rawPlace,
    municipality: null,
    municipalityId: null,
    municipalityDisplayName: null,
    confidence: "none",
    source: "unresolved",
    candidates: []
  };
}

function isHighConfidenceMunicipalityResolution(result = null) {
  return !!result?.municipalityId && result?.confidence === "high";
}

export function municipalityGuessNeedsConfirmation(result = null) {
  if (!result) return false;
  return !isHighConfidenceMunicipalityResolution(result) && Array.isArray(result.candidates) && result.candidates.length > 0;
}

