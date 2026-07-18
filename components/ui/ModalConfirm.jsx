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
  // Escape is handled by Modal; a busy or disabled confirm must not be
  // dismissible so a pending action (e.g. account deletion) can't be aborted.
  const modal = <Modal open onClose={onCancel} closeOnOverlayClick={false} closeOnEscape={!busy && !disabled} aria-label={typeof message === "string" ? message : "Confirm dialog"} className={cn(overlayClassName)} contentClassName={cn(contentClassName)}>
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
