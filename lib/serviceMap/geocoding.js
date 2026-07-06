import { prisma as defaultPrisma } from "../prisma.js";

const DEFAULT_LIMIT = 100;
const DEFAULT_TIMEOUT_MS = 5000;
const GEOCODABLE_STATUSES = ["PENDING"];
const MAARUUM_EXACT_QUALITIES = new Set(["tapne_nr", "tapne_lahiaadress", "tapne_taisaadress"]);
const COUNTY_ADDRESS_NAMES = new Map([
  ["harjumaa", "Harju maakond"],
  ["hiiumaa", "Hiiu maakond"],
  ["ida-virumaa", "Ida-Viru maakond"],
  ["jogevamaa", "Jõgeva maakond"],
  ["jõgevamaa", "Jõgeva maakond"],
  ["jarvamaa", "Järva maakond"],
  ["järvamaa", "Järva maakond"],
  ["laanemaa", "Lääne maakond"],
  ["läänemaa", "Lääne maakond"],
  ["laane virumaa", "Lääne-Viru maakond"],
  ["laane-virumaa", "Lääne-Viru maakond"],
  ["lääne virumaa", "Lääne-Viru maakond"],
  ["lääne-virumaa", "Lääne-Viru maakond"],
  ["polvamaa", "Põlva maakond"],
  ["põlvamaa", "Põlva maakond"],
  ["parnumaa", "Pärnu maakond"],
  ["pärnumaa", "Pärnu maakond"],
  ["raplamaa", "Rapla maakond"],
  ["saaremaa", "Saare maakond"],
  ["tartumaa", "Tartu maakond"],
  ["valgamaa", "Valga maakond"],
  ["viljandimaa", "Viljandi maakond"],
  ["võrumaa", "Võru maakond"]
]);
const ORGANIZATION_ADDRESS_ALIASES = new Map([
  ["saue vald|saue vallamaja/laagri halduskeskus", "Veskitammi 4, Laagri alevik, Saue vald, Harju maakond"],
  ["valga vald|tõlliste ja õru teeninduskeskus", "Kungla tn 12, Valga linn, Valga maakond"],
  ["valga vald|valga ja taheva teeninduskeskus", "Kungla tn 12, Valga linn, Valga maakond"],
  ["võru vald|võru vallavalitsus", "Võrumõisa tee 4a, Võru linn, Võru maakond"]
]);
const MUNICIPALITY_ADDRESS_ALIASES = new Map([
  ["maardu linn", "Kallasmaa 1, Maardu linn, Harju maakond"],
  ["mustvee vald", "Tartu tn 28, Mustvee linn, Jõgeva maakond"],
  ["nõo vald", "Voika 23, Nõo alevik, Tartu maakond"],
  ["saue vald", "Veskitammi 4, Laagri alevik, Saue vald, Harju maakond"],
  ["valga vald", "Kungla tn 12, Valga linn, Valga maakond"]
]);
const SERVICE_AREA_ADDRESS_ALIASES = new Map([
  ["alutaguse vald|kurtna kogukonnamaja", "Kurtna küla, Alutaguse vald, Ida-Viru maakond"],
  ["mustvee vald|avinurme piirkond", "Avinurme alevik, Mustvee vald, Jõgeva maakond"],
  ["mustvee vald|lohusuu piirkond", "Lohusuu alevik, Mustvee vald, Jõgeva maakond"],
  ["mustvee vald|kasepää piirkond", "Kasepää küla, Mustvee vald, Jõgeva maakond"],
  ["mustvee vald|mustvee piirkond", "Mustvee linn, Mustvee vald, Jõgeva maakond"],
  ["mustvee vald|saare piirkond", "Kääpa küla, Mustvee vald, Jõgeva maakond"]
]);
const ESTONIA_BOUNDS = Object.freeze({
  minLatitude: 57.2,
  maxLatitude: 59.9,
  minLongitude: 21.4,
  maxLongitude: 28.4
});

function clean(value) {
  const normalized = String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  return normalized || null;
}

function addressKey(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("et")
    .replace(/[.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function queryKey(value) {
  return addressKey(value).replace(/\b(?:tn|tänav)\b/gu, "tn");
}

function removeRoomDetails(value) {
  const withoutInlineNoise = clean(value)
    ?.replace(/\([^)]*\b(?:kab|kabinet|ruum|tuba)[^)]*\)/giu, "")
    .replace(/\b(?:[IVXLCDM]+|\d+)\s*(?:k|korrus)\b/giu, "")
    .replace(/\b(?:ruum|tuba|kab(?:inet)?\.?)\s*[\p{L}\p{N}-]*/giu, "")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*$/u, "")
    .trim();
  return withoutInlineNoise
    ?.split(/\s*,\s*/u)
    .map((part) => part.trim())
    .filter((part) => !/^(?:ruum|tuba|kab(?:inet)?\.?|kab)(?:\s*\S+)?$/iu.test(part))
    .filter((part) => !/^(?:[IVXLCDM]+|\d+)\s*(?:k|korrus)$/iu.test(part))
    .join(", ") || null;
}

function removePostalCodes(value) {
  const text = clean(value);
  if (!text) return null;
  return text
    .replace(/\b\d{5}\b/gu, "")
    .replace(/\s*,\s*,/gu, ",")
    .replace(/\s+,/gu, ",")
    .replace(/,\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim() || null;
}

function removeInstitutionCommaSegments(value) {
  const parts = clean(value)
    ?.split(/\s*,\s*/u)
    .map((part) => part.trim())
    .filter(Boolean) || [];
  if (parts.length < 2) return [];
  const institutionPattern = /\b(?:tervisekeskus|kogukonnamaja|osavallamaja|vallamaja|halduskeskus|teeninduskeskus|teeninduspunkt|päevakeskus|rahvamaja|pargikodu)\b/iu;
  const filtered = parts.filter((part, index) => index === 0 || !institutionPattern.test(part));
  return filtered.length < parts.length && filtered.length > 0 ? [filtered.join(", ")] : [];
}

function institutionLabelVariants(value) {
  const text = clean(value);
  if (!text) return [];
  const variants = [];
  const dashParts = text.split(/\s+[–-]\s+/u).map((part) => part.trim()).filter(Boolean);
  if (dashParts.length > 1) variants.push(dashParts.slice(1).join(" - "));
  variants.push(...removeInstitutionCommaSegments(text));

  const withoutLabel = text
    .replace(/\b(?:TK|teeninduskeskus|teeninduspunkt|teenuskeskus|teeninduskeskus|osavallamaja|vallamaja|halduskeskus|kogukonnamaja|rahvamaja|tervisekeskus|päevakeskus)\b/giu, "")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*$/u, "")
    .trim();
  if (withoutLabel && withoutLabel !== text) {
    variants.push(withoutLabel);
    if (/\s+ja\s+/iu.test(withoutLabel)) {
      variants.push(...withoutLabel.split(/\s+ja\s+/iu).map((part) => clean(part)).filter(Boolean));
    }
  }

  for (const variant of [...variants]) {
    variants.push(...removeInstitutionCommaSegments(variant));
  }
  return variants;
}

function streetTypeAddressVariants(value) {
  const text = clean(value);
  if (!text) return [];
  const parts = text.split(/\s*,\s*/u);
  const first = parts[0]?.trim();
  if (!first || /\b(?:tn|tänav|tee|mnt|maantee|pst|puiestee|plats|allee|põik)\b/iu.test(first)) return [];
  const match = first.match(/^(.+?)\s+(\d+[a-z]?)(.*)$/iu);
  if (!match) return [];
  const streetName = match[1].trim();
  const house = match[2].trim();
  const rest = match[3].trim();
  if (!streetName || /\d/u.test(streetName)) return [];
  return [[`${streetName} tn ${house}${rest ? ` ${rest}` : ""}`, ...parts.slice(1)].join(", ")];
}

function leadingPlaceWithSuffixVariants(value) {
  const text = clean(value);
  if (!text || !/,/u.test(text)) return [];
  const parts = text.split(/\s*,\s*/u).map((part) => part.trim()).filter(Boolean);
  const first = parts[0];
  if (!looksLikeBarePlace(first)) return [];
  return ["küla", "linn", "alevik", "alev"].map((suffix) => [`${first} ${suffix}`, ...parts.slice(1)].join(", "));
}

function removeServicePointPrefix(value) {
  const parts = clean(value)
    ?.split(/\s*,\s*/u)
    .map((part) => part.trim())
    .filter(Boolean) || [];
  if (parts.length < 2) return null;
  if (!/\b(?:teeninduspunkt|teenuskeskus|teeninduskeskus|vastuvõtupunkt)\b/iu.test(parts[0])) return null;
  return parts.slice(1).join(", ");
}

function removeAppointmentDetails(value) {
  return clean(value)
    ?.replace(/\b(?:eelneval\s+)?kokkuleppel\b/giu, "")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*$/u, "")
    .trim() || null;
}

function removeLeadingColonLabels(value) {
  let text = clean(value);
  if (!text || !text.includes(":")) return [];
  const variants = [];
  for (let index = 0; index < 3 && text.includes(":"); index += 1) {
    const [prefix, ...restParts] = text.split(":");
    const rest = clean(restParts.join(":"));
    const normalizedPrefix = clean(prefix)?.toLocaleLowerCase("et") || "";
    if (!rest || /\d/u.test(prefix) || prefix.length > 72) break;
    if (
      normalizedPrefix.includes("vastuv") ||
      normalizedPrefix.includes("kokkuleppel") ||
      looksLikeBarePlace(prefix) ||
      /tallinn$/iu.test(prefix)
    ) {
      variants.push(rest);
      text = rest;
      continue;
    }
    break;
  }
  return variants;
}

function countyAddressName(value) {
  const county = clean(value);
  if (!county) return null;
  if (/\bmaakond\b/iu.test(county)) return county;
  return COUNTY_ADDRESS_NAMES.get(queryKey(county)) || county;
}

function organizationAddressAlias(rawAddress, options = {}) {
  const municipalityName = clean(options.municipalityName || options.municipality);
  const key = `${queryKey(municipalityName)}|${queryKey(rawAddress)}`;
  return ORGANIZATION_ADDRESS_ALIASES.get(key) || null;
}

function municipalityAddressAlias(rawAddress, options = {}) {
  const municipalityName = clean(options.municipalityName || options.municipality);
  const municipalityKey = queryKey(municipalityName);
  const addressKeyValue = queryKey(rawAddress);
  if (!municipalityKey) return null;
  if (addressKeyValue === municipalityKey || isRoomOnlyLabel(rawAddress)) {
    return MUNICIPALITY_ADDRESS_ALIASES.get(municipalityKey) || null;
  }
  return null;
}

function serviceAreaAddressAlias(rawAddress, options = {}) {
  const municipalityName = clean(options.municipalityName || options.municipality);
  const key = `${queryKey(municipalityName)}|${queryKey(rawAddress)}`;
  return SERVICE_AREA_ADDRESS_ALIASES.get(key) || null;
}

function isRoomOnlyLabel(value) {
  return /^(?:ruum|tuba|kab(?:inet)?\.?)(?:\s*\S+)?$/iu.test(clean(value) || "");
}

function includesPlace(address, place) {
  const addressText = queryKey(address);
  const placeText = queryKey(place);
  if (!addressText || !placeText) return false;
  if (addressText.includes(placeText)) return true;
  if (placeText === "tallinna linn") {
    return addressText.includes("tallinn");
  }
  return false;
}

function matchesRequestedContext(candidate, options = {}) {
  const normalizedAddress = candidate?.normalizedAddress || candidate?.address || candidate?.display_name;
  const municipalityName = clean(options.municipalityName || options.municipality);
  const county = countyAddressName(options.county);
  if (!options.allowOutsideMunicipality && municipalityName && !includesPlace(normalizedAddress, municipalityName)) return false;
  if (county && !includesPlace(normalizedAddress, county)) return false;
  return true;
}

function hasExplicitMunicipalityContext(value) {
  return /\b(?:vald|linn)\b/iu.test(clean(value) || "");
}

function looksLikeBarePlace(value) {
  const text = clean(value);
  if (!text) return false;
  if (/\d/u.test(text)) return false;
  if (/,/u.test(text)) return false;
  if (/\b(?:vald|linn|küla|alevik|alev|maakond|tn|tee|mnt|põik|plats)\b/iu.test(text)) return false;
  return text.length <= 48;
}

function addressQueryVariants(rawAddress, options = {}) {
  const base = clean(rawAddress);
  if (!base) return [];

  const variants = [base];
  const alias = organizationAddressAlias(base, options);
  if (alias) variants.push(alias);
  const municipalityAlias = municipalityAddressAlias(base, options);
  if (municipalityAlias) variants.push(municipalityAlias);
  const serviceAreaAlias = serviceAreaAddressAlias(base, options);
  if (serviceAreaAlias) variants.push(serviceAreaAlias);

  for (const address of [...variants]) {
    const cleaned = removeRoomDetails(address);
    if (cleaned && cleaned !== address) variants.push(cleaned);
    const withoutPostalCode = removePostalCodes(address);
    if (withoutPostalCode && withoutPostalCode !== address) variants.push(withoutPostalCode);
    const withoutAppointment = removeAppointmentDetails(address);
    if (withoutAppointment && withoutAppointment !== address) variants.push(withoutAppointment);
    variants.push(...removeLeadingColonLabels(address));
    const withoutServicePoint = removeServicePointPrefix(address);
    if (withoutServicePoint && withoutServicePoint !== address) variants.push(withoutServicePoint);
    variants.push(...institutionLabelVariants(address));
    variants.push(...streetTypeAddressVariants(address));
    variants.push(...leadingPlaceWithSuffixVariants(address));
  }

  for (const address of [...variants]) {
    const withoutPostalCode = removePostalCodes(address);
    if (withoutPostalCode && withoutPostalCode !== address) variants.push(withoutPostalCode);
    variants.push(...streetTypeAddressVariants(withoutPostalCode || address));
    variants.push(...leadingPlaceWithSuffixVariants(withoutPostalCode || address));
  }

  const municipalityName = clean(options.municipalityName || options.municipality);
  const county = countyAddressName(options.county);

  for (const address of [...variants]) {
    if (municipalityName && !includesPlace(address, municipalityName)) {
      variants.push(`${address}, ${municipalityName}`);
    }
  }

  for (const address of [...variants]) {
    if (county && !includesPlace(address, county)) {
      variants.push(`${address}, ${county}`);
    }
  }

  for (const address of [...variants]) {
    if (!looksLikeBarePlace(address)) continue;
    for (const suffix of ["küla", "linn", "alevik", "alev"]) {
      const withSuffix = `${address} ${suffix}`;
      variants.push(withSuffix);
      if (municipalityName && !includesPlace(withSuffix, municipalityName)) {
        variants.push(`${withSuffix}, ${municipalityName}`);
      }
      if (municipalityName && county) {
        variants.push(`${withSuffix}, ${municipalityName}, ${county}`);
      }
    }
  }

  const seen = new Set();
  return variants.filter((variant) => {
    const key = queryKey(variant);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function hasCoordinates(candidate) {
  const latitude = numberOrNull(candidate?.latitude ?? candidate?.lat);
  const longitude = numberOrNull(candidate?.longitude ?? candidate?.lon ?? candidate?.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return (
    latitude >= ESTONIA_BOUNDS.minLatitude &&
    latitude <= ESTONIA_BOUNDS.maxLatitude &&
    longitude >= ESTONIA_BOUNDS.minLongitude &&
    longitude <= ESTONIA_BOUNDS.maxLongitude
  );
}

function createTimeoutSignal(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    try {
      controller.abort();
    } catch {}
  }, Math.max(500, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
  return {
    signal: controller.signal,
    dispose: () => clearTimeout(timeout)
  };
}

function providerList(options = {}) {
  const raw = String(
    options.provider ||
      process.env.SERVICE_MAP_GEOCODER_PROVIDER ||
      process.env.GEOCODER_PROVIDER ||
      "none"
  )
    .trim()
    .toLowerCase();
  if (!raw || raw === "none" || raw === "disabled" || raw === "off") return [];
  return raw
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCandidate(candidate, provider, rawAddress) {
  if (!candidate || typeof candidate !== "object" || !hasCoordinates(candidate)) return null;
  const latitude = numberOrNull(candidate.latitude ?? candidate.lat);
  const longitude = numberOrNull(candidate.longitude ?? candidate.lon ?? candidate.lng);
  return {
    provider,
    rawAddress,
    normalizedAddress:
      clean(candidate.normalizedAddress || candidate.normalized_address || candidate.address || candidate.display_name) ||
      rawAddress,
    latitude,
    longitude,
    adsObjectId: clean(candidate.adsObjectId || candidate.ads_object_id || candidate.place_id || candidate.osm_id),
    confidence: clean(candidate.confidence) || "medium",
    raw: candidate
  };
}

function dedupeCandidates(candidates = []) {
  const deduped = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const key = candidate.adsObjectId
      ? `ads:${candidate.adsObjectId}`
      : `addr:${queryKey(candidate.normalizedAddress)}:${candidate.latitude}:${candidate.longitude}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }
  return deduped;
}

function resultFromCandidates(candidates, provider, rawAddress, rawPayload = null) {
  const validCandidates = dedupeCandidates(candidates
    .map((candidate) => normalizeCandidate(candidate, provider, rawAddress))
    .filter(Boolean));

  if (validCandidates.length === 0) {
    return {
      status: "FAILED",
      provider,
      rawAddress,
      normalizedAddress: rawAddress,
      latitude: null,
      longitude: null,
      adsObjectId: null,
      raw: rawPayload || candidates
    };
  }

  const highConfidenceCandidates = validCandidates.filter((candidate) => candidate.confidence === "high");
  if (highConfidenceCandidates.length === 1) {
    const [candidate] = highConfidenceCandidates;
    return {
      status: "MATCHED",
      provider,
      rawAddress,
      normalizedAddress: candidate.normalizedAddress,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      adsObjectId: candidate.adsObjectId,
      raw: candidate.raw
    };
  }

  if (validCandidates.length > 1) {
    return {
      status: "AMBIGUOUS",
      provider,
      rawAddress,
      normalizedAddress: rawAddress,
      latitude: null,
      longitude: null,
      adsObjectId: null,
      raw: {
        candidates: validCandidates.map((candidate) => ({
          normalizedAddress: candidate.normalizedAddress,
          latitude: candidate.latitude,
          longitude: candidate.longitude,
          adsObjectId: candidate.adsObjectId,
          confidence: candidate.confidence
        })),
        payload: rawPayload
      }
    };
  }

  const [candidate] = validCandidates;
  return {
    status: "MATCHED",
    provider,
    rawAddress,
    normalizedAddress: candidate.normalizedAddress,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    adsObjectId: candidate.adsObjectId,
    raw: candidate.raw
  };
}

async function loadFixtureJson() {
  const inline = clean(process.env.SERVICE_MAP_GEOCODER_FIXTURES);
  if (inline) {
    return JSON.parse(inline);
  }

  if (process.env.NODE_ENV === "production") return null;

  const fixtureFile = clean(process.env.SERVICE_MAP_GEOCODER_FIXTURE_FILE);
  if (!fixtureFile) return null;

  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const filePath = path.isAbsolute(fixtureFile)
    ? fixtureFile
    : path.resolve(/*turbopackIgnore: true*/ process.cwd(), fixtureFile);
  const text = await fs.readFile(filePath, "utf8");
  return JSON.parse(text);
}

function fixtureCandidatesForAddress(fixtures, rawAddress) {
  if (!fixtures) return [];
  const key = addressKey(rawAddress);

  if (Array.isArray(fixtures)) {
    return fixtures.filter((item) => addressKey(item?.address || item?.rawAddress || item?.query) === key);
  }

  if (typeof fixtures !== "object") return [];
  const direct = fixtures[rawAddress] || fixtures[key];
  if (!direct) return [];
  if (Array.isArray(direct)) return direct;
  if (Array.isArray(direct.matches)) return direct.matches;
  return [direct];
}

async function geocodeWithFixtures(rawAddress) {
  const fixtures = await loadFixtureJson();
  const candidates = fixtureCandidatesForAddress(fixtures, rawAddress);
  return resultFromCandidates(candidates, "fixture", rawAddress, candidates);
}

function buildNominatimUrl(rawAddress, options = {}) {
  const baseUrl = String(
    process.env.SERVICE_MAP_GEOCODER_BASE_URL ||
      process.env.HELP_GEOCODER_BASE_URL ||
      "https://nominatim.openstreetmap.org"
  ).replace(/\/+$/, "");
  const url = new URL("/search", baseUrl);
  url.searchParams.set("q", rawAddress);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(Math.max(1, Math.min(10, Number(options.limit) || 5))));

  const countrycodes = clean(
    process.env.SERVICE_MAP_GEOCODER_COUNTRY_CODES || process.env.HELP_GEOCODER_COUNTRY_CODES || "ee"
  );
  if (countrycodes) url.searchParams.set("countrycodes", countrycodes);

  return url;
}

async function geocodeWithNominatim(rawAddress, options = {}) {
  const timeout = createTimeoutSignal(options.timeoutMs);
  try {
    const response = await fetch(buildNominatimUrl(rawAddress, options), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": String(
          process.env.SERVICE_MAP_GEOCODER_USER_AGENT ||
            process.env.HELP_GEOCODER_USER_AGENT ||
            "SotsiaalAI/1.0"
        )
      },
      cache: "no-store",
      signal: timeout.signal
    });
    if (!response.ok) {
      return {
        status: "FAILED",
        provider: "nominatim",
        rawAddress,
        normalizedAddress: rawAddress,
        latitude: null,
        longitude: null,
        adsObjectId: null,
        raw: { httpStatus: response.status }
      };
    }

    const payload = await response.json().catch(() => []);
    const items = Array.isArray(payload) ? payload : [];
    const candidates = items.map((item) => ({
      ...item,
      normalizedAddress: item.display_name,
      latitude: item.lat,
      longitude: item.lon,
      adsObjectId: item.place_id || item.osm_id
    }));
    return resultFromCandidates(candidates, "nominatim", rawAddress, payload);
  } catch (error) {
    return {
      status: "FAILED",
      provider: "nominatim",
      rawAddress,
      normalizedAddress: rawAddress,
      latitude: null,
      longitude: null,
      adsObjectId: null,
      raw: { error: error?.name || "geocoding_error" }
    };
  } finally {
    timeout.dispose();
  }
}

function buildMaaruumGazetteerUrl(rawAddress) {
  const rawBaseUrl = String(
    process.env.SERVICE_MAP_MAARUUM_GEOCODER_URL ||
      process.env.MAARUUM_GEOCODER_URL ||
      process.env.SERVICE_MAP_GEOCODER_BASE_URL ||
      "https://aks.geoportaal.ee/inaks/inaadress/gazetteer"
  ).trim();
  const baseUrl = rawBaseUrl || "https://aks.geoportaal.ee/inaks/inaadress/gazetteer";
  const url = new URL(baseUrl);
  url.searchParams.set("address", rawAddress);
  return url;
}

function maaruumCandidateFromAddress(item = {}) {
  const latitude = item.viitepunkt_b ?? item.latitude ?? item.lat;
  const longitude = item.viitepunkt_l ?? item.longitude ?? item.lon ?? item.lng;
  return {
    ...item,
    normalizedAddress:
      item.ipikkaadress ||
      item.pikkaadress ||
      item.taisaadress ||
      item.aadresstekst ||
      item.normalizedAddress,
    latitude,
    longitude,
    adsObjectId: item.adr_id || item.ads_oid || item.adob_id || item.tunnus,
    confidence: MAARUUM_EXACT_QUALITIES.has(item.kvaliteet) ? "high" : "medium"
  };
}

async function geocodeWithMaaruum(rawAddress, options = {}) {
  let firstReviewResult = null;
  let lastFailedResult = null;

  for (const query of addressQueryVariants(rawAddress, options)) {
    const municipalityName = clean(options.municipalityName || options.municipality);
    const allowOutsideMunicipality =
      queryKey(query) === queryKey(organizationAddressAlias(rawAddress, options)) ||
      (municipalityName && hasExplicitMunicipalityContext(query) && !includesPlace(query, municipalityName));
    const timeout = createTimeoutSignal(options.timeoutMs);
    try {
      const response = await fetch(buildMaaruumGazetteerUrl(query), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": String(
            process.env.SERVICE_MAP_GEOCODER_USER_AGENT ||
              process.env.MAARUUM_GEOCODER_USER_AGENT ||
              "SotsiaalAI/1.0"
          )
        },
        cache: "no-store",
        signal: timeout.signal
      });
      if (!response.ok) {
        lastFailedResult = {
          status: "FAILED",
          provider: "maaruum",
          rawAddress,
          normalizedAddress: rawAddress,
          latitude: null,
          longitude: null,
          adsObjectId: null,
          raw: { httpStatus: response.status, query }
        };
        continue;
      }

      const payload = await response.json().catch(() => ({}));
      const items = Array.isArray(payload?.addresses)
        ? payload.addresses
        : Array.isArray(payload)
          ? payload
          : payload && typeof payload === "object"
            ? [payload]
            : [];
      const candidates = items
        .map(maaruumCandidateFromAddress)
        .filter((candidate) => matchesRequestedContext(candidate, { ...options, allowOutsideMunicipality }));
      const result = resultFromCandidates(candidates, "maaruum", rawAddress, payload);
      result.raw = {
        ...(result.raw && typeof result.raw === "object" && !Array.isArray(result.raw) ? result.raw : { result: result.raw }),
        query
      };
      if (result.status === "MATCHED") return result;
      if (!firstReviewResult && result.status === "AMBIGUOUS") firstReviewResult = result;
      if (result.status === "FAILED") lastFailedResult = result;
    } catch (error) {
      lastFailedResult = {
        status: "FAILED",
        provider: "maaruum",
        rawAddress,
        normalizedAddress: rawAddress,
        latitude: null,
        longitude: null,
        adsObjectId: null,
        raw: { error: error?.name || "geocoding_error", query }
      };
    } finally {
      timeout.dispose();
    }
  }

  return firstReviewResult || lastFailedResult || {
    status: "FAILED",
    provider: "maaruum",
    rawAddress,
    normalizedAddress: rawAddress,
    latitude: null,
    longitude: null,
    adsObjectId: null,
    raw: { reason: "no_query_variants" }
  };
}

async function suggestWithMaaruum(rawAddress, options = {}) {
  const timeout = createTimeoutSignal(options.timeoutMs);
  try {
    const response = await fetch(buildMaaruumGazetteerUrl(rawAddress), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": String(
          process.env.SERVICE_MAP_GEOCODER_USER_AGENT ||
            process.env.MAARUUM_GEOCODER_USER_AGENT ||
            "SotsiaalAI/1.0"
        )
      },
      cache: "no-store",
      signal: timeout.signal
    });

    if (!response.ok) {
      return {
        ok: false,
        provider: "maaruum",
        suggestions: [],
        error: "geocoder_http_error",
        httpStatus: response.status
      };
    }

    const payload = await response.json().catch(() => ({}));
    const items = Array.isArray(payload?.addresses)
      ? payload.addresses
      : Array.isArray(payload)
        ? payload
        : payload && typeof payload === "object"
          ? [payload]
          : [];
    const allowOutsideMunicipality = !clean(options.municipalityName || options.municipality);
    const candidates = dedupeCandidates(items
      .map(maaruumCandidateFromAddress)
      .map((candidate) => normalizeCandidate(candidate, "maaruum", rawAddress))
      .filter(Boolean)
      .filter((candidate) => matchesRequestedContext(candidate, { ...options, allowOutsideMunicipality })));

    const limit = Math.max(1, Math.min(Number(options.limit) || 8, 12));
    return {
      ok: true,
      provider: "maaruum",
      suggestions: candidates.slice(0, limit).map((candidate) => ({
        provider: candidate.provider,
        label: candidate.normalizedAddress,
        normalizedAddress: candidate.normalizedAddress,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        adsObjectId: candidate.adsObjectId,
        confidence: candidate.confidence
      }))
    };
  } catch (error) {
    return {
      ok: false,
      provider: "maaruum",
      suggestions: [],
      error: error?.name || "geocoding_error"
    };
  } finally {
    timeout.dispose();
  }
}

export async function suggestServiceMapAddresses(rawAddress, options = {}) {
  const address = clean(rawAddress);
  if (!address || address.length < 2) {
    return {
      ok: true,
      provider: "none",
      suggestions: [],
      reason: "query_too_short"
    };
  }

  const providers = providerList(options);
  if (providers.length === 0) {
    return {
      ok: true,
      provider: "none",
      suggestions: [],
      reason: "geocoder_not_configured"
    };
  }

  let lastResult = null;
  for (const provider of providers) {
    if (["maaruum", "maaamet", "inaks", "aks"].includes(provider)) {
      lastResult = await suggestWithMaaruum(address, options);
    } else {
      lastResult = {
        ok: true,
        provider,
        suggestions: [],
        reason: "suggestions_unsupported_provider"
      };
    }

    if (lastResult.suggestions?.length) return lastResult;
  }

  return lastResult || {
    ok: true,
    provider: "none",
    suggestions: []
  };
}

export async function geocodeServiceMapAddress(rawAddress, options = {}) {
  const address = clean(rawAddress);
  if (!address) {
    return {
      status: "FAILED",
      provider: "none",
      rawAddress: null,
      normalizedAddress: null,
      latitude: null,
      longitude: null,
      adsObjectId: null,
      raw: { reason: "missing_address" }
    };
  }

  const providers = providerList(options);
  if (providers.length === 0) {
    return {
      status: "PENDING",
      provider: "none",
      rawAddress: address,
      normalizedAddress: address,
      latitude: null,
      longitude: null,
      adsObjectId: null,
      raw: { reason: "geocoder_not_configured" }
    };
  }

  let lastResult = null;
  for (const provider of providers) {
    if (provider === "fixture" || provider === "fixtures") {
      lastResult = await geocodeWithFixtures(address);
    } else if (provider === "nominatim" || provider === "osm") {
      lastResult = await geocodeWithNominatim(address, options);
    } else if (["maaruum", "maaamet", "inaks", "aks"].includes(provider)) {
      lastResult = await geocodeWithMaaruum(address, options);
    } else {
      lastResult = {
        status: "FAILED",
        provider,
        rawAddress: address,
        normalizedAddress: address,
        latitude: null,
        longitude: null,
        adsObjectId: null,
        raw: { reason: "unsupported_provider" }
      };
    }

    if (lastResult.status !== "FAILED") return lastResult;
  }

  return lastResult;
}

function statusAfterGeocoding(entry, geocoding) {
  if (entry.status === "HIDDEN") return "HIDDEN";
  if (entry.status === "DRAFT") return "DRAFT";
  if (geocoding.status === "MATCHED") return "PUBLISHED";
  if (geocoding.status === "AMBIGUOUS" || geocoding.status === "FAILED") return "NEEDS_REVIEW";
  return entry.status;
}

function geocodingUpdateForEntry(entry, geocoding) {
  return {
    status: statusAfterGeocoding(entry, geocoding),
    geocodingStatus: geocoding.status,
    normalizedAddress: geocoding.normalizedAddress,
    latitude: geocoding.status === "MATCHED" ? geocoding.latitude : null,
    longitude: geocoding.status === "MATCHED" ? geocoding.longitude : null,
    adsObjectId: geocoding.status === "MATCHED" ? geocoding.adsObjectId : null,
    geocodingRaw: {
      provider: geocoding.provider,
      rawAddress: geocoding.rawAddress,
      result: geocoding.raw,
      checkedAt: new Date().toISOString()
    },
    checkedAt: new Date()
  };
}

export async function geocodeServiceMapEntries({
  prisma = defaultPrisma,
  dryRun = false,
  limit = DEFAULT_LIMIT,
  statuses = GEOCODABLE_STATUSES,
  provider,
  timeoutMs
} = {}) {
  const take = Math.max(1, Math.min(Number(limit) || DEFAULT_LIMIT, 500));
  const geocodingStatuses = Array.isArray(statuses) && statuses.length ? statuses : GEOCODABLE_STATUSES;
  const entries = await prisma.serviceMapEntry.findMany({
    where: {
      address: { not: null },
      geocodingStatus: { in: geocodingStatuses }
    },
    take,
    orderBy: [{ updatedAt: "asc" }],
    select: {
      id: true,
      type: true,
      title: true,
      municipalityName: true,
      county: true,
      address: true,
      status: true,
      geocodingStatus: true
    }
  });

  const result = {
    scanned: entries.length,
    updated: 0,
    planned: 0,
    matched: 0,
    ambiguous: 0,
    failed: 0,
    pending: 0,
    entries: []
  };

  for (const entry of entries) {
    const geocoding = await geocodeServiceMapAddress(entry.address, {
      provider,
      timeoutMs,
      municipalityName: entry.municipalityName,
      county: entry.county
    });
    const update = geocodingUpdateForEntry(entry, geocoding);
    const plannedEntry = {
      id: entry.id,
      type: entry.type,
      title: entry.title,
      address: entry.address,
      previousStatus: entry.status,
      previousGeocodingStatus: entry.geocodingStatus,
      nextStatus: update.status,
      nextGeocodingStatus: update.geocodingStatus,
      normalizedAddress: update.normalizedAddress,
      latitude: update.latitude,
      longitude: update.longitude,
      provider: geocoding.provider
    };

    result.entries.push(plannedEntry);
    result.planned += 1;
    if (geocoding.status === "MATCHED") result.matched += 1;
    if (geocoding.status === "AMBIGUOUS") result.ambiguous += 1;
    if (geocoding.status === "FAILED") result.failed += 1;
    if (geocoding.status === "PENDING") result.pending += 1;

    if (dryRun) continue;

    await prisma.serviceMapEntry.update({
      where: { id: entry.id },
      data: update
    });
    result.updated += 1;
  }

  return result;
}

export function isMissingServiceMapEntryTableError(error) {
  const message = String(error?.message || "");
  return error?.code === "P2021" || message.includes("ServiceMapEntry") || message.includes("serviceMapEntry");
}
