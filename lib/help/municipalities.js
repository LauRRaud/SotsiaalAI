import prisma from "../prisma.js";
import {
  formatMunicipalityDisplayName,
  loadMunicipalitySeedEntries,
  MUNICIPALITY_DATA_PATH,
  normalizeMunicipalitySearchText
} from "./municipalityData.js";

export const municipalitySummarySelect = Object.freeze({
  id: true,
  slug: true,
  baseName: true,
  type: true,
  displayName: true,
  county: true,
  isActive: true
});

async function getMunicipalityById(municipalityId, prismaClient = prisma) {
  const id = String(municipalityId || "").trim();
  if (!id) return null;

  return prismaClient.municipality.findUnique({
    where: { id },
    select: municipalitySummarySelect
  });
}

export async function requireMunicipality(municipalityId, prismaClient = prisma) {
  const municipality = await getMunicipalityById(municipalityId, prismaClient);
  if (!municipality) {
    const error = new Error("HELP_MUNICIPALITY_NOT_FOUND");
    error.code = "HELP_MUNICIPALITY_NOT_FOUND";
    throw error;
  }
  return municipality;
}

export async function findMunicipalityByName(input = {}, prismaClient = prisma) {
  const query = String(input?.displayName || input?.baseName || input?.name || "").trim();
  if (!query) return null;

  const county = String(input?.county || "").trim();
  const normalizedSlug = normalizeMunicipalitySearchText(query);
  const where = {
    OR: [
      {
        displayName: {
          equals: query,
          mode: "insensitive"
        }
      },
      {
        baseName: {
          equals: query,
          mode: "insensitive"
        }
      },
      {
        slug: {
          equals: normalizedSlug,
          mode: "insensitive"
        }
      }
    ]
  };

  if (county) {
    where.county = county;
  }
  if (input?.includeInactive !== true) {
    where.isActive = true;
  }

  return prismaClient.municipality.findFirst({
    where,
    select: municipalitySummarySelect,
    orderBy: [{ county: "asc" }, { displayName: "asc" }]
  });
}

export async function findMunicipalityByDisplayName(displayName, prismaClient = prisma) {
  const query = String(displayName || "").trim();
  if (!query) return null;

  return prismaClient.municipality.findFirst({
    where: {
      displayName: {
        equals: query,
        mode: "insensitive"
      },
      isActive: true
    },
    select: municipalitySummarySelect
  });
}

export async function seedMunicipalities(prismaClient = prisma) {
  const entries = await loadMunicipalitySeedEntries();

  for (const entry of entries) {
    await prismaClient.municipality.upsert({
      where: { slug: entry.slug },
      create: {
        slug: entry.slug,
        baseName: entry.baseName,
        type: entry.type,
        displayName: entry.displayName,
        county: entry.county,
        isActive: entry.isActive
      },
      update: {
        baseName: entry.baseName,
        type: entry.type,
        displayName: entry.displayName,
        county: entry.county,
        isActive: entry.isActive
      }
    });
  }

  return {
    count: entries.length,
    sourcePath: MUNICIPALITY_DATA_PATH
  };
}

export async function findMunicipalityMatchesFromText(text = "", options = {}, prismaClient = prisma) {
  const normalizedText = normalizeMunicipalitySearchText(text);
  if (!normalizedText) return [];

  const entries = await loadMunicipalitySeedEntries();
  const matches = [];

  for (const entry of entries) {
    if (entry.isActive === false && options?.includeInactive !== true) continue;

    const lookupTerms = [
      entry.displayName,
      entry.baseName,
      `${entry.baseName} ${entry.type.toLowerCase()}`
    ]
      .map((value) => normalizeMunicipalitySearchText(value))
      .filter(Boolean)
      .sort((left, right) => right.length - left.length);

    const matchedTerm = lookupTerms.find((term) => normalizedText.includes(term));
    if (!matchedTerm) continue;

    matches.push({
      slug: entry.slug,
      baseName: entry.baseName,
      type: entry.type,
      displayName: formatMunicipalityDisplayName(entry),
      county: entry.county,
      isActive: entry.isActive,
      matchedTerm
    });
  }

  const unique = [];
  const seen = new Set();
  for (const item of matches) {
    if (seen.has(item.slug)) continue;
    seen.add(item.slug);
    unique.push(item);
  }

  const ranked = unique
    .sort((left, right) => right.matchedTerm.length - left.matchedTerm.length || left.displayName.localeCompare(right.displayName, "et"))
    .slice(0, Math.max(1, Math.min(10, Number(options?.limit) || 5)));
  if (!ranked.length) return [];

  const municipalities = await prismaClient.municipality.findMany({
    where: {
      slug: {
        in: ranked.map((item) => item.slug)
      }
    },
    select: municipalitySummarySelect
  });
  const bySlug = new Map(municipalities.map((item) => [item.slug, item]));

  return ranked
    .map((item) => {
      const municipality = bySlug.get(item.slug);
      if (!municipality) return null;
      return {
        ...municipality,
        matchedTerm: item.matchedTerm
      };
    })
    .filter(Boolean);
}
