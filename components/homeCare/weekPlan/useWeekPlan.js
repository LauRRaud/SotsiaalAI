"use client";

import { useState } from "react";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";

/**
 * Hooldusjuhi nädalaplaan: olek ja päring. Vaated on failis ./WeekViews.jsx,
 * kokku paneb need ./WeekPlan.jsx.
 */
export function useWeekPlan({ organizationId, initial }) {
  const { call, busy, error } = useHomeCareApi();
  const [data, setData] = useState(initial);

  /* Tagastab true, kui nädal on laaditud. */
  const load = async (week) => {
    const result = await call(`${homeCareBase(organizationId)}/nadal?nadal=${encodeURIComponent(week)}`, {
      fallbackKey: "home_care.errors.list_failed"
    });
    if (result.ok) setData(result.data);
    return result.ok;
  };

  return { data, load, busy, error };
}
