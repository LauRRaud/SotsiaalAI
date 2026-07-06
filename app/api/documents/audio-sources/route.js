import { prisma } from "@/lib/prisma"
import { effectiveRoleFromSession } from "@/lib/authz"
import {
  assertAudioSignature,
  AUDIO_SOURCE_KINDS,
  ensureAllowedAudioUpload,
  TRANSCRIPT_DOCUMENT_KINDS,
  serializeAudioSourceDocument
} from "@/lib/documents/audioWorkflow"
import { logDocumentsAudit } from "@/lib/documents/audit"
import { enforceDocumentsRateLimit, readDocumentsRateLimit } from "@/lib/documents/rateLimit"
import { getDailyUploadQuotaBytes, getStorageQuotaBytes, getUtcDayStart } from "@/lib/storageGuardrails"
import { getUserDailyUploadBytes, getUserStorageUsageBytes } from "@/lib/storageUsage"
import {
  deleteStoredDocument,
  ensureDocumentsStorage,
  errorJson,
  getStoredDocumentPath,
  json,
  localeFromRequest,
  normalizeDocumentTitle,
  requireDocumentUser,
  writeStoredBuffer
} from "@/lib/documents/server"
import { safeError } from "@/lib/privacy/safeError"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const DOCUMENTS_RATE_LIMIT_WINDOW_MS = readDocumentsRateLimit(process.env.DOCUMENTS_RATE_LIMIT_WINDOW_MS, 60_000, 1000)
const AUDIO_UPLOAD_RATE_LIMIT_MAX = readDocumentsRateLimit(process.env.DOCUMENTS_AUDIO_UPLOAD_RATE_LIMIT_MAX, 8)

function buildAudioInclude() {
  return {
    derivedDocuments: {
      where: { kind: { in: TRANSCRIPT_DOCUMENT_KINDS } },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: {
        id: true,
        title: true,
        kind: true,
        sourceDocumentId: true,
        content: true,
        createdAt: true,
        updatedAt: true
      }
    },
    callRecordingFiles: {
      orderBy: { createdAt: "desc" },
      take: 1,
      select: {
        callSessionId: true,
        recordingRequestId: true,
        durationSeconds: true,
        retentionUntil: true,
        recordingRequest: {
          select: {
            purpose: true,
            purposeText: true,
            callSession: { select: { startedAt: true, endedAt: true } }
          }
        }
      }
    }
  }
}

export async function GET(request) {
  const locale = localeFromRequest(request)
  const auth = await requireDocumentUser()
  if (!auth?.ok) {
    return errorJson(auth?.message || "api.common.unauthorized", auth?.status || 401, locale, {
      redirect: auth?.redirect,
      requireSubscription: auth?.requireSubscription
    })
  }

  try {
    const documents = await prisma.userDocument.findMany({
      where: {
        ownerId: auth.userId,
        kind: { in: AUDIO_SOURCE_KINDS },
        OR: [
          { mime: { startsWith: "audio/" } },
          { mime: "video/webm" },
          { mime: "video/mp4" },
          { mime: "application/ogg" }
        ]
      },
      select: {
        id: true,
        title: true,
        originalName: true,
        kind: true,
        mime: true,
        size: true,
        createdAt: true,
        updatedAt: true,
        ...buildAudioInclude()
      },
      orderBy: { updatedAt: "desc" },
      take: 50
    })

    return json({
      ok: true,
      audioSources: documents.map(serializeAudioSourceDocument)
    })
  } catch (error) {
    console.error("[documents audio] list failed", safeError(error))
    return errorJson("documents.errors.audio_sources_load_failed", 500, locale)
  }
}

export async function POST(request) {
  const locale = localeFromRequest(request)
  const auth = await requireDocumentUser()
  if (!auth?.ok) {
    return errorJson(auth?.message || "api.common.unauthorized", auth?.status || 401, locale, {
      redirect: auth?.redirect,
      requireSubscription: auth?.requireSubscription
    })
  }

  const rateLimitResponse = enforceDocumentsRateLimit(request, {
    scope: "documents_audio_upload",
    userId: auth.userId,
    limit: AUDIO_UPLOAD_RATE_LIMIT_MAX,
    windowMs: DOCUMENTS_RATE_LIMIT_WINDOW_MS
  })
  if (rateLimitResponse) return rateLimitResponse

  let formData
  try {
    formData = await request.formData()
  } catch {
    return errorJson("documents.errors.multipart_required", 400, locale)
  }

  const file = formData.get("file")
  const title = normalizeDocumentTitle(formData.get("title"), file?.name || "Helifail")
  let storagePath = ""

  try {
    const mime = ensureAllowedAudioUpload(file)
    const fileBytes = Number(file?.size || 0)
    const role = effectiveRoleFromSession(auth.session)
    const storageQuotaBytes = getStorageQuotaBytes(role)
    const [storageUsageBytes, dailyUploadBytes] = await Promise.all([
      getUserStorageUsageBytes(auth.userId),
      getUserDailyUploadBytes(auth.userId, getUtcDayStart())
    ])

    if (storageUsageBytes.totalBytes + fileBytes > storageQuotaBytes) {
      return errorJson("documents.errors.storage_quota_exceeded", 413, locale, {
        scope: "storage_quota",
        limit: storageQuotaBytes,
        used: storageUsageBytes.totalBytes
      })
    }

    if (dailyUploadBytes + fileBytes > getDailyUploadQuotaBytes()) {
      return errorJson("documents.errors.daily_upload_quota_exceeded", 429, locale, {
        scope: "daily_upload",
        limit: getDailyUploadQuotaBytes(),
        used: dailyUploadBytes
      })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    assertAudioSignature(buffer, mime, file.name)
    await ensureDocumentsStorage()
    storagePath = getStoredDocumentPath(file.name || "audio.webm")
    const stored = await writeStoredBuffer(buffer, storagePath)

    const document = await prisma.userDocument.create({
      data: {
        ownerId: auth.userId,
        title,
        originalName: String(file.name || title),
        kind: "UPLOADED_AUDIO_SOURCE",
        agentAllowed: false,
        mime,
        size: stored.size,
        sha256: stored.sha256,
        storagePath,
        metadata: {
          source: "DOCUMENT_AUDIO_UPLOAD"
        }
      },
      select: {
        id: true,
        title: true,
        originalName: true,
        kind: true,
        mime: true,
        size: true,
        createdAt: true,
        updatedAt: true,
        ...buildAudioInclude()
      }
    })

    await logDocumentsAudit("document.audio_uploaded", {
      userId: auth.userId,
      documentId: document.id,
      title: document.title,
      kind: document.kind,
      mime: document.mime,
      size: document.size
    })

    return json({
      ok: true,
      audioSource: serializeAudioSourceDocument(document)
    }, 201)
  } catch (error) {
    if (storagePath) {
      try {
        await deleteStoredDocument(storagePath)
      } catch (cleanupError) {
        console.error("[documents audio] upload cleanup failed", safeError(cleanupError))
      }
    }

    const status = Number(error?.status) || 500
    if (status === 500) console.error("[documents audio] upload failed", safeError(error))
    await logDocumentsAudit("document.upload_failed", {
      userId: auth.userId,
      title,
      originalName: String(file?.name || ""),
      kind: "UPLOADED_AUDIO_SOURCE",
      status
    })
    return errorJson(status === 500 ? "documents.errors.audio_upload_failed" : error?.message || "documents.errors.audio_upload_failed", status, locale, {
      maxFileSizeMb: error?.maxFileSizeMb || undefined
    })
  }
}
