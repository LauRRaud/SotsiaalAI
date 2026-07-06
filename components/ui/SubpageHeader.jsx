"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import BackButton from "@/components/ui/BackButton";
import { cn } from "@/components/ui/cn";
import {
  glassSubpageBackButtonClassName,
  glassSubpageHeaderClassName,
  glassSubpageTitleClassName,
  glassSubpageTitleWrapClassName
} from "@/components/ui/glassPageStyles";

const BACK_ANCHOR_SELECTOR = [
  "[data-glass-back-anchor]",
  ".materials-page-content",
  ".covision-page-surface",
  ".workspace-feature-panel",
  ".documents-workspace-shell",
  ".subscription-modal-content",
  ".framework-surface-panel",
  ".invite-modal-content",
  ".person-invite-modal-content",
  ".help-listings-modal-content",
  ".selected-listing-modal-content",
  ".glass-ring",
  ".glass-box"
].join(",");

function getRootRemPx() {
  if (typeof window === "undefined" || typeof document === "undefined") return 16;
  const value = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize || "16");
  return Number.isFinite(value) && value > 0 ? value : 16;
}

function getBackInsetsPx() {
  if (typeof window === "undefined") {
    return { left: 8.8, top: 8.8 };
  }
  const rootRem = getRootRemPx();
  const isMobile = window.matchMedia?.("(max-width: 768px)")?.matches;
  return {
    left: rootRem * (isMobile ? 0.04 : 0.55),
    top: rootRem * (isMobile ? 0.2 : 0.55)
  };
}

function createsFixedContainingBlock(style) {
  if (!style) return false;
  const contain = style.contain || "";
  const willChange = style.willChange || "";
  return (
    style.transform !== "none" ||
    style.perspective !== "none" ||
    style.filter !== "none" ||
    style.backdropFilter !== "none" ||
    style.webkitBackdropFilter !== "none" ||
    /\b(layout|paint|strict|content)\b/.test(contain) ||
    /\b(transform|perspective|filter|backdrop-filter)\b/.test(willChange)
  );
}

function getFixedContainingBlockRect(element) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { left: 0, top: 0 };
  }

  let node = element?.parentElement;
  while (node && node !== document.documentElement) {
    if (createsFixedContainingBlock(window.getComputedStyle(node))) {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, top: rect.top };
    }
    node = node.parentElement;
  }
  return { left: 0, top: 0 };
}

export function SubpageHeader({
  title,
  children,
  titleId,
  titleAs: TitleTag = "h1",
  onBack,
  backAriaLabel,
  showBack = true,
  holdPressedVisualDisabled = false,
  headerClassName,
  titleWrapClassName,
  titleClassName,
  backClassName,
  backIconClassName,
  rightSlot,
  anchorBack = false
}) {
  const backButtonRef = useRef(null);
  const [backAnchorStyle, setBackAnchorStyle] = useState(null);
  const hasBack = Boolean(showBack && onBack);
  const shouldAnchorBack = Boolean(hasBack && anchorBack);

  const updateBackAnchor = useCallback(() => {
    if (typeof window === "undefined") return;
    const button = backButtonRef.current;
    const anchor = button?.closest?.(BACK_ANCHOR_SELECTOR);
    if (!shouldAnchorBack || !button || !anchor) {
      setBackAnchorStyle(null);
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const containingBlock = getFixedContainingBlockRect(button);
    const insets = getBackInsetsPx();
    const workspaceRingTopInset =
      anchor.classList?.contains("chat-container--workspace-open") &&
      button.closest?.(".workspace-dashboard-panel")
        ? getRootRemPx() * 0.28
        : 0;
    const next = {
      "--glass-subpage-back-left": `${rect.left - containingBlock.left + insets.left}px`,
      "--glass-subpage-back-top": `${rect.top - containingBlock.top + insets.top + workspaceRingTopInset}px`
    };

    setBackAnchorStyle((current) => (
      current?.["--glass-subpage-back-left"] === next["--glass-subpage-back-left"] &&
      current?.["--glass-subpage-back-top"] === next["--glass-subpage-back-top"]
        ? current
        : next
    ));
  }, [shouldAnchorBack]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (!shouldAnchorBack) {
      setBackAnchorStyle(null);
      return undefined;
    }
    const button = backButtonRef.current;
    const anchor = button?.closest?.(BACK_ANCHOR_SELECTOR);
    if (!button || !anchor) return undefined;

    let animationFrame = 0;
    const scheduleUpdate = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        updateBackAnchor();
      });
    };

    updateBackAnchor();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(scheduleUpdate) : null;
    const attributeObserver = typeof MutationObserver === "function" ? new MutationObserver(scheduleUpdate) : null;
    observer?.observe(anchor);
    attributeObserver?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-platform", "style"]
    });
    if (document.body) {
      attributeObserver?.observe(document.body, {
        attributes: true,
        attributeFilter: ["data-platform"]
      });
    }
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("orientationchange", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);
    window.visualViewport?.addEventListener("resize", scheduleUpdate);

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      observer?.disconnect();
      attributeObserver?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
      window.visualViewport?.removeEventListener("resize", scheduleUpdate);
    };
  }, [shouldAnchorBack, updateBackAnchor]);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || !shouldAnchorBack || !backAnchorStyle) return;
    const button = backButtonRef.current;
    const anchor = button?.closest?.(BACK_ANCHOR_SELECTOR);
    if (!button || !anchor) return;

    const anchorRect = anchor.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const insets = getBackInsetsPx();
    const workspaceRingTopInset =
      anchor.classList?.contains("chat-container--workspace-open") &&
      button.closest?.(".workspace-dashboard-panel")
        ? getRootRemPx() * 0.28
        : 0;
    const targetLeft = anchorRect.left + insets.left;
    const targetTop = anchorRect.top + insets.top + workspaceRingTopInset;
    const deltaLeft = targetLeft - buttonRect.left;
    const deltaTop = targetTop - buttonRect.top;
    if (Math.abs(deltaLeft) < 0.5 && Math.abs(deltaTop) < 0.5) return;

    const currentLeft = Number.parseFloat(backAnchorStyle["--glass-subpage-back-left"] || "0");
    const currentTop = Number.parseFloat(backAnchorStyle["--glass-subpage-back-top"] || "0");
    const next = {
      "--glass-subpage-back-left": `${currentLeft + deltaLeft}px`,
      "--glass-subpage-back-top": `${currentTop + deltaTop}px`
    };

    setBackAnchorStyle((current) => (
      current?.["--glass-subpage-back-left"] === next["--glass-subpage-back-left"] &&
      current?.["--glass-subpage-back-top"] === next["--glass-subpage-back-top"]
        ? current
        : next
    ));
  }, [backAnchorStyle, shouldAnchorBack]);

  return (
    <>
      {hasBack ? (
        <BackButton
          ref={backButtonRef}
          onClick={onBack}
          ariaLabel={backAriaLabel}
          holdPressedVisualDisabled={holdPressedVisualDisabled}
          className={cn(
            glassSubpageBackButtonClassName,
            shouldAnchorBack && backAnchorStyle ? "glass-subpage-back-button--anchored" : null,
            backClassName
          )}
          iconClassName={backIconClassName}
          style={shouldAnchorBack ? backAnchorStyle || undefined : undefined}
        />
      ) : null}
      {rightSlot}
      <header className={cn(glassSubpageHeaderClassName, headerClassName)}>
        <div className={cn(glassSubpageTitleWrapClassName, titleWrapClassName)}>
          <TitleTag id={titleId} className={cn(glassSubpageTitleClassName, titleClassName)}>
            {children ?? title}
          </TitleTag>
        </div>
      </header>
    </>
  );
}
