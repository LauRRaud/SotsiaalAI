"use client";

import { useEffect, useState } from "react";

import Button from "@/components/ui/Button";

/* Rea-toimingute ⋯ menüü (jagatud: KOV tabel, lähtepaketid).
   Fixed-positsioon nupu järgi, et tabeli overflow seda ära ei lõikaks;
   sulgub välisklikil, kerimisel ja Esc-iga. Avamisklikk võib fookusega
   kerimisala nihutada — esimesed 300ms scroll'i ignoreeritakse.
   items: [{ key, label, onSelect, disabled, title }] */
export default function RagRowMenu({ ariaLabel, items = [], size = "2xs" }) {
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!pos) return undefined;
    const close = () => setPos(null);
    const onScroll = () => {
      if (Date.now() - pos.openedAt < 300) return;
      close();
    };
    const onKey = event => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
    };
    window.addEventListener("click", close);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [pos]);

  const toggle = event => {
    event.stopPropagation();
    if (pos) {
      setPos(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const up = rect.bottom > window.innerHeight - 260;
    setPos({
      openedAt: Date.now(),
      left: Math.max(8, rect.right - 218),
      top: up ? undefined : rect.bottom + 4,
      bottom: up ? Math.max(8, window.innerHeight - rect.top + 4) : undefined
    });
  };

  return (
    <>
      <Button
        variant="default"
        size={size}
        aria-haspopup="menu"
        aria-expanded={pos ? "true" : "false"}
        aria-label={ariaLabel}
        onClick={toggle}
      >
        ⋯
      </Button>
      {pos ? (
        <div
          className="ra-menu"
          role="menu"
          aria-label={ariaLabel}
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}
          onClick={event => event.stopPropagation()}
        >
          {items.map(item => (
            <button
              type="button"
              role="menuitem"
              key={item.key || item.label}
              disabled={item.disabled}
              title={item.title}
              onClick={() => {
                setPos(null);
                item.onSelect?.();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
