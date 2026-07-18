import { assertWorkspaceKind } from "./registry.js";

export const WorkspaceLifecycle = Object.freeze({
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  CLOSED: "CLOSED",
  ARCHIVED: "ARCHIVED",
  PURGED: "PURGED",
  DELETED: "DELETED"
});

export const WORKSPACE_LIFECYCLES = Object.freeze(Object.values(WorkspaceLifecycle));

export const WorkspaceVisibility = Object.freeze({
  PRIVATE: "PRIVATE",
  SHARED_PARTICIPANTS: "SHARED_PARTICIPANTS",
  ORG_META: "ORG_META",
  PUBLIC_DERIVED: "PUBLIC_DERIVED"
});

export const WORKSPACE_VISIBILITIES = Object.freeze(Object.values(WorkspaceVisibility));

const DESCRIPTOR_KEYS = Object.freeze([
  "ref",
  "title",
  "ownerId",
  "responsibleId",
  "lifecycle",
  "phase",
  "goal",
  "nextAction",
  "progress",
  "visibility",
  "participants",
  "lastMeaningfulActivityAt",
  "href"
]);
const REF_KEYS = Object.freeze(["kind", "id"]);
const PHASE_KEYS = Object.freeze(["stage", "key", "labelKey"]);
const NEXT_ACTION_KEYS = Object.freeze(["labelKey", "dueOn", "assigneeId"]);
const PROGRESS_KEYS = Object.freeze(["current", "total"]);
const PARTICIPANT_KEYS = Object.freeze(["active", "invited"]);
const HREF_KEYS = Object.freeze(["action", "target"]);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * @typedef {Object} WorkspaceDescriptor
 * @property {{ kind: string, id: string }} ref
 * @property {string} title User text or a localizable label key.
 * @property {string} ownerId
 * @property {string} responsibleId
 * @property {"DRAFT"|"ACTIVE"|"PAUSED"|"CLOSED"|"ARCHIVED"|"PURGED"|"DELETED"} lifecycle
 * @property {{ stage: number, key: string, labelKey: string } | null} phase
 * @property {string | null} goal
 * @property {{ labelKey: string, dueOn: string | null, assigneeId: string } | null} nextAction
 * @property {{ current: number, total: number } | null} progress
 * @property {"PRIVATE"|"SHARED_PARTICIPANTS"|"ORG_META"|"PUBLIC_DERIVED"} visibility
 * @property {{ active: number, invited: number }} participants
 * @property {string} lastMeaningfulActivityAt ISO 8601 timestamp.
 * @property {{ action: "open_workspace", target: string }} href
 */

export class WorkspaceDescriptorValidationError extends Error {
  constructor(path, reason) {
    super(`Invalid workspace descriptor at ${path}: ${reason}`);
    this.name = "WorkspaceDescriptorValidationError";
    this.code = "INVALID_WORKSPACE_DESCRIPTOR";
  }
}

function fail(path, reason) {
  throw new WorkspaceDescriptorValidationError(path, reason);
}

function isRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertRecord(value, path) {
  if (!isRecord(value)) fail(path, "must be an object");
}

function assertExactKeys(value, expected, path) {
  assertRecord(value, path);
  const received = Object.keys(value).sort();
  const allowed = [...expected].sort();
  if (received.length !== allowed.length || received.some((key, index) => key !== allowed[index])) {
    fail(path, "contains missing or unsupported fields");
  }
}

function assertNonEmptyString(value, path) {
  if (typeof value !== "string" || !value.trim()) fail(path, "must be a non-empty string");
}

function assertNullableString(value, path) {
  if (value !== null && typeof value !== "string") fail(path, "must be a string or null");
}

function assertNonNegativeInteger(value, path) {
  if (!Number.isInteger(value) || value < 0) fail(path, "must be a non-negative integer");
}

function assertIsoTimestamp(value, path) {
  assertNonEmptyString(value, path);
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== value) {
    fail(path, "must be a canonical ISO 8601 timestamp");
  }
}

function assertRef(ref) {
  assertExactKeys(ref, REF_KEYS, "ref");
  try {
    assertWorkspaceKind(ref.kind);
  } catch (error) {
    if (error?.code === "UNKNOWN_WORKSPACE_KIND") fail("ref.kind", "is not registered");
    throw error;
  }
  assertNonEmptyString(ref.id, "ref.id");
}

function assertPhase(phase) {
  if (phase === null) return;
  assertExactKeys(phase, PHASE_KEYS, "phase");
  if (!Number.isInteger(phase.stage) || phase.stage < 1) {
    fail("phase.stage", "must be a positive integer");
  }
  assertNonEmptyString(phase.key, "phase.key");
  assertNonEmptyString(phase.labelKey, "phase.labelKey");
}

function assertNextAction(nextAction) {
  if (nextAction === null) return;
  assertExactKeys(nextAction, NEXT_ACTION_KEYS, "nextAction");
  assertNonEmptyString(nextAction.labelKey, "nextAction.labelKey");
  if (nextAction.dueOn !== null && (typeof nextAction.dueOn !== "string" || !DATE_ONLY.test(nextAction.dueOn))) {
    fail("nextAction.dueOn", "must be an ISO calendar date or null");
  }
  assertNonEmptyString(nextAction.assigneeId, "nextAction.assigneeId");
}

function assertProgress(progress) {
  if (progress === null) return;
  assertExactKeys(progress, PROGRESS_KEYS, "progress");
  assertNonNegativeInteger(progress.current, "progress.current");
  if (!Number.isInteger(progress.total) || progress.total < 1) {
    fail("progress.total", "must be a positive integer");
  }
  if (progress.current > progress.total) fail("progress.current", "cannot exceed progress.total");
}

function assertParticipants(participants) {
  assertExactKeys(participants, PARTICIPANT_KEYS, "participants");
  assertNonNegativeInteger(participants.active, "participants.active");
  assertNonNegativeInteger(participants.invited, "participants.invited");
}

function assertHref(href, ref) {
  assertExactKeys(href, HREF_KEYS, "href");
  if (href.action !== "open_workspace") fail("href.action", "must be open_workspace");
  const expectedTarget = `${ref.kind}:${ref.id}`;
  if (href.target !== expectedTarget) fail("href.target", "must target descriptor ref");
}

/**
 * Rejects a descriptor unless it is the exact K1 V1 read-model shape. This is
 * intentionally strict: an accidental module field is a contract failure, not
 * a best-effort addition to the shared workspace surface.
 *
 * @param {WorkspaceDescriptor} descriptor
 * @returns {WorkspaceDescriptor}
 */
export function assertWorkspaceDescriptor(descriptor) {
  assertExactKeys(descriptor, DESCRIPTOR_KEYS, "descriptor");
  assertRef(descriptor.ref);
  assertNonEmptyString(descriptor.title, "title");
  assertNonEmptyString(descriptor.ownerId, "ownerId");
  assertNonEmptyString(descriptor.responsibleId, "responsibleId");
  if (!WORKSPACE_LIFECYCLES.includes(descriptor.lifecycle)) {
    fail("lifecycle", "is not a canonical workspace lifecycle");
  }
  assertPhase(descriptor.phase);
  assertNullableString(descriptor.goal, "goal");
  assertNextAction(descriptor.nextAction);
  assertProgress(descriptor.progress);
  if (!WORKSPACE_VISIBILITIES.includes(descriptor.visibility)) {
    fail("visibility", "is not a canonical workspace visibility");
  }
  assertParticipants(descriptor.participants);
  assertIsoTimestamp(descriptor.lastMeaningfulActivityAt, "lastMeaningfulActivityAt");
  assertHref(descriptor.href, descriptor.ref);
  return descriptor;
}

export const validateWorkspaceDescriptor = assertWorkspaceDescriptor;
