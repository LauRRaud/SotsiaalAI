import { assertOwnedByUser } from "@/lib/documents/access"
import { logDocumentsAudit } from "@/lib/documents/audit"
import { buildArtifactFileName } from "@/lib/documents/artifacts"
import { DOCX_MIME_TYPE, PDF_MIME_TYPE } from "@/lib/documents/constants"
import { createArtifactDocxBuffer } from "@/lib/documents/docxExport"
import { createArtifactPdfBuffer } from "@/lib/documents/pdfExport"
import { prisma } from "@/lib/prisma"
import { enforceDocumentsRateLimit, readDocumentsRateLimit } from "@/lib/documents/rateLimit"
import {
  buildDownloadHeaders,
  errorJson,
  localeFromRequest,
  readStoredDocument,
  requireDocumentUser
} from "@/lib/documents/server"
import { safeError } from "@/lib/privacy/safeError"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const DOCUMENTS_RATE_LIMIT_WINDOW_MS = readDocumentsRateLimit(process.env.DOCUMENTS_RATE_LIMIT_WINDOW_MS, 60_000, 1000)
const ARTIFACTS_DOWNLOAD_RATE_LIMIT_MAX = readDocumentsRateLimit(process.env.ARTIFACTS_DOWNLOAD_RATE_LIMIT_MAX, 60)

async function resolveRouteId(paramsLike) {
  const params = await paramsLike
  return String(params?.id || "").trim()
}

const artifactInclude = {
  template: {
    select: {
      id: true,
      title: true,
      originalName: true,
      mime: true,
      storagePath: true
    }
  },
  sourceDocuments: {
    include: {
      document: {
        select: {
          id: true,
          title: true,
          originalName: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
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

  const rateLimitResponse = enforceDocumentsRateLimit(request, {
    scope: "artifacts_download",
    userId: auth.userId,
    limit: ARTIFACTS_DOWNLOAD_RATE_LIMIT_MAX,
    windowMs: DOCUMENTS_RATE_LIMIT_WINDOW_MS
  })
  if (rateLimitResponse) return rateLimitResponse

  const id = await resolveRouteId(params)
  if (!id) {
    return errorJson("documents.errors.missing_id", 400, locale)
  }

  const requestUrl = new URL(request.url)
  const format = String(requestUrl.searchParams.get("format") || "docx").trim().toLowerCase()
  if (format !== "docx" && format !== "pdf") {
    return errorJson("documents.artifacts.errors.format_not_supported", 400, locale)
  }

  try {
    const artifact = await prisma.agentArtifact.findUnique({
      where: { id },
      include: artifactInclude
    })

    if (!artifact) {
      return errorJson("documents.artifacts.errors.not_found", 404, locale)
    }

    assertOwnedByUser(artifact, auth.userId)

    if (artifact.status !== "FINAL" || !artifact.approvedAt) {
      return errorJson("documents.artifacts.errors.download_requires_approval", 409, locale)
    }

    let templateBuffer = null
    if (artifact.template?.storagePath && artifact.template?.mime === DOCX_MIME_TYPE) {
      templateBuffer = await readStoredDocument(artifact.template.storagePath)
    }

    const sources = artifact.sourceDocuments
      .map((link) => link.document)
      .filter(Boolean)

    const fileBuffer = format === "pdf"
      ? createArtifactPdfBuffer({
          artifact,
          sources
        })
      : createArtifactDocxBuffer({
          artifact,
          sources,
          templateBuffer
        })

    await logDocumentsAudit("artifact.downloaded", {
      userId: auth.userId,
      artifactId: artifact.id,
      title: artifact.title,
      type: artifact.type,
      templateId: artifact.templateId || null,
      sourceCount: sources.length,
      format
    })

    const mime = format === "pdf" ? PDF_MIME_TYPE : DOCX_MIME_TYPE

    return new Response(fileBuffer, {
      status: 200,
      headers: buildDownloadHeaders(buildArtifactFileName(artifact, format), mime)
    })
  } catch (error) {
    if (error?.status === 403) {
      return errorJson("api.common.forbidden", 403, locale)
    }
    console.error("[documents artifacts] download failed", safeError(error))
    return errorJson("documents.artifacts.errors.download_failed", 500, locale)
  }
}
