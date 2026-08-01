"use client";

/**
 * Dropdown — platvormi valikmenüü (üks komponent kogu rakendusele).
 *
 * MIKS ta olemas on: natiivne <select> joonistab avatud loendi
 * OPERATSIOONISÜSTEEM, mitte meie CSS. Hämarikuruumi klaasi keskel avanes
 * seetõttu valge Windowsi loend sinise valikuribaga (omanik 01.08) — ainus
 * pind terves rakenduses, mida ei saanud kujundada. Nupp ise oli küll
 * klaasist (glass.css select[data-variant]), aga see puudutab AINULT kokku-
 * pandud olekut.
 *
 * Muster: WAI-ARIA 1.2 "select-only combobox" — nupp role="combobox" +
 * loend role="listbox". Klaviatuur: ↑/↓/Home/End liigutavad, Enter/Space
 * valib, Esc sulgeb ja annab fookuse nupule tagasi, tähtede tippimine hüppab
 * (type-ahead). Hiirega: klikk väljaspool sulgeb.
 *
 * LOEND ELAB PORTAALIS body all, mitte nupu kõrval. Kaks põhjust, mõlemad
 * varem kätte saadud: [1] `transform`-iga vanem teeb `position: fixed`
 * lapsele uue sisaldava ploki ja loend hüppab ekraani teise otsa;
 * [2] admini tabelid ja kaardid on `overflow: auto/hidden` — nupu kõrval
 * sündinud loend lõigatakse ära.
 *
 * API on TÄPSELT sama, mis senisel DocumentsDropdownil (value / onChange(value)
 * / options / placeholder / ariaLabel / disabled), et olemasolevad ~40
 * kasutuskohta ei vaja ühtki muudatust.
 */

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import ChevronIcon from "@/components/brand/icons/ChevronIcon";

const GAP = 6;
const MIN_PANEL_H = 140;

function useIsomorphicLayoutEffect(effect, deps) {
  const isBrowser = typeof window !== "undefined";
  const hook = isBrowser ? useLayoutEffect : useEffect;
  return hook(effect, deps);
}

export default function Dropdown({
  id,
  className,
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  name,
  disabled = false
}) {
  const items = useMemo(() => (Array.isArray(options) ? options : []), [options]);
  const selectedIndex = useMemo(
    () => items.findIndex(option => String(option?.value ?? "") === String(value ?? "")),
    [items, value]
  );
  const selected = selectedIndex >= 0 ? items[selectedIndex] : null;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [rect, setRect] = useState(null);
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const typeaheadRef = useRef({ buffer: "", at: 0 });

  const reactId = useId();
  const listId = `${id || "dd"}-${reactId}-list`;
  const optionId = index => `${listId}-opt-${index}`;

  useEffect(() => setMounted(true), []);

  /* Nupu asukoht ekraanil — loend on portaalis, seega ta ei "tea" nupust
     midagi peale selle mõõdu. Uuendame avamisel ja iga kerimise/mõõdu-
     muutuse peal, muidu jääks loend paigale, kui leht all liigub. */
  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, bottom: r.bottom });
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!open) return undefined;
    measure();
    const onScroll = () => measure();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, measure]);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    setActiveIndex(-1);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const commit = useCallback(
    index => {
      const option = items[index];
      if (!option || option.disabled) return;
      onChange?.(option.value);
      close();
    },
    [items, onChange, close]
  );

  /* Klikk väljaspool: kuulame pointerdown'i, mitte click'i — click jõuaks
     alles pärast seda, kui all olev nupp on juba oma toimingu käivitanud. */
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = event => {
      if (triggerRef.current?.contains(event.target)) return;
      if (listRef.current?.contains(event.target)) return;
      close(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, close]);

  /* Avades hüppab fookus loendile ja aktiivne rida on valitud väärtus. */
  useEffect(() => {
    if (!open) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    const raf = requestAnimationFrame(() => listRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open, selectedIndex]);

  /* Aktiivne rida hoitakse nähtaval ka siis, kui loend ise kerib. */
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current?.querySelector(`#${CSS.escape(optionId(activeIndex))}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = useCallback(
    delta => {
      if (!items.length) return;
      setActiveIndex(current => {
        let next = current;
        for (let i = 0; i < items.length; i += 1) {
          next = (next + delta + items.length) % items.length;
          if (!items[next]?.disabled) return next;
        }
        return current;
      });
    },
    [items]
  );

  const typeahead = useCallback(
    char => {
      const now = Date.now();
      const state = typeaheadRef.current;
      state.buffer = now - state.at > 900 ? char : state.buffer + char;
      state.at = now;
      const needle = state.buffer.toLowerCase();
      const found = items.findIndex(
        option => !option?.disabled && String(option?.label ?? "").toLowerCase().startsWith(needle)
      );
      if (found >= 0) setActiveIndex(found);
    },
    [items]
  );

  const onTriggerKeyDown = event => {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = event => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        step(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        step(-1);
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(items.findIndex(option => !option?.disabled));
        break;
      case "End":
        event.preventDefault();
        for (let i = items.length - 1; i >= 0; i -= 1) {
          if (!items[i]?.disabled) {
            setActiveIndex(i);
            break;
          }
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(activeIndex);
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "Tab":
        close(false);
        break;
      default:
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          typeahead(event.key);
        }
    }
  };

  /* Alla või üles: kumbal pool on rohkem ruumi. Lagi jääb alati ekraani
     sisse, nii et pikk loend kerib ISE, mitte ei kasva ekraanist välja. */
  const panelStyle = useMemo(() => {
    if (!rect) return null;
    const viewportH = typeof window === "undefined" ? 0 : window.innerHeight;
    const below = viewportH - rect.bottom - GAP;
    const above = rect.top - GAP;
    const flip = below < MIN_PANEL_H && above > below;
    return {
      position: "fixed",
      left: `${Math.round(rect.left)}px`,
      width: `${Math.round(rect.width)}px`,
      maxHeight: `${Math.max(MIN_PANEL_H, Math.round(flip ? above : below))}px`,
      ...(flip
        ? { bottom: `${Math.round(viewportH - rect.top + GAP)}px` }
        : { top: `${Math.round(rect.bottom + GAP)}px` })
    };
  }, [rect]);

  const label = selected?.label ?? placeholder ?? "";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open ? "true" : "false"}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-disabled={disabled ? "true" : undefined}
        disabled={disabled}
        /* TEADLIKULT ilma data-variant'ita: see nupp on VORMIVÄLI, mitte
           nupp. `data-variant` annaks talle glass.css-i nupumaterjali ja
           ta seisaks kõrvalolevatest inputitest eri ilmega. Materjali
           annab .dd-trigger, mis on glass.css-i input-primitiivi loendis. */
        data-placeholder={selected ? undefined : "true"}
        className={["dd-trigger", className].filter(Boolean).join(" ")}
        onClick={() => {
          if (!disabled) setOpen(current => !current);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="dd-value">{label}</span>
        <ChevronIcon direction="down" className="dd-caret" />
      </button>

      {name ? <input type="hidden" name={name} value={value ?? ""} readOnly /> : null}

      {mounted && open && panelStyle
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-label={ariaLabel}
              aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
              className="dd-panel"
              style={panelStyle}
              onKeyDown={onListKeyDown}
            >
              {items.map((option, index) => (
                <li
                  key={String(option?.value ?? index)}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === selectedIndex ? "true" : "false"}
                  aria-disabled={option?.disabled ? "true" : undefined}
                  data-active={index === activeIndex ? "true" : undefined}
                  className="dd-option"
                  onMouseEnter={() => {
                    if (!option?.disabled) setActiveIndex(index);
                  }}
                  onClick={() => commit(index)}
                >
                  <span>{option?.label}</span>
                </li>
              ))}
            </ul>,
            document.body
          )
        : null}
    </>
  );
}
