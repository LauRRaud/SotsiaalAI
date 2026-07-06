const HEALTH_PRIMARY_PATHS = Object.freeze([
  "HEALTH_CONTACT",
  "COMBINED_SOCIAL_HEALTH"
]);

const HEALTH_ACTION_TYPES = Object.freeze([
  "CREATE_HEALTH_CONTACT_QUESTIONS",
  "CONTACT_HEALTH_PROVIDER",
  "OPEN_HEALTH_CONTACT"
]);

const HEALTH_DOMAIN_PATTERNS = Object.freeze([
  /tervis/iu,
  /perearst/iu,
  /tervisekeskus/iu,
  /tervisen[\u00f5o]u/iu,
  /arst/iu,
  /haigus/iu,
  /ravij[\u00e4a]rgne/iu,
  /liikumispiirang/iu,
  /tervisega seotud/iu,
  /physical[_\s-]?health/iu,
  /health[_\s-]?contact/iu
]);

const DEFAULT_DRAFT_COPY = Object.freeze({
  title: "Health contact questions draft",
  situationLabel: "Briefly describe my situation:",
  situationPlaceholder: "[add a short situation description]",
  clarificationLabel: "I would like to clarify:",
  clarificationPlaceholder: "[add what you want to clarify with the health contact]",
  contactQuestion: "Should I contact a family doctor center, health center, or official health advice contact about this question?",
  preparationQuestion: "What information or document would be useful to prepare before contacting them?",
  dailyLifeQuestion: "Could this topic affect my daily coping, work, study, or existing support?"
});

export function hasHealthContactSignal(journey = {}) {
  const context = journey.context && typeof journey.context === "object" && !Array.isArray(journey.context)
    ? journey.context
    : {};
  if (HEALTH_PRIMARY_PATHS.includes(String(journey.primaryPath || "").toUpperCase())) return true;
  if (context.healthContact && typeof context.healthContact === "object") return true;

  const domains = Array.isArray(journey.domains) ? journey.domains : [];
  if (domains.some((domain) => HEALTH_DOMAIN_PATTERNS.some((pattern) => pattern.test(String(domain || ""))))) {
    return true;
  }

  const actions = Array.isArray(journey.suggestedActions) ? journey.suggestedActions : [];
  return actions.some((action) => HEALTH_ACTION_TYPES.includes(String(action?.type || action).toUpperCase()));
}

export function buildHealthContactQuestionsDraft(journey = {}, copy = {}) {
  const context = journey.context && typeof journey.context === "object" && !Array.isArray(journey.context)
    ? journey.context
    : {};
  const healthContext = context.healthContact && typeof context.healthContact === "object" && !Array.isArray(context.healthContact)
    ? context.healthContact
    : {};
  const summary = String(journey.summary || "").trim();
  const clarification = String(healthContext.userQuestion || healthContext.goal || "").trim();
  const labels = { ...DEFAULT_DRAFT_COPY, ...copy };

  return [
    labels.title,
    "",
    labels.situationLabel,
    summary || labels.situationPlaceholder,
    "",
    labels.clarificationLabel,
    clarification || labels.clarificationPlaceholder,
    "",
    labels.contactQuestion,
    labels.preparationQuestion,
    labels.dailyLifeQuestion
  ].join("\n");
}
