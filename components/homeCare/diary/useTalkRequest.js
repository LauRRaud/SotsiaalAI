"use client";

import { useState } from "react";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";

/**
 * „Soovin sellest rääkida" (K6-k) raske erijuhtumi juures: olek ja päringud.
 *
 * Autor annab ühe puudutusega teada, et soovib juhtumist rääkida; teksti ei
 * küsita. Soovi näevad ainult tema ise ja hooldusjuht. Hooldusjuht märgib, et
 * rääkimine on toimunud; mida räägiti, ei kirjutata.
 *
 * Vaade: avatud kirje kliendi lehel (`./EntryOpen.jsx`). Hooldusjuhi loend
 * kõigist soovidest on omaette (`../deadlines/Deadlines.jsx`).
 */
export function useTalkRequest({ organizationId, clientId, entryId, initial = null }) {
  const { call, busy, error } = useHomeCareApi();
  const [talk, setTalk] = useState(initial);

  const entryBase = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/kirjed/${encodeURIComponent(entryId)}/raagime`;
  const run = async (url, method) => {
    const result = await call(url, { method, fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) setTalk(result.data.talk || null);
  };

  return {
    busy,
    error,
    talk,
    ask: () => run(entryBase, "POST"),
    withdraw: () => run(entryBase, "DELETE"),
    handle: () => run(`${homeCareBase(organizationId)}/raagime/${encodeURIComponent(talk.id)}`, "PATCH")
  };
}
