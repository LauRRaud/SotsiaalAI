import { helpWorkflowT } from "./chatWorkflowText.js";

const SHARED_BASIC_FIELD_ORDER = Object.freeze([
  "description",
  "categoryCode",
  "rawPlace",
  "timing",
  "helpCompensation"
]);

const HELP_REQUEST_BASIC_FIELD_ORDER = Object.freeze([
  "requestAudience"
]);

const HELP_OFFER_BASIC_FIELD_ORDER = Object.freeze([
  "offerAudience"
]);

const REQUEST_ENRICHMENT_PROMPT_KEYS = Object.freeze({
  TRANSPORT: "questions.request.category.TRANSPORT",
  DAILY_TASKS: "questions.request.category.DAILY_TASKS",
  HOME_HELP: "questions.request.category.HOME_HELP",
  DIGITAL_HELP: "questions.request.category.DIGITAL_HELP",
  CARE_SUPPORT: "questions.request.category.CARE_SUPPORT",
  CHILD_YOUTH_SUPPORT: "questions.request.category.CHILD_YOUTH_SUPPORT",
  LEARNING_GUIDANCE: "questions.request.category.LEARNING_GUIDANCE",
  SOCIAL_SUPPORT: "questions.request.category.SOCIAL_SUPPORT",
  ADMIN_FORM_HELP: "questions.request.category.ADMIN_FORM_HELP",
  OTHER: "questions.request.category.OTHER"
});

const OFFER_ENRICHMENT_PROMPT_KEYS = Object.freeze({
  TRANSPORT: "questions.offer.category.TRANSPORT",
  DAILY_TASKS: "questions.offer.category.DAILY_TASKS",
  HOME_HELP: "questions.offer.category.HOME_HELP",
  DIGITAL_HELP: "questions.offer.category.DIGITAL_HELP",
  CARE_SUPPORT: "questions.offer.category.CARE_SUPPORT",
  CHILD_YOUTH_SUPPORT: "questions.offer.category.CHILD_YOUTH_SUPPORT",
  LEARNING_GUIDANCE: "questions.offer.category.LEARNING_GUIDANCE",
  SOCIAL_SUPPORT: "questions.offer.category.SOCIAL_SUPPORT",
  ADMIN_FORM_HELP: "questions.offer.category.ADMIN_FORM_HELP",
  OTHER: "questions.offer.category.OTHER"
});

const OFFER_CONDITIONS_ENRICHMENT_KEY = "create_help_offer:conditions";

function formatMunicipalityCandidateList(candidates = []) {
  return candidates
    .map((candidate, index) => `${index + 1}. ${candidate.displayName}${candidate.county ? ` (${candidate.county})` : ""}`)
    .join("\n");
}

function hasTargetAudienceSignal(draft = {}) {
  return Boolean(
    String(draft?.targetGroup || "").trim()
    || (Array.isArray(draft?.targetGroups) && draft.targetGroups.length)
    || (Array.isArray(draft?.targetGroupCodes) && draft.targetGroupCodes.length)
  );
}

function hasRequestAudienceSignal(draft = {}) {
  return Boolean(String(draft?.beneficiaryLabel || "").trim() || hasTargetAudienceSignal(draft));
}

function needsCompensationDetails(draft = {}) {
  return draft?.helpType === "PAID";
}

function hasRequestTimingInfo(draft = {}) {
  return Boolean(draft?.availabilityOrStart && draft?.timeType && draft?.urgency);
}

function hasOfferTimingInfo(draft = {}) {
  return Boolean(draft?.availabilityOrStart && draft?.timeType);
}

function isSparseDescription(text = "") {
  const normalized = String(text || "").trim();
  if (!normalized) return true;
  const words = normalized.split(/\s+/).filter(Boolean).length;
  return normalized.length < 40 || words < 6;
}

function hasSpecificCategoryDetail(description = "", categoryCode = "") {
  const normalized = String(description || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\d]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;

  switch (String(categoryCode || "").trim().toUpperCase()) {
    case "HOME_HELP":
      return /\b(koristan|koristada|koristus|pesen|pesta|porand|porandaid|puhastan|koogi|kooki|aknaid|tolmu|majapidamine)\b/u.test(normalized);
    case "DIGITAL_HELP":
      return /\b(arvuti|telefon|nutiseade|id kaart|smart id|e teenus|digiretsept|avalduse|internet)\b/u.test(normalized);
    case "TRANSPORT":
      return /\b(viin|soidan|soit|autoga|transport|arstile|poodi|kaasa)\b/u.test(normalized);
    case "DAILY_TASKS":
      return /\b(pood|ostud|asjaajamine|toimetus|ravimid|apteek|saadan|kaasa)\b/u.test(normalized);
    default:
      return false;
  }
}

function getEnrichmentKey(intent = "", categoryCode = "") {
  const normalizedCategory = String(categoryCode || "").trim().toUpperCase();
  if (!normalizedCategory) return "";
  return `${intent}:${normalizedCategory}`;
}

function getEnrichmentPromptKey(intent = "", categoryCode = "") {
  const normalizedCategory = String(categoryCode || "").trim().toUpperCase();
  if (!normalizedCategory) return "";
  const source = intent === "create_help_offer" ? OFFER_ENRICHMENT_PROMPT_KEYS : REQUEST_ENRICHMENT_PROMPT_KEYS;
  return source[normalizedCategory] || "";
}

export function buildBroadPrompt(intent, replyLang) {
  return helpWorkflowT(
    replyLang,
    intent === "create_help_offer" ? "questions.offer.describe" : "questions.request.describe"
  );
}

export function createHelpQuestionFlow({ normalizeDraft, inferCategoryFromText }) {
  function computeMissingFields(state) {
    const draft = normalizeDraft(state?.draft || {});
    const required = [...SHARED_BASIC_FIELD_ORDER];
    if (state.intent === "create_help_request") required.push(...HELP_REQUEST_BASIC_FIELD_ORDER);
    if (state.intent === "create_help_offer") required.push(...HELP_OFFER_BASIC_FIELD_ORDER);

    return required.filter((field) => {
      if (field === "description") return !draft.description;
      if (field === "categoryCode") return !draft.categoryCode;
      if (field === "requestAudience") return !hasRequestAudienceSignal(draft);
      if (field === "offerAudience") return !hasTargetAudienceSignal(draft);
      if (field === "rawPlace") return !draft.rawPlace;
      if (field === "timing") {
        return state.intent === "create_help_request"
          ? !hasRequestTimingInfo(draft)
          : !hasOfferTimingInfo(draft);
      }
      if (field === "helpCompensation") {
        return !draft.helpType || (needsCompensationDetails(draft) && !draft.compensationDetails);
      }
      return !draft[field];
    });
  }

  function nextMissingField(state) {
    if (state?.municipalityCandidates?.length) return "municipality_confirmation";
    const missing = computeMissingFields(state);
    const ordered = state.intent === "create_help_request"
      ? [
          "description",
          "categoryCode",
          "requestAudience",
          "rawPlace",
          "timing",
          "helpCompensation"
        ]
      : [
          "description",
          "categoryCode",
          "offerAudience",
          "rawPlace",
          "timing",
          "helpCompensation"
        ];
    for (const field of ordered) {
      if (missing.includes(field)) return field;
    }
    return missing[0] || null;
  }

  function buildBasicQuestion(state, replyLang, missingField) {
    const draft = normalizeDraft(state?.draft || {});
    if (missingField === "municipality_confirmation") {
      if (state.municipalityCandidates.length === 1) {
        const candidate = state.municipalityCandidates[0];
        return {
          layer: "basic",
          key: "municipality_confirmation",
          prompt: helpWorkflowT(replyLang, "questions.location.confirmSingle", {
            municipality: candidate.displayName
          })
        };
      }

      return {
        layer: "basic",
        key: "municipality_confirmation",
        prompt: [
          helpWorkflowT(replyLang, "questions.location.confirmMany"),
          "",
          formatMunicipalityCandidateList(state.municipalityCandidates),
          "",
          helpWorkflowT(replyLang, "questions.location.confirmManyHint")
        ].join("\n")
      };
    }

    const questions = {
      description: buildBroadPrompt(state.intent, replyLang),
      categoryCode: helpWorkflowT(replyLang, "questions.shared.category"),
      requestAudience: helpWorkflowT(replyLang, "questions.request.beneficiary"),
      offerAudience: helpWorkflowT(replyLang, "questions.shared.targetGroup"),
      rawPlace: helpWorkflowT(replyLang, state.intent === "create_help_offer" ? "questions.offer.rawPlace" : "questions.request.rawPlace"),
      timing: helpWorkflowT(replyLang, state.intent === "create_help_offer" ? "questions.offer.availability" : "questions.request.availability"),
      helpCompensation: helpWorkflowT(replyLang, state.intent === "create_help_offer" ? "questions.offer.helpType" : "questions.request.helpType")
    };

    if (!questions[missingField]) return null;
    if (missingField === "timing" && draft.availabilityOrStart && !draft.timeType) {
      return {
        layer: "basic",
        key: missingField,
        prompt: helpWorkflowT(replyLang, state.intent === "create_help_offer" ? "questions.offer.timeType" : "questions.request.timeType")
      };
    }
    return {
      layer: "basic",
      key: missingField,
      prompt: questions[missingField]
    };
  }

  function buildEnrichmentQuestion(state, replyLang) {
    if (state?.municipalityCandidates?.length) return null;
    const draft = normalizeDraft(state?.draft || {});
    const askedEnrichmentKeys = Array.isArray(state?.askedEnrichmentKeys) ? state.askedEnrichmentKeys : [];
    const askedOfferCategoryEnrichment = askedEnrichmentKeys.some((key) => {
      const normalized = String(key || "");
      return normalized.startsWith("create_help_offer:") && normalized !== OFFER_CONDITIONS_ENRICHMENT_KEY;
    });
    const inferredCategory = inferCategoryFromText(draft.description || "", draft.categoryCode || "");
    const categoryCode = String(inferredCategory?.categoryCode || draft.categoryCode || "").trim().toUpperCase();
    if (categoryCode && isSparseDescription(draft.description) && !hasSpecificCategoryDetail(draft.description, categoryCode)) {
      const enrichmentKey = getEnrichmentKey(state.intent, categoryCode);
      const promptKey = getEnrichmentPromptKey(state.intent, categoryCode);
      if (enrichmentKey && promptKey && !askedEnrichmentKeys.includes(enrichmentKey)) {
        return {
          layer: "enrichment",
          key: enrichmentKey,
          prompt: helpWorkflowT(replyLang, promptKey)
        };
      }
    }

    if (
      state.intent === "create_help_offer"
      && !draft.providerScopeOrConditions
      && !draft.conditions
      && !askedOfferCategoryEnrichment
      && !askedEnrichmentKeys.includes(OFFER_CONDITIONS_ENRICHMENT_KEY)
    ) {
      return {
        layer: "enrichment",
        key: OFFER_CONDITIONS_ENRICHMENT_KEY,
        prompt: helpWorkflowT(replyLang, "questions.offer.conditionsOptional")
      };
    }

    return null;
  }

  function getNextQuestion(state, replyLang) {
    const missingField = nextMissingField(state);
    if (missingField) return buildBasicQuestion(state, replyLang, missingField);
    return buildEnrichmentQuestion(state, replyLang);
  }

  function buildFieldQuestion(state, replyLang) {
    return getNextQuestion(state, replyLang)?.prompt || "";
  }

  return {
    buildFieldQuestion,
    computeMissingFields,
    getNextQuestion,
    nextMissingField
  };
}
