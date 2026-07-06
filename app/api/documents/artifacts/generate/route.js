import { prisma } from "@/lib/prisma"
import { effectiveRoleFromSession } from "@/lib/authz"
import {
  getMaxArtifactSourceDocumentsForRole,
  normalizeArtifactTitle,
  normalizeArtifactType,
  normalizeSelectedDocumentIds,
  serializeArtifactSource
} from "@/lib/documents/artifacts"
import {
  generateArtifactDraftContent,
  normalizeAgentAudience,
  normalizeAgentInstruction,
  normalizeAgentLanguage,
  normalizeAgentLength,
  normalizeAgentTone
} from "@/lib/documents/generation"
import { cacheRetrievalDebugMeta } from "@/lib/documents/retrievalObservability"
import { logDocumentsAudit } from "@/lib/documents/audit"
import { enforceDocumentsRateLimit, readDocumentsRateLimit } from "@/lib/documents/rateLimit"
import { errorJson, json, localeFromRequest, requireDocumentUser } from "@/lib/documents/server"
import { safeError } from "@/lib/privacy/safeError"
import { evaluateTextPrivacy, privacyConfirmationResponsePayload } from "@/lib/privacy/privacyGuard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const DOCUMENTS_RATE_LIMIT_WINDOW_MS = readDocumentsRateLimit(process.env.DOCUMENTS_RATE_LIMIT_WINDOW_MS, 60_000, 1000)
const ARTIFACTS_GENERATE_RATE_LIMIT_MAX = readDocumentsRateLimit(process.env.ARTIFACTS_CREATE_RATE_LIMIT_MAX, 20)

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
    scope: "artifacts_generate",
    userId: auth.userId,
    limit: ARTIFACTS_GENERATE_RATE_LIMIT_MAX,
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
  try {
    selectedDocumentIds = normalizeSelectedDocumentIds(body?.documentIds, {
      maxDocuments: getMaxArtifactSourceDocumentsForRole(role)
    })
  } catch (error) {
    return errorJson(error?.message || "documents.artifacts.errors.sources_required", Number(error?.status) || 400, locale)
  }

  const type = normalizeArtifactType(body?.type)
  const title = normalizeArtifactTitle(body?.title)
  const templateId = String(body?.templateId || "").trim() || null
  let instruction = ""
  let audience = "worker"
  let tone = "professional"
  let language = locale
  let length = "standard"

  try {
    instruction = normalizeAgentInstruction(body?.instruction)
    audience = normalizeAgentAudience(body?.audience)
    tone = normalizeAgentTone(body?.tone)
    language = normalizeAgentLanguage(body?.language, locale)
    length = normalizeAgentLength(body?.length)
  } catch (error) {
    return errorJson(error?.message || "documents.errors.invalid_payload", Number(error?.status) || 400, locale)
  }

  const privacy = evaluateTextPrivacy(instruction, {
    workflow: "document_generation",
    privacyDecision: body?.privacyDecision
  })
  if (privacy.needsPrivacyConfirmation) {
    return json(privacyConfirmationResponsePayload(privacy), 409)
  }
  instruction = privacy.processedText || instruction

  try {
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

    for (const transcriptDocument of documents.filter((document) => ["CALL_TRANSCRIPT", "AUDIO_TRANSCRIPT"].includes(document.kind))) {
      await logDocumentsAudit("document.transcript_used_for_draft", {
        userId: auth.userId,
        documentId: transcriptDocument.id,
        type,
        route: "api/documents/artifacts/generate"
      })
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

    const result = await generateArtifactDraftContent({
      type,
      documents,
      templateTitle: template?.title || null,
      instruction,
      audience,
      tone,
      language,
      length,
      observabilityRoute: "api/documents/artifacts/generate",
      observabilityStage: "document_generate",
      userId: auth.userId,
      userRole: role
    })
    const content = result?.content || ""
    if (content && result?.debugMeta) {
      cacheRetrievalDebugMeta(auth.userId, content, result.debugMeta)
    }

    const now = new Date()
    const sources = documents.map((document) => serializeArtifactSource({ document })).filter(Boolean)

    return json({
      ok: true,
      draft: {
        id: null,
        type,
        title,
        status: "DRAFT",
        approvedAt: null,
        templateId: template?.id || null,
        template: template
          ? {
              id: template.id,
              title: template.title,
              originalName: template.originalName
            }
          : null,
        content,
        snippet: "",
        createdAt: now,
        updatedAt: now,
        sourceCount: sources.length,
        sources,
        canDownload: false,
        downloadFormats: [],
        downloadUrl: null,
        downloadUrls: {},
        isTransient: true
      }
    })
  } catch (error) {
    const status = Number(error?.status) || 500
    const messageKey =
      status === 500 ? "documents.artifacts.errors.create_failed" : error?.message || "documents.artifacts.errors.create_failed"
    console.error("[documents artifacts] generate failed", safeError(error))
    return errorJson(messageKey, status, locale)
  }
}
