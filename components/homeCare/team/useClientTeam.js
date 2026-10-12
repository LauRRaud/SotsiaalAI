"use client";

import { useState } from "react";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";

/**
 * Meeskond: olek ja päringud. Vaated on failis ./TeamViews.jsx, kokku paneb need
 * ./ClientTeam.jsx.
 *
 * Meeskonna rida hoiab leht (`team`): sama seisu kasutavad ka kirje sammud ja
 * osade laua plaat. Siin on ainult see, mis on osal oma: töötajate valik ja
 * valitud töötaja. Valik laaditakse alles siis, kui hooldusjuht hakkab kedagi
 * lisama: kliendi lehe avamine ei pea iga kord kogu asutuse nimekirja tooma.
 */
export function useClientTeam({ organizationId, clientId, onChange }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const [candidates, setCandidates] = useState(null);
  const [selected, setSelected] = useState("");

  const base = `${homeCareBase(organizationId)}/kliendid/${clientId}/meeskond`;

  const loadCandidates = async () => {
    const result = await call(`${homeCareBase(organizationId)}/liikmed`, { fallbackKey: "home_care.errors.list_failed" });
    if (!result.ok) return false;
    setCandidates(result.data.members || []);
    return true;
  };

  const add = async () => {
    if (!selected) return false;
    const result = await call(base, {
      method: "POST",
      body: { membershipId: selected },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return false;
    onChange(result.data.team || []);
    setSelected("");
    return true;
  };

  const remove = async (membershipId) => {
    const result = await call(`${base}/${membershipId}`, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return false;
    onChange(result.data.team || []);
    return true;
  };

  return { candidates, selected, setSelected, loadCandidates, add, remove, busy, error, setError };
}
