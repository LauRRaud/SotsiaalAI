import { extractDocumentText } from "@/lib/documents/sourceMaterial"
import { buildRagHeaders, deleteRagDocument, ragServiceRequest } from "@/lib/documents/ragService"
import { classifyRetrievalFailure } from "@/lib/documents/retrievalObservability"

const AGENT_RAG_COLLECTION_ID = process.env.AGENT_RAG_COLLECTION_ID || "agent_documents"

export function buildAgentRagDocumentId(document) {
  return `agent::${document.id}::${document.sha256}`
}

export async function deleteDocumentIndex(document, observability = null) {
  if (!document?.id || !document?.sha256) {
    return {
      ok: false,
      skipped: true,
      reason: "missing_document_identity"
    }
  }
  return deleteRagDocument(buildAgentRagDocumentId(document), observability)
}

export async function ensureDocumentIndexed(document, observability = null) {
  const ragDocId = buildAgentRagDocumentId(document)
  const expectedSha = String(document.sha256 || "").trim()
  const expectedUpdatedAt = document.updatedAt ? new Date(document.updatedAt).toISOString() : null

  let existing = null
  try {
    existing = await ragServiceRequest(
      `/documents/${encodeURIComponent(ragDocId)}`,
      {
        method: "GET",
        headers: buildRagHeaders()
      },
      "documents.artifacts.errors.analysis_failed"
    )
  } catch (error) {
    if (Number(error?.status) !== 404) {
      throw error
    }
  }

  const isFresh = existing
    && Number(existing?.chunks) > 0
    && String(existing?.source_sha256 || "").trim() === expectedSha
    && String(existing?.source_updated_at || "") === String(expectedUpdatedAt || "")

  if (!isFresh) {
    try {
      const text = await extractDocumentText(document)
      const response = await ragServiceRequest(
        "/ingest/text",
        {
          method: "POST",
          headers: buildRagHeaders("application/json", observability),
          body: JSON.stringify({
            doc_id: ragDocId,
            text,
            metadata: {
              title: document.title,
              fileName: document.originalName,
              original_doc_id: document.id,
              source_sha256: expectedSha,
              source_updated_at: expectedUpdatedAt,
              source_type: "agent_document",
              collection_id: AGENT_RAG_COLLECTION_ID,
              mimeType: document.mime,
              kind: document.kind,
              language: "et"
            }
          })
        },
        "documents.artifacts.errors.analysis_failed"
      )
      console.info(`RAG_AGENT_INGEST doc_id=${ragDocId} chunks=${Number(response?.inserted) || 0} status=ok`)
    } catch (error) {
      const reason = classifyRetrievalFailure(error, "rag_ingest_failed")
      console.error(`RAG_AGENT_INGEST doc_id=${ragDocId} status=error reason=${reason}`)
      error.retrievalReason = reason
      throw error
    }
  }

  return {
    ragDocId,
    title: document.title || document.originalName,
    originalName: document.originalName
  }
}
