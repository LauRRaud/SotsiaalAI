import { normalizeMunicipalitySearchText } from "./municipalityData.js";

const RAW_LOCATION_ALIASES = Object.freeze([
  { place: "Ihaste", municipalityDisplayName: "Tartu linn", kind: "district" },
  { place: "Kaberneeme", municipalityDisplayName: "Jõelähtme vald", kind: "village" },
  { place: "Tabasalu", municipalityDisplayName: "Harku vald", kind: "settlement" },
  { place: "Vääna", municipalityDisplayName: "Harku vald", kind: "settlement" },
  { place: "Peetri", municipalityDisplayName: "Rae vald", kind: "settlement" },
  { place: "Õismäe", municipalityDisplayName: "Tallinn", kind: "district" },
  { place: "Mustamäe", municipalityDisplayName: "Tallinn", kind: "district" },
  { place: "Lasnamäe", municipalityDisplayName: "Tallinn", kind: "district" },
  { place: "Haabersti", municipalityDisplayName: "Tallinn", kind: "district" },
  { place: "Nõmme", municipalityDisplayName: "Tallinn", kind: "district" },
  { place: "Pirita", municipalityDisplayName: "Tallinn", kind: "district" },
  { place: "Kristiine", municipalityDisplayName: "Tallinn", kind: "district" },
  { place: "Kesklinn", municipalityDisplayName: "Tallinn", kind: "district" }
]);

const LOCATION_ALIASES = Object.freeze(
  RAW_LOCATION_ALIASES.map((item) => ({
    ...item,
    normalizedPlace: normalizeMunicipalitySearchText(item.place)
  }))
);

export function findLocationAliasMatches(text = "") {
  const normalizedText = normalizeMunicipalitySearchText(text);
  if (!normalizedText) return [];

  return LOCATION_ALIASES.filter((item) => normalizedText.includes(item.normalizedPlace));
}
