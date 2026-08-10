/**
 * FIELD-V1 server service (doc ptk 3–4). Every read and write is owner-scoped:
 * a foreign or missing visit is always a 404 (never a 403 existence oracle).
 * Note bodies, location text and consent fields are class-1 working-draft
 * content — they are never logged and never appear in error messages.
 */

import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { writeDataAudit } from "@/lib/privacy/audit";
import {
  updatePreInquiryReceiverWorkflow
} from "@/lib/preInquiries";
import {
  canTransitionFieldVisit,
  FIELD_ATTACHMENT_ROLE,
  FIELD_CONSENT_KINDS,
  FIELD_NOTE_KIND,
  FIELD_VISIT_STATUS,
  isFieldNoteKind,
  isFieldProvenance
} from "./constants.js";

const MAX_TEXT = Object.freeze({
  goal: 4000,
  locationText: 400,
  body: 20000,
  packSummaryText: 6000,
  keyQuestion: 300,
  safetyContactName: 200,
  safetyContactEmail: 320,
  safetyInstructions: 2000,
  title: 200,
  handoverNote: 20000
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;
const CLIENT_ITEM_ID_RE = /^[A-Za-z0-9_-]{6,64}$/u;
const OPEN_STATUSES = Object.freeze([
  FIELD_VISIT_STATUS.DRAFT,
  FIELD_VISIT_STATUS.PLANNED,
  FIELD_VISIT_STATUS.IN_PROGRESS,
  FIELD_VISIT_STATUS.WRAP_UP
]);

export function fieldError(message, status = 400, extras = null) {
  const error = new Error(message);
  error.status = status;
  if (extras) error.extras = extras;
  return error;
}

function requireUserId(userId) {
  const normalized = String(userId || "").trim();
  if (!normalized) throw fieldError("api.common.unauthorized", 401);
  return normalized;
}

function normalizeText(value, max, { required = false, field = "field" } = {}) {
  const text = String(value ?? "").trim();
  if (!text) {
    if (required) throw fieldError(`field.errors.invalid_${field}`, 400);
    return null;
  }
  return text.length > max ? text.slice(0, max) : text;
}

function normalizeDate(value, { field = "date" } = {}) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw fieldError(`field.errors.invalid_${field}`, 400);
  return date;
}

function normalizeKeyQuestions(value) {
  if (value == null) return null;
  if (!Array.isArray(value)) throw fieldError("field.errors.invalid_key_questions", 400);
  const questions = value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((item) => (item.length > MAX_TEXT.keyQuestion ? item.slice(0, MAX_TEXT.keyQuestion) : item));
  return questions;
}

function normalizeClientItemId(value) {
  const id = String(value || "").trim();
  if (!CLIENT_ITEM_ID_RE.test(id)) throw fieldError("field.errors.invalid_client_item_id", 400);
  return id;
}

function contentFingerprint({ kind, provenance, body, consentKind, consentSubject, consentForm }) {
  return crypto
    .createHash("sha256")
    .update([kind, provenance, body, consentKind || "", consentSubject || "", consentForm || ""].join("\u0000"))
    .digest("hex");
}

const VISIT_SELECT = Object.freeze({
  id: true,
  ownerUserId: true,
  status: true,
  version: true,
  goal: true,
  locationText: true,
  plannedStartAt: true,
  plannedEndAt: true,
  preInquiryId: true,
  packKeyQuestions: true,
  packSummaryText: true,
  packTakenAt: true,
  packSourceUpdatedAt: true,
  arrivedConfirmedAt: true,
  departedConfirmedAt: true,
  safetyArmedAt: true,
  safetyDeadlineAt: true,
  safetyContactName: true,
  safetyContactEmail: true,
  safetyInstructions: true,
  safetyRemindedAt: true,
  safetyEscalatedAt: true,
  safetyEscalationStatus: true,
  safetyResolvedNotifiedAt: true,
  safetyCancelledAt: true,
  handoverArtifactAt: true,
  handoverPreInquiryAt: true,
  closedAt: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true
});

const NOTE_SELECT = Object.freeze({
  id: true,
  visitId: true,
  clientItemId: true,
  revision: true,
  kind: true,
  provenance: true,
  body: true,
  contentSha256: true,
  consentKind: true,
  consentSubject: true,
  consentForm: true,
  consentWithdrawnAt: true,
  aiConfirmedAt: true,
  conflictState: true,
  conflictRevision: true,
  conflictBody: true,
  conflictProvenance: true,
  deviceCreatedAt: true,
  createdAt: true,
  updatedAt: true
});

function iso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function serializeFieldVisit(row, { packStale = false } = {}) {
  return {
    id: row.id,
    status: row.status,
    version: row.version,
    goal: row.goal || null,
    locationText: row.locationText || null,
    plannedStartAt: iso(row.plannedStartAt),
    plannedEndAt: iso(row.plannedEndAt),
    preInquiryId: row.preInquiryId || null,
    packKeyQuestions: Array.isArray(row.packKeyQuestions) ? row.packKeyQuestions : [],
    packSummaryText: row.packSummaryText || null,
    packTakenAt: iso(row.packTakenAt),
    packStale: Boolean(packStale),
    arrivedConfirmedAt: iso(row.arrivedConfirmedAt),
    departedConfirmedAt: iso(row.departedConfirmedAt),
    safety: {
      armedAt: iso(row.safetyArmedAt),
      deadlineAt: iso(row.safetyDeadlineAt),
      contactName: row.safetyContactName || null,
      contactEmail: row.safetyContactEmail || null,
      instructions: row.safetyInstructions || null,
      remindedAt: iso(row.safetyRemindedAt),
      escalatedAt: iso(row.safetyEscalatedAt),
      escalationStatus: row.safetyEscalationStatus || null,
      resolvedNotifiedAt: iso(row.safetyResolvedNotifiedAt),
      cancelledAt: iso(row.safetyCancelledAt)
    },
    handoverArtifactAt: iso(row.handoverArtifactAt),
    handoverPreInquiryAt: iso(row.handoverPreInquiryAt),
    closedAt: iso(row.closedAt),
    cancelledAt: iso(row.cancelledAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt)
  };
}

export function serializeFieldNote(row) {
  return {
    clientItemId: row.clientItemId,
    revision: row.revision,
    kind: row.kind,
    provenance: row.provenance,
    body: row.body,
    contentSha256: row.contentSha256 || null,
    consentKind: row.consentKind || null,
    consentSubject: row.consentSubject || null,
    consentForm: row.consentForm || null,
    consentWithdrawnAt: iso(row.consentWithdrawnAt),
    aiConfirmedAt: iso(row.aiConfirmedAt),
    conflict: row.conflictState
      ? {
          state: row.conflictState,
          revision: row.conflictRevision,
          body: row.conflictBody,
          provenance: row.conflictProvenance
        }
      : null,
    deviceCreatedAt: iso(row.deviceCreatedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt)
  };
}

function serializeAttachment(row) {
  return {
    clientItemId: row.clientItemId,
    role: row.role,
    documentId: row.documentId || null,
    documentGone: !row.documentId,
    consentClientItemId: row.consentClientItemId || null,
    transcriptConfirmedAt: iso(row.transcriptConfirmedAt),
    document: row.document
      ? {
          id: row.document.id,
          title: row.document.title,
          kind: row.document.kind,
          mime: row.document.mime,
          size: row.document.size,
          createdAt: iso(row.document.createdAt)
        }
      : null,
    createdAt: iso(row.createdAt)
  };
}

async function findOwnedVisit(db, userId, visitId, { select = VISIT_SELECT } = {}) {
  const id = String(visitId || "").trim();
  if (!id) throw fieldError("api.common.not_found", 404);
  const visit = await db.fieldVisit.findFirst({
    where: { id, ownerUserId: userId },
    select
  });
  if (!visit) throw fieldError("api.common.not_found", 404);
  return visit;
}

function assertVisitOpen(visit) {
  if (!OPEN_STATUSES.includes(visit.status)) {
    throw fieldError("field.errors.visit_read_only", 409);
  }
}

export async function createFieldVisit(userId, input = {}, { db = prisma, now = new Date() } = {}) {
  const ownerUserId = requireUserId(userId);
  const goal = normalizeText(input.goal, MAX_TEXT.goal);
  const locationText = normalizeText(input.locationText, MAX_TEXT.locationText);
  const plannedStartAt = normalizeDate(input.plannedStartAt, { field: "planned_start" });
  const plannedEndAt = normalizeDate(input.plannedEndAt, { field: "planned_end" });
  const packKeyQuestions = normalizeKeyQuestions(input.packKeyQuestions) || [];
  const packSummaryText = normalizeText(input.packSummaryText, MAX_TEXT.packSummaryText);

  let preInquiryId = String(input.preInquiryId || "").trim() || null;
  if (preInquiryId) {
    const inquiry = await db.preInquiry.findFirst({
      where: { id: preInquiryId, recipientOwnerId: ownerUserId, recalledAt: null },
      select: { id: true }
    });
    if (!inquiry) throw fieldError("api.common.not_found", 404);
  }

  const visit = await db.fieldVisit.create({
    data: {
      ownerUserId,
      status: FIELD_VISIT_STATUS.DRAFT,
      goal,
      locationText,
      plannedStartAt,
      plannedEndAt,
      preInquiryId,
      packKeyQuestions,
      packSummaryText,
      createdAt: now,
      updatedAt: now
    },
    select: VISIT_SELECT
  });
  return serializeFieldVisit(visit);
}

export async function listFieldVisits(userId, { db = prisma } = {}) {
  const ownerUserId = requireUserId(userId);
  const rows = await db.fieldVisit.findMany({
    where: { ownerUserId },
    select: {
      ...VISIT_SELECT,
      _count: { select: { notes: true, attachments: true } }
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: 50
  });
  return rows.map((row) => ({
    ...serializeFieldVisit(row),
    noteCount: row._count?.notes ?? 0,
    attachmentCount: row._count?.attachments ?? 0
  }));
}

export async function getFieldVisitDetail(userId, visitId, { db = prisma } = {}) {
  const ownerUserId = requireUserId(userId);
  const visit = await findOwnedVisit(db, ownerUserId, visitId);
  const [notes, attachments, inquiry] = await Promise.all([
    db.fieldVisitNote.findMany({
      where: { visitId: visit.id },
      select: NOTE_SELECT,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 500
    }),
    db.fieldVisitAttachment.findMany({
      where: { visitId: visit.id },
      select: {
        id: true,
        clientItemId: true,
        role: true,
        documentId: true,
        consentClientItemId: true,
        transcriptConfirmedAt: true,
        createdAt: true,
        document: {
          select: { id: true, title: true, kind: true, mime: true, size: true, createdAt: true }
        }
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 200
    }),
    visit.preInquiryId
      ? db.preInquiry.findFirst({
          where: { id: visit.preInquiryId, recipientOwnerId: ownerUserId },
          select: { id: true, updatedAt: true, status: true, nextContactOn: true }
        })
      : Promise.resolve(null)
  ]);
  const packStale = Boolean(
    visit.packTakenAt && inquiry?.updatedAt && inquiry.updatedAt.getTime() > visit.packTakenAt.getTime()
  );
  return {
    visit: serializeFieldVisit(visit, { packStale }),
    notes: notes.map(serializeFieldNote),
    attachments: attachments.map(serializeAttachment),
    preInquiry: inquiry
      ? {
          id: inquiry.id,
          status: inquiry.status,
          nextContactOn: inquiry.nextContactOn || null,
          updatedAt: iso(inquiry.updatedAt)
        }
      : null
  };
}

async function casVisitUpdate(db, visit, expectedVersion, data, now) {
  const version = Number(expectedVersion);
  if (!Number.isInteger(version) || version < 1) {
    throw fieldError("field.errors.version_required", 400);
  }
  const result = await db.fieldVisit.updateMany({
    where: { id: visit.id, ownerUserId: visit.ownerUserId, version },
    data: { ...data, version: { increment: 1 }, updatedAt: now }
  });
  if (result.count !== 1) throw fieldError("field.errors.visit_conflict", 409);
}

export async function updateFieldVisitFields(
  userId,
  visitId,
  input = {},
  { db = prisma, now = new Date() } = {}
) {
  const ownerUserId = requireUserId(userId);
  const visit = await findOwnedVisit(db, ownerUserId, visitId);
  assertVisitOpen(visit);

  const data = {};
  if ("goal" in input) data.goal = normalizeText(input.goal, MAX_TEXT.goal);
  if ("locationText" in input) data.locationText = normalizeText(input.locationText, MAX_TEXT.locationText);
  if ("plannedStartAt" in input) data.plannedStartAt = normalizeDate(input.plannedStartAt, { field: "planned_start" });
  if ("plannedEndAt" in input) data.plannedEndAt = normalizeDate(input.plannedEndAt, { field: "planned_end" });
  if ("packKeyQuestions" in input) data.packKeyQuestions = normalizeKeyQuestions(input.packKeyQuestions) || [];
  if ("packSummaryText" in input) data.packSummaryText = normalizeText(input.packSummaryText, MAX_TEXT.packSummaryText);
  if (!Object.keys(data).length) throw fieldError("field.errors.nothing_to_update", 400);

  await casVisitUpdate(db, visit, input.version, data, now);
  const fresh = await findOwnedVisit(db, ownerUserId, visit.id);
  return serializeFieldVisit(fresh);
}

/**
 * Status/lifecycle actions. Every transition is explicit and CAS-guarded;
 * an illegal jump is a 409 (K1 4.2.2), never a silent overwrite.
 */
export async function performFieldVisitAction(
  userId,
  visitId,
  action,
  payload = {},
  { db = prisma, now = new Date() } = {}
) {
  const ownerUserId = requireUserId(userId);
  const visit = await findOwnedVisit(db, ownerUserId, visitId);
  const data = {};
  let targetStatus = null;
  const kind = String(action || "").trim();

  if (kind === "take_pack") {
    assertVisitOpen(visit);
    let sourceUpdatedAt = null;
    if (visit.preInquiryId) {
      const inquiry = await db.preInquiry.findFirst({
        where: { id: visit.preInquiryId, recipientOwnerId: ownerUserId },
        select: { updatedAt: true }
      });
      sourceUpdatedAt = inquiry?.updatedAt || null;
    }
    data.packTakenAt = now;
    data.packSourceUpdatedAt = sourceUpdatedAt;
    if (visit.status === FIELD_VISIT_STATUS.DRAFT) targetStatus = FIELD_VISIT_STATUS.PLANNED;
  } else if (kind === "confirm_arrival") {
    assertVisitOpen(visit);
    data.arrivedConfirmedAt = visit.arrivedConfirmedAt || now;
    if (visit.status === FIELD_VISIT_STATUS.PLANNED || visit.status === FIELD_VISIT_STATUS.DRAFT) {
      targetStatus = FIELD_VISIT_STATUS.IN_PROGRESS;
      if (visit.status === FIELD_VISIT_STATUS.DRAFT) {
        // DRAFT -> IN_PROGRESS is two legal steps; collapse via PLANNED.
        data.packTakenAt = visit.packTakenAt || now;
      }
    }
  } else if (kind === "confirm_departure") {
    assertVisitOpen(visit);
    data.departedConfirmedAt = visit.departedConfirmedAt || now;
    if (visit.status === FIELD_VISIT_STATUS.IN_PROGRESS || visit.status === FIELD_VISIT_STATUS.PLANNED) {
      targetStatus = FIELD_VISIT_STATUS.WRAP_UP;
    }
  } else if (kind === "reopen") {
    if (visit.status !== FIELD_VISIT_STATUS.WRAP_UP) throw fieldError("field.errors.invalid_transition", 409);
    targetStatus = FIELD_VISIT_STATUS.IN_PROGRESS;
  } else if (kind === "arm_safety") {
    assertVisitOpen(visit);
    const deadlineAt = normalizeDate(payload.deadlineAt, { field: "safety_deadline" });
    if (!deadlineAt || deadlineAt.getTime() <= now.getTime()) {
      throw fieldError("field.errors.invalid_safety_deadline", 400);
    }
    const contactEmail = normalizeText(payload.contactEmail, MAX_TEXT.safetyContactEmail, {
      required: true,
      field: "safety_contact"
    });
    if (!EMAIL_RE.test(contactEmail)) throw fieldError("field.errors.invalid_safety_contact", 400);
    data.safetyArmedAt = now;
    data.safetyDeadlineAt = deadlineAt;
    data.safetyContactEmail = contactEmail;
    data.safetyContactName = normalizeText(payload.contactName, MAX_TEXT.safetyContactName);
    data.safetyInstructions = normalizeText(payload.instructions, MAX_TEXT.safetyInstructions);
    data.safetyCancelledAt = null;
    data.safetyRemindedAt = null;
    data.safetyEscalatedAt = null;
    data.safetyEscalationAttempts = 0;
    data.safetyEscalationNextAttemptAt = null;
    data.safetyEscalationStatus = null;
    data.safetyResolvedNotifiedAt = null;
  } else if (kind === "extend_safety") {
    if (!visit.safetyArmedAt || visit.safetyCancelledAt) {
      throw fieldError("field.errors.safety_not_armed", 409);
    }
    const deadlineAt = normalizeDate(payload.deadlineAt, { field: "safety_deadline" });
    if (!deadlineAt || deadlineAt.getTime() <= now.getTime()) {
      throw fieldError("field.errors.invalid_safety_deadline", 400);
    }
    data.safetyDeadlineAt = deadlineAt;
    data.safetyRemindedAt = null;
  } else if (kind === "cancel_safety") {
    if (!visit.safetyArmedAt) throw fieldError("field.errors.safety_not_armed", 409);
    data.safetyCancelledAt = now;
  } else if (kind === "close") {
    if (!canTransitionFieldVisit(visit.status, FIELD_VISIT_STATUS.CLOSED)) {
      throw fieldError("field.errors.invalid_transition", 409);
    }
    targetStatus = FIELD_VISIT_STATUS.CLOSED;
    data.closedAt = now;
    if (visit.safetyArmedAt && !visit.safetyCancelledAt) data.safetyCancelledAt = now;
  } else if (kind === "cancel_visit") {
    if (!canTransitionFieldVisit(visit.status, FIELD_VISIT_STATUS.CANCELLED)) {
      throw fieldError("field.errors.invalid_transition", 409);
    }
    targetStatus = FIELD_VISIT_STATUS.CANCELLED;
    data.cancelledAt = now;
    if (visit.safetyArmedAt && !visit.safetyCancelledAt) data.safetyCancelledAt = now;
  } else {
    throw fieldError("field.errors.unknown_action", 400);
  }

  if (targetStatus && targetStatus !== visit.status) {
    if (
      !canTransitionFieldVisit(visit.status, targetStatus) &&
      !(visit.status === FIELD_VISIT_STATUS.DRAFT && targetStatus === FIELD_VISIT_STATUS.IN_PROGRESS)
    ) {
      throw fieldError("field.errors.invalid_transition", 409);
    }
    data.status = targetStatus;
  }

  /* SOL-FIELD-03: turvatoiming ja sulgemine on tõendatavad sündmused, seega
     seisumuutus ja tema tõend kirjutatakse ÜHES tehingus. Kui auditit ei saa
     kirjutada, ei tohi toiming vaikselt õnnestuda. */
  const audited =
    kind === "arm_safety" || kind === "cancel_safety" || kind === "close" || kind === "cancel_visit";
  if (audited) {
    await db.$transaction(async (tx) => {
      await casVisitUpdate(tx, visit, payload.version, data, now);
      await writeDataAudit({
        db: tx,
        actorUserId: ownerUserId,
        action: `field.visit_${kind}`,
        resourceType: "FIELD_VISIT",
        resourceId: visit.id
      });
    });
  } else {
    await casVisitUpdate(db, visit, payload.version, data, now);
  }

  const fresh = await findOwnedVisit(db, ownerUserId, visit.id);
  return serializeFieldVisit(fresh);
}

function normalizeNoteInput(input) {
  const kind = String(input.kind || FIELD_NOTE_KIND.NOTE).trim();
  if (!isFieldNoteKind(kind)) throw fieldError("field.errors.invalid_note_kind", 400);
  const provenance = String(input.provenance || "").trim();
  if (!isFieldProvenance(provenance)) throw fieldError("field.errors.invalid_provenance", 400);
  const body = normalizeText(input.body, MAX_TEXT.body, { required: true, field: "body" });
  const revision = Number(input.revision || 1);
  if (!Number.isInteger(revision) || revision < 1 || revision > 100000) {
    throw fieldError("field.errors.invalid_revision", 400);
  }
  const note = {
    kind,
    provenance,
    body,
    revision,
    deviceCreatedAt: normalizeDate(input.deviceCreatedAt, { field: "device_created" }),
    aiConfirmed: Boolean(input.aiConfirmed),
    consentKind: null,
    consentSubject: null,
    consentForm: null
  };
  if (kind === FIELD_NOTE_KIND.CONSENT) {
    const consentKind = String(input.consentKind || "").trim();
    if (!FIELD_CONSENT_KINDS.includes(consentKind)) {
      throw fieldError("field.errors.invalid_consent_kind", 400);
    }
    note.consentKind = consentKind;
    note.consentSubject = normalizeText(input.consentSubject, MAX_TEXT.safetyContactName);
    note.consentForm = normalizeText(input.consentForm, 40);
  }
  return note;
}

/**
 * Idempotent item PUT (doc ptk 3.3):
 * - same clientItemId + same content  -> 200 existing (replay-safe);
 * - revision = server revision + 1    -> normal edit sync;
 * - anything else with differing body -> 409 CONFLICT, the device version is
 *   preserved in the conflict* sibling fields until the owner resolves.
 */
export async function putFieldVisitNote(
  userId,
  visitId,
  clientItemId,
  input = {},
  { db = prisma, now = new Date() } = {}
) {
  const ownerUserId = requireUserId(userId);
  const visit = await findOwnedVisit(db, ownerUserId, visitId, {
    select: { id: true, ownerUserId: true, status: true }
  });
  assertVisitOpen(visit);
  const itemId = normalizeClientItemId(clientItemId);

  const existing = await db.fieldVisitNote.findFirst({
    where: { visitId: visit.id, clientItemId: itemId },
    select: NOTE_SELECT
  });

  const resolve = String(input.resolve || "").trim();
  if (resolve) {
    if (!existing) throw fieldError("api.common.not_found", 404);
    if (existing.conflictState !== "CONFLICT") throw fieldError("field.errors.no_conflict", 409);
    const clear = {
      conflictState: null,
      conflictRevision: null,
      conflictBody: null,
      conflictProvenance: null,
      updatedAt: now
    };
    if (resolve === "device") {
      clear.body = existing.conflictBody ?? existing.body;
      clear.provenance = existing.conflictProvenance ?? existing.provenance;
      clear.revision = existing.revision + 1;
      clear.contentSha256 = contentFingerprint({
        kind: existing.kind,
        provenance: clear.provenance,
        body: clear.body,
        consentKind: existing.consentKind,
        consentSubject: existing.consentSubject,
        consentForm: existing.consentForm
      });
    } else if (resolve !== "server") {
      throw fieldError("field.errors.invalid_resolve", 400);
    }
    await db.fieldVisitNote.updateMany({
      where: { visitId: visit.id, clientItemId: itemId },
      data: clear
    });
    const fresh = await db.fieldVisitNote.findFirst({
      where: { visitId: visit.id, clientItemId: itemId },
      select: NOTE_SELECT
    });
    return { resolved: true, note: serializeFieldNote(fresh) };
  }

  if (input.withdrawConsent) {
    if (!existing || existing.kind !== FIELD_NOTE_KIND.CONSENT) {
      throw fieldError("api.common.not_found", 404);
    }
    /* SOL-FIELD-03: nõusoleku tagasivõtmine ilma tõendita, KES ta tagasi võttis,
       on täpselt see kirje, mille pärast auditilogi olemas on. Üks tehing. */
    await db.$transaction(async (tx) => {
      await tx.fieldVisitNote.updateMany({
        where: { visitId: visit.id, clientItemId: itemId },
        data: { consentWithdrawnAt: existing.consentWithdrawnAt || now, updatedAt: now }
      });
      await writeDataAudit({
        db: tx,
        actorUserId: ownerUserId,
        action: "field.consent_withdrawn",
        resourceType: "FIELD_VISIT",
        resourceId: visit.id
      });
    });
    const fresh = await db.fieldVisitNote.findFirst({
      where: { visitId: visit.id, clientItemId: itemId },
      select: NOTE_SELECT
    });
    return { withdrawn: true, note: serializeFieldNote(fresh) };
  }

  const note = normalizeNoteInput(input);
  const sha = contentFingerprint(note);

  /**
   * SOL-FIELD-05: TEKSTI VASTUVÕTMINE JA TOORHELI KELL ON ÜKS TOIMING.
   *
   * Varem tegi kest kaks eraldi päringut: märkme saatmine läks sünkroonijärjekorda
   * ja `confirmTranscript` läks kohe, `.catch(() => {})` sees, staatust vaatamata.
   * Kui teine kukkus, oli kinnitatud tekst serveris olemas, toorheli aga jäi kuni
   * 7-päevase varutähtajani — ja liides ütles, et kõik õnnestus.
   *
   * Nüüd kannab märge ise viite salvestisele, mille tekst ta on, ja kell käivitub
   * SAMAS tehingus, kus tekst vastu võetakse. Kordus on ohutu: `updateMany`
   * tingimusega `transcriptConfirmedAt: null` on idempotentne, ja kui salvestist
   * enam ei ole, ei ole ka midagi kustutada — see EI OLE viga.
   */
  const transcriptItemId = input.transcriptClientItemId
    ? normalizeClientItemId(input.transcriptClientItemId)
    : null;
  const confirmTranscript = async (tx) => {
    if (!transcriptItemId || !note.aiConfirmed) return;
    await tx.fieldVisitAttachment.updateMany({
      where: {
        visitId: visit.id,
        clientItemId: transcriptItemId,
        role: FIELD_ATTACHMENT_ROLE.AUDIO,
        transcriptConfirmedAt: null
      },
      data: { transcriptConfirmedAt: now, updatedAt: now }
    });
  };

  if (!existing) {
    try {
      const created = await db.$transaction(async (tx) => {
        const row = await tx.fieldVisitNote.create({
          data: {
            visitId: visit.id,
            clientItemId: itemId,
            revision: note.revision,
            kind: note.kind,
            provenance: note.provenance,
            body: note.body,
            contentSha256: sha,
            consentKind: note.consentKind,
            consentSubject: note.consentSubject,
            consentForm: note.consentForm,
            aiConfirmedAt: note.aiConfirmed ? now : null,
            deviceCreatedAt: note.deviceCreatedAt,
            createdAt: now,
            updatedAt: now
          },
          select: NOTE_SELECT
        });
        await confirmTranscript(tx);
        return row;
      });
      return { created: true, note: serializeFieldNote(created) };
    } catch (error) {
      // Unique race with a parallel request: fall through to replay handling.
      if (error?.code !== "P2002") throw error;
      const raced = await db.fieldVisitNote.findFirst({
        where: { visitId: visit.id, clientItemId: itemId },
        select: NOTE_SELECT
      });
      if (raced && raced.contentSha256 === sha) {
        // Kordus: tekst on juba vastu võetud, aga kell võib olla käivitamata.
        await confirmTranscript(db);
        return { created: false, existing: true, note: serializeFieldNote(raced) };
      }
      throw fieldError("field.errors.note_conflict", 409, {
        conflict: raced ? serializeFieldNote(raced) : null
      });
    }
  }

  if (existing.contentSha256 === sha && existing.revision === note.revision) {
    await confirmTranscript(db);
    return { created: false, existing: true, note: serializeFieldNote(existing) };
  }

  if (note.revision === existing.revision + 1 && !existing.conflictState) {
    const result = await db.$transaction(async (tx) => {
      const updated = await tx.fieldVisitNote.updateMany({
        where: { visitId: visit.id, clientItemId: itemId, revision: existing.revision },
        data: {
          revision: note.revision,
          kind: note.kind,
          provenance: note.provenance,
          body: note.body,
          contentSha256: sha,
          consentKind: note.consentKind,
          consentSubject: note.consentSubject,
          consentForm: note.consentForm,
          aiConfirmedAt: note.aiConfirmed ? existing.aiConfirmedAt || now : existing.aiConfirmedAt,
          deviceCreatedAt: existing.deviceCreatedAt || note.deviceCreatedAt,
          updatedAt: now
        }
      });
      if (updated.count === 1) await confirmTranscript(tx);
      return updated;
    });
    if (result.count !== 1) {
      throw fieldError("field.errors.note_conflict", 409, { conflict: serializeFieldNote(existing) });
    }
    const fresh = await db.fieldVisitNote.findFirst({
      where: { visitId: visit.id, clientItemId: itemId },
      select: NOTE_SELECT
    });
    return { updated: true, note: serializeFieldNote(fresh) };
  }

  // Second-device divergence: preserve the incoming version alongside the
  // server one and surface both — nothing is lost, the owner picks.
  await db.fieldVisitNote.updateMany({
    where: { visitId: visit.id, clientItemId: itemId },
    data: {
      conflictState: "CONFLICT",
      conflictRevision: note.revision,
      conflictBody: note.body,
      conflictProvenance: note.provenance,
      updatedAt: now
    }
  });
  const fresh = await db.fieldVisitNote.findFirst({
    where: { visitId: visit.id, clientItemId: itemId },
    select: NOTE_SELECT
  });
  throw fieldError("field.errors.note_conflict", 409, {
    conflict: fresh ? serializeFieldNote(fresh) : null
  });
}

export async function deleteFieldVisitNote(
  userId,
  visitId,
  clientItemId,
  { db = prisma } = {}
) {
  const ownerUserId = requireUserId(userId);
  const visit = await findOwnedVisit(db, ownerUserId, visitId, {
    select: { id: true, ownerUserId: true, status: true }
  });
  assertVisitOpen(visit);
  const itemId = normalizeClientItemId(clientItemId);
  const result = await db.fieldVisitNote.deleteMany({
    where: { visitId: visit.id, clientItemId: itemId }
  });
  if (!result.count) throw fieldError("api.common.not_found", 404);
  return { deleted: true };
}

function buildHandoverArtifactContent(visit, notes, now) {
  const lines = [];
  lines.push(`# Külastuse kokkuvõte (mustand)`);
  if (visit.goal) lines.push(`Eesmärk: ${visit.goal}`);
  lines.push(`Kuupäev: ${now.toISOString().slice(0, 10)}`);
  lines.push("");
  for (const note of notes) {
    if (note.kind === FIELD_NOTE_KIND.CONSENT) continue;
    const confirmed = note.provenance === "AI_MUSTAND" && !note.aiConfirmedAt ? " (kinnitamata)" : "";
    lines.push(`- [${note.provenance}${confirmed}] ${note.body}`);
  }
  lines.push("");
  lines.push("See on töömustand (klass 1), mitte ametlik dokument.");
  return lines.join("\n");
}

/**
 * Handover to existing carriers (doc 2.1 step 16). Each target is its own
 * transaction and independently repeatable; neither copies case data into a
 * new registry.
 */
export async function handoverFieldVisit(
  userId,
  visitId,
  input = {},
  { db = prisma, now = new Date(), workflow = updatePreInquiryReceiverWorkflow } = {}
) {
  const ownerUserId = requireUserId(userId);
  const visit = await findOwnedVisit(db, ownerUserId, visitId);
  if (visit.status === FIELD_VISIT_STATUS.CANCELLED) {
    throw fieldError("field.errors.visit_read_only", 409);
  }
  const result = { artifact: null, preInquiry: null };

  if (input.toArtifact) {
    const includeIds = Array.isArray(input.noteClientItemIds)
      ? input.noteClientItemIds.map((id) => String(id || "").trim()).filter(Boolean)
      : null;
    const notes = await db.fieldVisitNote.findMany({
      where: {
        visitId: visit.id,
        ...(includeIds ? { clientItemId: { in: includeIds } } : {})
      },
      select: NOTE_SELECT,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 500
    });
    const title = normalizeText(input.artifactTitle, MAX_TEXT.title) || "Külastuse kokkuvõte";
    const content = buildHandoverArtifactContent(visit, notes, now);
    const artifact = await db.$transaction(async (tx) => {
      const created = await tx.agentArtifact.create({
        data: {
          ownerId: ownerUserId,
          type: "CASE_SUMMARY",
          status: "DRAFT",
          title,
          content,
          metadata: { source: "FIELD_VISIT", fieldVisitId: visit.id }
        },
        select: { id: true, title: true, status: true, type: true, createdAt: true }
      });
      await tx.fieldVisit.updateMany({
        where: { id: visit.id, ownerUserId },
        data: { handoverArtifactAt: now, updatedAt: now }
      });
      /* SOL-FIELD-03: üleandmine on andmete liikumine ühest kandjast teise —
         tema tõend kuulub SAMASSE tehingusse, mitte tema järele. */
      await writeDataAudit({
        db: tx,
        actorUserId: ownerUserId,
        action: "field.handover_artifact",
        resourceType: "FIELD_VISIT",
        resourceId: visit.id,
        meta: { artifactId: created.id }
      });
      return created;
    });
    result.artifact = artifact;
  }

  if (input.toPreInquiry) {
    if (!visit.preInquiryId) throw fieldError("field.errors.no_pre_inquiry", 409);
    const inquiry = await db.preInquiry.findFirst({
      where: { id: visit.preInquiryId, recipientOwnerId: ownerUserId, recalledAt: null },
      select: { id: true, receiverNote: true, updatedAt: true, status: true }
    });
    if (!inquiry) throw fieldError("api.common.not_found", 404);
    const summaryText = normalizeText(input.preInquiryNote, MAX_TEXT.handoverNote, {
      required: true,
      field: "handover_note"
    });
    // Append — never overwrite the receiver's existing plan text. The CAS
    // fingerprint inside the workflow protects against concurrent edits.
    const stamp = now.toISOString().slice(0, 10);
    const appended = [
      String(inquiry.receiverNote || "").trim(),
      `--- Välitöö üleandmine ${stamp} ---`,
      summaryText
    ]
      .filter(Boolean)
      .join("\n\n");
    const nextContactOn = input.nextContactOn == null ? undefined : input.nextContactOn;
    const updated = await workflow(
      ownerUserId,
      inquiry.id,
      {
        receiverNote: appended,
        ...(nextContactOn === undefined ? {} : { nextContactOn }),
        expectedUpdatedAt: inquiry.updatedAt
      },
      { db }
    );
    /* SOL-FIELD-03, AUS PIIR. Töövoog (`workflow`) commit'ib OMA tehingu — teda
       ei saa siia sisse mähkida, sest ta võtab ise ruumiluku. Atomaarne on see,
       mis on välitöö enda kirjutus: üleandmise tempel ja tema tõend. */
    await db.$transaction(async (tx) => {
      await tx.fieldVisit.updateMany({
        where: { id: visit.id, ownerUserId },
        data: { handoverPreInquiryAt: now, updatedAt: now }
      });
      await writeDataAudit({
        db: tx,
        actorUserId: ownerUserId,
        action: "field.handover_pre_inquiry",
        resourceType: "FIELD_VISIT",
        resourceId: visit.id,
        meta: { preInquiryId: inquiry.id }
      });
    });
    result.preInquiry = { id: inquiry.id, updated: Boolean(updated) };
  }

  if (!result.artifact && !result.preInquiry) {
    throw fieldError("field.errors.no_handover_target", 400);
  }
  const fresh = await findOwnedVisit(db, ownerUserId, visit.id);
  return { ...result, visit: serializeFieldVisit(fresh) };
}

export const fieldServiceInternals = Object.freeze({
  normalizeNoteInput,
  contentFingerprint,
  buildHandoverArtifactContent,
  normalizeKeyQuestions,
  MAX_TEXT
});
