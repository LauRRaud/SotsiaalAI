import { assertOwnedByUser } from "@/lib/documents/access"
import { logDocumentsAudit } from "@/lib/documents/audit"
import { buildArtifactDownloadUrl, serializeArtifact } from "@/lib/documents/artifacts"
import { prisma } from "@/lib/prisma"
import { enforceDocumentsRateLimit, readDocumentsRateLimit } from "@/lib/documents/rateLimit"
import { errorJson, json, localeFromRequest, requireDocumentUser } from "@/lib/documents/server"
import { safeError } from "@/lib/privacy/safeError"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const DOCUMENTS_RATE_LIMIT_WINDOW_MS = readDocumentsRateLimit(process.env.DOCUMENTS_RATE_LIMIT_WINDOW_MS, 60_000, 1000)
const ARTIFACTS_APPROVE_RATE_LIMIT_MAX = readDocumentsRateLimit(process.env.ARTIFACTS_APPROVE_RATE_LIMIT_MAX, 20)

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

  try {
    const existing = await prisma.agentArtifact.findUnique({
      where: { id }
    })

    if (!existing) {
      return errorJson("documents.artifacts.errors.not_found", 404, locale)
    }

    assertOwnedByUser(existing, auth.userId)

    if (existing.status === "FINAL") {
      const artifact = await prisma.agentArtifact.findUnique({
        where: { id },
        include: artifactInclude
      })
      await logDocumentsAudit("artifact.approve_redundant", {
        userId: auth.userId,
        artifactId: id,
        status: "FINAL"
      })
      return json({
        ok: true,
        artifactId: id,
        status: "FINAL",
        approvedAt: artifact?.approvedAt || existing.approvedAt,
        downloadUrl: buildArtifactDownloadUrl(id, "docx"),
        downloadUrls: {
          docx: buildArtifactDownloadUrl(id, "docx"),
          pdf: buildArtifactDownloadUrl(id, "pdf")
        },
        artifact: artifact ? serializeArtifact(artifact, { includeContent: true }) : null
      })
    }

    const approvedAt = new Date()
    const artifact = await prisma.agentArtifact.update({
      where: { id },
      data: {
        status: "FINAL",
        approvedAt
      },
      include: artifactInclude
    })

    await logDocumentsAudit("artifact.approved", {
      userId: auth.userId,
      artifactId: artifact.id,
      title: artifact.title,
      type: artifact.type,
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
    console.error("[documents artifacts] approve failed", safeError(error))
    return errorJson("documents.artifacts.errors.approve_failed", 500, locale)
  }
}
