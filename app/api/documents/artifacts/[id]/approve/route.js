import { logDocumentsAudit } from "@/lib/documents/audit"
import { effectiveRoleFromSession } from "@/lib/authz"
import {
  buildArtifactDownloadUrl,
  normalizeArtifactContent,
  normalizeArtifactTitle,
  serializeArtifact
} from "@/lib/documents/artifacts"
import { approveArtifact, parseExpectedVersion } from "@/lib/documents/artifactMutation"
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
const ARTIFACTS_APPROVE_RATE_LIMIT_MAX = readDocumentsRateLimit(process.env.ARTIFACTS_APPROVE_RATE_LIMIT_MAX, 20)

async function resolveRouteId(paramsLike) {
  const params = await paramsLike
  return String(params?.id || "").trim()
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
    scope: "artifacts_approve",
    userId: auth.userId,
    limit: ARTIFACTS_APPROVE_RATE_LIMIT_MAX,
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
  } catch {}

  try {
    // Kinnitamine võib kliendi viimase sisu KAASA võtta. Varem tegi klient kaks päringut —
    // salvesta, siis kinnita — ja nende vahele mahtus terve võistlus: teine vahekaart võis
    // vahepeal muuta sisu, mille see kinnitus siis lõplikuks tegi.
    const expectedUpdatedAt = parseExpectedVersion(body?.expectedUpdatedAt)
    const nextTitle = body?.title === undefined ? undefined : normalizeArtifactTitle(body.title)
    const nextContent = body?.content === undefined ? undefined : normalizeArtifactContent(body.content)

    if (nextContent !== undefined) {
      const current = await prisma.agentArtifact.findFirst({
        where: { id, ownerId: auth.userId },
        select: { content: true }
      })
      if (!current) {
        return errorJson("documents.artifacts.errors.not_found", 404, locale)
      }
      const role = effectiveRoleFromSession(auth.session)
      const storageQuotaBytes = getStorageQuotaBytes(role)
      const storageUsageBytes = await getUserStorageUsageBytes(auth.userId)
      const projectedBytes =
        storageUsageBytes.totalBytes - getUtf8ByteLength(current.content) + getUtf8ByteLength(nextContent)

      if (projectedBytes > storageQuotaBytes) {
        return errorJson("documents.errors.storage_quota_exceeded", 413, locale, {
          scope: "storage_quota",
          limit: storageQuotaBytes,
          used: storageUsageBytes.totalBytes
        })
      }
    }

    const { artifact, alreadyFinal } = await approveArtifact({
      artifactId: id,
      ownerId: auth.userId,
      expectedUpdatedAt,
      title: nextTitle,
      content: nextContent
    })

    await logDocumentsAudit(alreadyFinal ? "artifact.approve_redundant" : "artifact.approved", {
      userId: auth.userId,
      artifactId: artifact.id,
      title: artifact.title,
      type: artifact.type,
      status: artifact.status,
      approvedAt: artifact.approvedAt
    })

    return json({
      ok: true,
      artifactId: artifact.id,
      status: artifact.status,
      approvedAt: artifact.approvedAt,
      downloadUrl: buildArtifactDownloadUrl(artifact.id, "docx"),
      downloadUrls: {
        docx: buildArtifactDownloadUrl(artifact.id, "docx"),
        pdf: buildArtifactDownloadUrl(artifact.id, "pdf")
      },
      artifact: serializeArtifact(artifact, { includeContent: true })
    })
  } catch (error) {
    if (error?.status === 403) {
      return errorJson("api.common.forbidden", 403, locale)
    }
    if (error?.status === 404) {
      return errorJson("documents.artifacts.errors.not_found", 404, locale)
    }
    if (error?.status === 409 || error?.status === 400 || error?.status === 413) {
      return errorJson(error.message, error.status, locale)
    }
    console.error("[documents artifacts] approve failed", safeError(error))
    return errorJson("documents.artifacts.errors.approve_failed", 500, locale)
  }
}
