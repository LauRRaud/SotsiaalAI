"use client";

import { forwardRef } from "react";
import { cn } from "@/components/ui/cn";

const Button = forwardRef(function Button({
  as = "button",
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  disabled = false,
  glow = variant === "primary",
  onClick,
  style,
  tabIndex,
  type,
  children,
  ...props
}, ref) {
  const Component = as === "a" ? "a" : "button";
  const isDisabled = Boolean(disabled);
  const handleClick = event => {
    if (isDisabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onClick?.(event);
  };
  const sharedProps = {
    href: as === "a" ? href : undefined,
    type: as === "button" ? type ?? "button" : undefined,
    "aria-disabled": isDisabled ? "true" : undefined,
    tabIndex: as === "a" && isDisabled ? -1 : tabIndex,
    disabled: as === "button" ? isDisabled : undefined,
    "data-variant": variant,
    "data-size": size,
    "data-glow": glow ? "true" : undefined,
    className: cn(fullWidth ? "w-full" : null, className),
    onClick: handleClick,
    style,
    ...props
  };

  return (
    <Component ref={ref} {...sharedProps}>
      {children}
    </Component>
  );
});

export default Button;
