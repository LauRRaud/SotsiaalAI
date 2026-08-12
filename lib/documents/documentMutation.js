import { prisma } from "@/lib/prisma"
import { updateDocumentWithStagedText } from "@/lib/documents/transcriptContent"

export const DOCUMENT_VERSION_CONFLICT_KEY = "documents.errors.version_conflict"

function mutationError(message, status, freshDocument = null) {
  const error = new Error(message)
  error.status = status
  error.freshDocument = freshDocument
  return error
}

/** UserDocument PATCH-i versioon on kohustuslik ja tuleb viimasest GET/list vastusest. */
export function parseExpectedDocumentVersion(value) {
  if (value == null || value === "") {
    throw mutationError("documents.errors.invalid_payload", 400)
  }
  const parsed = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(parsed.getTime())) {
    throw mutationError("documents.errors.invalid_payload", 400)
  }
  return parsed
}

function throwAfterCasLoss(current) {
  if (!current) throw mutationError("documents.errors.not_found", 404)
  throw mutationError(DOCUMENT_VERSION_CONFLICT_KEY, 409, current)
}

/** Üks tingimuslik lause: id + omanik + kliendi nähtud updatedAt. */
export async function updateOwnedDocument(
  { documentId, ownerId, expectedUpdatedAt, data, select, prepareWithin = null },
  { db = prisma } = {}
) {
  return db.$transaction(async (tx) => {
    const prepared = typeof prepareWithin === "function" ? await prepareWithin(tx) : null
    const result = await tx.userDocument.updateMany({
      where: { id: documentId, ownerId, updatedAt: expectedUpdatedAt },
      data: { ...data, ...(prepared?.data || {}) }
    })
    if (result.count !== 1) {
      const current = await tx.userDocument.findFirst({
        where: { id: documentId, ownerId },
        select
      })
      throwAfterCasLoss(current)
    }
    const updated = await tx.userDocument.findFirst({
      where: { id: documentId, ownerId },
      select
    })
    if (!updated) throw mutationError("documents.errors.not_found", 404)
    return updated
  })
}

/** Sama CAS transkripti jaoks; konflikti korral staged fail ei avaldu. */
export async function updateOwnedDocumentWithStagedText(
  { documentId, ownerId, expectedUpdatedAt, storagePath, content, data, select, prepareWithin = null },
  options = {}
) {
  return updateDocumentWithStagedText(
    {
      where: { id: documentId, ownerId, updatedAt: expectedUpdatedAt },
      readWhere: { id: documentId, ownerId },
      onConflict: throwAfterCasLoss,
      storagePath,
      content,
      data,
      select,
      prepareWithin
    },
    options
  )
}
