"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";
import { EMPTY_FORM, formFromSlot, slotFields, toggleWeekday } from "./slotEditorRows";

/**
 * Kliendi käigumuster: olek ja päringud. Vaated on ühised
 * (../client/PartViews.jsx), kokku paneb need ./SlotEditor.jsx.
 *
 * Avatud vorm on `{ mode: "add" }` või `{ mode: "edit", id, version, weekday }`;
 * korraga üks.
 */
export function useSlotEditor({ organizationId, client, initial }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(client.id)}/kaigud`;

  const [slots, setSlots] = useState(initial.slots || []);
  const [team, setTeam] = useState(initial.team || []);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [notice, setNotice] = useState("");

  const apply = (data) => {
    setSlots(data.slots || []);
    setTeam(data.team || []);
  };
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const toggleDay = (weekday) => setForm((previous) => ({ ...previous, weekdays: toggleWeekday(previous.weekdays, weekday) }));

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditing({ mode: "add" });
    setNotice("");
    setError("");
  };
  const openEdit = (slot) => {
    setForm(formFromSlot(slot));
    setEditing({ mode: "edit", id: slot.id, version: slot.version, weekday: slot.weekday });
    setNotice("");
    setError("");
  };
  const close = () => setEditing(null);

  /* Tagastab true, kui käik on salvestatud. */
  const save = async () => {
    const fields = slotFields(form);
    const result =
      editing.mode === "edit"
        ? await call(`${base}/${encodeURIComponent(editing.id)}`, {
            method: "PATCH",
            body: { ...fields, version: editing.version },
            fallbackKey: "home_care.errors.save_failed"
          })
        : await call(base, { method: "POST", body: { ...fields, weekdays: form.weekdays }, fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return false;
    apply(result.data);
    setEditing(null);
    setNotice(t("home_care.slots.saved"));
    return true;
  };

  const end = async (slot) => {
    const result = await call(`${base}/${encodeURIComponent(slot.id)}`, {
      method: "DELETE",
      body: { version: slot.version },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return false;
    apply(result.data);
    setNotice(t("home_care.slots.ended"));
    return true;
  };

  return { slots, team, editing, form, notice, setField, toggleDay, openAdd, openEdit, close, save, end, busy, error, setError };
}
