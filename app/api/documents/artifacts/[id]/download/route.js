import { writeDocumentAudit } from "@/lib/documents/audit"
import { buildArtifactFileName } from "@/lib/documents/artifacts"
import { DOCX_MIME_TYPE, PDF_MIME_TYPE } from "@/lib/documents/constants"
import { readFinalArtifactDownload } from "@/lib/documents/artifactFinalization"
import { prisma } from "@/lib/prisma"
import { enforceDocumentsRateLimit, readDocumentsRateLimit } from "@/lib/documents/rateLimit"
import {
  buildDownloadHeaders,
  errorJson,
  localeFromRequest,
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

export async function GET(request, { params }) {
  const locale = localeFromRequest(request)
  const auth = await requireDocumentUser({ allowWithoutSubscription: true })
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
    const { artifact, bytes: fileBuffer, manifest } = await readFinalArtifactDownload(
      { artifactId: id, ownerId: auth.userId, format },
      { db: prisma }
    )

    await writeDocumentAudit("artifact.downloaded", {
      userId: auth.userId,
      artifactId: artifact.id,
      title: artifact.title,
      type: artifact.type,
      templateId: manifest?.template?.id || null,
      sourceCount: Array.isArray(manifest?.sources) ? manifest.sources.length : 0,
      format
    })

    const mime = format === "pdf" ? PDF_MIME_TYPE : DOCX_MIME_TYPE

    return new Response(fileBuffer, {
      status: 200,
      headers: buildDownloadHeaders(buildArtifactFileName(artifact, format), mime)
    })
  } catch (error) {
    if ([400, 403, 404, 409].includes(Number(error?.status))) {
      return errorJson(error.message, error.status, locale)
    }
    console.error("[documents artifacts] download failed", safeError(error))
    return errorJson("documents.artifacts.errors.download_failed", 500, locale)
  }
}
