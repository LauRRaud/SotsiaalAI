import { assertOwnedByUser } from "@/lib/documents/access"
import { logDocumentsAudit } from "@/lib/documents/audit"
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
const DOCUMENTS_DOWNLOAD_RATE_LIMIT_MAX = readDocumentsRateLimit(process.env.DOCUMENTS_DOWNLOAD_RATE_LIMIT_MAX, 60)

async function resolveRouteId(paramsLike) {
  const params = await paramsLike
  return String(params?.id || "").trim()
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
    scope: "documents_download",
    userId: auth.userId,
    limit: DOCUMENTS_DOWNLOAD_RATE_LIMIT_MAX,
    windowMs: DOCUMENTS_RATE_LIMIT_WINDOW_MS
  })
  if (rateLimitResponse) return rateLimitResponse

  const id = await resolveRouteId(params)
  if (!id) {
    return errorJson("documents.errors.missing_id", 400, locale)
  }

  try {
    const document = await prisma.userDocument.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        title: true,
        originalName: true,
        mime: true,
        size: true,
        storagePath: true
      }
    })
    if (!document) {
      return errorJson("documents.errors.not_found", 404, locale)
    }
    assertOwnedByUser(document, auth.userId)

    const fileBuffer = await readStoredDocument(document.storagePath)
    await logDocumentsAudit("document.downloaded", {
      userId: auth.userId,
      documentId: document.id,
      title: document.title,
      originalName: document.originalName,
      mime: document.mime,
      size: document.size
    })
    return new Response(fileBuffer, {
      status: 200,
      headers: buildDownloadHeaders(document.title || document.originalName, document.mime)
    })
  } catch (error) {
    if (error?.status === 403) {
      return errorJson("api.common.forbidden", 403, locale)
    }
    console.error("[documents] download failed", safeError(error))
    return errorJson("documents.errors.download_failed", 500, locale)
  }
}
