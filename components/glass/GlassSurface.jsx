/**
 * GlassSurface — klaasi baaspind (kujundusreeglid §2).
 * Toon/hägu/ääre-kuma tokenitest; "strong" = kaetum pind (loetavus).
 * className'i välimuse muutmiseks ei võeta — ainult paigutusklass.
 */

import { forwardRef } from "react";

const GlassSurface = forwardRef(function GlassSurface(
  { strong = false, room = false, as: Tag = "div", layoutClassName, children, ...props },
  ref
) {
  const className = [
    "glass-surface",
    strong ? "glass-surface--strong" : null,
    room ? "glass-surface--room" : null,
    layoutClassName,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag ref={ref} className={className} {...props}>
      {children}
    </Tag>
  );
});

export default GlassSurface;
