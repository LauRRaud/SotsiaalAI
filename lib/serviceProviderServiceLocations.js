function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function text(value) {
  return String(value || "").trim();
}

function locationServices(location = {}, providerProfile = {}) {
  const links = Array.isArray(location.serviceLinks) ? location.serviceLinks : [];
  const linked = links
    .map((link) => link.providerService)
    .filter(Boolean);
  if (linked.length) return linked;
  return Array.isArray(providerProfile.serviceItems) ? providerProfile.serviceItems : [];
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
  const contactName = firstServiceContact(services, "contactName") || location.contactName || baseEntry.contactName;
  const phone = firstServiceContact(services, "phone") || location.phone || baseEntry.phone;
  const email = firstServiceContact(services, "email") || location.email || baseEntry.email;
  const website = firstServiceContact(services, "website") || location.website || baseEntry.website;
  return {
    ...baseEntry,
    id: `${baseEntry.id || baseEntry.providerProfileId || "provider"}:location:${location.id || index}`,
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
    latitude: location.latitude,
    longitude: location.longitude,
    adsObjectId: location.adsObjectId || null,
    geocodingStatus: location.geocodingStatus || "MATCHED",
    providerProfile: baseEntry.providerProfile
      ? {
          ...baseEntry.providerProfile,
          serviceItems: services,
          serviceLocations: [location]
        }
      : baseEntry.providerProfile
  };
}

export function splitServiceLocationMapEntries(entry = {}) {
  const locations = Array.isArray(entry.providerProfile?.serviceLocations)
    ? entry.providerProfile.serviceLocations
    : [];
  const visibleLocations = locations.filter((location) => (
    location?.mapVisible !== false &&
    String(location?.status || "PUBLISHED").toUpperCase() === "PUBLISHED" &&
    isConfirmedProviderLocation(location)
  ));

  if (!visibleLocations.length) return locations.length ? [] : [entry];

  return visibleLocations.map((location, index) =>
    serializeLocationEntry(entry, location, locationServices(location, entry.providerProfile), index)
  );
}
