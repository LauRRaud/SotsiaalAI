import { prisma } from "@/lib/prisma"
import {
  AUDIO_SOURCE_KINDS,
  buildTranscriptFileName,
  buildTranscriptTitle,
  getTranscriptionConfig,
  transcriptKindForAudioSource,
  TRANSCRIPT_DOCUMENT_KINDS,
  serializeAudioSourceDocument
} from "@/lib/documents/audioWorkflow"
import { logDocumentsAudit } from "@/lib/documents/audit"
import { enforceDocumentsRateLimit, readDocumentsRateLimit } from "@/lib/documents/rateLimit"
import {
  ensureDocumentsStorage,
  errorJson,
  getStoredDocumentPath,
  json,
  localeFromRequest,
  publicErrorMessageKey,
  publicErrorStatus,
  readStoredDocument,
  requireDocumentUser,
  writeStoredTextDocument
} from "@/lib/documents/server"
import { transcribeAudioFile } from "@/lib/transcription/provider"
import {
  createTranscriptionJob,
  failTranscriptionJob,
  completeTranscriptionJob,
  startTranscriptionJob
} from "@/lib/transcription/provider"
import { safeError } from "@/lib/privacy/safeError"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const DOCUMENTS_RATE_LIMIT_WINDOW_MS = readDocumentsRateLimit(process.env.DOCUMENTS_RATE_LIMIT_WINDOW_MS, 60_000, 1000)
const TRANSCRIPTION_RATE_LIMIT_MAX = readDocumentsRateLimit(process.env.DOCUMENTS_TRANSCRIPTION_RATE_LIMIT_MAX, 6)

async function resolveRouteId(paramsLike) {
  const params = await paramsLike
  return String(params?.id || "").trim()
}

function isAudioDocument(document) {
  if (!AUDIO_SOURCE_KINDS.includes(String(document?.kind || ""))) return false
  const mime = String(document?.mime || "").toLowerCase()
  return mime.startsWith("audio/") || mime === "video/webm" || mime === "video/mp4" || mime === "application/ogg"
}

function serializeTranscriptDocument(document) {
  return {
    id: document.id,
    title: document.title,
    originalName: document.originalName,
    kind: document.kind,
    mime: document.mime,
    size: document.size,
    sourceDocumentId: document.sourceDocumentId || null,
    content: document.content || "",
    metadata: document.metadata || null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  }
}

export async function POST(request, { params }) {
  const locale = localeFromRequest(request)
  const auth = await requireDocumentUser()
  if (!auth?.ok) {
    return errorJson(auth?.message || "api.common.unauthorized", auth?.status || 401, locale, {
      redirect: auth?.redirect,
      requireSubscription: auth?.requireSubscription
    })
  }

  const rateLimitResponse = enforceDocumentsRateLimit(request, {
    scope: "documents_transcription",
    userId: auth.userId,
    limit: TRANSCRIPTION_RATE_LIMIT_MAX,
    windowMs: DOCUMENTS_RATE_LIMIT_WINDOW_MS
  })
  if (rateLimitResponse) return rateLimitResponse

  const id = await resolveRouteId(params)
  if (!id) return errorJson("documents.errors.missing_id", 400, locale)

  let body = {}
  let transcriptionJob = null

  try {
    body = await request.json()
  } catch {}

  const config = getTranscriptionConfig(process.env)
  if (!config.enabled || config.provider === "disabled") {
    return errorJson("documents.errors.transcription_not_configured", 503, locale)
  }

  try {
    const source = await prisma.userDocument.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        title: true,
        originalName: true,
        kind: true,
        mime: true,
        size: true,
        storagePath: true,
        derivedDocuments: {
          where: { kind: { in: TRANSCRIPT_DOCUMENT_KINDS } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            title: true,
            originalName: true,
            kind: true,
            mime: true,
            size: true,
            sourceDocumentId: true,
            content: true,
            metadata: true,
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
    })

    if (!source) return errorJson("documents.errors.not_found", 404, locale)
    if (source.ownerId !== auth.userId) return errorJson("api.common.forbidden", 403, locale)
    if (!isAudioDocument(source)) return errorJson("documents.errors.audio_source_required", 400, locale)

    const existingTranscript = source.derivedDocuments?.[0] || null
    if (existingTranscript) {
      await logDocumentsAudit("document.transcription_reused", {
        userId: auth.userId,
        documentId: existingTranscript.id,
        sourceDocumentId: source.id,
        provider: existingTranscript.metadata?.transcriptionProvider || null,
        model: existingTranscript.metadata?.model || null
      })
      return json({
        ok: true,
        reused: true,
        transcriptDocument: serializeTranscriptDocument(existingTranscript),
        audioSource: serializeAudioSourceDocument(source)
      })
    }

    if (Number(source.size || 0) > config.maxFileSizeBytes) {
      return errorJson("documents.errors.audio_file_too_large", 413, locale, {
        maxFileSizeMb: config.maxFileSizeMb
      })
    }

    const transcriptKind = transcriptKindForAudioSource(source.kind)
    transcriptionJob = await createTranscriptionJob({
      sourceDocumentId: source.id,
      requestedByUserId: auth.userId,
      provider: config.provider,
      model: config.model,
      language: body?.language || config.language
    })

    await startTranscriptionJob({ jobId: transcriptionJob.id })

    await logDocumentsAudit("document.transcription_started", {
      userId: auth.userId,
      documentId: source.id,
      jobId: transcriptionJob.id,
      provider: config.provider,
      model: config.model,
      language: body?.language || config.language,
      size: source.size,
      mime: source.mime
    })

    const buffer = await readStoredDocument(source.storagePath)
    const result = await transcribeAudioFile({
      buffer,
      fileName: source.originalName,
      mime: source.mime,
      language: body?.language || config.language,
      env: process.env
    })
    const now = new Date()
    const transcriptFileName = buildTranscriptFileName(now)
    const storagePath = getStoredDocumentPath(transcriptFileName)
    await ensureDocumentsStorage()
    const stored = await writeStoredTextDocument(result.text, storagePath)

    const transcriptDocument = await prisma.userDocument.create({
      data: {
        ownerId: auth.userId,
        title: buildTranscriptTitle(now, locale),
        originalName: transcriptFileName,
        kind: transcriptKind,
        agentAllowed: true,
        mime: "text/plain",
        size: stored.size,
        sha256: stored.sha256,
        storagePath,
        sourceDocumentId: source.id,
        content: result.text,
        metadata: {
          transcriptionProvider: result.provider,
          model: result.model,
          language: result.language,
          sourceAudioDocumentId: source.id,
          generatedAt: now.toISOString(),
          sourceAudioKind: source.kind,
          sourceAudioMime: source.mime
        }
      },
      select: {
        id: true,
        title: true,
        originalName: true,
        kind: true,
        mime: true,
        size: true,
        sourceDocumentId: true,
        content: true,
        metadata: true,
        createdAt: true,
        updatedAt: true
      }
    })

    await logDocumentsAudit("document.transcription_completed", {
      userId: auth.userId,
      documentId: transcriptDocument.id,
      sourceDocumentId: source.id,
      jobId: transcriptionJob.id,
      provider: result.provider,
      model: result.model,
      language: result.language,
      size: transcriptDocument.size
    })

    await completeTranscriptionJob({
      jobId: transcriptionJob.id,
      transcriptDocumentId: transcriptDocument.id
    })

    const refreshedSource = {
      ...source,
      derivedDocuments: [transcriptDocument]
    }

    return json({
      ok: true,
      transcriptDocument: serializeTranscriptDocument(transcriptDocument),
      audioSource: serializeAudioSourceDocument(refreshedSource)
    }, 201)
  } catch (error) {
    const status = publicErrorStatus(error, 502)
    const messageKey = publicErrorMessageKey(error, "documents.errors.transcription_failed")
    if (status >= 500) console.error("[documents transcription] failed", safeError(error))
    if (transcriptionJob?.id) {
      await failTranscriptionJob({
        jobId: transcriptionJob.id,
        error: messageKey
      }).catch(() => {})
    }
    await logDocumentsAudit("document.transcription_failed", {
      userId: auth.userId,
      documentId: id,
      jobId: transcriptionJob?.id || null,
      provider: config.provider,
      model: config.model,
      status
    })
    return errorJson(messageKey, status, locale)
  }
}
