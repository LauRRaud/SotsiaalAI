"use client";

/**
 * GlassModal — kompaktne klaasmodaal (kujundusreeglid §2).
 * Sama klaas ja koht mis karusselli fookuskaardil: kaart avaneb
 * sisuks (nagu login). × ja Esc sisse ehitatud; väljaklikk sulgeb.
 * Katet ega hägu EI ole — ruum jääb nähtavale (tellija otsus).
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function GlassModal({ open, onClose, title, children }) {
  const shellRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    shellRef.current?.focus?.();
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="glass-modal-layer" onClick={onClose} role="presentation">
      <section
        className="glass-modal-shell"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={shellRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nurga-risti EI OLE (omanik 26.07): väljapääs on doki tagasi-
            noolel, ühes ja samas kohas nagu kõikjal mujal platvormil.
            Esc ja väljaklikk jäävad tööle. */}
        {title ? <h2 className="glass-modal-title">{title}</h2> : null}
        <div className="glass-modal-body">{children}</div>
      </section>
    </div>,
    document.body
  );
}
