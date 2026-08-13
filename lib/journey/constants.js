export const JOURNEY_STATUSES = Object.freeze([
  "DRAFT",
  "ACTIVE",
  "ARCHIVED"
]);

export const JOURNEY_SHARING_STATUSES = Object.freeze([
  "PRIVATE"
]);

export const JOURNEY_ROLE_CONTEXTS = Object.freeze([
  "CLIENT",
  "SOCIAL_WORKER",
  "SERVICE_PROVIDER",
  "ADMIN"
]);

export const JOURNEY_PRIMARY_PATHS = Object.freeze([
  "SERVICE_MAP",
  "PRE_INQUIRY",
  "DOCUMENT",
  "HELP_REQUEST",
  "ROOM",
  "HEALTH_CONTACT",
  "COMBINED_SOCIAL_HEALTH",
  "GENERAL_SUPPORT",
  "UNKNOWN"
]);

export const JOURNEY_DEFAULT_STATUS = "ACTIVE";
export const JOURNEY_DEFAULT_SHARING_STATUS = "PRIVATE";
export const JOURNEY_DEFAULT_ROLE_CONTEXT = "CLIENT";

export const JOURNEY_TEXT_LIMITS = Object.freeze({
  title: 160,
  summary: 12000,
  conversationId: 120,
  clientActionId: 120,
  primaryPath: 80,
  shortItem: 220,
  contextText: 12000
});

export const JOURNEY_LIST_LIMITS = Object.freeze({
  domains: 12,
  missingInfo: 12,
  riskSignals: 8,
  suggestedActions: 8,
  contextItems: 20,
  assistiveDevices: 8
});

export const JOURNEY_PAGE_LIMITS = Object.freeze({
  default: 25,
  maximum: 100,
  activity: 8
});

export const JOURNEY_CREATE_LIMITS = Object.freeze({
  activePerOwner: 200,
  totalPerOwner: 10000
});
