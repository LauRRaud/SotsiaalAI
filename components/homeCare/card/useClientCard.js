"use client";

import { useState } from "react";

import { CareCardLineKind } from "@/lib/homeCare/constants";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";

const EMPTY = Object.freeze({ lineId: "", kind: CareCardLineKind.ACCESS, text: "", forDriver: false });

/**
 * Püsikaart: olek ja päringud. Vaated on failis ./CardViews.jsx, kokku paneb need
 * ./ClientCard.jsx.
 *
 * Kaardi read hoiab leht (`lines`): sama seisu näitab ka vaade „Ukse taga".
 * Siin on ainult vorm: uus rida algab tühjalt, muudetav praeguste andmetega.
 */
export function useClientCard({ organizationId, clientId, onChange }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const [form, setForm] = useState({ ...EMPTY });

  const base = `${homeCareBase(organizationId)}/kliendid/${clientId}/kaart`;
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  /* Vorm algab rea praeguste andmetega; uus rida tühjalt. */
  const start = (line = null) => {
    setForm(line ? { lineId: line.id, kind: line.kind, text: line.text, forDriver: Boolean(line.forDriver) } : { ...EMPTY });
    setError("");
  };

  const save = async () => {
    const { kind, text, forDriver, lineId: editingId } = form;
    const result = editingId
      ? await call(`${base}/${editingId}`, { method: "PATCH", body: { kind, text, forDriver }, fallbackKey: "home_care.errors.save_failed" })
      : await call(base, { method: "POST", body: { kind, text, forDriver }, fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return false;
    onChange(result.data.card || []);
    return true;
  };

  const remove = async (lineId) => {
    const result = await call(`${base}/${lineId}`, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return false;
    onChange(result.data.card || []);
    return true;
  };

  return { form, setField, start, save, remove, busy, error, setError };
}
