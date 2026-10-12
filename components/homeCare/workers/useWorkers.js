"use client";

import { useState } from "react";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";
import { emptyRecordForm } from "./workerRows";

/**
 * Töötajate kaardid: olek ja päringud. Vaated on ühised (../client/PartViews.jsx),
 * kokku paneb need ./Workers.jsx.
 *
 * `adding`: töötaja, kellele rida lisatakse, või tühi.
 */
export function useWorkers({ organizationId, initial }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const [cards, setCards] = useState(initial);
  const [adding, setAdding] = useState("");
  const [form, setForm] = useState(() => emptyRecordForm(initial.today));

  const base = `${homeCareBase(organizationId)}/tootajad`;
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const start = (membershipId) => {
    setForm({ kind: "", title: "", doneOn: cards.today, validUntil: "" });
    setError("");
    setAdding(membershipId);
  };
  const close = () => {
    setAdding("");
    setError("");
  };

  /* Tagastab true, kui rida on salvestatud. */
  const save = async () => {
    const result = await call(base, {
      method: "POST",
      body: { membershipId: adding, kind: form.kind, title: form.title, doneOn: form.doneOn, validUntil: form.validUntil || null },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return false;
    setCards(result.data);
    setAdding("");
    return true;
  };

  /* Tagastab true, kui rida on eemaldatud. */
  const remove = async (record) => {
    const result = await call(`${base}/${encodeURIComponent(record.id)}`, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) setCards(result.data);
    return result.ok;
  };

  return { cards, adding, form, setField, start, close, save, remove, busy, error, setError };
}
