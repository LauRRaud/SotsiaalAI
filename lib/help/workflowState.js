import { isHelpChatIntent } from "./intents.js";

const HELP_WORKFLOW_STEP_VALUES = Object.freeze([
  "intent_confirmation",
  "collect_required_fields",
  "collect_conditional_fields",
  "preview",
  "edit_or_save",
  "browse",
  "connect",
  "saved",
  "done"
]);

const HELP_WORKFLOW_MODE_VALUES = Object.freeze([
  "draft",
  "browse",
  "saved",
  "done"
]);

function entityKindFromIntent(intent) {
  if (intent === "create_help_request" || intent === "browse_help_requests" || intent === "connect_to_request") {
    return "HELP_REQUEST";
  }
  if (intent === "create_help_offer" || intent === "browse_help_offers" || intent === "connect_to_offer") {
    return "HELP_OFFER";
  }
  return "HELP";
}

function defaultStepFromIntent(intent) {
  if (intent === "browse_help_requests" || intent === "browse_help_offers") return "browse";
  if (intent === "connect_to_offer" || intent === "connect_to_request") return "connect";
  return "intent_confirmation";
}

/**
 * @typedef {Object} HelpWorkflowDraftState
 * @property {"help"} namespace
 * @property {string} mode
 * @property {string|null} intent
 * @property {string} entityKind
 * @property {string} step
 * @property {boolean} flowLocked
 * @property {string|null} municipalityId
 * @property {string} municipalityLabel
 * @property {Array<{ id: string, displayName: string, county: string, type?: string }>} municipalityCandidates
 * @property {Array<string>} missingFields
 * @property {string|null} activeQuestionLayer
 * @property {string|null} activeQuestionKey
 * @property {Array<string>} askedEnrichmentKeys
 * @property {boolean} confirmationPending
 * @property {string} sourceMessage
 * @property {string|null} sourceRecordId
 * @property {{ title: string, description: string, category: string, categoryCode: string, secondaryCategories: string[], secondaryCategoryCodes: string[], serviceLabel: string, helpType: string, timeType: string, targetGroup: string, targetGroups: string[], targetGroupCodes: string[], rawPlace: string, availabilityOrStart: string, contactPreference: string, compensationDetails: string, beneficiaryLabel: string, urgency: string, providerScopeOrConditions: string, conditions: string, skillsOrBackground: string, accessibilityNotes: string, languagePreference: string, structuredSummary: string, extraNotes: string }} draft
 * @property {string|null} candidateRequestId
 * @property {string|null} candidateOfferId
 * @property {Array<{ requestId: string, offerId: string }>} candidateMatches
 * @property {string|null} linkedRequestId
 * @property {string|null} linkedOfferId
 * @property {Array<{ id: string, kind: string, title: string, description: string, municipalityName: string, score: number, helpType?: string, timeType?: string, compatibilityWarnings?: string[], compatibilitySummary?: string, requiresConfirmation?: boolean, listingView?: { id: string, kind: string, title: string, summary: string, categoryLabel: string, municipalityLabel: string, helpTypeLabel: string, timeTypeLabel: string, roleLabel: string, statusLabel: string, targetGroupLabels: string[] } }>} browseResults
 * @property {string|null} matchId
 * @property {string|null} roomId
 * @property {string} updatedAt
 */

export function createHelpWorkflowDraftState(input = {}) {
  const intent = input?.intent ? String(input.intent).trim() : null;
  if (intent && !isHelpChatIntent(intent)) {
    const error = new Error("HELP_WORKFLOW_INTENT_INVALID");
    error.code = "HELP_WORKFLOW_INTENT_INVALID";
    throw error;
  }

  return {
    namespace: "help",
    mode: HELP_WORKFLOW_MODE_VALUES.includes(String(input?.mode || "").trim())
      ? String(input.mode).trim()
      : "draft",
    intent,
    entityKind: entityKindFromIntent(intent),
    step: isHelpWorkflowStep(input?.step) ? String(input.step).trim() : defaultStepFromIntent(intent),
    flowLocked: input?.flowLocked === true,
    municipalityId: String(input?.municipalityId || "").trim() || null,
    municipalityLabel: String(input?.municipalityLabel || "").trim(),
    municipalityCandidates: Array.isArray(input?.municipalityCandidates)
      ? input.municipalityCandidates
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            id: String(item.id || "").trim(),
            displayName: String(item.displayName || item.name || "").trim(),
            county: String(item.county || "").trim(),
            type: String(item.type || "").trim()
          }))
          .filter((item) => item.id && item.displayName)
      : [],
    missingFields: Array.isArray(input?.missingFields)
      ? input.missingFields.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
    activeQuestionLayer: String(input?.activeQuestionLayer || "").trim() || null,
    activeQuestionKey: String(input?.activeQuestionKey || "").trim() || null,
    askedEnrichmentKeys: Array.isArray(input?.askedEnrichmentKeys)
      ? input.askedEnrichmentKeys.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
    confirmationPending: input?.confirmationPending === true,
    sourceMessage: String(input?.sourceMessage || "").trim(),
    sourceRecordId: String(input?.sourceRecordId || "").trim() || null,
    draft: {
      title: String(input?.draft?.title || "").trim(),
      description: String(input?.draft?.description || "").trim(),
      category: String(input?.draft?.category || "").trim(),
      categoryCode: String(input?.draft?.categoryCode || "").trim(),
      secondaryCategories: Array.isArray(input?.draft?.secondaryCategories)
        ? input.draft.secondaryCategories.map((item) => String(item || "").trim()).filter(Boolean)
        : [],
      secondaryCategoryCodes: Array.isArray(input?.draft?.secondaryCategoryCodes)
        ? input.draft.secondaryCategoryCodes.map((item) => String(item || "").trim()).filter(Boolean)
        : [],
      serviceLabel: String(input?.draft?.serviceLabel || "").trim(),
      helpType: String(input?.draft?.helpType || "").trim(),
      timeType: String(input?.draft?.timeType || "").trim(),
      targetGroup: String(input?.draft?.targetGroup || "").trim(),
      targetGroups: Array.isArray(input?.draft?.targetGroups)
        ? input.draft.targetGroups.map((item) => String(item || "").trim()).filter(Boolean)
        : [],
      targetGroupCodes: Array.isArray(input?.draft?.targetGroupCodes)
        ? input.draft.targetGroupCodes.map((item) => String(item || "").trim()).filter(Boolean)
        : [],
      rawPlace: String(input?.draft?.rawPlace || "").trim(),
      availabilityOrStart: String(input?.draft?.availabilityOrStart || "").trim(),
      contactPreference: String(input?.draft?.contactPreference || "").trim(),
      compensationDetails: String(input?.draft?.compensationDetails || "").trim(),
      beneficiaryLabel: String(input?.draft?.beneficiaryLabel || "").trim(),
      urgency: String(input?.draft?.urgency || "").trim(),
      providerScopeOrConditions: String(input?.draft?.providerScopeOrConditions || "").trim(),
      conditions: String(input?.draft?.conditions || "").trim(),
      skillsOrBackground: String(input?.draft?.skillsOrBackground || "").trim(),
      accessibilityNotes: String(input?.draft?.accessibilityNotes || "").trim(),
      languagePreference: String(input?.draft?.languagePreference || "").trim(),
      structuredSummary: String(input?.draft?.structuredSummary || "").trim(),
      extraNotes: String(input?.draft?.extraNotes || "").trim()
    },
    candidateRequestId: String(input?.candidateRequestId || "").trim() || null,
    candidateOfferId: String(input?.candidateOfferId || "").trim() || null,
    candidateMatches: Array.isArray(input?.candidateMatches)
      ? input.candidateMatches
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            requestId: String(item.requestId || "").trim(),
            offerId: String(item.offerId || "").trim()
          }))
          .filter((item) => item.requestId && item.offerId)
      : [],
    linkedRequestId: String(input?.linkedRequestId || "").trim() || null,
    linkedOfferId: String(input?.linkedOfferId || "").trim() || null,
    browseResults: Array.isArray(input?.browseResults)
      ? input.browseResults
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            id: String(item.id || "").trim(),
            kind: String(item.kind || "").trim(),
            title: String(item.title || "").trim(),
            description: String(item.description || "").trim(),
            municipalityName: String(item.municipalityName || "").trim(),
            score: Number.isFinite(Number(item.score)) ? Number(item.score) : 0,
            helpType: String(item.helpType || "").trim(),
            timeType: String(item.timeType || "").trim(),
            compatibilityWarnings: Array.isArray(item.compatibilityWarnings)
              ? item.compatibilityWarnings.map((value) => String(value || "").trim()).filter(Boolean)
              : [],
            compatibilitySummary: String(item.compatibilitySummary || "").trim(),
            requiresConfirmation: item.requiresConfirmation === true,
            listingView: item?.listingView && typeof item.listingView === "object"
              ? {
                  id: String(item.listingView.id || item.id || "").trim(),
                  kind: String(item.listingView.kind || item.kind || "").trim(),
                  title: String(item.listingView.title || "").trim(),
                  summary: String(item.listingView.summary || "").trim(),
                  categoryLabel: String(item.listingView.categoryLabel || "").trim(),
                  municipalityLabel: String(item.listingView.municipalityLabel || "").trim(),
                  helpTypeLabel: String(item.listingView.helpTypeLabel || "").trim(),
                  timeTypeLabel: String(item.listingView.timeTypeLabel || "").trim(),
                  roleLabel: String(item.listingView.roleLabel || "").trim(),
                  statusLabel: String(item.listingView.statusLabel || "").trim(),
                  targetGroupLabels: Array.isArray(item.listingView.targetGroupLabels)
                    ? item.listingView.targetGroupLabels.map((value) => String(value || "").trim()).filter(Boolean)
                    : []
                }
              : null
          }))
          .filter((item) => item.id && item.kind)
      : [],
    matchId: String(input?.matchId || "").trim() || null,
    roomId: String(input?.roomId || "").trim() || null,
    updatedAt: new Date().toISOString()
  };
}

function isHelpWorkflowStep(value) {
  return HELP_WORKFLOW_STEP_VALUES.includes(String(value || "").trim());
}

export function normalizeHelpWorkflowState(value) {
  if (!value || typeof value !== "object") return null;
  if (String(value?.namespace || "").trim() !== "help") return null;
  return createHelpWorkflowDraftState(value);
}

export function isActiveHelpWorkflowState(value) {
  const state = normalizeHelpWorkflowState(value);
  if (!state) return false;
  return state.mode === "draft" || state.mode === "browse" || state.step === "preview" || state.step === "edit_or_save" || state.confirmationPending === true;
}
