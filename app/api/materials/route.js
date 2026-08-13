import crypto from "node:crypto"
import { getServerSession } from "next-auth"

import { authConfig } from "@/auth"
import { effectiveRoleFromSession } from "@/lib/authz"
import { errorJson, json, localeFromRequest } from "@/lib/documents/server"
import { readDocumentsRateLimit } from "@/lib/documents/rateLimit"
import { requireMaterialReadAccess, requireMaterialUploadAccess } from "@/lib/materials/access"
import { getMaterialSubmissionSchemaMessage, isMaterialSubmissionSchemaError } from "@/lib/materials/compat"
import { createMaterialSubmissions, listMaterialSubmissions } from "@/lib/materials/lifecycle"
import { ensureAllowedUpload, normalizeMaterialComment } from "@/lib/materials/server"
import { validateMaterialBuffer } from "@/lib/materials/validation"
import { getMaterialsFileCountLimit } from "@/lib/storageGuardrails"
import { safeError } from "@/lib/privacy/safeError"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const MATERIALS_RATE_LIMIT_WINDOW_MS = readDocumentsRateLimit(process.env.MATERIALS_RATE_LIMIT_WINDOW_MS, 15 * 60_000, 1000)
const MATERIALS_UPLOAD_RATE_LIMIT_MAX = readDocumentsRateLimit(process.env.MATERIALS_UPLOAD_RATE_LIMIT_MAX, 8)

async function getOptionalSession() {
  return getServerSession(authConfig).catch(() => null)
}

function routeError(error, locale, fallback) {
  if (isMaterialSubmissionSchemaError(error)) {
    return errorJson(getMaterialSubmissionSchemaMessage(locale), 503, locale)
  }
  const status = Number(error?.status) || 500
  if (status === 500) console.error("[materials] request failed", safeError(error))
  return errorJson(status === 500 ? fallback : error?.message || fallback, status, locale, error?.quota || null)
}

export async function GET(request) {
  const locale = localeFromRequest(request)
  const session = await getOptionalSession()
  const access = requireMaterialReadAccess(session)
  if (!access.ok) return errorJson(access.message, access.status, locale)

  try {
    const url = new URL(request.url)
    const page = await listMaterialSubmissions({
      userId: access.userId,
      admin: access.admin,
      cursor: url.searchParams.get("cursor"),
      limit: url.searchParams.get("limit"),
      status: url.searchParams.get("status")
    })
    return json({ ok: true, ...page })
  } catch (error) {
    return routeError(error, locale, "Materjalide nimekirja laadimine ebaõnnestus.")
  }
}

export async function handleMaterialPost(
  request,
  {
    sessionProvider = getOptionalSession,
    uploadAccess = requireMaterialUploadAccess,
    createSubmissions = createMaterialSubmissions
  } = {}
) {
  const locale = localeFromRequest(request)
  const session = await sessionProvider()
  const access = await uploadAccess(session)
  if (!access.ok) return errorJson(access.message, access.status, locale)

  let formData
  try {
    formData = await request.formData()
  } catch {
    return errorJson("Palun saada fail vormiandmetena.", 400, locale)
  }

  try {
    const uploaded = formData.getAll("file").filter((entry) => entry && typeof entry !== "string")
    if (!uploaded.length) return errorJson("documents.errors.file_required", 400, locale)
    const maxFiles = getMaterialsFileCountLimit()
    if (uploaded.length > maxFiles) {
      return errorJson("materials_page.errors.file_count_exceeded", 400, locale, {
        scope: "materials_files", limit: maxFiles, used: uploaded.length
      })
    }

    const files = []
    for (const file of uploaded) {
      const mime = ensureAllowedUpload(file)
      const buffer = Buffer.from(await file.arrayBuffer())
      await validateMaterialBuffer(buffer, mime)
      files.push({
        originalName: String(file.name || "material"),
        mime,
        size: buffer.byteLength,
        sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
        buffer
      })
    }
    const idempotencyKey = formData.get("idempotencyKey") || request.headers.get("idempotency-key")
    const result = await createSubmissions({
      userId: String(session.user.id),
      role: effectiveRoleFromSession(session),
      idempotencyKey,
      comment: normalizeMaterialComment(formData.get("comment")),
      files,
      rateLimit: MATERIALS_UPLOAD_RATE_LIMIT_MAX,
      windowMs: MATERIALS_RATE_LIMIT_WINDOW_MS
    })
    return json({
      ok: true,
      replay: result.replay,
      count: result.submissions.length,
      submission: result.submissions[0] || null,
      submissions: result.submissions
    }, result.replay ? 200 : 201)
  } catch (error) {
    return routeError(error, locale, "Materjali üleslaadimine ebaõnnestus.")
  }
}

export async function POST(request) {
  return handleMaterialPost(request)
}
