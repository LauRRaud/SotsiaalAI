export const RAG_PROXY_BODY_LIMIT_CODE = "RAG_PROXY_REQUEST_TOO_LARGE";

export function limitRagProxyBody(body, maxBytes) {
  if (!body) return undefined;
  const limit = Math.max(1, Number(maxBytes) || 1);
  let consumed = 0;
  return body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      consumed += chunk?.byteLength ?? 0;
      if (consumed > limit) {
        const error = new Error("RAG proxy request body exceeds the byte limit");
        error.code = RAG_PROXY_BODY_LIMIT_CODE;
        throw error;
      }
      controller.enqueue(chunk);
    }
  }));
}

export function isRagProxyBodyLimitError(error) {
  let current = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (current.code === RAG_PROXY_BODY_LIMIT_CODE) return true;
    current = current.cause;
  }
  return false;
}
