import { getServerSession } from "next-auth"

import { authConfig } from "@/auth"
import { assertAdmin } from "@/lib/authz"
import { errorJson, json, localeFromRequest } from "@/lib/documents/server"
import { requireMaterialReadAccess } from "@/lib/materials/access"
import { getMaterialSubmissionSchemaMessage, isMaterialSubmissionSchemaError } from "@/lib/materials/compat"
import { requestMaterialSubmissionDeletion } from "@/lib/materials/lifecycle"
import { reviewMaterialSubmission } from "@/lib/materials/review"
import { safeError } from "@/lib/privacy/safeError"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

async function resolveRouteId(paramsLike) {
  const params = await paramsLike
  return String(params?.id || "").trim()
}

function resolveAdminIdentity(session) {
  return String(session?.user?.email || session?.user?.id || "admin").trim() || "admin"
}

export async function PATCH(request, { params }) {
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

  let body
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  try {
    const submission = await reviewMaterialSubmission({
      id,
      action: body?.action,
      status: body?.status,
      expectedRevision: body?.expectedRevision,
      reviewedBy: resolveAdminIdentity(session),
      reviewNote: body?.reviewNote,
      actorUserId: session?.user?.id || null
    })

    return json({
      ok: true,
      submission
    })
  } catch (error) {
    console.error("[materials] review update failed", safeError(error))
    if (isMaterialSubmissionSchemaError(error)) {
      return errorJson(getMaterialSubmissionSchemaMessage(locale), 503, locale)
    }
    return errorJson(
      error?.message || "Materjali ülevaatuse salvestamine ebaõnnestus.",
      Number(error?.status) || 500,
      locale,
      error?.current ? { current: error.current } : {}
    )
  }
}

export async function DELETE(request, { params }) {
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
    const result = await requestMaterialSubmissionDeletion({
      id,
      userId: authz.userId,
      admin: authz.admin
    })
    return json({ ok: true, ...result })
  } catch (error) {
    console.error("[materials] delete failed", safeError(error))
    if (isMaterialSubmissionSchemaError(error)) {
      return errorJson(getMaterialSubmissionSchemaMessage(locale), 503, locale)
    }
    const status = Number(error?.status) || 500
    return errorJson(status === 500 ? "Materjali kustutamine ebaõnnestus." : error?.message || "Materjali kustutamine ebaõnnestus.", status, locale)
  }
}
