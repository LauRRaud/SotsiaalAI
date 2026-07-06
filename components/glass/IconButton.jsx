"use client";

/**
 * IconButton — ainult-ikoon klaasnupp (kujundusreeglid §3: variant "icon").
 * aria-label on KOHUSTUSLIK; ilma selleta hoiatab arendusrežiimis.
 * Ikoon tuleb components/brand kaustast (currentColor), mõõt tokenist.
 */

import { forwardRef } from "react";

const IconButton = forwardRef(function IconButton(
  { "aria-label": ariaLabel, layoutClassName, children, type = "button", ...props },
  ref
) {
  if (process.env.NODE_ENV !== "production" && !ariaLabel) {
    console.warn("IconButton: aria-label puudub — ikoonnupp vajab alati nime.");
  }
  const className = ["glass-iconbtn", layoutClassName].filter(Boolean).join(" ");
  return (
    <button ref={ref} type={type} className={className} aria-label={ariaLabel} {...props}>
      {children}
    </button>
  );
});

export default IconButton;
