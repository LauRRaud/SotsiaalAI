import { assertWorkspaceKind } from "./registry.js";

/* COLLAB-P0 — osalejalepingu ühissõnastik (analüüs ptk 2.2, K1 4.6).
 *
 * Kolm osalejasüsteemi (Room+Invite, CovisionParticipant, tulevane
 * SupervisionParticipation) EI liideta füüsiliselt — adapter kaardistab iga
 * mooduli olekud siia ühte sõnastikku. Sõnastik on ekstraktitud töötavast
 * koodist, mitte disainitud ette: iga väärtus vastab olemasolevale DB-enumile
 * või tõendatud üleminekule (INVITED → ACCEPTED|DECLINED|EXPIRED, seejärel
 * ACTIVE → LEFT|REMOVED|WITHDRAWN). */

export const ParticipantRole = Object.freeze({
  OWNER: "OWNER",
  RESPONSIBLE: "RESPONSIBLE",
  MODERATOR: "MODERATOR",
  MEMBER: "MEMBER",
  OBSERVER: "OBSERVER",
  REVIEWER: "REVIEWER"
});

export const PARTICIPANT_ROLES = Object.freeze(Object.values(ParticipantRole));

export const MembershipStatus = Object.freeze({
  INVITED: "INVITED",
  ACTIVE: "ACTIVE",
  LEFT: "LEFT",
  REMOVED: "REMOVED",
  WITHDRAWN: "WITHDRAWN"
});

export const MEMBERSHIP_STATUSES = Object.freeze(Object.values(MembershipStatus));

export const InviteState = Object.freeze({
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED",
  EXPIRED: "EXPIRED",
  REVOKED: "REVOKED"
});

export const INVITE_STATES = Object.freeze(Object.values(InviteState));

export const InviteRelationship = Object.freeze({
  COLLEAGUE: "COLLEAGUE",
  CLIENT: "CLIENT"
});

export const INVITE_RELATIONSHIPS = Object.freeze(Object.values(InviteRelationship));

const DESCRIPTOR_KEYS = Object.freeze(["workspaceRef", "userId", "role", "invite", "membership", "scope"]);
const REF_KEYS = Object.freeze(["kind", "id"]);
const INVITE_KEYS = Object.freeze(["status", "expiresAt", "relationship"]);
const MEMBERSHIP_KEYS = Object.freeze(["status", "since", "leftAt"]);
const SCOPE_KEYS = Object.freeze(["note"]);

/**
 * @typedef {Object} ParticipantDescriptor
 * @property {{ kind: string, id: string }} workspaceRef
 * @property {string | null} userId Null, kui kutse on saadetud e-postile ja
 *   kontot veel ei ole — osaleja identiteet elab siis kutses, mitte kasutajas.
 * @property {"OWNER"|"RESPONSIBLE"|"MODERATOR"|"MEMBER"|"OBSERVER"|"REVIEWER"} role
 * @property {{ status: string, expiresAt: string | null, relationship: string } | null} invite
 * @property {{ status: string, since: string | null, leftAt: string | null }} membership
 * @property {{ note: null }} scope V1-s alati null — aus piirang (scopeNote
 *   väli sünnib alles COLLAB-P4 migratsiooniga), mitte varjatud tulevikulubadus.
 */

export class ParticipantDescriptorValidationError extends Error {
  constructor(path, reason) {
    super(`Invalid participant descriptor at ${path}: ${reason}`);
    this.name = "ParticipantDescriptorValidationError";
    this.code = "INVALID_PARTICIPANT_DESCRIPTOR";
  }
}

function fail(path, reason) {
  throw new ParticipantDescriptorValidationError(path, reason);
}

function isRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value, expected, path) {
  if (!isRecord(value)) fail(path, "must be an object");
  const received = Object.keys(value).sort();
  const allowed = [...expected].sort();
  if (received.length !== allowed.length || received.some((key, index) => key !== allowed[index])) {
    fail(path, "contains missing or unsupported fields");
  }
}

function assertNonEmptyString(value, path) {
  if (typeof value !== "string" || !value.trim()) fail(path, "must be a non-empty string");
}

function assertNullableIsoTimestamp(value, path) {
  if (value === null) return;
  assertNonEmptyString(value, path);
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== value) {
    fail(path, "must be a canonical ISO 8601 timestamp or null");
  }
}

function assertRef(ref) {
  assertExactKeys(ref, REF_KEYS, "workspaceRef");
  try {
    assertWorkspaceKind(ref.kind);
  } catch (error) {
    if (error?.code === "UNKNOWN_WORKSPACE_KIND") fail("workspaceRef.kind", "is not registered");
    throw error;
  }
  assertNonEmptyString(ref.id, "workspaceRef.id");
}

function assertInvite(invite) {
  if (invite === null) return;
  assertExactKeys(invite, INVITE_KEYS, "invite");
  if (!INVITE_STATES.includes(invite.status)) {
    fail("invite.status", "is not a canonical invite state");
  }
  assertNullableIsoTimestamp(invite.expiresAt, "invite.expiresAt");
  if (!INVITE_RELATIONSHIPS.includes(invite.relationship)) {
    fail("invite.relationship", "is not a canonical invite relationship");
  }
}

function assertMembership(membership) {
  assertExactKeys(membership, MEMBERSHIP_KEYS, "membership");
  if (!MEMBERSHIP_STATUSES.includes(membership.status)) {
    fail("membership.status", "is not a canonical membership status");
  }
  assertNullableIsoTimestamp(membership.since, "membership.since");
  assertNullableIsoTimestamp(membership.leftAt, "membership.leftAt");
}

function assertScope(scope) {
  assertExactKeys(scope, SCOPE_KEYS, "scope");
  if (scope.note !== null) {
    fail("scope.note", "must be null in V1 (scopeNote field does not exist yet)");
  }
}

/**
 * Range valideerimine K1 descriptor'i eeskujul: juhuslik moodulipõhine väli on
 * lepinguviga, mitte parimal-jõul lisandus ühisele osalejapinnale.
 *
 * @param {ParticipantDescriptor} descriptor
 * @returns {ParticipantDescriptor}
 */
export function assertParticipantDescriptor(descriptor) {
  assertExactKeys(descriptor, DESCRIPTOR_KEYS, "descriptor");
  assertRef(descriptor.workspaceRef);
  if (descriptor.userId !== null) assertNonEmptyString(descriptor.userId, "userId");
  if (!PARTICIPANT_ROLES.includes(descriptor.role)) {
    fail("role", "is not a canonical participant role");
  }
  assertInvite(descriptor.invite);
  assertMembership(descriptor.membership);
  assertScope(descriptor.scope);
  if (descriptor.userId === null && descriptor.invite === null) {
    fail("userId", "cannot be null without an invite (identity must live somewhere)");
  }
  return descriptor;
}

export const validateParticipantDescriptor = assertParticipantDescriptor;
