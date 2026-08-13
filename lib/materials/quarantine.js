import crypto from "node:crypto"

import prisma from "@/lib/prisma"
import { writeDataAudit } from "@/lib/privacy/audit"
import { createClamdScanner } from "./clamd.js"
import {
  deleteQuarantinedMaterial,
  getQuarantinedMaterialPath,
  writeQuarantinedMaterial
} from "./server.js"
import { validateMaterialBuffer } from "./validation.js"
import { defaultMaterialSanitizer } from "./sanitization.js"
import { materialRetentionPolicyFromEnvironment, retentionFieldsForQuarantine } from "./retentionPolicy.js"

const QUARANTINE_DELETE_ACTION = "MATERIAL_QUARANTINE_DELETE"

function intakeError(code, status = 503) {
  const error = new Error(code)
  error.code = code
  error.status = status
  return error
}

function failureCode(error) {
  const code = String(error?.code || error?.message || "scanner_unknown_result").trim()
  const allowed = new Set([
    "scanner_timeout",
    "scanner_unavailable",
    "scanner_non_loopback_forbidden",
    "scanner_protocol_error",
    "scanner_unknown_result",
    "scanner_signature_unknown",
    "scanner_signatures_stale"
  ])
  return allowed.has(code) ? code : "scanner_unknown_result"
}

function retryAt(now, attempts) {
  return new Date(now.getTime() + Math.min(60 * 60_000, 60_000 * (2 ** Math.min(6, Math.max(0, attempts - 1)))))
}

const defaultFiles = Object.freeze({
  write: writeQuarantinedMaterial,
  remove: deleteQuarantinedMaterial
})

export async function reconcileMaterialQuarantineDeletion(
  { receiptId } = {},
  { db = prisma, files = defaultFiles } = {}
) {
  const receipt = await db.materialUploadQuarantine.findUnique({ where: { id: String(receiptId || "") } })
  if (!receipt) return { deleted: true, replay: true }
  const job = await db.dataDeletionJob.findFirst({
    where: { action: QUARANTINE_DELETE_ACTION, resourceType: "MaterialUploadQuarantine", resourceId: receipt.id }
  })
  if (!job) throw intakeError("quarantine_delete_job_missing")
  try {
    if (receipt.quarantinePath) await files.remove(receipt.quarantinePath)
    await db.$transaction(async tx => {
      await tx.materialUploadQuarantine.update({
        where: { id: receipt.id },
        data: { quarantinePath: null, storageState: "REMOVED" }
      })
      await tx.dataDeletionJob.update({
        where: { id: job.id },
        data: { status: "done", attempts: { increment: 1 }, lastError: null, lastErrorCode: null, nextAttemptAt: null }
      })
    })
    return { deleted: true, replay: job.status === "done" }
  } catch {
    await db.dataDeletionJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        attempts: { increment: 1 },
        lastError: "quarantine_delete_failed",
        lastErrorCode: "quarantine_delete_failed",
        nextAttemptAt: retryAt(new Date(), Number(job.attempts || 0) + 1)
      }
    }).catch(() => {})
    throw intakeError("quarantine_delete_failed")
  }
}

async function enqueueRemoval({ receipt, actorUserId, code, db, audit, now }) {
  await db.$transaction(async tx => {
    await tx.materialUploadQuarantine.update({
      where: { id: receipt.id },
      data: { scanState: "INFECTED", failureCode: code, storageState: "DELETE_PENDING", scanNextAt: null }
    })
    await tx.dataDeletionJob.create({
      data: {
        actorUserId,
        targetUserId: receipt.submittedByUserId,
        action: QUARANTINE_DELETE_ACTION,
        resourceType: "MaterialUploadQuarantine",
        resourceId: receipt.id,
        status: "pending",
        attempts: 0,
        maxAttempts: 8,
        lastErrorCode: code,
        createdAt: now,
        updatedAt: now
      }
    })
    await audit({
      db: tx,
      actorUserId,
      targetUserId: receipt.submittedByUserId,
      action: "MATERIAL_MALWARE_REJECTED",
      resourceType: "MaterialUploadQuarantine",
      resourceId: receipt.id,
      meta: { failureCode: code, sha256: receipt.sha256 }
    })
  })
}

export async function quarantineMaterialUpload(
  { userId, originalName, mime, buffer: bufferLike } = {},
  {
    db = prisma,
    scanner = createClamdScanner(),
    validate = validateMaterialBuffer,
    sanitizer = defaultMaterialSanitizer,
    files = defaultFiles,
    audit = writeDataAudit,
    now = new Date()
  } = {}
) {
  const ownerId = String(userId || "").trim()
  if (!ownerId) throw intakeError("api.common.unauthorized", 401)
  const buffer = Buffer.isBuffer(bufferLike) ? bufferLike : Buffer.from(bufferLike || [])
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex")
  const quarantinePath = getQuarantinedMaterialPath()
  const retentionPolicy = materialRetentionPolicyFromEnvironment()
  let receipt = await db.materialUploadQuarantine.create({
    data: {
      submittedByUserId: ownerId,
      declaredMime: String(mime || ""),
      size: buffer.byteLength,
      sha256,
      quarantinePath,
      storageState: "QUARANTINED",
      scanState: "PENDING",
      validationState: "PENDING",
      scanAttempts: 0,
      ...retentionFieldsForQuarantine({ scanState: "PENDING" }, now, retentionPolicy),
      createdAt: now,
      updatedAt: now
    }
  })
  try {
    await files.write(buffer, quarantinePath)
  } catch {
    await db.materialUploadQuarantine.update({
      where: { id: receipt.id }, data: { storageState: "WRITE_FAILED", failureCode: "quarantine_write_failed" }
    }).catch(() => {})
    throw intakeError("quarantine_write_failed")
  }

  let result
  try {
    result = await scanner.scan(buffer)
  } catch (error) {
    const code = failureCode(error)
    receipt = await db.materialUploadQuarantine.update({
      where: { id: receipt.id },
      data: {
        scanState: "FAILED",
        failureCode: code,
        scanAttempts: { increment: 1 },
        scanNextAt: retryAt(now, Number(receipt.scanAttempts || 0) + 1),
        ...retentionFieldsForQuarantine({ scanState: "FAILED" }, now, retentionPolicy)
      }
    })
    throw intakeError(code)
  }

  const scanMeta = {
    scannedAt: now,
    engine: String(result.engine || "").slice(0, 100) || null,
    engineVersion: String(result.engineVersion || "").slice(0, 100) || null,
    signatureVersion: String(result.signatureVersion || "").slice(0, 100) || null,
    signatureUpdatedAt: result.signatureUpdatedAt || null,
    scanAttempts: { increment: 1 }
  }
  if (result.state === "CLEAN" && (
    !scanMeta.engine || !scanMeta.engineVersion || !scanMeta.signatureVersion || !scanMeta.signatureUpdatedAt
  )) {
    await db.materialUploadQuarantine.update({
      where: { id: receipt.id },
      data: {
        scanState: "FAILED",
        failureCode: "scanner_protocol_error",
        scanAttempts: { increment: 1 },
        scanNextAt: retryAt(now, Number(receipt.scanAttempts || 0) + 1),
        ...retentionFieldsForQuarantine({ scanState: "FAILED" }, now, retentionPolicy)
      }
    })
    throw intakeError("scanner_protocol_error")
  }
  if (result.state !== "CLEAN") {
    const code = result.state === "INFECTED" ? "malware_detected" : "scanner_unknown_result"
    await enqueueRemoval({ receipt, actorUserId: ownerId, code, db, audit, now })
    await reconcileMaterialQuarantineDeletion({ receiptId: receipt.id }, { db, files })
    throw intakeError(code, 422)
  }

  receipt = await db.materialUploadQuarantine.update({
    where: { id: receipt.id },
    data: {
      ...scanMeta,
      scanState: "CLEAN",
      failureCode: null,
      scanNextAt: null,
      ...retentionFieldsForQuarantine({ scanState: "CLEAN", validationState: "VALIDATED" }, now, retentionPolicy)
    }
  })
  try {
    await validate(buffer, mime)
  } catch (error) {
    await db.materialUploadQuarantine.update({
      where: { id: receipt.id },
      data: { validationState: "INVALID", failureCode: "file_validation_failed" }
    })
    throw error
  }
  let sanitized
  try {
    sanitized = await sanitizer.sanitize({ buffer, mime, originalName })
  } catch (error) {
    const code = String(error?.code || "material_sanitization_failed").slice(0, 120)
    await db.materialUploadQuarantine.update({
      where: { id: receipt.id },
      data: { validationState: "INVALID", failureCode: code }
    })
    throw error
  }
  receipt = await db.materialUploadQuarantine.update({
    where: { id: receipt.id }, data: { validationState: "VALIDATED" }
  })
  return {
    originalName: String(originalName || "material"),
    mime: String(mime || ""),
    size: buffer.byteLength,
    sha256,
    buffer,
    sanitizedBuffer: sanitized.buffer,
    sanitizedMime: sanitized.mime,
    sanitizedSha256: sanitized.sha256,
    sanitizationVersion: sanitized.version,
    quarantineReceiptId: receipt.id,
    scanState: receipt.scanState,
    validationState: receipt.validationState,
    scannedAt: receipt.scannedAt,
    scanEngine: receipt.engine,
    scanEngineVersion: receipt.engineVersion,
    scanSignatureVersion: receipt.signatureVersion,
    scanSignatureUpdatedAt: receipt.signatureUpdatedAt
  }
}

export { QUARANTINE_DELETE_ACTION }
