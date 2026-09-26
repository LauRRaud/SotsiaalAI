"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* AI-sõnumi tegevused ühe ⋯ nupu taga (omanik 26.09: „kui liiga palju
   ikoone, siis veidi segab teksti lugemist"). ⋯ vajutus TEKITAB ikoonid
   väikese klaasribana nupu alla (omanik 26.09: „võiks olla ikkagi
   ikoonid, mis tekivad"); iga ikooni nimi on klaassildis.

   Riba portaalitakse body'sse ja on `position: fixed`: kerimisveeru mask
   ja perspektiiv ei lõika ega nihuta teda. MITTE brauseri popover-kihti —
   see on kõige peal, ka saidi enda kursori (LiquidCursor) peal, ja kursor
   jäi riba alla (omanik 26.09: „hiir läheb sinna menüü alla"). */

const GAP = 6;
const EDGE = 8;

export default function MessageActionsMenu({ label, tip, actions, speaking = false, time = null }) {
  const menuId = useId();
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  // Asukoht nupu järgi; ruumi puudumisel avaneb riba nupu kohale.
  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const menu = menuRef.current;
    if (!button || !menu) return;
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
    const first = menu.querySelector('[role="menuitem"]:not(:disabled)');
    first?.focus({ preventScroll: true });
  }, [open]);

  // Sulgub: klõps mujal, Esc, kerimine ja akna suuruse muutus.
  useEffect(() => {
    if (!open) return undefined;
    const onScroll = event => {
      if (menuRef.current?.contains(event.target)) return;
      close(false);
    };
    const onPointerDown = event => {
      if (menuRef.current?.contains(event.target) || buttonRef.current?.contains(event.target)) return;
      close(false);
    };
    const onKeyDown = event => {
      if (event.key !== "Escape") return;
      // Lehe Esc (PanelFrame) sulgeks muidu terve vestluse.
      event.preventDefault();
      event.stopPropagation();
      close(true);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, close]);

  const focusItem = index => {
    const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not(:disabled)') || [])];
    if (!items.length) return;
    items[(index + items.length) % items.length].focus();
  };

  const onMenuKeyDown = event => {
    const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not(:disabled)') || [])];
    const index = items.indexOf(document.activeElement);
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
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

  const menu = open && typeof document !== "undefined" ? createPortal(
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label={label}
      aria-orientation="horizontal"
      data-msg-menu=""
      data-esc-scope=""
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
      {/* Sõnumi kellaaeg riba lõpus (omanik 26.09: „kellaaeg ka sinna
          kiirmenüü sisse"). Pelgalt info, mitte tegevus. */}
      {time ? (
        <span role="none" data-msg-menu-time="">
          <time dateTime={time.iso}>{time.label}</time>
        </span>
      ) : null}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-tooltip={tip}
        data-speaking={speaking ? "true" : "false"}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <svg aria-hidden="true" width="25" height="25" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <circle cx="5" cy="12" r="1.9" />
          <circle cx="12" cy="12" r="1.9" />
          <circle cx="19" cy="12" r="1.9" />
        </svg>
      </button>
      {menu}
    </>
  );
}
