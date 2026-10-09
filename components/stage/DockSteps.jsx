"use client";

/**
 * DockSteps — lehe sammud alumises kiirmenüüs.
 *
 * MIKS. Sammuriba ei ela klaaspaneeli sees (omanik 09.10: paneel on sisu jaoks;
 * sammude ülevaade on kas eraldi aken või ühendatud all oleva kiirmenüüga).
 * Kiirmenüü (dokk) elab aga RoomStage'is, leht PanelFrame'is: kaks eri puud.
 *
 * KUIDAS. Dokk renderdab tühja pesa (`DockStepsOutlet`) ja annab selle elemendi
 * siia konteksti. Leht joonistab oma sammuriba portaaliga sellesse pessa
 * (`useDockStepsSlot`), nii et sammude olek ja vajutused jäävad lehe enda koodi
 * ja dokk ei pea lehest midagi teadma.
 *
 * `hasDock`: kas sellel lehel on dokk üldse olemas (RoomStage ütleb). Kui ei ole
 * (lõuendid, laiad tööpinnad), joonistab leht sammuriba ise ekraani alla.
 *
 * Provider on app/layout.js-is ja mähib nii ruumi kui lehe.
 */

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const DockStepsContext = createContext(null);

export function DockStepsProvider({ children }) {
  const [slot, setSlot] = useState(null);
  const [hasDock, setHasDock] = useState(false);
  const value = useMemo(() => ({ slot, setSlot, hasDock, setHasDock }), [slot, hasDock]);
  return <DockStepsContext.Provider value={value}>{children}</DockStepsContext.Provider>;
}

/** Dokk: pesa, kuhu leht oma sammud joonistab. Tühjana ei võta ruumi. */
export function DockStepsOutlet() {
  const setSlot = useContext(DockStepsContext)?.setSlot;
  return <div className="gc-dock-steps" ref={setSlot} />;
}

/** RoomStage: kas praegusel lehel on dokk. */
export function useAnnounceDock(present) {
  const setHasDock = useContext(DockStepsContext)?.setHasDock;
  useEffect(() => {
    if (!setHasDock) return undefined;
    setHasDock(Boolean(present));
    return () => setHasDock(false);
  }, [setHasDock, present]);
}

/** Leht: `{ slot, hasDock }`. `slot` on null, kuni dokk on peidus (nt modaali ajal). */
export function useDockStepsSlot() {
  const context = useContext(DockStepsContext);
  return { slot: context?.slot || null, hasDock: Boolean(context?.hasDock) };
}
