import { logDocumentsAudit } from "@/lib/documents/audit"
import { deleteDocumentRecordAndFile } from "@/lib/documents/deleteDocumentRecord"
import { purgeMeetingSummarySnapshotsForDocument } from "@/lib/documents/meetingSummaryJobs"
import { prisma } from "@/lib/prisma"
import { isFrameworkAcceptanceSchemaError } from "@/lib/frameworkAcceptanceCompat"
import { enforceDocumentsRateLimit, readDocumentsRateLimit } from "@/lib/documents/rateLimit"
import { logDataAudit } from "@/lib/privacy/audit"
import { deleteDocumentRagReference } from "@/lib/privacy/documentDeletion"
import { deleteTrackedStorageFile } from "@/lib/privacy/fileDeletion"
import { safeError } from "@/lib/privacy/safeError"
import {
  deleteStoredDocument,
  errorJson,
  json,
  localeFromRequest,
  normalizeDocumentKind,
  normalizeDocumentTitle,
  normalizeTemplateFor,
  requireDocumentUser
} from "@/lib/documents/server"
import {
  parseExpectedDocumentVersion,
  updateOwnedDocument,
  updateOwnedDocumentWithStagedText
} from "@/lib/documents/documentMutation"
import { deleteDocumentIndex } from "@/lib/documents/embeddings"
import {
  attemptDocumentRagRemoval,
  prepareDocumentRagPermissionChange
} from "@/lib/documents/ragPermission"
import { assertServiceLogReportDeletable } from "@/lib/serviceLog/reportRetention"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const DOCUMENTS_RATE_LIMIT_WINDOW_MS = readDocumentsRateLimit(process.env.DOCUMENTS_RATE_LIMIT_WINDOW_MS, 60_000, 1000)
const DOCUMENTS_MUTATION_RATE_LIMIT_MAX = readDocumentsRateLimit(process.env.DOCUMENTS_MUTATION_RATE_LIMIT_MAX, 30)

async function resolveRouteId(paramsLike) {
  const params = await paramsLike
  return String(params?.id || "").trim()
}

function serializeDocument(document) {
  const frameworkAcceptance = document.frameworkAcceptance || null
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
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  }
}

async function findDocumentWithFrameworkState(id, ownerId) {
  try {
    const document = await prisma.userDocument.findFirst({
      where: {
        id,
        ownerId,
        fieldVisitAttachments: { none: { storageStatus: { not: "ACTIVE" } } }
      },
      select: {
        id: true,
        ownerId: true,
        title: true,
        originalName: true,
        kind: true,
        templateFor: true,
        agentAllowed: true,
        mime: true,
        size: true,
        sha256: true,
        storagePath: true,
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
        }
      }
    })

    return {
      document,
      frameworkSchemaAvailable: true
    }
  } catch (error) {
    if (!isFrameworkAcceptanceSchemaError(error)) throw error

    const document = await prisma.userDocument.findFirst({
      where: {
        id,
        ownerId,
        fieldVisitAttachments: { none: { storageStatus: { not: "ACTIVE" } } }
      },
      select: {
        id: true,
        ownerId: true,
        title: true,
        originalName: true,
        kind: true,
        templateFor: true,
        agentAllowed: true,
        mime: true,
        size: true,
        sha256: true,
        storagePath: true,
        sourceDocumentId: true,
        content: true,
        metadata: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return {
      document: document
        ? {
            ...document,
            frameworkAcceptance: null
          }
        : null,
      frameworkSchemaAvailable: false
    }
  }
}

export async function GET(request, { params }) {
  const locale = localeFromRequest(request)
  const auth = await requireDocumentUser({ allowWithoutSubscription: true })
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
    const { document } = await findDocumentWithFrameworkState(id, auth.userId)
    if (!document) {
      return errorJson("documents.errors.not_found", 404, locale)
    }

    return json({
      ok: true,
      document: serializeDocument(document)
    })
  } catch (error) {
    if (error?.status === 403) {
      return errorJson("api.common.forbidden", 403, locale)
    }
    console.error("[documents] read failed", safeError(error))
    return errorJson("documents.errors.read_failed", 500, locale)
  }
}

export async function PATCH(request, { params }) {
  const locale = localeFromRequest(request)
  const auth = await requireDocumentUser()
  if (!auth?.ok) {
    return errorJson(auth?.message || "api.common.unauthorized", auth?.status || 401, locale, {
      redirect: auth?.redirect,
      requireSubscription: auth?.requireSubscription
    })
  }

  const rateLimitResponse = enforceDocumentsRateLimit(request, {
    scope: "documents_update",
    userId: auth.userId,
    limit: DOCUMENTS_MUTATION_RATE_LIMIT_MAX,
    windowMs: DOCUMENTS_RATE_LIMIT_WINDOW_MS
  })
  if (rateLimitResponse) return rateLimitResponse

  const id = await resolveRouteId(params)
  if (!id) {
    return errorJson("documents.errors.missing_id", 400, locale)
  }

  let body = {}
  try {
    body = await request.json()
  } catch {
    return errorJson("documents.errors.invalid_payload", 400, locale)
  }

  try {
    const expectedUpdatedAt = parseExpectedDocumentVersion(body?.expectedUpdatedAt)
    const { document: existing, frameworkSchemaAvailable } = await findDocumentWithFrameworkState(id, auth.userId)
    if (!existing) {
      return errorJson("documents.errors.not_found", 404, locale)
    }
    if (frameworkSchemaAvailable && existing.frameworkAcceptance) {
      return errorJson("documents.errors.read_only_document", 403, locale)
    }
    const kind = body?.kind == null ? existing.kind : normalizeDocumentKind(body.kind)
    const templateFor =
      body?.templateFor === undefined
        ? existing.templateFor
        : normalizeTemplateFor(body.templateFor, kind)

    const title =
      body?.title === undefined
        ? existing.title
        : normalizeDocumentTitle(body.title, existing.originalName)

    const agentAllowed =
      body?.agentAllowed === undefined ? existing.agentAllowed : Boolean(body.agentAllowed)
    const canUpdateContent = ["CALL_TRANSCRIPT", "AUDIO_TRANSCRIPT", "TRANSCRIPT_SUMMARY"].includes(existing.kind)
    const nextContent =
      body?.content === undefined || !canUpdateContent ? undefined : String(body.content || "").replace(/\r\n?/g, "\n").trim()
    let contentWasReplaced = false

    if (body?.content !== undefined && !canUpdateContent) {
      return errorJson("documents.errors.read_only_document", 403, locale)
    }

    const nextMetadata = nextContent === undefined
      ? existing.metadata
      : {
          ...(existing.metadata && typeof existing.metadata === "object" ? existing.metadata : {}),
          reviewedAt: new Date().toISOString(),
          reviewedByUserId: auth.userId
        }
    const permissionPlan = prepareDocumentRagPermissionChange({
      document: existing,
      nextAgentAllowed: agentAllowed,
      metadata: nextMetadata,
      actorUserId: auth.userId,
      targetUserId: auth.userId
    })

    const documentSelect = {
      id: true,
      ownerId: true,
      title: true,
      originalName: true,
      kind: true,
      templateFor: true,
      agentAllowed: true,
      mime: true,
      size: true,
      sha256: true,
      storagePath: true,
      sourceDocumentId: true,
      content: true,
      metadata: true,
      createdAt: true,
      updatedAt: true
    }

    // Sisu muutmisel läheb uus tekst esmalt AJUTISSE faili ja avaldatakse alles pärast
    // andmebaasi. Varem kirjutati vana faili peale ENNE DB-d: vea korral luges allalaadimine
    // juba uut sisu, aga API ja AI-kokkuvõte vana `content` välja — kaks tõde ühest dokumendist.
    let document =
      nextContent === undefined
        ? await updateOwnedDocument({
            documentId: id,
            ownerId: auth.userId,
            expectedUpdatedAt,
            data: { title, kind, templateFor, agentAllowed },
            select: documentSelect,
            prepareWithin: permissionPlan.prepareWithin
          })
        : await updateOwnedDocumentWithStagedText({
            documentId: id,
            ownerId: auth.userId,
            expectedUpdatedAt,
            storagePath: existing.storagePath,
            content: nextContent,
            data: {
              title,
              kind,
              templateFor,
              agentAllowed,
              metadata: nextMetadata
            },
            select: documentSelect,
            prepareWithin: permissionPlan.prepareWithin
          })
    contentWasReplaced = nextContent !== undefined

    if (permissionPlan.removalRequested) {
      document = await attemptDocumentRagRemoval(
        { document, actorUserId: auth.userId, targetUserId: auth.userId },
        { deleteIndex: deleteDocumentIndex }
      )
    }

    await logDocumentsAudit("document.updated", {
      userId: auth.userId,
      documentId: document.id,
      title: document.title,
      kind: document.kind,
      templateFor: document.templateFor,
      agentAllowed: document.agentAllowed
    })

    if (contentWasReplaced) {
      await logDocumentsAudit("document.transcript_updated", {
        userId: auth.userId,
        documentId: document.id,
        sourceDocumentId: document.sourceDocumentId || null,
        kind: document.kind,
        size: document.size
      })
    }

    return json({
      ok: true,
      document: serializeDocument({
        ...document,
        frameworkAcceptance: null
      })
    })
  } catch (error) {
    if (error?.status === 403) {
      return errorJson("api.common.forbidden", 403, locale)
    }
    if ([400, 404, 409].includes(Number(error?.status))) {
      return errorJson(error.message, Number(error.status), locale, {
        ...(error?.freshDocument
          ? { document: serializeDocument({ ...error.freshDocument, frameworkAcceptance: null }) }
          : {})
      })
    }
    console.error("[documents] update failed", safeError(error))
    return errorJson("documents.errors.update_failed", 500, locale)
  }
}

export async function DELETE(request, { params }) {
  const locale = localeFromRequest(request)
  const auth = await requireDocumentUser({ allowWithoutSubscription: true })
  if (!auth?.ok) {
    return errorJson(auth?.message || "api.common.unauthorized", auth?.status || 401, locale, {
      redirect: auth?.redirect,
      requireSubscription: auth?.requireSubscription
    })
  }

  const rateLimitResponse = enforceDocumentsRateLimit(request, {
    scope: "documents_delete",
    userId: auth.userId,
    limit: DOCUMENTS_MUTATION_RATE_LIMIT_MAX,
    windowMs: DOCUMENTS_RATE_LIMIT_WINDOW_MS
  })
  if (rateLimitResponse) return rateLimitResponse

  const id = await resolveRouteId(params)
  if (!id) {
    return errorJson("documents.errors.missing_id", 400, locale)
  }

  try {
    const { document: existing, frameworkSchemaAvailable } = await findDocumentWithFrameworkState(id, auth.userId)
    if (!existing) {
      return errorJson("documents.errors.not_found", 404, locale)
    }
    if (frameworkSchemaAvailable && existing.frameworkAcceptance) {
      return errorJson("documents.errors.read_only_document", 403, locale)
    }
    assertServiceLogReportDeletable(existing)

    // A meeting-summary document has a sibling <jobId>.json snapshot holding the same summary
    // text. Purge it before the record so a failure blocks the delete (honest, retryable) instead
    // of leaving silent content behind. Only MATERIAL documents can be meeting-summary outputs.
    if (existing.kind === "MATERIAL") {
      const snapshotPurge = await purgeMeetingSummarySnapshotsForDocument({
        userId: auth.userId,
        documentId: existing.id
      })
      if (!snapshotPurge.ok) {
        console.error("[documents] meeting-summary snapshot purge failed", {
          documentId: existing.id,
          failures: snapshotPurge.failures
        })
        return errorJson("documents.errors.delete_failed", 503, locale)
      }
    }

    await deleteDocumentRagReference({
      document: existing,
      actorUserId: auth.userId,
      targetUserId: auth.userId,
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null,
      userAgent: request.headers.get("user-agent") || null,
      action: "RAG_DELETE",
      auditResourceType: "UserDocument"
    })

    await logDataAudit({
      actorUserId: auth.userId,
      targetUserId: auth.userId,
      action: "DOCUMENT_DELETE",
      resourceType: "UserDocument",
      resourceId: existing.id,
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null,
      userAgent: request.headers.get("user-agent") || null,
      meta: {
        kind: existing.kind,
        mime: existing.mime,
        size: existing.size
      }
    })

    await logDocumentsAudit("document.deleted", {
      userId: auth.userId,
      documentId: existing.id,
      title: existing.title,
      originalName: existing.originalName,
      kind: existing.kind
    })

    const deletedDocument = await deleteDocumentRecordAndFile({
      deleteRecord: () => prisma.userDocument.delete({
        where: { id },
        select: {
          id: true,
          title: true,
          originalName: true,
          kind: true,
          storagePath: true
        }
      }),
      deleteFile: async (document) => {
        const result = await deleteTrackedStorageFile({
          actorUserId: auth.userId,
          targetUserId: auth.userId,
          resourceType: "UserDocument",
          resourceId: document.id,
          storagePath: document.storagePath,
          deleteFile: deleteStoredDocument
        })
        if (!result.ok) throw result.error
      },
      onFileDeleteError: (cleanupError, document) => {
        console.error("[documents] delete cleanup failed", {
          documentId: document?.id,
          storagePath: document?.storagePath,
          error: safeError(cleanupError)
        })
      }
    })

    return json({
      ok: true,
      id: deletedDocument.id
    })
  } catch (error) {
    if (error?.status === 409) {
      return errorJson(error.message, 409, locale)
    }
    if (error?.status === 403) {
      return errorJson("api.common.forbidden", 403, locale)
    }
    console.error("[documents] delete failed", safeError(error))
    return errorJson("documents.errors.delete_failed", 500, locale)
  }
}
