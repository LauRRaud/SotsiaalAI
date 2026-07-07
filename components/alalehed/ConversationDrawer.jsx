"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/components/ui/cn";
import IconButton from "@/components/ui/IconButton";
export default function ConversationDrawer({
  children
}) {
  const [open, setOpen] = useState(false);
  const [titleOverride, setTitleOverride] = useState("");
  const [drawerRoot, setDrawerRoot] = useState(null);
  const panelRef = useRef(null);
  const closeBtnRef = useRef(null);
  const overlayRef = useRef(null);
  const drawerRootRef = useRef(null);
  const openRef = useRef(false);
  const lastOpenerRef = useRef(null);
  const headerId = useId();
  const {
    t
  } = useI18n();
  const parkFocusOutsidePanel = () => {
    if (typeof document === "undefined") return;
    const panel = panelRef.current;
    const active = document.activeElement;
    if (!panel || !(active instanceof HTMLElement) || !panel.contains(active)) return;
    try {
      active.blur();
    } catch {}
    const root = drawerRootRef.current;
    if (!(root instanceof HTMLElement) || typeof root.focus !== "function") return;
    const hadTabIndex = root.hasAttribute("tabindex");
    if (!hadTabIndex) root.setAttribute("tabindex", "-1");
    try {
      root.focus({
        preventScroll: true
      });
    } catch {
      try {
        root.focus();
      } catch {}
    }
    if (!hadTabIndex) root.removeAttribute("tabindex");
  };
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    function onToggle(e) {
      const want = e?.detail?.open;
      const next = typeof want === "boolean" ? want : !openRef.current;
      if (next) {
        const active = document.activeElement;
        lastOpenerRef.current = active instanceof HTMLElement ? active : null;
        setOpen(true);
        return;
      }
      parkFocusOutsidePanel();
      setOpen(false);
    }
    window.addEventListener("sotsiaalai:toggle-conversations", onToggle);
    return () => window.removeEventListener("sotsiaalai:toggle-conversations", onToggle);
  }, []);
  useEffect(() => {
    const handleTitleChange = e => {
      const nextTitle = typeof e?.detail?.title === "string" ? e.detail.title.trim() : "";
      setTitleOverride(nextTitle);
    };
    window.addEventListener("sotsiaalai:conversation-drawer-title", handleTitleChange);
    return () => window.removeEventListener("sotsiaalai:conversation-drawer-title", handleTitleChange);
  }, []);
  useEffect(() => {
    if (open) return;
    const opener = lastOpenerRef.current;
    if (!(opener instanceof HTMLElement) || !opener.isConnected || typeof opener.focus !== "function") {
      return;
    }
    const id = window.setTimeout(() => {
      try {
        opener.focus({
          preventScroll: true
        });
      } catch {
        try {
          opener.focus();
        } catch {}
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    let root = document.querySelector('[data-conversation-drawer-root="true"]');
    let created = false;
    if (!root) {
      root = document.createElement("div");
      root.setAttribute("data-conversation-drawer-root", "true");
      document.body.appendChild(root);
      created = true;
    }
    drawerRootRef.current = root;
    setDrawerRoot(root);
    return () => {
      if (created && root?.parentNode) {
        try {
          root.parentNode.removeChild(root);
        } catch {}
      }
      drawerRootRef.current = null;
      setDrawerRoot(null);
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const scrollbarWidth = getScrollbarWidth();
    body.style.overflow = "hidden";
    if (document.documentElement.scrollHeight > document.documentElement.clientHeight) {
      const current = parseFloat(getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${current + scrollbarWidth}px`;
    }
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("conversation-drawer-open", open);
    return () => {
      document.body.classList.remove("conversation-drawer-open");
    };
  }, [open]);
  useEffect(() => {
    const portalRoot = drawerRootRef.current;
    if (!portalRoot) return;
    const siblings = Array.from(document.body.children).filter(el => el !== portalRoot);
    if (open) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && siblings.some(el => el.contains(active))) {
        const target = closeBtnRef.current || panelRef.current;
        if (target && typeof target.focus === "function") {
          try {
            target.focus({
              preventScroll: true
            });
          } catch {
            try {
              target.focus();
            } catch {}
          }
        }
      }
      for (const el of siblings) {
        try {
          el.setAttribute("aria-hidden", "true");
          if ("inert" in el) {
            el.inert = true;
          }
        } catch {}
      }
      return () => {
        for (const el of siblings) {
          try {
            el.removeAttribute("aria-hidden");
            if ("inert" in el) {
              el.inert = false;
            }
          } catch {}
        }
      };
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    function onKeydown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        parkFocusOutsidePanel();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const root = panelRef.current;
      if (!root) return;
      const focusable = getFocusable(root);
      if (!focusable.length) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !root.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeydown, true);
    return () => document.removeEventListener("keydown", onKeydown, true);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const toFocus = closeBtnRef.current || panelRef.current?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const timer = setTimeout(() => toFocus?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open]);
  const close = () => {
    parkFocusOutsidePanel();
    setOpen(false);
  };
  if (!drawerRoot) return null;
  const overlayClassName = "drawer-overlay fixed inset-0 z-[130]";
  const panelClassName = cn(
    "drawer-panel fixed z-[131] overflow-hidden",
    open ? "visible pointer-events-auto" : "invisible pointer-events-none",
    open ? "open" : null
  );
  const headerClassName = "drawer-header";
  const contentClassName = "drawer-content overflow-hidden";
  const drawerTitle = titleOverride || t("chat.menu.label");
  return createPortal(<>
      {open && <div ref={overlayRef} className={overlayClassName} onClick={close} aria-hidden="true" />}
      <aside ref={panelRef} role="dialog" aria-labelledby={headerId} aria-modal={open ? "true" : undefined} aria-hidden={open ? undefined : "true"} inert={open ? undefined : true} tabIndex={open ? undefined : -1} className={panelClassName}>
        <header className={headerClassName}>
          <h1 id={headerId} className="drawer-title">
            {drawerTitle}
          </h1>
          <IconButton ref={closeBtnRef} onClick={close} label={t("buttons.close")} />
        </header>
        <div className={contentClassName}>
          {children}
        </div>
      </aside>
    </>, drawerRoot);
}
function getFocusable(root) {
  if (!root) return [];
  const nodes = root.querySelectorAll(["a[href]", "area[href]", "button:not([disabled])", "input:not([disabled]):not([type='hidden'])", "select:not([disabled])", "textarea:not([disabled])", "iframe", "object", "embed", "[contenteditable]", "[tabindex]:not([tabindex='-1'])"].join(","));
  return Array.from(nodes).filter(isVisible);
}
function isVisible(el) {
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}
function getScrollbarWidth() {
  const scrollDiv = document.createElement("div");
  scrollDiv.style.width = "100px";
  scrollDiv.style.height = "100px";
  scrollDiv.style.overflow = "scroll";
  scrollDiv.style.position = "absolute";
  scrollDiv.style.top = "-9999px";
  document.body.appendChild(scrollDiv);
  const width = scrollDiv.offsetWidth - scrollDiv.clientWidth;
  document.body.removeChild(scrollDiv);
  return width;
}
