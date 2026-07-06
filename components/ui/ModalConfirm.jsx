"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { cn } from "@/components/ui/cn";
export default function ModalConfirm({
  message,
  children = null,
  confirmLabel = "Jah",
  confirmVariant = "primary",
  cancelLabel = "Katkesta",
  cancelVariant = "secondary",
  onConfirm,
  onCancel,
  disabled = false,
  busy = false,
  busyLabel = "",
  actionsClassName = "",
  overlayClassName = "",
  contentClassName = ""
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && onCancel && !disabled) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, disabled]);
  const modal = <Modal open onClose={onCancel} closeOnOverlayClick={false} aria-label={typeof message === "string" ? message : "Confirm dialog"} className={cn(overlayClassName)} contentClassName={cn(contentClassName)}>
      {!busy ? <p>{message}</p> : null}
      {!busy && children ? children : null}
      {busy ? <div role="status" aria-live="polite" aria-atomic="true">
          {busyLabel ? <span>{busyLabel}</span> : null}
        </div> : <div className={cn(actionsClassName)}>
          <Button type="button" size="sm" variant={confirmVariant} onClick={onConfirm} disabled={disabled}>
            <span>{confirmLabel}</span>
          </Button>
          {cancelLabel ? <Button type="button" size="sm" variant={cancelVariant} onClick={onCancel} disabled={disabled}>
              <span>{cancelLabel}</span>
            </Button> : null}
        </div>}
    </Modal>;
  return createPortal(modal, document.body);
}
