const DEFAULT_HELP_AI_EXTRACTOR_MODEL = "gpt-5.4-nano";

const ALLOWED_HELP_TYPES = new Set(["VOLUNTARY", "PAID", "MIXED"]);
const ALLOWED_TIME_TYPES = new Set(["ONE_TIME", "RECURRING", "FLEXIBLE"]);
const ALLOWED_CATEGORY_CODES = new Set([
  "TRANSPORT",
  "DAILY_TASKS",
  "HOME_HELP",
  "DIGITAL_HELP",
  "CARE_SUPPORT",
  "CHILD_YOUTH_SUPPORT",
  "LEARNING_GUIDANCE",
  "SOCIAL_SUPPORT",
  "ADMIN_FORM_HELP",
  "OTHER"
]);
const ALLOWED_TARGET_GROUP_CODES = new Set(["CHILD", "YOUTH", "ADULT", "ELDER"]);

const CATEGORY_LABELS = Object.freeze({
  TRANSPORT: "Transport",
  DAILY_TASKS: "Igapaevaabi",
  HOME_HELP: "Koduabi",
  DIGITAL_HELP: "Digiabi",
  CARE_SUPPORT: "Tugi ja hooldus",
  CHILD_YOUTH_SUPPORT: "Laste ja noorte tugi",
  LEARNING_GUIDANCE: "Oppimise ja juhendamise abi",
  SOCIAL_SUPPORT: "Seltskond ja sotsiaalne tugi",
  ADMIN_FORM_HELP: "Asjaajamise ja vormide abi",
  OTHER: "Muu abi"
});

const TARGET_GROUP_LABELS = Object.freeze({
  CHILD: "Laps",
  YOUTH: "Noor",
  ADULT: "Taiskasvanu",
  ELDER: "Eakas"
});

function enabled(value = "") {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

export function isHelpAiExtractorEnabled(env = process.env) {
  const configured = String(env.HELP_WORKFLOW_AI_EXTRACTOR ?? "").trim();
  if (!configured) return true;
  return enabled(configured);
}

function getHelpAiExtractorModel(env = process.env) {
  return String(env.HELP_WORKFLOW_EXTRACTOR_MODEL || DEFAULT_HELP_AI_EXTRACTOR_MODEL).trim() || DEFAULT_HELP_AI_EXTRACTOR_MODEL;
}

function collapseWhitespace(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function uniqueStrings(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => collapseWhitespace(value)).filter(Boolean)));
}

function normalizeCode(value = "") {
  return collapseWhitespace(value).toUpperCase();
}

function allowedPatchFields(activeField = "", state = {}) {
  const key = String(state?.activeQuestionKey || activeField || "").trim();
  const layer = String(state?.activeQuestionLayer || "").trim();
  const fields = new Set();

  if (!key || key === "description") {
    [
      "description",
      "categoryCode",
      "targetGroupCodes",
      "targetGroups",
      "beneficiaryLabel",
      "rawPlace",
      "helpType",
      "timeType",
      "availabilityOrStart",
      "urgency",
      "compensationDetails",
      "providerScopeOrConditions",
      "conditions",
      "skillsOrBackground"
    ].forEach((field) => fields.add(field));
    return fields;
  }

  if (key === "categoryCode") {
    fields.add("categoryCode");
    fields.add("description");
  }
  if (key === "offerAudience" || key === "requestAudience" || key === "targetGroupCodes") {
    fields.add("targetGroupCodes");
    fields.add("targetGroups");
    if (state?.intent === "create_help_request") fields.add("beneficiaryLabel");
  }
  if (key === "rawPlace" || key === "municipality_confirmation") fields.add("rawPlace");
  if (key === "timing") {
    fields.add("timeType");
    fields.add("availabilityOrStart");
    if (state?.intent === "create_help_request") fields.add("urgency");
  }
  if (key === "helpCompensation") {
    fields.add("helpType");
    fields.add("compensationDetails");
  }
  if (layer === "enrichment") {
    fields.add("extraNotes");
    if (key === "create_help_offer:conditions") {
      fields.add("providerScopeOrConditions");
      fields.add("conditions");
    } else {
      fields.add("description");
      fields.add("skillsOrBackground");
    }
  }

  return fields;
}

function safeTextPatch(value, max = 500) {
  const normalized = collapseWhitespace(value);
  return normalized ? normalized.slice(0, max) : "";
}

function applySafePatch(state, rawPatch = {}, activeField = "") {
  if (!state || typeof state !== "object" || !rawPatch || typeof rawPatch !== "object") return null;
  const confidence = String(rawPatch.confidence || "").trim().toLowerCase();
  if (confidence && confidence !== "high" && confidence !== "medium") return null;

  const allowed = allowedPatchFields(activeField, state);
  const draft = { ...(state.draft || {}) };
  let changed = false;

  if (allowed.has("description") && Object.prototype.hasOwnProperty.call(rawPatch, "description")) {
    const value = safeTextPatch(rawPatch.description, 1200);
    if (value) {
      draft.description = value;
      changed = true;
    }
  }

  if (allowed.has("categoryCode") && Object.prototype.hasOwnProperty.call(rawPatch, "categoryCode")) {
    const code = normalizeCode(rawPatch.categoryCode);
    if (ALLOWED_CATEGORY_CODES.has(code)) {
      draft.categoryCode = code;
      draft.category = CATEGORY_LABELS[code] || draft.category || "";
      changed = true;
    }
  }

  if (allowed.has("targetGroupCodes") && Object.prototype.hasOwnProperty.call(rawPatch, "targetGroupCodes")) {
    const codes = uniqueStrings(rawPatch.targetGroupCodes).map((value) => normalizeCode(value)).filter((code) => ALLOWED_TARGET_GROUP_CODES.has(code));
    if (codes.length) {
      draft.targetGroupCodes = codes;
      draft.targetGroups = codes.map((code) => TARGET_GROUP_LABELS[code]).filter(Boolean);
      draft.targetGroup = draft.targetGroups.join(", ");
      changed = true;
    }
  }

  const textFields = [
    ["beneficiaryLabel", 120],
    ["rawPlace", 160],
    ["availabilityOrStart", 240],
    ["urgency", 120],
    ["compensationDetails", 240],
    ["providerScopeOrConditions", 500],
    ["conditions", 500],
    ["skillsOrBackground", 500],
    ["extraNotes", 500]
  ];
  for (const [field, max] of textFields) {
    if (!allowed.has(field) || !Object.prototype.hasOwnProperty.call(rawPatch, field)) continue;
    const value = safeTextPatch(rawPatch[field], max);
    if (value) {
      draft[field] = value;
      changed = true;
    }
  }

  if (allowed.has("helpType") && Object.prototype.hasOwnProperty.call(rawPatch, "helpType")) {
    const value = normalizeCode(rawPatch.helpType);
    if (ALLOWED_HELP_TYPES.has(value)) {
      draft.helpType = value;
      changed = true;
    }
  }

  if (allowed.has("timeType") && Object.prototype.hasOwnProperty.call(rawPatch, "timeType")) {
    const value = normalizeCode(rawPatch.timeType);
    if (ALLOWED_TIME_TYPES.has(value)) {
      draft.timeType = value;
      changed = true;
    }
  }

  return changed ? { ...state, draft } : null;
}

function extractResponseText(response = {}) {
  if (typeof response?.output_text === "string") return response.output_text;
  const parts = [];
  for (const item of Array.isArray(response?.output) ? response.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n");
}

function parseJsonObject(text = "") {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {}
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function buildPromptPayload({ previousState, state, message, activeField }) {
  return {
    task: "Return a minimal JSON patch for an Estonian help request/help offer draft.",
    intent: state?.intent || previousState?.intent || "",
    activeQuestionKey: state?.activeQuestionKey || previousState?.activeQuestionKey || activeField || "",
    activeQuestionLayer: state?.activeQuestionLayer || previousState?.activeQuestionLayer || "",
    userMessage: String(message || "").trim(),
    previousDraft: previousState?.draft || {},
    ruleDraft: state?.draft || {},
    allowedFields: Array.from(allowedPatchFields(activeField, state)),
    enums: {
      categoryCode: Array.from(ALLOWED_CATEGORY_CODES),
      targetGroupCodes: Array.from(ALLOWED_TARGET_GROUP_CODES),
      helpType: Array.from(ALLOWED_HELP_TYPES),
      timeType: Array.from(ALLOWED_TIME_TYPES)
    }
  };
}

export async function refineHelpDraftWithAi({
  previousState,
  state,
  message,
  activeField = "",
  createHelpWorkflowDraftState,
  env = process.env
} = {}) {
  if (!isHelpAiExtractorEnabled(env)) return null;
  if (!env.OPENAI_API_KEY) return null;

  try {
    const { default: OpenAI } = await import("openai");
    const model = getHelpAiExtractorModel(env);
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: [
            "You are a conservative structured-data patcher.",
            "Use only the user message and the provided drafts.",
            "Return only one JSON object. No markdown.",
            "Do not invent details. Use null or omit fields when unsure.",
            "Do not change fields outside allowedFields.",
            "If the active question is categoryCode, preserve concrete activity details in description.",
            "If this is a category enrichment question, improve description or extraNotes; do not put the answer in providerScopeOrConditions unless the key is create_help_offer:conditions.",
            "Use confidence high, medium, or low."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify(buildPromptPayload({ previousState, state, message, activeField }))
        }
      ],
      text: { verbosity: "low" },
      reasoning: { effort: "low" },
      max_output_tokens: 700
    }, {
      timeout: Math.max(1000, Number(env.HELP_WORKFLOW_AI_TIMEOUT_MS) || 8000)
    });

    const parsed = parseJsonObject(extractResponseText(response));
    const patched = applySafePatch(state, parsed, activeField);
    return patched && typeof createHelpWorkflowDraftState === "function"
      ? createHelpWorkflowDraftState(patched)
      : patched;
  } catch (error) {
    try {
      console.warn("[help_ai_extractor] skipped", error?.message || "unknown error");
    } catch {}
    return null;
  }
}
