import { buildPersonalDataWarning, detectPersonalData, redactPersonalData } from "./piiFilter.js";

const PUBLIC_WORKFLOWS = new Set([
  "help_listing_public",
  "help_request_public",
  "help_offer_public",
  "rag_index"
]);

const PRIVATE_WORKFLOWS = new Set([
  "chat_private",
  "room_private",
  "pre_inquiry",
  "document_generation",
  "document_refinement"
]);

export const PRIVACY_DECISIONS = Object.freeze({
  edit: "edit",
  useRedacted: "use_redacted",
  sendOriginal: "send_original"
});

function normalizeWorkflow(value = "") {
  const workflow = String(value || "").trim().toLowerCase();
  return workflow || "chat_private";
}

function normalizeDecision(value) {
  const action = typeof value === "object" && value
    ? String(value.action || value.privacyDecision || "").trim().toLowerCase()
    : String(value || "").trim().toLowerCase();
  if (action === PRIVACY_DECISIONS.useRedacted) return PRIVACY_DECISIONS.useRedacted;
  if (action === PRIVACY_DECISIONS.sendOriginal) return PRIVACY_DECISIONS.sendOriginal;
  if (action === PRIVACY_DECISIONS.edit) return PRIVACY_DECISIONS.edit;
  return "";
}

function getPrivacyPolicyForWorkflow(workflowInput = "") {
  const workflow = normalizeWorkflow(workflowInput);
  const isPublic = PUBLIC_WORKFLOWS.has(workflow);
  const allowOriginal = !isPublic && (PRIVATE_WORKFLOWS.has(workflow) || workflow.endsWith("_private"));
  return {
    workflow,
    isPublic,
    allowOriginal,
    actions: [
      PRIVACY_DECISIONS.edit,
      PRIVACY_DECISIONS.useRedacted,
      ...(allowOriginal ? [PRIVACY_DECISIONS.sendOriginal] : [])
    ]
  };
}

export function evaluateTextPrivacy(value = "", options = {}) {
  const text = String(value || "");
  const policy = getPrivacyPolicyForWorkflow(options.workflow);
  const detection = detectPersonalData(text);
  const redaction = redactPersonalData(text);
  const decision = normalizeDecision(options.decision || options.privacyDecision);

  if (!detection.hasPersonalData) {
    return {
      ok: true,
      needsPrivacyConfirmation: false,
      workflow: policy.workflow,
      text,
      processedText: text,
      redactedText: text,
      categories: [],
      findings: [],
      spans: [],
      actions: policy.actions,
      allowOriginal: policy.allowOriginal
    };
  }

  const common = {
    workflow: policy.workflow,
    categories: detection.categories,
    findings: detection.findings,
    spans: redaction.spans.map((span) => ({
      type: span.type,
      label: span.label,
      start: span.start,
      end: span.end
    })),
    redactedText: redaction.redactedText,
    warning: buildPersonalDataWarning(detection),
    actions: policy.actions,
    allowOriginal: policy.allowOriginal
  };

  if (decision === PRIVACY_DECISIONS.useRedacted) {
    return {
      ok: true,
      needsPrivacyConfirmation: false,
      ...common,
      text,
      processedText: redaction.redactedText,
      appliedDecision: decision
    };
  }

  if (decision === PRIVACY_DECISIONS.sendOriginal && policy.allowOriginal) {
    return {
      ok: true,
      needsPrivacyConfirmation: false,
      ...common,
      text,
      processedText: text,
      appliedDecision: decision
    };
  }

  return {
    ok: false,
    needsPrivacyConfirmation: true,
    ...common,
    text,
    processedText: "",
    appliedDecision: decision || null
  };
}

export function privacyConfirmationResponsePayload(result) {
  return {
    ok: false,
    message: "privacy.confirmation_required",
    messageKey: "privacy.confirmation_required",
    needsPrivacyConfirmation: true,
    workflow: result.workflow,
    categories: result.categories || [],
    findings: result.findings || [],
    spans: result.spans || [],
    redactedText: result.redactedText || "",
    warning: result.warning || "",
    actions: result.actions || [],
    allowOriginal: Boolean(result.allowOriginal)
  };
}
