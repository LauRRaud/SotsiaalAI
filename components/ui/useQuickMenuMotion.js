"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Let the destination become visible before the dock switches its highlight.
export function useQuickMenuIndex(activeKey, delay) {
  const [shownKey, setShownKey] = useState(activeKey);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.reduceMotion === "1";
    const timer = window.setTimeout(() => setShownKey(activeKey), reduced ? 0 : delay);
    return () => window.clearTimeout(timer);
  }, [activeKey, delay]);
  return shownKey;
}

const timing = { duration: 320, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" };
const measure = (el) => ({
  width: `${el.getBoundingClientRect().width}px`,
  paddingLeft: getComputedStyle(el).paddingLeft,
  paddingRight: getComputedStyle(el).paddingRight,
});

// Interpolate measured widths together, never an arbitrary max-width ceiling.
export default function useQuickMenuMotion(trackRef, activeKey) {
  const previous = useRef(new Map());
  const animations = useRef(new Map());
  const viewport = useRef(0);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.reduceMotion === "1";
    const canAnimate = !reduced && viewport.current === window.innerWidth;
    const next = new Map();
    for (const el of track.querySelectorAll(".gc-shortcut")) {
      const running = animations.current.get(el);
      const old = running?.playState === "running" ? measure(el) : previous.current.get(el);
      running?.cancel();
      const size = measure(el);
      next.set(el, size);
      if (canAnimate && old && old.width !== size.width) {
        animations.current.set(el, el.animate(
          [old, size], timing,
        ));
      }
    }
    previous.current = next;
    viewport.current = window.innerWidth;
  }, [trackRef, activeKey]);

  useLayoutEffect(() => {
    const running = animations.current;
    return () => {
      for (const animation of running.values()) animation.cancel();
      running.clear();
    };
  }, []);
}
