"use client";

import { useEffect, useRef } from "react";

/**
 * Kliendi lehe osa, mis hoiab ees ühte vaadet korraga: kui osa sees vaade
 * vahetub, algab paneel ülalt ja fookus läheb uue vaate pealkirjale, et
 * ekraanilugeja ja klaviatuur jõuaksid kaasa. Esimesel joonistusel fookust ei
 * võeta. Tagastab viite, mille osa paneb oma ümbrisele.
 */
export function useScreenFocus(screen) {
  const rootRef = useRef(null);
  const shown = useRef(screen);
  useEffect(() => {
    if (shown.current === screen) return;
    shown.current = screen;
    rootRef.current?.closest(".panel-body")?.scrollTo({ top: 0 });
    rootRef.current?.querySelector("[data-step-heading]")?.focus({ preventScroll: true });
  }, [screen]);
  return rootRef;
}
