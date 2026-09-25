"use client";

/**
 * GlassCard — karusselli mattklaasist kaart (kujundusreeglid §2,
 * pilt 8/11). Fookus-/külgseisundi geomeetria annab vanem (li[--pos]);
 * kaart ise on alati sama klaas. href → <a>, muidu <button>.
 */

import { forwardRef, useLayoutEffect, useRef, useState } from "react";

const SVG_NS = "http://www.w3.org/2000/svg";
const SHAPES = "path, circle, rect, line, polyline, polygon, ellipse";

/* Kaardi-ikoon PILDINA (mask-image), mitte inline-vektorina (omanik 25.09:
   „SVG failid peaks ikka sirge servaga olema, ikka on sakiline", Windows
   125 %). GPU-ga Chrome silub inline-SVG kõveraid MSAA-ga ja murdosalise
   ekraaniskaala juures jäävad servad astmeliseks; pildina rasterdab
   brauser SVG sihtsuuruses täieliku servasilumisega — nii nagu komposeri
   mikrofoniikooni (chat.css --glyph). Inline-SVG jääb DOM-i: tema mõõdust
   tuleb ikooni kast ja tema arvutatud joonepaksused (ka CSS-i ülekirjutused
   ja ScaledGroup'i kompensatsioon) küpsetatakse maski sisse. Värv tuleb
   endiselt currentColor'ist, seega hover ja toonid ei muutu. */
function useIconMask(ref, deps) {
  const [mask, setMask] = useState(null);
  useLayoutEffect(() => {
    const svg = ref.current?.querySelector("svg");
    if (!svg) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", SVG_NS);
    clone.removeAttribute("class");
    clone.removeAttribute("style");
    const src = svg.querySelectorAll(SHAPES);
    const dst = clone.querySelectorAll(SHAPES);
    src.forEach((el, i) => {
      const cs = getComputedStyle(el);
      const target = dst[i];
      const width = parseFloat(String(cs.strokeWidth).replace(/[^\d.]/g, ""));
      if (cs.stroke && cs.stroke !== "none") {
        target.setAttribute("stroke", "#000");
        if (Number.isFinite(width)) target.setAttribute("stroke-width", String(width));
      }
      target.setAttribute("fill", cs.fill && cs.fill !== "none" ? "#000" : "none");
    });
    const next = `url("data:image/svg+xml,${encodeURIComponent(clone.outerHTML)}")`;
    setMask((prev) => (prev === next ? prev : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return mask;
}

function CardIcon({ icon }) {
  const ref = useRef(null);
  const mask = useIconMask(ref, [icon]);
  return (
    <span
      ref={ref}
      className="gc-icon"
      aria-hidden="true"
      data-raster={mask ? "1" : undefined}
      style={mask ? { "--gc-icon-mask": mask } : undefined}
    >
      {icon}
      {mask ? <span className="gc-icon-raster" /> : null}
    </span>
  );
}

const GlassCard = forwardRef(function GlassCard(
  { href, label, icon = null, longLabel = false, badge = null, badgeTone = null, children, ...props },
  ref
) {
  const Tag = href ? "a" : "button";
  const tagProps = Tag === "button" ? { type: "button" } : { href };
  return (
    <Tag ref={ref} className="gc-card" {...tagProps} {...props}>
      <span className="gc-card-surface" aria-hidden="true" />
      {icon ? <CardIcon icon={icon} /> : null}
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
