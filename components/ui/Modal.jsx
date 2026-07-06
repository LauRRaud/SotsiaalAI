"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/components/ui/cn";
export default function Modal({
  open = false,
  variant = "default",
  onClose,
  children,
  className,
  contentClassName,
  contentRef,
  closeOnOverlayClick = true,
  ...props
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  if (!open) return null;
  if (!mounted || typeof document === "undefined") return null;
  const modal = <div data-variant={variant} className={cn(className)} role="presentation" onClick={event => {
    if (!closeOnOverlayClick) return;
    if (event.target === event.currentTarget) onClose?.(event);
  }}>
      <div ref={contentRef} role="dialog" aria-modal="true" className={cn(contentClassName)} {...props}>
        {children}
      </div>
    </div>;
  return createPortal(modal, document.body);
}
