import { getServerSession } from "next-auth"

import { authConfig } from "@/auth"
import { requireMaterialReadAccess } from "@/lib/materials/access"
import { errorJson, localeFromRequest } from "@/lib/documents/server"
import { getMaterialSubmissionSchemaMessage, isMaterialSubmissionSchemaError } from "@/lib/materials/compat"
import { getMaterialSubmissionDownload } from "@/lib/materials/lifecycle"
import { auditMaterialDownload } from "@/lib/materials/review"
import { buildDownloadHeaders, readStoredMaterial } from "@/lib/materials/server"
import { safeError } from "@/lib/privacy/safeError"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

async function resolveRouteId(paramsLike) {
  const params = await paramsLike
  return String(params?.id || "").trim()
}

export async function GET(request, { params }) {
  const locale = localeFromRequest(request)
  const session = await getServerSession(authConfig).catch(() => null)
  const authz = requireMaterialReadAccess(session)

  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403, locale)
  }

  const id = await resolveRouteId(params)
  if (!id) {
    return errorJson("Materjali ID puudub.", 400, locale)
  }

  try {
    const submission = await getMaterialSubmissionDownload({
      id,
      userId: authz.userId,
      admin: authz.admin
    })

    const fileBuffer = await readStoredMaterial(submission.storagePath)
    await auditMaterialDownload(submission, {
      actorUserId: session?.user?.id || null,
      admin: authz.admin,
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null,
      userAgent: request.headers.get("user-agent") || null
    })
    return new Response(fileBuffer, {
      status: 200,
      headers: buildDownloadHeaders(submission.originalName, submission.mime)
    })
  } catch (error) {
    console.error("[materials] download failed", safeError(error))
    if (isMaterialSubmissionSchemaError(error)) {
      return errorJson(getMaterialSubmissionSchemaMessage(locale), 503, locale)
    }
    const status = Number(error?.status) || 500
    return errorJson(status === 500 ? "Materjali allalaadimine ebaõnnestus." : error?.message || "Materjali allalaadimine ebaõnnestus.", status, locale)
  }
}
