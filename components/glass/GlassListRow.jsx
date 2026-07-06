"use client";

/**
 * GlassListRow — Töölaua ruudustiku rida: kontuurikoon + nimi (+ meta).
 * Pilt 10 etalon. Ikoon components/brand kaustast, "graveeringuna" klaasil.
 */

import { forwardRef } from "react";

const GlassListRow = forwardRef(function GlassListRow(
  { icon = null, label, meta = null, as, href, layoutClassName, children, ...props },
  ref
) {
  const Tag = as || (href ? "a" : "button");
  const tagProps = Tag === "button" ? { type: "button" } : { href };
  const className = ["glass-listrow", layoutClassName].filter(Boolean).join(" ");
  return (
    <Tag ref={ref} className={className} {...tagProps} {...props}>
      {icon ? (
        <span className="glass-listrow-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="glass-listrow-label">{label ?? children}</span>
      {meta ? <span className="glass-listrow-meta">{meta}</span> : null}
    </Tag>
  );
});

export default GlassListRow;
