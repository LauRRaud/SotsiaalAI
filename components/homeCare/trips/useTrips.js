"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { composeTripSheet } from "@/lib/homeCare/tripSheet";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";
import { planDayLabel } from "../plan/planRows";
import { newTripForm } from "./tripRows";

/**
 * Sõidupäevik: olek ja päringud. Vaated on ühised (../client/PartViews.jsx),
 * kokku paneb need ./Trips.jsx.
 *
 * `mode`: null | "new" | { retract: id }; korraga üks.
 */
export function useTrips({ organizationId, initial }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const [data, setData] = useState(initial);
  const [mode, setMode] = useState(null);
  const [form, setForm] = useState({});
  const base = `${homeCareBase(organizationId)}/soidud`;
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  /* Tagastab true, kui kuu on laaditud. */
  const load = async (month) => {
    if (!month) return false;
    const result = await call(`${base}?kuu=${encodeURIComponent(month)}`, { fallbackKey: "home_care.errors.list_failed" });
    if (result.ok) setData(result.data);
    return result.ok;
  };

  const startNew = () => {
    setForm(newTripForm(data));
    setError("");
    setMode("new");
  };
  const startRetract = (trip) => {
    setForm({ reason: "" });
    setError("");
    setMode({ retract: trip.id });
  };
  const close = () => {
    setMode(null);
    setError("");
  };

  /* Tagastab true, kui sõit on salvestatud. */
  const add = async () => {
    const result = await call(base, { method: "POST", body: form, fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return false;
    setData(result.data);
    setMode(null);
    return true;
  };
  /* Tagastab true, kui sõit on tühistatud. */
  const retract = async () => {
    const result = await call(`${base}/${encodeURIComponent(mode.retract)}`, { method: "PATCH", body: { reason: form.reason }, fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return false;
    setData(result.data);
    setMode(null);
    return true;
  };

  /* Kuu sõidupäevik tabelifailina raamatupidamisele. */
  const download = () => {
    const text = composeTripSheet(t, { month: data.month, trips: data.all.trips, workers: data.all.workers }, { day: planDayLabel });
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `soidupaevik-${data.month}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return { data, mode, form, setField, load, startNew, startRetract, close, add, retract, download, busy, error, setError };
}
