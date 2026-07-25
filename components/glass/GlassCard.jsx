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
      {/* Kaugusudu: ruumi enda õhk kaardi ja silma vahel. Tugevuse annab
          sügavuslaua aste (--gc-haze, carousel.css); karussellis on see 0
          ja kiht jääb nähtamatuks. Loori peab katma ka ikooni ja sildi —
          kaugusest ei tuhmu ainult taust —, seepärast on ta viimane. */}
      <span className="gc-haze" aria-hidden="true" />
    </Tag>
  );
});

export default GlassCard;
