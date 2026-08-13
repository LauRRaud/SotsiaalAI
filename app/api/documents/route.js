import { prisma } from "@/lib/prisma"
import { isFrameworkAcceptanceSchemaError } from "@/lib/frameworkAcceptanceCompat"
import { effectiveRoleFromSession } from "@/lib/authz"
import { DOCUMENT_LIST_LIMIT } from "@/lib/documents/constants"
import { buildPaginationMeta, parseListLimit, parseListOffset } from "@/lib/documents/listing"
import { logDocumentsAudit } from "@/lib/documents/audit"
import { enforceDocumentsRateLimit, readDocumentsRateLimit } from "@/lib/documents/rateLimit"
import { getUtcDayStart } from "@/lib/storageGuardrails"
import { withStorageQuota } from "@/lib/documents/storageQuota"
import { stageStoredBuffer } from "@/lib/documents/storageStaging"
import {
  deleteStoredDocument,
  ensureAllowedUpload,
  ensureDocumentsStorage,
  errorJson,
  getStoredDocumentPath,
  json,
  localeFromRequest,
  normalizeDocumentKind,
  normalizeDocumentTitle,
  normalizeTemplateFor,
  requireDocumentUser,
  assertMimeMatchesBuffer
} from "@/lib/documents/server"
import { safeError } from "@/lib/privacy/safeError"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const DOCUMENTS_RATE_LIMIT_WINDOW_MS = readDocumentsRateLimit(process.env.DOCUMENTS_RATE_LIMIT_WINDOW_MS, 60_000, 1000)
const DOCUMENTS_UPLOAD_RATE_LIMIT_MAX = readDocumentsRateLimit(process.env.DOCUMENTS_UPLOAD_RATE_LIMIT_MAX, 12)

export function resolveUploadAgentAllowed(role, kind, value) {
  return String(role || "").toUpperCase() === "CLIENT" && kind === "MATERIAL" && String(value || "") === "true"
}

function serializeDocument(document) {
  const frameworkAcceptance = document.frameworkAcceptance || null
  const callRecordingFile = document.callRecordingFiles?.[0] || null
  const recordingRequest = callRecordingFile?.recordingRequest || null
  return {
    id: document.id,
    title: document.title,
    originalName: document.originalName,
    kind: document.kind,
    templateFor: document.templateFor,
    agentAllowed: Boolean(document.agentAllowed),
    mime: document.mime,
    size: document.size,
    sourceDocumentId: document.sourceDocumentId || null,
    content: ["CALL_TRANSCRIPT", "AUDIO_TRANSCRIPT", "TRANSCRIPT_SUMMARY"].includes(document.kind) ? document.content || "" : undefined,
    metadata: document.metadata || null,
    readOnly: Boolean(frameworkAcceptance),
    frameworkAcceptance: frameworkAcceptance
      ? {
          id: frameworkAcceptance.id,
          frameworkKey: frameworkAcceptance.frameworkKey,
          frameworkVersion: frameworkAcceptance.frameworkVersion,
          acceptanceType: frameworkAcceptance.acceptanceType,
          acceptedAt: frameworkAcceptance.acceptedAt,
          signedDocumentDownloadedAt: frameworkAcceptance.signedDocumentDownloadedAt
        }
      : null,
    callRecording: callRecordingFile
      ? {
          id: callRecordingFile.id,
          callSessionId: callRecordingFile.callSessionId,
          recordingRequestId: callRecordingFile.recordingRequestId,
          purpose: recordingRequest?.purpose || null,
          purposeText: recordingRequest?.purposeText || null,
          consentStatus: recordingRequest?.status || null,
          participantsCount: recordingRequest?.consents?.length || 0,
          callStartedAt: recordingRequest?.callSession?.startedAt || null,
          callEndedAt: recordingRequest?.callSession?.endedAt || null,
          retentionUntil: callRecordingFile.retentionUntil || null,
          durationSeconds: callRecordingFile.durationSeconds || null
        }
      : null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  }
}

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
  const kindParam = String(requestUrl.searchParams.get("kind") || "").trim().toUpperCase()
  const kind = kindParam && kindParam !== "ALL" ? normalizeDocumentKind(kindParam) : null
  const limit = parseListLimit(requestUrl.searchParams.get("limit"), {
    fallback: DOCUMENT_LIST_LIMIT,
    maxLimit: DOCUMENT_LIST_LIMIT
  })
  const offset = parseListOffset(requestUrl.searchParams.get("offset"))
  const search = String(requestUrl.searchParams.get("search") || "").trim().slice(0, 200)
  const where = {
    ownerId: auth.userId,
    ...(kind ? { kind } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { originalName: { contains: search, mode: "insensitive" } }
          ]
        }
      : {})
  }

  try {
    const [total, documents] = await prisma.$transaction([
      prisma.userDocument.count({ where }),
      prisma.userDocument.findMany({
        where,
        select: {
          id: true,
          title: true,
          originalName: true,
          kind: true,
          templateFor: true,
          agentAllowed: true,
          mime: true,
          size: true,
          sourceDocumentId: true,
          content: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
          frameworkAcceptance: {
            select: {
              id: true,
              frameworkKey: true,
              frameworkVersion: true,
              acceptanceType: true,
              acceptedAt: true,
              signedDocumentDownloadedAt: true
            }
          },
          callRecordingFiles: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              callSessionId: true,
              recordingRequestId: true,
              retentionUntil: true,
              durationSeconds: true,
              recordingRequest: {
                select: {
                  purpose: true,
                  purposeText: true,
                  status: true,
                  consents: { select: { id: true } },
                  callSession: { select: { startedAt: true, endedAt: true } }
                }
              }
            }
          }
        },
        orderBy: {
          updatedAt: "desc"
        },
        skip: offset,
        take: limit
      })
    ])

    return json({
      ok: true,
      documents: documents.map(serializeDocument),
      pagination: buildPaginationMeta({ total, limit, offset })
    })
  } catch (error) {
    if (isFrameworkAcceptanceSchemaError(error)) {
      try {
        const [total, documents] = await Promise.all([
          prisma.userDocument.count({ where }),
          prisma.userDocument.findMany({
            where,
            select: {
              id: true,
              title: true,
              originalName: true,
              kind: true,
              templateFor: true,
              agentAllowed: true,
              mime: true,
              size: true,
              sourceDocumentId: true,
              content: true,
              metadata: true,
              createdAt: true,
              updatedAt: true
            },
            orderBy: {
              updatedAt: "desc"
            },
            skip: offset,
            take: limit
          })
        ])

        return json({
          ok: true,
          documents: documents.map((document) => serializeDocument({
            ...document,
            frameworkAcceptance: null
          })),
          pagination: buildPaginationMeta({ total, limit, offset })
        })
      } catch (fallbackError) {
        console.error("[documents] legacy list fallback failed", safeError(fallbackError))
      }
    }
    console.error("[documents] list failed", safeError(error))
    return errorJson("documents.errors.list_failed", 500, locale)
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
    scope: "documents_upload",
    userId: auth.userId,
    limit: DOCUMENTS_UPLOAD_RATE_LIMIT_MAX,
    windowMs: DOCUMENTS_RATE_LIMIT_WINDOW_MS
  })
  if (rateLimitResponse) return rateLimitResponse

  let formData
  try {
    formData = await request.formData()
  } catch {
    return errorJson("documents.errors.multipart_required", 400, locale)
  }

  const file = formData.get("file")
  const kind = normalizeDocumentKind(formData.get("kind"))
  const templateFor = normalizeTemplateFor(formData.get("templateFor"), kind)
  const title = normalizeDocumentTitle(formData.get("title"), file?.name || "")
  const role = effectiveRoleFromSession(auth.session)
  const agentAllowed = resolveUploadAgentAllowed(role, kind, formData.get("agentAllowed"))

  let storagePath = ""
  let createdDocument = null

  try {
    const mime = ensureAllowedUpload(file)
    const buffer = Buffer.from(await file.arrayBuffer())
    assertMimeMatchesBuffer(buffer, mime)
    await ensureDocumentsStorage()
    storagePath = getStoredDocumentPath(file.name)

    // Kvoodi mõõtmine ja rea loomine käivad ÜHES kasutajapõhise lukuga tehingus; fail
    // avaldatakse selle sees viimasena. Varem loeti summa eraldi ja rida loodi hiljem, seega
    // kaks päringut mahtusid mõlemad vana summa järgi ära ja ületasid koos limiidi.
    const staged = await stageStoredBuffer(buffer, storagePath)
    let document
    try {
      document = await withStorageQuota(
        {
          userId: auth.userId,
          role,
          addBytes: staged.size,
          dailyAddBytes: staged.size,
          dayStart: getUtcDayStart()
        },
        {},
        async (tx) => {
          const created = await tx.userDocument.create({
            data: {
              ownerId: auth.userId,
              title,
              originalName: String(file.name || title),
              kind,
              templateFor,
              agentAllowed,
              mime,
              size: staged.size,
              sha256: staged.sha256,
              storagePath
            },
            select: {
              id: true,
              title: true,
              originalName: true,
              kind: true,
              templateFor: true,
              agentAllowed: true,
              mime: true,
              size: true,
              createdAt: true,
              updatedAt: true
            }
          })
          await staged.publish()
          return created
        }
      )
      await staged.cleanup()
    } catch (error) {
      await staged.rollback()
      throw error
    }
    createdDocument = document

    await logDocumentsAudit("document.uploaded", {
      userId: auth.userId,
      documentId: createdDocument.id,
      title: createdDocument.title,
      originalName: createdDocument.originalName,
      kind: createdDocument.kind,
      templateFor: createdDocument.templateFor
    })

    return json(
      {
        ok: true,
        document: serializeDocument({
          ...document,
          frameworkAcceptance: null
        })
      },
      201
    )
  } catch (error) {
    if (storagePath) {
      try {
        await deleteStoredDocument(storagePath)
      } catch (cleanupError) {
        console.error("[documents] upload cleanup failed", safeError(cleanupError))
      }
    }

    const status = Number(error?.status) || 500
    const messageKey =
      status === 500 ? "documents.errors.upload_failed" : error?.message || "documents.errors.upload_failed"
    if (status === 500) {
      console.error("[documents] upload failed", safeError(error))
    }
    await logDocumentsAudit("document.upload_failed", {
      userId: auth.userId,
      title,
      originalName: String(file?.name || ""),
      kind,
      templateFor,
      status
    })
    return errorJson(messageKey, status, locale, error?.quota || undefined)
  }
}
