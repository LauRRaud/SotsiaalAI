"use client";

import { useState } from "react";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";

/**
 * Kõnede loendur: kuu andmed ja kuu vahetus. Vaated on ühised
 * (../client/PartViews.jsx), kokku paneb need ./Calls.jsx.
 */
export function useCalls({ organizationId, initial }) {
  const { call, busy, error } = useHomeCareApi();
  const [data, setData] = useState(initial);

  /* Tagastab true, kui kuu on laaditud. */
  const load = async (month) => {
    if (!month) return false;
    const result = await call(`${homeCareBase(organizationId)}/koned?kuu=${encodeURIComponent(month)}`, {
      fallbackKey: "home_care.errors.list_failed"
    });
    if (result.ok) setData(result.data);
    return result.ok;
  };

  return { data, load, busy, error };
}
