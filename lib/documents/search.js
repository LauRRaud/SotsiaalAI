import { buildAgentRagDocumentId } from "@/lib/documents/embeddings"
import { buildRagHeaders, ragServiceRequest } from "@/lib/documents/ragService"
import { classifyRetrievalFailure } from "@/lib/documents/retrievalObservability"

const AGENT_RAG_COLLECTION_ID = process.env.AGENT_RAG_COLLECTION_ID || "agent_documents"

export async function searchDocumentChunks(query, documents, maxChunks = 20, observability = null) {
  const cleanedQuery = String(query || "").trim()
  if (!cleanedQuery) return []

  const ragDocIds = documents
    .map((document) => buildAgentRagDocumentId(document))
    .filter(Boolean)

  if (!ragDocIds.length) return []

  let payload
  try {
    payload = await ragServiceRequest(
      "/search",
      {
        method: "POST",
        headers: buildRagHeaders("application/json", observability),
        body: JSON.stringify({
          query: cleanedQuery,
          top_k: Math.max(1, Math.min(50, Number(maxChunks) || 20)),
          where: {
            doc_id: { $in: ragDocIds },
            collection_id: AGENT_RAG_COLLECTION_ID
          },
          include: ["documents", "metadatas", "distances"]
        })
      },
      "documents.artifacts.errors.analysis_failed"
    )
  } catch (error) {
    error.retrievalReason = classifyRetrievalFailure(error, "rag_search_failed")
    throw error
  }

  const results = Array.isArray(payload?.results) ? payload.results : []
  return results.map((entry) => ({
    id: entry?.id || null,
    docId: entry?.doc_id || entry?.docId || null,
    originalDocumentId: entry?.original_doc_id || entry?.originalDocumentId || null,
    title: entry?.title || entry?.fileName || "Document",
    chunkId: entry?.chunk_id || entry?.chunkId || entry?.id || null,
    chunkIndex: Number.isFinite(Number(entry?.chunk_index ?? entry?.chunkIndex))
      ? Number(entry?.chunk_index ?? entry?.chunkIndex)
      : null,
    text: String(entry?.chunk || "").trim(),
    distance: Number.isFinite(Number(entry?.distance)) ? Number(entry.distance) : null
  }))
}
