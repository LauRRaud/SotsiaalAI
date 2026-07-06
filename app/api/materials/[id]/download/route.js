import { getServerSession } from "next-auth"

import { authConfig } from "@/auth"
import { assertAdmin } from "@/lib/authz"
import { prisma } from "@/lib/prisma"
import { errorJson, localeFromRequest } from "@/lib/documents/server"
import { getMaterialSubmissionSchemaMessage, isMaterialSubmissionSchemaError } from "@/lib/materials/compat"
import { buildDownloadHeaders, readStoredMaterial } from "@/lib/materials/server"
import { logDataAudit } from "@/lib/privacy/audit"
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
  const authz = assertAdmin(session)

  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403, locale)
  }

  const id = await resolveRouteId(params)
  if (!id) {
    return errorJson("Materjali ID puudub.", 400, locale)
  }

  try {
    const submission = await prisma.materialSubmission.findUnique({
      where: { id }
    })
    if (!submission) {
      return errorJson("Materjali ei leitud.", 404, locale)
    }

    const fileBuffer = await readStoredMaterial(submission.storagePath)
    await logDataAudit({
      actorUserId: session?.user?.id || null,
      targetUserId: submission.submittedByUserId || null,
      action: "FILE_DOWNLOAD_ADMIN",
      resourceType: "MaterialSubmission",
      resourceId: submission.id,
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null,
      userAgent: request.headers.get("user-agent") || null,
      meta: {
        mime: submission.mime,
        size: submission.size
      }
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
