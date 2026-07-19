import prisma from "@/lib/prisma";

import {
  CARRIER_CLASS,
  carrierClassForArtifactStatus,
  carrierClassLabelKey,
  isCarrierClass,
  isShareableCarrierClass
} from "../provenance.js";

function normalizeUserId(userId) {
  return typeof userId === "string" ? userId.trim() : "";
}

/**
 * AgentArtifact type dictionary (proto-JTA inventory, doc ptk 1.3). Mirrors the
 * Prisma AgentArtifactType enum. Every type maps to an i18n label key — the
 * rendered string never comes from the DB (P2-6 lesson).
 */
export const AGENT_ARTIFACT_TYPES = Object.freeze([
  "MEETING_SUMMARY",
  "TRANSCRIPT_SUMMARY",
  "CASE_SUMMARY",
  "PRE_ASSESSMENT_SUMMARY",
  "STAR_HELPER",
  "CASE_BRIEF",
  "REPORT_DRAFT",
  "ACTION_PLAN",
  "CHECKLIST",
  "LETTER_DRAFT",
  "OTHER"
]);

/** The two AgentArtifactStatus values (mirrors the Prisma enum). */
export const AGENT_ARTIFACT_STATUSES = Object.freeze(["DRAFT", "FINAL"]);

export function isAgentArtifactType(value) {
  return typeof value === "string" && AGENT_ARTIFACT_TYPES.includes(value);
}

export function agentArtifactTypeLabelKey(type) {
  return isAgentArtifactType(type) ? `casework.artifact_type.${type}` : null;
}

const SHARE_DESCRIPTOR_KEYS = Object.freeze([
  "id",
  "ownerId",
  "type",
  "typeKey",
  "status",
  "carrierClass",
  "carrierClassKey",
  "shareable",
  "title",
  "lastActivityAt"
]);

export class CaseArtifactShareDescriptorError extends Error {
  constructor(reason) {
    super(`Invalid case artifact share descriptor: ${reason}`);
    this.name = "CaseArtifactShareDescriptorError";
    this.code = "INVALID_CASE_ARTIFACT_SHARE_DESCRIPTOR";
  }
}

function fail(reason) {
  throw new CaseArtifactShareDescriptorError(reason);
}

/**
 * Strict validator for the sharing descriptor (doc ptk 2.1 carrier rule + 6.2
 * casework→COLLAB mapping). Exact-keyed on purpose: an accidental content field
 * is a contract failure, not a silent addition. Enforces the carrier invariants
 * — DRAFT→1/FINAL→2, class 3 never here, shareable follows the class.
 */
export function assertCaseArtifactShareDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) {
    fail("must be an object");
  }
  const received = Object.keys(descriptor).sort();
  const expected = [...SHARE_DESCRIPTOR_KEYS].sort();
  if (received.length !== expected.length || received.some((key, i) => key !== expected[i])) {
    fail("contains missing or unsupported fields");
  }
  if (typeof descriptor.id !== "string" || !descriptor.id.trim()) fail("id must be a non-empty string");
  if (typeof descriptor.ownerId !== "string" || !descriptor.ownerId.trim()) {
    fail("ownerId must be a non-empty string");
  }
  if (!isAgentArtifactType(descriptor.type)) fail("type is not a known AgentArtifactType");
  if (descriptor.typeKey !== agentArtifactTypeLabelKey(descriptor.type)) {
    fail("typeKey must match type");
  }
  if (!AGENT_ARTIFACT_STATUSES.includes(descriptor.status)) {
    fail("status is not a known AgentArtifactStatus");
  }
  if (!isCarrierClass(descriptor.carrierClass) || descriptor.carrierClass === CARRIER_CLASS.OFFICIAL_CARRIER) {
    fail("carrierClass must be 1 (work draft) or 2 (confirmed summary)");
  }
  if (descriptor.carrierClass !== carrierClassForArtifactStatus(descriptor.status)) {
    fail("carrierClass must match status");
  }
  if (descriptor.carrierClassKey !== carrierClassLabelKey(descriptor.carrierClass)) {
    fail("carrierClassKey must match carrierClass");
  }
  if (descriptor.shareable !== isShareableCarrierClass(descriptor.carrierClass)) {
    fail("shareable must follow carrierClass");
  }
  if (descriptor.title !== null && typeof descriptor.title !== "string") {
    fail("title must be a string or null");
  }
  const activity = new Date(descriptor.lastActivityAt);
  if (
    typeof descriptor.lastActivityAt !== "string" ||
    !Number.isFinite(activity.getTime()) ||
    activity.toISOString() !== descriptor.lastActivityAt
  ) {
    fail("lastActivityAt must be a canonical ISO 8601 timestamp");
  }
  return descriptor;
}

/**
 * Maps one owner-scoped AgentArtifact into a sharing descriptor (doc ptk 2.1):
 * DRAFT → class 1 (work draft, not shareable), FINAL → class 2 (confirmed
 * summary, shareable as a frozen copy). Title is the owner's own text; the
 * artifact body, metadata and source documents never leave the module here.
 */
export function toCaseArtifactShareDescriptor(row) {
  const status = String(row?.status || "DRAFT");
  const carrierClass = carrierClassForArtifactStatus(status);
  if (!carrierClass) throw new Error(`Unsupported agent artifact status: ${status}`);
  const type = String(row?.type || "");
  if (!isAgentArtifactType(type)) throw new Error(`Unsupported agent artifact type: ${type || "missing"}`);
  const rawTitle = typeof row?.title === "string" ? row.title.trim() : "";
  return assertCaseArtifactShareDescriptor({
    id: String(row?.id || "").trim(),
    ownerId: String(row?.ownerId || "").trim(),
    type,
    typeKey: agentArtifactTypeLabelKey(type),
    status,
    carrierClass,
    carrierClassKey: carrierClassLabelKey(carrierClass),
    shareable: isShareableCarrierClass(carrierClass),
    title: rawTitle || null,
    lastActivityAt: new Date(row?.updatedAt).toISOString()
  });
}

const CASE_ARTIFACT_SELECT = Object.freeze({
  id: true,
  ownerId: true,
  type: true,
  status: true,
  title: true,
  updatedAt: true
});

/**
 * Read-only owner-scoped adapter: the caller's own case artifacts as sharing
 * descriptors. A stranger (or an unset id) gets an empty list.
 */
export async function listCaseArtifacts(userId, { db = prisma } = {}) {
  const ownerId = normalizeUserId(userId);
  if (!ownerId) return [];
  const rows = await db.agentArtifact.findMany({
    where: { ownerId },
    select: CASE_ARTIFACT_SELECT,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: 100
  });
  return (rows || []).map(toCaseArtifactShareDescriptor);
}
