"use client";

/**
 * PanelInfoSlot — üks ⓘ paneeli kohta, aga sisu tuleb lehelt.
 *
 * Probleem, mida see lahendab: ⓘ peab elama paneeli nurgas × kõrval
 * (PanelFrame, väljaspool kerivat .panel-body), aga see, MIDA ta näitab, on
 * sageli teada ainult lehel:
 *   - /eelpoordumised sisu sõltub ROLLIST (pöördujale "pre_inquiry",
 *     spetsialistile "intake") — staatiline marsruudikaart seda ei tea;
 *   - /documents ⓘ kannab elavat lisapaneeli (detailExtras);
 *   - /vestlus?workspace=X sisu sõltub avatud moodulist;
 *   - /teekond/[id] ja /tooheaolu/[tool] pole marsruudikaardis üldse.
 *
 * Varem renderdas leht SELLEKS oma teise ⓘ — tulemuseks kaks ikooni
 * (üks nurgas, teine sisuvoos). Nüüd: leht KUTSUB usePanelInfoSlot'i ja
 * PanelFrame'i ainus ⓘ näitab lehe sisu.
 *
 * NB: `detailExtras` peab olema memoiseeritud (useMemo) — muidu uus viide
 * igal renderdusel paneb effecti lõputult uuesti registreerima.
 */

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const PanelInfoSlotContext = createContext(null);

export function PanelInfoSlotProvider({ children }) {
  const [slot, setSlot] = useState(null);
  const value = useMemo(() => ({ slot, setSlot }), [slot]);
  return (
    <PanelInfoSlotContext.Provider value={value}>
      {children}
    </PanelInfoSlotContext.Provider>
  );
}

/**
 * Leht registreerib, mida paneeli ⓘ peab näitama. `active=false` jätab
 * registreerimata (nt manustatud režiimis, kus ⓘ omanik on Töölaud).
 */
export function usePanelInfoSlot({
  infoId,
  title,
  label,
  detailExtras,
  active = true
} = {}) {
  const context = useContext(PanelInfoSlotContext);
  const setSlot = context?.setSlot;

  useEffect(() => {
    if (!setSlot || !active || !infoId) return undefined;
    setSlot({ infoId, title, label, detailExtras });
    return () => setSlot(null);
  }, [setSlot, active, infoId, title, label, detailExtras]);
}

/** PanelFrame loeb siit; null → kasuta staatilist marsruudikaarti. */
export function usePanelInfoSlotValue() {
  return useContext(PanelInfoSlotContext)?.slot || null;
}
