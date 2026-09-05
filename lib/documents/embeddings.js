import { createRagRetiredError } from "@/lib/rag/retired";

import { deleteRagDocument } from "@/lib/documents/ragService";

import { buildAgentRagDocumentId } from "@/lib/documents/ragIdentity"

export { buildAgentRagDocumentId } from "@/lib/documents/ragIdentity"

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

export async function deleteDocumentIndexByExternalRef(externalRef, observability = null) {
  if (!externalRef) {
    return {
      ok: false,
      skipped: true,
      reason: "missing_document_identity"
    }
  }
  return deleteRagDocument(externalRef, observability)
}

export async function ensureDocumentIndexed() {
  throw createRagRetiredError();
}
