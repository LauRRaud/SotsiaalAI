"use client";

import React from "react";
import CloseIcon from "@/components/brand/icons/CloseIcon";

export default function CloseButton({
  onClick,
  className = "",
  ariaLabel
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel || "Close"}
      className={className}
    >
      <CloseIcon width={12} height={12} />
    </button>
  );
}
