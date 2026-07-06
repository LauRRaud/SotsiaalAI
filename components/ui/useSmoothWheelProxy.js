"use client";

import { useCallback, useEffect, useRef } from "react";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function wheelDeltaToPx(event, scrollEl) {
  const factor =
    event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scrollEl.clientHeight : 1;
  return {
    top: (event.deltaY || 0) * factor,
    left: (event.deltaX || 0) * factor,
  };
}

function preventDefaultIfCancelable(event) {
  if (event?.cancelable === false) return false;
  event?.preventDefault?.();
  return true;
}

export default function useSmoothWheelProxy({
  scrollRef,
  eventTargetRef,
  disabled = false,
  passthroughNativeTargets = true,
}) {
  const animationRef = useRef({
    raf: 0,
    targetTop: 0,
    targetLeft: 0,
  });

  useEffect(() => {
    const state = animationRef.current;
    return () => {
      if (typeof window === "undefined") return;
      if (!state.raf) return;
      window.cancelAnimationFrame(state.raf);
      state.raf = 0;
    };
  }, []);

  const handleWheel = useCallback((event) => {
    const scrollEl = scrollRef?.current;
    if (!scrollEl) return;
    if (event.defaultPrevented || event.ctrlKey || event.metaKey) return;
    if (passthroughNativeTargets && scrollEl.contains(event.target)) return;

    const maxTop = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
    const maxLeft = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
    if (maxTop <= 1 && maxLeft <= 1) return;

    const { top, left } = wheelDeltaToPx(event, scrollEl);
    if (!top && !left) return;
    if (!preventDefaultIfCancelable(event)) return;

    if (disabled || typeof window === "undefined") {
      scrollEl.scrollTop = clamp(scrollEl.scrollTop + top, 0, maxTop);
      scrollEl.scrollLeft = clamp(scrollEl.scrollLeft + left, 0, maxLeft);
      return;
    }

    const state = animationRef.current;
    if (!state.raf) {
      state.targetTop = scrollEl.scrollTop || 0;
      state.targetLeft = scrollEl.scrollLeft || 0;
    }
    state.targetTop = clamp(state.targetTop + top, 0, maxTop);
    state.targetLeft = clamp(state.targetLeft + left, 0, maxLeft);

    const tick = () => {
      const nextScrollEl = scrollRef?.current;
      if (!nextScrollEl) {
        state.raf = 0;
        return;
      }

      const dy = state.targetTop - nextScrollEl.scrollTop;
      const dx = state.targetLeft - nextScrollEl.scrollLeft;
      if (Math.abs(dy) < 0.5 && Math.abs(dx) < 0.5) {
        nextScrollEl.scrollTop = state.targetTop;
        nextScrollEl.scrollLeft = state.targetLeft;
        state.raf = 0;
        return;
      }

      nextScrollEl.scrollTop += dy * 0.28;
      nextScrollEl.scrollLeft += dx * 0.28;
      state.raf = window.requestAnimationFrame(tick);
    };

    if (!state.raf) {
      state.raf = window.requestAnimationFrame(tick);
    }
  }, [disabled, passthroughNativeTargets, scrollRef]);

  useEffect(() => {
    const target = eventTargetRef?.current;
    if (!target) return undefined;
    target.addEventListener("wheel", handleWheel, {
      passive: false,
    });
    return () => {
      target.removeEventListener("wheel", handleWheel);
    };
  }, [eventTargetRef, handleWheel]);

  return handleWheel;
}
