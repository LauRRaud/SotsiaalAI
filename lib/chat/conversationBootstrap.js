function localizedError(messageKey) {
  const error = new Error(messageKey);
  error.chatKey = messageKey;
  return error;
}

function apiMessageKey(payload, fallback) {
  const messageKey = String(payload?.messageKey || payload?.message || "").trim();
  return /^[a-z][a-z0-9_.:-]*$/i.test(messageKey) ? messageKey : fallback;
}

/**
 * Enne esimest sõnumit kinnitab klient, et aktiivne vestlus on serveris olemas.
 *
 * `/api/chat` ise ei tohi puuduvat ID-d vaikimisi luua: see muudaks puuduva ja
 * võõra vestluse serverivastused eristatavaks. Klient kasutab seepärast avalikku
 * vestluse loomise rada. `createOnly` hoiab ära selle, et vahepeal arhiveeritud
 * või teise päringuga tekkinud vestlus kogemata taasavataks.
 */
export async function ensureConversationBeforeSend({
  conversationId,
  role,
  knownConversationIds,
  fetchImpl = globalThis.fetch
} = {}) {
  const id = String(conversationId || "").trim();
  if (!id || typeof fetchImpl !== "function") {
    throw localizedError("api.chat.invalid_conv_id");
  }
  if (knownConversationIds?.has?.(id)) return id;

  const existingResponse = await fetchImpl(`/api/chat/run?convId=${encodeURIComponent(id)}`, {
    method: "GET",
    cache: "no-store"
  });
  const existingPayload = await existingResponse.json().catch(() => ({}));

  if (existingResponse.ok && existingPayload?.ok === true && existingPayload?.convId === id) {
    knownConversationIds?.add?.(id);
    return id;
  }
  if (!(existingResponse.ok && existingPayload?.notFound === true)) {
    throw localizedError(apiMessageKey(existingPayload, "api.chat.db_error_run_read"));
  }

  const createResponse = await fetchImpl("/api/chat/conversations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      id,
      role,
      createOnly: true
    })
  });
  const createPayload = await createResponse.json().catch(() => ({}));
  if (
    !createResponse.ok ||
    createPayload?.ok === false ||
    String(createPayload?.conversation?.id || "").trim() !== id
  ) {
    throw localizedError(apiMessageKey(createPayload, "api.chat.db_error_conversation_create"));
  }

  knownConversationIds?.add?.(id);
  return id;
}
