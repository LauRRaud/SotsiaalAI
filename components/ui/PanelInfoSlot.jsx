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

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const PanelInfoSlotContext = createContext(null);

/**
 * Info-VAADE (omanik 26.07): ⓘ ei ole enam akna nurgas olev modaal, vaid
 * kiirmenüü kirje lehe nime kõrval — vajutus vahetab akna sisu info vastu
 * ja tagasi. Kaks eri puud peavad sama olekut nägema (dokk elab
 * RoomStage'is, aken PanelFrame'is), seega elab ta kontekstis ja provider
 * mähib app/layout.js-is MÕLEMAD.
 *
 * Eraldi kontekst (mitte sama mis slot) hoiab ära selle, et lahtiklõps
 * dokis renderdaks uuesti iga lehe, kes slot'i registreerib.
 */
const PanelInfoViewContext = createContext(null);

export function PanelInfoSlotProvider({ children }) {
  const [slot, setSlot] = useState(null);
  const [info, setInfo] = useState(null);
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ slot, setSlot }), [slot]);
  const viewValue = useMemo(
    () => ({ info, setInfo, open, setOpen }),
    [info, open]
  );
  return (
    <PanelInfoSlotContext.Provider value={value}>
      <PanelInfoViewContext.Provider value={viewValue}>
        {children}
      </PanelInfoViewContext.Provider>
    </PanelInfoSlotContext.Provider>
  );
}

/**
 * PanelFrame teatab, MILLINE info on praegusel lehel saadaval (marsruudi-
 * kaart või lehe registreeritud slot). Lehe vahetudes läheb info-vaade
 * ise kinni — muidu avaneks järgmine aken kellegi teise juhendi peal.
 */
export function usePublishPanelInfo({ infoId, title, label, detailExtras } = {}) {
  const context = useContext(PanelInfoViewContext);
  const setInfo = context?.setInfo;
  const setOpen = context?.setOpen;

  useEffect(() => {
    if (!setInfo) return undefined;
    setInfo(infoId ? { infoId, title, label, detailExtras } : null);
    return () => setInfo(null);
  }, [setInfo, infoId, title, label, detailExtras]);

  useEffect(() => {
    setOpen?.(false);
  }, [setOpen, infoId]);
}

/** Dokk ja aken loevad siit: mis info on olemas ja kas ta on lahti. */
export function usePanelInfoView() {
  const context = useContext(PanelInfoViewContext);
  const setOpen = context?.setOpen;
  const toggle = useCallback(() => setOpen?.((value) => !value), [setOpen]);
  const close = useCallback(() => setOpen?.(false), [setOpen]);
  const info = context?.info || null;
  const open = Boolean(context?.open && info);
  /* Memoiseeritud: seda lugevad komponendid (RoomStage'i handleSelect,
     PanelFrame'i Esc-effect) hoiavad teda deps-massiivis — uus viide igal
     renderdusel tähendaks kogu doki iga kaadri ümberehitust. */
  return useMemo(() => ({ info, open, toggle, close }), [info, open, toggle, close]);
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
