"use client";

import { createElement, useLayoutEffect, useRef } from "react";

const MOBILE_MEDIA_QUERY = "(max-width: 768px)";

export default function AutoFitPageTitle({
  as = "h1",
  className,
  children,
  minFontPx = 16,
  maxFontPx = null,
  minScaleX = null,
  mobileOnly = true,
  disableFit = false,
  style,
  ...props
}) {
  const titleRef = useRef(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;
    const node = titleRef.current;
    if (!(node instanceof HTMLElement)) return undefined;
    if (disableFit) {
      node.dataset.fitReady = "1";
      node.style.removeProperty("font-size");
      node.style.removeProperty("--fit-title-font-size");
      node.style.removeProperty("transform");
      node.style.removeProperty("transform-origin");
      node.style.removeProperty("--fit-title-scale-x");
      return undefined;
    }

    let rafId = 0;
    let resizeObserver = null;
    let initialFitCompleted = false;

    const markReady = () => {
      if (initialFitCompleted) return;
      node.dataset.fitReady = "1";
      initialFitCompleted = true;
    };

    const fit = () => {
      const isMobileViewport =
        !mobileOnly || window.matchMedia(MOBILE_MEDIA_QUERY).matches;

      node.style.removeProperty("font-size");
      node.style.removeProperty("--fit-title-font-size");
      node.style.removeProperty("transform");
      node.style.removeProperty("transform-origin");
      node.style.removeProperty("--fit-title-scale-x");

      if (!isMobileViewport) {
        markReady();
        return;
      }

      const availableWidth = node.clientWidth;
      if (!availableWidth) {
        markReady();
        return;
      }

      const computedStyle = window.getComputedStyle(node);
      const baseFontPx = Number.parseFloat(computedStyle.fontSize) || 16;
      const fitBufferPx = Number.parseFloat(
        computedStyle.getPropertyValue("--fit-title-buffer-px")
      );
      const cssMaxFontPx = Number.parseFloat(
        computedStyle.getPropertyValue("--fit-title-max-px")
      );
      const cssMinScaleX = Number.parseFloat(
        computedStyle.getPropertyValue("--fit-title-min-scale-x")
      );
      const safeWidth =
        availableWidth -
        (Number.isFinite(fitBufferPx) && fitBufferPx > 0 ? fitBufferPx : 0);
      if (safeWidth <= 0) return;
      const resolvedMaxFont = Number.isFinite(maxFontPx)
        ? maxFontPx
        : Number.isFinite(cssMaxFontPx) && cssMaxFontPx > 0
          ? cssMaxFontPx
          : baseFontPx;
      const maxFont = Math.max(1, resolvedMaxFont);
      const minFont = Math.min(maxFont, Math.max(1, minFontPx));
      const resolvedMinScaleX = Number.isFinite(minScaleX)
        ? minScaleX
        : Number.isFinite(cssMinScaleX) && cssMinScaleX > 0
          ? cssMinScaleX
          : 1;
      const minScale = Math.min(1, Math.max(0.65, resolvedMinScaleX));

      node.style.setProperty("font-size", `${maxFont}px`, "important");
      node.style.setProperty("--fit-title-font-size", `${maxFont}px`);

      if (node.scrollWidth <= safeWidth + 1) {
        markReady();
        return;
      }

      let low = minFont;
      let high = maxFont;
      let best = minFont;

      for (let index = 0; index < 12; index += 1) {
        const mid = (low + high) / 2;
        node.style.setProperty("font-size", `${mid}px`, "important");

        if (node.scrollWidth <= safeWidth + 1) {
          best = mid;
          low = mid;
        } else {
          high = mid;
        }
      }

      node.style.setProperty("font-size", `${best}px`, "important");
      node.style.setProperty("--fit-title-font-size", `${best}px`);

      const overflowWidth = node.scrollWidth;
      if (overflowWidth <= safeWidth + 1 || minScale >= 1) {
        markReady();
        return;
      }

      const scale = Math.max(minScale, Math.min(1, safeWidth / overflowWidth));
      if (scale >= 0.999) {
        markReady();
        return;
      }

      node.style.setProperty("transform", `scaleX(${scale})`, "important");
      node.style.setProperty("transform-origin", "center center", "important");
      node.style.setProperty("--fit-title-scale-x", `${scale}`);
      markReady();
    };

    const scheduleFit = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(fit);
    };

    scheduleFit();

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(scheduleFit);
      resizeObserver.observe(node);
      if (node.parentElement instanceof HTMLElement) {
        resizeObserver.observe(node.parentElement);
      }
    }

    window.addEventListener("resize", scheduleFit);
    document.fonts?.ready?.then?.(scheduleFit).catch?.(() => {});

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver?.disconnect?.();
      window.removeEventListener("resize", scheduleFit);
    };
  }, [children, disableFit, maxFontPx, minFontPx, minScaleX, mobileOnly]);

  return createElement(
    as,
    {
      ...props,
      ref: titleRef,
      "data-fit-ready": mobileOnly && !disableFit ? "0" : "1",
      className,
      style: {
        ...style,
        "--fit-title-preload-px":
          style?.["--fit-title-preload-px"] ??
          `${Math.max(minFontPx, 18)}px`
      }
    },
    children
  );
}
