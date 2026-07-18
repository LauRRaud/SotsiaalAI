import { assertActionKind, ActionKind } from "@/lib/actions/registry";

export const DomainEventType = Object.freeze({
  WORKSPACE_CREATED: "workspace.created",
  WORKSPACE_ACTIVATED: "workspace.activated",
  WORKSPACE_ARCHIVED: "workspace.archived",
  WORKSPACE_DELETED: "workspace.deleted",
  PRE_INQUIRY_OPENED: "pre_inquiry.opened",
  PRE_INQUIRY_REPLIED: "pre_inquiry.replied",
  PRE_INQUIRY_ARCHIVED: "pre_inquiry.archived",
  PRE_INQUIRY_RECALLED: "pre_inquiry.recalled"
});

export const AudienceRule = Object.freeze({
  OWNER: "owner",
  AUTHOR: "author",
  RECIPIENT_OWNER: "recipient_owner"
});

export const VisibilityClass = Object.freeze({
  PERSONAL: "personal",
  WORKSPACE: "workspace",
  ADMIN_OPS: "admin_ops"
});

export const RetentionClass = Object.freeze({
  SHORT30: "short30",
  STANDARD90: "standard90",
  AUDIT_LONG: "audit_long"
});

export const AckMode = Object.freeze({
  READ: "read",
  TARGET_OPEN: "target_open",
  SOURCE_RESOLVED: "source_resolved",
  EXPLICIT: "explicit"
});

const statusMeta = Object.freeze({
  statusKey: Object.freeze({ kind: "enum", values: Object.freeze(["READY", "ARCHIVED"]) })
});

const journeyKindMeta = Object.freeze({
  kind: Object.freeze({ kind: "enum", values: Object.freeze(["journey"]) })
});

const spec = (value) => Object.freeze({
  version: 1,
  visibilityClass: VisibilityClass.PERSONAL,
  retentionClass: RetentionClass.STANDARD90,
  emailPolicy: "OPTIONAL",
  ackMode: AckMode.READ,
  workspaceKind: "pre_inquiry",
  sourceFeature: "preInquiries",
  sourceType: "PRE_INQUIRY",
  projectionType: "PRE_INQUIRY_STATUS_CHANGED",
  ...value,
  metaSchema: Object.freeze(value.metaSchema || {})
});

export const EVENT_REGISTRY = Object.freeze({
  [DomainEventType.WORKSPACE_CREATED]: spec({
    audienceRule: AudienceRule.OWNER,
    actionKind: ActionKind.OPEN_WORKSPACE,
    labelKey: "notifications.events.workspace_created",
    emailPolicy: "NONE",
    workspaceKind: "journey",
    sourceFeature: "journeys",
    sourceType: "JOURNEY",
    projectionType: "WORKSPACE_TIMELINE_ONLY",
    metaSchema: journeyKindMeta
  }),
  [DomainEventType.WORKSPACE_ACTIVATED]: spec({
    audienceRule: AudienceRule.OWNER,
    actionKind: ActionKind.OPEN_WORKSPACE,
    labelKey: "notifications.events.workspace_activated",
    emailPolicy: "NONE",
    workspaceKind: "journey",
    sourceFeature: "journeys",
    sourceType: "JOURNEY",
    projectionType: "WORKSPACE_TIMELINE_ONLY",
    metaSchema: journeyKindMeta
  }),
  [DomainEventType.WORKSPACE_ARCHIVED]: spec({
    audienceRule: AudienceRule.OWNER,
    actionKind: ActionKind.OPEN_WORKSPACE,
    labelKey: "notifications.events.workspace_archived",
    emailPolicy: "NONE",
    workspaceKind: "journey",
    sourceFeature: "journeys",
    sourceType: "JOURNEY",
    projectionType: "WORKSPACE_TIMELINE_ONLY",
    metaSchema: journeyKindMeta
  }),
  [DomainEventType.WORKSPACE_DELETED]: spec({
    audienceRule: AudienceRule.OWNER,
    actionKind: ActionKind.OPEN_LIST,
    labelKey: "notifications.events.workspace_deleted",
    emailPolicy: "NONE",
    workspaceKind: "journey",
    sourceFeature: "journeys",
    sourceType: "JOURNEY",
    retentionClass: RetentionClass.AUDIT_LONG,
    projectionType: "WORKSPACE_TIMELINE_ONLY",
    metaSchema: journeyKindMeta
  }),
  [DomainEventType.PRE_INQUIRY_OPENED]: spec({
    audienceRule: AudienceRule.AUTHOR,
    actionKind: ActionKind.OPEN_PRE_INQUIRY_SENT,
    labelKey: "notifications.events.pre_inquiry_opened",
    metaSchema: statusMeta
  }),
  [DomainEventType.PRE_INQUIRY_REPLIED]: spec({
    audienceRule: AudienceRule.AUTHOR,
    actionKind: ActionKind.OPEN_PRE_INQUIRY_SENT,
    labelKey: "notifications.events.pre_inquiry_replied",
    metaSchema: statusMeta
  }),
  [DomainEventType.PRE_INQUIRY_ARCHIVED]: spec({
    audienceRule: AudienceRule.AUTHOR,
    actionKind: ActionKind.OPEN_PRE_INQUIRY_SENT,
    labelKey: "notifications.events.pre_inquiry_archived",
    metaSchema: statusMeta
  }),
  [DomainEventType.PRE_INQUIRY_RECALLED]: spec({
    audienceRule: AudienceRule.RECIPIENT_OWNER,
    actionKind: ActionKind.OPEN_PRE_INQUIRY_RECEIVED,
    labelKey: "notifications.events.pre_inquiry_recalled",
    retentionClass: RetentionClass.SHORT30,
    emailPolicy: "NONE",
    projectionType: "PRE_INQUIRY_RECALLED",
    metaSchema: Object.freeze({})
  })
});

const ACTOR_KINDS = new Set(["user", "system", "job"]);
const VISIBILITY_CLASSES = new Set(Object.values(VisibilityClass));
const RETENTION_CLASSES = new Set(Object.values(RetentionClass));
const ACK_MODES = new Set(Object.values(AckMode));
const AUDIENCE_RULES = new Set(Object.values(AudienceRule));
const EMAIL_POLICIES = new Set(["NONE", "OPTIONAL", "TRANSACTIONAL"]);
const SAFE_KEY = /^[A-Za-z0-9._:-]+$/u;
const LABEL_KEY = /^[a-z0-9_]+(?:\.[a-z0-9_]+)+$/u;

function registryError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertSafeId(value, field, { optional = false, maxLength = 500 } = {}) {
  const normalized = String(value || "").trim();
  if (!normalized && optional) return null;
  if (!normalized || normalized.length > maxLength || !SAFE_KEY.test(normalized)) {
    throw registryError("INVALID_EVENT_FIELD", `Invalid ${field}`);
  }
  return normalized;
}

function validateMeta(meta, metaSchema) {
  const value = meta == null ? {} : meta;
  if (!isRecord(value)) throw registryError("INVALID_EVENT_META", "Event meta must be an object");
  for (const key of Object.keys(value)) {
    const rule = metaSchema[key];
    if (!rule) throw registryError("UNDECLARED_EVENT_META", `Undeclared event meta field: ${key}`);
    const field = value[key];
    if (rule.kind === "enum" && (typeof field !== "string" || !rule.values.includes(field))) {
      throw registryError("INVALID_EVENT_META", `Invalid enum event meta field: ${key}`);
    }
    if (rule.kind === "id") assertSafeId(field, `meta.${key}`);
    if (rule.kind === "number" && !Number.isFinite(field)) {
      throw registryError("INVALID_EVENT_META", `Invalid number event meta field: ${key}`);
    }
    if (rule.kind === "date" && (!(field instanceof Date) || !Number.isFinite(field.getTime()))) {
      throw registryError("INVALID_EVENT_META", `Invalid date event meta field: ${key}`);
    }
    if (rule.kind === "i18n" && (typeof field !== "string" || !LABEL_KEY.test(field))) {
      throw registryError("INVALID_EVENT_META", `Invalid i18n event meta field: ${key}`);
    }
    if (!["enum", "id", "number", "date", "i18n"].includes(rule.kind)) {
      throw registryError("UNSAFE_EVENT_META_SCHEMA", `Free text is not an allowed event meta type: ${key}`);
    }
  }
  return value;
}

export function getEventSpec(type) {
  return EVENT_REGISTRY[String(type || "").trim()] || null;
}

export function validateEventRegistry({ hasTranslation = null } = {}) {
  for (const [type, value] of Object.entries(EVENT_REGISTRY)) {
    assertSafeId(type, "type");
    if (!AUDIENCE_RULES.has(value.audienceRule)) throw registryError("UNKNOWN_AUDIENCE_RULE");
    if (!VISIBILITY_CLASSES.has(value.visibilityClass)) throw registryError("UNKNOWN_VISIBILITY_CLASS");
    if (!RETENTION_CLASSES.has(value.retentionClass)) throw registryError("UNKNOWN_RETENTION_CLASS");
    if (!ACK_MODES.has(value.ackMode)) throw registryError("UNKNOWN_ACK_MODE");
    if (!EMAIL_POLICIES.has(value.emailPolicy)) throw registryError("UNKNOWN_EMAIL_POLICY");
    assertActionKind(value.actionKind);
    if (!LABEL_KEY.test(value.labelKey) || (hasTranslation && !hasTranslation(value.labelKey))) {
      throw registryError("MISSING_EVENT_TRANSLATION", `Missing translation: ${value.labelKey}`);
    }
    validateMeta({}, value.metaSchema);
  }
  return true;
}

export function validateDomainEventInput(input = {}) {
  if (!isRecord(input)) throw registryError("INVALID_DOMAIN_EVENT");
  const type = assertSafeId(input.type, "type");
  const eventSpec = getEventSpec(type);
  if (!eventSpec) throw registryError("UNKNOWN_EVENT_TYPE", `Unknown event type: ${type}`);
  const actorKind = String(input.actorKind || "").trim();
  if (!ACTOR_KINDS.has(actorKind)) throw registryError("INVALID_EVENT_ACTOR");
  const actorUserId = assertSafeId(input.actorUserId, "actorUserId", { optional: actorKind !== "user" });
  if (actorKind === "user" && !actorUserId) throw registryError("INVALID_EVENT_ACTOR");
  const sourceId = assertSafeId(input.sourceId, "sourceId");
  const idempotencyKey = assertSafeId(input.idempotencyKey, "idempotencyKey");
  const actionTarget = assertSafeId(input.actionTarget, "actionTarget");
  const workspaceId = assertSafeId(input.workspaceId, "workspaceId", { optional: true });
  const meta = validateMeta(input.meta, eventSpec.metaSchema);
  return {
    type,
    eventSpec,
    actorKind,
    actorUserId,
    sourceId,
    idempotencyKey,
    actionTarget,
    workspaceId,
    meta
  };
}

validateEventRegistry();
