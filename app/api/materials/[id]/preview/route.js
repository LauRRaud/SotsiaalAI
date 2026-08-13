import { getServerSession } from "next-auth"

import { authConfig } from "@/auth"
import { assertAdmin } from "@/lib/authz"
import { errorJson, localeFromRequest } from "@/lib/documents/server"
import { getMaterialSubmissionDownload } from "@/lib/materials/lifecycle"
import { auditMaterialDownload } from "@/lib/materials/review"
import { readSanitizedMaterial } from "@/lib/materials/server"
import { safeError } from "@/lib/privacy/safeError"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request, { params }) {
  const locale = localeFromRequest(request)
  const session = await getServerSession(authConfig).catch(() => null)
  const authz = assertAdmin(session)
  if (!authz.ok) return errorJson(authz.message || "api.common.forbidden", authz.status || 403, locale)

  const routeParams = await params
  const id = String(routeParams?.id || "").trim()
  if (!id) return errorJson("Materjali ID puudub.", 400, locale)

  try {
    const submission = await getMaterialSubmissionDownload({ id, userId: authz.userId, admin: true })
    const derivative = await readSanitizedMaterial(submission.storagePath)
    await auditMaterialDownload(submission, {
      actorUserId: session?.user?.id || null,
      admin: true,
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null,
      userAgent: request.headers.get("user-agent") || null
    })
    return new Response(derivative, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": "inline",
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox"
      }
    })
  } catch (error) {
    console.error("[materials] sanitized preview failed", safeError(error))
    return errorJson(error?.message || "Materjali eelvaade ei ole saadaval.", Number(error?.status) || 503, locale)
  }
}
