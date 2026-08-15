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
import { withStorageQuota } from "@/lib/documents/storageQuota";
import { getUtcDayStart } from "@/lib/storageGuardrails";
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
const FIELD_FILE_ACTION = Object.freeze({
  STAGE: "FIELD_FILE_STAGE",
  PUBLISH: "FIELD_FILE_PUBLISH",
  DELETE: "FIELD_FILE_DELETE"
});
const FIELD_FILE_ACTIONS = Object.freeze(Object.values(FIELD_FILE_ACTION));

function normalizeClientItemId(value) {
  const id = String(value || "").trim();
  if (!CLIENT_ITEM_ID_RE.test(id)) throw fieldError("field.errors.invalid_client_item_id", 400);
  return id;
}

async function findVisit(db, userId, visitId) {
  const visit = await db.fieldVisit.findFirst({
    where: { id: String(visitId || "").trim(), ownerUserId: userId },
    select: { id: true, ownerUserId: true, status: true, closedAt: true }
  });
  if (!visit) throw fieldError("api.common.not_found", 404);
  return visit;
}

function serializeAttachment(row) {
  const active = !row.storageStatus || row.storageStatus === "ACTIVE";
  return {
    clientItemId: row.clientItemId,
    role: row.role,
    documentId: active ? row.documentId || null : null,
    consentClientItemId: row.consentClientItemId || null,
    transcriptConfirmedAt: row.transcriptConfirmedAt
      ? new Date(row.transcriptConfirmedAt).toISOString()
      : null,
    deviceCreatedAt: row.deviceCreatedAt ? new Date(row.deviceCreatedAt).toISOString() : null,
    recoveryImportedAt: row.recoveryImportedAt ? new Date(row.recoveryImportedAt).toISOString() : null,
    captureBasis: row.captureBasis || null,
    documentRequestReason: row.documentRequestReason || null,
    documentRequestAt: row.documentRequestAt ? new Date(row.documentRequestAt).toISOString() : null,
    storageStatus: row.storageStatus || "ACTIVE",
    document: active && row.document
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

async function storedExists(storagePath) {
  if (!storagePath) return false;
  const absolutePath = resolveAbsoluteDocumentPath(storagePath);
  try {
    await fs.stat(/*turbopackIgnore: true*/ absolutePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

const defaultFileOps = Object.freeze({
  async write(storagePath, buffer) {
    await fs.writeFile(/*turbopackIgnore: true*/ resolveAbsoluteDocumentPath(storagePath), buffer);
  },
  async publish(stagingPath, finalPath) {
    if (await storedExists(finalPath)) return;
    await fs.rename(
      /*turbopackIgnore: true*/ resolveAbsoluteDocumentPath(stagingPath),
      /*turbopackIgnore: true*/ resolveAbsoluteDocumentPath(finalPath)
    );
  },
  async remove(storagePath) {
    if (!storagePath) return;
    try {
      await fs.unlink(/*turbopackIgnore: true*/ resolveAbsoluteDocumentPath(storagePath));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  },
  exists: storedExists
});

function attachmentSelect() {
  return {
    id: true,
    visitId: true,
    clientItemId: true,
    role: true,
    documentId: true,
    consentClientItemId: true,
    transcriptConfirmedAt: true,
    deviceCreatedAt: true,
    recoveryImportedAt: true,
    captureBasis: true,
    documentRequestReason: true,
    documentRequestAt: true,
    storageStatus: true,
    document: { select: { id: true, ownerId: true, storagePath: true, title: true, kind: true, mime: true, size: true } }
  };
}

/** Restart-safe worker for durable FIELD file jobs. */
export async function reconcileFieldVisitFileJobs(
  { ownerUserId = null, jobId = null } = {},
  { db = prisma, files = defaultFileOps } = {}
) {
  const jobs = await db.dataDeletionJob.findMany({
    where: {
      action: { in: FIELD_FILE_ACTIONS },
      status: { in: ["pending", "failed"] },
      ...(ownerUserId ? { targetUserId: ownerUserId } : {}),
      ...(jobId ? { id: jobId } : {})
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });
  const outcomes = [];
  for (const job of jobs) {
    try {
      if (job.action === FIELD_FILE_ACTION.STAGE) {
        await files.remove(job.storagePath);
        await db.dataDeletionJob.update({ where: { id: job.id }, data: { status: "done", attempts: { increment: 1 }, lastError: null } });
      } else if (job.action === FIELD_FILE_ACTION.PUBLISH) {
        const attachment = await db.fieldVisitAttachment.findUnique({
          where: { id: job.resourceId },
          select: attachmentSelect()
        });
        if (!attachment) {
          await files.remove(job.storagePath);
          await db.dataDeletionJob.update({ where: { id: job.id }, data: { status: "done", attempts: { increment: 1 }, lastError: null } });
        } else {
          const finalPath = String(job.externalRef || "");
          if (!(await files.exists(finalPath))) {
            if (!(await files.exists(job.storagePath))) throw new Error("field_file_missing_both_paths");
            await files.publish(job.storagePath, finalPath);
          }
          await db.$transaction(async (tx) => {
            await tx.userDocument.updateMany({
              where: { id: attachment.documentId, ownerId: job.targetUserId },
              data: { storagePath: finalPath }
            });
            await tx.fieldVisitAttachment.updateMany({
              where: { id: attachment.id, storageStatus: "PENDING_PUBLISH" },
              data: { storageStatus: "ACTIVE" }
            });
            await tx.dataDeletionJob.update({
              where: { id: job.id },
              data: { status: "done", attempts: { increment: 1 }, lastError: null }
            });
          });
        }
      } else {
        const attachment = await db.fieldVisitAttachment.findUnique({
          where: { id: job.resourceId },
          select: attachmentSelect()
        });
        await files.remove(job.storagePath);
        await db.$transaction(async (tx) => {
          if (attachment) {
            await tx.fieldVisitAttachment.deleteMany({ where: { id: attachment.id } });
            if (attachment.documentId) {
              await tx.userDocument.deleteMany({
                where: { id: attachment.documentId, ownerId: job.targetUserId }
              });
            }
            await writeDataAudit({
              db: tx,
              actorUserId: job.actorUserId || job.targetUserId,
              action: "field.attachment_deleted",
              resourceType: "FIELD_VISIT",
              resourceId: attachment.visitId
            });
          }
          await tx.dataDeletionJob.update({
            where: { id: job.id },
            data: { status: "done", attempts: { increment: 1 }, lastError: null }
          });
        });
      }
      outcomes.push({ jobId: job.id, status: "done" });
    } catch (error) {
      await db.dataDeletionJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          attempts: { increment: 1 },
          lastError: String(error?.message || "field_file_job_failed").slice(0, 500)
        }
      }).catch(() => {});
      outcomes.push({ jobId: job.id, status: "failed" });
    }
  }
  return outcomes;
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
  {
    file,
    role,
    consentClientItemId = null,
    documentOnly = false,
    documentRequestConfirmed = false,
    documentRequestReason = null,
    deviceCreatedAt = null
  } = {},
  { db = prisma, now = new Date(), session = null, quota = withStorageQuota, files = defaultFileOps } = {}
) {
  const ownerUserId = String(userId || "").trim();
  if (!ownerUserId) throw fieldError("api.common.unauthorized", 401);
  const visit = await findVisit(db, ownerUserId, visitId);
  const itemId = normalizeClientItemId(clientItemId);
  await reconcileFieldVisitFileJobs({ ownerUserId }, { db, files }).catch(() => {});

  const existing = await db.fieldVisitAttachment.findFirst({
    where: { visitId: visit.id, clientItemId: itemId },
    select: attachmentSelect()
  });
  if (existing) return { created: false, existing: true, attachment: serializeAttachment(existing) };

  const capturedAt = deviceCreatedAt ? new Date(deviceCreatedAt) : null;
  if (!OPEN_STATUSES.has(visit.status)) {
    throw fieldError("field.errors.visit_read_only", 409);
  }

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
  let captureBasis = null;
  let requestReason = null;
  if (normalizedRole === FIELD_ATTACHMENT_ROLE.AUDIO) {
    consentRef = await assertConsent(db, visit.id, consentClientItemId, "audio");
    captureBasis = "CONSENT";
  } else if (!documentOnly) {
    consentRef = await assertConsent(db, visit.id, consentClientItemId, "photo");
    captureBasis = "CONSENT";
  } else {
    requestReason = String(documentRequestReason || "").trim();
    if (!documentRequestConfirmed || !requestReason || requestReason.length > 500) {
      throw fieldError("field.errors.document_request_required", 409);
    }
    captureBasis = "CLIENT_DOCUMENT_REQUEST";
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

  await ensureDocumentsStorage();
  const extension = mime === "image/png" ? "photo.png" : mime === "image/jpeg" ? "photo.jpg" : "audio.webm";
  const finalStoragePath = getStoredDocumentPath(extension);
  const stagingPath = `${finalStoragePath}.field-staged-${crypto.randomUUID()}`;
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const title = `${titlePrefix} ${now.toISOString().slice(0, 16).replace("T", " ")}`;
  const job = await db.dataDeletionJob.create({
    data: {
      actorUserId: ownerUserId,
      targetUserId: ownerUserId,
      action: FIELD_FILE_ACTION.STAGE,
      resourceType: "FieldVisitAttachment",
      resourceId: `${visit.id}:${itemId}`,
      storagePath: stagingPath,
      externalRef: finalStoragePath,
      status: "pending",
      attempts: 0,
      createdAt: now,
      updatedAt: now
    }
  });

  try {
    await files.write(stagingPath, buffer);
    const roleName = session?.user?.role || "CLIENT";
    const pending = await quota(
      {
        userId: ownerUserId,
        role: roleName,
        addBytes: buffer.byteLength,
        dailyAddBytes: buffer.byteLength,
        dayStart: getUtcDayStart()
      },
      { db },
      async (tx) => {
      const document = await tx.userDocument.create({
        data: {
          ownerId: ownerUserId,
          title,
          originalName: title,
          kind,
          agentAllowed: false,
          mime,
          size: buffer.byteLength,
          sha256,
          storagePath: finalStoragePath,
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
          deviceCreatedAt: capturedAt,
          recoveryImportedAt: null,
          captureBasis,
          documentRequestReason: requestReason,
          documentRequestAt: captureBasis === "CLIENT_DOCUMENT_REQUEST" ? now : null,
          storageStatus: "PENDING_PUBLISH",
          createdAt: now,
          updatedAt: now
        },
        select: {
          clientItemId: true,
          id: true,
          role: true,
          documentId: true,
          consentClientItemId: true,
          transcriptConfirmedAt: true,
          deviceCreatedAt: true,
          recoveryImportedAt: true
          ,
          captureBasis: true,
          documentRequestReason: true,
          documentRequestAt: true,
          storageStatus: true
        }
      });
      await tx.dataDeletionJob.update({
        where: { id: job.id },
        data: {
          action: FIELD_FILE_ACTION.PUBLISH,
          resourceId: row.id,
          status: "pending",
          lastError: null,
          updatedAt: now
        }
      });
      if (captureBasis === "CLIENT_DOCUMENT_REQUEST") {
        await writeDataAudit({
          db: tx,
          actorUserId: ownerUserId,
          action: "field.photo_client_document_requested",
          resourceType: "FIELD_VISIT",
          resourceId: visit.id,
          meta: { attachmentId: row.id }
        });
      }
      return { ...row, document };
      }
    );
    const outcomes = await reconcileFieldVisitFileJobs({ jobId: job.id }, { db, files });
    if (outcomes[0]?.status !== "done") throw fieldError("field.errors.file_pending", 503);
    let attachment = await db.fieldVisitAttachment.findUnique({
      where: { id: pending.id },
      select: attachmentSelect()
    });
    if (attachment?.documentId && !attachment.document) {
      const document = await db.userDocument.findUnique({
        where: { id: attachment.documentId },
        select: { id: true, ownerId: true, storagePath: true, title: true, kind: true, mime: true, size: true }
      });
      attachment = { ...attachment, document };
    }
    return { created: true, recovered: false, attachment: serializeAttachment(attachment) };
  } catch (error) {
    if (error?.message !== "field.errors.file_pending") {
      await reconcileFieldVisitFileJobs({ jobId: job.id }, { db, files }).catch(() => {});
    }
    if (error?.code === "P2002") {
      const raced = await db.fieldVisitAttachment.findFirst({
        where: { visitId: visit.id, clientItemId: itemId },
        select: attachmentSelect()
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
  { db = prisma, now = new Date(), files = defaultFileOps } = {}
) {
  const ownerUserId = String(userId || "").trim();
  if (!ownerUserId) throw fieldError("api.common.unauthorized", 401);
  await reconcileFieldVisitFileJobs({ ownerUserId }, { db, files }).catch(() => {});
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
  const job = await db.$transaction(async (tx) => {
    await tx.fieldVisitAttachment.updateMany({
      where: { id: attachment.id },
      data: { storageStatus: "DELETE_PENDING", updatedAt: now }
    });
    return tx.dataDeletionJob.create({
      data: {
        actorUserId: ownerUserId,
        targetUserId: ownerUserId,
        action: FIELD_FILE_ACTION.DELETE,
        resourceType: "FieldVisitAttachment",
        resourceId: attachment.id,
        storagePath: ownsDocument ? attachment.document.storagePath : null,
        externalRef: ownsDocument ? attachment.document.id : null,
        status: "pending",
        attempts: 0,
        createdAt: now,
        updatedAt: now
      }
    });
  });
  const outcomes = await reconcileFieldVisitFileJobs({ jobId: job.id }, { db, files });
  if (outcomes[0]?.status !== "done") throw fieldError("field.errors.delete_pending", 503);
  return { deleted: true, jobId: job.id };
}

/**
 * Marks the raw-audio transcript as confirmed → starts the 0-day purge clock.
 *
 * SOL-FIELD-05: PÕHIRADA SEDA ENAM EI KUTSU — kinnitus rändab märkme endaga ja
 * kell käivitub samas tehingus, kus tekst vastu võetakse (`putFieldVisitNote`).
 * See jääb IDEMPOTENTSEKS taasteteeks: kordus ei liiguta kella ega anna 404-t,
 * sest juba kinnitatud salvestise puhul on soovitud seis ju käes.
 */
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
    where: {
      visitId: visit.id,
      clientItemId: itemId,
      role: FIELD_ATTACHMENT_ROLE.AUDIO,
      transcriptConfirmedAt: null
    },
    data: { transcriptConfirmedAt: now, updatedAt: now }
  });
  if (result.count) return { confirmed: true };

  /* Kirjutamata jäämine tähendab KAHTE eri asja ja neid ei tohi segada: kas ta
     on juba kinnitatud (kordus, edu) või teda ei ole olemas (404). */
  const already = await db.fieldVisitAttachment.findFirst({
    where: {
      visitId: visit.id,
      clientItemId: itemId,
      role: FIELD_ATTACHMENT_ROLE.AUDIO,
      transcriptConfirmedAt: { not: null }
    },
    select: { id: true }
  });
  if (!already) throw fieldError("api.common.not_found", 404);
  return { confirmed: true, alreadyConfirmed: true };
}

export const fieldAttachmentInternals = Object.freeze({ defaultFileOps, FIELD_FILE_ACTION });
