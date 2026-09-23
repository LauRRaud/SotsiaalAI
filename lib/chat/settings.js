export const DEFAULT_MODEL = (process.env.OPENAI_MODEL || "gpt-6-luna").trim() || "gpt-6-luna";

function readEnum(value, allowed, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

const REASONING_EFFORTS = ["minimal", "low", "medium", "high"];
const GPT6_REASONING_EFFORTS = ["none", "low", "medium", "high", "xhigh", "max"];
const TEXT_VERBOSITIES = ["low", "medium", "high"];

export function resolveReasoningEffortForModel(model, value) {
  const normalizedModel = String(model || "").trim().toLowerCase();
  if (/^gpt-6(?:-|$)/u.test(normalizedModel)) {
    const normalized = String(value || "").trim().toLowerCase();
    const allowed = normalizedModel.startsWith("gpt-6-astra")
      ? GPT6_REASONING_EFFORTS.filter(effort => effort !== "none")
      : GPT6_REASONING_EFFORTS;
    return readEnum(normalized === "minimal" ? "low" : normalized, allowed, "medium");
  }
  const effort = readEnum(value, REASONING_EFFORTS, "low");
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
