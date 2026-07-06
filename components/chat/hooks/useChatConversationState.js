import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeSources as defaultNormalizeSources } from "../utils/sources";
const MAX_HISTORY = 8;
const GLOBAL_CONV_KEY = "sotsiaalai:chat:convId";
const EMPTY_CONVERSATION_READY_KEY = "__empty__";

function hasMeaningfulMessageContent(message) {
  if (!message || typeof message !== "object") return false;
  if (typeof message.text === "string" && message.text.trim().length > 0) {
    return true;
  }
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    return true;
  }
  if (Array.isArray(message.cards) && message.cards.length > 0) {
    return true;
  }
  return false;
}

function makeChatStorage(key = "sotsiaalai:chat:v1") {
  const storage = typeof window !== "undefined" ? window.sessionStorage : null;
  function load() {
    if (!storage || !key) return null;
    try {
      const raw = storage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.messages) ? parsed.messages : null;
    } catch {
      return null;
    }
  }
  function save(messages) {
    if (!storage || !key) return;
    try {
      const maxMsgs = 160;
      const maxChars = 80000;
      let total = 0;
      const trimmed = messages.slice(-maxMsgs).map(m => {
        const t = String(m.text || "");
        if (total >= maxChars) return {
          ...m,
          text: ""
        };
        const room = maxChars - total;
        const cut = t.length > room ? t.slice(0, room) : t;
        total += cut.length;
        return {
          ...m,
          text: cut
        };
      });
      storage.setItem(key, JSON.stringify({
        messages: trimmed
      }));
    } catch {}
  }
  function clear() {
    if (!storage || !key) return;
    storage.removeItem(key);
  }
  return {
    load,
    save,
    clear
  };
}
function throttle(fn, waitMs) {
  let last = 0;
  let timer = null;
  return (...args) => {
    const now = Date.now();
    const remaining = waitMs - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
      return;
    }
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      last = Date.now();
      fn(...args);
    }, remaining);
  };
}
export function useChatConversationState({
  isRoomMode,
  roomId: _roomId,
  isGenerating,
  setErrorBanner: _setErrorBanner,
  setIsCrisis,
  t: _t,
  locale,
  userId,
  userRole,
  normalizeSources,
  getVisibleMessages
}) {
  const storageKey = useMemo(() => {
    const uid = userId || "anon";
    const loc = locale || "et";
    return `sotsiaalai:chat:${uid}:${(userRole || "CLIENT").toLowerCase()}:${loc}:v1`;
  }, [userId, userRole, locale]);
  const [convId, setConvId] = useState(null);
  const conversationStorageKey = useMemo(() => {
    if (!convId) return null;
    return `${storageKey}:messages:${convId}`;
  }, [convId, storageKey]);
  const chatStore = useMemo(() => makeChatStorage(conversationStorageKey), [conversationStorageKey]);
  const [messages, setMessages] = useState([]);
  const [hydratedConversationId, setHydratedConversationId] = useState(null);
  const [storedConversationHasMessages, setStoredConversationHasMessages] = useState(false);
  const [serverHydratedConversationId, setServerHydratedConversationId] = useState(null);
  const mountedRef = useRef(false);
  const messageIdRef = useRef(1);
  const isGeneratingRef = useRef(isGenerating);
  const lastLocalMutationAtRef = useRef(0);
  const messagesRef = useRef(messages);
  const convIdRef = useRef(convId);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);
  useEffect(() => {
    convIdRef.current = convId;
  }, [convId]);
  useEffect(() => {
    mountedRef.current = true;
    const idFromGlobal = typeof window !== "undefined" ? window.sessionStorage.getItem(GLOBAL_CONV_KEY) : null;
    const idFromPerUser = typeof window !== "undefined" ? window.sessionStorage.getItem(`${storageKey}:convId`) : null;
    const initialConvId = idFromGlobal || idFromPerUser || (typeof window !== "undefined" && window.crypto?.randomUUID ? window.crypto.randomUUID() : String(Date.now()));
    setConvId(initialConvId);
    if (typeof window !== "undefined") {
      if (!idFromGlobal) window.sessionStorage.setItem(GLOBAL_CONV_KEY, initialConvId);
      if (!idFromPerUser) window.sessionStorage.setItem(`${storageKey}:convId`, initialConvId);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [storageKey]);
  useEffect(() => {
    if (!convId) return;
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(GLOBAL_CONV_KEY, convId);
      window.sessionStorage.setItem(`${storageKey}:convId`, convId);
    } catch {}
  }, [convId, storageKey]);
  useEffect(() => {
    if (!mountedRef.current) return;
    if (!convId) {
      messageIdRef.current = 1;
      setMessages([]);
      setStoredConversationHasMessages(false);
      setServerHydratedConversationId(EMPTY_CONVERSATION_READY_KEY);
      setHydratedConversationId(EMPTY_CONVERSATION_READY_KEY);
      return;
    }
    const stored = chatStore.load();
    if (stored && stored.length) {
      let nextId = 1;
      const hydrated = stored.filter(hasMeaningfulMessageContent).map(m => ({
        ...m,
        id: nextId++
      }));
      messageIdRef.current = nextId;
      setStoredConversationHasMessages(hydrated.length > 0);
      setServerHydratedConversationId(null);
      setMessages(hydrated);
      setHydratedConversationId(convId);
      return;
    }
    messageIdRef.current = 1;
    setStoredConversationHasMessages(false);
    setServerHydratedConversationId(null);
    setMessages([]);
    setHydratedConversationId(convId);
  }, [chatStore, convId]);
  const conversationLocalReady = convId
    ? hydratedConversationId === convId
    : hydratedConversationId === EMPTY_CONVERSATION_READY_KEY;
  const conversationStateReady = convId
    ? hydratedConversationId === convId &&
      (storedConversationHasMessages || serverHydratedConversationId === convId)
    : hydratedConversationId === EMPTY_CONVERSATION_READY_KEY &&
      serverHydratedConversationId === EMPTY_CONVERSATION_READY_KEY;
  const appendMessage = useCallback(msg => {
    const id = messageIdRef.current++;
    const createdAt = msg?.createdAt || Date.now();
    lastLocalMutationAtRef.current = Date.now();
    setMessages(prev => [...prev, {
      ...msg,
      id,
      createdAt
    }]);
    return id;
  }, []);
  const saveMessages = useCallback(nextMessages => {
    try {
      chatStore.save(nextMessages);
    } catch {}
  }, [chatStore]);
  const shouldPreserveLocalMessages = useCallback((prevMessages, nextMessages) => {
    const prevList = Array.isArray(prevMessages) ? prevMessages : [];
    const nextList = Array.isArray(nextMessages) ? nextMessages : [];
    const recentLocalMutationMs = Date.now() - lastLocalMutationAtRef.current;
    const localRecentlyMutated = recentLocalMutationMs >= 0 && recentLocalMutationMs < 8000;
    const hasLocalStreaming = prevList.some(m => !!m?.isStreaming);
    const prevUserCount = prevList.reduce((count, msg) => count + (msg?.role === "user" && String(msg?.text || "").trim() ? 1 : 0), 0);
    const nextUserCount = nextList.reduce((count, msg) => count + (msg?.role === "user" && String(msg?.text || "").trim() ? 1 : 0), 0);
    const localHasStructuredOnlyMessages = prevList.some(
      (msg) =>
        hasMeaningfulMessageContent(msg) &&
        !(typeof msg?.text === "string" && msg.text.trim().length > 0)
    );
    const serverDroppedMessages =
      nextList.length < prevList.length || nextUserCount < prevUserCount;

    return (
      ((isGeneratingRef.current || hasLocalStreaming || localRecentlyMutated) &&
        serverDroppedMessages) ||
      (localHasStructuredOnlyMessages && serverDroppedMessages)
    );
  }, []);
  const mutateMessage = useCallback((id, updater) => {
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === id);
      if (idx === -1) return prev;
      const current = prev[idx];
      const updated = updater(current);
      if (!updated || updated === current) return prev;
      const next = [...prev];
      next[idx] = updated;
      lastLocalMutationAtRef.current = Date.now();
      return next;
    });
  }, []);
  const visibleForHistory = useMemo(() => {
    if (typeof getVisibleMessages === "function") {
      return getVisibleMessages(messages);
    }
    return messages;
  }, [getVisibleMessages, messages]);
  const historyPayload = useMemo(() => {
    const recent = visibleForHistory.slice(-MAX_HISTORY);
    const relevant = isRoomMode ? recent.filter(m => m.role === "ai" || m.aiVisible) : recent;
    return relevant.map(m => ({
      role: m.role === "member" ? "user" : m.role,
      text: m.text,
      sources: m.role === "ai" && Array.isArray(m.sources)
        ? m.sources.slice(0, 8).map(source => ({
            label: typeof source?.label === "string" ? source.label : undefined,
            title: typeof source?.title === "string" ? source.title : undefined,
            url: typeof source?.url === "string" ? source.url : undefined,
            pageRange: typeof source?.pageRange === "string" ? source.pageRange : undefined,
            paragraphTitle: typeof source?.paragraphTitle === "string" ? source.paragraphTitle : undefined,
            section: typeof source?.section === "string" ? source.section : undefined
          })).filter(source => source.label || source.title || source.url)
        : undefined
    }));
  }, [visibleForHistory, isRoomMode]);
  const getLatestHelpWorkflowState = useCallback(() => {
    const sourceMessages = Array.isArray(messagesRef.current) ? messagesRef.current : [];
    const visibleMessages = typeof getVisibleMessages === "function"
      ? getVisibleMessages(sourceMessages)
      : sourceMessages;
    for (let i = visibleMessages.length - 1; i >= 0; i -= 1) {
      const message = visibleMessages[i];
      if (message?.role !== "ai") continue;
      const helpState = message?.workflow?.help;
      if (!helpState || typeof helpState !== "object") continue;
      return helpState;
    }
    return null;
  }, [getVisibleMessages]);
  const saveTimerRef = useRef(null);
  const saveIdleRef = useRef(null);
  useEffect(() => {
    if (!mountedRef.current) return;
    const delay = isGenerating ? 1500 : 250;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (saveIdleRef.current && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(saveIdleRef.current);
      saveIdleRef.current = null;
    }
    const runSave = () => {
      try {
        chatStore.save(messagesRef.current);
      } catch {}
    };
    saveTimerRef.current = setTimeout(() => {
      if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
        saveIdleRef.current = window.requestIdleCallback(() => {
          saveIdleRef.current = null;
          runSave();
        }, {
          timeout: 1000
        });
      } else {
        runSave();
      }
    }, delay);
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (saveIdleRef.current && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(saveIdleRef.current);
        saveIdleRef.current = null;
      }
    };
  }, [chatStore, isGenerating, messages]);
  const hydrateFromServer = useCallback(async cancelledRef => {
    const id = convIdRef.current;
    if (!id) {
      setServerHydratedConversationId(EMPTY_CONVERSATION_READY_KEY);
      return;
    }
    try {
      const r = await fetch(`/api/chat/run?convId=${encodeURIComponent(id)}`, {
        cache: "no-store"
      });
      if (!r.ok) return;
      const data = await r.json();
      if (!data?.ok) return;
      if (cancelledRef?.current) return;
      const currentGlobalId = typeof window !== "undefined" ? window.sessionStorage.getItem(GLOBAL_CONV_KEY) : id;
      if (id !== currentGlobalId) return;
      const serverText = String(data.text || "");
      const serverTextTrim = serverText.trim();
      const normalizeSourceList =
        typeof normalizeSources === "function" ? normalizeSources : defaultNormalizeSources;
      const serverSources = normalizeSourceList(
        Array.isArray(data.displayed_sources) ? data.displayed_sources : data.sources ?? []
      );
      const serverAttachments = Array.isArray(data.attachments)
        ? data.attachments
        : [];
      const serverCards = Array.isArray(data.cards)
        ? data.cards
        : [];
      const serverCrisis = !!data.isCrisis;
      const serverMessages = Array.isArray(data.messages) ? data.messages : [];
      setIsCrisis?.(serverCrisis);
      if (serverMessages.length) {
        setMessages(prev => {
          let nextId = 1;
          const mapped = serverMessages.map(msg => {
            const normalizedRole = msg.role === "user" ? "user" : msg.role === "ai" ? "ai" : null;
            if (!normalizedRole) return null;
            const rawCreatedAt = msg?.createdAt ? new Date(msg.createdAt).getTime() : NaN;
            return {
              id: nextId++,
              role: normalizedRole,
              text: typeof msg.text === "string" ? msg.text : "",
              sources:
                normalizedRole === "ai"
                  ? normalizeSourceList(Array.isArray(msg.displayed_sources) ? msg.displayed_sources : msg.sources ?? [])
                  : undefined,
              attachments:
                normalizedRole === "ai" && Array.isArray(msg.attachments)
                  ? msg.attachments
                  : undefined,
              cards:
                normalizedRole === "ai" && Array.isArray(msg.cards)
                  ? msg.cards
                  : undefined,
              workflow:
                normalizedRole === "ai" && msg.workflow && typeof msg.workflow === "object"
                  ? msg.workflow
                  : undefined,
              isStreaming: false,
              ...(Number.isFinite(rawCreatedAt) ? {
                createdAt: rawCreatedAt
              } : {})
            };
          }).filter(Boolean);
          const prevList = Array.isArray(prev) ? prev : [];
          if (shouldPreserveLocalMessages(prevList, mapped)) {
            return prevList;
          }
          messageIdRef.current = nextId;
          return mapped;
        });
        return;
      }
      if (!serverTextTrim) {
        setMessages(prev => {
          const prevList = Array.isArray(prev) ? prev : [];
          if (!prevList.length) return prevList;
          if (shouldPreserveLocalMessages(prevList, [])) {
            return prevList;
          }
          messageIdRef.current = 1;
          return [];
        });
        return;
      }
      setMessages(prev => {
        const next = [...prev];
        let aiIdx = -1;
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === "ai") {
            aiIdx = i;
            break;
          }
        }
        if (aiIdx === -1) {
            next.push({
              id: (next.at(-1)?.id ?? 0) + 1,
              role: "ai",
              text: serverTextTrim,
              sources: serverSources,
              attachments: serverAttachments,
              cards: serverCards,
              workflow: data?.workflow && typeof data.workflow === "object" ? data.workflow : undefined,
              isStreaming: false,
              createdAt: Date.now()
            });
        } else {
          const cur = next[aiIdx];
          if (serverTextTrim.length > (cur.text || "").length) {
            next[aiIdx] = {
              ...cur,
              text: serverTextTrim,
              sources: serverSources,
              attachments: serverAttachments,
              cards: serverCards,
              workflow: data?.workflow && typeof data.workflow === "object" ? data.workflow : cur.workflow,
              isStreaming: false,
              createdAt: cur.createdAt || Date.now()
            };
          }
        }
        return next;
      });
    } catch {}
    finally {
      if (cancelledRef?.current) return;
      const currentGlobalId =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem(GLOBAL_CONV_KEY)
          : id;
      if (id !== currentGlobalId) return;
      if (convIdRef.current !== id) return;
      setServerHydratedConversationId(id);
    }
  }, [normalizeSources, setIsCrisis, shouldPreserveLocalMessages]);
  useEffect(() => {
    if (!convId) return;
    const cancelledRef = {
      current: false
    };
    hydrateFromServer(cancelledRef);
    const throttled = throttle(() => {
      if (document.visibilityState === "visible") hydrateFromServer(cancelledRef);
    }, 2500);
    const refreshFromEvent = throttle(() => {
      hydrateFromServer(cancelledRef);
    }, 2500);
    window.addEventListener("focus", throttled);
    document.addEventListener("visibilitychange", throttled);
    window.addEventListener("sotsiaalai:refresh-conversations", refreshFromEvent);
    return () => {
      cancelledRef.current = true;
      window.removeEventListener("focus", throttled);
      document.removeEventListener("visibilitychange", throttled);
      window.removeEventListener("sotsiaalai:refresh-conversations", refreshFromEvent);
    };
  }, [convId, hydrateFromServer]);
  return {
    convId,
    setConvId,
    messages,
    setMessages,
    conversationLocalReady,
    conversationStateReady,
    saveMessages,
    appendMessage,
    mutateMessage,
    historyPayload,
    getLatestHelpWorkflowState,
    hydrateFromServer
  };
}
