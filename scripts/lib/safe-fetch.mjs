import dns from "node:dns/promises";
import net from "node:net";

import { canonicalizeNetworkUrl } from "./url-canonical.mjs";

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_REDIRECTS = 5;

export class SafeFetchError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SafeFetchError";
    this.code = code;
  }
}

function ipv4Private(address) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return true;
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19));
}

export function isPublicNetworkAddress(address) {
  const family = net.isIP(String(address || ""));
  if (family === 4) return !ipv4Private(address);
  if (family === 6) {
    const normalized = String(address).toLowerCase();
    return normalized !== "::1" && !normalized.startsWith("fc") && !normalized.startsWith("fd") &&
      !normalized.startsWith("fe80:") && !normalized.startsWith("::ffff:127.") && !normalized.startsWith("::ffff:10.") &&
      !normalized.startsWith("::ffff:192.168.") && !normalized.startsWith("::ffff:169.254.");
  }
  return false;
}

export async function assertSafeFetchUrl(input, { lookup = dns.lookup } = {}) {
  const canonical = canonicalizeNetworkUrl(input);
  if (!canonical.ok) throw new SafeFetchError(canonical.error.code, canonical.error.message);
  const parsed = new URL(canonical.fetch_url);
  const hostname = parsed.hostname.replace(/^\[|\]$/gu, "");
  if (hostname.toLowerCase() === "localhost") throw new SafeFetchError("blocked_host", "localhost is not fetchable");
  const addresses = net.isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(entry => !isPublicNetworkAddress(entry.address))) {
    throw new SafeFetchError("blocked_address", "Fetch target resolves to a private or non-public address");
  }
  return { url: canonical.fetch_url, hostname, addresses: addresses.map(entry => entry.address) };
}

async function readBody(response, maxBytes) {
  const chunks = [];
  let total = 0;
  if (!response.body) return Buffer.alloc(0);
  for await (const chunk of response.body) {
    const buffer = Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) throw new SafeFetchError("response_too_large", `Response exceeds ${maxBytes} bytes`);
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export async function safeFetch(input, {
  fetchImpl = fetch,
  lookup = dns.lookup,
  maxBytes = DEFAULT_MAX_BYTES,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRedirects = DEFAULT_MAX_REDIRECTS,
  headers = {},
  method = "GET"
} = {}) {
  let current = input;
  const redirects = [];
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const target = await assertSafeFetchUrl(current, { lookup });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(target.url, { method, headers, redirect: "manual", signal: controller.signal });
    } catch (error) {
      if (error?.name === "AbortError") throw new SafeFetchError("timeout", `Fetch timed out after ${timeoutMs}ms`);
      throw new SafeFetchError("fetch_failed", "Fetch request failed");
    } finally {
      clearTimeout(timer);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new SafeFetchError("redirect_missing_location", "Redirect response did not include Location");
      if (hop === maxRedirects) throw new SafeFetchError("redirect_limit", "Redirect limit exceeded");
      const next = new URL(location, target.url).toString();
      redirects.push({ status: response.status, from: target.url, to: next });
      current = next;
      continue;
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new SafeFetchError("response_too_large", `Response exceeds ${maxBytes} bytes`);
    }
    const body = await readBody(response, maxBytes);
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: target.url,
      redirects,
      contentType: String(response.headers.get("content-type") || "").toLowerCase(),
      body,
      bytes: body.length
    };
  }
  throw new SafeFetchError("redirect_limit", "Redirect limit exceeded");
}

export const SAFE_FETCH_DEFAULTS = Object.freeze({ DEFAULT_MAX_BYTES, DEFAULT_TIMEOUT_MS, DEFAULT_MAX_REDIRECTS });
