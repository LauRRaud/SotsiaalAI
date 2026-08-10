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
  requireDocumentUser,
  usageErrorJson
} from "@/lib/documents/server"
import { runPaidResult } from "@/lib/usage/paidResult"
import {
  commitUsageForRequest,
  releaseUsageForRequest,
  reserveUsageForRequest
} from "@/lib/usage/routeAdapter"
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
    const transcript = await prisma.userDocument.findFirst({
      where: { id, ownerId: auth.userId },
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
    if (!TRANSCRIPT_KINDS.has(transcript.kind)) return errorJson("documents.errors.transcript_required", 400, locale)

    const transcriptText = String(body?.content || transcript.content || "").trim()
    if (!transcriptText) return errorJson("documents.errors.transcript_required", 400, locale)

    const role = effectiveRoleFromSession(auth.session)
    const sourceAudioDocumentId = transcript.sourceDocumentId || transcript.metadata?.sourceAudioDocumentId || null

    // Kokkuvõte on dokumendiloome nagu iga teine: sama `DOCUMENT_GENERATE` leping, mitte
    // ainult minutipõhine mälupõhine rate-limit. Varem sai seda otsepunkti kaudu sama
    // muudetavat transkripti korduvalt genereerida ilma ühegi perioodikvoodita.
    let usageHandle = null
    try {
      usageHandle = await reserveUsageForRequest({
        request,
        userId: auth.userId,
        metric: "DOCUMENT_GENERATE",
        scope: "documents.transcript_summary",
        idempotencyKey: body?.idempotencyKey,
        metadata: { transcriptDocumentId: transcript.id, sourceAudioDocumentId }
      })
    } catch (error) {
      return usageErrorJson(error, "documents.transcript_summary", locale)
    }

    const { persisted: artifact } = await runPaidResult({
      reserve: () => usageHandle,
      produce: async () => {
        await logDocumentsAudit("document.transcript_summary_started", {
          userId: auth.userId,
          documentId: transcript.id,
          sourceAudioDocumentId,
          route: "api/documents/[id]/summary"
        })

        return generateTranscriptSummaryContent({
          transcriptText,
          language: normalizeAgentLanguage(body?.language, locale),
          userId: auth.userId,
          userRole: role
        })
      },
      persist: async (generated) => {
        const storageQuotaBytes = getStorageQuotaBytes(role)
        const storageUsageBytes = await getUserStorageUsageBytes(auth.userId)
        const summaryBytes = getUtf8ByteLength(generated.content)

        if (storageUsageBytes.totalBytes + summaryBytes > storageQuotaBytes) {
          const quotaError = new Error("documents.errors.storage_quota_exceeded")
          quotaError.status = 413
          quotaError.quota = { limit: storageQuotaBytes, used: storageUsageBytes.totalBytes }
          throw quotaError
        }

        const now = new Date()
        const created = await prisma.agentArtifact.create({
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
          artifactId: created.id,
          sourceAudioDocumentId,
          model: generated.model,
          chunkCount: generated.chunkCount
        })

        return created
      },
      commit: (handle) => commitUsageForRequest(handle),
      release: (handle, reason) => releaseUsageForRequest(handle, { reason }),
      onReleaseError: (releaseError) =>
        console.error("[documents transcript summary] usage release failed", safeError(releaseError))
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
    return errorJson(
      messageKey,
      status,
      locale,
      error?.quota ? { scope: "storage_quota", limit: error.quota.limit, used: error.quota.used } : undefined
    )
  }
}
