import { SERVICE_PROFILE_LIMITS } from "./serviceProviderProfileLimits.js";

const LONG_TEXT_FIELDS = new Set([
  "accessibilityInfo",
  "additionalInfo",
  "areaDescription",
  "description",
  "excludesText",
  "generalAccessibilityNote",
  "includesText",
  "longDescription",
  "openingHours",
  "priceDescription",
  "referralNotes",
  "requiredDocumentsNote",
  "serviceArea",
  "shortDescription"
]);
const LIST_FIELDS = new Set([
  "ageGroups",
  "categories",
  "communicationSupport",
  "deliveryModes",
  "inquiryLanguages",
  "languages",
  "lifeDomains",
  "locationIds",
  "municipalityIds",
  "needTags",
  "requesterRoles",
  "serviceAreaMunicipalityIds",
  "serviceCategories",
  "serviceLanguages",
  "services",
  "targetGroups"
]);

export function serviceProviderProfileInputError(message, status, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function normalizedInputText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function assertServiceProviderProfileTextLimit(value, field, maxLength) {
  if (normalizedInputText(value).length > maxLength) {
    throw serviceProviderProfileInputError("service_provider_profile.errors.field_too_long", 413, {
      field,
      maxLength
    });
  }
}

export function serviceProviderProfileListSource(value) {
  return Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[,;\n\r]/)
        .map((part) => part.trim())
        .filter(Boolean);
}

export function assertServiceProviderProfileInputLimits(input, path = "profile") {
  if (!input || typeof input !== "object") return;
  for (const [field, value] of Object.entries(input)) {
    const fieldPath = `${path}.${field}`;
    if (field === "serviceItems" && Array.isArray(value) && value.length > SERVICE_PROFILE_LIMITS.services) {
      throw serviceProviderProfileInputError("service_provider_profile.errors.too_many_services", 413, {
        field: fieldPath,
        maxItems: SERVICE_PROFILE_LIMITS.services
      });
    }
    if (field === "serviceLocations" && Array.isArray(value) && value.length > SERVICE_PROFILE_LIMITS.locations) {
      throw serviceProviderProfileInputError("service_provider_profile.errors.too_many_locations", 413, {
        field: fieldPath,
        maxItems: SERVICE_PROFILE_LIMITS.locations
      });
    }
    if (LIST_FIELDS.has(field)) {
      const items = serviceProviderProfileListSource(value);
      const maxItems = field === "locationIds" ? SERVICE_PROFILE_LIMITS.locations : SERVICE_PROFILE_LIMITS.listItems;
      if (items.length > maxItems) {
        throw serviceProviderProfileInputError("service_provider_profile.errors.too_many_list_items", 413, {
          field: fieldPath,
          maxItems
        });
      }
      items.forEach((item, index) => assertServiceProviderProfileTextLimit(item, `${fieldPath}.${index}`, SERVICE_PROFILE_LIMITS.listItemText));
      continue;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === "object") assertServiceProviderProfileInputLimits(item, `${fieldPath}.${index}`);
        else assertServiceProviderProfileTextLimit(item, `${fieldPath}.${index}`, SERVICE_PROFILE_LIMITS.listItemText);
      });
      continue;
    }
    if (value && typeof value === "object") {
      assertServiceProviderProfileInputLimits(value, fieldPath);
      continue;
    }
    if (typeof value === "string") {
      const maxLength = field.toLowerCase().includes("token")
        ? SERVICE_PROFILE_LIMITS.text
        : LONG_TEXT_FIELDS.has(field)
          ? SERVICE_PROFILE_LIMITS.text
          : SERVICE_PROFILE_LIMITS.shortText;
      assertServiceProviderProfileTextLimit(value, fieldPath, maxLength);
    }
  }
}

export function preserveServiceProviderChildStatus(existingChild, requestedStatus) {
  // Never republish an existing child implicitly, but always honor an explicit
  // withdrawal so stale service data cannot remain publicly visible.
  return requestedStatus === "PUBLISHED"
    ? existingChild?.status || requestedStatus
    : requestedStatus;
}

export function validateServiceProviderProfilePublication(profile, serviceItems) {
  if (String(profile?.status || "DRAFT").toUpperCase() !== "PUBLISHED") return;
  const publishableServices = (serviceItems || []).filter((service) =>
    String(service?.name || "").trim() &&
    service?.mapVisible !== false &&
    String(service?.status || "").toUpperCase() === "PUBLISHED"
  );
  if (!publishableServices.length) {
    throw serviceProviderProfileInputError("service_provider_profile.errors.publish_service_required", 400, {
      field: "serviceItems"
    });
  }
  const hasAccessPath = Boolean(
    profile.phone ||
    profile.email ||
    profile.website ||
    profile.acceptsPlatformPreInquiries ||
    (profile.acceptsEmailPreInquiries && profile.email) ||
    publishableServices.some((service) =>
      service.phone || service.email || service.website || service.contactMode || service.acceptsPlatformPreInquiries
    )
  );
  if (!hasAccessPath) {
    throw serviceProviderProfileInputError("service_provider_profile.errors.publish_contact_required", 400, {
      field: "contact"
    });
  }
}

export function sanitizeServiceProviderProfileRagMetadata(metadata) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? {
        syncStatus: metadata.syncStatus || null,
        reason: metadata.reason || null,
        checkedAt: metadata.checkedAt || null
      }
    : null;
}
