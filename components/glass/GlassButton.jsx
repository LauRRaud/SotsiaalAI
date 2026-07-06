"use client";

/**
 * GlassButton — klaasikeele nupp (kujundusreeglid §2–3).
 *
 * Suletud variandikomplekt: "default" | "primary". Ikoonnupu jaoks on
 * eraldi primitiiv (IconButton). Vale variant normaliseerub default'iks
 * ja hoiatab arendusrežiimis. Välimust muutvat className'i EI võeta
 * vastu — lubatud on ainult paigutusklass (`layoutClassName`).
 * Kõik toonid/tempod tulevad tokenitest (glass.css).
 */

import { forwardRef } from "react";

const VARIANTS = new Set(["default", "primary"]);

const GlassButton = forwardRef(function GlassButton(
  {
    variant = "default",
    as,
    href,
    type = "button",
    layoutClassName,
    children,
    ...props
  },
  ref
) {
  let resolved = variant;
  if (!VARIANTS.has(resolved)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`GlassButton: tundmatu variant "${variant}" → "default".`);
    }
    resolved = "default";
  }
  const className = ["glass-btn", layoutClassName].filter(Boolean).join(" ");
  const Tag = as || (href ? "a" : "button");
  const tagProps = Tag === "button" ? { type } : { href };
  return (
    <Tag ref={ref} className={className} data-variant={resolved} {...tagProps} {...props}>
      {children}
    </Tag>
  );
});

export default GlassButton;
