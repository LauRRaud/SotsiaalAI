"use client";

import { forwardRef } from "react";

const BackButton = forwardRef(function BackButton({
  onClick,
  ariaLabel,
  className,
  iconClassName: iconClassNameProp,
  holdPressedVisualDisabled = false,
  onPointerDown,
  onKeyDown,
  ...props
}, ref) {
  const handlePointerDown = event => {
    onPointerDown?.(event);
  };

  const handleKeyDown = event => {
    onKeyDown?.(event);
  };

  const handleClick = event => {
    onClick?.(event);
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      className={className}
      {...props}
    >
      <svg className={iconClassNameProp} viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 12H5" />
        <path d="M12 19l-7-7 7-7" />
      </svg>
    </button>
  );
});

BackButton.displayName = "BackButton";

export default BackButton;
