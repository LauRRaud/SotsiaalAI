const DOCUMENT_WORKFLOW_STEP_VALUES = Object.freeze([
  "collect_required_fields",
  "collect_conditional_fields",
  "preview",
  "edit_or_generate",
  "done"
]);

function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizeDraft(input = {}) {
  return {
    documentType: normalizeString(input.documentType),
    artifactType: normalizeString(input.artifactType),
    purpose: normalizeString(input.purpose),
    recipient: normalizeString(input.recipient),
    sourceMode: normalizeString(input.sourceMode),
    sourceDetails: normalizeString(input.sourceDetails),
    background: normalizeString(input.background),
    subjectLabel: normalizeString(input.subjectLabel),
    language: normalizeString(input.language),
    tone: normalizeString(input.tone),
    length: normalizeString(input.length),
    templatePreference: normalizeString(input.templatePreference),
    deadline: normalizeString(input.deadline),
    reportPeriod: normalizeString(input.reportPeriod),
    recipientDetail: normalizeString(input.recipientDetail)
  };
}

function isDocumentWorkflowStep(value = "") {
  return DOCUMENT_WORKFLOW_STEP_VALUES.includes(normalizeString(value));
}

export function createDocumentWorkflowState(input = {}) {
  return {
    namespace: "document",
    step: isDocumentWorkflowStep(input?.step) ? normalizeString(input.step) : "collect_required_fields",
    flowLocked: input?.flowLocked === true,
    confirmationPending: input?.confirmationPending === true,
    optionalPromptShown: input?.optionalPromptShown === true,
    sourceMessage: normalizeString(input?.sourceMessage),
    missingFields: Array.isArray(input?.missingFields)
      ? input.missingFields.map((item) => normalizeString(item)).filter(Boolean)
      : [],
    draft: normalizeDraft(input?.draft || {}),
    updatedAt: new Date().toISOString()
  };
}

export function normalizeDocumentWorkflowState(value) {
  if (!value || typeof value !== "object") return null;
  if (normalizeString(value?.namespace) !== "document") return null;
  return createDocumentWorkflowState(value);
}

export function isActiveDocumentWorkflowState(value) {
  const state = normalizeDocumentWorkflowState(value);
  if (!state) return false;
  return state.flowLocked || state.confirmationPending === true || state.step === "preview" || state.step === "edit_or_generate";
}
