import { getServerSession } from "next-auth"

import { authConfig } from "@/auth"
import { assertAdmin } from "@/lib/authz"
import { prisma } from "@/lib/prisma"
import { errorJson, json, localeFromRequest } from "@/lib/documents/server"
import { getMaterialSubmissionSchemaMessage, isMaterialSubmissionSchemaError } from "@/lib/materials/compat"
import { buildMaterialReviewUpdate, serializeMaterialSubmission } from "@/lib/materials/submissions"
import { deleteStoredMaterial } from "@/lib/materials/server"
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
    const reviewUpdate = buildMaterialReviewUpdate({
      action: body?.action,
      status: body?.status,
      reviewedBy: resolveAdminIdentity(session),
      reviewNote: body?.reviewNote
    })
    const submission = await prisma.materialSubmission.update({
      where: { id },
      data: reviewUpdate,
      include: {
        submittedByUser: {
          select: {
            id: true,
            email: true
          }
        }
      }
    })

    return json({
      ok: true,
      submission: serializeMaterialSubmission(submission)
    })
  } catch (error) {
    console.error("[materials] review update failed", safeError(error))
    if (isMaterialSubmissionSchemaError(error)) {
      return errorJson(getMaterialSubmissionSchemaMessage(locale), 503, locale)
    }
    if (error?.code === "P2025") {
      return errorJson("Materjali ei leitud.", 404, locale)
    }
    return errorJson(error?.message || "Materjali ülevaatuse salvestamine ebaõnnestus.", Number(error?.status) || 500, locale)
  }
}

export async function DELETE(request, { params }) {
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

    await deleteStoredMaterial(submission.storagePath)
    await prisma.materialSubmission.delete({
      where: { id: submission.id }
    })

    return json({ ok: true })
  } catch (error) {
    console.error("[materials] delete failed", safeError(error))
    if (isMaterialSubmissionSchemaError(error)) {
      return errorJson(getMaterialSubmissionSchemaMessage(locale), 503, locale)
    }
    const status = Number(error?.status) || 500
    return errorJson(status === 500 ? "Materjali kustutamine ebaõnnestus." : error?.message || "Materjali kustutamine ebaõnnestus.", status, locale)
  }
}
