import { spawnSync } from "node:child_process";

const OPENAI_PROVIDER_NAMES = new Set(["openai", "opf", "openai_privacy_filter"]);
const CACHE_MAX_ENTRIES = 64;
const resultCache = new Map();

let warnedUnavailable = false;
let disabledAfterFailure = false;

const OPF_SCRIPT = String.raw`
import json
import os
import sys
from opf import OPF

text = sys.stdin.read()
device = os.environ.get("OPENAI_PRIVACY_FILTER_DEVICE") or os.environ.get("OPF_DEVICE") or "cpu"
output_mode = os.environ.get("OPENAI_PRIVACY_FILTER_OUTPUT_MODE") or "typed"
checkpoint = os.environ.get("OPF_CHECKPOINT") or None
redactor = OPF(model=checkpoint, device=device, output_mode=output_mode)
result = redactor.redact(text)
print(result.to_json(indent=None))
`;

function readFlag(value, fallback = false) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  return ["1", "true", "yes", "on"].includes(normalized);
}

function isOpenAIPrivacyFilterEnabled() {
  if (disabledAfterFailure && !readFlag(process.env.OPENAI_PRIVACY_FILTER_REQUIRED, false)) return false;
  return OPENAI_PROVIDER_NAMES.has(String(process.env.PRIVACY_FILTER_PROVIDER || "").trim().toLowerCase());
}

function cacheKey(text) {
  return [
    String(process.env.OPF_CHECKPOINT || ""),
    String(process.env.OPENAI_PRIVACY_FILTER_DEVICE || process.env.OPF_DEVICE || "cpu"),
    String(process.env.OPENAI_PRIVACY_FILTER_OUTPUT_MODE || "typed"),
    text
  ].join("\u0000");
}

function getCached(key) {
  if (!resultCache.has(key)) return null;
  const value = resultCache.get(key);
  resultCache.delete(key);
  resultCache.set(key, value);
  return value;
}

function setCached(key, value) {
  resultCache.set(key, value);
  while (resultCache.size > CACHE_MAX_ENTRIES) {
    const firstKey = resultCache.keys().next().value;
    resultCache.delete(firstKey);
  }
}

function normalizeOpenAISpan(span) {
  const start = Number(span?.start);
  const end = Number(span?.end);
  const type = String(span?.label || "").trim().toLowerCase();
  if (!type || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;

  const labels = {
    private_person: "nimi",
    private_address: "aadress",
    private_email: "e-posti aadress",
    private_phone: "telefoninumber",
    private_url: "privaatne link",
    private_date: "kuupaev",
    account_number: "konto- voi dokumendinumber",
    secret: "saladus"
  };

  return {
    type,
    label: labels[type] || type.replace(/_/g, " "),
    text: String(span?.text || ""),
    start,
    end,
    provider: "openai_privacy_filter"
  };
}

function parseOpenAIPrivacyFilterPayload(stdout, source) {
  const payload = JSON.parse(String(stdout || "").trim());
  const spans = Array.isArray(payload?.detected_spans)
    ? payload.detected_spans.map(normalizeOpenAISpan).filter(Boolean)
    : [];
  return {
    provider: "openai_privacy_filter",
    text: typeof payload?.text === "string" ? payload.text : source,
    redactedText: typeof payload?.redacted_text === "string" ? payload.redacted_text : source,
    spans,
    warning: typeof payload?.warning === "string" ? payload.warning : "",
    raw: payload
  };
}

function handleUnavailable(error) {
  if (!warnedUnavailable && process.env.NODE_ENV !== "test") {
    warnedUnavailable = true;
    console.warn("[privacy-filter] OpenAI Privacy Filter unavailable; using local fallback", {
      message: error?.message || "unknown"
    });
  }
  if (readFlag(process.env.OPENAI_PRIVACY_FILTER_REQUIRED, false)) {
    throw error;
  }
  disabledAfterFailure = true;
  return null;
}

export function runOpenAIPrivacyFilter(value = "") {
  const source = String(value || "");
  if (!source.trim() || !isOpenAIPrivacyFilterEnabled()) return null;

  const key = cacheKey(source);
  const cached = getCached(key);
  if (cached) return cached;

  const pythonBin = String(
    process.env.OPF_PYTHON_BIN ||
    process.env.OPENAI_PRIVACY_FILTER_PYTHON ||
    "python3"
  ).trim();
  const timeout = Math.max(1_000, Number(process.env.OPENAI_PRIVACY_FILTER_TIMEOUT_MS || 120_000));
  const maxBuffer = Math.max(1024 * 1024, Number(process.env.OPENAI_PRIVACY_FILTER_MAX_BUFFER || 16 * 1024 * 1024));

  try {
    const result = spawnSync(pythonBin, ["-c", OPF_SCRIPT], {
      input: source,
      encoding: "utf8",
      maxBuffer,
      timeout,
      windowsHide: true,
      env: process.env
    });

    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(String(result.stderr || `opf exited with status ${result.status}`).trim());
    }
    if (!String(result.stdout || "").trim()) {
      throw new Error("opf returned empty output");
    }

    const parsed = parseOpenAIPrivacyFilterPayload(result.stdout, source);
    setCached(key, parsed);
    return parsed;
  } catch (error) {
    return handleUnavailable(error);
  }
}

export function getOpenAIPrivacyFilterConfig() {
  return {
    enabled: isOpenAIPrivacyFilterEnabled(),
    provider: isOpenAIPrivacyFilterEnabled() ? "openai_privacy_filter" : "local_regex",
    required: readFlag(process.env.OPENAI_PRIVACY_FILTER_REQUIRED, false),
    pythonBin: String(
      process.env.OPF_PYTHON_BIN ||
      process.env.OPENAI_PRIVACY_FILTER_PYTHON ||
      "python3"
    ).trim(),
    device: String(process.env.OPENAI_PRIVACY_FILTER_DEVICE || process.env.OPF_DEVICE || "cpu").trim()
  };
}
