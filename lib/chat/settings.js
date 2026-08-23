export const DEFAULT_MODEL = (process.env.OPENAI_MODEL || "gpt-5.6-luna").trim() || "gpt-5.6-luna";
function readPositiveNumber(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

function readFlag(value, fallback = false) {
  if (typeof value === "undefined") return fallback;
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  return ["1", "true", "yes", "on"].includes(normalized);
}

function readEnum(value, allowed, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

const REASONING_EFFORTS = ["minimal", "low", "medium", "high"];
const TEXT_VERBOSITIES = ["low", "medium", "high"];

// NB: vestluse väljundilagi EI tule siit, vaid rollipõhistest
// OPENAI_MAX_OUTPUT_TOKENS_CLIENT / _WORKER muutujatest promptBuilder.js-is.
// See globaalne väärtus teenindab dokumendigeneratsiooni ja koosolekukokkuvõtteid.
export const OPENAI_MAX_OUTPUT_TOKENS = (() => {
  const v = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS);
  return Number.isFinite(v) && v > 0 ? v : undefined;
})();
export const OPENAI_REASONING_EFFORT = readEnum(
  process.env.OPENAI_REASONING_EFFORT,
  REASONING_EFFORTS,
  "low"
);
export const OPENAI_TEXT_VERBOSITY = readEnum(
  process.env.OPENAI_TEXT_VERBOSITY,
  TEXT_VERBOSITIES,
  "medium"
);
// Prompt-komponentide tokeniaudit. Vaikimisi VÄLJAS: sees olles laetakse
// tokeniseerija ja mõõdetakse iga päringu prompt-komponendid (ainult mahud,
// tokeniarvud ja hash — mitte sisu).
export const CHAT_PROMPT_TOKEN_AUDIT = readFlag(process.env.CHAT_PROMPT_TOKEN_AUDIT, false);
export const RAG_TOP_K = Math.max(1, Math.trunc(readPositiveNumber(process.env.RAG_TOP_K, 12)));
export const RAG_TIMEOUT_MS = Math.max(1000, Math.trunc(readPositiveNumber(process.env.RAG_TIMEOUT_MS, 30_000)));
export const CONTEXT_GROUPS_MAX = Math.max(1, Math.trunc(readPositiveNumber(process.env.RAG_CONTEXT_GROUPS_MAX, 8)));
export const DIVERSIFY_LAMBDA = (() => {
  const v = Number(process.env.RAG_MMR_LAMBDA);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;
})();
export const RAG_CTX_MAX_CHARS = Math.max(500, Math.trunc(readPositiveNumber(process.env.RAG_CTX_MAX_CHARS, 6000)));
export const RAG_CTX_HEADROOM = (() => {
  const v = Number(process.env.RAG_CTX_HEADROOM ?? 0.15);
  return Number.isFinite(v) ? Math.min(0.5, Math.max(0, v)) : 0.15;
})();
export const RAG_GROUP_BODY_MAX_CHARS = (() => {
  const v = Number(process.env.RAG_GROUP_BODY_MAX_CHARS ?? 1100);
  return Number.isFinite(v) && v > 200 ? v : 1100;
})();
export const RAG_TRACE_V1_ENABLED = readFlag(process.env.RAG_TRACE_V1_ENABLED, true);
export const RAG_ATTRIBUTION_DECISIONS_ENABLED = readFlag(process.env.RAG_ATTRIBUTION_DECISIONS_ENABLED, true);
export const RAG_DISPLAYED_SOURCES_ENFORCED = readFlag(process.env.RAG_DISPLAYED_SOURCES_ENFORCED, true);
export const RAG_BASE = process.env.RAG_API_BASE || "http://127.0.0.1:8000";
