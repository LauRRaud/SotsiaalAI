import { effectiveRoleFromSession } from "@/lib/authz"
import { ARTIFACT_LIST_LIMIT, ARTIFACT_LIST_LIMIT_ALL } from "@/lib/documents/constants"
import { buildPaginationMeta, parseListLimit, parseListOffset } from "@/lib/documents/listing"
import { enforceDocumentsRateLimit, readDocumentsRateLimit } from "@/lib/documents/rateLimit"
import { errorJson, json, localeFromRequest, requireDocumentUser } from "@/lib/documents/server"
import { createSavedAnalysis, listSavedAnalysesForOwner } from "@/lib/documents/savedAnalysis"
import { safeError } from "@/lib/privacy/safeError"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const DOCUMENTS_RATE_LIMIT_WINDOW_MS = readDocumentsRateLimit(process.env.DOCUMENTS_RATE_LIMIT_WINDOW_MS, 60_000, 1000)
const ANALYSES_CREATE_RATE_LIMIT_MAX = readDocumentsRateLimit(process.env.ANALYSES_CREATE_RATE_LIMIT_MAX, 20)

export async function GET(request) {
  const locale = localeFromRequest(request)
  const auth = await requireDocumentUser({ allowWithoutSubscription: true })
  if (!auth?.ok) {
    return errorJson(auth?.message || "api.common.unauthorized", auth?.status || 401, locale, {
      redirect: auth?.redirect,
      requireSubscription: auth?.requireSubscription
    })
  }

  const requestUrl = new URL(request.url)
  const limit = parseListLimit(requestUrl.searchParams.get("limit"), {
    fallback: ARTIFACT_LIST_LIMIT,
    maxLimit: ARTIFACT_LIST_LIMIT_ALL
  })
  const offset = parseListOffset(requestUrl.searchParams.get("offset"))
  const search = String(requestUrl.searchParams.get("search") || "").trim().slice(0, 200)

  try {
    const { total, analyses } = await listSavedAnalysesForOwner({
      userId: auth.userId,
      limit,
      offset,
      search
    })
    return json({
      ok: true,
      analyses,
      pagination: buildPaginationMeta({ total, limit, offset })
    })
  } catch (error) {
    console.error("[documents analyses] list failed", safeError(error))
    return errorJson("documents.analyses.errors.list_failed", 500, locale)
  }
}

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
    scope: "analyses_create",
    userId: auth.userId,
    limit: ANALYSES_CREATE_RATE_LIMIT_MAX,
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

  try {
    const analysis = await createSavedAnalysis({
      userId: auth.userId,
      role,
      title: body?.title,
      content: body?.content,
      sourceDocumentIds: body?.documentIds
    })
    return json({ ok: true, analysis }, 201)
  } catch (error) {
    const status = Number(error?.status) || 500
    if (status === 413) {
      return errorJson(error.message || "documents.analyses.errors.content_too_large", 413, locale, {
        scope: "storage_quota",
        ...(error.quota || {})
      })
    }
    if (status !== 500) {
      return errorJson(error?.message || "documents.analyses.errors.save_failed", status, locale)
    }
    console.error("[documents analyses] save failed", safeError(error))
    return errorJson("documents.analyses.errors.save_failed", 500, locale)
  }
}
