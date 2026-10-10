import { normalizeMunicipalitySearchText } from "./municipalityData.js";

// ADR-127 (10.10.2026), for the chat's place reading, which no longer takes a part of a compound word for a
// municipality's name:
// - "Annelinn", "Supilinn", "Tammelinn" and "Karlova" are districts of the town of Tartu only: named alone and attributed
//   by the search plan as a place ("Elan Annelinnas"), each is Tartu linn. Said with the town's name, which Tartu vald
//   shares ("Elan Tartus Annelinnas"), the server reads no district by itself: the clause is as open as "Elan Tartus" and
//   the answer asks which of the two, unless the plan names Tartu linn or quotes the district alone. Until that day the
//   part "linn" of "Annelinnas" made it Tartu linn by accident. "Kesklinn" (below, Tallinn's) and "Ülejõe" are not given
//   to Tartu: several towns have one.
// - "Raeküla" is the district of Pärnu. The official units know only a village of that name in Väike-Maarja vald, and
//   the part "Rae" of the word used to select Rae vald.
// "Muhumaa" and "Kihnumaa" are not place names of this list: each is a name of its municipality itself (Muhu vald, Kihnu
// vald) in the directory the chat loads (lib/rag-v2/adapters/municipal-directory.js). The help flow, which reads this
// list too, finds both as before, by the municipality's own name inside the word.
const RAW_LOCATION_ALIASES = Object.freeze([
  { place: "Ihaste", municipalityDisplayName: "Tartu linn", kind: "district" },
  { place: "Annelinn", municipalityDisplayName: "Tartu linn", kind: "district" },
  { place: "Supilinn", municipalityDisplayName: "Tartu linn", kind: "district" },
  { place: "Tammelinn", municipalityDisplayName: "Tartu linn", kind: "district" },
  { place: "Karlova", municipalityDisplayName: "Tartu linn", kind: "district" },
  { place: "Raeküla", municipalityDisplayName: "Pärnu linn", kind: "district" },
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

// The chat's place reading uses the same list (ADR-103): these names decide before the official settlement units.
export const LOCATION_ALIAS_ENTRIES = RAW_LOCATION_ALIASES;

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
