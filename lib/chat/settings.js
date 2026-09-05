export const DEFAULT_MODEL = (process.env.OPENAI_MODEL || "gpt-5.6-luna").trim() || "gpt-5.6-luna";

function readEnum(value, allowed, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

const REASONING_EFFORTS = ["minimal", "low", "medium", "high"];
const TEXT_VERBOSITIES = ["low", "medium", "high"];

export function resolveReasoningEffortForModel(model, value) {
  const effort = readEnum(value, REASONING_EFFORTS, "low");
  const normalizedModel = String(model || "").trim().toLowerCase();
  return effort === "minimal" && /^gpt-5\.6(?:-|$)/u.test(normalizedModel)
    ? "low"
    : effort;
}

// NB: vestluse väljundilagi EI tule siit, vaid rollipõhistest
// OPENAI_MAX_OUTPUT_TOKENS_CLIENT / _WORKER muutujatest promptBuilder.js-is.
// See globaalne väärtus teenindab dokumendigeneratsiooni ja koosolekukokkuvõtteid.
export const OPENAI_MAX_OUTPUT_TOKENS = (() => {
  const v = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS);
  return Number.isFinite(v) && v > 0 ? v : undefined;
})();
export const OPENAI_REASONING_EFFORT = resolveReasoningEffortForModel(
  DEFAULT_MODEL,
  process.env.OPENAI_REASONING_EFFORT
);
export const OPENAI_TEXT_VERBOSITY = readEnum(
  process.env.OPENAI_TEXT_VERBOSITY,
  TEXT_VERBOSITIES,
  "medium"
);
