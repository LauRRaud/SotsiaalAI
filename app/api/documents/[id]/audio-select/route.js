import { prisma } from "@/lib/prisma"
import { AUDIO_SOURCE_KINDS } from "@/lib/documents/audioWorkflow"
import { logDocumentsAudit } from "@/lib/documents/audit"
import { errorJson, json, localeFromRequest, requireDocumentUser } from "@/lib/documents/server"
import { safeError } from "@/lib/privacy/safeError"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

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

  const id = await resolveRouteId(params)
  if (!id) return errorJson("documents.errors.missing_id", 400, locale)

  try {
    const document = await prisma.userDocument.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        title: true,
        kind: true,
        mime: true,
        size: true
      }
    })
    if (!document) return errorJson("documents.errors.not_found", 404, locale)
    if (document.ownerId !== auth.userId) return errorJson("api.common.forbidden", 403, locale)
    if (!AUDIO_SOURCE_KINDS.includes(document.kind)) return errorJson("documents.errors.audio_source_required", 400, locale)

    await logDocumentsAudit("document.audio_selected", {
      userId: auth.userId,
      documentId: document.id,
      title: document.title,
      kind: document.kind,
      mime: document.mime,
      size: document.size
    })

    return json({ ok: true })
  } catch (error) {
    console.error("[documents audio] select failed", safeError(error))
    return errorJson("documents.errors.read_failed", 500, locale)
  }
}
