"use client";

import { useState } from "react";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";

/**
 * Kliendi võtmed (K4-b): olek ja päringud. Vaated on failis ./KeysViews.jsx,
 * kokku paneb need ./ClientKeys.jsx.
 *
 * Mis võtmed asutuse käes on ja kelle käes iga võti praegu on. Võtme lisab ja
 * lõpetab hooldusjuht; üle annab hooldusjuht või see, kelle käes võti parajasti on.
 */
export function useClientKeys({ organizationId, clientId, initial = [], onChanged }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const [keys, setKeysState] = useState(initial || []);
  /* Leht hoiab sama seisu osade laua plaadi jaoks: muutus läheb ka sinna. */
  const setKeys = (next) => {
    setKeysState(next);
    onChanged?.(next);
  };
  const [form, setForm] = useState({ tag: "", label: "", holder: "" });

  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/votmed`;
  const setField = (name, value) => setForm((previous) => ({ ...previous, [name]: value }));

  /* Uus vorm (lisamine või üleandmine) algab tühjalt. */
  const start = () => {
    setForm({ tag: "", label: "", holder: "" });
    setError("");
  };

  const add = async () => {
    const result = await call(base, {
      method: "POST",
      body: { tag: form.tag, label: form.label, holderMembershipId: form.holder || null },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return false;
    setKeys(result.data.keys || []);
    return true;
  };

  const patch = async (key, body) => {
    const result = await call(`${base}/${encodeURIComponent(key.id)}`, { method: "PATCH", body, fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return false;
    setKeys(result.data.keys || []);
    return true;
  };

  return { keys, form, setField, start, add, patch, busy, error, setError };
}
