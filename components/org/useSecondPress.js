"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CONFIRM_MS, secondPress } from "./orgRules";

/**
 * Tegevus, mis küsib teist vajutust SAMAL nupul (lõpetamine, tagasivõtmine,
 * arhiveerimine, kirjutatust loobumine).
 *
 * `press(key, action)`: esimene vajutus paneb nupu kinnitust küsima (`armed`
 * on siis see võti), teine teeb tegevuse. Topeltklõpsu teine vajutus ei loe,
 * teise tegevuse vajutus viib küsimuse sinna üle ja küsimus aegub ise.
 * `clear()` võtab küsimuse maha (nt kui inimene kirjutab edasi).
 *
 * Otsus ise on puhas funktsioon `secondPress` failis ./orgRules.js.
 */
export function useSecondPress() {
  const [armed, setArmed] = useState("");
  const armedAt = useRef(0);

  useEffect(() => {
    if (!armed) return undefined;
    const timer = window.setTimeout(() => setArmed(""), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);

  const press = useCallback(
    (key, action) => {
      const step = secondPress(armed, key, armedAt.current);
      if (step === "wait") return;
      if (step === "arm") {
        armedAt.current = Date.now();
        setArmed(key);
        return;
      }
      setArmed("");
      action?.();
    },
    [armed]
  );
  const clear = useCallback(() => setArmed(""), []);

  return { armed, press, clear };
}
