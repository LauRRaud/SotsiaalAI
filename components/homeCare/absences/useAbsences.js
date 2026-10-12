"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";
import { absenceBody, emptyForm, formFrom } from "./absenceRows";

/**
 * Töötajate puudumised: olek ja päringud. Vaated on ühised
 * (../client/PartViews.jsx), kokku paneb need ./Absences.jsx.
 *
 * Avatud vorm on `{ mode: "add" }` või `{ mode: "edit", id, version, name }`;
 * korraga üks.
 */
export function useAbsences({ organizationId, initial }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const base = `${homeCareBase(organizationId)}/puudumised`;

  const [absences, setAbsences] = useState(initial.absences || []);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => emptyForm(initial.today));
  const [notice, setNotice] = useState("");

  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const openAdd = () => {
    setForm(emptyForm(initial.today));
    setEditing({ mode: "add" });
    setNotice("");
    setError("");
  };
  const openEdit = (absence) => {
    setForm(formFrom(absence));
    setEditing({ mode: "edit", id: absence.id, version: absence.version, name: absence.name });
    setNotice("");
    setError("");
  };
  const close = () => setEditing(null);

  /* Tagastab true, kui puudumine on salvestatud. */
  const save = async () => {
    const body = absenceBody(form);
    const result =
      editing.mode === "edit"
        ? await call(`${base}/${encodeURIComponent(editing.id)}`, {
            method: "PATCH",
            body: { ...body, version: editing.version },
            fallbackKey: "home_care.errors.save_failed"
          })
        : await call(base, { method: "POST", body: { ...body, membershipId: form.membershipId }, fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return false;
    setAbsences(result.data.absences || []);
    setEditing(null);
    setNotice(t("home_care.absences.saved"));
    return true;
  };

  const remove = async (absence) => {
    const result = await call(`${base}/${encodeURIComponent(absence.id)}`, {
      method: "DELETE",
      body: { version: absence.version },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return false;
    setAbsences(result.data.absences || []);
    setNotice(t("home_care.absences.removed"));
    return true;
  };

  return { absences, editing, form, notice, setField, openAdd, openEdit, close, save, remove, busy, error, setError };
}
