"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { buildRoomChatPath } from "@/lib/roomPath";
import { pushWithTransition } from "@/lib/routeTransition";
import ModalConfirm from "@/components/ui/ModalConfirm";
import Panel from "@/components/ui/Panel";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";
import InviteModal from "@/components/invite/InviteModal";

export default function RoomsPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  usePanelInfoSlot({ infoId: "rooms", title: t("rooms.title") });
  const resolveErrorMessage = useCallback(
    (payload, fallbackKey) =>
      resolveApiMessage({
        payload,
        t,
        fallbackKey,
        fallbackText: typeof t === "function" ? t(fallbackKey) : fallbackKey
      }),
    [t]
  );

  const loadRequestRef = useRef(0);

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale || "et", {
        dateStyle: "medium",
        timeStyle: "short"
      }),
    [locale]
  );

  const roleLabel = useCallback(
    role => {
      const map = {
        OWNER: t("rooms.role.owner"),
        MODERATOR: t("rooms.role.moderator"),
        MEMBER: t("rooms.role.member"),
        ADMIN: t("rooms.role.admin")
      };
      return map[role] || role || "";
    },
    [t]
  );

  const formatTime = useCallback(
    value => {
      if (!value) return "";
      try {
        return timeFormatter.format(new Date(value));
      } catch {
        return "";
      }
    },
    [timeFormatter]
  );

  const handleInvite = useCallback(roomId => {
    if (!roomId) return;
    try {
      window.dispatchEvent(
        new CustomEvent("sotsiaalai:open-invite", {
          detail: { roomId }
        })
      );
    } catch {}
  }, []);

  const handleLeave = useCallback(
    async room => {
      if (!room?.id) return;
      setPendingAction({ roomId: room.id, action: "leave" });
      setActionError(null);
      try {
        const res = await fetch(
          `/api/rooms/${encodeURIComponent(room.id)}/leave`,
          {
            method: "POST"
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false) {
          throw new Error(resolveErrorMessage(data, "rooms.leave_failed"));
        }
        setRooms(prev => prev.filter(r => r.id !== room.id));
      } catch (err) {
        setActionError({
          roomId: room.id,
          action: "leave",
          message: err instanceof Error ? err.message : t("rooms.leave_failed")
        });
      } finally {
        setPendingAction(null);
      }
    },
    [resolveErrorMessage, t]
  );

  const openRoomConfirm = useCallback((room, action) => {
    if (!room?.id) return;
    setActionError(null);
    setConfirmAction({ room, action });
  }, []);

  const closeRoomConfirm = useCallback(() => {
    if (pendingAction) return;
    setActionError(null);
    setConfirmAction(null);
  }, [pendingAction]);

  const confirmRoomMutation = useCallback(
    async () => {
      const target = confirmAction?.room;
      const action = confirmAction?.action;
      if (!target?.id || !["archive", "delete"].includes(action)) return;
      setPendingAction({ roomId: target.id, action });
      setActionError(null);
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(target.id)}`, {
          method: action === "archive" ? "PATCH" : "DELETE",
          headers: action === "archive" ? { "Content-Type": "application/json" } : undefined,
          body: action === "archive" ? JSON.stringify({ action: "archive" }) : undefined
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false) {
          const fallbackKey = action === "archive" ? "rooms.archive_failed" : "rooms.delete_failed";
          const error = new Error(resolveErrorMessage(data, fallbackKey));
          error.payload = data;
          throw error;
        }
        if (action === "archive") {
          setRooms(prev => prev.map(room => room.id === target.id
            ? {
                ...room,
                archivedAt: data?.room?.archivedAt || new Date().toISOString(),
                canDelete: false,
                canArchive: false,
                canInvite: false,
                canTransfer: false
              }
            : room));
        } else {
          setRooms(prev => prev.filter(r => r.id !== target.id));
        }
        setConfirmAction(null);
      } catch (err) {
        const message = err instanceof Error
          ? err.message
          : t(action === "archive" ? "rooms.archive_failed" : "rooms.delete_failed");
        setActionError({ roomId: target.id, action, message });
        if (action === "delete" && err?.payload?.canArchive === true) {
          const archivableRoom = {
            ...target,
            canDelete: false,
            canArchive: true
          };
          setRooms(prev => prev.map(room => room.id === target.id ? archivableRoom : room));
          setConfirmAction({ room: archivableRoom, action: "archive" });
        }
      } finally {
        setPendingAction(null);
      }
    },
    [confirmAction, resolveErrorMessage, t]
  );

  const loadRooms = useCallback(async () => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/rooms", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(resolveErrorMessage(data, "rooms.error"));
      }
      if (loadRequestRef.current === requestId) {
        setRooms(Array.isArray(data.rooms) ? data.rooms : []);
      }
    } catch (err) {
      if (loadRequestRef.current === requestId) {
        setLoadError(err instanceof Error ? err.message : t("rooms.error"));
      }
    } finally {
      if (loadRequestRef.current === requestId) setLoading(false);
    }
  }, [resolveErrorMessage, t]);

  useEffect(() => {
    void loadRooms();
    const onExternalRefresh = () => {
      void loadRooms();
    };
    window.addEventListener("sotsiaalai:refresh-conversations", onExternalRefresh);
    return () => {
      loadRequestRef.current += 1;
      window.removeEventListener("sotsiaalai:refresh-conversations", onExternalRefresh);
    };
  }, [loadRooms]);

  const visibleRooms = useMemo(
    () =>
      rooms.filter(room => {
        if (!room?.id) return false;
        const title = (room.title || "").toLowerCase();
        const hasContent = Boolean(
          room?.description || room?.lastMessage?.content || room?.unreadCount
        );
        if (!hasContent && (title === "vestlusruum" || title === "ruum")) {
          return false;
        }
        return true;
      }),
    [rooms]
  );

  const effectiveRooms = useMemo(() => {
    if (
      visibleRooms.length === 1 &&
      (visibleRooms[0].title || "").toLowerCase() === "vestlusruum" &&
      !visibleRooms[0].description &&
      !visibleRooms[0].lastMessage &&
      !visibleRooms[0].unreadCount
    ) {
      return [];
    }
    return visibleRooms;
  }, [visibleRooms]);

  return (
    <>
      <section className="feature-page feature-page--rooms" data-dock-scroll-behavior="recede">
        <div className="feature-page__surface rooms-page" role="region" aria-label={t("rooms.aria")}>
          {loadError && effectiveRooms.length > 0 ? (
            <div role="alert">
              <p>{loadError}</p>
              <button type="button" onClick={() => void loadRooms()}>
                {t("rooms.retry")}
              </button>
            </div>
          ) : null}

          <div className="rooms-page__viewport">
            <div
              className="rooms-page__scroller"
              tabIndex={0}
              aria-label={t("rooms.title")}
            >
              <div className="rooms-page__header">
                <h1>
                  {t("rooms.title")}
                </h1>
              </div>

              {loading && effectiveRooms.length === 0 ? (
                <div className="rooms-step">
                  <Panel variant="subpage" padding="sm" aria-busy="true">
                    <p>
                      {t("rooms.loading")}
                    </p>
                  </Panel>
                </div>
              ) : loadError && effectiveRooms.length === 0 ? (
                <div className="rooms-step">
                  <Panel variant="subpage" padding="sm">
                    <div role="alert">
                      <p>{loadError}</p>
                      <button type="button" onClick={() => void loadRooms()}>
                        {t("rooms.retry")}
                      </button>
                    </div>
                  </Panel>
                </div>
              ) : effectiveRooms.length === 0 ? (
                <div className="rooms-step">
                  <Panel variant="subpage" padding="sm">
                    <p>
                      {t("rooms.empty")}
                    </p>
                  </Panel>
                </div>
              ) : (
                <ul className="rooms-list">
                  {effectiveRooms.map(room => {
                    const canInviteRoom = room.canInvite === true;
                    const canLeaveRoom = room.canLeave === true;
                    const canDeleteRoom = room.canDelete === true;
                    const canArchiveRoom = room.canArchive === true;
                    const hasRoomActions =
                      canInviteRoom || canLeaveRoom || canDeleteRoom || canArchiveRoom;
                    const roomPending = pendingAction?.roomId === room.id;
                    const roomError = actionError?.roomId === room.id ? actionError : null;
                    const formattedLastActivity = room.lastMessage?.createdAt
                      ? formatTime(room.lastMessage.createdAt)
                      : "";
                    const roomChatPath = buildRoomChatPath(room.id, locale, {
                      isHelpMatchRoom: room.isHelpMatchRoom === true
                    });

                    return (
                      <li
                        key={room.id}
                        className="rooms-step"
                      >
                        <article className="room-list-card">
                          <Link
                            className="room-list-card__main"
                            prefetch={false}
                            href={roomChatPath}
                            onClick={event => {
                              if (event.defaultPrevented) return;
                              if (
                                event.metaKey ||
                                event.ctrlKey ||
                                event.shiftKey ||
                                event.altKey
                              ) {
                                return;
                              }
                              if (event.button !== 0) return;
                              event.preventDefault();
                              pushWithTransition(
                                router,
                                roomChatPath
                              );
                            }}
                          >
                            <div className="room-list-card__content">
                              <div className="room-list-card__title">
                                <h2>
                                  {room.title || t("rooms.fallback_title")}
                                </h2>
                                {room.unreadCount ? (
                                    <span
                                      aria-label={`${t("rooms.unread")}: ${room.unreadCount}`}
                                    >
                                      <span>{room.unreadCount}</span>
                                    </span>
                                ) : null}
                              </div>

                              <div className="room-list-card__meta">
                                {room.role ? (
                                  <span>
                                    {t("rooms.role_label")}: {roleLabel(room.role)}
                                  </span>
                                ) : null}
                                {room.archivedAt ? (
                                  <span>{t("rooms.archived")}</span>
                                ) : null}
                                {Number.isFinite(room.memberCount) ? (
                                  <span>
                                    {t("rooms.members_label")}: {room.memberCount}
                                  </span>
                                ) : null}
                              </div>
                              {formattedLastActivity ? (
                                <time dateTime={room.lastMessage?.createdAt || undefined}>
                                  {formattedLastActivity}
                                </time>
                              ) : null}
                            </div>
                            <span className="room-list-card__arrow" aria-hidden="true" />
                          </Link>

                          {hasRoomActions ? (
                            <div className="room-list-card__actions">
                                  {canInviteRoom ? (
                                    <button
                                      type="button"
                                      className="room-list-card__action room-list-card__action--invite"
                                      onClick={() => handleInvite(room.id)}
                                    >
                                      {t("rooms.invite")}
                                    </button>
                                  ) : null}
                                  {canLeaveRoom ? (
                                    <button
                                      type="button"
                                      className="room-list-card__action room-list-card__action--leave"
                                      onClick={() => handleLeave(room)}
                                      disabled={roomPending}
                                    >
                                      {pendingAction?.roomId === room.id && pendingAction?.action === "leave"
                                        ? t("rooms.leave_busy")
                                        : t("rooms.leave")}
                                    </button>
                                  ) : null}
                                  {canArchiveRoom ? (
                                    <button
                                      type="button"
                                      className="room-list-card__action room-list-card__action--archive"
                                      onClick={() => openRoomConfirm(room, "archive")}
                                      disabled={roomPending}
                                    >
                                      {t("rooms.archive")}
                                    </button>
                                  ) : null}
                                  {canDeleteRoom ? (
                                    <button
                                      type="button"
                                      className="room-list-card__action room-list-card__action--delete"
                                      onClick={() => openRoomConfirm(room, "delete")}
                                      disabled={roomPending}
                                      aria-label={t("rooms.delete")}
                                    >
                                      <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.82"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                      >
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                        <path d="M10 11v6" />
                                        <path d="M14 11v6" />
                                        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                                      </svg>
                                      <span>{t("rooms.delete")}</span>
                                    </button>
                                  ) : null}
                            </div>
                          ) : null}
                          {roomError && !confirmAction ? (
                            <div role="alert">
                              <p>{roomError.message}</p>
                              <button
                                type="button"
                                onClick={() => roomError.action === "leave"
                                  ? void handleLeave(room)
                                  : openRoomConfirm(room, roomError.action)}
                              >
                                {t("rooms.retry")}
                              </button>
                            </div>
                          ) : null}
                        </article>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      {confirmAction ? (
        <ModalConfirm
          message={t(confirmAction.action === "archive" ? "rooms.archive_confirm" : "rooms.delete_confirm").replace(
            "{name}",
            confirmAction.room.title || t("rooms.fallback_title")
          )}
          confirmLabel={
            pendingAction?.roomId === confirmAction.room.id
              ? t(confirmAction.action === "archive" ? "rooms.archive_busy" : "rooms.delete_busy")
              : t(confirmAction.action === "archive" ? "rooms.archive" : "rooms.delete")
          }
          cancelLabel={t("rooms.cancel")}
          confirmVariant={confirmAction.action === "archive" ? "primary" : "danger"}
          cancelVariant="primary"
          onConfirm={confirmRoomMutation}
          onCancel={closeRoomConfirm}
          disabled={pendingAction?.roomId === confirmAction.room.id}
        >
          {actionError?.roomId === confirmAction.room.id ? (
            <div role="alert">
              <p>{actionError.message}</p>
              <span>{t("rooms.retry_hint")}</span>
            </div>
          ) : null}
        </ModalConfirm>
      ) : null}

      <InviteModal />
    </>
  );
}
