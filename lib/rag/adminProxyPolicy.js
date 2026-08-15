export const RAG_ADMIN_CAPABILITY = Object.freeze({
  NONE: "NONE",
  KNOWLEDGE_STEWARD: "KNOWLEDGE_STEWARD",
  PLATFORM_ADMIN: "PLATFORM_ADMIN"
});

const CAPABILITY_RANK = Object.freeze({
  [RAG_ADMIN_CAPABILITY.NONE]: 0,
  [RAG_ADMIN_CAPABILITY.KNOWLEDGE_STEWARD]: 1,
  [RAG_ADMIN_CAPABILITY.PLATFORM_ADMIN]: 2
});

function cleanSegments(input) {
  if (!Array.isArray(input)) return [];
  const segments = input.map(value => String(value || "").trim());
  if (segments.some(value => !value || value === "." || value === ".." || /[\\/\\\\]/.test(value))) {
    return [];
  }
  return segments;
}

function action(name, method, segments, requiredCapability, targetDocumentId = null) {
  return Object.freeze({
    name,
    method,
    path: `/${segments.join("/")}`,
    requiredCapability,
    targetDocumentId,
    mutation: method !== "GET" && method !== "HEAD"
  });
}

/**
 * The browser-facing catch-all is deliberately narrower than the internal RAG API.
 * Raw file/text ingest, search and analyze remain server-to-server surfaces.
 */
export function resolveRagProxyAction(methodInput, segmentsInput) {
  const method = String(methodInput || "").toUpperCase();
  const segments = cleanSegments(segmentsInput);
  const readMethod = method === "GET" || method === "HEAD";

  if (readMethod && segments.length === 1 && segments[0] === "documents") {
    return action("documents_list", method, segments, RAG_ADMIN_CAPABILITY.KNOWLEDGE_STEWARD);
  }
  if (readMethod && segments.length === 2 && segments[0] === "documents") {
    return action("document_read", method, segments, RAG_ADMIN_CAPABILITY.KNOWLEDGE_STEWARD, segments[1]);
  }
  if (
    readMethod &&
    segments.length === 3 &&
    segments[0] === "documents" &&
    (segments[2] === "chunks" || segments[2] === "source")
  ) {
    return action(
      segments[2] === "chunks" ? "document_chunks_read" : "document_source_read",
      method,
      segments,
      RAG_ADMIN_CAPABILITY.KNOWLEDGE_STEWARD,
      segments[1]
    );
  }
  if (method === "POST" && segments.length === 1 && segments[0] === "upload") {
    return action("document_upload", method, segments, RAG_ADMIN_CAPABILITY.KNOWLEDGE_STEWARD);
  }
  if (
    method === "POST" &&
    segments.length === 2 &&
    segments[0] === "ingest" &&
    (segments[1] === "pdf-with-metadata" || segments[1] === "articles")
  ) {
    return action(`ingest_${segments[1].replaceAll("-", "_")}`, method, segments, RAG_ADMIN_CAPABILITY.KNOWLEDGE_STEWARD);
  }
  if (method === "POST" && segments.length === 3 && segments[0] === "ingest" && segments[1] === "articles") {
    return action("articles_reingest", method, segments, RAG_ADMIN_CAPABILITY.KNOWLEDGE_STEWARD, segments[2]);
  }
  if (
    method === "POST" &&
    segments.length === 3 &&
    segments[0] === "documents" &&
    ["reindex", "update-meta", "patch-meta"].includes(segments[2])
  ) {
    return action(`document_${segments[2].replaceAll("-", "_")}`, method, segments, RAG_ADMIN_CAPABILITY.KNOWLEDGE_STEWARD, segments[1]);
  }
  if (method === "DELETE" && segments.length === 2 && segments[0] === "documents") {
    return action("document_delete", method, segments, RAG_ADMIN_CAPABILITY.PLATFORM_ADMIN, segments[1]);
  }
  if (method === "POST" && segments.length === 2 && segments[0] === "ingest" && segments[1] === "url") {
    return action("url_ingest", method, segments, RAG_ADMIN_CAPABILITY.PLATFORM_ADMIN);
  }
  return null;
}

export function authorizeRagProxyAction(capabilityInput, proxyAction) {
  if (!proxyAction) return false;
  const capability = String(capabilityInput || RAG_ADMIN_CAPABILITY.NONE).toUpperCase();
  return (CAPABILITY_RANK[capability] || 0) >= (CAPABILITY_RANK[proxyAction.requiredCapability] || Infinity);
}

export function validateRagMutationOrigin({ method, url, origin }) {
  const normalizedMethod = String(method || "").toUpperCase();
  if (normalizedMethod === "GET" || normalizedMethod === "HEAD") return true;
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(url).origin;
  } catch {
    return false;
  }
}
