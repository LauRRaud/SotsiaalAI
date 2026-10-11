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
   jäi riba alla (omanik 26.09: „hiir läheb sinna menüü alla").

   Tegevus võib riba asemel avada väikese kaardi (`renderPanel`, vastuse
   tagasiside): kaart istub samas klaasis ja samas kohas. Avatud kaart ei
   sulgu kerimisest ega akna suuruse muutusest (telefoni klaviatuur teeb
   mõlemat), vaid liigub nupuga kaasa. `inert` tegevus on näha ja loetav,
   aga ei tee midagi (tagasiside on juba saadetud). */

const GAP = 6;
const EDGE = 8;
// Kaardi fookuspeatused Tab-järjekorras: valikurühmast üks lahter (rändav tabulatsioon), väli ja nupud.
const PANEL_FOCUSABLE = 'button:not(:disabled):not([tabindex="-1"]), textarea:not(:disabled), input:not(:disabled)';

export default function MessageActionsMenu({ label, tip, actions, speaking = false, time = null }) {
  const menuId = useId();
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [panelKey, setPanelKey] = useState(null);
  const panel = open && panelKey ? actions.find(action => action.key === panelKey && action.renderPanel) || null : null;
  const panelOpen = Boolean(panel);

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    setPanelKey(null);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  // Asukoht nupu järgi; ruumi puudumisel avaneb riba nupu kohale.
  const place = useCallback(() => {
    const button = buttonRef.current;
    const menu = menuRef.current;
    if (!button || !menu) return;
    const b = button.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    const below = b.bottom + GAP;
    const fitsBelow = below + m.height <= window.innerHeight - EDGE;
    const beside = b.right + GAP;
    let top = fitsBelow ? Math.max(EDGE, below) : Math.max(EDGE, b.top - GAP - m.height);
    let left = Math.min(
      Math.max(EDGE, b.right - m.width),
      window.innerWidth - m.width - EDGE
    );
    // Kaart, mis nupu alla ei mahu, läheb laias aknas mulli kõrvale: nupu kohal kataks ta vastuse,
    // mille kohta inimene parajasti kirjutab.
    if (!fitsBelow && menu.hasAttribute("data-msg-menu-panel") && beside + m.width <= window.innerWidth - EDGE) {
      left = beside;
      top = Math.max(EDGE, Math.min(b.top, window.innerHeight - m.height - EDGE));
    }
    menu.style.top = `${Math.round(top)}px`;
    menu.style.left = `${Math.round(left)}px`;
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const first = menuRef.current?.querySelector(panelOpen ? PANEL_FOCUSABLE : '[role="menuitem"]:not(:disabled)');
    first?.focus({ preventScroll: true });
  }, [open, panelOpen, place]);

  // Kaardi kõrgus muutub (tänusõna on vormist lühem): koht arvutatakse uuesti.
  useEffect(() => {
    if (!panelOpen || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(place);
    if (menuRef.current) observer.observe(menuRef.current);
    return () => observer.disconnect();
  }, [panelOpen, place]);

  // Sulgub: klõps mujal ja Esc; riba ka kerimisest ja akna suuruse muutusest.
  useEffect(() => {
    if (!open) return undefined;
    const onScroll = event => {
      if (menuRef.current?.contains(event.target)) return;
      if (panelOpen) {
        place();
        return;
      }
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
  }, [open, close, panelOpen, place]);

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

  // Kaardis käib Tab ringi: fookus ei lähe kaardi alt vestlusesse.
  const onPanelKeyDown = event => {
    if (event.key !== "Tab") return;
    const items = [...(menuRef.current?.querySelectorAll(PANEL_FOCUSABLE) || [])];
    if (!items.length) return;
    const active = document.activeElement;
    const edge = event.shiftKey ? items[0] : items[items.length - 1];
    if (active !== edge && menuRef.current?.contains(active)) return;
    event.preventDefault();
    (event.shiftKey ? items[items.length - 1] : items[0]).focus();
  };

  const menu = !open || typeof document === "undefined" ? null : createPortal(panel ? (
    <div
      key="panel"
      ref={menuRef}
      id={menuId}
      role="dialog"
      aria-label={panel.ariaLabel || panel.label}
      data-msg-menu=""
      data-msg-menu-panel=""
      data-esc-scope=""
      onKeyDown={onPanelKeyDown}
    >
      {panel.renderPanel({ close })}
    </div>
  ) : (
    <div
      key="strip"
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
          aria-disabled={action.inert ? "true" : undefined}
          aria-haspopup={action.renderPanel && !action.inert ? "dialog" : undefined}
          data-tooltip={action.label}
          disabled={action.disabled}
          data-speaking={action.speaking ? "true" : undefined}
          onClick={() => {
            if (action.inert) return;
            if (action.renderPanel) {
              setPanelKey(action.key);
              return;
            }
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
    </div>
  ), document.body);

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
