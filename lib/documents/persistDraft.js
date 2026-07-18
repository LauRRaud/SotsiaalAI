import { prisma } from "@/lib/prisma"
import { MAX_ARTIFACT_SOURCE_DOCUMENTS } from "@/lib/documents/constants"
import { serializeArtifact } from "@/lib/documents/artifacts"
import { logDocumentsAudit } from "@/lib/documents/audit"
import { getStorageQuotaBytes, getUtf8ByteLength } from "@/lib/storageGuardrails"
import { getUserStorageUsageBytes } from "@/lib/storageUsage"

// Shared draft persistence for the two artifact entry points (generate-and-save,
// save-provided-content). Keeping it in one place is what makes a generated draft
// durable the instant its cost is committed: the same create + audit runs whether the
// content was just generated or pasted, and an idempotencyKey collapses a retry/race
// onto the row that already exists instead of minting a duplicate.

const artifactInclude = {
  template: {
    select: {
      id: true,
      title: true,
      originalName: true
    }
  },
  sourceDocuments: {
    include: {
      document: {
        select: {
          id: true,
          title: true,
          originalName: true,
          kind: true,
          templateFor: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  }
}

function buildRetrievalAuditFields(debugMeta) {
  if (!debugMeta) return {}
  return {
    retrievalMode: debugMeta.retrieval_mode || null,
    chunksUsed: Number(debugMeta.chunks_used) || 0,
    fallbackUsed: debugMeta.retrieval_mode === "fallback_source_material",
    fallbackReason: debugMeta.fallback_reason || null,
    documentsIndexed: Number(debugMeta.documents_indexed) || 0,
    tokenBudget: Number(debugMeta.token_budget) || 0
  }
}

function normalizeIdempotencyKey(value) {
  const key = String(value || "").trim()
  return key ? key.slice(0, 200) : null
}

// Throws { status: 413, message } when the content would exceed the owner's storage quota.
async function assertWithinStorageQuota({ userId, role, content }) {
  const storageQuotaBytes = getStorageQuotaBytes(role)
  const storageUsageBytes = await getUserStorageUsageBytes(userId)
  const contentBytes = getUtf8ByteLength(content)
  if (
    storageUsageBytes.totalBytes >= storageQuotaBytes ||
    storageUsageBytes.totalBytes + contentBytes > storageQuotaBytes
  ) {
    const error = new Error("documents.errors.storage_quota_exceeded")
    error.status = 413
    error.quota = { limit: storageQuotaBytes, used: storageUsageBytes.totalBytes }
    throw error
  }
}

/**
 * Persist a DRAFT AgentArtifact for the owner, idempotently.
 *
 * Returns { artifact, reused }. `reused` is true when an existing draft with the same
 * (ownerId, idempotencyKey) was returned instead of a new row — a retry never double-creates
 * and never loses the already-committed usage fact.
 */
export async function persistArtifactDraft({
  userId,
  role,
  type,
  title,
  templateId,
  documentIds,
  content,
  debugMeta,
  idempotencyKey,
  enforceQuota = true
}) {
  // The generate path commits usage before persisting, so it pre-checks the quota itself and
  // passes enforceQuota:false — a paid draft is never dropped for a marginal overage.
  if (enforceQuota) {
    await assertWithinStorageQuota({ userId, role, content })
  }

  const key = normalizeIdempotencyKey(idempotencyKey)
  const sourceDocumentIds = Array.isArray(documentIds) ? documentIds.slice(0, MAX_ARTIFACT_SOURCE_DOCUMENTS) : []

  try {
    const artifact = await prisma.agentArtifact.create({
      data: {
        ownerId: userId,
        type,
        title,
        status: "DRAFT",
        content,
        templateId: templateId || null,
        idempotencyKey: key,
        sourceDocuments: {
          createMany: {
            data: sourceDocumentIds.map((documentId) => ({ documentId }))
          }
        }
      },
      include: artifactInclude
    })

    await logDocumentsAudit("artifact.created", {
      userId,
      artifactId: artifact.id,
      type: artifact.type,
      title: artifact.title,
      templateId: artifact.templateId,
      sourceCount: artifact.sourceDocuments.length,
      ...buildRetrievalAuditFields(debugMeta)
    })

    return { artifact: serializeArtifact(artifact, { includeContent: true }), reused: false }
  } catch (error) {
    // A concurrent retry with the same key already created the draft — return it unchanged.
    if (key && error?.code === "P2002") {
      const existing = await prisma.agentArtifact.findFirst({
        where: { ownerId: userId, idempotencyKey: key },
        include: artifactInclude
      })
      if (existing) {
        return { artifact: serializeArtifact(existing, { includeContent: true }), reused: true }
      }
    }
    throw error
  }
}
