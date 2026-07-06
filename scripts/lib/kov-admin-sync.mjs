import { loadMunicipalitySeedEntries } from "../../lib/help/municipalityData.js";

let municipalitySeedEntriesPromise = null;

function normalizeOptionalString(value = "") {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function normalizeMunicipalitySlug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function deriveMunicipalityType(displayName = "") {
  return /\blinn$/i.test(String(displayName || "").trim()) ? "LINN" : "VALD";
}

function buildUtcScheduleDate(year, monthIndex, dayOfMonth) {
  return new Date(Date.UTC(year, monthIndex, dayOfMonth, 9, 0, 0));
}

function getDefaultReviewSchedule(referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const januaryFullReview = buildUtcScheduleDate(year, 0, 31);
  const julyLightCheck = buildUtcScheduleDate(year, 6, 31);

  return {
    reviewCadence: "ANNUAL_JAN_PLUS_JULY_CHECK",
    nextFullReviewAt: referenceDate.getTime() <= januaryFullReview.getTime()
      ? januaryFullReview
      : buildUtcScheduleDate(year + 1, 0, 31),
    nextLightCheckAt: referenceDate.getTime() <= julyLightCheck.getTime()
      ? julyLightCheck
      : buildUtcScheduleDate(year + 1, 6, 31)
  };
}

async function loadMunicipalitySeedMap() {
  if (!municipalitySeedEntriesPromise) {
    municipalitySeedEntriesPromise = loadMunicipalitySeedEntries()
      .then(entries => new Map(entries.map(entry => [entry.slug, entry])));
  }
  return municipalitySeedEntriesPromise;
}

async function getPrismaIfAvailable() {
  if (!String(process.env.DATABASE_URL || "").trim()) {
    return null;
  }
  const prismaModule = await import("../../lib/prisma.js");
  return prismaModule.prisma || prismaModule.default || null;
}

async function upsertMunicipality(prisma, slug, input = {}) {
  const normalizedSlug = normalizeMunicipalitySlug(slug);
  if (!normalizedSlug) {
    throw new Error("Municipality slug is required for KOV admin sync.");
  }

  const seedMap = await loadMunicipalitySeedMap();
  const seed = seedMap.get(normalizedSlug);
  const displayName = normalizeOptionalString(
    input.displayName || seed?.displayName || input.baseName || normalizedSlug
  );
  const county = normalizeOptionalString(input.county || seed?.county || "");
  const type = String(input.type || seed?.type || deriveMunicipalityType(displayName)).trim().toUpperCase();
  const isActive = input.isActive !== false && seed?.isActive !== false;

  return prisma.municipality.upsert({
    where: { slug: normalizedSlug },
    create: {
      slug: normalizedSlug,
      baseName: normalizeOptionalString(input.baseName || seed?.baseName || displayName) || displayName,
      type,
      displayName,
      county,
      isActive
    },
    update: {
      baseName: normalizeOptionalString(input.baseName || seed?.baseName || displayName) || displayName,
      type,
      displayName,
      county,
      isActive
    }
  });
}

export async function syncKovWebCliIngest({
  municipalitySlug = "",
  municipalityName = "",
  county = "",
  checkedAt = "",
  officialWebsite = "",
  ragDocId = ""
} = {}) {
  const prisma = await getPrismaIfAvailable();
  if (!prisma) {
    return { synced: false, reason: "DATABASE_URL missing" };
  }

  const municipality = await upsertMunicipality(prisma, municipalitySlug, {
    displayName: municipalityName,
    county
  });
  const schedule = getDefaultReviewSchedule();
  const checkedDate = checkedAt ? new Date(checkedAt) : new Date();
  const normalizedCheckedAt = Number.isNaN(checkedDate.getTime()) ? new Date() : checkedDate;
  const normalizedWebsite = normalizeOptionalString(officialWebsite);

  await prisma.municipalityKovAdmin.upsert({
    where: { municipalityId: municipality.id },
    create: {
      municipalityId: municipality.id,
      officialWebsite: normalizedWebsite,
      status: "INGESTED",
      checkedAt: normalizedCheckedAt,
      readyForIngest: false,
      ingestStatus: "INGESTED",
      lastIngestedAt: new Date(),
      lastIngestError: null,
      ragDocId: normalizeOptionalString(ragDocId),
      reviewCadence: schedule.reviewCadence,
      nextFullReviewAt: schedule.nextFullReviewAt,
      nextLightCheckAt: schedule.nextLightCheckAt
    },
    update: {
      ...(normalizedWebsite ? { officialWebsite: normalizedWebsite } : {}),
      status: "INGESTED",
      checkedAt: normalizedCheckedAt,
      ingestStatus: "INGESTED",
      lastIngestedAt: new Date(),
      lastIngestError: null,
      ragDocId: normalizeOptionalString(ragDocId)
    }
  });

  return {
    synced: true,
    municipalitySlug: municipality.slug,
    ragDocId: normalizeOptionalString(ragDocId)
  };
}

export async function syncKovRtCliIngest({
  municipalitySlug = "",
  municipalityName = "",
  county = "",
  sourceUrl = "",
  ragDocId = ""
} = {}) {
  const normalizedSlug = normalizeMunicipalitySlug(municipalitySlug);
  const normalizedName = normalizeOptionalString(municipalityName);
  if (!normalizedSlug && !normalizedName) {
    return { synced: false, reason: "municipality not provided" };
  }

  const prisma = await getPrismaIfAvailable();
  if (!prisma) {
    return { synced: false, reason: "DATABASE_URL missing" };
  }

  const municipality = await upsertMunicipality(prisma, normalizedSlug || normalizedName, {
    displayName: normalizedName,
    county
  });
  const schedule = getDefaultReviewSchedule();
  const normalizedSourceUrl = normalizeOptionalString(sourceUrl);

  await prisma.municipalityKovAdmin.upsert({
    where: { municipalityId: municipality.id },
    create: {
      municipalityId: municipality.id,
      riigiTeatajaUrl: normalizedSourceUrl,
      status: "INGESTED",
      readyForIngest: false,
      rtStatus: "READY",
      rtCheckedAt: new Date(),
      rtIngestStatus: "INGESTED",
      rtLastIngestedAt: new Date(),
      rtLastIngestError: null,
      rtRagDocId: normalizeOptionalString(ragDocId),
      reviewCadence: schedule.reviewCadence,
      nextFullReviewAt: schedule.nextFullReviewAt,
      nextLightCheckAt: schedule.nextLightCheckAt
    },
    update: {
      ...(normalizedSourceUrl ? { riigiTeatajaUrl: normalizedSourceUrl } : {}),
      status: "INGESTED",
      rtStatus: "READY",
      rtCheckedAt: new Date(),
      rtIngestStatus: "INGESTED",
      rtLastIngestedAt: new Date(),
      rtLastIngestError: null,
      rtRagDocId: normalizeOptionalString(ragDocId)
    }
  });

  return {
    synced: true,
    municipalitySlug: municipality.slug,
    ragDocId: normalizeOptionalString(ragDocId)
  };
}
