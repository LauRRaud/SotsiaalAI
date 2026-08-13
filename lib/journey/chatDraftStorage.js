import { openOwnerScopedStore } from "@/lib/device/ownerScopedStorage";

const CHAT_JOURNEY_DRAFT_ROW_PREFIX = "sotsiaalai:journey-v1:chat-draft";
const CHAT_JOURNEY_DRAFT_VERSION = 1;

function normalizedConversationId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function rowForConversation(conversationId) {
  const id = normalizedConversationId(conversationId);
  return id ? `${CHAT_JOURNEY_DRAFT_ROW_PREFIX}:${id}` : null;
}

function normalizedDraft(value, conversationId) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const storedConversationId = normalizedConversationId(value.conversationId);
  if (storedConversationId && storedConversationId !== conversationId) return null;
  if (!value.draft || typeof value.draft !== "object" || Array.isArray(value.draft)) return null;
  if (!String(value.draft.summary || "").trim()) return null;
  return {
    sourceText: String(value.sourceText || ""),
    draft: value.draft
  };
}

export function readChatJourneyDraft(storage, ownerId, conversationId) {
  const id = normalizedConversationId(conversationId);
  const row = rowForConversation(id);
  const store = openOwnerScopedStore(storage, ownerId);
  if (!store || !row) return null;
  try {
    const parsed = JSON.parse(store.getItem(row) || "null");
    if (parsed?.version !== CHAT_JOURNEY_DRAFT_VERSION) return null;
    return normalizedDraft(parsed, id);
  } catch {
    return null;
  }
}

export function writeChatJourneyDraft(storage, ownerId, conversationId, value) {
  const id = normalizedConversationId(conversationId);
  const row = rowForConversation(id);
  const store = openOwnerScopedStore(storage, ownerId);
  const draft = normalizedDraft(value, id);
  if (!store || !row || !draft) return false;
  store.setItem(row, JSON.stringify({
    version: CHAT_JOURNEY_DRAFT_VERSION,
    conversationId: id,
    ...draft
  }));
  return true;
}

export function clearChatJourneyDraft(storage, ownerId, conversationId) {
  const row = rowForConversation(conversationId);
  const store = openOwnerScopedStore(storage, ownerId);
  if (!store || !row) return false;
  store.removeItem(row);
  return true;
}
