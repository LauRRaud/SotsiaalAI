import { projectServiceContactPolicy } from "./serviceMap/contactPolicy.js";
import { buildServiceMapEntryId } from "./serviceMap/entryIdentity.js";
import { publicServiceProviderServices } from "./serviceProviderPublicProjection.js";

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function text(value) {
  return String(value || "").trim();
}

function locationServices(location = {}, providerProfile = {}) {
  const links = Array.isArray(location.serviceLinks) ? location.serviceLinks : [];
  const publicServices = publicServiceProviderServices(providerProfile);
  const publicById = new Map(publicServices.map((service) => [service?.id, service]));
  const linked = links
    .map((link) => publicById.get(link?.providerServiceId || link?.providerService?.id))
    .filter(Boolean);
  if (linked.length) return linked;
  return publicServices;
}

export function isConfirmedProviderLocation(location = {}) {
  const status = text(location.geocodingStatus).toUpperCase();
  return (
    ["MATCHED", "MANUALLY_CONFIRMED"].includes(status) &&
    Number.isFinite(numberOrNull(location.latitude)) &&
    Number.isFinite(numberOrNull(location.longitude))
  );
}

function serviceNames(services = []) {
  return services.map((service) => text(service.name)).filter(Boolean).join(", ");
}

function firstServiceContact(services = [], field) {
  for (const service of services) {
    const value = text(service?.[field]);
    if (value) return value;
  }
  return "";
}

function serializeLocationEntry(baseEntry = {}, location = {}, services = [], index = 0) {
  const lightweightMarker = baseEntry.isLightweightMarker === true;
  const publicServiceIds = new Set(services.map((service) => service?.id).filter(Boolean));
  const publicLocation = {
    ...location,
    serviceLinks: (Array.isArray(location.serviceLinks) ? location.serviceLinks : [])
      .filter((link) => publicServiceIds.has(link?.providerServiceId || link?.providerService?.id))
      .map((link) => ({
        providerServiceId: link.providerServiceId || link.providerService?.id,
        providerLocationId: link.providerLocationId || location.id || null
      }))
  };
  const serviceActions = lightweightMarker
    ? []
    : services.map((service) => ({
        ...projectServiceContactPolicy(service, baseEntry.providerProfile || {}, location),
        name: service.name || ""
      }));
  const contactName = firstServiceContact(services, "contactName") || location.contactName || baseEntry.contactName;
  const phone = serviceActions.length ? null : (location.phone || baseEntry.phone);
  const email = serviceActions.length ? null : (location.email || baseEntry.email);
  const website = firstServiceContact(services, "website") || location.website || baseEntry.website;
  return {
    ...baseEntry,
    id: buildServiceMapEntryId(baseEntry.id || baseEntry.providerProfileId || "provider", location.id || String(index)),
    parentEntryId: baseEntry.id || null,
    providerLocationId: location.id || null,
    contactName,
    title: baseEntry.title || baseEntry.providerProfile?.organizationName || "",
    description: serviceNames(services) || baseEntry.description,
    county: location.county || baseEntry.county,
    address: location.address || location.normalizedAddress || baseEntry.address,
    normalizedAddress: location.normalizedAddress || location.address || baseEntry.normalizedAddress,
    phone,
    email,
    website,
    serviceActions,
    canStartPreInquiry: !lightweightMarker && serviceActions.some((action) => action.platformAllowed),
    latitude: location.latitude,
    longitude: location.longitude,
    adsObjectId: location.adsObjectId || null,
    geocodingStatus: location.geocodingStatus || "MATCHED",
    providerProfile: baseEntry.providerProfile
      ? {
          ...baseEntry.providerProfile,
          serviceItems: services,
          serviceLocations: [publicLocation]
        }
      : baseEntry.providerProfile
  };
}

export function splitServiceLocationMapEntries(entry = {}) {
  const locations = Array.isArray(entry.providerProfile?.serviceLocations)
    ? entry.providerProfile.serviceLocations
    : [];
  const visibleLocations = locations.filter((location) => (
    location?.mapVisible === true &&
    String(location?.status || "").toUpperCase() === "PUBLISHED" &&
    isConfirmedProviderLocation(location)
  ));

  if (!visibleLocations.length) {
    if (locations.length) return [];
    if (entry.type !== "SERVICE_PROVIDER") return [entry];
    return [{ ...entry, email: null, phone: null, serviceActions: [], canStartPreInquiry: false }];
  }

  return visibleLocations.map((location, index) =>
    serializeLocationEntry(entry, location, locationServices(location, entry.providerProfile), index)
  );
}
