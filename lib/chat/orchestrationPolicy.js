export const WORK_MODES = Object.freeze({
  GENERAL_QUESTION: "general_question",
  SERVICE_GUIDANCE: "service_guidance",
  BROWSE_HELP_REQUESTS: "browse_help_requests",
  BROWSE_HELP_OFFERS: "browse_help_offers",
  CREATE_HELP_REQUEST: "create_help_request",
  CREATE_HELP_OFFER: "create_help_offer",
  CONNECT_TO_REQUEST: "connect_to_request",
  CONNECT_TO_OFFER: "connect_to_offer",
  DOCUMENT_DRAFTING: "document_drafting",
  REPORT_DRAFTING: "report_drafting",
  MATCH_OR_HANDOFF: "match_or_handoff"
});

const REASONING_DEPTH = Object.freeze({
  LOW: "low"
});

const COMPLEXITY = Object.freeze({
  SIMPLE: "simple",
  NORMAL: "normal",
  COMPLEX: "complex"
});

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .trim();
}

function detectWorkflowStep(state = {}) {
  if (!state?.intent) return "detect";
  if (state?.confirmationPending) return "confirm";
  if (state?.mode === "browse") return "browse";
  if (state?.step === "connect" || state?.mode === "done") return "connect";
  if (state?.step === "done") return "save";
  if (Array.isArray(state?.missingFields) && state.missingFields.length > 0) {
    return state?.draft?.description ? "refine" : "extract";
  }
  return state?.draft?.description ? "refine" : "extract";
}

export function countClarifyingTurns(history = []) {
  if (!Array.isArray(history) || !history.length) return 0;
  let count = 0;
  for (let i = history.length - 1; i >= 0 && i >= history.length - 8; i -= 1) {
    const entry = history[i];
    const role = String(entry?.role || "").toLowerCase();
    const text = String(entry?.text || entry?.content || "").trim();
    if (role === "ai" && /\?/.test(text)) {
      count += 1;
    }
  }
  return count;
}

export function inferRequestedThoroughness(message = "") {
  const normalized = normalizeText(message);
  return /\b(pohjalik|thorough|detailed|detailne|analyys|analuus|analysis|ametlik|formal)\b/.test(normalized);
}

function detectComplexitySignals(input = {}) {
  const message = String(input?.message || "").trim();
  const state = input?.workflowState || {};
  const sourceCount = Number(input?.sourceCount || 0);
  const clarifyingTurns = Number(input?.clarifyingTurns || 0);
  const missingFields = Array.isArray(state?.missingFields) ? state.missingFields.length : 0;
  const requestedThoroughness = Boolean(input?.requestedThoroughness);
  const normalized = normalizeText(message);

  return {
    longInput: message.length > 280,
    multiQuestion: (message.match(/\?/g) || []).length > 1,
    hybridTask: Boolean(input?.hybridTask),
    manySources: sourceCount >= 3,
    manyClarifications: clarifyingTurns >= 2,
    manyMissingFields: missingFields >= 3,
    requestedThoroughness,
    formalOutput:
      input?.intent === WORK_MODES.REPORT_DRAFTING ||
      /\b(aruanne|report|formal|ametlik|kokkuvote|kokkuvote|analysis)\b/.test(normalized)
  };
}

function detectComplexity(input = {}) {
  const flags = detectComplexitySignals(input);

  if (flags.formalOutput || flags.manySources || (flags.hybridTask && flags.manyClarifications)) {
    return COMPLEXITY.COMPLEX;
  }

  if (
    flags.longInput ||
    flags.multiQuestion ||
    flags.hybridTask ||
    flags.manyClarifications ||
    flags.manyMissingFields ||
    flags.requestedThoroughness
  ) {
    return COMPLEXITY.NORMAL;
  }

  return COMPLEXITY.SIMPLE;
}

function chooseReasoningDepth() {
  return REASONING_DEPTH.LOW;
}

function resolveCapability(intent = "") {
  switch (intent) {
    case WORK_MODES.BROWSE_HELP_REQUESTS:
    case WORK_MODES.BROWSE_HELP_OFFERS:
      return "structured_retrieval";
    case WORK_MODES.CREATE_HELP_REQUEST:
    case WORK_MODES.CREATE_HELP_OFFER:
      return "help_workflow";
    case WORK_MODES.CONNECT_TO_REQUEST:
    case WORK_MODES.CONNECT_TO_OFFER:
    case WORK_MODES.MATCH_OR_HANDOFF:
      return "match_and_room";
    case WORK_MODES.DOCUMENT_DRAFTING:
    case WORK_MODES.REPORT_DRAFTING:
      return "document_workflow";
    case WORK_MODES.SERVICE_GUIDANCE:
      return "rag_guidance";
    default:
      return "assistant";
  }
}

function resolveUserVisibleMode(intent = "") {
  switch (intent) {
    case WORK_MODES.CREATE_HELP_REQUEST:
    case WORK_MODES.CREATE_HELP_OFFER:
      return "agent_workflow";
    default:
      return "assistant";
  }
}

export function chooseOrchestrationPlan(input = {}) {
  const intent = input?.intent || WORK_MODES.GENERAL_QUESTION;
  const step = input?.step || detectWorkflowStep(input?.workflowState);
  const complexity = detectComplexity(input);
  const reasoning = chooseReasoningDepth({
    ...input,
    intent,
    step,
    complexity
  });

  return {
    mode: intent,
    step,
    complexity,
    reasoning,
    capability: resolveCapability(intent),
    userVisibleMode: resolveUserVisibleMode(intent)
  };
}
