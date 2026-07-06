import { effectiveRoleFromSession } from "@/lib/authz"
import { prisma } from "@/lib/prisma"
import { buildTranscriptSummaryTitle } from "@/lib/documents/audioWorkflow"
import { logDocumentsAudit } from "@/lib/documents/audit"
import { serializeArtifact } from "@/lib/documents/artifacts"
import { generateTranscriptSummaryContent, normalizeAgentLanguage } from "@/lib/documents/generation"
import { enforceDocumentsRateLimit, readDocumentsRateLimit } from "@/lib/documents/rateLimit"
import {
  errorJson,
  json,
  localeFromRequest,
  publicErrorMessageKey,
  publicErrorStatus,
  requireDocumentUser
} from "@/lib/documents/server"
import { safeError } from "@/lib/privacy/safeError"
import { getStorageQuotaBytes, getUtf8ByteLength } from "@/lib/storageGuardrails"
import { getUserStorageUsageBytes } from "@/lib/storageUsage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const DOCUMENTS_RATE_LIMIT_WINDOW_MS = readDocumentsRateLimit(process.env.DOCUMENTS_RATE_LIMIT_WINDOW_MS, 60_000, 1000)
const SUMMARY_RATE_LIMIT_MAX = readDocumentsRateLimit(process.env.DOCUMENTS_TRANSCRIPT_SUMMARY_RATE_LIMIT_MAX, 8)
const TRANSCRIPT_KINDS = new Set(["CALL_TRANSCRIPT", "AUDIO_TRANSCRIPT"])

const artifactInclude = {
  template: {
    select: {
      id: true,
      title: true,
      originalName: true
    }
  },
  sourceDocuments: {
    include: {
      document: {
        select: {
          id: true,
          title: true,
          originalName: true,
          kind: true,
          templateFor: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  }
}

async function resolveRouteId(paramsLike) {
  const params = await paramsLike
  return String(params?.id || "").trim()
}

function serializeSummaryArtifact(artifact) {
  const serialized = serializeArtifact(artifact, { includeContent: true })
  return {
    ...serialized,
    metadata: artifact.metadata || null,
    sourceTranscriptDocumentId: artifact.metadata?.sourceTranscriptDocumentId || null,
    sourceAudioDocumentId: artifact.metadata?.sourceAudioDocumentId || null
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
    scope: "documents_transcript_summary",
    userId: auth.userId,
    limit: SUMMARY_RATE_LIMIT_MAX,
    windowMs: DOCUMENTS_RATE_LIMIT_WINDOW_MS
  })
  if (rateLimitResponse) return rateLimitResponse

  const id = await resolveRouteId(params)
  if (!id) return errorJson("documents.errors.missing_id", 400, locale)

  let body = {}
  try {
    body = await request.json()
  } catch {}

  try {
    const transcript = await prisma.userDocument.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        title: true,
        originalName: true,
        kind: true,
        content: true,
        sourceDocumentId: true,
        metadata: true
      }
    })

    if (!transcript) return errorJson("documents.errors.not_found", 404, locale)
    if (transcript.ownerId !== auth.userId) return errorJson("api.common.forbidden", 403, locale)
    if (!TRANSCRIPT_KINDS.has(transcript.kind)) return errorJson("documents.errors.transcript_required", 400, locale)

    const transcriptText = String(body?.content || transcript.content || "").trim()
    if (!transcriptText) return errorJson("documents.errors.transcript_required", 400, locale)

    const role = effectiveRoleFromSession(auth.session)
    await logDocumentsAudit("document.transcript_summary_started", {
      userId: auth.userId,
      documentId: transcript.id,
      sourceAudioDocumentId: transcript.sourceDocumentId || transcript.metadata?.sourceAudioDocumentId || null,
      route: "api/documents/[id]/summary"
    })

    const generated = await generateTranscriptSummaryContent({
      transcriptText,
      language: normalizeAgentLanguage(body?.language, locale),
      userId: auth.userId,
      userRole: role
    })

    const storageQuotaBytes = getStorageQuotaBytes(role)
    const storageUsageBytes = await getUserStorageUsageBytes(auth.userId)
    const summaryBytes = getUtf8ByteLength(generated.content)

    if (storageUsageBytes.totalBytes + summaryBytes > storageQuotaBytes) {
      return errorJson("documents.errors.storage_quota_exceeded", 413, locale, {
        scope: "storage_quota",
        limit: storageQuotaBytes,
        used: storageUsageBytes.totalBytes
      })
    }

    const now = new Date()
    const sourceAudioDocumentId = transcript.sourceDocumentId || transcript.metadata?.sourceAudioDocumentId || null
    const artifact = await prisma.agentArtifact.create({
      data: {
        ownerId: auth.userId,
        type: "TRANSCRIPT_SUMMARY",
        title: buildTranscriptSummaryTitle(now, locale),
        status: "DRAFT",
        content: generated.content,
        metadata: {
          generatedFrom: "transcript",
          sourceTranscriptDocumentId: transcript.id,
          sourceAudioDocumentId,
          model: generated.model,
          chunkCount: generated.chunkCount,
          generatedAt: now.toISOString()
        },
        sourceDocuments: {
          create: {
            documentId: transcript.id
          }
        }
      },
      include: artifactInclude
    })

    await logDocumentsAudit("document.transcript_summary_completed", {
      userId: auth.userId,
      documentId: transcript.id,
      artifactId: artifact.id,
      sourceAudioDocumentId,
      model: generated.model,
      chunkCount: generated.chunkCount
    })

    return json({
      ok: true,
      summaryArtifact: serializeSummaryArtifact(artifact)
    }, 201)
  } catch (error) {
    const status = publicErrorStatus(error, 502)
    const messageKey = publicErrorMessageKey(error, "documents.errors.summary_failed")
    if (status >= 500) console.error("[documents transcript summary] failed", safeError(error))
    await logDocumentsAudit("document.transcript_summary_failed", {
      userId: auth.userId,
      documentId: id,
      status
    })
    return errorJson(messageKey, status, locale)
  }
}
