export function isPublicServiceProviderService(service) {
  return Boolean(
    service &&
    service.mapVisible === true &&
    String(service.status || "").toUpperCase() === "PUBLISHED"
  );
}

/** Üks fail-closed allowlist kaardi, RAG-i ja avalike loendurite jaoks. */
export function publicServiceProviderServices(profile = {}) {
  return (Array.isArray(profile.serviceItems) ? profile.serviceItems : [])
    .filter(isPublicServiceProviderService);
}
