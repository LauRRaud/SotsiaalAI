import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { pushWithTransition } from "@/lib/routeTransition";
import { localizePath } from "@/lib/localizePath";

const ROLL_MS = 560;

export function useChatProfileRoll({
  embedded,
  router,
  locale,
  showSourcesPanel,
  setShowSourcesPanel,
  setInputFocused,
  inputRef,
  waitForComposerCollapse
}) {
  const searchParams = useSearchParams();
  const initialProfileOpen = embedded && searchParams?.get("profile") === "1";
  const [profileOpen, setProfileOpen] = useState(() => initialProfileOpen);
  const [_rollDirection, setRollDirection] = useState("right");
  const [isRolling, setIsRolling] = useState(false);
  const rollTimerRef = useRef(null);
  const rollSwapTimerRef = useRef(null);
  const pendingTransitionRef = useRef(false);

  const prepareForProfileTransition = useCallback(async () => {
    if (showSourcesPanel) setShowSourcesPanel(false);
    if (typeof waitForComposerCollapse === "function") {
      await waitForComposerCollapse();
      return;
    }
    setInputFocused(false);
    try {
      inputRef.current?.blur?.();
    } catch {}
  }, [inputRef, setInputFocused, setShowSourcesPanel, showSourcesPanel, waitForComposerCollapse]);

  const syncProfileUrl = useCallback(open => {
    if (!embedded || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (open) {
      url.searchParams.set("profile", "1");
    } else {
      url.searchParams.delete("profile");
    }
    window.history.replaceState({
      profileOpen: open
    }, "", `${url.pathname}${url.search}${url.hash}`);
  }, [embedded]);

  const triggerRoll = useCallback(async (direction, open) => {
    if (isRolling || pendingTransitionRef.current) return;
    pendingTransitionRef.current = true;
    try {
      await prepareForProfileTransition();
      setRollDirection(direction);
      setIsRolling(true);
    } finally {
      pendingTransitionRef.current = false;
    }
    if (rollSwapTimerRef.current) window.clearTimeout(rollSwapTimerRef.current);
    const swapDelay = Math.round(ROLL_MS * 0.35);
    rollSwapTimerRef.current = window.setTimeout(() => {
      setProfileOpen(open);
      syncProfileUrl(open);
    }, swapDelay);
    if (rollTimerRef.current) window.clearTimeout(rollTimerRef.current);
    rollTimerRef.current = window.setTimeout(() => setIsRolling(false), ROLL_MS);
  }, [isRolling, prepareForProfileTransition, syncProfileUrl]);

  const openProfile = useCallback(async () => {
    if (pendingTransitionRef.current) return;
    pendingTransitionRef.current = true;
    try {
      if (!embedded) {
        await prepareForProfileTransition();
        window.requestAnimationFrame(() => {
          pushWithTransition(router, localizePath("/profiil", locale));
        });
        return;
      }
    } finally {
      pendingTransitionRef.current = false;
    }
    void triggerRoll("right", true);
  }, [embedded, locale, prepareForProfileTransition, router, triggerRoll]);

  const openProfileDirect = useCallback(async (options = {}) => {
    const { withTilt = true } = options;
    if (pendingTransitionRef.current) return;
    pendingTransitionRef.current = true;
    try {
      if (!embedded) {
        await prepareForProfileTransition();
        if (withTilt) {
          pushWithTransition(router, localizePath("/profiil", locale));
        } else {
          pushWithTransition(router, localizePath("/profiil", locale));
        }
        return;
      }
      await prepareForProfileTransition();
      if (rollSwapTimerRef.current) window.clearTimeout(rollSwapTimerRef.current);
      if (rollTimerRef.current) window.clearTimeout(rollTimerRef.current);
      setIsRolling(false);
      setRollDirection("right");
      setProfileOpen(true);
      syncProfileUrl(true);
    } finally {
      pendingTransitionRef.current = false;
    }
  }, [embedded, locale, prepareForProfileTransition, router, syncProfileUrl]);

  const closeProfile = useCallback(() => {
    if (!embedded) return;
    void triggerRoll("left", false);
  }, [embedded, triggerRoll]);

  const toggleProfile = useCallback(() => {
    if (profileOpen) {
      closeProfile();
      return;
    }
    openProfile();
  }, [closeProfile, openProfile, profileOpen]);

  useEffect(() => {
    if (!embedded || typeof document === "undefined") return;
    document.body.classList.toggle("home-profile-open", profileOpen);
    return () => document.body.classList.remove("home-profile-open");
  }, [embedded, profileOpen]);

  useEffect(() => {
    if (!embedded) return;
    const wantsProfile = searchParams?.get("profile") === "1";
    if (wantsProfile === profileOpen || isRolling) return;
    setProfileOpen(wantsProfile);
  }, [embedded, isRolling, profileOpen, searchParams]);

  useEffect(() => {
    return () => {
      if (rollSwapTimerRef.current) window.clearTimeout(rollSwapTimerRef.current);
      if (rollTimerRef.current) window.clearTimeout(rollTimerRef.current);
      pendingTransitionRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!embedded) return;
    const shouldOpen = searchParams?.get("profile") === "1";
    if (typeof shouldOpen !== "boolean") return;
    setProfileOpen(prev => {
      if (prev === shouldOpen) return prev;
      return shouldOpen;
    });
    if (shouldOpen) setRollDirection("right");
  }, [embedded, searchParams]);

  return {
    profileOpen,
    isRolling,
    openProfile,
    openProfileDirect,
    closeProfile,
    toggleProfile
  };
}
