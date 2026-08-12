import prisma from "../prisma.js";
import { geocodePlace } from "./geocoding.js";
import { toPublicHelpListingProjection } from "./listingViews.js";
import { enrichHelpTaxonomy } from "./taxonomyBridge.js";

const DEFAULT_EXPIRY_DAYS = 45;
const ACTIVE_GEOCODING_STATUSES = Object.freeze(["MATCHED", "MANUALLY_CONFIRMED"]);
const HELP_MAP_ENTRY_KINDS = Object.freeze(["HELP_REQUEST", "HELP_OFFER"]);
const HELP_MAP_MODES = Object.freeze(["PHYSICAL", "AREA", "AT_HOME", "ONLINE_PHONE"]);
const HELP_MAP_CONTACT_MODES = Object.freeze(["PLATFORM", "PHONE", "EMAIL", "OTHER"]);
const HELP_MAP_STATUSES = Object.freeze(["DRAFT", "REVIEW", "PUBLISHED", "CLOSED", "HIDDEN", "EXPIRED"]);

const helpMapEntrySelect = Object.freeze({
  id: true,
  kind: true,
  requestId: true,
  offerId: true,
  mapVisible: true,
  mapMode: true,
  address: true,
  normalizedAddress: true,
  latitude: true,
  longitude: true,
  geocodingStatus: true,
  geocodingRaw: true,
  county: true,
  municipalityIds: true,
  serviceArea: true,
  categoryCode: true,
  helpType: true,
  targetGroupCodes: true,
  needTags: true,
  deliveryModes: true,
  contactMode: true,
  status: true,
  expiresAt: true,
  privacyNote: true,
  createdAt: true,
  updatedAt: true
});

const helpMapRequestInclude = Object.freeze({
  mapEntry: { select: helpMapEntrySelect },
  municipality: {
    select: {
      id: true,
      slug: true,
      displayName: true,
      county: true
    }
  },
  primaryCategory: {
    select: {
      id: true,
      code: true,
      labelEt: true,
      labelEn: true,
      labelRu: true
    }
  },
  targetGroupLinks: {
    select: {
      targetGroup: {
        select: {
          id: true,
          code: true,
          labelEt: true,
          labelEn: true,
          labelRu: true
        }
      }
    }
  }
});

const helpMapOfferInclude = helpMapRequestInclude;

function normalizeText(value = "", max = 240) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.slice(0, max);
}

function normalizeList(value, maxItems = 12, maxLength = 80) {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[,;\n\r]/)
        .map((item) => item.trim());
  const result = [];
  const seen = new Set();
  for (const item of source) {
    const normalized = normalizeText(item, maxLength);
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase("et");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= maxItems) break;
  }
  return result;
}

function normalizeEnum(value, allowed, fallback) {
  const normalized = String(value || "").trim().toUpperCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeBoolean(value, fallback = false) {
  if (value === true || value === false) return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "jah", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "ei", "off"].includes(normalized)) return false;
  return fallback;
}

function normalizeDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function defaultExpiresAt(now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + DEFAULT_EXPIRY_DAYS);
  return date;
}

function isExpired(expiresAt, now = new Date()) {
  const date = normalizeDate(expiresAt);
  return Boolean(date && date.getTime() <= now.getTime());
}

function targetGroupCodesFromRecord(record = {}) {
  return Array.from(
    new Set(
      (record.targetGroupLinks || [])
        .map((link) => link?.targetGroup?.code)
        .map((code) => String(code || "").trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

function defaultMapModeForRecord(record = {}, input = {}) {
  const requested = normalizeEnum(input?.mapMode, HELP_MAP_MODES, "");
  if (requested) return requested;
  if (String(record?.primaryCategory?.code || "").toUpperCase() === "DIGITAL_HELP") return "ONLINE_PHONE";
  return "AREA";
}

function deliveryModesForMapMode(mapMode, input = {}) {
  const explicit = normalizeList(input?.deliveryModes, 8, 60);
  if (explicit.length) return explicit;
  if (mapMode === "PHYSICAL") return ["ON_SITE"];
  if (mapMode === "AT_HOME") return ["AT_HOME"];
  if (mapMode === "ONLINE_PHONE") return ["ONLINE", "PHONE"];
  return ["REGIONAL"];
}

function serviceAreaForRecord(record = {}, input = {}) {
  return normalizeText(input?.serviceArea, 160)
    || normalizeText(record?.municipality?.displayName, 120)
    || normalizeText(record?.rawPlace, 160)
    || null;
}

function shouldExposeExactAddress(mapMode, input = {}) {
  return mapMode === "PHYSICAL" && normalizeBoolean(input?.exactAddressPublic, false);
}

function addressForMapMode(record = {}, mapMode, input = {}) {
  if (!shouldExposeExactAddress(mapMode, input)) return null;
  return normalizeText(input?.address || record?.rawPlace, 200);
}

function buildNeedTags(record = {}, input = {}) {
  const explicit = normalizeList(input?.needTags, 12, 80);
  if (explicit.length) return explicit;
  const taxonomy = enrichHelpTaxonomy({
    categoryCode: record?.primaryCategory?.code
  });
  return normalizeList([
    record?.primaryCategory?.labelEt,
    record?.roleLabel,
    record?.beneficiaryLabel,
    record?.providerScopeOrConditions,
    ...taxonomy.needTags
  ], 8, 80);
}

function mapStatusForListing(record = {}, input = {}, now = new Date()) {
  const explicit = normalizeEnum(input?.mapStatus || input?.mapEntryStatus, HELP_MAP_STATUSES, "");
  if (explicit) return explicit;
  if (isExpired(input?.expiresAt || record?.expiresAt, now)) return "EXPIRED";
  const listingStatus = String(input?.status || record?.status || "").trim().toUpperCase();
  if (["CLOSED", "CANCELLED", "ARCHIVED", "MATCHED"].includes(listingStatus)) return "CLOSED";
  if (listingStatus === "DRAFT") return "DRAFT";
  return record?.userConfirmedAt ? "PUBLISHED" : "REVIEW";
}

async function geocodeMapContext({ record, mapMode, address, serviceArea }) {
  if (mapMode === "ONLINE_PHONE") {
    return {
      geocodingStatus: "FAILED",
      normalizedAddress: null,
      latitude: null,
      longitude: null,
      county: record?.municipality?.county || null,
      geocodingRaw: { reason: "online_or_phone" }
    };
  }

  const query = address
    || serviceArea
    || record?.municipality?.displayName
    || record?.rawPlace
    || "";
  const normalizedQuery = normalizeText(query, 200);
  if (!normalizedQuery) {
    return {
      geocodingStatus: "FAILED",
      normalizedAddress: null,
      latitude: null,
      longitude: null,
      county: record?.municipality?.county || null,
      geocodingRaw: { reason: "missing_safe_location" }
    };
  }

  const geocoding = await geocodePlace(normalizedQuery, { limit: 1 }).catch(() => null);
  if (!geocoding?.latitude || !geocoding?.longitude) {
    return {
      geocodingStatus: "PENDING",
      normalizedAddress: normalizedQuery,
      latitude: null,
      longitude: null,
      county: record?.municipality?.county || geocoding?.county || null,
      geocodingRaw: {
        provider: geocoding?.provider || "none",
        rawPlace: normalizedQuery,
        reason: "geocoder_not_matched_or_not_configured"
      }
    };
  }

  return {
    geocodingStatus: geocoding.confidence === "low" ? "AMBIGUOUS" : "MATCHED",
    normalizedAddress: normalizeText(geocoding.matchedPlace || normalizedQuery, 240),
    latitude: geocoding.confidence === "low" ? null : geocoding.latitude,
    longitude: geocoding.confidence === "low" ? null : geocoding.longitude,
    county: record?.municipality?.county || geocoding.county || null,
    geocodingRaw: {
      provider: geocoding.provider,
      rawPlace: normalizedQuery,
      matchedPlace: geocoding.matchedPlace,
      confidence: geocoding.confidence,
      checkedAt: new Date().toISOString()
    }
  };
}

function mapEntryWhere(kind, listingId) {
  if (kind === "HELP_REQUEST") return { requestId: listingId };
  return { offerId: listingId };
}

async function syncHelpMapEntryForRecord(kind, record = {}, input = {}, prismaClient = prisma) {
  const listingId = String(record?.id || "").trim();
  if (!listingId || !HELP_MAP_ENTRY_KINDS.includes(kind)) return null;

  const now = new Date();
  const expiresAt = normalizeDate(input?.expiresAt || record?.expiresAt) || defaultExpiresAt(now);
  const mapMode = defaultMapModeForRecord(record, input);
  const address = addressForMapMode(record, mapMode, input);
  const serviceArea = serviceAreaForRecord(record, input);
  const geocoding = await geocodeMapContext({ record, mapMode, address, serviceArea });
  const status = mapStatusForListing({ ...record, expiresAt }, input, now);
  const mapVisible = normalizeBoolean(input?.mapVisible, true);

  const data = {
    kind,
    mapVisible,
    mapMode,
    address,
    normalizedAddress: geocoding.normalizedAddress,
    latitude: geocoding.latitude,
    longitude: geocoding.longitude,
    geocodingStatus: geocoding.geocodingStatus,
    geocodingRaw: geocoding.geocodingRaw,
    county: geocoding.county,
    municipalityIds: record?.municipalityId ? [record.municipalityId] : [],
    serviceArea,
    categoryCode: normalizeText(record?.primaryCategory?.code, 80),
    helpType: record?.helpType || null,
    targetGroupCodes: targetGroupCodesFromRecord(record),
    needTags: buildNeedTags(record, input),
    deliveryModes: deliveryModesForMapMode(mapMode, input),
    contactMode: normalizeEnum(input?.contactMode, HELP_MAP_CONTACT_MODES, "PLATFORM"),
    status,
    expiresAt,
    privacyNote: mapMode === "PHYSICAL" && address
      ? "Kasutaja lubas täpse asukoha kaardil kuvada."
      : "Kaardil kasutatakse üldistatud piirkonda; täpset koduaadressi ei avaldata."
  };

  return prismaClient.helpMapEntry.upsert({
    where: mapEntryWhere(kind, listingId),
    create: {
      ...data,
      ...(kind === "HELP_REQUEST" ? { requestId: listingId } : { offerId: listingId })
    },
    update: data,
    select: helpMapEntrySelect
  });
}

export async function syncHelpRequestMapEntry(record = {}, input = {}, prismaClient = prisma) {
  return syncHelpMapEntryForRecord("HELP_REQUEST", record, input, prismaClient);
}

export async function syncHelpOfferMapEntry(record = {}, input = {}, prismaClient = prisma) {
  return syncHelpMapEntryForRecord("HELP_OFFER", record, input, prismaClient);
}

export function mapEntryFieldsFromInput(input = {}) {
  const fields = [
    "mapVisible",
    "mapMode",
    "address",
    "exactAddressPublic",
    "serviceArea",
    "needTags",
    "deliveryModes",
    "contactMode",
    "mapStatus",
    "mapEntryStatus",
    "expiresAt"
  ];
  return fields.reduce((acc, field) => {
    if (Object.prototype.hasOwnProperty.call(input, field)) acc[field] = input[field];
    return acc;
  }, {});
}

function hasUsableCoordinates(entry = {}) {
  const latitude = Number(entry.latitude);
  const longitude = Number(entry.longitude);
  return (
    ACTIVE_GEOCODING_STATUSES.includes(String(entry.geocodingStatus || "").toUpperCase()) &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  );
}

function listingFromEntry(entry = {}) {
  if (entry.kind === "HELP_OFFER") return entry.offer || null;
  return entry.request || null;
}

function listingKindFromEntry(entry = {}) {
  return entry.kind === "HELP_OFFER" ? "offer" : "request";
}

export function serializeHelpMapEntry(entry = {}, options = {}) {
  const listing = listingFromEntry(entry);
  if (!listing) return null;
  const locale = String(options?.locale || "et").trim();
  const listingKind = listingKindFromEntry(entry);
  const publicListing = toPublicHelpListingProjection({
    ...listing,
    mapEntry: entry
  }, { kind: listingKind, locale });
  const regionLabel = publicListing.municipalityLabel
    || publicListing.region?.county
    || "";
  const targetGroupCodes = Array.from(new Set(
    (listing?.targetGroupLinks || [])
      .map((item) => String(item?.targetGroup?.code || "").trim().toUpperCase())
      .filter(Boolean)
  ));

  return {
    id: entry.id,
    type: entry.kind,
    sourceType: entry.kind,
    sourceId: listing.id,
    title: publicListing.title,
    description: publicListing.description,
    listingId: listing.id,
    listingKind,
    isOwn: options?.currentUserId ? listing.userId === options.currentUserId : false,
    mapVisible: entry.mapVisible,
    mapMode: entry.mapMode,
    // Help-listing'u `address` võib legacy-kirjes olla kopeeritud otse
    // privaatsest rawPlace-ist. Avalik Teenusekaart ei saa selle päritolu ega
    // nõusolekut usaldusväärselt tõendada, seega on tekstiline aadress fail-closed.
    address: null,
    normalizedAddress: null,
    latitude: entry.latitude,
    longitude: entry.longitude,
    geocodingStatus: entry.geocodingStatus,
    county: publicListing.region?.county || "",
    municipalityName: publicListing.municipalityLabel,
    serviceArea: regionLabel,
    categoryCode: publicListing.primaryCategoryCode,
    categoryLabel: publicListing.categoryLabel,
    helpType: publicListing.helpType,
    helpTypeLabel: publicListing.helpTypeLabel,
    timeType: publicListing.timeType,
    timeTypeLabel: publicListing.timeTypeLabel,
    targetGroupCodes,
    targetGroupLabels: publicListing.targetGroupLabels,
    needTags: publicListing.serviceRecommendation.needTags,
    relatedServiceCategories: publicListing.serviceRecommendation.relatedServiceCategories,
    lifeDomains: publicListing.serviceRecommendation.lifeDomains,
    locationSensitivity: publicListing.serviceRecommendation.locationSensitivity,
    deliveryModes: publicListing.deliveryModes,
    contactMode: publicListing.contactMode,
    status: entry.status,
    listingStatus: listing.status,
    expiresAt: entry.expiresAt || listing.expiresAt || null,
    availabilityOrStart: publicListing.availabilityOrStart,
    compensationDetails: publicListing.compensationDetails,
    conditions: publicListing.conditions,
    regionLabel,
    privacyNote: publicListing.privacyNote,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

export const HELP_MAP_VISIBILITY = Object.freeze({
  PUBLIC: "PUBLIC",
  HIDDEN: "HIDDEN",
  REVIEW: "REVIEW",
  EXPIRED: "EXPIRED",
  MISSING: "MISSING",
  OUT_OF_SYNC: "OUT_OF_SYNC"
});

/** Sama avalikkuse reegel nii Teenusekaardil kui omaniku jagamisajaloos. */
export function classifyHelpMapVisibility({ listingStatus, listingExpiresAt, mapEntry, now = new Date() }) {
  if (!mapEntry) return HELP_MAP_VISIBILITY.MISSING;
  const expired = [listingExpiresAt, mapEntry.expiresAt]
    .filter(Boolean)
    .some((value) => new Date(value).getTime() <= now.getTime());
  if (expired) return HELP_MAP_VISIBILITY.EXPIRED;
  const sourceOpen = String(listingStatus || "").toUpperCase() === "OPEN";
  if (!sourceOpen && (mapEntry.mapVisible || mapEntry.status === "PUBLISHED")) {
    return HELP_MAP_VISIBILITY.OUT_OF_SYNC;
  }
  if (!sourceOpen || mapEntry.mapVisible !== true) return HELP_MAP_VISIBILITY.HIDDEN;
  if (mapEntry.status === "REVIEW") return HELP_MAP_VISIBILITY.REVIEW;
  if (mapEntry.status === "PUBLISHED") return HELP_MAP_VISIBILITY.PUBLIC;
  return HELP_MAP_VISIBILITY.OUT_OF_SYNC;
}

export async function listPublishedHelpMapEntries({
  keyword = "",
  municipalityId = "",
  municipalityName = "",
  county = "",
  type = "",
  includeUnlocated = false,
  limit = 500,
  locale = "et",
  currentUserId = ""
} = {}, prismaClient = prisma) {
  const now = new Date();
  const normalizedType = String(type || "").trim().toUpperCase();
  const kindFilter = normalizedType === "HELP_REQUEST" || normalizedType === "HELP_OFFER"
    ? { kind: normalizedType }
    : {};

  const filters = {
    ...kindFilter,
    mapVisible: true,
    status: "PUBLISHED",
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: now } }
    ]
  };

  // HelpMapEntry is derived data. Its own PUBLISHED state must never outlive
  // the source listing's public OPEN state after a legacy or concurrent write.
  filters.AND = [
    {
      OR: [
        {
          kind: "HELP_REQUEST",
          request: { is: { status: "OPEN", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }
        },
        {
          kind: "HELP_OFFER",
          offer: { is: { status: "OPEN", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }
        }
      ]
    }
  ];

  if (!includeUnlocated) {
    filters.AND.push(
      {
        geocodingStatus: { in: [...ACTIVE_GEOCODING_STATUSES] },
        latitude: { not: null },
        longitude: { not: null }
      }
    );
  }

  const normalizedMunicipalityId = normalizeText(municipalityId, 120);
  if (normalizedMunicipalityId) {
    filters.municipalityIds = { has: normalizedMunicipalityId };
  }

  const normalizedCounty = normalizeText(county, 120);
  if (normalizedCounty) {
    filters.county = { contains: normalizedCounty, mode: "insensitive" };
  }

  const take = Math.max(1, Math.min(Number(limit) || 500, 1000));
  const entries = await prismaClient.helpMapEntry.findMany({
    where: filters,
    take,
    orderBy: [{ updatedAt: "desc" }],
    include: {
      request: { include: helpMapRequestInclude },
      offer: { include: helpMapOfferInclude }
    }
  });

  const query = normalizeText(keyword, 120)?.toLocaleLowerCase("et") || "";
  const regionQuery = normalizeText(municipalityName, 120)?.toLocaleLowerCase("et") || "";

  return entries
    .map((entry) => serializeHelpMapEntry(entry, { locale, currentUserId }))
    .filter(Boolean)
    .filter((entry) => {
      if (isExpired(entry.expiresAt, now)) return false;
      if (!includeUnlocated && !hasUsableCoordinates(entry)) return false;
      const haystack = [
        entry.title,
        entry.description,
        entry.categoryLabel,
        entry.helpTypeLabel,
        entry.timeTypeLabel,
        entry.regionLabel,
        ...(entry.targetGroupLabels || []),
        ...(entry.needTags || []),
        ...(entry.relatedServiceCategories || []),
        ...(entry.lifeDomains || []),
        ...(entry.deliveryModes || [])
      ].join(" ").toLocaleLowerCase("et");
      const regionText = [
        entry.municipalityName,
        entry.county,
        entry.serviceArea,
        entry.regionLabel
      ].join(" ").toLocaleLowerCase("et");
      return (!query || haystack.includes(query)) && (!regionQuery || regionText.includes(regionQuery));
    });
}

export function helpMapActiveListingWhere(now = new Date()) {
  return {
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: now } }
    ]
  };
}
