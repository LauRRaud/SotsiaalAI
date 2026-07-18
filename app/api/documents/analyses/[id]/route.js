import { enforceDocumentsRateLimit, readDocumentsRateLimit } from "@/lib/documents/rateLimit"
import { errorJson, json, localeFromRequest, requireDocumentUser } from "@/lib/documents/server"
import { deleteSavedAnalysisForOwner, getSavedAnalysisForOwner } from "@/lib/documents/savedAnalysis"
import { safeError } from "@/lib/privacy/safeError"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const DOCUMENTS_RATE_LIMIT_WINDOW_MS = readDocumentsRateLimit(process.env.DOCUMENTS_RATE_LIMIT_WINDOW_MS, 60_000, 1000)
const ANALYSES_MUTATION_RATE_LIMIT_MAX = readDocumentsRateLimit(process.env.ANALYSES_MUTATION_RATE_LIMIT_MAX, 30)

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

  const id = await resolveRouteId(params)
  if (!id) {
    return errorJson("documents.errors.missing_id", 400, locale)
  }

  try {
    // Owner-scoped read: a foreign or missing id both resolve to null -> identical 404.
    const analysis = await getSavedAnalysisForOwner({ userId: auth.userId, id, includeContent: true })
    if (!analysis) {
      return errorJson("documents.analyses.errors.not_found", 404, locale)
    }
    return json({ ok: true, analysis })
  } catch (error) {
    console.error("[documents analyses] read failed", safeError(error))
    return errorJson("documents.analyses.errors.read_failed", 500, locale)
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
    scope: "analyses_delete",
    userId: auth.userId,
    limit: ANALYSES_MUTATION_RATE_LIMIT_MAX,
    windowMs: DOCUMENTS_RATE_LIMIT_WINDOW_MS
  })
  if (rateLimitResponse) return rateLimitResponse

  const id = await resolveRouteId(params)
  if (!id) {
    return errorJson("documents.errors.missing_id", 400, locale)
  }

  try {
    // Foreign/missing id -> deleteMany count 0 -> same 404 as a missing row (no oracle).
    const deleted = await deleteSavedAnalysisForOwner({ userId: auth.userId, id })
    if (!deleted) {
      return errorJson("documents.analyses.errors.not_found", 404, locale)
    }
    return json({ ok: true, id })
  } catch (error) {
    console.error("[documents analyses] delete failed", safeError(error))
    return errorJson("documents.analyses.errors.delete_failed", 500, locale)
  }
}
