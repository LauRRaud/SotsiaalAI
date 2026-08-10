/**
 * FIELD-V1 attachments (doc ptk 4.8/5): photos and raw-audio drafts are
 * ordinary UserDocument carriers joined to a visit — no parallel file system.
 * Uploads are atomic (temp file → fsync-safe rename → DB row in one
 * transaction, compensating unlink on failure) so a partial upload can never
 * become a visible document. File names on disk are UUIDs; the stored title
 * is generated, never the device file name (log/PII minimisation).
 */

import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import {
  assertAudioSignature,
  ensureAllowedAudioUpload
} from "@/lib/documents/audioWorkflow";
import {
  ensureDocumentsStorage,
  getStoredDocumentPath,
  resolveAbsoluteDocumentPath
} from "@/lib/documents/server";
import { getDailyUploadQuotaBytes, getStorageQuotaBytes, getUtcDayStart } from "@/lib/storageGuardrails";
import { getUserDailyUploadBytes, getUserStorageUsageBytes } from "@/lib/storageUsage";
import { writeDataAudit } from "@/lib/privacy/audit";
import { fieldError } from "./service.js";
import { FIELD_ATTACHMENT_ROLE, FIELD_NOTE_KIND, FIELD_VISIT_STATUS } from "./constants.js";
import { sanitizeFieldPhoto } from "./imageSanitize.js";

const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const OPEN_STATUSES = new Set([
  FIELD_VISIT_STATUS.DRAFT,
  FIELD_VISIT_STATUS.PLANNED,
  FIELD_VISIT_STATUS.IN_PROGRESS,
  FIELD_VISIT_STATUS.WRAP_UP
]);
const CLIENT_ITEM_ID_RE = /^[A-Za-z0-9_-]{6,64}$/u;

function normalizeClientItemId(value) {
  const id = String(value || "").trim();
  if (!CLIENT_ITEM_ID_RE.test(id)) throw fieldError("field.errors.invalid_client_item_id", 400);
  return id;
}

async function findOpenVisit(db, userId, visitId) {
  const visit = await db.fieldVisit.findFirst({
    where: { id: String(visitId || "").trim(), ownerUserId: userId },
    select: { id: true, ownerUserId: true, status: true }
  });
  if (!visit) throw fieldError("api.common.not_found", 404);
  if (!OPEN_STATUSES.has(visit.status)) throw fieldError("field.errors.visit_read_only", 409);
  return visit;
}

function serializeAttachment(row) {
  return {
    clientItemId: row.clientItemId,
    role: row.role,
    documentId: row.documentId || null,
    consentClientItemId: row.consentClientItemId || null,
    transcriptConfirmedAt: row.transcriptConfirmedAt
      ? new Date(row.transcriptConfirmedAt).toISOString()
      : null,
    document: row.document
      ? {
          id: row.document.id,
          title: row.document.title,
          kind: row.document.kind,
          mime: row.document.mime,
          size: row.document.size
        }
      : null
  };
}

/** Atomic write: temp file in the uploads root, then rename over the target. */
async function writeAtomically(buffer, storagePath) {
  const absolutePath = resolveAbsoluteDocumentPath(storagePath);
  const tempPath = `${absolutePath}.tmp-${crypto.randomBytes(6).toString("hex")}`;
  await fs.writeFile(/*turbopackIgnore: true*/ tempPath, buffer);
  try {
    await fs.rename(tempPath, absolutePath);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {});
    throw error;
  }
  return { size: buffer.byteLength, sha256: crypto.createHash("sha256").update(buffer).digest("hex") };
}

async function unlinkStored(storagePath) {
  const absolutePath = resolveAbsoluteDocumentPath(storagePath);
  try {
    await fs.unlink(/*turbopackIgnore: true*/ absolutePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    return false;
  }
}

async function assertConsent(db, visitId, consentClientItemId, expectedKind) {
  const id = normalizeClientItemId(consentClientItemId);
  const consent = await db.fieldVisitNote.findFirst({
    where: {
      visitId,
      clientItemId: id,
      kind: FIELD_NOTE_KIND.CONSENT,
      consentKind: expectedKind,
      consentWithdrawnAt: null
    },
    select: { clientItemId: true }
  });
  if (!consent) throw fieldError("field.errors.consent_required", 409);
  return consent.clientItemId;
}

/**
 * Idempotent attachment PUT: an existing (visitId, clientItemId) pair returns
 * the stored row without touching the file system, so replays and reconcile
 * re-sends are safe.
 */
export async function putFieldVisitAttachment(
  userId,
  visitId,
  clientItemId,
  { file, role, consentClientItemId = null, documentOnly = false } = {},
  { db = prisma, now = new Date(), session = null } = {}
) {
  const ownerUserId = String(userId || "").trim();
  if (!ownerUserId) throw fieldError("api.common.unauthorized", 401);
  const visit = await findOpenVisit(db, ownerUserId, visitId);
  const itemId = normalizeClientItemId(clientItemId);

  const existing = await db.fieldVisitAttachment.findFirst({
    where: { visitId: visit.id, clientItemId: itemId },
    select: {
      clientItemId: true,
      role: true,
      documentId: true,
      consentClientItemId: true,
      transcriptConfirmedAt: true,
      document: { select: { id: true, title: true, kind: true, mime: true, size: true } }
    }
  });
  if (existing) return { created: false, existing: true, attachment: serializeAttachment(existing) };

  const normalizedRole = String(role || "").trim();
  if (![FIELD_ATTACHMENT_ROLE.PHOTO, FIELD_ATTACHMENT_ROLE.AUDIO].includes(normalizedRole)) {
    throw fieldError("field.errors.invalid_attachment_role", 400);
  }
  if (!file || typeof file.arrayBuffer !== "function") {
    throw fieldError("field.errors.file_required", 400);
  }

  // Consent gate (doc 4.9): audio always needs a consent record; a photo needs
  // one unless the worker explicitly marked it a client-requested document shot.
  let consentRef = null;
  if (normalizedRole === FIELD_ATTACHMENT_ROLE.AUDIO) {
    consentRef = await assertConsent(db, visit.id, consentClientItemId, "audio");
  } else if (!documentOnly) {
    consentRef = await assertConsent(db, visit.id, consentClientItemId, "photo");
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  let mime;
  let buffer;
  let kind;
  let titlePrefix;
  if (normalizedRole === FIELD_ATTACHMENT_ROLE.PHOTO) {
    if (rawBuffer.byteLength > MAX_PHOTO_BYTES) throw fieldError("field.errors.photo_too_large", 413);
    const sanitized = sanitizeFieldPhoto(rawBuffer, file.type);
    mime = sanitized.mime;
    buffer = sanitized.buffer;
    kind = "FIELD_PHOTO";
    titlePrefix = "Välitöö foto";
  } else {
    mime = ensureAllowedAudioUpload(file);
    assertAudioSignature(rawBuffer, mime, "");
    buffer = rawBuffer;
    kind = "UPLOADED_AUDIO_SOURCE";
    titlePrefix = "Välitöö heli";
  }

  const roleName = session?.user?.role || "CLIENT";
  const storageQuotaBytes = getStorageQuotaBytes(roleName);
  const [storageUsage, dailyUploadBytes] = await Promise.all([
    getUserStorageUsageBytes(ownerUserId),
    getUserDailyUploadBytes(ownerUserId, getUtcDayStart())
  ]);
  if (storageUsage.totalBytes + buffer.byteLength > storageQuotaBytes) {
    throw fieldError("documents.errors.storage_quota_exceeded", 413);
  }
  if (dailyUploadBytes + buffer.byteLength > getDailyUploadQuotaBytes()) {
    throw fieldError("documents.errors.daily_upload_quota_exceeded", 429);
  }

  await ensureDocumentsStorage();
  const extension = mime === "image/png" ? "photo.png" : mime === "image/jpeg" ? "photo.jpg" : "audio.webm";
  const storagePath = getStoredDocumentPath(extension);
  const stored = await writeAtomically(buffer, storagePath);
  const title = `${titlePrefix} ${now.toISOString().slice(0, 16).replace("T", " ")}`;

  try {
    const attachment = await db.$transaction(async (tx) => {
      const document = await tx.userDocument.create({
        data: {
          ownerId: ownerUserId,
          title,
          originalName: title,
          kind,
          agentAllowed: false,
          mime,
          size: stored.size,
          sha256: stored.sha256,
          storagePath,
          metadata: { source: "FIELD_VISIT", fieldVisitId: visit.id }
        },
        select: { id: true, title: true, kind: true, mime: true, size: true }
      });
      const row = await tx.fieldVisitAttachment.create({
        data: {
          visitId: visit.id,
          clientItemId: itemId,
          role: normalizedRole,
          documentId: document.id,
          consentClientItemId: consentRef,
          createdAt: now,
          updatedAt: now
        },
        select: {
          clientItemId: true,
          role: true,
          documentId: true,
          consentClientItemId: true,
          transcriptConfirmedAt: true
        }
      });
      return { ...row, document };
    });
    return { created: true, attachment: serializeAttachment(attachment) };
  } catch (error) {
    // Compensate the file so a failed DB write never leaves an orphan.
    await unlinkStored(storagePath);
    if (error?.code === "P2002") {
      const raced = await db.fieldVisitAttachment.findFirst({
        where: { visitId: visit.id, clientItemId: itemId },
        select: {
          clientItemId: true,
          role: true,
          documentId: true,
          consentClientItemId: true,
          transcriptConfirmedAt: true,
          document: { select: { id: true, title: true, kind: true, mime: true, size: true } }
        }
      });
      if (raced) return { created: false, existing: true, attachment: serializeAttachment(raced) };
    }
    throw error;
  }
}

/**
 * Delete an attachment together with its document carrier. The file is
 * removed first; a file-system failure aborts loudly (nothing half-deleted is
 * reported as success — FAILID F-07 class must not repeat here).
 */
export async function deleteFieldVisitAttachment(
  userId,
  visitId,
  clientItemId,
  { db = prisma } = {}
) {
  const ownerUserId = String(userId || "").trim();
  if (!ownerUserId) throw fieldError("api.common.unauthorized", 401);
  const visit = await db.fieldVisit.findFirst({
    where: { id: String(visitId || "").trim(), ownerUserId },
    select: { id: true }
  });
  if (!visit) throw fieldError("api.common.not_found", 404);
  const itemId = normalizeClientItemId(clientItemId);

  const attachment = await db.fieldVisitAttachment.findFirst({
    where: { visitId: visit.id, clientItemId: itemId },
    select: {
      id: true,
      documentId: true,
      document: { select: { id: true, ownerId: true, storagePath: true } }
    }
  });
  if (!attachment) throw fieldError("api.common.not_found", 404);

  const ownsDocument = Boolean(attachment.document && attachment.document.ownerId === ownerUserId);
  if (ownsDocument) {
    const unlinked = await unlinkStored(attachment.document.storagePath);
    if (!unlinked) throw fieldError("field.errors.delete_failed", 500);
  }

  /* SOL-FIELD-03: manuse kustutus on pöördumatu ja tema tõend kirjutatakse
     SAMAS tehingus. Fail on selleks hetkeks juba kettalt läinud — seda ei saa
     tagasi pöörata ja just seepärast peab kirje ütlema, kes seda tegi. */
  await db.$transaction(async (tx) => {
    await tx.fieldVisitAttachment.deleteMany({ where: { id: attachment.id } });
    if (ownsDocument) {
      await tx.userDocument.deleteMany({
        where: { id: attachment.document.id, ownerId: ownerUserId }
      });
    }
    await writeDataAudit({
      db: tx,
      actorUserId: ownerUserId,
      action: "field.attachment_deleted",
      resourceType: "FIELD_VISIT",
      resourceId: visit.id
    });
  });
  return { deleted: true };
}

/** Marks the raw-audio transcript as confirmed → starts the 0-day purge clock. */
export async function confirmFieldTranscript(
  userId,
  visitId,
  clientItemId,
  { db = prisma, now = new Date() } = {}
) {
  const ownerUserId = String(userId || "").trim();
  if (!ownerUserId) throw fieldError("api.common.unauthorized", 401);
  const visit = await db.fieldVisit.findFirst({
    where: { id: String(visitId || "").trim(), ownerUserId },
    select: { id: true }
  });
  if (!visit) throw fieldError("api.common.not_found", 404);
  const itemId = normalizeClientItemId(clientItemId);
  const result = await db.fieldVisitAttachment.updateMany({
    where: { visitId: visit.id, clientItemId: itemId, role: FIELD_ATTACHMENT_ROLE.AUDIO },
    data: { transcriptConfirmedAt: now, updatedAt: now }
  });
  if (!result.count) throw fieldError("api.common.not_found", 404);
  return { confirmed: true };
}

export const fieldAttachmentInternals = Object.freeze({ writeAtomically, unlinkStored });
