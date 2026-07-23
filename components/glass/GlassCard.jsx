"use client";

/**
 * GlassCard — karusselli mattklaasist kaart (kujundusreeglid §2,
 * pilt 8/11). Fookus-/külgseisundi geomeetria annab vanem (li[--pos]);
 * kaart ise on alati sama klaas. href → <a>, muidu <button>.
 */

import { forwardRef } from "react";

const GlassCard = forwardRef(function GlassCard(
  { href, label, icon = null, longLabel = false, badge = null, badgeTone = null, children, ...props },
  ref
) {
  const Tag = href ? "a" : "button";
  const tagProps = Tag === "button" ? { type: "button" } : { href };
  return (
    <Tag ref={ref} className="gc-card" {...tagProps} {...props}>
      {icon ? (
        <span className="gc-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="gc-label" data-long={longLabel ? "1" : "0"}>
        {label ?? children}
      </span>
      {badge ? (
        <span className="gc-card-badge" data-tone={badgeTone || undefined}>
          {badge}
        </span>
      ) : null}
    </Tag>
  );
});

export default GlassCard;
