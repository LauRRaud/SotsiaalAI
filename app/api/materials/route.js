import { getServerSession } from "next-auth"

import { authConfig } from "@/auth"
import { assertAdmin, effectiveRoleFromSession } from "@/lib/authz"
import { prisma } from "@/lib/prisma"
import { enforceDocumentsRateLimit, readDocumentsRateLimit } from "@/lib/documents/rateLimit"
import { errorJson, json, localeFromRequest } from "@/lib/documents/server"
import { getMaterialSubmissionSchemaMessage, isMaterialSubmissionSchemaError } from "@/lib/materials/compat"
import { serializeMaterialSubmission } from "@/lib/materials/submissions"
import { getDailyUploadQuotaBytes, getMaterialsFileCountLimit, getStorageQuotaBytes, getUtcDayStart, sumFileBytes } from "@/lib/storageGuardrails"
import { getUserDailyUploadBytes, getUserStorageUsageBytes } from "@/lib/storageUsage"
import {
  deleteStoredMaterial,
  ensureAllowedUpload,
  ensureMaterialsStorage,
  getStoredMaterialPath,
  normalizeMaterialComment,
  writeUploadedMaterial
} from "@/lib/materials/server"
import { getMailer, resolveBaseUrl } from "@/lib/mailer"
import { safeError } from "@/lib/privacy/safeError"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const MATERIALS_RATE_LIMIT_WINDOW_MS = readDocumentsRateLimit(process.env.MATERIALS_RATE_LIMIT_WINDOW_MS, 15 * 60_000, 1000)
const MATERIALS_UPLOAD_RATE_LIMIT_MAX = readDocumentsRateLimit(process.env.MATERIALS_UPLOAD_RATE_LIMIT_MAX, 8)
const MATERIALS_LIST_LIMIT = 100

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function splitRecipients(value) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
}

function resolveMaterialsAdminRecipients() {
  return splitRecipients(
    process.env.MATERIALS_ADMIN_EMAIL ||
      process.env.MATERIALS_NOTIFICATION_EMAIL ||
      process.env.ADMIN_NOTIFICATION_EMAIL ||
      process.env.PAYMENT_OWNER_EMAIL ||
      ""
  )
}

async function sendMaterialUploadNotification({ submissions, session, comment }) {
  const recipients = resolveMaterialsAdminRecipients()
  const from = String(process.env.EMAIL_FROM || process.env.SMTP_FROM || "").trim()
  if (!recipients.length || !from || !submissions?.length) {
    console.warn("[materials] admin notification skipped", {
      reason: !recipients.length ? "recipient_missing" : !from ? "from_missing" : "submissions_missing"
    })
    return
  }

  const submittedBy = String(session?.user?.email || session?.user?.id || "unknown")
  const baseUrl = String(resolveBaseUrl() || "").replace(/\/+$/, "")
  const adminUrl = baseUrl ? `${baseUrl}/materjalid` : "/materjalid"
  const totalBytes = submissions.reduce((sum, item) => sum + Number(item.size || 0), 0)
  const safeComment = String(comment || "").slice(0, 1000)
  const files = submissions.map((item) => `- ${item.originalName} (${item.mime}, ${item.size} B)`).join("\n")
  const text = [
    "SotsiaalAI materjalide lehele saadeti uus failipakk.",
    "",
    `Saatja: ${submittedBy}`,
    `Faile: ${submissions.length}`,
    `Maht kokku: ${totalBytes} B`,
    "",
    "Failid:",
    files,
    "",
    safeComment ? `Kommentaar:\n${safeComment}` : "Kommentaar: puudub",
    "",
    `Admini vaade: ${adminUrl}`
  ].join("\n")
  const htmlFileRows = submissions
    .map((item) => `<li><strong>${escapeHtml(item.originalName)}</strong> (${escapeHtml(item.mime)}, ${Number(item.size || 0)} B)</li>`)
    .join("")
  const html = `
    <p>SotsiaalAI materjalide lehele saadeti uus failipakk.</p>
    <p><strong>Saatja:</strong> ${escapeHtml(submittedBy)}<br />
    <strong>Faile:</strong> ${submissions.length}<br />
    <strong>Maht kokku:</strong> ${totalBytes} B</p>
    <ul>${htmlFileRows}</ul>
    <p><strong>Kommentaar:</strong><br />${escapeHtml(safeComment || "puudub").replace(/\n/g, "<br />")}</p>
    <p><a href="${escapeHtml(adminUrl)}">Ava materjalide adminivaade</a></p>
  `

  await getMailer("materials").sendMail({
    to: recipients,
    from,
    replyTo: session?.user?.email || undefined,
    subject: `SotsiaalAI: uus materjal (${submissions.length})`,
    text,
    html
  })
}

function clampLimit(value, fallback = MATERIALS_LIST_LIMIT) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(Math.floor(parsed), MATERIALS_LIST_LIMIT)
}

async function getOptionalSession() {
  return getServerSession(authConfig).catch(() => null)
}

export async function GET(request) {
  const locale = localeFromRequest(request)
  const session = await getOptionalSession()
  const authz = assertAdmin(session)

  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403, locale)
  }

  try {
    const requestUrl = new URL(request.url)
    const limit = clampLimit(requestUrl.searchParams.get("limit"))
    const submissions = await prisma.materialSubmission.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
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
      submissions: submissions.map(serializeMaterialSubmission)
    })
  } catch (error) {
    console.error("[materials] list failed", safeError(error))
    if (isMaterialSubmissionSchemaError(error)) {
      return errorJson(getMaterialSubmissionSchemaMessage(locale), 503, locale)
    }
    return errorJson("Materjalide nimekirja laadimine ebaõnnestus.", 500, locale)
  }
}

export async function POST(request) {
  const locale = localeFromRequest(request)
  const session = await getOptionalSession()
  const userId = session?.user?.id ? String(session.user.id) : ""

  if (!userId) {
    return errorJson("api.common.unauthorized", 401, locale)
  }

  const rateLimitResponse = enforceDocumentsRateLimit(request, {
    scope: "materials_upload",
    userId,
    limit: MATERIALS_UPLOAD_RATE_LIMIT_MAX,
    windowMs: MATERIALS_RATE_LIMIT_WINDOW_MS
  })
  if (rateLimitResponse) return rateLimitResponse

  let formData
  try {
    formData = await request.formData()
  } catch {
    return errorJson("Palun saada fail vormiandmetena.", 400, locale)
  }

  const files = formData
    .getAll("file")
    .filter((entry) => entry && typeof entry !== "string")
  const comment = normalizeMaterialComment(formData.get("comment"))
  const storedEntries = []

  try {
    if (!files.length) {
      return errorJson("documents.errors.file_required", 400, locale)
    }

    const maxFiles = getMaterialsFileCountLimit()
    if (files.length > maxFiles) {
      return errorJson("materials_page.errors.file_count_exceeded", 400, locale, {
        scope: "materials_files",
        limit: maxFiles,
        used: files.length
      })
    }

    const validatedFiles = files.map((file) => ({
      file,
      mime: ensureAllowedUpload(file),
      size: Number(file?.size || 0)
    }))
    const totalBytes = sumFileBytes(validatedFiles)

    const role = effectiveRoleFromSession(session)
    const storageQuotaBytes = getStorageQuotaBytes(role)
    const [storageUsageBytes, dailyUploadBytes] = await Promise.all([
      getUserStorageUsageBytes(userId),
      getUserDailyUploadBytes(userId, getUtcDayStart())
    ])

    if (storageUsageBytes.totalBytes + totalBytes > storageQuotaBytes) {
      return errorJson("materials_page.errors.storage_quota_exceeded", 413, locale, {
        scope: "storage_quota",
        limit: storageQuotaBytes,
        used: storageUsageBytes.totalBytes
      })
    }

    if (dailyUploadBytes + totalBytes > getDailyUploadQuotaBytes()) {
      return errorJson("materials_page.errors.daily_upload_quota_exceeded", 429, locale, {
        scope: "daily_upload",
        limit: getDailyUploadQuotaBytes(),
        used: dailyUploadBytes
      })
    }

    await ensureMaterialsStorage()
    for (const entry of validatedFiles) {
      const { file, mime } = entry
      const storagePath = getStoredMaterialPath(file.name)
      const stored = await writeUploadedMaterial(file, storagePath, mime)
      storedEntries.push({
        file,
        mime,
        storagePath,
        stored
      })
    }

    const submissions = await prisma.$transaction(
      storedEntries.map((entry) =>
        prisma.materialSubmission.create({
          data: {
            submittedByUserId: userId,
            comment,
            originalName: String(entry.file.name || "material"),
            mime: entry.mime,
            size: entry.stored.size,
            sha256: entry.stored.sha256,
            storagePath: entry.storagePath
          },
          include: {
            submittedByUser: {
              select: {
                id: true,
                email: true
              }
            }
          }
        })
      )
    )

    const serialized = submissions.map(serializeMaterialSubmission)

    sendMaterialUploadNotification({ submissions: serialized, session, comment }).catch((notifyError) => {
      console.error("[materials] admin notification failed", safeError(notifyError))
    })

    return json(
      {
        ok: true,
        count: serialized.length,
        submission: serialized[0] || null,
        submissions: serialized
      },
      201
    )
  } catch (error) {
    for (const entry of storedEntries) {
      try {
        await deleteStoredMaterial(entry.storagePath)
      } catch (cleanupError) {
        console.error("[materials] upload cleanup failed", safeError(cleanupError))
      }
    }

    if (isMaterialSubmissionSchemaError(error)) {
      return errorJson(getMaterialSubmissionSchemaMessage(locale), 503, locale)
    }

    const status = Number(error?.status) || 500
    if (status === 500) {
      console.error("[materials] upload failed", safeError(error))
    }
    return errorJson(status === 500 ? "Materjali üleslaadimine ebaõnnestus." : error?.message || "Materjali üleslaadimine ebaõnnestus.", status, locale)
  }
}
