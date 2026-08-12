export function buildServiceMapEntryId(baseEntryId, providerLocationId) {
  const base = String(baseEntryId || "").trim();
  const location = String(providerLocationId || "").trim();
  return base && location ? `${base}:location:${location}` : base || null;
}

export function parseServiceMapEntryId(value) {
  const raw = String(value || "").trim();
  if (!raw) return { baseEntryId: null, providerLocationId: null };
  const marker = ":location:";
  const index = raw.indexOf(marker);
  if (index < 1) return { baseEntryId: raw, providerLocationId: null };
  const baseEntryId = raw.slice(0, index).trim();
  const providerLocationId = raw.slice(index + marker.length).trim();
  if (!baseEntryId || !providerLocationId || providerLocationId.includes(marker)) return { baseEntryId: null, providerLocationId: null };
  return { baseEntryId, providerLocationId };
}
