import prisma from "@/lib/prisma";

import {
  assertWorkspaceDescriptor,
  WorkspaceLifecycle,
  WorkspaceVisibility
} from "../descriptor.js";
import { WorkspaceKind } from "../registry.js";
import {
  decodePreInquiryCursor,
  encodePreInquiryCursor,
  normalizePreInquiryPageLimit,
  preInquiryCursorWhere
} from "../../preInquiryPagination.js";

function normalizeUserId(userId) {
  return typeof userId === "string" ? userId.trim() : "";
}

/** The five PreInquiryStatus values (mirrors the Prisma enum). */
export const PRE_INQUIRY_STATUSES = Object.freeze([
  "DRAFT",
  "READY",
  "SENT",
  "DOWNLOADED",
  "ARCHIVED"
]);

/**
 * K1 4.2.1 lifecycle mapping for a pre-inquiry (normative table, doc ptk 2):
 * DRAFT→DRAFT, READY/SENT→ACTIVE, DOWNLOADED/ARCHIVED→CLOSED. A recall before
 * opening is a withdrawal and maps to PURGED (handled in `preInquiryLifecycle`).
 */
export const PRE_INQUIRY_K1_LIFECYCLE = Object.freeze({
  DRAFT: WorkspaceLifecycle.DRAFT,
  READY: WorkspaceLifecycle.ACTIVE,
  SENT: WorkspaceLifecycle.ACTIVE,
  DOWNLOADED: WorkspaceLifecycle.CLOSED,
  ARCHIVED: WorkspaceLifecycle.CLOSED
});

export function preInquiryLifecycle(row) {
  if (row?.recalledAt) return WorkspaceLifecycle.PURGED;
  const mapped = PRE_INQUIRY_K1_LIFECYCLE[String(row?.status || "")];
  if (!mapped) {
    throw new Error(`Unsupported pre-inquiry status: ${row?.status || "missing"}`);
  }
  return mapped;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/u;

function receiverNextAction(row, viewerId) {
  const nextContactOn = typeof row?.nextContactOn === "string" ? row.nextContactOn.trim() : "";
  if (!nextContactOn || !DATE_ONLY.test(nextContactOn)) return null;
  return {
    labelKey: "casework.next_action.contact",
    dueOn: nextContactOn,
    assigneeId: viewerId
  };
}

/**
 * Maps one receiver-scoped pre-inquiry into a K1 descriptor. Owner and
 * responsible are the RECEIVER (recipientOwnerId): this is the receiver's view
 * of a received item, and the author's identity is never exposed here (it may
 * be erased). Descriptor-only — no topic, situation, note or checklist text
 * leaves the module through this surface.
 */
export function toReceivedCaseWorkDescriptor(row, viewerId) {
  const receiverId = normalizeUserId(viewerId) || normalizeUserId(row?.recipientOwnerId);
  const id = String(row?.id || "").trim();
  const activeParticipants = [row?.authorId, row?.recipientOwnerId].filter(Boolean).length || 1;
  return assertWorkspaceDescriptor({
    ref: { kind: WorkspaceKind.PRE_INQUIRY, id },
    title: "workspace.kind.pre_inquiry",
    ownerId: receiverId,
    responsibleId: receiverId,
    lifecycle: preInquiryLifecycle(row),
    phase: null,
    goal: null,
    nextAction: receiverNextAction(row, receiverId),
    progress: null,
    visibility: WorkspaceVisibility.SHARED_PARTICIPANTS,
    participants: { active: activeParticipants, invited: 0 },
    lastMeaningfulActivityAt: new Date(row?.updatedAt).toISOString(),
    href: { action: "open_workspace", target: `${WorkspaceKind.PRE_INQUIRY}:${id}` }
  });
}

const RECEIVED_CASE_WORK_SELECT = Object.freeze({
  id: true,
  authorId: true,
  recipientOwnerId: true,
  status: true,
  nextContactOn: true,
  recalledAt: true,
  updatedAt: true
});

/**
 * Read-only K1 adapter: the pre-inquiries a receiver has actually received.
 * Scoped to recipientOwnerId — a stranger (or an unset id) gets an empty list.
 * Unsent drafts (DRAFT/READY) and recalled inquiries are excluded: the receiver
 * only ever sees what was sent to them.
 */
export async function listReceivedCaseWork(userId, { db = prisma } = {}) {
  const items = [];
  let cursor = null;
  do {
    const page = await listReceivedCaseWorkPage(userId, { db, limit: 250, cursor });
    items.push(...page.items);
    cursor = page.hasMore ? page.nextCursor : null;
  } while (cursor);
  return items;
}

export async function listReceivedCaseWorkPage(userId, { db = prisma, limit = 100, cursor = null } = {}) {
  const viewerId = normalizeUserId(userId);
  if (!viewerId) return { items: [], total: 0, hasMore: false, nextCursor: null };
  const take = normalizePreInquiryPageLimit(limit);
  const baseWhere = {
      recipientOwnerId: viewerId,
      recalledAt: null,
      status: { in: ["SENT", "DOWNLOADED", "ARCHIVED"] }
  };
  const cursorWhere = preInquiryCursorWhere(decodePreInquiryCursor(cursor));
  const where = cursorWhere ? { ...baseWhere, AND: [cursorWhere] } : baseWhere;
  const [rows, total] = await Promise.all([
    db.preInquiry.findMany({
      where,
      select: RECEIVED_CASE_WORK_SELECT,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: take + 1
    }),
    db.preInquiry.count({ where: baseWhere })
  ]);
  const hasMore = rows.length > take;
  const pageRows = hasMore ? rows.slice(0, take) : rows;
  return {
    items: pageRows.map((row) => toReceivedCaseWorkDescriptor(row, viewerId)),
    total,
    hasMore,
    nextCursor: hasMore ? encodePreInquiryCursor(pageRows.at(-1)) : null
  };
}

export const listWorkspaces = listReceivedCaseWork;
