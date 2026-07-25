"use client";

/**
 * PanelExit — paneeli väljapääs, mille saab kutsuda ka LEHT ise.
 *
 * Probleem, mida see lahendab: sulgemisloogika ei ole üks `router.push`.
 * PanelFrame'i `closePanel` teab, kas leht avati töölaualt (siis tagasi
 * töölauale, mitte ruumi), kas ta on profiili alamkaart (siis profiili
 * karusselli) ja millisest hubist ta üldse avati. Kui leht tahab oma
 * dokki tagasi-noolt (nt Hinnastus, kus nurga-risti enam ei ole —
 * omanik 26.07), ei tohi ta seda loogikat ise uuesti kirjutada: kaks
 * koopiat oleks kaks tõde ja üks neist läheks vaikselt valeks.
 *
 * Sama kuju nagu PanelInfoSlot'il, ainult suund vastupidine: seal
 * annab leht paneelile SISU, siin annab paneel lehele TEGEVUSE.
 *
 * Väljaspool paneeli (nt manustatud režiimis) tagastab hook null —
 * kutsuja peab siis ise otsustama, mida tagasi tähendab.
 */

import { createContext, useContext } from "react";

const PanelExitContext = createContext(null);

export function PanelExitProvider({ close, children }) {
  return <PanelExitContext.Provider value={close}>{children}</PanelExitContext.Provider>;
}

export function usePanelExit() {
  return useContext(PanelExitContext);
}
