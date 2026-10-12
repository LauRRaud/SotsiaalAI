"use client";

import { useState } from "react";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";

/**
 * Lahtised soovid „soovin sellest rääkida" (K6-k) tähtaegade lehel: olek ja
 * päring. Vaated on ühised (../client/PartViews.jsx), kokku paneb need
 * ./Deadlines.jsx. Hooldusjuht märgib, et rääkimine on toimunud; märgitud soov
 * kaob nimekirjast.
 */
export function useTalkRequests({ organizationId, initial = [] }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const [items, setItems] = useState(initial || []);

  /* Tagastab true, kui rääkimine on märgitud. */
  const handled = async (item) => {
    const result = await call(`${homeCareBase(organizationId)}/raagime/${encodeURIComponent(item.id)}`, { method: "PATCH", fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) setItems((current) => current.filter((row) => row.id !== item.id));
    return result.ok;
  };

  return { items, handled, busy, error, setError };
}
