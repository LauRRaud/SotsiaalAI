import { normalizeMunicipalitySearchText } from "./municipalityData.js";

function getGeocodingProviderName() {
  return String(process.env.HELP_GEOCODER_PROVIDER || process.env.GEOCODER_PROVIDER || process.env.SERVICE_MAP_GEOCODER_PROVIDER || "none")
    .trim()
    .toLowerCase();
}

function createTimeoutSignal(timeoutMs = 4000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    try {
      controller.abort();
    } catch {}
  }, Math.max(500, Number(timeoutMs) || 4000));
  return {
    signal: controller.signal,
    dispose: () => clearTimeout(timeout)
  };
}

function normalizeCandidateStrings(value = "") {
  return Array.from(
    new Set(
      String(value || "")
        .split(/[|,]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function buildNominatimUrl(rawPlace, options = {}) {
  const baseUrl = String(process.env.HELP_GEOCODER_BASE_URL || "https://nominatim.openstreetmap.org")
    .replace(/\/+$/, "");
  const url = new URL("/search", baseUrl);
  url.searchParams.set("q", rawPlace);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(Math.max(1, Math.min(5, Number(options?.limit) || 3))));

  const countrycodes = String(process.env.HELP_GEOCODER_COUNTRY_CODES || "ee").trim();
  if (countrycodes) {
    url.searchParams.set("countrycodes", countrycodes);
  }

  return url;
}

function buildMaaruumGazetteerUrl(rawPlace) {
  const rawBaseUrl = String(
    process.env.HELP_MAARUUM_GEOCODER_URL ||
      process.env.MAARUUM_GEOCODER_URL ||
      process.env.HELP_GEOCODER_BASE_URL ||
      "https://aks.geoportaal.ee/inaks/inaadress/gazetteer"
  ).trim();
  const url = new URL(rawBaseUrl || "https://aks.geoportaal.ee/inaks/inaadress/gazetteer");
  url.searchParams.set("address", rawPlace);
  return url;
}

function normalizeNominatimResult(item, rawPlace) {
  if (!item || typeof item !== "object") return null;

  const address = item.address && typeof item.address === "object" ? item.address : {};
  const candidateStrings = [
    address.municipality,
    address.city,
    address.town,
    address.city_district,
    address.suburb,
    address.village,
    address.county,
    item.display_name
  ]
    .flatMap((value) => normalizeCandidateStrings(value))
    .filter(Boolean);

  return {
    provider: "nominatim",
    rawPlace,
    matchedPlace: String(item.display_name || "").trim() || rawPlace,
    municipalityDisplayName: String(address.municipality || address.city || address.town || "").trim() || null,
    county: String(address.county || "").trim() || null,
    confidence: candidateStrings.length ? "medium" : "low",
    latitude: Number.isFinite(Number(item.lat)) ? Number(item.lat) : null,
    longitude: Number.isFinite(Number(item.lon)) ? Number(item.lon) : null,
    candidateStrings
  };
}

function normalizeMaaruumResult(item, rawPlace) {
  if (!item || typeof item !== "object") return null;

  const candidateStrings = [
    item.omavalitsus,
    item.asustusyksus,
    item.maakond,
    item.ipikkaadress,
    item.pikkaadress,
    item.taisaadress,
    item.aadresstekst
  ]
    .flatMap((value) => normalizeCandidateStrings(value))
    .filter(Boolean);

  return {
    provider: "maaruum",
    rawPlace,
    matchedPlace:
      String(item.ipikkaadress || item.pikkaadress || item.taisaadress || item.aadresstekst || "").trim() ||
      rawPlace,
    municipalityDisplayName: String(item.omavalitsus || "").trim() || null,
    county: String(item.maakond || "").trim() || null,
    confidence: item.kvaliteet === "tapne_nr" || item.primary === "true" ? "high" : "medium",
    latitude: Number.isFinite(Number(item.viitepunkt_b)) ? Number(item.viitepunkt_b) : null,
    longitude: Number.isFinite(Number(item.viitepunkt_l)) ? Number(item.viitepunkt_l) : null,
    candidateStrings
  };
}

async function geocodeWithNominatim(rawPlace, options = {}) {
  const timeout = createTimeoutSignal(options?.timeoutMs);
  try {
    const response = await fetch(buildNominatimUrl(rawPlace, options), {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": String(process.env.HELP_GEOCODER_USER_AGENT || "SotsiaalAI/1.0")
      },
      cache: "no-store",
      signal: timeout.signal
    });
    if (!response.ok) return null;

    const payload = await response.json().catch(() => null);
    const first = Array.isArray(payload) ? payload[0] : null;
    return normalizeNominatimResult(first, rawPlace);
  } catch {
    return null;
  } finally {
    timeout.dispose();
  }
}

async function geocodeWithMaaruum(rawPlace, options = {}) {
  const timeout = createTimeoutSignal(options?.timeoutMs);
  try {
    const response = await fetch(buildMaaruumGazetteerUrl(rawPlace), {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": String(
          process.env.HELP_GEOCODER_USER_AGENT ||
            process.env.MAARUUM_GEOCODER_USER_AGENT ||
            "SotsiaalAI/1.0"
        )
      },
      cache: "no-store",
      signal: timeout.signal
    });
    if (!response.ok) return null;

    const payload = await response.json().catch(() => ({}));
    const items = Array.isArray(payload?.addresses)
      ? payload.addresses
      : Array.isArray(payload)
        ? payload
        : payload && typeof payload === "object"
          ? [payload]
          : [];
    const first = items[0] || null;
    return normalizeMaaruumResult(first, rawPlace);
  } catch {
    return null;
  } finally {
    timeout.dispose();
  }
}

export async function geocodePlace(rawPlace, options = {}) {
  const query = String(rawPlace || "").trim();
  if (!query) return null;

  const provider = String(options?.provider || getGeocodingProviderName()).trim().toLowerCase();
  if (!provider || provider === "none" || provider === "disabled") {
    return null;
  }
  if (provider === "nominatim") {
    return geocodeWithNominatim(query, options);
  }
  if (["maaruum", "maaamet", "inaks", "aks"].includes(provider)) {
    return geocodeWithMaaruum(query, options);
  }

  return null;
}

export function normalizeGeocodingCandidateText(value = "") {
  return normalizeMunicipalitySearchText(value);
}
