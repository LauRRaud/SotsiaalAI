"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/components/ui/cn";

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
].join(",");

function getFocusable(node) {
  if (!node) return [];
  return Array.from(node.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el) => el instanceof HTMLElement && !el.hasAttribute("disabled") && el.offsetParent !== null
  );
}

export default function Modal({
  open = false,
  variant = "default",
  onClose,
  children,
  className,
  contentClassName,
  contentRef,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  onKeyDown,
  ...props
}) {
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // On open: remember the opener, move focus into the dialog. On close/unmount:
  // restore focus to the opener so keyboard/screen-reader users are not stranded.
  useEffect(() => {
    if (!open || !mounted || typeof document === "undefined") return undefined;

    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const node = dialogRef.current;
    if (node) {
      const focusables = getFocusable(node);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        node.focus();
      }
    }

    return () => {
      const opener = openerRef.current;
      if (opener && typeof opener.focus === "function" && document.contains(opener)) {
        opener.focus();
      }
    };
  }, [open, mounted]);

  // A modal is the only active surface: lock document scrolling and make
  // existing body siblings inert. Preserve prior inline/inert state so the
  // page returns to its original interaction contract when this closes.
  useEffect(() => {
    if (!open || !mounted || typeof document === "undefined") return undefined;

    const overlay = overlayRef.current;
    const body = document.body;
    const siblings = Array.from(body.children).filter((node) => node !== overlay);
    const inertState = siblings.map((node) => ({
      node,
      hadInert: node.hasAttribute("inert")
    }));
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);

    for (const { node } of inertState) node.setAttribute("inert", "");
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      for (const { node, hadInert } of inertState) {
        if (!hadInert) node.removeAttribute("inert");
      }
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [open, mounted]);

  if (!open) return null;
  if (!mounted || typeof document === "undefined") return null;

  function assignDialogRef(node) {
    dialogRef.current = node;
    if (typeof contentRef === "function") contentRef(node);
    else if (contentRef && typeof contentRef === "object") contentRef.current = node;
  }

  function handleKeyDown(event) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    if (event.key === "Escape") {
      if (closeOnEscape && onClose) {
        event.stopPropagation();
        onClose(event);
      }
      return;
    }

    if (event.key !== "Tab") return;

    const node = dialogRef.current;
    const focusables = getFocusable(node);
    if (focusables.length === 0) {
      event.preventDefault();
      node?.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !node.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !node.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }

  const modal = (
    <div
      ref={overlayRef}
      data-variant={variant}
      className={cn(className)}
      role="presentation"
      onClick={(event) => {
        if (!closeOnOverlayClick) return;
        if (event.target === event.currentTarget) onClose?.(event);
      }}
    >
      <div
        ref={assignDialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(contentClassName)}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {children}
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}
