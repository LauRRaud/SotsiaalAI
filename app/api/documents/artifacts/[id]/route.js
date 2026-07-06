import { assertOwnedByUser } from "@/lib/documents/access"
import { logDocumentsAudit } from "@/lib/documents/audit"
import { effectiveRoleFromSession } from "@/lib/authz"
import {
  assertDraftArtifactEditable,
  normalizeArtifactContent,
  normalizeArtifactTitle,
  serializeArtifact
} from "@/lib/documents/artifacts"
import { getCachedRetrievalDebugMeta } from "@/lib/documents/retrievalObservability"
import { prisma } from "@/lib/prisma"
import { enforceDocumentsRateLimit, readDocumentsRateLimit } from "@/lib/documents/rateLimit"
import { errorJson, json, localeFromRequest, requireDocumentUser } from "@/lib/documents/server"
import { safeError } from "@/lib/privacy/safeError"
import { getStorageQuotaBytes, getUtf8ByteLength } from "@/lib/storageGuardrails"
import { getUserStorageUsageBytes } from "@/lib/storageUsage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const DOCUMENTS_RATE_LIMIT_WINDOW_MS = readDocumentsRateLimit(process.env.DOCUMENTS_RATE_LIMIT_WINDOW_MS, 60_000, 1000)
const ARTIFACTS_MUTATION_RATE_LIMIT_MAX = readDocumentsRateLimit(process.env.ARTIFACTS_MUTATION_RATE_LIMIT_MAX, 30)

async function resolveRouteId(paramsLike) {
  const params = await paramsLike
  return String(params?.id || "").trim()
}

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

async function findOwnedArtifact(id, userId) {
  const artifact = await prisma.agentArtifact.findUnique({
    where: { id },
    include: artifactInclude
  })

  if (!artifact) return null
  assertOwnedByUser(artifact, userId)
  return artifact
}

function buildRetrievalAuditFields(debugMeta) {
  if (!debugMeta) return {}
  return {
    retrievalMode: debugMeta.retrieval_mode || null,
    chunksUsed: Number(debugMeta.chunks_used) || 0,
    fallbackUsed: debugMeta.retrieval_mode === "fallback_source_material",
    fallbackReason: debugMeta.fallback_reason || null,
    documentsIndexed: Number(debugMeta.documents_indexed) || 0,
    tokenBudget: Number(debugMeta.token_budget) || 0
  }
}

export async function GET(request, { params }) {
  const locale = localeFromRequest(request)
  const auth = await requireDocumentUser()
  if (!auth?.ok) {
    return errorJson(auth?.message || "api.common.unauthorized", auth?.status || 401, locale, {
      redirect: auth?.redirect,
      requireSubscription: auth?.requireSubscription
    })
  }

  const id = await resolveRouteId(params)
  if (!id) {
    return errorJson("documents.errors.missing_id", 400, locale)
  }

  try {
    const artifact = await findOwnedArtifact(id, auth.userId)
    if (!artifact) {
      return errorJson("documents.artifacts.errors.not_found", 404, locale)
    }

    return json({
      ok: true,
      artifact: serializeArtifact(artifact, { includeContent: true })
    })
  } catch (error) {
    if (error?.status === 403) {
      return errorJson("api.common.forbidden", 403, locale)
    }
    console.error("[documents artifacts] read failed", safeError(error))
    return errorJson("documents.artifacts.errors.read_failed", 500, locale)
  }
}

export async function PATCH(request, { params }) {
  const locale = localeFromRequest(request)
  const auth = await requireDocumentUser()
  if (!auth?.ok) {
    return errorJson(auth?.message || "api.common.unauthorized", auth?.status || 401, locale, {
      redirect: auth?.redirect,
      requireSubscription: auth?.requireSubscription
    })
  }

  const rateLimitResponse = enforceDocumentsRateLimit(request, {
    scope: "artifacts_update",
    userId: auth.userId,
    limit: ARTIFACTS_MUTATION_RATE_LIMIT_MAX,
    windowMs: DOCUMENTS_RATE_LIMIT_WINDOW_MS
  })
  if (rateLimitResponse) return rateLimitResponse

  const id = await resolveRouteId(params)
  if (!id) {
    return errorJson("documents.errors.missing_id", 400, locale)
  }

  let body = {}
  try {
    body = await request.json()
  } catch {
    return errorJson("documents.errors.invalid_payload", 400, locale)
  }

  try {
    const artifact = await findOwnedArtifact(id, auth.userId)
    if (!artifact) {
      return errorJson("documents.artifacts.errors.not_found", 404, locale)
    }

    assertDraftArtifactEditable(artifact)

    const nextTitle = body?.title === undefined ? artifact.title : normalizeArtifactTitle(body.title)
    const nextContent =
      body?.content === undefined ? artifact.content : normalizeArtifactContent(body.content)
    const cachedDebugMeta =
      body?.content === undefined ? null : getCachedRetrievalDebugMeta(auth.userId, nextContent)
    let nextTemplateId = artifact.templateId || null

    if (body?.templateId !== undefined) {
      const candidateTemplateId = String(body.templateId || "").trim()
      if (!candidateTemplateId) {
        nextTemplateId = null
      } else {
        const template = await prisma.userDocument.findFirst({
          where: {
            id: candidateTemplateId,
            ownerId: auth.userId,
            kind: "TEMPLATE"
          },
          select: {
            id: true,
            agentAllowed: true
          }
        })

        if (!template) {
          return errorJson("documents.artifacts.errors.template_not_found", 404, locale)
        }

        if (!template.agentAllowed) {
          return errorJson("documents.artifacts.errors.template_not_allowed", 400, locale)
        }

        nextTemplateId = template.id
      }
    }

    const role = effectiveRoleFromSession(auth.session)
    const storageQuotaBytes = getStorageQuotaBytes(role)
    const storageUsageBytes = await getUserStorageUsageBytes(auth.userId)
    const currentArtifactBytes = getUtf8ByteLength(artifact.content)
    const nextArtifactBytes = getUtf8ByteLength(nextContent)
    const projectedBytes = storageUsageBytes.totalBytes - currentArtifactBytes + nextArtifactBytes

    if (projectedBytes > storageQuotaBytes) {
      return errorJson("documents.errors.storage_quota_exceeded", 413, locale, {
        scope: "storage_quota",
        limit: storageQuotaBytes,
        used: storageUsageBytes.totalBytes
      })
    }

    const updated = await prisma.agentArtifact.update({
      where: { id },
      data: {
        title: nextTitle,
        content: nextContent,
        templateId: nextTemplateId
      },
      include: artifactInclude
    })

    await logDocumentsAudit("artifact.updated", {
      userId: auth.userId,
      artifactId: updated.id,
      title: updated.title,
      status: updated.status,
      templateId: updated.templateId,
      ...buildRetrievalAuditFields(cachedDebugMeta)
    })

    return json({
      ok: true,
      artifact: serializeArtifact(updated, { includeContent: true })
    })
  } catch (error) {
    if (error?.status === 403) {
      return errorJson("api.common.forbidden", 403, locale)
    }
    if (error?.status === 409) {
      return errorJson(error.message, 409, locale)
    }
    if (error?.status === 400 || error?.status === 413) {
      return errorJson(error.message, error.status, locale)
    }
    console.error("[documents artifacts] update failed", safeError(error))
    return errorJson("documents.artifacts.errors.update_failed", 500, locale)
  }
}

export async function DELETE(request, { params }) {
  const locale = localeFromRequest(request)
  const auth = await requireDocumentUser()
  if (!auth?.ok) {
    return errorJson(auth?.message || "api.common.unauthorized", auth?.status || 401, locale, {
      redirect: auth?.redirect,
      requireSubscription: auth?.requireSubscription
    })
  }

  const rateLimitResponse = enforceDocumentsRateLimit(request, {
    scope: "artifacts_delete",
    userId: auth.userId,
    limit: ARTIFACTS_MUTATION_RATE_LIMIT_MAX,
    windowMs: DOCUMENTS_RATE_LIMIT_WINDOW_MS
  })
  if (rateLimitResponse) return rateLimitResponse

  const id = await resolveRouteId(params)
  if (!id) {
    return errorJson("documents.errors.missing_id", 400, locale)
  }

  try {
    const artifact = await findOwnedArtifact(id, auth.userId)
    if (!artifact) {
      return errorJson("documents.artifacts.errors.not_found", 404, locale)
    }

    await prisma.agentArtifact.delete({
      where: { id }
    })

    await logDocumentsAudit("artifact.deleted", {
      userId: auth.userId,
      artifactId: artifact.id,
      title: artifact.title,
      status: artifact.status
    })

    return json({
      ok: true,
      id
    })
  } catch (error) {
    if (error?.status === 403) {
      return errorJson("api.common.forbidden", 403, locale)
    }
    console.error("[documents artifacts] delete failed", safeError(error))
    return errorJson("documents.artifacts.errors.delete_failed", 500, locale)
  }
}
