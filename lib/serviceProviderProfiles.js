import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { serviceMapEntryTypesFromFilter } from "@/lib/serviceMap/entryTypes";
import { normalizeServiceMapAccessPath, serviceMapAccessPathHasDetails } from "@/lib/serviceMap/accessPath";
import { deleteRagDocument } from "@/lib/documents/ragService";
import { removeServiceProfileFromRag } from "@/lib/privacy/serviceProfileRagRemoval";
import { serviceProfileRagDocId } from "@/lib/privacy/serviceProfileRetrievalGuard";
import { publicLicenceBadge } from "@/lib/mtr/statusText";
import { RAG_SERVICE_KEY } from "@/lib/server/ragAuth";
import { splitServiceLocationMapEntries } from "@/lib/serviceProviderServiceLocations";
import { publicServiceProviderServices } from "@/lib/serviceProviderPublicProjection";
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
import { encodeServiceMapCursor } from "@/lib/serviceMap/entriesQueryPolicy";
import { signServiceMapSuggestion, verifyServiceMapSuggestionToken } from "@/lib/serviceMap/addressSuggestionToken";
import {
  processServiceProviderProfileRagJobs,
  queueServiceProviderProfileRagJob,
  readServiceProviderProfileRagDocument
} from "@/lib/serviceProviderProfileRagJobs";
import { SERVICE_PROFILE_LIMITS } from "@/lib/serviceProviderProfileLimits";
import {
  assertServiceProviderProfileInputLimits,
  assertServiceProviderProfileTextLimit,
  preserveServiceProviderChildStatus,
  sanitizeServiceProviderProfileRagMetadata,
  serviceProviderProfileInputError as inputError,
  serviceProviderProfileListSource as listSource,
  validateServiceProviderProfilePublication
} from "@/lib/serviceProviderProfilePolicy";

export { validateServiceProviderProfilePublication } from "@/lib/serviceProviderProfilePolicy";

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

const MAX_TEXT_LENGTH = SERVICE_PROFILE_LIMITS.text;
const MAX_SHORT_TEXT_LENGTH = SERVICE_PROFILE_LIMITS.shortText;
const MAX_LIST_ITEMS = SERVICE_PROFILE_LIMITS.listItems;
const MAX_LIST_ITEM_LENGTH = SERVICE_PROFILE_LIMITS.listItemText;
const MAX_SERVICE_ITEMS = SERVICE_PROFILE_LIMITS.services;
const MAX_SERVICE_LOCATIONS = SERVICE_PROFILE_LIMITS.locations;
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
  const source = listSource(value);
  if (source.length > maxItems) {
    throw inputError("service_provider_profile.errors.too_many_list_items", 413, { maxItems });
  }

  const result = [];
  const seen = new Set();
  for (const item of source) {
    assertServiceProviderProfileTextLimit(item, "listItem", maxLength);
    const normalized = normalizeText(item, maxLength);
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase("et");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
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

function normalizeSelectedServiceMapLocation(input = {}, options = {}) {
  return verifyServiceMapSuggestionToken(input.geocodingSuggestionToken, options);
}

function normalizeServiceLocationInput(input = {}, index = 0, profileDefaults = {}, options = {}) {
  assertServiceProviderProfileInputLimits(input, `serviceLocations.${index}`);
  const selected = normalizeSelectedServiceMapLocation(input, options);
  const clientId = normalizeText(input.clientId || input.id || `location-${index}`, 120) || `location-${index}`;
  const existingLocation = options.existingLocationsById?.get(clientId) || null;
  const address = normalizeText(input.address || input.normalizedAddress, MAX_SHORT_TEXT_LENGTH);
  const normalizedAddress = selected?.normalizedAddress || normalizeText(input.normalizedAddress || input.address, MAX_SHORT_TEXT_LENGTH);
  const hasCoordinates = Boolean(selected);
  if (!address && !normalizedAddress && !normalizeText(input.label)) return null;
  return {
    clientId,
    label: normalizeText(input.label, MAX_SHORT_TEXT_LENGTH),
    address,
    normalizedAddress,
    county: normalizeText(input.county || profileDefaults.county),
    latitude: selected?.latitude ?? null,
    longitude: selected?.longitude ?? null,
    geocodingStatus: hasCoordinates
      ? "MATCHED"
      : address || normalizedAddress
        ? "PENDING"
        : "FAILED",
    adsObjectId: selected?.adsObjectId || null,
    geocodingRaw: hasCoordinates
      ? {
          provider: selected.provider,
          selected: {
            normalizedAddress: selected.normalizedAddress,
            latitude: selected.latitude,
            longitude: selected.longitude,
            adsObjectId: selected.adsObjectId
          }
        }
      : null,
    phone: normalizeText(input.phone),
    email: normalizeText(input.email)?.toLowerCase() || null,
    website: normalizeText(input.website),
    openingHours: normalizeText(input.openingHours, MAX_TEXT_LENGTH),
    accessibilityInfo: normalizeText(input.accessibilityInfo, MAX_TEXT_LENGTH),
    mapVisible: typeof input.mapVisible === "undefined" ? true : normalizeBoolean(input.mapVisible),
    status: preserveServiceProviderChildStatus(
      existingLocation,
      normalizeEnum(input.status, SERVICE_PROVIDER_PROFILE_STATUSES, profileDefaults.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT")
    ),
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Math.max(0, Math.floor(Number(input.sortOrder))) : index
  };
}

function buildServiceProviderProfileRagDocId(profile = {}) {
  /* Prefiksit EI kirjutata siia lahti: sama sõnet loeb päringuaegne
     nõusolekuvärav, ja kaks eraldi koopiat lahknevad esimese muudatusega. */
  return serviceProfileRagDocId(profile.id);
}

export function serviceProviderProfileRagText(profile = {}) {
  const publicServices = publicServiceProviderServices(profile);
  const publishedLocations = (profile.serviceLocations || [])
    .filter((location) => String(location?.status || "").toUpperCase() === "PUBLISHED" && location.mapVisible === true);
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

  const serviceRows = publicServices
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
  const publicServices = publicServiceProviderServices(profile);
  const publishedLocations = (profile.serviceLocations || [])
    .filter((location) => String(location?.status || "").toUpperCase() === "PUBLISHED" && location.mapVisible === true);

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
    services: publicServices.map((service) => ({
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
    service_count: publicServices.length,
    profile_revision: profile.updatedAt?.toISOString?.() || profile.updatedAt || null,
    last_checked: profile.checkedAt || profile.updatedAt || new Date().toISOString(),
    language: "et"
  };
}

export function serviceProviderProfileRagPayload(profile = {}) {
  const docId = buildServiceProviderProfileRagDocId(profile);
  return {
    doc_id: docId,
    owner_id: profile.ownerId || null,
    text: serviceProviderProfileRagText(profile),
    metadata: serviceProviderProfileRagMetadata(profile, docId)
  };
}

export async function reconcileServiceProviderProfileRagJobs({
  db = prisma,
  readDocument = readServiceProviderProfileRagDocument,
  repair = true,
  now = new Date()
} = {}) {
  const profiles = await db.serviceProviderProfile.findMany({
    where: { status: "PUBLISHED", assistantRecommendationAllowed: true },
    include: serviceProviderProfileFullInclude,
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }]
  });
  const result = { checked: profiles.length, consistent: 0, drifted: 0, queued: 0 };
  for (const profile of profiles) {
    const payload = serviceProviderProfileRagPayload(profile);
    const remote = await readDocument(payload.doc_id);
    const remoteMetadata = remote?.metadata || remote?.document?.metadata || remote || null;
    const consistent = Boolean(remote) &&
      remoteMetadata?.profile_revision === payload.metadata.profile_revision;
    if (consistent) {
      result.consistent += 1;
      continue;
    }
    result.drifted += 1;
    if (repair) {
      await queueServiceProviderProfileRagJob({ db, profile, payload, now });
      result.queued += 1;
    }
  }
  return result;
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
  const shouldPublish =
    String(profile.status || "").toUpperCase() === "PUBLISHED" &&
    profile.assistantRecommendationAllowed === true;

  /* SOL-SPROF-02 — EEMALDUS KÄIB ENNE VÕTMEKONTROLLI.
     Vana järjekord kontrollis kõigepealt võtit ja tagastas `skipped`, seega
     puuduva `RAG_SERVICE_KEY` korral EI KUSTUTATUD vana dokumenti ka siis, kui
     kasutaja oli soovitusloa just välja lülitanud. Nõusoleku tagasivõtmine on
     kasutaja tahe, mitte meie konfiguratsiooni funktsioon: ta peab vähemalt
     jõudma püsivasse järjekorda ka siis, kui teenus on kättesaamatu. */
  if (!shouldPublish) {
    const removalReason =
      String(profile.status || "").toUpperCase() === "PUBLISHED"
        ? "assistant_recommendation_not_allowed"
        : "profile_not_published";

    const removal = await removeServiceProfileFromRag(
      {
        profileId: profile.id,
        ragSourceId: profile.ragSourceId,
        reason: removalReason,
        actorUserId: profile.ownerId,
        targetUserId: profile.ownerId,
        ragKeyPresent: Boolean(RAG_SERVICE_KEY)
      },
      { db: prisma, deleteDocument: deleteRagDocument }
    );

    return prisma.serviceProviderProfile.update({
      where: { id: profile.id },
      data: removal.data,
      include: serviceProviderProfileFullInclude
    });
  }

  const job = await prisma.$transaction((tx) => queueServiceProviderProfileRagJob({
    db: tx,
    profile,
    payload: serviceProviderProfileRagPayload(profile)
  }));
  await processServiceProviderProfileRagJobs({ db: prisma, jobId: job.id, limit: 1 });
  return prisma.serviceProviderProfile.findUnique({
    where: { id: profile.id },
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
  assertServiceProviderProfileInputLimits(input);
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
  assertServiceProviderProfileInputLimits(input, `serviceItems.${index}`);
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
    status: preserveServiceProviderChildStatus(
      existingService,
      normalizeEnum(input.status, SERVICE_PROVIDER_PROFILE_STATUSES, profileDefaults.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT")
    ),
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Math.max(0, Math.floor(Number(input.sortOrder))) : index
  };
}

export function normalizeServiceProviderLocationsInput(input = {}, profileDefaults = {}, options = {}) {
  const rawItems = Array.isArray(input.serviceLocations)
    ? input.serviceLocations
    : Array.isArray(input.locations)
      ? input.locations
      : [];
  if (rawItems.length > MAX_SERVICE_LOCATIONS) {
    throw inputError("service_provider_profile.errors.too_many_locations", 413, {
      field: "serviceLocations",
      maxItems: MAX_SERVICE_LOCATIONS
    });
  }
  return rawItems
    .map((item, index) => normalizeServiceLocationInput(item, index, profileDefaults, options))
    .filter(Boolean);
}

export function normalizeServiceProviderServicesInput(input = {}, profileDefaults = {}, existingServicesById = new Map()) {
  const rawItems = Array.isArray(input.serviceItems)
    ? input.serviceItems
    : Array.isArray(input.servicesDetailed)
      ? input.servicesDetailed
      : [];

  if (rawItems.length > MAX_SERVICE_ITEMS) {
    throw inputError("service_provider_profile.errors.too_many_services", 413, {
      field: "serviceItems",
      maxItems: MAX_SERVICE_ITEMS
    });
  }

  const items = rawItems
    .map((item, index) => {
      const clientId = normalizeText(item?.id || item?.clientId, 120);
      return normalizeServiceProviderServiceInput(item, index, profileDefaults, existingServicesById.get(clientId) || null);
    })
    .filter(Boolean);

  if (items.length) return items;

  const legacyServices = normalizeList(input.services);
  if (legacyServices.length > MAX_SERVICE_ITEMS) {
    throw inputError("service_provider_profile.errors.too_many_services", 413, {
      field: "services",
      maxItems: MAX_SERVICE_ITEMS
    });
  }
  return legacyServices
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
  const ragMetadata = sanitizeServiceProviderProfileRagMetadata(profile.ragMetadata);
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
    ragMetadata,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    geocodingSuggestionToken: signServiceMapSuggestion({
      normalizedAddress: profile.serviceMapEntry?.normalizedAddress,
      latitude: profile.serviceMapEntry?.latitude,
      longitude: profile.serviceMapEntry?.longitude,
      adsObjectId: profile.serviceMapEntry?.adsObjectId,
      provider: profile.serviceMapEntry?.geocodingRaw?.provider
    }, { userId: profile.ownerId }),
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
          geocodingSuggestionToken: signServiceMapSuggestion({
            normalizedAddress: location.normalizedAddress,
            latitude: location.latitude,
            longitude: location.longitude,
            adsObjectId: location.adsObjectId,
            provider: location.geocodingRaw?.provider
          }, { userId: profile.ownerId }),
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

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function profileSaveRequestHash(input) {
  return createHash("sha256").update(stableJson(input || {})).digest("hex");
}

function profileSaveReceiptKey(ownerId, idempotencyKey) {
  return `sprof-save:${createHash("sha256").update(`${ownerId}\u0000${idempotencyKey}`).digest("hex")}`;
}

function publicationConsentState(profile = {}) {
  return {
    status: String(profile?.status || "DRAFT"),
    mapVisible: Boolean(profile?.mapVisible),
    assistantRecommendationAllowed: Boolean(profile?.assistantRecommendationAllowed),
    acceptsPlatformPreInquiries: Boolean(profile?.acceptsPlatformPreInquiries),
    acceptsEmailPreInquiries: Boolean(profile?.acceptsEmailPreInquiries)
  };
}

function stateChanged(previous, next) {
  return stableJson(previous) !== stableJson(next);
}

export async function upsertServiceProviderProfileForOwner(ownerId, input, options = {}) {
  if (!ownerId) {
    const error = new Error("api.common.unauthorized");
    error.status = 401;
    throw error;
  }

  const db = options.db || prisma;
  const normalizedBase = normalizeServiceProviderProfileInput(input);
  const expectedUpdatedAt = input?.expectedUpdatedAt ? new Date(input.expectedUpdatedAt) : null;
  if (input?.expectedUpdatedAt && !Number.isFinite(expectedUpdatedAt?.getTime())) {
    const error = new Error("service_provider_profile.errors.profile_conflict");
    error.status = 409;
    throw error;
  }
  const now = new Date();
  const suggestionOptions = { userId: ownerId, now };
  const selectedLocation = normalizeSelectedServiceMapLocation(input, suggestionOptions);
  const requestHash = profileSaveRequestHash(input);
  const externalIdempotencyKey = String(options.idempotencyKey || `${now.toISOString()}:${requestHash}`).trim();
  const receiptIdempotencyKey = profileSaveReceiptKey(ownerId, externalIdempotencyKey);
  const correlationId = String(options.correlationId || externalIdempotencyKey).slice(0, 160);
  let savedProfile = null;
  let savedRagJobId = null;

  const replay = await db.domainEvent.findUnique({ where: { idempotencyKey: receiptIdempotencyKey } });
  if (replay) {
    if (replay.meta?.requestHash !== requestHash) {
      throw inputError("service_provider_profile.errors.idempotency_conflict", 409, {
        field: "Idempotency-Key"
      });
    }
    return db.serviceProviderProfile.findFirst({
      where: { ownerId, ownershipMode: "SOLO" },
      include: serviceProviderProfileFullInclude
    });
  }

  for (let attempt = 1; attempt <= MAX_PROFILE_SAVE_ATTEMPTS; attempt += 1) {
    try {
      const transactionResult = await db.$transaction(async (tx) => {
        // Read the availability state inside the serializable transaction. This
        // makes a concurrent one-click confirmation conflict with the profile
        // rewrite instead of silently replacing a newer checked timestamp.
        const existing = await tx.serviceProviderProfile.findFirst({
          where: { ownerId, ownershipMode: "SOLO" },
          include: serviceProviderProfileFullInclude
        });
        if (existing && (!expectedUpdatedAt || existing.updatedAt.getTime() !== expectedUpdatedAt.getTime())) {
          const error = new Error("service_provider_profile.errors.profile_conflict");
          error.status = 409;
          throw error;
        }
        const existingServicesById = new Map((existing?.serviceItems || []).map((service) => [service.id, service]));
        const existingLocationsById = new Map((existing?.serviceLocations || []).map((location) => [location.id, location]));
        const serviceLocations = normalizeServiceProviderLocationsInput(input, normalizedBase, {
          ...suggestionOptions,
          existingLocationsById
        });
        const serviceItems = normalizeServiceProviderServicesInput(input, normalizedBase, existingServicesById);
        validateServiceProviderProfilePublication(normalizedBase, serviceItems);
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
          checkedAt: now,
          updatedAt: now
        };
        const profile = existing
          ? await (async () => {
              const claimed = await tx.serviceProviderProfile.updateMany({
                where: { id: existing.id, updatedAt: expectedUpdatedAt },
                data: profileData
              });
              if (claimed.count !== 1) {
                const error = new Error("service_provider_profile.errors.profile_conflict");
                error.status = 409;
                throw error;
              }
              return tx.serviceProviderProfile.findUnique({
                where: { id: existing.id },
                include: { serviceMapEntry: true }
              });
            })()
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

        const finalProfile = await tx.serviceProviderProfile.findUnique({
          where: { id: profile.id },
          include: serviceProviderProfileFullInclude
        });
        let ragJobId = null;
        if (finalProfile.status === "PUBLISHED" && finalProfile.assistantRecommendationAllowed === true) {
          const job = await queueServiceProviderProfileRagJob({
            db: tx,
            profile: finalProfile,
            payload: serviceProviderProfileRagPayload(finalProfile),
            now
          });
          ragJobId = job.id;
        }
        const previousState = publicationConsentState(existing);
        const nextState = publicationConsentState(finalProfile);
        if (stateChanged(previousState, nextState)) {
          await tx.domainEvent.create({
            data: {
              type: "SERVICE_PROVIDER_PROFILE_PUBLICATION_CONSENT_CHANGED",
              occurredAt: now,
              actorKind: "USER",
              actorUserId: ownerId,
              sourceFeature: "service_profile",
              sourceType: "ServiceProviderProfile",
              sourceId: finalProfile.id,
              audienceRule: "OWNER_ONLY",
              visibilityClass: "private",
              actionKind: "STATE_CHANGE",
              actionTarget: "publication_consent",
              idempotencyKey: `sprof-transition:${finalProfile.id}:${finalProfile.updatedAt.toISOString()}`,
              retentionClass: "audit",
              meta: {
                profileId: finalProfile.id,
                oldState: previousState,
                newState: nextState,
                revision: finalProfile.updatedAt.toISOString(),
                correlationId
              }
            }
          });
        }
        await tx.domainEvent.create({
          data: {
            type: "SERVICE_PROVIDER_PROFILE_SAVE_ACCEPTED",
            occurredAt: now,
            actorKind: "USER",
            actorUserId: ownerId,
            sourceFeature: "service_profile",
            sourceType: "ServiceProviderProfile",
            sourceId: finalProfile.id,
            audienceRule: "OWNER_ONLY",
            visibilityClass: "private",
            actionKind: "SAVE",
            actionTarget: "profile",
            idempotencyKey: receiptIdempotencyKey,
            retentionClass: "audit",
            meta: {
              profileId: finalProfile.id,
              requestHash,
              revision: finalProfile.updatedAt.toISOString(),
              correlationId
            }
          }
        });
        return { profile: finalProfile, ragJobId };
      }, { isolationLevel: "Serializable" });
      savedProfile = transactionResult.profile;
      savedRagJobId = transactionResult.ragJobId;
      break;
    } catch (error) {
      if (error?.code === "P2002" || isRetryableProfileSaveConflict(error)) {
        const receipt = await db.domainEvent.findUnique({ where: { idempotencyKey: receiptIdempotencyKey } });
        if (receipt) {
          if (receipt.meta?.requestHash !== requestHash) {
            throw inputError("service_provider_profile.errors.idempotency_conflict", 409, {
              field: "Idempotency-Key"
            });
          }
          return db.serviceProviderProfile.findFirst({
            where: { ownerId, ownershipMode: "SOLO" },
            include: serviceProviderProfileFullInclude
          });
        }
      }
      if (!isRetryableProfileSaveConflict(error) || attempt === MAX_PROFILE_SAVE_ATTEMPTS) {
        throw error;
      }
    }
  }

  if (options.syncRag === false || db !== prisma) return savedProfile;
  try {
    if (savedRagJobId) {
      await processServiceProviderProfileRagJobs({ db, jobId: savedRagJobId, limit: 1 });
      return db.serviceProviderProfile.findUnique({
        where: { id: savedProfile.id },
        include: serviceProviderProfileFullInclude
      });
    }
    return await syncServiceProviderProfileToRag(savedProfile);
  } catch (error) {
    console.error("[service-provider-profile] RAG sync failed", {
      profileId: savedProfile?.id,
      error: error?.message || String(error)
    });
    return db.serviceProviderProfile.update({
      where: { id: savedProfile.id },
      data: {
        ragMetadata: {
          syncStatus: "failed",
          code: "RAG_SYNC_FAILED",
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
  limit = 200,
  cursor = null,
  paged = false,
  entryId = ""
} = {}, db = prisma) {
  const filters = {
    status: includeNeedsReview ? { in: ["PUBLISHED", "NEEDS_REVIEW"] } : "PUBLISHED"
  };
  if (entryId) filters.id = entryId;

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
    filters.AND = [
      ...(filters.AND || []),
      { OR: [
        { municipalityName: { contains: normalizedMunicipalityName, mode: "insensitive" } },
        { county: { contains: normalizedMunicipalityName, mode: "insensitive" } },
        { address: { contains: normalizedMunicipalityName, mode: "insensitive" } },
        { providerProfile: { is: { serviceLocations: { some: { mapVisible: true, status: "PUBLISHED", OR: [
          { county: { contains: normalizedMunicipalityName, mode: "insensitive" } },
          { address: { contains: normalizedMunicipalityName, mode: "insensitive" } }
        ] } } } } },
        { providerProfile: { is: { serviceItems: { some: { mapVisible: true, status: "PUBLISHED", serviceArea: { contains: normalizedMunicipalityName, mode: "insensitive" } } } } } }
      ] }
    ];
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

  if (cursor?.title && cursor?.id) {
    filters.AND = [
      ...(filters.AND || []),
      { OR: [
        { title: { gt: cursor.title } },
        { title: cursor.title, id: { gt: cursor.id } }
      ] }
    ];
  }

  const take = Math.max(1, Math.min(Number(limit) || 200, 2000));
  const rows = await db.serviceMapEntry.findMany({
    where: filters,
    take: paged ? take + 1 : take,
    orderBy: [{ title: "asc" }, { id: "asc" }],
    include: {
      providerProfile: {
        include: {
          serviceItems: {
            where: {
              mapVisible: true,
              status: "PUBLISHED"
            },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
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
            orderBy: [{ sortOrder: "asc" }, { label: "asc" }, { id: "asc" }],
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

  const hasMore = paged && rows.length > take;
  const entries = hasMore ? rows.slice(0, take) : rows;

  const projected = entries.flatMap((entry) => splitServiceLocationMapEntries({
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
  if (!paged) return projected;
  const last = entries.at(-1);
  return {
    entries: projected,
    page: {
      hasMore,
      nextCursor: hasMore && last ? encodeServiceMapCursor({ kind: "service", title: last.title, id: last.id }, { keyword, municipalityId, municipalityName, county, type, includeUnlocated, includeNeedsReview }) : null,
      returnedBaseCount: entries.length,
      returnedCount: projected.length,
      truncated: hasMore
    }
  };
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
