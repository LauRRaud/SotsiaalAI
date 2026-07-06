"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { localizePath } from "@/lib/localizePath";
import { buildRoomChatPath } from "@/lib/roomPath";
import { pushWithTransition } from "@/lib/routeTransition";
import ModalConfirm from "@/components/ui/ModalConfirm";
import Panel from "@/components/ui/Panel";
import InviteModal from "@/components/invite/InviteModal";
import BackButton from "@/components/ui/BackButton";
import CenteredScrollPicker from "@/components/CenteredScrollPicker";

export default function RoomsPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
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

  const scrollRef = useRef(null);
  const initViewportModeRef = useRef(null);
  const initialScrollTopRef = useRef(0);
  const hasInitialScrollTopRef = useRef(false);

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [leavingId, setLeavingId] = useState(null);
  const [confirmRoom, setConfirmRoom] = useState(null);
  const [scrollPad, setScrollPad] = useState(0);
  const [scrollPadTop, setScrollPadTop] = useState(0);
  const [scrollPadBottom, setScrollPadBottom] = useState(0);
  const [, setIsScrolled] = useState(false);
  const [hasUserStartedScroll, setHasUserStartedScroll] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

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

  const canInvite = useCallback(
    role => role === "OWNER" || role === "MODERATOR",
    []
  );
  const canLeave = useCallback(
    role => role === "MEMBER" || role === "MODERATOR",
    []
  );
  const canDelete = useCallback(
    role => role === "OWNER" || role === "ADMIN",
    []
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
      setLeavingId(room.id);
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
        console.warn("Room leave failed:", err);
      } finally {
        setLeavingId(null);
      }
    },
    [resolveErrorMessage]
  );

  const openDeleteConfirm = useCallback(room => {
    if (!room?.id) return;
    setConfirmRoom(room);
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    if (deletingId) return;
    setConfirmRoom(null);
  }, [deletingId]);

  const confirmDelete = useCallback(
    async room => {
      const target = room?.id ? room : confirmRoom;
      if (!target?.id) return;
      setDeletingId(target.id);
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(target.id)}`, {
          method: "DELETE"
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false) {
          throw new Error(resolveErrorMessage(data, "rooms.delete_failed"));
        }
        setRooms(prev => prev.filter(r => r.id !== target.id));
      } catch (err) {
        console.warn("Room delete failed:", err);
      } finally {
        setDeletingId(null);
        setConfirmRoom(null);
      }
    },
    [confirmRoom, resolveErrorMessage]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/rooms", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false) {
          throw new Error(resolveErrorMessage(data, "rooms.error"));
        }
        if (!cancelled) {
          setRooms(Array.isArray(data.rooms) ? data.rooms : []);
        }
      } catch (err) {
        if (!cancelled) {
          setRooms([]);
        }
        console.warn("Rooms load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const onExternalRefresh = () => {
      void load();
    };
    window.addEventListener("sotsiaalai:refresh-conversations", onExternalRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener("sotsiaalai:refresh-conversations", onExternalRefresh);
    };
  }, [resolveErrorMessage, t]);

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

  const {
    getItemClassName,
    scrollToIndex
  } = CenteredScrollPicker({
    containerRef: scrollRef,
    itemSelector: ".rooms-step",
    neighborDistance: isMobileViewport ? 2 : 1,
    lockWheelToSteps: !isMobileViewport,
    settleOnScroll: false,
    enableArrowKeys: true,
    captureArrowKeys: true,
    settleMs: isMobileViewport ? 420 : 360,
    maxStepPerSettle: isMobileViewport ? 99 : 1,
    wheelCooldownMs: isMobileViewport ? 300 : 340,
    minWheelDelta: isMobileViewport ? 10 : 16,
    manageHiddenFocus: !isMobileViewport,
    pauseSettleWhileTouch: isMobileViewport
  });

  const getRoomStepClassName = index => getItemClassName(index);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobileViewport(query.matches);
    apply();
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", apply);
      return () => query.removeEventListener("change", apply);
    }
    query.addListener(apply);
    return () => query.removeListener(apply);
  }, []);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || typeof window === "undefined") return;

    const updatePad = () => {
      const steps = Array.from(scrollEl.querySelectorAll(".rooms-step"));
      const firstStep = steps[0] || null;
      const lastStep = steps[steps.length - 1] || firstStep;
      if (!firstStep || !lastStep) return;

      const firstH = firstStep.getBoundingClientRect().height || 0;
      const lastH = lastStep.getBoundingClientRect().height || 0;
      const viewH = Math.max(0, scrollEl.clientHeight || 0);
      if (!viewH || !firstH || !lastH) return;

      const nextPadTopBase = Math.max(0, Math.floor((viewH - firstH) / 2));
      const nextPadBottomBase = Math.max(0, Math.floor((viewH - lastH) / 2));
      const nextPad = nextPadTopBase;
      setScrollPad(prev => (prev === nextPad ? prev : nextPad));

      const liftPx = isMobileViewport ? 4 : 9;
      const nextTop = Math.max(0, nextPadTopBase - liftPx);
      const nextBottom = Math.max(0, nextPadBottomBase + liftPx);
      setScrollPadTop(prev => (prev === nextTop ? prev : nextTop));
      setScrollPadBottom(prev => (prev === nextBottom ? prev : nextBottom));
    };

    updatePad();
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updatePad)
        : null;
    ro?.observe(scrollEl);
    window.addEventListener("resize", updatePad);
    return () => {
      ro?.disconnect?.();
      window.removeEventListener("resize", updatePad);
    };
  }, [isMobileViewport, loading, effectiveRooms.length]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || typeof window === "undefined") return;

    const mode = isMobileViewport ? "mobile" : "desktop";
    if (initViewportModeRef.current === mode) return;
    initViewportModeRef.current = mode;

    const resetToFirstStep = () => {
      if (!isMobileViewport) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
      scrollEl.scrollTop = 0;
      scrollToIndex(0, "auto");
      setIsScrolled(false);
      setHasUserStartedScroll(false);
      hasInitialScrollTopRef.current = true;
      initialScrollTopRef.current = scrollEl.scrollTop || 0;
    };

    resetToFirstStep();
    const rafA = requestAnimationFrame(resetToFirstStep);
    const rafB = requestAnimationFrame(() =>
      requestAnimationFrame(resetToFirstStep)
    );
    const settleTimer = window.setTimeout(resetToFirstStep, 120);
    return () => {
      cancelAnimationFrame(rafA);
      cancelAnimationFrame(rafB);
      window.clearTimeout(settleTimer);
    };
  }, [scrollToIndex, isMobileViewport]);

  useEffect(() => {
    if (hasUserStartedScroll) return;
    const scrollEl = scrollRef.current;
    if (!scrollEl || typeof window === "undefined") return;
    const alignToFirst = () => {
      scrollToIndex(0, "auto");
      setIsScrolled(false);
      hasInitialScrollTopRef.current = true;
      initialScrollTopRef.current = scrollEl.scrollTop || 0;
    };
    const raf = requestAnimationFrame(alignToFirst);
    return () => cancelAnimationFrame(raf);
  }, [scrollPadTop, scrollPadBottom, hasUserStartedScroll, scrollToIndex]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || typeof window === "undefined") return;
    const onScroll = () => {
      const top = scrollEl.scrollTop || 0;
      if (!hasInitialScrollTopRef.current) {
        hasInitialScrollTopRef.current = true;
        initialScrollTopRef.current = top;
      }
      const delta = Math.abs(top - initialScrollTopRef.current);
      const thresholdOn = isMobileViewport ? 14 : 8;
      const thresholdOff = isMobileViewport ? 9 : 5;
      if (delta > thresholdOn) {
        setHasUserStartedScroll(prev => prev || true);
      }
      setIsScrolled(prev => {
        const next = prev ? delta > thresholdOff : delta > thresholdOn;
        return prev === next ? prev : next;
      });
    };
    onScroll();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
    };
  }, [isMobileViewport]);

  useEffect(() => {
    if (loading) return;
    const scrollEl = scrollRef.current;
    if (!scrollEl || typeof window === "undefined") return;
    const raf = requestAnimationFrame(() => {
      scrollEl.scrollTop = 0;
      scrollToIndex(0, "auto");
      setIsScrolled(false);
      setHasUserStartedScroll(false);
      hasInitialScrollTopRef.current = true;
      initialScrollTopRef.current = scrollEl.scrollTop || 0;
    });
    return () => cancelAnimationFrame(raf);
  }, [loading, effectiveRooms.length, scrollToIndex]);

  return (
    <>
      <section>
        <div role="region" aria-label={t("rooms.aria")}>
          <BackButton
            onClick={() => pushWithTransition(router, localizePath("/vestlus", locale))}
            ariaLabel={t("rooms.back_to_chats")}
            holdPressedVisualDisabled
          />

          <div>
            <h1>
              {t("rooms.title")}
            </h1>
          </div>

          <div>
            <div
              ref={scrollRef}
              style={{
                "--csp-pad-top": `${Math.max(0, scrollPadTop || scrollPad)}px`,
                "--csp-pad-bottom": `${Math.max(
                  0,
                  scrollPadBottom || scrollPad
                )}px`,
                "--csp-center-offset": `${isMobileViewport ? -4 : -9}px`
              }}
              tabIndex={0}
              aria-label={t("rooms.title")}
            >
              {loading ? (
                <div className="rooms-step">
                  <Panel variant="subpage" padding="sm" aria-busy="true">
                    <p>
                      {t("rooms.loading")}
                    </p>
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
                <ul>
                  {effectiveRooms.map((room, index) => {
                    const canInviteRoom = canInvite(room.role);
                    const canLeaveRoom = canLeave(room.role);
                    const canDeleteRoom = canDelete(room.role);
                    const hasRoomActions =
                      canInviteRoom || canLeaveRoom || canDeleteRoom;
                    const formattedLastActivity = room.lastMessage?.createdAt
                      ? formatTime(room.lastMessage.createdAt)
                      : "";
                    const roomChatPath = buildRoomChatPath(room.id, locale, {
                      isHelpMatchRoom: room.isHelpMatchRoom === true
                    });

                    return (
                      <li
                        key={room.id}
                        className={`rooms-step ${getRoomStepClassName(index)}`}
                      >
                        <article>
                          <Link
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
                            <div>
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

                            <div>
                              {room.role ? (
                                <span>
                                  {t("rooms.role_label")}: {roleLabel(room.role)}
                                </span>
                              ) : null}
                              {Number.isFinite(room.memberCount) ? (
                                <span>
                                  {t("rooms.members_label")}: {room.memberCount}
                                </span>
                              ) : null}
                            </div>
                          </Link>

                          {formattedLastActivity || hasRoomActions ? (
                            <div>
                              {formattedLastActivity ? (
                                <span>
                                  {formattedLastActivity}
                                </span>
                              ) : null}

                              {hasRoomActions ? (
                                <div>
                                  {canInviteRoom ? (
                                    <button
                                      type="button"
                                      onClick={() => handleInvite(room.id)}
                                    >
                                      {t("rooms.invite")}
                                    </button>
                                  ) : null}
                                  {canLeaveRoom ? (
                                    <button
                                      type="button"
                                      onClick={() => handleLeave(room)}
                                      disabled={leavingId === room.id}
                                    >
                                      {leavingId === room.id
                                        ? t("rooms.leave_busy")
                                        : t("rooms.leave")}
                                    </button>
                                  ) : null}
                                  {canDeleteRoom ? (
                                    <button
                                      type="button"
                                      onClick={() => openDeleteConfirm(room)}
                                      disabled={deletingId === room.id}
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
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
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

      {confirmRoom ? (
        <ModalConfirm
          message={t("rooms.delete_confirm").replace(
            "{name}",
            confirmRoom.title || t("rooms.fallback_title")
          )}
          confirmLabel={
            deletingId === confirmRoom.id ? t("rooms.delete_busy") : t("rooms.delete")
          }
          cancelLabel={t("rooms.cancel")}
          confirmVariant="danger"
          cancelVariant="primary"
          onConfirm={() => confirmDelete(confirmRoom)}
          onCancel={closeDeleteConfirm}
          disabled={deletingId === confirmRoom.id}
        />
      ) : null}

      <InviteModal />
    </>
  );
}
