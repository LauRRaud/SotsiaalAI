"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

/* AI-sõnumi tegevused ühe ⋯ nupu taga (omanik 26.09: „kui liiga palju
   ikoone, siis veidi segab teksti lugemist"). ⋯ vajutus TEKITAB ikoonid
   väikese klaasribana nupu alla (omanik 26.09: „võiks olla ikkagi
   ikoonid, mis tekivad"); iga ikooni nimi on klaassildis. Riba avaneb brauseri
   popover-kihis: kerimisveeru mask ja perspektiiv ei lõika ega nihuta
   teda, Esc ja väljaspool klõps sulgevad ta ise. Vanemas brauseris, kus
   popover'it pole, jääb ta absoluutseks nupu alla (data-open). */

const GAP = 6;
const EDGE = 8;

export default function MessageActionsMenu({ label, tip, actions, speaking = false }) {
  const menuId = useId();
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const supportsPopover = typeof HTMLElement !== "undefined"
    && typeof HTMLElement.prototype.showPopover === "function";

  const place = useCallback(() => {
    const button = buttonRef.current;
    const menu = menuRef.current;
    if (!button || !menu || !supportsPopover) return;
    const b = button.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    const below = b.bottom + GAP;
    const top = below + m.height > window.innerHeight - EDGE
      ? Math.max(EDGE, b.top - GAP - m.height)
      : below;
    const left = Math.min(
      Math.max(EDGE, b.right - m.width),
      window.innerWidth - m.width - EDGE
    );
    menu.style.top = `${Math.round(top)}px`;
    menu.style.left = `${Math.round(left)}px`;
  }, [supportsPopover]);

  const close = useCallback((returnFocus = false) => {
    const menu = menuRef.current;
    if (supportsPopover && menu?.matches(":popover-open")) menu.hidePopover();
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, [supportsPopover]);

  // Popover'i enda sulgemine (Esc, klõps mujal) peab jõudma ka olekusse.
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu || !supportsPopover) return undefined;
    const onToggle = event => {
      if (event.newState === "closed") {
        const hadFocus = menu.contains(document.activeElement);
        setOpen(false);
        if (hadFocus) buttonRef.current?.focus();
      }
    };
    menu.addEventListener("toggle", onToggle);
    return () => menu.removeEventListener("toggle", onToggle);
  }, [supportsPopover]);

  // Kerimisel sulgub: kinnitatud menüü jääks muidu õhku rippuma.
  useEffect(() => {
    if (!open) return undefined;
    const onScroll = event => {
      if (menuRef.current?.contains(event.target)) return;
      close(false);
    };
    const onPointerDown = event => {
      if (supportsPopover) return;
      if (menuRef.current?.contains(event.target) || buttonRef.current?.contains(event.target)) return;
      close(false);
    };
    const onKeyDown = event => {
      if (!supportsPopover && event.key === "Escape") close(true);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close, supportsPopover]);

  const focusItem = index => {
    const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not(:disabled)') || [])];
    if (!items.length) return;
    items[(index + items.length) % items.length].focus();
  };

  const toggle = () => {
    if (open) {
      close(false);
      return;
    }
    const menu = menuRef.current;
    if (supportsPopover && menu) {
      menu.showPopover();
      place();
    }
    setOpen(true);
    requestAnimationFrame(() => focusItem(0));
  };

  const onMenuKeyDown = event => {
    const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not(:disabled)') || [])];
    const index = items.indexOf(document.activeElement);
    if (event.key === "Escape") {
      // Lehe Esc (PanelFrame) sulgeks muidu terve vestluse.
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(index + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusItem(items.length - 1);
    } else if (event.key === "Tab") {
      close(false);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        data-tooltip={tip}
        data-speaking={speaking ? "true" : "false"}
        onClick={toggle}
      >
        <svg aria-hidden="true" width="25" height="25" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <circle cx="5" cy="12" r="1.9" />
          <circle cx="12" cy="12" r="1.9" />
          <circle cx="19" cy="12" r="1.9" />
        </svg>
      </button>
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        aria-label={label}
        aria-orientation="horizontal"
        popover={supportsPopover ? "auto" : undefined}
        data-msg-menu=""
        data-esc-scope=""
        data-open={open ? "true" : undefined}
        hidden={!supportsPopover && !open ? true : undefined}
        onKeyDown={onMenuKeyDown}
      >
        {actions.map(action => (
          <button
            key={action.key}
            type="button"
            role="menuitem"
            aria-label={action.ariaLabel || action.label}
            data-tooltip={action.label}
            disabled={action.disabled}
            data-speaking={action.speaking ? "true" : undefined}
            onClick={() => {
              close(true);
              action.onSelect?.();
            }}
          >
            {action.icon}
          </button>
        ))}
      </div>
    </>
  );
}
