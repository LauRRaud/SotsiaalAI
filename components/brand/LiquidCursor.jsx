"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const CLICKABLE =
  'a[href],button,[role="button"],label,summary,select,option,input[type="button"],input[type="submit"],input[type="reset"],.cursor-pointer,.btn,.button';

// Algne kõverjooneline nool, tipp (0,0) = kursori ankur. viewBox 0 0 24 28.
const ARROW_D =
  "M 0 0 L 21.98 18.84 Q 23.55 20.1 21.04 21.35 L 6.91 26.69 Q 3.77 27.95 3.14 24.81 L 0 0 Z";

export default function LiquidCursor() {
  const elRef = useRef(null);
  const rafRef = useRef(0);
  const pos = useRef({ x: -200, y: -200 });
  const [active, setActive] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const activeRef = useRef(false);
  const refreshRef = useRef(null);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return undefined;
    const fine = window.matchMedia?.("(hover: hover) and (pointer: fine)");
    const coarse = window.matchMedia?.("(pointer: coarse)");
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const standalone = window.matchMedia?.("(display-mode: standalone)");
    const fullscreen = window.matchMedia?.("(display-mode: fullscreen)");
    const getStandalone = () =>
      Boolean(standalone?.matches || fullscreen?.matches || navigator.standalone);
    const update = () => {
      setEnabled(
        Boolean(fine?.matches && !coarse?.matches && !reduce?.matches && !getStandalone())
      );
    };
    update();
    const queries = [fine, coarse, reduce, standalone, fullscreen].filter(Boolean);
    queries.forEach((query) => query.addEventListener?.("change", update));
    window.addEventListener("resize", update, { passive: true });
    return () => {
      queries.forEach((query) => query.removeEventListener?.("change", update));
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const root = document.documentElement;
    if (enabled) root.classList.add("liquid-cursor-on");
    else root.classList.remove("liquid-cursor-on");
    return () => root.classList.remove("liquid-cursor-on");
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof document === "undefined") return undefined;
    const el = elRef.current;
    if (!el) return undefined;
    const isClickable = (node) => {
      if (!node || typeof node.closest !== "function") return false;
      if (node.closest(".no-liquid-cursor")) return false;
      return !!node.closest(CLICKABLE);
    };
    const sync = () => {
      rafRef.current = 0;
      el.style.setProperty("--cursor-x", `${pos.current.x}px`);
      el.style.setProperty("--cursor-y", `${pos.current.y}px`);
    };
    const schedule = () => {
      if (!rafRef.current) rafRef.current = requestAnimationFrame(sync);
    };
    const refreshFromPoint = () => {
      const { x, y } = pos.current;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const next = isClickable(document.elementFromPoint(x, y));
      if (next !== activeRef.current) {
        activeRef.current = next;
        setActive(next);
      }
      schedule();
    };
    let refreshTimer = 0;
    const scheduleRefresh = (delay = 60) => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(refreshFromPoint, delay);
    };
    refreshRef.current = () => scheduleRefresh(40);
    const onMove = (e) => {
      pos.current.x = e.clientX;
      pos.current.y = e.clientY;
      const next = isClickable(e.target);
      if (next !== activeRef.current) {
        activeRef.current = next;
        setActive(next);
      }
      schedule();
    };
    const onLeave = () => {
      activeRef.current = false;
      setActive(false);
    };
    const onScroll = () => scheduleRefresh(80);
    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("popstate", onScroll);
    window.addEventListener("hashchange", onScroll);
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", onScroll);
      window.removeEventListener("hashchange", onScroll);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    refreshRef.current?.();
  }, [enabled, pathname]);

  if (!enabled) return null;
  return (
    <div ref={elRef} className={`liquid-cursor${active ? " is-active" : ""}`} aria-hidden="true">
      <svg className="liquid-cursor-svg" viewBox="0 0 24 28" aria-hidden="true">
        <defs>
          <linearGradient id="lc-glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff6ec" stopOpacity="0.3" />
            <stop offset="0.4" stopColor="#fff1e2" stopOpacity="0.18" />
            <stop offset="0.72" stopColor="#ffeeda" stopOpacity="0.15" />
            <stop offset="1" stopColor="#fff6ec" stopOpacity="0.26" />
          </linearGradient>
          <filter id="lc-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feFlood floodColor="#fff4e2" floodOpacity="1" result="f" />
            <feComposite in="f" in2="SourceAlpha" operator="out" result="o" />
            <feGaussianBlur in="o" stdDeviation="1.3" result="b" />
            <feComposite in="b" in2="SourceAlpha" operator="in" />
          </filter>
          {/* Puhas läige: ÜKS pehme valgusriba (üks tipp, lai hajumine →
             ei triibuta), libiseb diagonaalselt üle noole. */}
          <linearGradient id="lc-shine" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fffdf8" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fffdf8" stopOpacity="0.7" />
            <stop offset="1" stopColor="#fffdf8" stopOpacity="0" />
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              values="-1 -1; 1 1; 1 1"
              keyTimes="0; 0.55; 1"
              dur="3.2s"
              repeatCount="indefinite"
            />
          </linearGradient>
        </defs>
        <path d={ARROW_D} fill="url(#lc-glass)" />
        <path className="lc-glow" d={ARROW_D} fill="#fff4e2" filter="url(#lc-glow)" />
        <path className="lc-shine" d={ARROW_D} fill="url(#lc-shine)" />
        <path
          className="lc-rim"
          d={ARROW_D}
          fill="none"
          stroke="#fff8ee"
          strokeOpacity="0.62"
          strokeWidth="1.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
