"use client";

/**
 * JourneyText — saabumiskõnni tekstipeatus (teekonna-tekstid §stiil).
 * EELISTATUD: ILMA plaadita — tekst istub ruumis, loetavuse annab
 * peen kohalik toon + vari (CSS). `plate` ainult heleda ala (akna)
 * ette sattudes. position: "left" | "right" | "center" (walk_6 erand).
 */

import { forwardRef } from "react";

const JourneyText = forwardRef(function JourneyText(
  { position = "left", plate = false, children, ...props },
  ref
) {
  return (
    <p ref={ref} className={`room-text room-text--${position}`} {...props}>
      <span className={plate ? "room-text-body room-text-body--plate" : "room-text-body"}>
        {children}
      </span>
    </p>
  );
});

export default JourneyText;
