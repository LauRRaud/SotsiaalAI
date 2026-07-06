import { assertOwnedByUser } from "@/lib/documents/access"
import { buildDocumentAuditRecord } from "@/lib/documents/auditShared"
import {
  getMaxArtifactSourceDocumentsForRole,
  normalizeArtifactContent,
  normalizeArtifactType,
  normalizeSelectedDocumentIds
} from "@/lib/documents/artifacts"
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
import { prisma } from "@/lib/prisma"
import { effectiveRoleFromSession } from "@/lib/authz"
import { safeError } from "@/lib/privacy/safeError"
import { evaluateTextPrivacy, privacyConfirmationResponsePayload } from "@/lib/privacy/privacyGuard"
import { errorJson, json, localeFromRequest, requireDocumentUser } from "@/lib/documents/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const DOCUMENTS_RATE_LIMIT_WINDOW_MS = readDocumentsRateLimit(process.env.DOCUMENTS_RATE_LIMIT_WINDOW_MS, 60_000, 1000)
const ARTIFACTS_REFINE_RATE_LIMIT_MAX = readDocumentsRateLimit(process.env.ARTIFACTS_CREATE_RATE_LIMIT_MAX, 20)
const ARTIFACT_REFINEMENT_LIMIT = 3

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
  try {
    selectedDocumentIds = normalizeSelectedDocumentIds(body?.documentIds, {
      maxDocuments: getMaxArtifactSourceDocumentsForRole(role)
    })
    currentContent = normalizeArtifactContent(body?.currentContent)
    refinementInstruction = normalizeRefinementInstruction(body?.refinementInstruction)
    artifactId = String(body?.artifactId || "").trim()
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
  if (privacy.needsPrivacyConfirmation) {
    return json(privacyConfirmationResponsePayload(privacy), 409)
  }
  refinementInstruction = privacy.processedText || refinementInstruction

  try {
    if (artifactId) {
      const artifact = await prisma.agentArtifact.findUnique({
        where: {
          id: artifactId
        },
        select: {
          id: true,
          ownerId: true
        }
      })

      if (!artifact) {
        return errorJson("documents.artifacts.errors.not_found", 404, locale)
      }

      assertOwnedByUser(artifact, auth.userId)

      const usedRefinements = await prisma.documentAudit.count({
        where: {
          ownerId: auth.userId,
          artifactId: artifact.id,
          action: "ARTIFACT_REFINE"
        }
      })

      if (usedRefinements >= ARTIFACT_REFINEMENT_LIMIT) {
        return errorJson("api.common.rate_limited", 429, locale, {
          scope: "artifact_refine",
          limit: ARTIFACT_REFINEMENT_LIMIT,
          used: usedRefinements
        })
      }
    }

    const documents = await prisma.userDocument.findMany({
      where: {
        ownerId: auth.userId,
        id: {
          in: selectedDocumentIds
        }
      },
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
      return errorJson("documents.artifacts.errors.sources_not_found", 404, locale)
    }

    const notAllowed = documents.find((document) => !document.agentAllowed)
    if (notAllowed) {
      return errorJson("documents.artifacts.errors.source_not_allowed", 400, locale)
    }

    let template = null
    if (templateId) {
      template = await prisma.userDocument.findFirst({
        where: {
          id: templateId,
          ownerId: auth.userId,
          kind: "TEMPLATE"
        },
        select: {
          id: true,
          title: true,
          originalName: true,
          agentAllowed: true
        }
      })

      if (!template) {
        return errorJson("documents.artifacts.errors.template_not_found", 404, locale)
      }

      if (!template.agentAllowed) {
        return errorJson("documents.artifacts.errors.template_not_allowed", 400, locale)
      }
    }

    const result = await refineArtifactDraftContent({
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
      artifactId: artifactId || null
    })
    const content = result?.content || ""
    if (content && result?.debugMeta) {
      cacheRetrievalDebugMeta(auth.userId, content, result.debugMeta)
    }

    if (artifactId && content) {
      const auditRecord = buildDocumentAuditRecord("artifact.refined", {
        userId: auth.userId,
        artifactId
      })
      if (auditRecord) {
        await prisma.documentAudit.create({
          data: auditRecord
        })
      }
    }

    return json({
      ok: true,
      content,
      updatedAt: new Date().toISOString()
    })
  } catch (error) {
    const status = Number(error?.status) || 500
    const messageKey =
      status === 500 ? "documents.artifacts.errors.update_failed" : error?.message || "documents.artifacts.errors.update_failed"
    console.error("[documents artifacts] refine failed", safeError(error))
    return errorJson(messageKey, status, locale)
  }
}
