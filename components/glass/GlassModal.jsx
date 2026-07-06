"use client";

/**
 * GlassModal — kompaktne klaasmodaal (kujundusreeglid §2).
 * Sama klaas ja koht mis karusselli fookuskaardil: kaart avaneb
 * sisuks (nagu login). × ja Esc sisse ehitatud; väljaklikk sulgeb.
 * Katet ega hägu EI ole — ruum jääb nähtavale (tellija otsus).
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import IconButton from "@/components/glass/IconButton";
import CloseIcon from "@/components/brand/icons/CloseIcon";

export default function GlassModal({ open, onClose, title, closeLabel = "Sulge", children }) {
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
        <IconButton layoutClassName="glass-modal-close" aria-label={closeLabel} onClick={onClose}>
          <CloseIcon />
        </IconButton>
        {title ? <h2 className="glass-modal-title">{title}</h2> : null}
        <div className="glass-modal-body">{children}</div>
      </section>
    </div>,
    document.body
  );
}
