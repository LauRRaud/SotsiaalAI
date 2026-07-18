const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

const TRACKING_QUERY_KEYS = new Set([
  "_ga",
  "_gl",
  "dclid",
  "fbclid",
  "gclid",
  "gclsrc",
  "mc_cid",
  "mc_eid",
  "msclkid",
  "ref_src",
  "vero_conv",
  "vero_id"
]);

const RESERVED_PERCENT_BYTES = new Set(
  [...":/?#[]@!$&'()*+,;="].map(character => character.charCodeAt(0).toString(16).padStart(2, "0"))
);

function anomaly(code, detail = null) {
  return detail == null ? { code } : { code, detail };
}

function failure(contract, input, code, message) {
  return {
    ok: false,
    contract,
    input,
    error: { code, message },
    anomalies: []
  };
}

function validateInput(input, contract) {
  if (typeof input !== "string") {
    return failure(contract, input, "invalid_input_type", "URL must be a string");
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return failure(contract, input, "empty_url", "URL must not be empty");
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return failure(contract, input, "invalid_url", "URL is not parseable");
  }
  if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
    return failure(contract, input, "forbidden_scheme", `Only http: and https: URLs are allowed; received ${parsed.protocol}`);
  }
  if (parsed.username || parsed.password) {
    return {
      ...failure(contract, null, "credentials_forbidden", "URLs containing a username or password are forbidden"),
      input_redacted: true
    };
  }
  if (!parsed.hostname) {
    return failure(contract, input, "missing_host", "URL host is required");
  }
  return { ok: true, input, trimmed, parsed };
}

function hasEncodedReservedByte(value) {
  for (const match of String(value).matchAll(/%([0-9a-f]{2})/giu)) {
    if (RESERVED_PERCENT_BYTES.has(match[1].toLowerCase())) return true;
  }
  return false;
}

function canonicalizePercentTriplets(value) {
  return String(value).replace(/%([0-9a-f]{2})/giu, (match, hex) => {
    const number = Number.parseInt(hex, 16);
    const character = String.fromCharCode(number);
    if (/^[A-Za-z0-9._~-]$/u.test(character)) return character;
    return `%${hex.toUpperCase()}`;
  });
}

function strictEncodeQueryComponent(value) {
  return encodeURIComponent(String(value))
    .replace(/[!'()*]/gu, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%[0-9a-f]{2}/giu, match => match.toUpperCase());
}

function isTrackingQueryKey(key) {
  const normalized = String(key || "").trim().toLowerCase();
  return normalized.startsWith("utm_") || TRACKING_QUERY_KEYS.has(normalized);
}

function normalizedQuery(parsed, anomalies) {
  const retained = [];
  const removed = [];
  for (const [key, value] of parsed.searchParams.entries()) {
    if (isTrackingQueryKey(key)) removed.push(key);
    else retained.push([key, value]);
  }
  retained.sort((left, right) => {
    const keyOrder = left[0].localeCompare(right[0], "en");
    return keyOrder || left[1].localeCompare(right[1], "en");
  });
  if (removed.length) {
    anomalies.push(anomaly("tracking_query_removed", [...new Set(removed)].sort()));
  }
  return retained
    .map(([key, value]) => `${strictEncodeQueryComponent(key)}=${strictEncodeQueryComponent(value)}`)
    .join("&");
}

function serializedHost(hostname, port = "") {
  const host = hostname.includes(":") && !hostname.startsWith("[") ? `[${hostname}]` : hostname;
  return `${host}${port ? `:${port}` : ""}`;
}

function hadExplicitDefaultPort(trimmed, protocol) {
  const authority = trimmed.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/iu)?.[1] || "";
  const withoutCredentials = authority.replace(/^.*@/u, "");
  if (protocol === "http:") return /:80$/u.test(withoutCredentials);
  if (protocol === "https:") return /:443$/u.test(withoutCredentials);
  return false;
}

/**
 * Registry identity contract, version 1.
 *
 * This deliberately reproduces the data-proven legacy rule in
 * master_sources_final.json. It is an identity key, not a fetch URL:
 *   1. validate a non-credentialed http(s) URL;
 *   2. trim surrounding whitespace;
 *   3. decode the complete string with decodeURIComponent;
 *   4. remove a final slash only when the decoded URL's path is not root.
 *
 * It intentionally does not lowercase the path, remove www, reorder query
 * parameters, remove fragments, or normalize ports. Decoding a complete URL
 * also decodes reserved bytes and can yield spaces/Unicode. Those legacy
 * properties are returned as anomalies instead of being silently hidden.
 */
export function normalizeRegistryIdentityUrl(input) {
  const contract = "registry_identity_v1";
  const validation = validateInput(input, contract);
  if (!validation.ok) return validation;

  const anomalies = [];
  if (validation.trimmed !== input) anomalies.push(anomaly("surrounding_whitespace_trimmed"));
  if (hasEncodedReservedByte(validation.trimmed)) {
    anomalies.push(anomaly("legacy_decodes_reserved_percent_encoding"));
  }

  let decoded;
  try {
    decoded = decodeURIComponent(validation.trimmed);
  } catch {
    return failure(contract, input, "invalid_percent_encoding", "URL contains malformed percent encoding");
  }

  let decodedParsed;
  try {
    decodedParsed = new URL(decoded);
  } catch {
    return failure(contract, input, "legacy_decode_invalid_url", "Legacy percent decoding produced an invalid URL");
  }
  if (decodedParsed.username || decodedParsed.password) {
    return failure(contract, null, "legacy_decode_credentials_forbidden", "Legacy percent decoding produced URL credentials");
  }

  let normalizedUrl = decoded;
  if (decodedParsed.pathname !== "/" && normalizedUrl.endsWith("/")) {
    normalizedUrl = normalizedUrl.slice(0, -1);
    anomalies.push(anomaly("legacy_trailing_slash_removed"));
  }
  if (decodedParsed.hash) anomalies.push(anomaly("legacy_fragment_preserved"));
  if (/\s/u.test(normalizedUrl) || [...normalizedUrl].some(character => character.codePointAt(0) > 0x7f)) {
    anomalies.push(anomaly("legacy_identity_not_network_serialization"));
  }

  return {
    ok: true,
    contract,
    input,
    normalized_url: normalizedUrl,
    identity_key: normalizedUrl,
    anomalies
  };
}

/**
 * Standard network URL contract, version 1.
 *
 * canonical_url is suitable as a future fetch target: it preserves the www
 * host label, path case, non-default port and trailing slash. It lowercases
 * scheme/host through the WHATWG URL parser, removes credentials/fragments,
 * normalizes percent triplets, removes known tracking parameters and sorts
 * the remaining query deterministically.
 *
 * comparison_key is for technical equality only. It additionally treats a
 * leading www label and a non-root trailing slash as aliases. It must never be
 * used as a fetch target without an explicit redirect/fetch decision.
 */
export function canonicalizeNetworkUrl(input) {
  const contract = "network_url_v1";
  const validation = validateInput(input, contract);
  if (!validation.ok) return validation;

  const { parsed, trimmed } = validation;
  const anomalies = [];
  if (trimmed !== input) anomalies.push(anomaly("surrounding_whitespace_trimmed"));
  if (parsed.hash) anomalies.push(anomaly("fragment_removed"));
  if (hadExplicitDefaultPort(trimmed, parsed.protocol)) anomalies.push(anomaly("default_port_removed"));

  let pathname = canonicalizePercentTriplets(parsed.pathname || "/");
  if (/\/{2,}/u.test(pathname)) anomalies.push(anomaly("duplicate_path_slashes_preserved"));
  const query = normalizedQuery(parsed, anomalies);
  const host = serializedHost(parsed.hostname.toLowerCase(), parsed.port);
  const canonicalUrl = `${parsed.protocol}//${host}${pathname}${query ? `?${query}` : ""}`;

  let comparisonHostname = parsed.hostname.toLowerCase();
  if (comparisonHostname.startsWith("www.") && comparisonHostname.length > 4) {
    comparisonHostname = comparisonHostname.slice(4);
    anomalies.push(anomaly("www_alias_in_comparison_key"));
  }
  let comparisonPath = pathname;
  if (comparisonPath !== "/" && comparisonPath.endsWith("/")) {
    comparisonPath = comparisonPath.replace(/\/+$/u, "");
    anomalies.push(anomaly("trailing_slash_alias_in_comparison_key"));
  }
  const comparisonHost = serializedHost(comparisonHostname, parsed.port);
  const comparisonKey = `${parsed.protocol}//${comparisonHost}${comparisonPath}${query ? `?${query}` : ""}`;

  return {
    ok: true,
    contract,
    input,
    canonical_url: canonicalUrl,
    fetch_url: canonicalUrl,
    comparison_key: comparisonKey,
    anomalies
  };
}

export function canonicalizeSourceUrlPair(input, expectedRegistryIdentity = null) {
  const registry = normalizeRegistryIdentityUrl(input);
  const network = canonicalizeNetworkUrl(input);
  const anomalies = [];

  if (registry.ok && expectedRegistryIdentity != null && registry.normalized_url !== expectedRegistryIdentity) {
    anomalies.push(anomaly("registry_identity_mismatch", {
      expected: expectedRegistryIdentity,
      actual: registry.normalized_url
    }));
  }
  if (registry.ok && network.ok && registry.identity_key !== network.comparison_key) {
    anomalies.push(anomaly("registry_identity_differs_from_network_key"));
  }

  return { registry, network, anomalies };
}

export const URL_CANONICAL_CONTRACTS = Object.freeze({
  registry_identity: "registry_identity_v1",
  network_url: "network_url_v1"
});
