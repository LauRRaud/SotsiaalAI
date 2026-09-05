import { createRagRetiredError } from "../rag/retired.js";

// Retained for source-management and privacy callers during the rebuild.
// There is deliberately no host, credential, network call or success fallback.
export function buildRagHeaders(contentType = "application/json") {
  const headers = new Headers();
  if (contentType) headers.set("Content-Type", contentType);
  return headers;
}

export async function ragServiceRequest() {
  throw createRagRetiredError();
}

export async function deleteRagDocument(docId) {
  if (!String(docId || "").trim()) {
    return { ok: false, skipped: true, reason: "missing_doc_id" };
  }
  return { ok: false, reason: "rag_retired", error: createRagRetiredError() };
}
