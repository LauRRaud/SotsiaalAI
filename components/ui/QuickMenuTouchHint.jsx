"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// A shared touch hint lives outside scrolling dock tracks, so they cannot clip it.
// Pointer events only observe the tap: the button's normal single-tap action remains.
export default function QuickMenuTouchHint() {
  const [hint, setHint] = useState(null);
  const hintRef = useRef(null);

  useEffect(() => {
    let start = null;
    let timer = 0;
    let frame = 0;
    const clear = () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
      start = null;
      setHint(null);
    };
    const down = (event) => {
      clear();
      if (event.pointerType !== "touch" || !event.isPrimary) return;
      const button = event.target.closest?.(".gc-shortcut-menu .gc-shortcut");
      if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return;
      start = { button, x: event.clientX, y: event.clientY, id: event.pointerId };
    };
    const move = (event) => {
      if (start && (Math.abs(event.clientX - start.x) > 10 || Math.abs(event.clientY - start.y) > 10)) {
        clear();
      }
    };
    const up = (event) => {
      if (!start || event.pointerId !== start.id) return;
      const { button } = start;
      start = null;
      const label = button.getAttribute("aria-label") || button.textContent?.trim();
      if (!label) return;
      const rect = button.getBoundingClientRect();
      // Let the click update the active pill before positioning the hint.
      frame = window.requestAnimationFrame(() => {
        const anchor = button.isConnected ? button.getBoundingClientRect() : rect;
        setHint({ label, x: anchor.left + anchor.width / 2, y: anchor.top - 9 });
        timer = window.setTimeout(clear, 1800);
      });
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", clear, true);
    window.addEventListener("resize", clear);
    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", clear, true);
      window.removeEventListener("resize", clear);
    };
  }, []);

  useLayoutEffect(() => {
    if (!hint || !hintRef.current) return;
    const half = hintRef.current.getBoundingClientRect().width / 2;
    hintRef.current.style.left = `${Math.max(half + 8, Math.min(window.innerWidth - half - 8, hint.x))}px`;
  }, [hint]);

  return hint ? createPortal(
    <span ref={hintRef} className="gc-shortcut-tooltip gc-touch-tooltip" aria-hidden="true"
      style={{ left: hint.x, top: hint.y }}>
      {hint.label}
    </span>,
    document.body,
  ) : null;
}
