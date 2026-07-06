export const SERVICE_MAP_ENTRY_TYPES = Object.freeze([
  "KOV_SOCIAL_CONTACT",
  "KOV_GENERAL_CONTACT",
  "SERVICE_PROVIDER"
]);

export const KOV_SERVICE_MAP_ENTRY_TYPES = Object.freeze([
  "KOV_SOCIAL_CONTACT",
  "KOV_GENERAL_CONTACT"
]);

export function serviceMapEntryTypesFromFilter(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized || normalized === "ALL") return [];
  if (normalized === "KOV_CONTACT") return [...KOV_SERVICE_MAP_ENTRY_TYPES];
  return SERVICE_MAP_ENTRY_TYPES.includes(normalized) ? [normalized] : [];
}
