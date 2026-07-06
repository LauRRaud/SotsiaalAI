import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRoomMessages } from "@/components/rooms/useRoomMessages";

export function useChatRoomMode({
  roomId,
  sessionUserId,
  t,
  initialIsHelpMatchRoom = false
}) {
  const isRoomMode = Boolean(roomId);
  const [sendToAssistant, setSendToAssistant] = useState(false);
  const {
    messages: roomMessages,
    blocked: roomBlocked,
    authRequired: roomAuthRequired,
    roomTitle,
    roomRole,
    isHelpMatchRoom,
    roomOrigin
  } = useRoomMessages(roomId || "", 3000, {
    initialIsHelpMatchRoom
  });
  const aiVisibleByMessageId = useRef(new Map());
  const pendingRoomAiIdsRef = useRef([]);
  const seenRoomAiIdsRef = useRef(new Set());

  useEffect(() => {
    aiVisibleByMessageId.current = new Map();
    pendingRoomAiIdsRef.current = [];
    seenRoomAiIdsRef.current = new Set();
  }, [roomId]);

  useEffect(() => {
    if (isHelpMatchRoom) {
      setSendToAssistant(false);
    }
  }, [isHelpMatchRoom]);

  const mappedRoomMessages = useMemo(() => {
    if (!isRoomMode) return [];
    return (roomMessages || []).map(m => {
      const created = m?.createdAt ? new Date(m.createdAt).getTime() : Date.now();
      const isMine = m?.authorId && sessionUserId && m.authorId === sessionUserId;
      const isAssistant = m?.senderType === "ASSISTANT";
      const aiSeen = isAssistant ? true : isMine ? !!aiVisibleByMessageId.current.get(m.id) : false;
      return {
        id: m.id,
        role: isAssistant ? "ai" : isMine ? "user" : "member",
        text: m.content || "",
        authorName: isAssistant ? t("chat.aria.assistant") : String(m.authorName || "").trim(),
        authorRole: m.authorRole || "MEMBER",
        createdAt: created,
        aiVisible: aiSeen
      };
    });
  }, [isRoomMode, roomMessages, sessionUserId, t]);

  const getVisibleMessages = useCallback(msgs => {
    if (!isRoomMode) return msgs;
    const withTsAi = msgs.filter(m => m.role === "ai" && m.roomScoped).map(m => ({
      ...m,
      createdAt: m.createdAt || Date.now()
    }));
    return [...mappedRoomMessages, ...withTsAi].sort((a, b) => {
      const ta = a.createdAt || 0;
      const tb = b.createdAt || 0;
      if (ta !== tb) return ta - tb;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });
  }, [isRoomMode, mappedRoomMessages]);

  const onRoomMessageSent = useCallback(msgId => {
    try {
      aiVisibleByMessageId.current.set(msgId, true);
    } catch {}
  }, []);

  const onAssistantMessageCreated = useCallback(msgId => {
    if (!isRoomMode || msgId == null) return;
    pendingRoomAiIdsRef.current = [...pendingRoomAiIdsRef.current, msgId];
  }, [isRoomMode]);

  return {
    isRoomMode,
    roomMessages,
    roomBlocked,
    roomAuthRequired,
    roomTitle,
    roomRole,
    isHelpMatchRoom,
    roomOrigin,
    sendToAssistant,
    setSendToAssistant,
    getVisibleMessages,
    onRoomMessageSent,
    onAssistantMessageCreated,
    pendingRoomAiIdsRef,
    seenRoomAiIdsRef
  };
}

export function useSyncRoomAssistantMessages({
  isRoomMode,
  roomMessages,
  sessionUserId,
  setMessages,
  pendingRoomAiIdsRef,
  seenRoomAiIdsRef
}) {
  useEffect(() => {
    if (!isRoomMode) return;
    if (!sessionUserId || !roomMessages?.length) return;
    const pending = pendingRoomAiIdsRef.current;
    if (!pending.length) return;
    const seen = seenRoomAiIdsRef.current;
    const freshAssistant = roomMessages.filter(m => m?.senderType === "ASSISTANT" && m?.authorId === sessionUserId && !seen.has(m.id));
    if (!freshAssistant.length) return;
    const toRemove = [...freshAssistant];
    freshAssistant.forEach(m => seen.add(m.id));
    if (!toRemove.length) return;
    setMessages(prev => {
      let next = prev;
      toRemove.forEach(() => {
        const localId = pending.shift();
        if (localId == null) return;
        next = next.filter(msg => msg.id !== localId);
      });
      pendingRoomAiIdsRef.current = pending;
      return next;
    });
  }, [
    isRoomMode,
    pendingRoomAiIdsRef,
    roomMessages,
    seenRoomAiIdsRef,
    sessionUserId,
    setMessages
  ]);
}
