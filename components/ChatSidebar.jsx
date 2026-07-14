"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffectiveRole } from "@/components/auth/useEffectiveRole";
import { useI18n } from "@/components/i18n/I18nProvider";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { LIST_STATE, resolveListState, shouldSettleRequest } from "@/lib/chat/sidebarListState";
import { localizePath, stripLocaleFromPath } from "@/lib/localizePath";
import { buildRoomChatPath } from "@/lib/roomPath";
import Button from "@/components/ui/Button";
import ModalConfirm from "@/components/ui/ModalConfirm";
function uuid() {
  const rnd = typeof window !== "undefined" && window.crypto?.randomUUID?.() || null;
  return rnd ? `conv-${rnd}` : `conv-${Date.now()}`;
}
function formatDateTime(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}
function clearStoredConversationRefs(ids) {
  if (typeof window === "undefined") return;
  const deletedIds = new Set((Array.isArray(ids) ? ids : [ids]).map(id => String(id || "").trim()).filter(Boolean));
  if (!deletedIds.size) return;
  try {
    const current = window.sessionStorage.getItem("sotsiaalai:chat:convId");
    if (deletedIds.has(current)) {
      window.sessionStorage.removeItem("sotsiaalai:chat:convId");
    }
    const keysToRemove = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (!key) continue;
      const value = window.sessionStorage.getItem(key);
      if (key.endsWith(":convId") && deletedIds.has(value)) {
        keysToRemove.push(key);
        continue;
      }
      for (const id of deletedIds) {
        if (key.endsWith(`:messages:${id}`)) {
          keysToRemove.push(key);
          break;
        }
      }
    }
    keysToRemove.forEach(key => window.sessionStorage.removeItem(key));
  } catch {}
}
function notifyDeletedConversations(ids) {
  if (typeof window === "undefined") return;
  const deletedIds = (Array.isArray(ids) ? ids : [ids]).map(id => String(id || "").trim()).filter(Boolean);
  if (!deletedIds.length) return;
  try {
    window.dispatchEvent(new CustomEvent("sotsiaalai:conversations-deleted", {
      detail: {
        ids: deletedIds
      }
    }));
  } catch {}
}
export default function ChatSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { effectiveRole, isAdmin } = useEffectiveRole();
  const [items, setItems] = useState([]);
  const [roomItems, setRoomItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [roomsBusy, setRoomsBusy] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState(() => String(searchParams?.get("roomId") || "").trim() ? "groups" : "conversations");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const isActionBusy = busy || creating || bulkDeleting;
  const abortRef = useRef(null);
  const cursorRef = useRef(null);
  const roomsAbortRef = useRef(null);
  const visibilityThrottleRef = useRef({
    timer: null,
    last: 0
  });
  const {
    t,
    locale
  } = useI18n();
  const normalizedPathname = useMemo(() => stripLocaleFromPath(pathname || "/"), [pathname]);
  const resolveErrorMessage = useCallback((payload, fallbackKey) => resolveApiMessage({
    payload,
    t,
    fallbackKey,
    fallbackText: typeof t === "function" ? t(fallbackKey) : fallbackKey
  }), [t]);
  const pageSize = useMemo(() => {
    if (typeof window === "undefined") return 30;
    return window.innerWidth < 640 ? 15 : 30;
  }, []);
  const conversationRole = useMemo(() => {
    const normalized = String(effectiveRole || "CLIENT").toUpperCase().trim();
    if (normalized === "SOCIAL_WORKER" || normalized === "CLIENT") {
      return normalized;
    }
    return "CLIENT";
  }, [effectiveRole]);
  const conversationListRole = useMemo(() => (isAdmin ? "ALL" : conversationRole), [conversationRole, isAdmin]);
  const fetchList = useCallback(async ({
    reset
  } = {
    reset: false
  }) => {
    setError("");
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    if (reset) {
      setItems([]);
      cursorRef.current = null;
      setHasMore(false);
    }
    setBusy(true);
    try {
      const params = new URLSearchParams({
        limit: String(pageSize)
      });
      params.set("role", conversationListRole);
      if (!reset && cursorRef.current) {
        params.set("cursor", cursorRef.current);
      }
      const r = await fetch(`/api/chat/conversations?${params.toString()}`, {
        cache: "no-store",
        signal: ac.signal
      });
      const data = await r.json().catch(() => ({
        ok: false,
        conversations: []
      }));
      if (!r.ok || !data?.ok) {
        throw new Error(resolveErrorMessage(data, "chat.sidebar.error.load"));
      }
      const newItems = Array.isArray(data.conversations) ? data.conversations : [];
      setItems(prev => reset ? newItems : [...prev, ...newItems]);
      const nextCursor = data.nextCursor || null;
      cursorRef.current = nextCursor;
      setHasMore(Boolean(nextCursor));
      if (data?.degraded) {
        setError(resolveErrorMessage(data, "chat.sidebar.error.history"));
      }
    } catch (e) {
      // A superseded request must not write anything: its replacement is still
      // in flight and owns the state now.
      if (e?.name !== "AbortError" && shouldSettleRequest(abortRef.current, ac)) {
        setError(e?.message || t("chat.sidebar.error.load"));
      }
    } finally {
      // Gated on purpose. An unconditional setBusy(false) let an aborted request
      // clear the loading flag while its replacement was still loading, which
      // rendered a confident "no results" over an in-flight search.
      if (shouldSettleRequest(abortRef.current, ac)) {
        abortRef.current = null;
        setBusy(false);
      }
    }
  }, [conversationListRole, pageSize, resolveErrorMessage, t]);
  const fetchRooms = useCallback(async () => {
    roomsAbortRef.current?.abort();
    const ac = new AbortController();
    roomsAbortRef.current = ac;
    setRoomsBusy(true);
    try {
      const r = await fetch("/api/rooms", {
        cache: "no-store",
        signal: ac.signal
      });
      const data = await r.json().catch(() => ({
        ok: false,
        rooms: []
      }));
      if (!r.ok || !data?.ok) {
        throw new Error(resolveErrorMessage(data, "rooms.error"));
      }
      const normalized = Array.isArray(data.rooms) ? data.rooms.map(room => ({
        id: room.id,
        title: room.title || t("chat.sidebar.room_fallback"),
        preview: room?.lastMessage?.content || "",
        lastActivityAt: room?.lastMessage?.createdAt || null,
        isHelpMatchRoom: room?.isHelpMatchRoom === true,
        kind: "room"
      })) : [];
      setRoomItems(normalized);
    } catch (e) {
      if (e?.name !== "AbortError") {
        console.warn("Rooms load failed:", e);
      }
    } finally {
      if (roomsAbortRef.current === ac) roomsAbortRef.current = null;
      setRoomsBusy(false);
    }
  }, [resolveErrorMessage, t]);
  const refreshAll = useCallback(() => {
    fetchList({
      reset: true
    });
    fetchRooms();
  }, [fetchList, fetchRooms]);
  const scheduleVisibilityRefresh = useCallback(() => {
    const state = visibilityThrottleRef.current;
    const now = Date.now();
    const wait = 2000;
    const remaining = wait - (now - state.last);
    const run = () => {
      state.last = Date.now();
      state.timer = null;
      refreshAll();
    };
    if (remaining <= 0) {
      if (state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
      }
      run();
    } else if (!state.timer) {
      state.timer = setTimeout(run, remaining);
    }
  }, [refreshAll]);
  useEffect(() => {
    const throttleState = visibilityThrottleRef.current;
    refreshAll();
    const onExternalRefresh = () => refreshAll();
    const onDrawerToggle = (event) => {
      const explicitOpen = event?.detail?.open;
      if (explicitOpen === false) return;
      refreshAll();
    };
    window.addEventListener("sotsiaalai:refresh-conversations", onExternalRefresh);
    window.addEventListener("sotsiaalai:toggle-conversations", onDrawerToggle);
    const handleVisibilityEvent = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "visible") {
        scheduleVisibilityRefresh();
      }
    };
    window.addEventListener("focus", handleVisibilityEvent);
    document.addEventListener("visibilitychange", handleVisibilityEvent);
    return () => {
      window.removeEventListener("sotsiaalai:refresh-conversations", onExternalRefresh);
      window.removeEventListener("sotsiaalai:toggle-conversations", onDrawerToggle);
      window.removeEventListener("focus", handleVisibilityEvent);
      document.removeEventListener("visibilitychange", handleVisibilityEvent);
      if (throttleState?.timer) {
        clearTimeout(throttleState.timer);
        throttleState.timer = null;
      }
      abortRef.current?.abort();
      roomsAbortRef.current?.abort();
    };
  }, [refreshAll, scheduleVisibilityRefresh]);
  useEffect(() => {
    if (!selectMode) return;
    setSelectedIds(prev => {
      if (!prev.size) return prev;
      const allowed = new Set(items.map(item => item.id));
      const next = new Set();
      prev.forEach(id => {
        if (allowed.has(id)) next.add(id);
      });
      return next;
    });
  }, [items, selectMode]);
  useEffect(() => {
    if (activeView === "conversations") return;
    if (!selectMode) return;
    setSelectMode(false);
    setSelectedIds(new Set());
  }, [activeView, selectMode]);
  useEffect(() => {
    if (activeView === "conversations") return;
    if (!searchQuery) return;
    setSearchQuery("");
  }, [activeView, searchQuery]);
  useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent("sotsiaalai:conversation-drawer-title", {
        detail: {
          title: activeView === "conversations" ? t("chat.menu.label") : t("chat.sidebar.sections.groups")
        }
      }));
    } catch {}
  }, [activeView, t]);
  const fetchMore = useCallback(() => {
    if (busy || creating || !hasMore) return;
    fetchList({
      reset: false
    });
  }, [busy, creating, hasMore, fetchList]);
  const toggleSelectMode = useCallback(() => {
    setSelectMode(prev => {
      const next = !prev;
      if (!next) setSelectedIds(new Set());
      return next;
    });
  }, []);
  const toggleSelected = useCallback(id => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);
  const isEmbeddedChat = searchParams?.get("mode") === "chat";
  const updateChatUrl = useCallback((nextRoomId, options = {}) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "chat");
    if (nextRoomId) {
      url.searchParams.set("roomId", nextRoomId);
      if (options?.isHelpMatchRoom === true) {
        url.searchParams.set("roomKind", "help-match");
      } else {
        url.searchParams.delete("roomKind");
      }
    } else {
      url.searchParams.delete("roomId");
      url.searchParams.delete("roomKind");
    }
    const qs = url.searchParams.toString();
    const nextPath = qs ? `${url.pathname}?${qs}` : url.pathname;
    if (nextPath === `${pathname}${window.location.search}`) return;
    router.replace(nextPath);
  }, [pathname, router]);
  const activateConversation = useCallback((conversationId, {
    force = false
  } = {}) => {
    const id = String(conversationId || "").trim();
    if (!id) return;
    if (selectMode && !force) return;
    try {
      window.sessionStorage.setItem("sotsiaalai:chat:convId", id);
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent("sotsiaalai:switch-conversation", {
        detail: {
          convId: id
        }
      }));
    } catch {}
    if (normalizedPathname.startsWith("/vestlus") && searchParams?.get("roomId")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("roomId");
      const qs = params.toString();
      router.replace(localizePath(qs ? `/vestlus?${qs}` : "/vestlus", locale));
    }
    try {
      window.dispatchEvent(new CustomEvent("sotsiaalai:toggle-conversations", {
        detail: {
          open: false
        }
      }));
    } catch {}
  }, [locale, normalizedPathname, router, searchParams, selectMode]);
  const onPick = useCallback(item => {
    if (!item?.id) return;
    if (selectMode) return;
      if (item.kind === "room") {
        const roomChatPath = buildRoomChatPath(item.id, locale, {
          isHelpMatchRoom: item.isHelpMatchRoom === true
        });
        if (isEmbeddedChat) {
          updateChatUrl(String(item.id), {
            isHelpMatchRoom: item.isHelpMatchRoom === true
          });
        } else {
          router.push(roomChatPath);
        }
      window.dispatchEvent(new CustomEvent("sotsiaalai:toggle-conversations", {
        detail: {
          open: false
        }
      }));
      return;
    }
    activateConversation(item.id);
  }, [activateConversation, isEmbeddedChat, locale, router, selectMode, updateChatUrl]);
  const onNew = useCallback(async () => {
    if (busy || creating) return;
    setCreating(true);
    setError("");
    const id = uuid();
    try {
      const r = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id,
          role: conversationRole
        })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.ok === false) {
        throw new Error(resolveErrorMessage(data, "chat.sidebar.error.create"));
      }
      const nextId = data?.conversation?.id || id;
      activateConversation(nextId, {
        force: true
      });
      refreshAll();
    } catch (e) {
      setError(e?.message || t("chat.sidebar.error.create"));
    } finally {
      setCreating(false);
    }
  }, [activateConversation, busy, conversationRole, creating, refreshAll, resolveErrorMessage, t]);

  useEffect(() => {
    const onCreateConversation = () => {
      void onNew();
    };
    window.addEventListener("sotsiaalai:create-conversation", onCreateConversation);
    return () => window.removeEventListener("sotsiaalai:create-conversation", onCreateConversation);
  }, [onNew]);

  const deleteConversationById = useCallback(async id => {
    if (!id) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/chat/conversations/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.ok === false) {
        throw new Error(resolveErrorMessage(data, "chat.sidebar.error.delete"));
      }
      clearStoredConversationRefs(id);
      notifyDeletedConversations(id);
      refreshAll();
    } catch (e) {
      setError(e?.message || t("chat.sidebar.error.delete"));
    } finally {
      setBusy(false);
    }
  }, [refreshAll, resolveErrorMessage, t]);
  const onDelete = useCallback(id => {
    if (!id || isActionBusy) return;
    setConfirmState({
      kind: "single",
      id
    });
  }, [isActionBusy]);
  const fetchAllConversationIds = useCallback(async () => {
    const ids = [];
    let nextCursor = null;
    let loops = 0;
    do {
      const params = new URLSearchParams({
        limit: "100"
      });
      params.set("role", conversationListRole);
      if (nextCursor) params.set("cursor", nextCursor);
      const r = await fetch(`/api/chat/conversations?${params.toString()}`, {
        cache: "no-store"
      });
      const data = await r.json().catch(() => ({
        ok: false,
        conversations: []
      }));
      if (!r.ok || !data?.ok) {
        throw new Error(resolveErrorMessage(data, "chat.sidebar.error.load"));
      }
      const list = Array.isArray(data.conversations) ? data.conversations : [];
      list.forEach(row => {
        if (row?.id) ids.push(row.id);
      });
      nextCursor = data.nextCursor || null;
      loops += 1;
    } while (nextCursor && loops < 50);
    return ids;
  }, [conversationListRole, resolveErrorMessage]);
  const deleteConversationIds = useCallback(async ids => {
    const unique = Array.from(new Set(ids)).filter(Boolean);
    if (!unique.length) return {
      deleted: 0,
      failed: 0,
      deletedIds: []
    };
    setBulkDeleting(true);
    setError("");
    const failures = [];
    const deletedIds = [];
    if (unique.length > 1) {
      try {
        const r = await fetch("/api/chat/conversations", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            ids: unique
          })
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || data?.ok === false) {
          throw new Error(resolveErrorMessage(data, "chat.sidebar.error.delete"));
        }
        deletedIds.push(...unique);
      } catch (e) {
        unique.forEach(id => failures.push({
            id,
            error: e
          }));
      }
    } else {
      for (const id of unique) {
        try {
          const r = await fetch(`/api/chat/conversations/${encodeURIComponent(id)}`, {
            method: "DELETE"
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok || data?.ok === false) {
            throw new Error(resolveErrorMessage(data, "chat.sidebar.error.delete"));
          }
          deletedIds.push(id);
        } catch (e) {
          failures.push({
            id,
            error: e
          });
        }
      }
    }
    if (failures.length) {
      setError(t("chat.sidebar.error.delete"));
    }
    clearStoredConversationRefs(deletedIds);
    notifyDeletedConversations(deletedIds);
    refreshAll();
    setBulkDeleting(false);
    return {
      deleted: unique.length - failures.length,
      failed: failures.length,
      deletedIds
    };
  }, [refreshAll, resolveErrorMessage, t]);
  const handleDeleteSelected = useCallback(() => {
    if (!selectedIds.size || isActionBusy) return;
    setConfirmState({
      kind: "selected",
      ids: Array.from(selectedIds)
    });
  }, [isActionBusy, selectedIds]);
  const handleDeleteAll = useCallback(() => {
    if (isActionBusy) return;
    setConfirmState({
      kind: "all"
    });
  }, [isActionBusy]);
  const performDelete = useCallback(async state => {
    if (!state) return;
    if (state.kind === "single") {
      await deleteConversationById(state.id);
      return;
    }
    if (state.kind === "selected") {
      const ids = Array.isArray(state.ids) ? state.ids : [];
      const result = await deleteConversationIds(ids);
      if (result.failed === 0) {
        setSelectedIds(new Set());
      }
      return;
    }
    let ids = [];
    try {
      ids = await fetchAllConversationIds();
    } catch (e) {
      setError(e?.message || t("chat.sidebar.error.delete"));
      return;
    }
    const result = await deleteConversationIds(ids);
    if (result.failed === 0) {
      setSelectedIds(new Set());
      setSelectMode(false);
    }
  }, [deleteConversationById, deleteConversationIds, fetchAllConversationIds, t]);
  const handleConfirmDelete = useCallback(() => {
    if (!confirmState) return;
    const state = confirmState;
    setConfirmState(null);
    void performDelete(state);
  }, [confirmState, performDelete]);
  const handleConfirmCancel = useCallback(() => {
    setConfirmState(null);
  }, []);
  const confirmMessage = useMemo(() => {
    if (!confirmState) return "";
    if (confirmState.kind === "single") return t("chat.sidebar.confirm.delete");
    if (confirmState.kind === "selected") return t("chat.sidebar.confirm.delete_selected");
    return t("chat.sidebar.confirm.delete_all");
  }, [confirmState, t]);
  const activeRoomId = String(searchParams?.get("roomId") || "").trim();
  useEffect(() => {
    if (!activeRoomId) return;
    setActiveView("groups");
  }, [activeRoomId]);
  const safeDate = v => {
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
  };
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const sortedConversations = useMemo(() => [...items].map(item => ({
    ...item,
    kind: "conversation"
  })).sort((a, b) => safeDate(b?.lastActivityAt) - safeDate(a?.lastActivityAt)), [items]);
  const sortedRooms = useMemo(() => [...roomItems].sort((a, b) => safeDate(b?.lastActivityAt) - safeDate(a?.lastActivityAt)), [roomItems]);
  const isConversationView = activeView === "conversations";
  const filteredConversations = useMemo(() => {
    if (!normalizedSearchQuery) return sortedConversations;
    return sortedConversations.filter(item => {
      const haystack = [item?.title, item?.preview, item?.id].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(normalizedSearchQuery);
    });
  }, [normalizedSearchQuery, sortedConversations]);
  const hasConversationSearch = isConversationView && Boolean(normalizedSearchQuery);
  const currentItems = isConversationView ? filteredConversations : sortedRooms;
  const currentBusy = isConversationView ? busy : roomsBusy;
  // A failed request proves nothing about whether results exist, so `error`
  // outranks `no_matches` here — otherwise a technical failure would render as
  // the very false negative this package removes.
  const listState = resolveListState({
    busy: currentBusy,
    error,
    itemCount: currentItems.length,
    hasSearch: hasConversationSearch
  });
  const isLoading = busy || roomsBusy;
  const selectedCount = selectedIds.size;
  const renderLoadingSkeleton = (prefix, count = 3) => Array.from({ length: count }).map((_, i) => <div key={`${prefix}-${i}`} />);
  const renderListItem = item => {
    const isRoom = item.kind === "room";
    const titleText = item.title || item.preview || t("chat.sidebar.item.fallback_title");
    const isActive = (() => {
      if (isRoom) {
        return activeRoomId === String(item.id || "");
      }
      try {
        const current = window.sessionStorage.getItem("sotsiaalai:chat:convId");
        return current === item.id;
      } catch {
        return false;
      }
    })();
    return <li key={`${item.kind}:${item.id}`}>
        <div>
          <div>
            {selectMode && !isRoom ? <label className="drawer-select-check">
                <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} disabled={isActionBusy} aria-label={t("chat.sidebar.selection.select")} />
              </label> : null}
            <div onClick={() => selectMode ? null : onPick(item)} onKeyDown={event => {
            if (selectMode) return;
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onPick(item);
          }} title={item.preview || item.title || t("chat.sidebar.item.fallback_title")} role="button" tabIndex={selectMode ? -1 : 0} aria-current={isActive ? "true" : undefined} aria-disabled={selectMode ? "true" : undefined}>
              <div>
                <span>
                  {titleText}
                </span>
              </div>
              {isRoom && item.preview ? <div>
                  {item.preview}
                </div> : null}
              <div>
                <div>
                  {formatDateTime(item.lastActivityAt)}
                </div>
              </div>
            </div>
            {!isRoom && !selectMode ? <button type="button" onClick={event => {
              event.preventDefault();
              event.stopPropagation();
              onDelete(item.id);
            }} aria-label={t("chat.sidebar.item.delete")} title={t("chat.sidebar.item.delete_title")} disabled={isActionBusy}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.82" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                    </svg>
              </button> : null}
          </div>
        </div>
      </li>;
  };
  return <>
    <nav aria-label={t("chat.sidebar.aria_list")} aria-busy={isLoading || creating ? "true" : "false"}>
      <div className="drawer-viewtabs" role="tablist" aria-label={t("chat.menu.label")}>
        <button type="button" role="tab" aria-selected={isConversationView ? "true" : "false"} data-active={isConversationView ? "true" : "false"} onClick={() => setActiveView("conversations")} disabled={isLoading}>
          {t("chat.sidebar.sections.conversations")}
        </button>
        <button type="button" role="tab" aria-selected={!isConversationView ? "true" : "false"} data-active={!isConversationView ? "true" : "false"} onClick={() => setActiveView("groups")} disabled={isLoading}>
          {t("chat.sidebar.sections.groups")}
        </button>
      </div>
      {isConversationView ? <div className="drawer-actions">
        <Button className="drawer-new" variant="primary" size="md" onClick={onNew} disabled={busy || creating} aria-busy={creating ? "true" : "false"}>
          {creating ? t("chat.sidebar.button.creating") : t("chat.sidebar.button.new_short")}
        </Button>
        <Button variant="primary" size="md" onClick={toggleSelectMode} disabled={isActionBusy}>
          {selectMode ? t("chat.sidebar.selection.cancel") : t("chat.sidebar.selection.select")}
        </Button>
      </div> : null}
      {isConversationView ? <div>
          <div>
            <input id="chat-sidebar-search" name="chat-sidebar-search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder={t("chat.sidebar.search.placeholder", "Otsi vestlusi...")} aria-label={t("chat.sidebar.search.label", "Otsi vestlusi")} />
          </div>
        </div> : null}
      {selectMode && isConversationView ? <div className="drawer-actions">
          <Button variant="primary" size="md" onClick={handleDeleteSelected} disabled={!selectedCount || isActionBusy}>
            {t("chat.sidebar.selection.delete_selected")}
          </Button>
          <Button variant="primary" size="md" onClick={handleDeleteAll} disabled={isActionBusy}>
            {t("chat.sidebar.selection.delete_all")}
          </Button>
        </div> : null}
      {error ? <div role="alert" aria-live="assertive">
          {error}
          {isConversationView ? <Button type="button" size="sm" variant="ghost" onClick={() => fetchList({ reset: true })} disabled={busy}>
              {t("chat.sidebar.search.retry", "Proovi uuesti")}
            </Button> : null}
        </div> : null}
      <div>
        <div aria-label={isConversationView ? t("chat.sidebar.sections.conversations") : t("chat.sidebar.sections.groups")}>
          <div>
            {listState === LIST_STATE.LOADING ? <div>
                {renderLoadingSkeleton(isConversationView ? "conv" : "room", isConversationView ? 3 : 2)}
              </div> : <ul>
                {listState === LIST_STATE.NO_MATCHES || listState === LIST_STATE.EMPTY ? <li>
                    <span>{listState === LIST_STATE.NO_MATCHES ? t("chat.sidebar.search.no_matches", "Otsingule vastavaid vestlusi ei leitud.") : isConversationView ? t("chat.sidebar.empty") : t("rooms.empty")}</span>
                  </li> : currentItems.map(renderListItem)}
              </ul>}
          </div>
          {isConversationView && hasMore ? <div>
              <button type="button" onClick={fetchMore} disabled={busy || creating} aria-label={t("chat.sidebar.button.more")} title={t("chat.sidebar.button.more")} />
            </div> : null}
        </div>
      </div>
    </nav>
    {confirmState ? <ModalConfirm
      message={confirmMessage}
      confirmLabel={t("buttons.delete")}
      cancelLabel={t("buttons.cancel")}
      confirmVariant="danger"
      cancelVariant="primary"
      onConfirm={handleConfirmDelete}
      onCancel={handleConfirmCancel}
    /> : null}
  </>;

}
