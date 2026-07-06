import { readFile } from "node:fs/promises";
import path from "node:path";

export const MUNICIPALITY_DATA_PATH = path.join(process.cwd(), "src", "server", "data", "municipalities.rich.json");
export const MUNICIPALITY_TYPE_VALUES = Object.freeze(["LINN", "VALD"]);

function normalizeWhitespace(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function normalizeMunicipalitySearchText(value = "") {
  return normalizeWhitespace(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase();
}

function toSlugPart(value = "") {
  return normalizeMunicipalitySearchText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function municipalityTypeFromSource(value = "") {
  const normalized = String(value || "").trim().toUpperCase();
  if (!MUNICIPALITY_TYPE_VALUES.includes(normalized)) {
    const error = new Error("MUNICIPALITY_SOURCE_TYPE_INVALID");
    error.code = "MUNICIPALITY_SOURCE_TYPE_INVALID";
    throw error;
  }
  return normalized;
}

function buildMunicipalitySearchName(entry = {}) {
  const displayName = normalizeWhitespace(entry?.displayName);
  const baseName = normalizeWhitespace(entry?.baseName);
  const county = normalizeWhitespace(entry?.county);
  const slug = toSlugPart(entry?.slug);
  const type = municipalityTypeFromSource(entry?.type || "VALD");

  return normalizeMunicipalitySearchText([
    displayName,
    baseName,
    county,
    slug,
    `${baseName} ${type.toLowerCase()}`,
    `${displayName} ${county}`
  ].filter(Boolean).join(" "));
}

export function formatMunicipalityDisplayName(entry = {}) {
  return normalizeWhitespace(entry?.displayName || entry?.baseName || entry?.slug);
}

export async function loadMunicipalitySeedEntries() {
  const rawText = await readFile(MUNICIPALITY_DATA_PATH, "utf8");
  const rawData = JSON.parse(rawText);
  if (!Array.isArray(rawData)) {
    throw new Error("MUNICIPALITY_SOURCE_INVALID");
  }

  const deduped = new Map();

  for (const item of rawData) {
    const slug = toSlugPart(item?.slug);
    const baseName = normalizeWhitespace(item?.baseName);
    const displayName = formatMunicipalityDisplayName(item);
    const county = normalizeWhitespace(item?.county);
    if (!slug || !baseName || !displayName) continue;

    const type = municipalityTypeFromSource(item?.type);
    const entry = {
      slug,
      id: slug.replace(/-/g, "_"),
      municipalityId: slug.replace(/-/g, "_"),
      baseName,
      type,
      displayName,
      county: county || null,
      isActive: item?.isActive !== false,
      searchText: buildMunicipalitySearchName({
        slug,
        baseName,
        type,
        displayName,
        county
      })
    };

    deduped.set(entry.slug, entry);
  }

  return [...deduped.values()].sort((left, right) => {
    return String(left.county || "").localeCompare(String(right.county || ""), "et")
      || left.displayName.localeCompare(right.displayName, "et")
      || left.type.localeCompare(right.type, "en");
  });
}
