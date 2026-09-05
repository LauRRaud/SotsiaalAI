// Compatibility boundary while the replacement knowledge system is built.
// Never turn an unavailable old service into an empty successful search/delete.
export const RAG_AVAILABLE = false;
export const RAG_RETIRED_MESSAGE_KEY = "api.rag.retired";

export function createRagRetiredError() {
  const error = new Error(RAG_RETIRED_MESSAGE_KEY);
  error.code = "RAG_RETIRED";
  error.status = 503;
  error.messageKey = RAG_RETIRED_MESSAGE_KEY;
  return error;
}

export function ragRetiredPayload() {
  return { ok: false, code: "RAG_RETIRED", messageKey: RAG_RETIRED_MESSAGE_KEY, message: RAG_RETIRED_MESSAGE_KEY };
}
