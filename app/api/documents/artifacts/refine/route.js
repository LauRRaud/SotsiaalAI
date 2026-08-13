import {
  getMaxArtifactSourceDocumentsForRole,
  normalizeArtifactContent,
  normalizeArtifactType,
  normalizeSelectedDocumentIds
} from "@/lib/documents/artifacts"
import {
  ARTIFACT_REFINEMENT_LIMIT,
  buildArtifactRefinementRequestHash,
  claimArtifactRefinement,
  failArtifactRefinement,
  persistArtifactRefinement
} from "@/lib/documents/artifactRefinements"
import { parseExpectedVersion } from "@/lib/documents/artifactMutation"
import {
  normalizeAgentAudience,
  normalizeAgentLanguage,
  normalizeAgentLength,
  normalizeAgentTone,
  normalizeRefinementInstruction,
  refineArtifactDraftContent
} from "@/lib/documents/generation"
import { cacheRetrievalDebugMeta } from "@/lib/documents/retrievalObservability"
import { enforceDocumentsRateLimit, readDocumentsRateLimit } from "@/lib/documents/rateLimit"
import { withStorageQuota } from "@/lib/documents/storageQuota"
import { prisma } from "@/lib/prisma"
import { effectiveRoleFromSession } from "@/lib/authz"
import { safeError } from "@/lib/privacy/safeError"
import { evaluateTextPrivacy, privacyConfirmationResponsePayload } from "@/lib/privacy/privacyGuard"
import { getUtf8ByteLength } from "@/lib/storageGuardrails"
import { errorJson, json, localeFromRequest, requireDocumentUser, usageErrorJson } from "@/lib/documents/server"
import {
  commitUsageForRequest,
  releaseUsageForRequest,
  reserveUsageForRequest
} from "@/lib/usage/routeAdapter"
import { runPaidResult } from "@/lib/usage/paidResult"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const DOCUMENTS_RATE_LIMIT_WINDOW_MS = readDocumentsRateLimit(process.env.DOCUMENTS_RATE_LIMIT_WINDOW_MS, 60_000, 1000)
const ARTIFACTS_REFINE_RATE_LIMIT_MAX = readDocumentsRateLimit(process.env.ARTIFACTS_CREATE_RATE_LIMIT_MAX, 20)

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
    scope: "artifacts_refine",
    userId: auth.userId,
    limit: ARTIFACTS_REFINE_RATE_LIMIT_MAX,
    windowMs: DOCUMENTS_RATE_LIMIT_WINDOW_MS
  })
  if (rateLimitResponse) return rateLimitResponse

  let body = {}
  try {
    body = await request.json()
  } catch {
    return errorJson("documents.errors.invalid_payload", 400, locale)
  }

  const role = effectiveRoleFromSession(auth.session)
  let selectedDocumentIds
  let currentContent = ""
  let refinementInstruction = ""
  let artifactId = ""
  let expectedUpdatedAt = null
  let idempotencyKey = ""
  try {
    selectedDocumentIds = normalizeSelectedDocumentIds(body?.documentIds, {
      maxDocuments: getMaxArtifactSourceDocumentsForRole(role)
    })
    currentContent = normalizeArtifactContent(body?.currentContent)
    refinementInstruction = normalizeRefinementInstruction(body?.refinementInstruction)
    artifactId = String(body?.artifactId || "").trim()
    expectedUpdatedAt = parseExpectedVersion(body?.expectedUpdatedAt)
    idempotencyKey = String(body?.idempotencyKey || "").trim()
    if (!artifactId || !expectedUpdatedAt || !idempotencyKey) throw new Error("documents.errors.invalid_payload")
  } catch (error) {
    return errorJson(error?.message || "documents.errors.invalid_payload", Number(error?.status) || 400, locale)
  }

  const type = normalizeArtifactType(body?.type)
  const templateId = String(body?.templateId || "").trim() || null
  const audience = normalizeAgentAudience(body?.audience)
  const tone = normalizeAgentTone(body?.tone)
  const language = normalizeAgentLanguage(body?.language, locale)
  const length = normalizeAgentLength(body?.length)
  const privacy = evaluateTextPrivacy(refinementInstruction, {
    workflow: "document_refinement",
    privacyDecision: body?.privacyDecision
  })
  if (privacy.needsPrivacyConfirmation) return json(privacyConfirmationResponsePayload(privacy), 409)
  refinementInstruction = privacy.processedText || refinementInstruction

  const requestHash = buildArtifactRefinementRequestHash({
    artifactId,
    expectedUpdatedAt: expectedUpdatedAt.toISOString(),
    documentIds: selectedDocumentIds,
    type,
    templateId,
    currentContent,
    refinementInstruction,
    audience,
    tone,
    language,
    length
  })

  let refinement = null
  let usageHandle = null
  try {
    const claim = await claimArtifactRefinement({
      artifactId,
      ownerId: auth.userId,
      idempotencyKey,
      requestHash,
      expectedUpdatedAt
    })
    refinement = claim.refinement
    if (claim.cached) {
      return json({
        ok: true,
        content: refinement.resultContent || "",
        updatedAt: refinement.resultUpdatedAt,
        refinement: { id: refinement.id, reused: true, cached: true }
      })
    }

    const artifact = await prisma.agentArtifact.findFirst({
      where: { id: artifactId, ownerId: auth.userId },
      select: { content: true }
    })
    if (!artifact) {
      throw Object.assign(new Error("documents.artifacts.errors.not_found"), { status: 404 })
    }

    const documents = await prisma.userDocument.findMany({
      where: { ownerId: auth.userId, id: { in: selectedDocumentIds } },
      select: {
        id: true,
        title: true,
        originalName: true,
        kind: true,
        templateFor: true,
        agentAllowed: true,
        mime: true,
        storagePath: true,
        sha256: true,
        updatedAt: true
      }
    })
    if (documents.length !== selectedDocumentIds.length) {
      throw Object.assign(new Error("documents.artifacts.errors.sources_not_found"), { status: 404 })
    }
    if (documents.some((document) => !document.agentAllowed)) {
      throw Object.assign(new Error("documents.artifacts.errors.source_not_allowed"), { status: 400 })
    }

    let template = null
    if (templateId) {
      template = await prisma.userDocument.findFirst({
        where: { id: templateId, ownerId: auth.userId, kind: "TEMPLATE" },
        select: { id: true, title: true, originalName: true, agentAllowed: true }
      })
      if (!template) throw Object.assign(new Error("documents.artifacts.errors.template_not_found"), { status: 404 })
      if (!template.agentAllowed) throw Object.assign(new Error("documents.artifacts.errors.template_not_allowed"), { status: 400 })
    }

    try {
      usageHandle = await reserveUsageForRequest({
        request,
        userId: auth.userId,
        metric: "DOCUMENT_REFINE",
        scope: "documents.refine",
        idempotencyKey,
        metadata: { artifactId, sourceCount: documents.length, type, refinementId: refinement.id }
      })
    } catch (error) {
      await failArtifactRefinement({
        refinementId: refinement.id,
        claimToken: refinement.claimToken,
        errorCode: error?.code || "USAGE_RESERVE_FAILED"
      })
      return usageErrorJson(error, "documents.refine", locale)
    }

    const { persisted } = await runPaidResult({
      reserve: () => usageHandle,
      produce: () => refineArtifactDraftContent({
        type,
        documents,
        templateTitle: template?.title || null,
        currentContent,
        refinementInstruction,
        audience,
        tone,
        language,
        length,
        observabilityRoute: "api/documents/artifacts/refine",
        observabilityStage: "document_refine",
        userId: auth.userId,
        userRole: role,
        artifactId
      }),
      persist: async (result, handle) => {
        const content = result?.content || ""
        if (content && result?.debugMeta) cacheRetrievalDebugMeta(auth.userId, content, result.debugMeta)
        return withStorageQuota(
          {
            userId: auth.userId,
            role,
            addBytes: getUtf8ByteLength(content),
            releaseBytes: getUtf8ByteLength(artifact.content)
          },
          {},
          (tx) => persistArtifactRefinement(
            {
              refinementId: refinement.id,
              claimToken: refinement.claimToken,
              ownerId: auth.userId,
              artifactId,
              expectedUpdatedAt,
              content,
              debugMeta: result?.debugMeta || null,
              used: claim.used,
              commitUsage: (db) => commitUsageForRequest(handle, { tx: db })
            },
            { db: tx }
          )
        )
      },
      release: async (handle, reason) => {
        await releaseUsageForRequest(handle, { reason })
        await failArtifactRefinement({
          refinementId: refinement.id,
          claimToken: refinement.claimToken,
          errorCode: reason
        })
      },
      onReleaseError: (releaseError) =>
        console.error("[documents artifacts] refinement release failed", safeError(releaseError))
    })

    return json({
      ok: true,
      content: persisted.content,
      updatedAt: persisted.updatedAt,
      refinement: { id: persisted.jobId, reused: claim.reused, cached: false }
    })
  } catch (error) {
    if (refinement?.id && refinement?.claimToken) {
      await failArtifactRefinement({
        refinementId: refinement.id,
        claimToken: refinement.claimToken,
        errorCode: error?.code || error?.message || "REFINEMENT_FAILED"
      }).catch((cleanupError) =>
        console.error("[documents artifacts] refinement cleanup failed", safeError(cleanupError))
      )
    }
    const status = Number(error?.status) || 500
    if (status === 429) {
      return errorJson("api.common.rate_limited", 429, locale, {
        scope: "artifact_refine",
        limit: error.refinementLimit ?? ARTIFACT_REFINEMENT_LIMIT,
        used: error.usedRefinements
      })
    }
    const extra = error?.retryAfter ? { retryAfter: error.retryAfter } : undefined
    if (status >= 500) console.error("[documents artifacts] refine failed", safeError(error))
    return errorJson(
      status === 500 ? "documents.artifacts.errors.update_failed" : error?.message || "documents.artifacts.errors.update_failed",
      status,
      locale,
      extra
    )
  }
}
