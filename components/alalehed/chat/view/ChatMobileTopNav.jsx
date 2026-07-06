"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import BackButton from "@/components/ui/BackButton";
import { pushWithTransition } from "@/lib/routeTransition";
import { localizePath, stripLocaleFromPath } from "@/lib/localizePath";

const CHAT_CREATE_CONVERSATION_EVENT = "sotsiaalai:create-conversation";
const MOBILE_NAV_ITEMS = [
  { key: "chats", scale: 0.96 },
  { key: "new_chat", scale: 0.98 },
  { key: "profile", scale: 1.08 },
  { key: "rooms", scale: 1.02 },
  { key: "workspace", scale: 1.18 }
];

const DEFAULT_FOCUSED_KEY = "profile";
const FOCUS_CENTER_OFFSET_REM = -0.34;
const CHAT_SKIP_ENTRY_SETTLE_KEY = "sotsiaalai:chat:skip-entry-settle";
const DEFAULT_SLOT_PROFILE = Object.freeze({
  step1: 3.82,
  step2: 7.28,
  step3: 10.05,
  tailStep: 2.54,
  centerOffsetRem: FOCUS_CENTER_OFFSET_REM
});
const ANDROID_SLOT_PROFILE = Object.freeze({
  step1: 3.62,
  step2: 6.92,
  step3: 9.58,
  tailStep: 2.44,
  centerOffsetRem: -0.24
});
const COMPACT_ANDROID_SLOT_PROFILE = Object.freeze({
  step1: 3.18,
  step2: 6.12,
  step3: 8.46,
  tailStep: 2.12,
  centerOffsetRem: -0.16
});

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

function getSlotOffsetRem(slot, profile = DEFAULT_SLOT_PROFILE) {
  const direction = Math.sign(slot);
  const distance = Math.abs(slot);
  const { step1, step2, step3, tailStep } = profile;
  if (distance === 0) {
    return 0;
  }
  if (distance === 1) {
    return direction * step1;
  }
  if (distance < 1) {
    return direction * (step1 * distance);
  }
  if (distance < 2) {
    return direction * (step1 + (distance - 1) * (step2 - step1));
  }
  if (distance < 3) {
    return direction * (step2 + (distance - 2) * (step3 - step2));
  }
  return direction * (step3 + (distance - 3) * tailStep);
}

function MobileIconFrame({ scale = 1, xNudge = 0, children }) {
  return (
    <span
      style={{ transform: `translateX(${xNudge}rem) scale(${scale})` }}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

function getItemIndex(key) {
  const index = MOBILE_NAV_ITEMS.findIndex(item => item.key === key);
  return index >= 0 ? index : 0;
}

function getVisualScale(distance) {
  if (distance <= 1) {
    return 1.22 - distance * 0.34;
  }
  if (distance <= 2) {
    return 0.88 - (distance - 1) * 0.12;
  }
  return 0.76;
}

function getVisualOpacity(distance) {
  if (distance <= 1) {
    return 1 - distance * 0.14;
  }
  if (distance <= 2) {
    return 0.94 - (distance - 1) * 0.28;
  }
  return 0.66;
}

function getEdgeFadeOpacity(distance) {
  if (distance <= 2.25) {
    return 1;
  }
  if (distance >= 2.9) {
    return 0;
  }
  return 1 - (distance - 2.25) / 0.65;
}

function getTopNavButtonTargetKey(target) {
  if (!(target instanceof Element)) return "";
  return target.closest("[data-chat-mobile-topnav-button='1']")?.getAttribute("data-key") || "";
}

export default function ChatMobileTopNav({
  t,
  locale,
  isLightTheme,
  embedded = false,
  handleBackHome,
  mobileRailInteractionLocked,
  leftRailActiveKey,
  rightRailActiveKey,
  toggleProfile,
  openProfileDirect,
  workspaceOpen = false,
  onWorkspaceToggle
}) {
  const router = useRouter();
  const pathname = usePathname();
  const itemButtonRefs = useRef({});
  const suppressClickUntilRef = useRef(0);
  const swipeSurfaceRef = useRef(null);
  const focusedIndexRef = useRef(getItemIndex(DEFAULT_FOCUSED_KEY));
  const previousActiveKeyRef = useRef(null);
  const dragStateRef = useRef({
    pointerId: null,
    touchId: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    moved: false,
    gestureAxis: null,
    cancelTap: false,
    startedOnButton: false
  });

  const [focusedIndex, setFocusedIndex] = useState(getItemIndex(DEFAULT_FOCUSED_KEY));
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAndroidPlatform, setIsAndroidPlatform] = useState(false);
  const [rootRemPx, setRootRemPx] = useState(16);
  const [viewportWidthPx, setViewportWidthPx] = useState(0);

  const setFocusedIndexImmediate = useCallback(nextValue => {
    if (typeof nextValue === "function") {
      setFocusedIndex(current => {
        const resolvedValue = nextValue(current);
        focusedIndexRef.current = resolvedValue;
        return resolvedValue;
      });
      return;
    }

    focusedIndexRef.current = nextValue;
    setFocusedIndex(nextValue);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let suppressOnEntry = false;
    try {
      suppressOnEntry =
        window.sessionStorage.getItem(CHAT_SKIP_ENTRY_SETTLE_KEY) === "1";
      if (suppressOnEntry) {
        window.sessionStorage.removeItem(CHAT_SKIP_ENTRY_SETTLE_KEY);
      }
    } catch {}
    if (!suppressOnEntry) return;
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    suppressClickUntilRef.current = now + 700;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updatePlatformMetrics = () => {
      const platformFlag =
        document.documentElement?.getAttribute("data-platform") ||
        document.body?.getAttribute("data-platform") ||
        "";
      const ua = window.navigator?.userAgent || "";
      setIsAndroidPlatform(platformFlag === "android" || /android/i.test(ua));
      const nextRootRem = parseFloat(
        window.getComputedStyle(document.documentElement).fontSize || "16"
      );
      setRootRemPx(Number.isFinite(nextRootRem) && nextRootRem > 0 ? nextRootRem : 16);
      const viewportWidth =
        window.visualViewport?.width ||
        window.innerWidth ||
        document.documentElement?.clientWidth ||
        0;
      setViewportWidthPx(
        Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 0
      );
    };
    updatePlatformMetrics();
    window.addEventListener("resize", updatePlatformMetrics);
    window.visualViewport?.addEventListener("resize", updatePlatformMetrics);
    return () => {
      window.removeEventListener("resize", updatePlatformMetrics);
      window.visualViewport?.removeEventListener("resize", updatePlatformMetrics);
    };
  }, []);

  const normalizedPathname = useMemo(
    () => stripLocaleFromPath(pathname || "/"),
    [pathname]
  );

  const isCompactAndroidViewport =
    isAndroidPlatform && viewportWidthPx > 0 && viewportWidthPx <= 430;
  const slotProfile = isCompactAndroidViewport
    ? COMPACT_ANDROID_SLOT_PROFILE
    : isAndroidPlatform
      ? ANDROID_SLOT_PROFILE
      : DEFAULT_SLOT_PROFILE;
  const slotStepPx = Math.max(1, slotProfile.step1 * rootRemPx);
  const centerOffsetRem = slotProfile.centerOffsetRem ?? FOCUS_CENTER_OFFSET_REM;
  const dragEngageThreshold = isAndroidPlatform ? 12 : 8;
  const maxSwipeSteps = isAndroidPlatform ? 1 : Number.POSITIVE_INFINITY;
  const dragDamping = isAndroidPlatform ? 0.72 : 1;
  const dragClampPx = isCompactAndroidViewport ? 138 : isAndroidPlatform ? 156 : 192;
  const navRailStyle = isCompactAndroidViewport
    ? {
        left: "calc(env(safe-area-inset-left,0px) + clamp(2.78rem,10.8vw,3.02rem))",
        right: "calc(env(safe-area-inset-right,0px) + 0.1rem)",
        top: "calc(var(--mobile-safe-top, env(safe-area-inset-top,0px)) + 0.12rem)",
        "--chat-mobile-topnav-button-size": "clamp(2.7rem,10.8vw,3.02rem)",
        "--chat-mobile-topnav-label-top": "4.46rem"
      }
    : isAndroidPlatform
    ? {
        left: "calc(env(safe-area-inset-left,0px) + 3.36rem)",
        right: "calc(env(safe-area-inset-right,0px) + 0.26rem)",
        top: "calc(var(--mobile-safe-top, env(safe-area-inset-top,0px)) + 0.18rem)",
        "--chat-mobile-topnav-button-size": "clamp(2.92rem,11.8vw,3.34rem)",
        "--chat-mobile-topnav-label-top": "4.62rem"
      }
    : {
        left: "calc(env(safe-area-inset-left,0px) + 3.68rem)",
        right: "calc(env(safe-area-inset-right,0px) + 0.34rem)",
        top: "calc(var(--mobile-safe-top, env(safe-area-inset-top,0px)) + 0.08rem)",
        "--chat-mobile-topnav-button-size": "clamp(2.86rem,11.4vw,3.28rem)",
        "--chat-mobile-topnav-label-top": "4.58rem"
      };

  const labels = useMemo(
    () => ({
      back: t("chat.back_to_home"),
      chats: t("nav.chats"),
      new_chat: t("chat.mobile.new_conversation"),
      rooms: t("nav.rooms"),
      profile: t("nav.profile"),
      workspace: t("nav.workspace", "Töölaud")
    }),
    [t]
  );

  const activeKey = leftRailActiveKey || rightRailActiveKey || "";

  useEffect(() => {
    const previousActiveKey = previousActiveKeyRef.current;
    previousActiveKeyRef.current = activeKey || "";
    if (previousActiveKey === null) {
      return;
    }
    if (!activeKey) return;
    setFocusedIndexImmediate(getItemIndex(activeKey));
  }, [activeKey, setFocusedIndexImmediate]);

  const openChatsDrawer = useCallback(
    event => {
      if (embedded || normalizedPathname.startsWith("/vestlus")) {
        event?.preventDefault?.();
        try {
          window.dispatchEvent(
            new CustomEvent("sotsiaalai:toggle-conversations", {
              detail: { open: true }
            })
          );
        } catch {}
        return;
      }
      pushWithTransition(router, localizePath("/vestlus", locale));
    },
    [embedded, locale, normalizedPathname, router]
  );

  const openNewConversation = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent(CHAT_CREATE_CONVERSATION_EVENT));
    } catch {}
  }, []);

  const openRooms = useCallback(() => {
    pushWithTransition(router, localizePath("/ruum", locale));
  }, [locale, router]);

  const handleActivate = useCallback(
    (key, event) => {
      if (key === "chats") {
        openChatsDrawer(event);
        return;
      }
      if (key === "new_chat") {
        openNewConversation();
        return;
      }
      if (key === "workspace") {
        onWorkspaceToggle?.();
        return;
      }
      if (key === "profile") {
        if (typeof openProfileDirect === "function") {
          openProfileDirect({ withTilt: false });
          return;
        }
        if (typeof toggleProfile === "function") {
          toggleProfile();
          return;
        }
        pushWithTransition(router, localizePath("/profiil", locale));
        return;
      }
      if (key === "rooms") {
        openRooms();
      }
    },
    [
      locale,
      onWorkspaceToggle,
      openChatsDrawer,
      openNewConversation,
      openProfileDirect,
      openRooms,
      router,
      toggleProfile
    ]
  );

  const handleItemActivation = useCallback(
    (key, event) => {
      setFocusedIndexImmediate(getItemIndex(key));
      handleActivate(key, event);
    },
    [handleActivate, setFocusedIndexImmediate]
  );

  const activateIndex = useCallback(
    (index, event) => {
      const item = MOBILE_NAV_ITEMS[index];
      if (!item) return;
      handleItemActivation(item.key, event);
    },
    [handleItemActivation]
  );

  const renderIcon = item => {
    if (item.key === "new_chat") {
      return (
        <MobileIconFrame scale={item.scale * 1.14} xNudge={0.06}>
          <span>
            <span>
              <svg
                aria-hidden="true"
                viewBox="0 0 42 42"
                focusable="false"
                fill="none"
              >
                <path
                  d="M21 8.75v24.5M8.75 21h24.5"
                  stroke="currentColor"
                  strokeWidth="5.2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </span>
        </MobileIconFrame>
      );
    }
    if (item.key === "workspace") {
      return (
        <MobileIconFrame scale={item.scale * (workspaceOpen ? 1.04 : 1)} />
      );
    }
    return (
      <MobileIconFrame scale={item.scale} />
    );
  };

  const handleTrackPointerEnd = useCallback(() => {
    const deltaX = dragStateRef.current.currentX - dragStateRef.current.startX;
    const absDeltaX = Math.abs(deltaX);
    if (absDeltaX >= dragEngageThreshold) {
      const baseIndex = focusedIndexRef.current;
      const effectiveDeltaX = clampNumber(deltaX * dragDamping, -dragClampPx, dragClampPx);
      const dragProgressAtRelease = effectiveDeltaX / slotStepPx;
      const minAllowedIndex = Number.isFinite(maxSwipeSteps)
        ? Math.max(0, baseIndex - maxSwipeSteps)
        : 0;
      const maxAllowedIndex = Number.isFinite(maxSwipeSteps)
        ? Math.min(MOBILE_NAV_ITEMS.length - 1, baseIndex + maxSwipeSteps)
        : MOBILE_NAV_ITEMS.length - 1;
      let nextIndex = baseIndex;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (let index = minAllowedIndex; index <= maxAllowedIndex; index += 1) {
        const slot = index - baseIndex;
        const distance = Math.abs(slot + dragProgressAtRelease);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nextIndex = index;
        }
      }
      setFocusedIndexImmediate(nextIndex);
    }
    dragStateRef.current.pointerId = null;
    dragStateRef.current.touchId = null;
    dragStateRef.current.moved = false;
    setDragOffsetPx(0);
    setIsDragging(false);
  }, [dragClampPx, dragDamping, dragEngageThreshold, maxSwipeSteps, setFocusedIndexImmediate, slotStepPx]);

  const resetSwipeState = useCallback(() => {
    dragStateRef.current.pointerId = null;
    dragStateRef.current.touchId = null;
    dragStateRef.current.moved = false;
    dragStateRef.current.gestureAxis = null;
    dragStateRef.current.cancelTap = false;
    dragStateRef.current.startedOnButton = false;
    dragStateRef.current.startedButtonKey = "";
    setDragOffsetPx(0);
    setIsDragging(false);
  }, []);

  const beginSwipe = useCallback((clientX, clientY, startedButtonKey = "") => {
    dragStateRef.current.startX = clientX;
    dragStateRef.current.startY = clientY;
    dragStateRef.current.currentX = clientX;
    dragStateRef.current.currentY = clientY;
    dragStateRef.current.moved = false;
    dragStateRef.current.gestureAxis = null;
    dragStateRef.current.cancelTap = false;
    dragStateRef.current.startedOnButton = Boolean(startedButtonKey);
    dragStateRef.current.startedButtonKey = startedButtonKey;
    setDragOffsetPx(0);
    setIsDragging(false);
  }, []);

  const moveSwipe = useCallback((clientX, clientY, event) => {
    const deltaX = clientX - dragStateRef.current.startX;
    const deltaY = clientY - dragStateRef.current.startY;
    dragStateRef.current.currentX = clientX;
    dragStateRef.current.currentY = clientY;

    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (!dragStateRef.current.gestureAxis) {
      const crossedX = absDeltaX > dragEngageThreshold;
      const crossedY = absDeltaY > dragEngageThreshold;

      if (!crossedX && !crossedY) {
        return;
      }

      if (crossedY && absDeltaY > absDeltaX * 1.12) {
        dragStateRef.current.gestureAxis = "y";
        dragStateRef.current.cancelTap = true;
        setDragOffsetPx(0);
        setIsDragging(false);
        return;
      }

      dragStateRef.current.gestureAxis = "x";
    }

    if (dragStateRef.current.gestureAxis !== "x") {
      return;
    }

    dragStateRef.current.moved = true;
    setIsDragging(true);
    setDragOffsetPx(
      Math.max(-dragClampPx, Math.min(dragClampPx, deltaX * dragDamping))
    );

    if (event?.cancelable) {
      event.preventDefault();
    }
  }, [dragClampPx, dragDamping, dragEngageThreshold]);

  const focusedItem = MOBILE_NAV_ITEMS[focusedIndex] || MOBILE_NAV_ITEMS[0];
  const dragProgress = dragOffsetPx / slotStepPx;
  const visibleItems = useMemo(() => {
    return MOBILE_NAV_ITEMS.map((item, index) => ({
      item,
      index,
      slot: index - focusedIndex
    }));
  }, [focusedIndex]);

  const previewFocusedItem = useMemo(() => {
    if (!visibleItems.length) return focusedItem;
    let nearestItem = visibleItems[0].item;
    let nearestDistance = Number.POSITIVE_INFINITY;

    visibleItems.forEach(({ item, slot }) => {
      const distance = Math.abs(slot + dragProgress);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestItem = item;
      }
    });

    return nearestItem;
  }, [dragProgress, focusedItem, visibleItems]);

  const getClosestVisibleIndex = useCallback(
    clientX => {
      const baseFocusedIndex = focusedIndexRef.current;
      if (visibleItems.length === 0) return baseFocusedIndex;
      let nearestIndex = baseFocusedIndex;
      let nearestDistance = Number.POSITIVE_INFINITY;

      visibleItems.forEach(({ item, index }) => {
        const button = itemButtonRefs.current[item.key];
        const rect = button?.getBoundingClientRect?.();
        if (!rect) return;
        const buttonCenterX = rect.left + rect.width / 2;
        const distance = Math.abs(clientX - buttonCenterX);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });

      return nearestIndex;
    },
    [visibleItems]
  );

  const finishSwipe = useCallback(
    (clientX, event) => {
      dragStateRef.current.currentX = clientX;
      if (dragStateRef.current.cancelTap || dragStateRef.current.gestureAxis === "y") {
        resetSwipeState();
        return;
      }
      if (dragStateRef.current.moved) {
        suppressClickUntilRef.current =
          typeof performance !== "undefined" ? performance.now() + 260 : Date.now() + 260;
        handleTrackPointerEnd();
        return;
      }
      const startedOnButton = dragStateRef.current.startedOnButton;
      const startedButtonKey = dragStateRef.current.startedButtonKey;
      resetSwipeState();
      if (startedOnButton) {
        if (startedButtonKey) {
          suppressClickUntilRef.current =
            typeof performance !== "undefined" ? performance.now() + 220 : Date.now() + 220;
          handleItemActivation(startedButtonKey, event);
        }
        return;
      }
      activateIndex(getClosestVisibleIndex(clientX), event);
    },
    [activateIndex, getClosestVisibleIndex, handleItemActivation, handleTrackPointerEnd, resetSwipeState]
  );

  const renderNavButton = (item, index) => {
    const isDisabled = false;

    const setButtonRef = element => {
      itemButtonRefs.current[item.key] = element;
    };

    return (
      <button
        key={item.key}
        ref={setButtonRef}
        type="button"
        data-key={item.key}
        data-chat-mobile-topnav-button="1"
        aria-label={labels[item.key]}
        aria-disabled={isDisabled ? "true" : undefined}
        onClick={event => {
          if (
            typeof performance !== "undefined" &&
            performance.now() < suppressClickUntilRef.current
          ) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          if (isDisabled) {
            event.preventDefault();
            event.stopPropagation();
            setFocusedIndexImmediate(index);
            return;
          }
          handleItemActivation(item.key, event);
        }}
        onFocus={() => setFocusedIndexImmediate(index)}
        onKeyDown={event => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            setFocusedIndexImmediate(current => Math.min(MOBILE_NAV_ITEMS.length - 1, current + 1));
            return;
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            setFocusedIndexImmediate(current => Math.max(0, current - 1));
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            handleItemActivation(item.key, event);
          }
        }}
      >
        {renderIcon(item)}
      </button>
    );
  };

  return (
    <div className={mobileRailInteractionLocked ? "pointer-events-none" : undefined}>
      <BackButton
        onClick={event => {
          handleBackHome?.(event);
        }}
        onKeyDown={event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            handleBackHome?.(event);
          }
        }}
        ariaLabel={labels.back}
      />

      <div style={navRailStyle}>
        <div
          ref={swipeSurfaceRef}
          className="relative"
          style={{ touchAction: "pan-x" }}
          onPointerDown={event => {
            if (event.pointerType === "touch") {
              return;
            }
            if (event.pointerType === "mouse" && event.button !== 0) {
              return;
            }
            swipeSurfaceRef.current?.setPointerCapture?.(event.pointerId);
            dragStateRef.current.pointerId = event.pointerId;
            beginSwipe(
              event.clientX,
              event.clientY,
              getTopNavButtonTargetKey(event.target)
            );
          }}
          onPointerMove={event => {
            if (event.pointerType === "touch") {
              return;
            }
            const pointerId = dragStateRef.current.pointerId;
            if (pointerId == null || event.pointerId !== pointerId) return;
            moveSwipe(event.clientX, event.clientY, event);
          }}
          onPointerUp={event => {
            if (event.pointerType === "touch") {
              return;
            }
            const pointerId = dragStateRef.current.pointerId;
            if (pointerId == null || event.pointerId !== pointerId) return;
            swipeSurfaceRef.current?.releasePointerCapture?.(event.pointerId);
            finishSwipe(event.clientX, event);
          }}
          onPointerCancel={event => {
            if (event.pointerType === "touch") {
              return;
            }
            const pointerId = dragStateRef.current.pointerId;
            if (pointerId == null || event.pointerId !== pointerId) return;
            swipeSurfaceRef.current?.releasePointerCapture?.(event.pointerId);
            resetSwipeState();
          }}
          onTouchStart={event => {
            const touch = event.changedTouches?.[0];
            if (!touch) return;
            dragStateRef.current.touchId = touch.identifier;
            beginSwipe(
              touch.clientX,
              touch.clientY,
              getTopNavButtonTargetKey(event.target)
            );
          }}
          onTouchMove={event => {
            const touchId = dragStateRef.current.touchId;
            if (touchId == null) return;
            const touch = Array.from(event.touches).find(currentTouch => currentTouch.identifier === touchId);
            if (!touch) return;
            moveSwipe(touch.clientX, touch.clientY, event);
          }}
          onTouchEnd={event => {
            const touchId = dragStateRef.current.touchId;
            if (touchId == null) return;
            const touch = Array.from(event.changedTouches).find(
              currentTouch => currentTouch.identifier === touchId
            );
            if (!touch) return;
            finishSwipe(touch.clientX, event);
          }}
          onTouchCancel={() => {
            resetSwipeState();
          }}
        >

          <div className="relative overflow-hidden">
            {visibleItems.map(({ item, index, slot }) => {
              const visualSlot = slot + dragProgress;
              const visualDistance = Math.abs(visualSlot);
              const xOffsetRem = getSlotOffsetRem(visualSlot, slotProfile);
              const combinedOpacity =
                getVisualOpacity(visualDistance) * getEdgeFadeOpacity(visualDistance);
              return (
                <div
                  key={item.key}
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{
                    transform: `translateX(${centerOffsetRem + xOffsetRem}rem) scale(${getVisualScale(visualDistance)})`,
                    opacity: combinedOpacity
                  }}
                >
                  {renderNavButton(item, index)}
                </div>
              );
            })}
          </div>

          <div
            className="pointer-events-none absolute left-1/2 top-[var(--chat-mobile-topnav-label-top)]"
            style={{ transform: `translateX(calc(-50% + ${centerOffsetRem}rem))` }}
          >
            <span>
              {labels[previewFocusedItem.key]}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
