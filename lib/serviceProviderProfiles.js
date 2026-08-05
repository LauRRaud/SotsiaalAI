import { prisma } from "@/lib/prisma";
import { serviceMapEntryTypesFromFilter } from "@/lib/serviceMap/entryTypes";
import { normalizeServiceMapAccessPath, serviceMapAccessPathHasDetails } from "@/lib/serviceMap/accessPath";
import { buildRagHeaders, deleteRagDocument, ragServiceRequest } from "@/lib/documents/ragService";
import { publicLicenceBadge } from "@/lib/mtr/statusText";
import { RAG_SERVICE_KEY } from "@/lib/server/ragAuth";
import { splitServiceLocationMapEntries } from "@/lib/serviceProviderServiceLocations";
import {
  getServiceAvailabilityState,
  isCanonicalServiceAvailabilityStatus,
  normalizeAvailabilityStatusForWrite,
  normalizeServiceAvailabilityDescription,
  serviceAvailabilityRagFields,
  serializePublicServiceAvailability
} from "@/lib/serviceAvailability";
import { serviceAvailabilityFingerprint } from "@/lib/serviceAvailability.server";
import { confirmServiceAvailabilityRecord } from "@/lib/serviceAvailabilityOperations";

export { SERVICE_MAP_ENTRY_TYPES } from "@/lib/serviceMap/entryTypes";

export const SERVICE_PROVIDER_PROFILE_STATUSES = Object.freeze([
  "DRAFT",
  "REVIEW",
  "PUBLISHED",
  "HIDDEN"
]);

export const SERVICE_PROVIDER_FEE_TYPES = Object.freeze([
  "FREE",
  "PAID",
  "AGREEMENT",
  "MIXED",
  "UNKNOWN"
]);

export const SERVICE_MAP_ENTRY_STATUSES = Object.freeze([
  "DRAFT",
  "NEEDS_REVIEW",
  "PUBLISHED",
  "HIDDEN"
]);

export const SERVICE_MAP_GEOCODING_STATUSES = Object.freeze([
  "PENDING",
  "MATCHED",
  "AMBIGUOUS",
  "FAILED",
  "MANUALLY_CONFIRMED"
]);

const MAX_TEXT_LENGTH = 8_000;
const MAX_SHORT_TEXT_LENGTH = 1_000;
const MAX_LIST_ITEMS = 50;
const MAX_LIST_ITEM_LENGTH = 180;
const MAX_SERVICE_ITEMS = 40;
const MAX_SERVICE_LOCATIONS = 30;
const MAX_PROFILE_SAVE_ATTEMPTS = 3;
const SERVICE_PROVIDER_RAG_COLLECTION_ID = process.env.SERVICE_PROVIDER_RAG_COLLECTION_ID || "service_provider_profiles";

function isRetryableProfileSaveConflict(error) {
  return error?.code === "P2034";
}

function normalizeText(value, maxLength = MAX_SHORT_TEXT_LENGTH) {
  const normalized = String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function normalizeRequiredText(value, fieldName, maxLength = MAX_SHORT_TEXT_LENGTH) {
  const normalized = normalizeText(value, maxLength);
  if (!normalized) {
    const error = new Error(`service_provider_profile.errors.${fieldName}_required`);
    error.status = 400;
    throw error;
  }
  return normalized;
}

function normalizeList(value, options = {}) {
  const maxItems = Number.isFinite(Number(options.maxItems)) ? Math.max(1, Number(options.maxItems)) : MAX_LIST_ITEMS;
  const maxLength = Number.isFinite(Number(options.maxLength)) ? Math.max(1, Number(options.maxLength)) : MAX_LIST_ITEM_LENGTH;
  const source = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[,;\n\r]/)
        .map((part) => part.trim());

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

function normalizeBoolean(value) {
  if (value === true || value === false) return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (["1", "true", "yes", "jah", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "ei", "off"].includes(normalized)) return false;
  return false;
}

function normalizeOptionalBoolean(value) {
  if (value === null || typeof value === "undefined" || String(value).trim() === "") return null;
  return normalizeBoolean(value);
}

function normalizeEnum(value, values, fallback) {
  const normalized = String(value || "").trim().toUpperCase();
  return values.includes(normalized) ? normalized : fallback;
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function uniqueList(values = []) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const normalized = normalizeText(value, MAX_LIST_ITEM_LENGTH);
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase("et");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function normalizeComparableText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("et")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function buildPublicSlug(organizationName, ownerId) {
  const base = slugify(organizationName) || "teenuseosutaja";
  const suffix = String(ownerId || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  return suffix ? `${base}-${suffix}` : base;
}

function isConfirmedLocation(entry) {
  const status = String(entry?.geocodingStatus || "").toUpperCase();
  const latitude = Number(entry?.latitude);
  const longitude = Number(entry?.longitude);
  return (
    ["MATCHED", "MANUALLY_CONFIRMED"].includes(status) &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  );
}

function deriveServiceMapState(profile, currentEntry, options = {}) {
  const profileStatus = String(profile?.status || "DRAFT").toUpperCase();
  const mapVisible = Boolean(profile?.mapVisible);
  const address = normalizeText(profile?.address, MAX_SHORT_TEXT_LENGTH);
  const hasConfirmedServiceLocation = Boolean(options.hasConfirmedServiceLocation);

  if (!mapVisible || profileStatus === "HIDDEN") {
    return {
      status: "HIDDEN",
      geocodingStatus: currentEntry?.geocodingStatus || (address ? "PENDING" : "FAILED")
    };
  }

  if (profileStatus !== "PUBLISHED") {
    return {
      status: "DRAFT",
      geocodingStatus: currentEntry?.geocodingStatus || (address ? "PENDING" : "FAILED")
    };
  }

  if (isConfirmedLocation(currentEntry) || hasConfirmedServiceLocation) {
    return {
      status: "PUBLISHED",
      geocodingStatus: currentEntry?.geocodingStatus || "MATCHED"
    };
  }

  return {
    status: "NEEDS_REVIEW",
    geocodingStatus: address ? currentEntry?.geocodingStatus || "PENDING" : "FAILED"
  };
}

function normalizeSelectedServiceMapLocation(input = {}) {
  const latitude = normalizeNumber(input.latitude);
  const longitude = normalizeNumber(input.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    normalizedAddress: normalizeText(input.normalizedAddress || input.address),
    latitude,
    longitude,
    adsObjectId: normalizeText(input.adsObjectId),
    provider: normalizeText(input.geocodingProvider || input.provider) || "maaruum"
  };
}

function normalizeServiceLocationInput(input = {}, index = 0, profileDefaults = {}) {
  const latitude = normalizeNumber(input.latitude);
  const longitude = normalizeNumber(input.longitude);
  const address = normalizeText(input.address || input.normalizedAddress, MAX_SHORT_TEXT_LENGTH);
  const normalizedAddress = normalizeText(input.normalizedAddress || input.address, MAX_SHORT_TEXT_LENGTH);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  if (!address && !normalizedAddress && !normalizeText(input.label)) return null;
  return {
    clientId: normalizeText(input.clientId || input.id || `location-${index}`, 120) || `location-${index}`,
    label: normalizeText(input.label, MAX_SHORT_TEXT_LENGTH),
    address,
    normalizedAddress,
    county: normalizeText(input.county || profileDefaults.county),
    latitude: hasCoordinates ? latitude : null,
    longitude: hasCoordinates ? longitude : null,
    geocodingStatus: hasCoordinates
      ? "MATCHED"
      : address || normalizedAddress
        ? "PENDING"
        : "FAILED",
    adsObjectId: normalizeText(input.adsObjectId),
    geocodingRaw: hasCoordinates
      ? {
          provider: normalizeText(input.geocodingProvider || input.provider) || "maaruum",
          selected: {
            normalizedAddress,
            latitude,
            longitude,
            adsObjectId: normalizeText(input.adsObjectId)
          }
        }
      : null,
    phone: normalizeText(input.phone),
    email: normalizeText(input.email)?.toLowerCase() || null,
    website: normalizeText(input.website),
    openingHours: normalizeText(input.openingHours, MAX_TEXT_LENGTH),
    accessibilityInfo: normalizeText(input.accessibilityInfo, MAX_TEXT_LENGTH),
    mapVisible: typeof input.mapVisible === "undefined" ? true : normalizeBoolean(input.mapVisible),
    status: normalizeEnum(input.status, SERVICE_PROVIDER_PROFILE_STATUSES, profileDefaults.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"),
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Math.max(0, Math.floor(Number(input.sortOrder))) : index
  };
}

function buildServiceProviderProfileRagDocId(profile = {}) {
  return `service-provider-profile::${profile.id}`;
}

export function serviceProviderProfileRagText(profile = {}) {
  const publishedLocations = (profile.serviceLocations || [])
    .filter((location) => String(location?.status || "PUBLISHED").toUpperCase() === "PUBLISHED" && location.mapVisible !== false);
  const locationNameById = new Map(publishedLocations.map((location, index) => [
    location.id,
    location.label || location.normalizedAddress || location.address || `Teeninduskoht ${index + 1}`
  ]));

  const locationRows = publishedLocations
    .map((location, index) => [
      `Teeninduskoht ${index + 1}: ${location.label || location.normalizedAddress || location.address || "nimetu asukoht"}`,
      location.address ? `Aadress: ${location.address}` : null,
      location.county ? `Maakond: ${location.county}` : null,
      location.phone ? `Telefon: ${location.phone}` : null,
      location.email ? `E-post: ${location.email}` : null,
      location.website ? `Veeb: ${location.website}` : null,
      location.accessibilityInfo ? `Ligipääsetavus: ${location.accessibilityInfo}` : null
    ].filter(Boolean).join("\n"))
    .join("\n\n");

  const serviceRows = (profile.serviceItems || [])
    .filter((service) => String(service?.status || "PUBLISHED").toUpperCase() === "PUBLISHED")
    .map((service, index) => {
      const serviceLocationNames = (service.locationLinks || [])
        .map((link) => locationNameById.get(link.providerLocationId))
        .filter(Boolean);

      return [
        `Teenus ${index + 1}: ${service.name}`,
        service.description ? `Kirjeldus: ${service.description}` : null,
        service.longDescription ? `Pikk kirjeldus: ${service.longDescription}` : null,
        service.includesText ? `Teenuse sisu: ${service.includesText}` : null,
        service.excludesText ? `Teenuse piirangud: ${service.excludesText}` : null,
        service.category ? `Kategooria: ${service.category}` : null,
        service.categories?.length ? `Teenuse kategooriad: ${service.categories.join(", ")}` : null,
        service.ageGroups?.length ? `Vanusegrupid: ${service.ageGroups.join(", ")}` : null,
        service.requesterRoles?.length ? `Poorduja rollid: ${service.requesterRoles.join(", ")}` : null,
        service.needTags?.length ? `Vajadused ja olukorrad: ${service.needTags.join(", ")}` : null,
        service.lifeDomains?.length ? `Eluvaldkonnad: ${service.lifeDomains.join(", ")}` : null,
        service.deliveryModes?.length ? `Osutamise viisid: ${service.deliveryModes.join(", ")}` : null,
        service.targetGroups?.length ? `Sihtrühmad: ${service.targetGroups.join(", ")}` : null,
        service.serviceArea ? `Teeninduspiirkond: ${service.serviceArea}` : null,
        service.serviceAreaType ? `Piirkonna tyyp: ${service.serviceAreaType}` : null,
        service.county ? `Maakond: ${service.county}` : null,
        service.municipalityIds?.length ? `KOV-id voi piirkonnad: ${service.municipalityIds.join(", ")}` : null,
        service.areaDescription ? `Piirkonna tapsustus: ${service.areaDescription}` : null,
        service.serviceLanguages?.length ? `Teenuse keeled: ${service.serviceLanguages.join(", ")}` : null,
        service.inquiryLanguages?.length ? `Poordumise keeled: ${service.inquiryLanguages.join(", ")}` : null,
        service.communicationSupport?.length ? `Suhtlustugi: ${service.communicationSupport.join(", ")}` : null,
        serviceLocationNames.length ? `Teeninduskohad: ${serviceLocationNames.join(", ")}` : null,
        service.feeType ? `Hind: ${service.feeType}` : null,
        (() => {
          const availability = getServiceAvailabilityState(service);
          if (availability.freshness === "fresh") return `Kattesaadavus: ${availability.status}`;
          if (availability.status !== "unknown") return `Kattesaadavuse info (${availability.freshness}): ${availability.status}`;
          return "Kattesaadavus: kinnitamata";
        })(),
        service.availabilityDescription ? `Kattesaadavuse tapsustus: ${service.availabilityDescription}` : null,
        service.availabilityCheckedAt ? `Kattesaadavus kinnitatud: ${service.availabilityCheckedAt.toISOString?.() || service.availabilityCheckedAt}` : null,
        service.directContactAllowed ? `Otsekontakt: ${service.directContactAllowed}` : null,
        service.requiresKovAssessment ? `Vajab KOV hindamist: ${service.requiresKovAssessment}` : null,
        service.requiresKovDecision ? `Vajab KOV otsust: ${service.requiresKovDecision}` : null,
        service.requiresSkaReferral ? `Vajab SKA suunamist: ${service.requiresSkaReferral}` : null,
        service.requiresSpecialistReferral ? `Vajab spetsialisti suunamist: ${service.requiresSpecialistReferral}` : null,
        service.requiredDocumentsNote ? `Vajalikud dokumendid: ${service.requiredDocumentsNote}` : null,
        service.referralNotes ? `Poordumise tingimused: ${service.referralNotes}` : null,
        service.contactMode ? `Kontaktiviis: ${service.contactMode}` : null,
        service.additionalInfo ? `Lisainfo: ${service.additionalInfo}` : null,
        service.priceDescription ? `Hinna täpsustus: ${service.priceDescription}` : null,
        service.contactName ? `Kontaktisik: ${service.contactName}` : null,
        service.phone ? `Telefon: ${service.phone}` : null,
        service.email ? `E-post: ${service.email}` : null,
        service.website ? `Veeb: ${service.website}` : null
      ].filter(Boolean).join("\n");
    })
    .join("\n\n");

  return [
    `Teenuseosutaja: ${profile.organizationName}`,
    profile.organizationType ? `Organisatsiooni tyyp: ${profile.organizationType}` : null,
    profile.registryCode ? `Registrikood: ${profile.registryCode}` : null,
    profile.shortDescription ? `Kirjeldus: ${profile.shortDescription}` : null,
    profile.longDescription ? `Pikk kirjeldus: ${profile.longDescription}` : null,
    profile.serviceCategories?.length ? `Kategooriad: ${profile.serviceCategories.join(", ")}` : null,
    profile.targetGroups?.length ? `Sihtrühmad: ${profile.targetGroups.join(", ")}` : null,
    profile.serviceArea ? `Teeninduspiirkond: ${profile.serviceArea}` : null,
    profile.serviceAreaMunicipalityIds?.length ? `KOV-id või piirkonnad: ${profile.serviceAreaMunicipalityIds.join(", ")}` : null,
    profile.county ? `Maakond: ${profile.county}` : null,
    profile.address ? `Aadress või vastuvõtukoht: ${profile.address}` : null,
    profile.phone ? `Telefon: ${profile.phone}` : null,
    profile.email ? `E-post: ${profile.email}` : null,
    profile.website ? `Veeb: ${profile.website}` : null,
    profile.primaryContactName ? `Pohikontakt: ${profile.primaryContactName}` : null,
    profile.languages?.length ? `Keeled: ${profile.languages.join(", ")}` : null,
    profile.generalAccessibilityNote ? `Ligipaasetavuse tapsustus: ${profile.generalAccessibilityNote}` : null,
    profile.accessibilityInfo ? `Ligipääsetavus: ${profile.accessibilityInfo}` : null,
    profile.feeType ? `Üldine hinnastus: ${profile.feeType}` : null,
    locationRows ? `\nTeeninduskohad:\n${locationRows}` : null,
    serviceRows ? `\nTeenused:\n${serviceRows}` : null
  ].filter(Boolean).join("\n");
}

export function serviceProviderProfileRagMetadata(profile = {}, ragDocId = "") {
  const publishedLocations = (profile.serviceLocations || [])
    .filter((location) => String(location?.status || "PUBLISHED").toUpperCase() === "PUBLISHED" && location.mapVisible !== false);

  return {
    doc_id: ragDocId,
    title: profile.organizationName,
    organization_name: profile.organizationName,
    organization_id: profile.id,
    organization_slug: profile.publicSlug,
    organization_type: "service_provider",
    source_type: "service_provider_profile",
    resource_type: "organization_profile",
    profile_kind: profile.organizationType || null,
    registry_code: profile.registryCode || null,
    assistant_recommendation_allowed: profile.assistantRecommendationAllowed === true,
    collection_id: SERVICE_PROVIDER_RAG_COLLECTION_ID,
    source_url: profile.website || null,
    contact_phone: profile.phone || null,
    contact_email: profile.email || null,
    contact_address: profile.normalizedAddress || profile.address || null,
    county: profile.county || null,
    service_area: profile.serviceArea || null,
    locations: publishedLocations.map((location) => ({
      id: location.id,
      label: location.label,
      address: location.normalizedAddress || location.address,
      county: location.county,
      phone: location.phone,
      email: location.email,
      website: location.website,
      opening_hours: location.openingHours,
      map_visible: location.mapVisible,
      status: location.status
    })),
    services: (profile.serviceItems || []).map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      long_description: service.longDescription,
      includes_text: service.includesText,
      excludes_text: service.excludesText,
      additional_info: service.additionalInfo,
      category: service.category,
      categories: service.categories || [],
      age_groups: service.ageGroups || [],
      target_groups: service.targetGroups || [],
      requester_roles: service.requesterRoles || [],
      need_tags: service.needTags || [],
      life_domains: service.lifeDomains || [],
      delivery_modes: service.deliveryModes || [],
      service_area: service.serviceArea,
      service_area_type: service.serviceAreaType,
      county: service.county,
      municipality_ids: service.municipalityIds || [],
      area_description: service.areaDescription,
      service_languages: service.serviceLanguages || [],
      inquiry_languages: service.inquiryLanguages || [],
      communication_support: service.communicationSupport || [],
      location_ids: (service.locationLinks || []).map((link) => link.providerLocationId).filter(Boolean),
      fee_type: service.feeType,
      price_description: service.priceDescription,
      ...serviceAvailabilityRagFields(service),
      direct_contact_allowed: service.directContactAllowed,
      requires_kov_assessment: service.requiresKovAssessment,
      requires_kov_decision: service.requiresKovDecision,
      requires_ska_referral: service.requiresSkaReferral,
      requires_specialist_referral: service.requiresSpecialistReferral,
      required_documents_note: service.requiredDocumentsNote,
      referral_notes: service.referralNotes,
      contact_mode: service.contactMode,
      accepts_platform_pre_inquiries: service.acceptsPlatformPreInquiries,
      accepts_email_pre_inquiries: service.acceptsEmailPreInquiries,
      map_visible: service.mapVisible,
      status: service.status
    })),
    location_count: publishedLocations.length,
    service_count: (profile.serviceItems || []).length,
    last_checked: profile.checkedAt || profile.updatedAt || new Date().toISOString(),
    language: "et"
  };
}

const serviceProviderProfileFullInclude = {
  serviceMapEntry: true,
  serviceItems: {
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { locationLinks: true }
  },
  serviceLocations: {
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    include: {
      serviceLinks: {
        include: {
          providerService: true
        }
      }
    }
  }
};

async function syncServiceProviderProfileToRag(profile = {}) {
  const ragDocId = buildServiceProviderProfileRagDocId(profile);
  const shouldPublish =
    String(profile.status || "").toUpperCase() === "PUBLISHED" &&
    profile.assistantRecommendationAllowed === true;

  if (!RAG_SERVICE_KEY) {
    return prisma.serviceProviderProfile.update({
      where: { id: profile.id },
      data: {
        ragMetadata: {
          syncStatus: "skipped",
          reason: "rag_key_missing",
          checkedAt: new Date().toISOString()
        }
      },
      include: serviceProviderProfileFullInclude
    });
  }

  if (!shouldPublish) {
    if (profile.ragSourceId) {
      await deleteRagDocument(profile.ragSourceId, {
        route: "service-provider/profile",
        stage: "rag_delete",
        userId: profile.ownerId
      });
    }
    return prisma.serviceProviderProfile.update({
      where: { id: profile.id },
      data: {
        ragSourceId: null,
        ragMetadata: {
          syncStatus: "removed",
          reason: String(profile.status || "").toUpperCase() === "PUBLISHED"
            ? "assistant_recommendation_not_allowed"
            : "profile_not_published",
          checkedAt: new Date().toISOString()
        }
      },
      include: serviceProviderProfileFullInclude
    });
  }

  const metadata = serviceProviderProfileRagMetadata(profile, ragDocId);
  const response = await ragServiceRequest(
    "/ingest/text",
    {
      method: "POST",
      headers: buildRagHeaders("application/json", {
        route: "service-provider/profile",
        stage: "rag_ingest",
        userId: profile.ownerId
      }),
      body: JSON.stringify({
        doc_id: ragDocId,
        text: serviceProviderProfileRagText(profile),
        metadata
      })
    },
    "service_provider_profile.errors.rag_sync_failed"
  );

  return prisma.serviceProviderProfile.update({
    where: { id: profile.id },
    data: {
      ragSourceId: ragDocId,
      ragMetadata: {
        ...metadata,
        syncStatus: "synced",
        inserted: response?.inserted ?? null,
        checkedAt: new Date().toISOString()
      }
    },
    include: serviceProviderProfileFullInclude
  });
}

function hasAddressChanged(profile, currentEntry) {
  const nextAddress = normalizeComparableText(profile?.normalizedAddress || profile?.address);
  const previousAddress = normalizeComparableText(currentEntry?.normalizedAddress || currentEntry?.address);
  return nextAddress !== previousAddress;
}

function serviceMapLocationPatch(profile, currentEntry, selectedLocation, now) {
  const address = normalizeText(profile?.address);
  if (selectedLocation) {
    return {
      normalizedAddress: selectedLocation.normalizedAddress || profile.normalizedAddress || address,
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      adsObjectId: selectedLocation.adsObjectId,
      geocodingStatus: "MATCHED",
      geocodingRaw: {
        provider: selectedLocation.provider,
        rawAddress: address,
        result: {
          normalizedAddress: selectedLocation.normalizedAddress,
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          adsObjectId: selectedLocation.adsObjectId
        },
        checkedAt: now.toISOString(),
        source: "service_provider_profile_address_suggestion"
      }
    };
  }

  if (hasAddressChanged(profile, currentEntry)) {
    return {
      normalizedAddress: profile.normalizedAddress || address,
      latitude: null,
      longitude: null,
      adsObjectId: null,
      geocodingStatus: address ? "PENDING" : "FAILED",
      geocodingRaw: null
    };
  }

  return {
    normalizedAddress: profile.normalizedAddress || currentEntry?.normalizedAddress || address,
    latitude: currentEntry?.latitude ?? null,
    longitude: currentEntry?.longitude ?? null,
    adsObjectId: currentEntry?.adsObjectId || null,
    geocodingStatus: currentEntry?.geocodingStatus || (address ? "PENDING" : "FAILED"),
    geocodingRaw: currentEntry?.geocodingRaw || null
  };
}

export function normalizeServiceProviderProfileInput(input = {}) {
  const organizationName = normalizeRequiredText(input.organizationName, "organization_name");
  const status = normalizeEnum(input.status, SERVICE_PROVIDER_PROFILE_STATUSES, "DRAFT");
  const feeType = normalizeEnum(input.feeType, SERVICE_PROVIDER_FEE_TYPES, "UNKNOWN");

  return {
    organizationName,
    organizationType: normalizeText(input.organizationType),
    registryCode: normalizeText(input.registryCode),
    shortDescription: normalizeText(input.shortDescription, MAX_TEXT_LENGTH),
    longDescription: normalizeText(input.longDescription, MAX_TEXT_LENGTH),
    services: normalizeList(input.services),
    serviceCategories: normalizeList(input.serviceCategories),
    targetGroups: normalizeList(input.targetGroups),
    serviceArea: normalizeText(input.serviceArea, MAX_TEXT_LENGTH),
    serviceAreaMunicipalityIds: normalizeList(input.serviceAreaMunicipalityIds),
    county: normalizeText(input.county),
    address: normalizeText(input.address),
    normalizedAddress: normalizeText(input.normalizedAddress),
    phone: normalizeText(input.phone),
    email: normalizeText(input.email)?.toLowerCase() || null,
    website: normalizeText(input.website),
    primaryContactName: normalizeText(input.primaryContactName),
    languages: normalizeList(input.languages),
    accessibilityInfo: normalizeText(input.accessibilityInfo, MAX_TEXT_LENGTH),
    generalAccessibilityNote: normalizeText(input.generalAccessibilityNote, MAX_TEXT_LENGTH),
    feeType,
    mapVisible: normalizeBoolean(input.mapVisible),
    acceptsPlatformPreInquiries: normalizeBoolean(input.acceptsPlatformPreInquiries),
    acceptsEmailPreInquiries: normalizeBoolean(input.acceptsEmailPreInquiries),
    assistantRecommendationAllowed: normalizeBoolean(input.assistantRecommendationAllowed),
    status
  };
}

export function normalizeServiceProviderServiceInput(input = {}, index = 0, profileDefaults = {}, existingService = null) {
  const name = normalizeText(input.name || input.title, MAX_SHORT_TEXT_LENGTH);
  if (!name) return null;

  return {
    clientId: normalizeText(input.id || input.clientId, 120),
    name,
    description: normalizeText(input.description, MAX_TEXT_LENGTH),
    longDescription: normalizeText(input.longDescription, MAX_TEXT_LENGTH),
    includesText: normalizeText(input.includesText, MAX_TEXT_LENGTH),
    excludesText: normalizeText(input.excludesText, MAX_TEXT_LENGTH),
    additionalInfo: normalizeText(input.additionalInfo, MAX_TEXT_LENGTH),
    category: normalizeText(input.category || input.serviceCategory, MAX_SHORT_TEXT_LENGTH),
    categories: normalizeList(input.categories),
    ageGroups: normalizeList(input.ageGroups),
    targetGroups: normalizeList(input.targetGroups),
    requesterRoles: normalizeList(input.requesterRoles),
    needTags: normalizeList(input.needTags),
    lifeDomains: normalizeList(input.lifeDomains),
    deliveryModes: normalizeList(input.deliveryModes),
    serviceArea: normalizeText(input.serviceArea, MAX_TEXT_LENGTH),
    serviceAreaType: normalizeText(input.serviceAreaType),
    county: normalizeText(input.county || profileDefaults.county),
    municipalityIds: normalizeList(input.municipalityIds, { maxItems: MAX_LIST_ITEMS, maxLength: 120 }),
    areaDescription: normalizeText(input.areaDescription, MAX_TEXT_LENGTH),
    serviceLanguages: normalizeList(input.serviceLanguages),
    inquiryLanguages: normalizeList(input.inquiryLanguages),
    communicationSupport: normalizeList(input.communicationSupport),
    feeType: normalizeEnum(input.feeType || input.priceType, SERVICE_PROVIDER_FEE_TYPES, profileDefaults.feeType || "UNKNOWN"),
    priceDescription: normalizeText(input.priceDescription || input.priceInfo, MAX_TEXT_LENGTH),
    availabilityStatus: normalizeAvailabilityStatusForWrite(input.availabilityStatus, existingService),
    availabilityDescription: normalizeServiceAvailabilityDescription(input.availabilityDescription),
    directContactAllowed: normalizeText(input.directContactAllowed),
    requiresKovAssessment: normalizeText(input.requiresKovAssessment),
    requiresKovDecision: normalizeText(input.requiresKovDecision),
    requiresSkaReferral: normalizeText(input.requiresSkaReferral),
    requiresSpecialistReferral: normalizeText(input.requiresSpecialistReferral),
    requiredDocumentsNote: normalizeText(input.requiredDocumentsNote, MAX_TEXT_LENGTH),
    referralNotes: normalizeText(input.referralNotes, MAX_TEXT_LENGTH),
    contactMode: normalizeText(input.contactMode),
    contactName: normalizeText(input.contactName),
    phone: normalizeText(input.phone),
    email: normalizeText(input.email)?.toLowerCase() || null,
    website: normalizeText(input.website),
    locationIds: normalizeList(input.locationIds || input.locationClientIds, { maxItems: MAX_SERVICE_LOCATIONS, maxLength: 120 }),
    acceptsPlatformPreInquiries: normalizeOptionalBoolean(input.acceptsPlatformPreInquiries),
    acceptsEmailPreInquiries: normalizeOptionalBoolean(input.acceptsEmailPreInquiries),
    mapVisible: typeof input.mapVisible === "undefined" ? true : normalizeBoolean(input.mapVisible),
    status: normalizeEnum(input.status, SERVICE_PROVIDER_PROFILE_STATUSES, profileDefaults.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"),
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Math.max(0, Math.floor(Number(input.sortOrder))) : index
  };
}

export function normalizeServiceProviderLocationsInput(input = {}, profileDefaults = {}) {
  const rawItems = Array.isArray(input.serviceLocations)
    ? input.serviceLocations
    : Array.isArray(input.locations)
      ? input.locations
      : [];
  return rawItems
    .slice(0, MAX_SERVICE_LOCATIONS)
    .map((item, index) => normalizeServiceLocationInput(item, index, profileDefaults))
    .filter(Boolean);
}

export function normalizeServiceProviderServicesInput(input = {}, profileDefaults = {}, existingServicesById = new Map()) {
  const rawItems = Array.isArray(input.serviceItems)
    ? input.serviceItems
    : Array.isArray(input.servicesDetailed)
      ? input.servicesDetailed
      : [];

  const items = rawItems
    .slice(0, MAX_SERVICE_ITEMS)
    .map((item, index) => {
      const clientId = normalizeText(item?.id || item?.clientId, 120);
      return normalizeServiceProviderServiceInput(item, index, profileDefaults, existingServicesById.get(clientId) || null);
    })
    .filter(Boolean);

  if (items.length) return items;

  return normalizeList(input.services)
    .slice(0, MAX_SERVICE_ITEMS)
    .map((name, index) => normalizeServiceProviderServiceInput({
      name,
      feeType: profileDefaults.feeType,
      status: profileDefaults.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      sortOrder: index
    }, index, profileDefaults))
    .filter(Boolean);
}

export function serializeServiceMapEntry(entry) {
  if (!entry) return null;
  const accessPath = normalizeServiceMapAccessPath(entry.accessPath);
  return {
    id: entry.id,
    type: entry.type,
    title: entry.title,
    description: entry.description,
    municipalityId: entry.municipalityId,
    municipalityName: entry.municipalityName,
    county: entry.county,
    address: entry.address,
    normalizedAddress: entry.normalizedAddress,
    phone: entry.phone,
    email: entry.email,
    website: entry.website,
    sourceUrl: entry.sourceUrl,
    sourceDocId: entry.sourceDocId,
    checkedAt: entry.checkedAt,
    accessPath,
    hasAccessPath: serviceMapAccessPathHasDetails(accessPath),
    providerProfileId: entry.providerProfileId,
    status: entry.status,
    geocodingStatus: entry.geocodingStatus,
    latitude: entry.latitude,
    longitude: entry.longitude,
    adsObjectId: entry.adsObjectId,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

export function serializeServiceProviderProfile(profile, options = {}) {
  if (!profile) return null;
  return {
    id: profile.id,
    ownerId: profile.ownerId,
    organizationName: profile.organizationName,
    organizationType: profile.organizationType,
    registryCode: profile.registryCode,
    shortDescription: profile.shortDescription,
    longDescription: profile.longDescription,
    services: profile.services || [],
    serviceCategories: profile.serviceCategories || [],
    targetGroups: profile.targetGroups || [],
    serviceArea: profile.serviceArea,
    serviceAreaMunicipalityIds: profile.serviceAreaMunicipalityIds || [],
    county: profile.county,
    address: profile.address,
    normalizedAddress: profile.normalizedAddress,
    phone: profile.phone,
    email: profile.email,
    website: profile.website,
    primaryContactName: profile.primaryContactName,
    languages: profile.languages || [],
    accessibilityInfo: profile.accessibilityInfo,
    generalAccessibilityNote: profile.generalAccessibilityNote,
    feeType: profile.feeType,
    mapVisible: profile.mapVisible,
    acceptsPlatformPreInquiries: profile.acceptsPlatformPreInquiries,
    acceptsEmailPreInquiries: profile.acceptsEmailPreInquiries,
    assistantRecommendationAllowed: profile.assistantRecommendationAllowed,
    status: profile.status,
    publicSlug: profile.publicSlug,
    publishedAt: profile.publishedAt,
    hiddenAt: profile.hiddenAt,
    checkedAt: profile.checkedAt,
    ragSourceId: profile.ragSourceId,
    ragMetadata: profile.ragMetadata,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    serviceMapEntry: serializeServiceMapEntry(profile.serviceMapEntry),
    serviceItems: Array.isArray(profile.serviceItems)
      ? profile.serviceItems.map((item) => ({
          id: item.id,
          providerProfileId: item.providerProfileId,
          /* A4: seos loakataloogiga on liidesele NÄHTAV, aga mitte muudetav —
             server ei loe teda PUT-ist, vaid säilitab varasema väärtuse. */
          serviceKey: item.serviceKey || null,
          name: item.name,
          description: item.description,
          longDescription: item.longDescription,
          includesText: item.includesText,
          excludesText: item.excludesText,
          additionalInfo: item.additionalInfo,
          category: item.category,
          categories: item.categories || [],
          ageGroups: item.ageGroups || [],
          targetGroups: item.targetGroups || [],
          requesterRoles: item.requesterRoles || [],
          needTags: item.needTags || [],
          lifeDomains: item.lifeDomains || [],
          deliveryModes: item.deliveryModes || [],
          serviceArea: item.serviceArea,
          serviceAreaType: item.serviceAreaType,
          county: item.county,
          municipalityIds: item.municipalityIds || [],
          areaDescription: item.areaDescription,
          serviceLanguages: item.serviceLanguages || [],
          inquiryLanguages: item.inquiryLanguages || [],
          communicationSupport: item.communicationSupport || [],
          feeType: item.feeType,
          priceDescription: item.priceDescription,
          availabilityStatus: item.availabilityStatus,
          availabilityDescription: item.availabilityDescription,
          availabilityCheckedAt: item.availabilityCheckedAt,
          availabilityReminderSentAt: options.includeAvailabilityOperations ? item.availabilityReminderSentAt : undefined,
          availability: serializePublicServiceAvailability(item),
          availabilityFingerprint: options.includeAvailabilityOperations ? serviceAvailabilityFingerprint(item) : undefined,
          directContactAllowed: item.directContactAllowed,
          requiresKovAssessment: item.requiresKovAssessment,
          requiresKovDecision: item.requiresKovDecision,
          requiresSkaReferral: item.requiresSkaReferral,
          requiresSpecialistReferral: item.requiresSpecialistReferral,
          requiredDocumentsNote: item.requiredDocumentsNote,
          referralNotes: item.referralNotes,
          contactMode: item.contactMode,
          contactName: item.contactName,
          phone: item.phone,
          email: item.email,
          website: item.website,
          locationIds: Array.isArray(item.locationLinks)
            ? item.locationLinks.map((link) => link.providerLocationId).filter(Boolean)
            : [],
          acceptsPlatformPreInquiries: item.acceptsPlatformPreInquiries,
          acceptsEmailPreInquiries: item.acceptsEmailPreInquiries,
          mapVisible: item.mapVisible,
          status: item.status,
          sortOrder: item.sortOrder,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        }))
      : [],
    serviceLocations: Array.isArray(profile.serviceLocations)
      ? profile.serviceLocations.map((location) => ({
          id: location.id,
          providerProfileId: location.providerProfileId,
          label: location.label,
          address: location.address,
          normalizedAddress: location.normalizedAddress,
          county: location.county,
          latitude: location.latitude,
          longitude: location.longitude,
          geocodingStatus: location.geocodingStatus,
          adsObjectId: location.adsObjectId,
          geocodingProvider: location.geocodingRaw?.provider || "",
          phone: location.phone,
          email: location.email,
          website: location.website,
          openingHours: location.openingHours,
          accessibilityInfo: location.accessibilityInfo,
          mapVisible: location.mapVisible,
          status: location.status,
          sortOrder: location.sortOrder,
          serviceIds: Array.isArray(location.serviceLinks)
            ? location.serviceLinks.map((link) => link.providerServiceId).filter(Boolean)
            : [],
          createdAt: location.createdAt,
          updatedAt: location.updatedAt
        }))
      : []
  };
}

/* T25 viil C (E8): `ownerId` EI OLE enam globaalselt unikaalne — tema piirang
   on osaline ja kehtib ainult SOLO-režiimis (organisatsiooni profiil võib
   `ownerId` päritoluna alles hoida). Seepärast `findFirst` + selgesõnaline
   `ownershipMode: "SOLO"`, mitte `findUnique`.
   See funktsioon on ja jääb SOLO-profiili omaniku rajaks: organisatsiooni
   profiili loetakse `lib/org/serviceProfile.js` kaudu capability-kontrolliga. */
export async function getServiceProviderProfileForOwner(ownerId) {
  if (!ownerId) return null;
  return prisma.serviceProviderProfile.findFirst({
    where: { ownerId, ownershipMode: "SOLO" },
    include: serviceProviderProfileFullInclude
  });
}

export async function upsertServiceProviderProfileForOwner(ownerId, input) {
  if (!ownerId) {
    const error = new Error("api.common.unauthorized");
    error.status = 401;
    throw error;
  }

  const normalizedBase = normalizeServiceProviderProfileInput(input);
  const serviceLocations = normalizeServiceProviderLocationsInput(input, normalizedBase);
  const selectedLocation = normalizeSelectedServiceMapLocation(input);
  const now = new Date();
  let savedProfile = null;

  for (let attempt = 1; attempt <= MAX_PROFILE_SAVE_ATTEMPTS; attempt += 1) {
    try {
      savedProfile = await prisma.$transaction(async (tx) => {
        // Read the availability state inside the serializable transaction. This
        // makes a concurrent one-click confirmation conflict with the profile
        // rewrite instead of silently replacing a newer checked timestamp.
        const existing = await tx.serviceProviderProfile.findFirst({
          where: { ownerId, ownershipMode: "SOLO" },
          include: serviceProviderProfileFullInclude
        });
        const existingServicesById = new Map((existing?.serviceItems || []).map((service) => [service.id, service]));
        const serviceItems = normalizeServiceProviderServicesInput(input, normalizedBase, existingServicesById);
        const normalized = {
          ...normalizedBase,
          services: uniqueList([
            ...normalizedBase.services,
            ...serviceItems.map((item) => item.name)
          ])
        };
        const nextPublishedAt =
          normalized.status === "PUBLISHED"
            ? existing?.publishedAt || now
            : existing?.publishedAt || null;
        const nextHiddenAt =
          normalized.status === "HIDDEN"
            ? existing?.hiddenAt || now
            : normalized.status === "PUBLISHED"
              ? null
              : existing?.hiddenAt || null;
        const publicSlug = existing?.publicSlug || buildPublicSlug(normalized.organizationName, ownerId);

        /* `upsert` nõuab UNIKAALSET `where`-i; osalise unikaalsuse tõttu
           seda enam ei ole. Jaotame ta selgeks update-VÕI-create paariks.
           See on ohutu, sest kogu plokk jookseb juba `Serializable`
           tehingus — kaks samaaegset salvestust ei saa mõlemad luua. */
        const profileData = {
          ...normalized,
          publicSlug,
          publishedAt: nextPublishedAt,
          hiddenAt: nextHiddenAt,
          checkedAt: now
        };
        const profile = existing
          ? await tx.serviceProviderProfile.update({
              where: { id: existing.id },
              data: profileData,
              include: { serviceMapEntry: true }
            })
          : await tx.serviceProviderProfile.create({
              data: { ownerId, ownershipMode: "SOLO", ...profileData },
              include: { serviceMapEntry: true }
            });

    /* NB teenuseridu EI kustutata siin: nad uuendatakse allpool kohapeal, et
       loahinnang kaskaadis ei hävineks. Tegevuskohtade read on endiselt
       täisasendus — nende küljes ei ripu midagi, mis peaks üle elama. */
    await tx.serviceProviderLocation.deleteMany({
      where: { providerProfileId: profile.id }
    });

    const locationIdByClientId = new Map();
    for (const item of serviceLocations) {
      const { clientId, ...locationData } = item;
      const location = await tx.serviceProviderLocation.create({
        data: {
          ...locationData,
          providerProfileId: profile.id
        }
      });
      locationIdByClientId.set(clientId, location.id);
    }

    /* A4: olemasolevat teenuserida UUENDATAKSE kohapeal, mitte ei kustutata ja
       looda uuesti. Vana `delete + create` hävitas kaskaadis kogu
       `ServiceLicenceAssessment` kirje — osutaja kaotanuks tegevusloa märgise
       iga kord, kui ta parandas telefoninumbri või kirjelduse kirjavea.
       Sama ID taasloomine ei taasta juba kustutatud hinnangut, seega
       `serviceKey` säilitamisest üksi EI PIISANUD. Alles jäetakse ainult need
       read, mis vormist tagasi tulid; ülejäänud kustutatakse lõpus. */
    const retainedServiceIds = [];
    for (const item of serviceItems) {
      const { clientId, locationIds, ...serviceData } = item;
      const previous = clientId ? existingServicesById.get(clientId) : null;
      const availabilityChanged = !previous ||
        previous.availabilityStatus !== serviceData.availabilityStatus ||
        normalizeServiceAvailabilityDescription(previous.availabilityDescription) !== serviceData.availabilityDescription;
      const hasCanonicalAvailability = isCanonicalServiceAvailabilityStatus(serviceData.availabilityStatus);
      const availabilityFields = {
        availabilityCheckedAt: hasCanonicalAvailability
          ? availabilityChanged
            ? now
            : previous?.availabilityCheckedAt || null
          : availabilityChanged
            ? null
            : previous?.availabilityCheckedAt || null,
        availabilityReminderSentAt: availabilityChanged
          ? null
          : previous?.availabilityReminderSentAt || null
      };

      const service = previous?.id
        ? await tx.serviceProviderService.update({
            where: { id: previous.id },
            /* `serviceKey` jääb siit VÄLJA: teda muudetakse ainult eraldi
               sidumisoperatsiooniga, mitte profiilivormi kaudu. */
            data: { ...serviceData, ...availabilityFields }
          })
        : await tx.serviceProviderService.create({
            data: { ...serviceData, ...availabilityFields, serviceKey: null, providerProfileId: profile.id }
          });
      retainedServiceIds.push(service.id);

      /* Tegevuskoha lingid ehitatakse iga salvestusega uuesti — need on
         puhas seosetabel ja neil ei ripu midagi küljes. */
      await tx.serviceProviderServiceLocation.deleteMany({ where: { providerServiceId: service.id } });
      const linkedLocationIds = uniqueList(locationIds)
        .map((locationId) => locationIdByClientId.get(locationId) || locationId)
        .filter((locationId) => [...locationIdByClientId.values()].includes(locationId));
      if (linkedLocationIds.length) {
        await tx.serviceProviderServiceLocation.createMany({
          data: linkedLocationIds.map((providerLocationId) => ({
            providerServiceId: service.id,
            providerLocationId
          })),
          skipDuplicates: true
        });
      }
    }

    /* Vormilt eemaldatud teenused kustuvad koos oma hinnanguga — see on õige:
       teenust ei ole enam olemas. */
    await tx.serviceProviderService.deleteMany({
      where: { providerProfileId: profile.id, id: { notIn: retainedServiceIds.length ? retainedServiceIds : ["__none__"] } }
    });

    const hasConfirmedServiceLocation = serviceLocations.some((location) =>
      location.mapVisible !== false &&
      String(location.status || "PUBLISHED").toUpperCase() === "PUBLISHED" &&
      isConfirmedLocation(location)
    );
    const locationPatch = serviceMapLocationPatch(profile, profile.serviceMapEntry, selectedLocation, now);
    const mapState = deriveServiceMapState(profile, {
      ...profile.serviceMapEntry,
      ...locationPatch
    }, { hasConfirmedServiceLocation });
    await tx.serviceMapEntry.upsert({
      where: { providerProfileId: profile.id },
      create: {
        providerProfileId: profile.id,
        type: "SERVICE_PROVIDER",
        title: profile.organizationName,
        description: profile.shortDescription,
        county: profile.county,
        address: profile.address,
        normalizedAddress: locationPatch.normalizedAddress,
        phone: profile.phone,
        email: profile.email,
        website: profile.website,
        checkedAt: now,
        status: mapState.status,
        geocodingStatus: mapState.geocodingStatus,
        latitude: locationPatch.latitude,
        longitude: locationPatch.longitude,
        adsObjectId: locationPatch.adsObjectId,
        geocodingRaw: locationPatch.geocodingRaw
      },
      update: {
        title: profile.organizationName,
        description: profile.shortDescription,
        county: profile.county,
        address: profile.address,
        normalizedAddress: locationPatch.normalizedAddress,
        phone: profile.phone,
        email: profile.email,
        website: profile.website,
        checkedAt: now,
        status: mapState.status,
        geocodingStatus: mapState.geocodingStatus,
        latitude: locationPatch.latitude,
        longitude: locationPatch.longitude,
        adsObjectId: locationPatch.adsObjectId,
        geocodingRaw: locationPatch.geocodingRaw
      }
    });

        return tx.serviceProviderProfile.findUnique({
          where: { id: profile.id },
          include: serviceProviderProfileFullInclude
        });
      }, { isolationLevel: "Serializable" });
      break;
    } catch (error) {
      if (!isRetryableProfileSaveConflict(error) || attempt === MAX_PROFILE_SAVE_ATTEMPTS) {
        throw error;
      }
    }
  }

  try {
    return await syncServiceProviderProfileToRag(savedProfile);
  } catch (error) {
    console.error("[service-provider-profile] RAG sync failed", {
      profileId: savedProfile?.id,
      error: error?.message || String(error)
    });
    return prisma.serviceProviderProfile.update({
      where: { id: savedProfile.id },
      data: {
        ragMetadata: {
          syncStatus: "failed",
          message: String(error?.message || error),
          checkedAt: new Date().toISOString()
        }
      },
      include: serviceProviderProfileFullInclude
    });
  }
}

export async function listPublishedServiceMapEntries({
  keyword = "",
  municipalityId = "",
  municipalityName = "",
  county = "",
  type = "",
  includeUnlocated = false,
  includeNeedsReview = false,
  limit = 200
} = {}) {
  const filters = {
    status: includeNeedsReview ? { in: ["PUBLISHED", "NEEDS_REVIEW"] } : "PUBLISHED"
  };

  if (!includeUnlocated) {
    filters.AND = [
      ...(filters.AND || []),
      {
        OR: [
          {
            geocodingStatus: { in: ["MATCHED", "MANUALLY_CONFIRMED"] },
            latitude: { not: null },
            longitude: { not: null }
          },
          {
            providerProfile: {
              is: {
                serviceLocations: {
                  some: {
                    mapVisible: true,
                    status: "PUBLISHED",
                    geocodingStatus: { in: ["MATCHED", "MANUALLY_CONFIRMED"] },
                    latitude: { not: null },
                    longitude: { not: null }
                  }
                }
              }
            }
          }
        ]
      }
    ];
  }

  const normalizedTypes = serviceMapEntryTypesFromFilter(type);
  if (normalizedTypes.length === 1) {
    filters.type = normalizedTypes[0];
  } else if (normalizedTypes.length > 1) {
    filters.type = { in: normalizedTypes };
  }

  const normalizedMunicipalityId = normalizeText(municipalityId);
  if (normalizedMunicipalityId) filters.municipalityId = normalizedMunicipalityId;

  const normalizedMunicipalityName = normalizeText(municipalityName);
  if (normalizedMunicipalityName) {
    filters.municipalityName = {
      contains: normalizedMunicipalityName,
      mode: "insensitive"
    };
  }

  const normalizedCounty = normalizeText(county);
  if (normalizedCounty) {
    filters.AND = [
      ...(filters.AND || []),
      {
        OR: [
          { county: { contains: normalizedCounty, mode: "insensitive" } },
          { providerProfile: { is: { serviceLocations: { some: { mapVisible: true, status: "PUBLISHED", county: { contains: normalizedCounty, mode: "insensitive" } } } } } },
          { providerProfile: { is: { serviceLocations: { some: { mapVisible: true, status: "PUBLISHED", address: { contains: normalizedCounty, mode: "insensitive" } } } } } },
          { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", serviceArea: { contains: normalizedCounty, mode: "insensitive" } } } } } }
        ]
      }
    ];
  }

  const normalizedKeyword = normalizeText(keyword);
  if (normalizedKeyword) {
    filters.OR = [
      { title: { contains: normalizedKeyword, mode: "insensitive" } },
      { description: { contains: normalizedKeyword, mode: "insensitive" } },
      { address: { contains: normalizedKeyword, mode: "insensitive" } },
      { providerProfile: { is: { services: { has: normalizedKeyword } } } },
      { providerProfile: { is: { serviceCategories: { has: normalizedKeyword } } } },
      { providerProfile: { is: { targetGroups: { has: normalizedKeyword } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", name: { contains: normalizedKeyword, mode: "insensitive" } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", description: { contains: normalizedKeyword, mode: "insensitive" } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", longDescription: { contains: normalizedKeyword, mode: "insensitive" } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", includesText: { contains: normalizedKeyword, mode: "insensitive" } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", excludesText: { contains: normalizedKeyword, mode: "insensitive" } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", additionalInfo: { contains: normalizedKeyword, mode: "insensitive" } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", category: { contains: normalizedKeyword, mode: "insensitive" } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", categories: { has: normalizedKeyword } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", ageGroups: { has: normalizedKeyword } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", targetGroups: { has: normalizedKeyword } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", requesterRoles: { has: normalizedKeyword } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", needTags: { has: normalizedKeyword } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", lifeDomains: { has: normalizedKeyword } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", deliveryModes: { has: normalizedKeyword } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", serviceAreaType: { contains: normalizedKeyword, mode: "insensitive" } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", county: { contains: normalizedKeyword, mode: "insensitive" } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", municipalityIds: { has: normalizedKeyword } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", areaDescription: { contains: normalizedKeyword, mode: "insensitive" } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", serviceLanguages: { has: normalizedKeyword } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", inquiryLanguages: { has: normalizedKeyword } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", communicationSupport: { has: normalizedKeyword } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", availabilityStatus: { contains: normalizedKeyword, mode: "insensitive" } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", availabilityDescription: { contains: normalizedKeyword, mode: "insensitive" } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", referralNotes: { contains: normalizedKeyword, mode: "insensitive" } } } } } },
      { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", requiredDocumentsNote: { contains: normalizedKeyword, mode: "insensitive" } } } } } },
      { providerProfile: { is: { serviceLocations: { some: { mapVisible: true, status: "PUBLISHED", label: { contains: normalizedKeyword, mode: "insensitive" } } } } } },
      { providerProfile: { is: { serviceLocations: { some: { mapVisible: true, status: "PUBLISHED", address: { contains: normalizedKeyword, mode: "insensitive" } } } } } },
      { providerProfile: { is: { serviceLocations: { some: { mapVisible: true, status: "PUBLISHED", normalizedAddress: { contains: normalizedKeyword, mode: "insensitive" } } } } } },
      { providerProfile: { is: { serviceLocations: { some: { mapVisible: true, status: "PUBLISHED", county: { contains: normalizedKeyword, mode: "insensitive" } } } } } }
    ];
  }

  const take = Math.max(1, Math.min(Number(limit) || 200, 2000));
  const entries = await prisma.serviceMapEntry.findMany({
    where: filters,
    take,
    orderBy: [{ type: "asc" }, { title: "asc" }],
    include: {
      providerProfile: {
        include: {
          serviceItems: {
            where: {
              mapVisible: true,
              status: "PUBLISHED"
            },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            include: {
              locationLinks: true,
              /* A4: avaliku märgise arvutamiseks on vaja KOGU hinnangut, mitte
                 ainult seisu — aegumine ja kaetus otsustavad, mida tohib
                 näidata. Tõendi kuupäev tuleb `statusSource`-ist, mitte
                 viimasest katsest. */
              licenceAssessment: {
                select: {
                  publicStatus: true,
                  coverage: true,
                  publicStatusValidUntil: true,
                  activityExpected: true,
                  statusSource: { select: { verifiedAt: true } }
                }
              }
            }
          },
          serviceLocations: {
            orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
            include: {
              serviceLinks: {
                include: {
                  providerService: true
                }
              }
            }
          }
        }
      },
      municipality: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          county: true
        }
      }
    }
  });

  return entries.flatMap((entry) => splitServiceLocationMapEntries({
    ...serializeServiceMapEntry(entry),
    providerProfile: entry.providerProfile
      ? {
          id: entry.providerProfile.id,
          organizationName: entry.providerProfile.organizationName,
          organizationType: entry.providerProfile.organizationType,
          registryCode: entry.providerProfile.registryCode,
          shortDescription: entry.providerProfile.shortDescription,
          longDescription: entry.providerProfile.longDescription,
          services: entry.providerProfile.services || [],
          serviceCategories: entry.providerProfile.serviceCategories || [],
          targetGroups: entry.providerProfile.targetGroups || [],
          serviceArea: entry.providerProfile.serviceArea,
          primaryContactName: entry.providerProfile.primaryContactName,
          generalAccessibilityNote: entry.providerProfile.generalAccessibilityNote,
          assistantRecommendationAllowed: entry.providerProfile.assistantRecommendationAllowed,
          serviceItems: (entry.providerProfile.serviceItems || []).map((item) => ({
            id: item.id,
            /* A4: avalik tegevusloa märgis. Teksti ja tooni otsustab
               `lib/mtr/statusText.js`, mitte see serialiseerija ega vaade —
               ja aegunud positiivne väide langeb seal ise „ei saanud
               kinnitada" peale. `null` tähendab sidumata teenust: silti ei
               ole ja seda ei tohi tõlgendada kummaski suunas. */
            licenceBadge: publicLicenceBadge(item.licenceAssessment, { now: new Date() }),
            name: item.name,
            description: item.description,
            longDescription: item.longDescription,
            includesText: item.includesText,
            excludesText: item.excludesText,
            additionalInfo: item.additionalInfo,
            category: item.category,
            categories: item.categories || [],
            ageGroups: item.ageGroups || [],
            targetGroups: item.targetGroups || [],
            requesterRoles: item.requesterRoles || [],
            needTags: item.needTags || [],
            lifeDomains: item.lifeDomains || [],
            deliveryModes: item.deliveryModes || [],
            serviceArea: item.serviceArea,
            serviceAreaType: item.serviceAreaType,
            county: item.county,
            municipalityIds: item.municipalityIds || [],
            areaDescription: item.areaDescription,
            serviceLanguages: item.serviceLanguages || [],
            inquiryLanguages: item.inquiryLanguages || [],
            communicationSupport: item.communicationSupport || [],
            feeType: item.feeType,
            priceDescription: item.priceDescription,
            availabilityStatus: item.availabilityStatus,
            availabilityDescription: item.availabilityDescription,
            availabilityCheckedAt: item.availabilityCheckedAt,
            availability: serializePublicServiceAvailability(item),
            directContactAllowed: item.directContactAllowed,
            requiresKovAssessment: item.requiresKovAssessment,
            requiresKovDecision: item.requiresKovDecision,
            requiresSkaReferral: item.requiresSkaReferral,
            requiresSpecialistReferral: item.requiresSpecialistReferral,
            requiredDocumentsNote: item.requiredDocumentsNote,
            referralNotes: item.referralNotes,
            contactMode: item.contactMode,
            contactName: item.contactName,
            phone: item.phone,
            email: item.email,
            website: item.website,
            locationIds: (item.locationLinks || []).map((link) => link.providerLocationId).filter(Boolean),
            acceptsPlatformPreInquiries: item.acceptsPlatformPreInquiries,
            acceptsEmailPreInquiries: item.acceptsEmailPreInquiries,
            mapVisible: item.mapVisible,
            status: item.status,
            sortOrder: item.sortOrder
          })),
          serviceLocations: (entry.providerProfile.serviceLocations || []).map((location) => ({
            id: location.id,
            label: location.label,
            address: location.address,
            normalizedAddress: location.normalizedAddress,
            county: location.county,
            latitude: location.latitude,
            longitude: location.longitude,
            geocodingStatus: location.geocodingStatus,
            adsObjectId: location.adsObjectId,
            phone: location.phone,
            email: location.email,
            website: location.website,
            openingHours: location.openingHours,
            accessibilityInfo: location.accessibilityInfo,
            mapVisible: location.mapVisible,
            status: location.status,
            sortOrder: location.sortOrder,
            serviceLinks: (location.serviceLinks || []).map((link) => ({
              providerServiceId: link.providerServiceId,
              providerLocationId: link.providerLocationId,
              providerService: link.providerService
            }))
          })),
          publicSlug: entry.providerProfile.publicSlug
        }
      : null,
    municipality: entry.municipality || null
  }));
}

export async function confirmServiceAvailabilityForOwner(ownerId, serviceId, expectedFingerprint, options = {}) {
  const db = options.db || prisma;
  const profile = await confirmServiceAvailabilityRecord({
    db,
    ownerId,
    serviceId,
    expectedFingerprint,
    now: options.now,
    profileInclude: serviceProviderProfileFullInclude
  });
  if (options.syncRag === false || db !== prisma) return profile;
  try {
    return await syncServiceProviderProfileToRag(profile);
  } catch (error) {
    console.error("[service-provider-profile] availability RAG sync failed", {
      profileId: profile?.id,
      error: error?.message || String(error)
    });
    return profile;
  }
}
