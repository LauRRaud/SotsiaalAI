"use client";

import { useState } from "react";

import { CARE_SUPPLY_KINDS } from "@/lib/homeCare/constants";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";

/**
 * Varud kliendi kodus (K4-e): olek ja päringud. Vaated on failis
 * ./SuppliesViews.jsx, kokku paneb need ./ClientSupplies.jsx.
 *
 * Küttepuud, joogivesi, toit, hügieenitarbed. Seisu märgib ühe puudutusega igaüks,
 * kes kliendi juures käib; mis varusid jälgitakse ja kes neid täiendab, paneb paika
 * hooldusjuht. Märkuse saab lisada pärast seisu valimist.
 */
export function useClientSupplies({ organizationId, clientId, initial = [], onChanged }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const [supplies, setSuppliesState] = useState(initial || []);
  /* Leht hoiab sama seisu osade laua plaadi jaoks: muutus läheb ka sinna. */
  const setSupplies = (next) => {
    setSuppliesState(next);
    onChanged?.(next);
  };
  const [form, setForm] = useState({ kind: "", responsible: "", note: "" });

  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/varud`;
  const setField = (name, value) => setForm((previous) => ({ ...previous, [name]: value }));
  const free = CARE_SUPPLY_KINDS.filter((kind) => !supplies.some((supply) => supply.kind === kind));

  const send = async (url, options) => {
    const result = await call(url, { fallbackKey: "home_care.errors.save_failed", ...options });
    if (!result.ok) return false;
    setSupplies(result.data.supplies || []);
    return true;
  };

  const mark = (supply, state, note) => send(`${base}/${encodeURIComponent(supply.id)}`, { method: "PATCH", body: { state, note: note || null } });
  const track = () => send(base, { method: "POST", body: { kind: form.kind, responsible: form.responsible } });
  const untrack = (supply) => send(`${base}/${encodeURIComponent(supply.id)}`, { method: "DELETE" });

  const startTrack = () => {
    setForm({ kind: free[0] || "", responsible: "", note: "" });
    setError("");
  };

  const startNote = (supply) => {
    setForm({ kind: "", responsible: "", note: supply.stateNote || "" });
    setError("");
  };

  return { supplies, form, setField, free, mark, track, untrack, startTrack, startNote, busy, error, setError };
}
