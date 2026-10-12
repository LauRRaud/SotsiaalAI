"use client";

import { useState } from "react";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";

/**
 * Asutuse toimingute kataloog: olek ja päringud. Vaated on ühised
 * (../client/PartViews.jsx), kokku paneb need ./Activities.jsx.
 *
 * Avatud vorm on `{ mode: "add", group }` või `{ mode: "edit", id }`; korraga üks.
 */
export function useActivities({ organizationId, initial }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const base = `${homeCareBase(organizationId)}/toimingud`;

  const [activities, setActivities] = useState(initial?.activities || []);
  const [form, setForm] = useState(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [group, setGroup] = useState("");

  const openAdd = (targetGroup) => {
    setForm({ mode: "add", group: targetGroup });
    setName("");
    setNote("");
    setGroup(targetGroup);
    setError("");
  };
  const openEdit = (item) => {
    setForm({ mode: "edit", id: item.id });
    setName(item.name);
    setNote(item.note || "");
    setGroup(item.group);
    setError("");
  };
  const closeForm = () => setForm(null);

  const upsert = (item) =>
    setActivities((current) => (current.some((row) => row.id === item.id) ? current.map((row) => (row.id === item.id ? item : row)) : [...current, item]));

  /* Tagastab salvestatud toimingu või null. */
  const save = async () => {
    if (!form || !name.trim()) return null;
    const editing = form.mode === "edit" ? activities.find((item) => item.id === form.id) : null;
    const result = editing
      ? await call(`${base}/${encodeURIComponent(editing.id)}`, {
          method: "PATCH",
          body: { name, note, group, version: editing.version },
          fallbackKey: "home_care.errors.save_failed"
        })
      : await call(base, { method: "POST", body: { name, note, group }, fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return null;
    upsert(result.data.activity);
    closeForm();
    return result.data.activity;
  };

  /* Tagastab true, kui toiming on arhiveeritud (value tõene) või taastatud. */
  const setArchived = async (item, value) => {
    const result = await call(`${base}/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      body: { archived: value, version: item.version },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (result.ok) upsert(result.data.activity);
    return result.ok;
  };

  /* Tagastab true, kui algne loend on lisatud. */
  const seed = async () => {
    const result = await call(base, { method: "POST", body: { seed: true }, fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) setActivities(result.data.activities);
    return result.ok;
  };

  return { activities, form, name, setName, note, setNote, group, setGroup, openAdd, openEdit, closeForm, save, setArchived, seed, busy, error, setError };
}
