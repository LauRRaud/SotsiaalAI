import { prisma } from "@/lib/prisma"
import { effectiveRoleFromSession } from "@/lib/authz"
import {
  getMaxArtifactSourceDocumentsForRole,
  normalizeArtifactTitle,
  normalizeArtifactType,
  normalizeSelectedDocumentIds
} from "@/lib/documents/artifacts"
import { persistArtifactDraft } from "@/lib/documents/persistDraft"
import { getStorageQuotaBytes } from "@/lib/storageGuardrails"
import { getUserStorageUsageBytes } from "@/lib/storageUsage"
import {
  generateArtifactDraftContent,
  normalizeAgentAudience,
  normalizeAgentInstruction,
  normalizeAgentLanguage,
  normalizeAgentLength,
  normalizeAgentTone
} from "@/lib/documents/generation"
import { logDocumentsAudit } from "@/lib/documents/audit"
import { enforceDocumentsRateLimit, readDocumentsRateLimit } from "@/lib/documents/rateLimit"
import { errorJson, json, localeFromRequest, requireDocumentUser, usageErrorJson } from "@/lib/documents/server"
import { safeError } from "@/lib/privacy/safeError"
import { evaluateTextPrivacy, privacyConfirmationResponsePayload } from "@/lib/privacy/privacyGuard"
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

  let usageHandle = null

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

    const storageQuotaBytes = getStorageQuotaBytes(role)
    const storageUsageBytes = await getUserStorageUsageBytes(auth.userId)
    if (storageUsageBytes.totalBytes >= storageQuotaBytes) {
      return errorJson("documents.errors.storage_quota_exceeded", 413, locale, {
        scope: "storage_quota",
        limit: storageQuotaBytes,
        used: storageUsageBytes.totalBytes
      })
    }

    try {
      usageHandle = await reserveUsageForRequest({
        request,
        userId: auth.userId,
        metric: "DOCUMENT_GENERATE",
        scope: "documents.generate",
        idempotencyKey: body?.idempotencyKey,
        metadata: { sourceCount: documents.length, type }
      })
    } catch (error) {
      return usageErrorJson(error, "documents.generate", locale)
    }

    // Arveldusjärjekord elab `runPaidResult`-is: tasu võetakse alles pärast püsivat mustandit.
    // Enne seda tekkinud viga vabastab reservatsiooni, seega üle ei jää arvestatud ühikut ilma
    // leitava tulemuseta. enforceQuota on false, sest üle kvoodi omaniku peatas juba eelkontroll.
    const { persisted } = await runPaidResult({
      reserve: () => usageHandle,
      produce: () =>
        generateArtifactDraftContent({
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
        }),
      persist: (result) =>
        persistArtifactDraft({
          userId: auth.userId,
          role,
          type,
          title,
          templateId: template?.id || null,
          documentIds: documents.map((document) => document.id),
          content: result?.content || "",
          debugMeta: result?.debugMeta || null,
          idempotencyKey: usageHandle?.idempotencyKey,
          enforceQuota: false
        }),
      commit: (handle) => commitUsageForRequest(handle),
      release: (handle, reason) => releaseUsageForRequest(handle, { reason }),
      onReleaseError: (releaseError) =>
        console.error("[documents artifacts] usage release failed", safeError(releaseError))
    })

    // `draft` mirrors `artifact` for the workspace client, which keys save-vs-update off draft.id.
    return json({ ok: true, artifact: persisted.artifact, draft: persisted.artifact }, 201)
  } catch (error) {
    const status = Number(error?.status) || 500
    const messageKey =
      status === 500 ? "documents.artifacts.errors.create_failed" : error?.message || "documents.artifacts.errors.create_failed"
    console.error("[documents artifacts] generate failed", safeError(error))
    return errorJson(messageKey, status, locale)
  }
}
