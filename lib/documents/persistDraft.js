import { prisma } from "@/lib/prisma"
import { MAX_ARTIFACT_SOURCE_DOCUMENTS } from "@/lib/documents/constants"
import { serializeArtifact } from "@/lib/documents/artifacts"
import { logDocumentsAudit } from "@/lib/documents/audit"
import { getUtf8ByteLength } from "@/lib/storageGuardrails"
import { withStorageQuota } from "@/lib/documents/storageQuota"
import { buildArtifactGenerationMetadata } from "@/lib/documents/artifactProvenance"

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
  const key = normalizeIdempotencyKey(idempotencyKey)
  const sourceDocumentIds = Array.isArray(documentIds) ? documentIds.slice(0, MAX_ARTIFACT_SOURCE_DOCUMENTS) : []

  const createData = {
    ownerId: userId,
    type,
    title,
    status: "DRAFT",
    content,
    metadata: buildArtifactGenerationMetadata(null, debugMeta),
    templateId: templateId || null,
    idempotencyKey: key,
    sourceDocuments: {
      createMany: {
        data: sourceDocumentIds.map((documentId) => ({ documentId }))
      }
    }
  }

  try {
    // SOL-DOC-07: kui kvooti jõustatakse, siis mõõtmine ja loomine käivad ÜHES kasutajapõhise
    // lukuga tehingus. Varem oli see „loe summa → loo rida hiljem" ja kaks päringut mahtusid
    // mõlemad vana summa järgi ära.
    //
    // Callers may disable quota enforcement only when a surrounding atomic storage operation
    // already accounts for these bytes. Generated drafts use this locked create path directly.
    const artifact = enforceQuota
      ? await withStorageQuota(
          { userId, role, addBytes: getUtf8ByteLength(content) },
          {},
          (tx) => tx.agentArtifact.create({ data: createData, include: artifactInclude })
        )
      : await prisma.agentArtifact.create({ data: createData, include: artifactInclude })

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
