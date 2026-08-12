function inheritedFlag(serviceValue, profileValue) {
  if (typeof serviceValue === "boolean") return serviceValue;
  return profileValue !== false;
}

function allowsDirectContact(value) {
  return String(value || "").trim().toLocaleLowerCase("et") === "jah";
}

export function projectServiceContactPolicy(service = {}, profile = {}, location = {}) {
  const platformAllowed = inheritedFlag(service.acceptsPlatformPreInquiries, profile.acceptsPlatformPreInquiries);
  const emailAllowed = inheritedFlag(service.acceptsEmailPreInquiries, profile.acceptsEmailPreInquiries)
    && allowsDirectContact(service.directContactAllowed);
  return Object.freeze({
    providerServiceId: service.id || null,
    providerLocationId: location.id || null,
    platformAllowed,
    emailAllowed,
    email: emailAllowed ? (service.email || location.email || profile.email || null) : null,
    phone: allowsDirectContact(service.directContactAllowed) ? (service.phone || location.phone || profile.phone || null) : null,
    reason: platformAllowed || emailAllowed ? null : "SERVICE_CONTACT_NOT_ALLOWED"
  });
}

export function resolveSelectedServicePolicy({ entry, serviceId, locationId }) {
  if (!entry?.providerProfile || entry.type !== "SERVICE_PROVIDER") return null;
  const profile = entry.providerProfile;
  const service = (profile.serviceItems || []).find((item) => item.id === serviceId);
  const location = (profile.serviceLocations || []).find((item) => item.id === locationId);
  if (!service || !location) return null;
  const linked = (location.serviceLinks || []).some((link) =>
    (link.providerServiceId || link.providerService?.id) === service.id
  );
  if (!linked) return null;
  return projectServiceContactPolicy(service, profile, location);
}
