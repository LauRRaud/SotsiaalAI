"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";
import { decisionBody, emptyForm, formFrom } from "./decisionsRows";

/**
 * Kliendi otsused: olek ja päringud. Vaated on ühised (../client/PartViews.jsx),
 * kokku paneb need ./Decisions.jsx.
 *
 * Avatud vorm on `{ mode: "add" }` või `{ mode: "edit", id, version }`; korraga üks.
 */
export function useDecisions({ organizationId, client, initial }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(client.id)}/otsused`;

  const [current, setCurrent] = useState(initial.current || null);
  const [decisions, setDecisions] = useState(initial.decisions || []);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => emptyForm(initial.today));
  const [notice, setNotice] = useState("");

  const apply = (data) => {
    setCurrent(data.current || null);
    setDecisions(data.decisions || []);
  };
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const openAdd = () => {
    setForm(emptyForm(initial.today));
    setEditing({ mode: "add" });
    setNotice("");
    setError("");
  };
  const openEdit = (decision) => {
    setForm(formFrom(decision));
    setEditing({ mode: "edit", id: decision.id, version: decision.version });
    setNotice("");
    setError("");
  };
  const close = () => setEditing(null);

  /* Tagastab true, kui otsus on salvestatud. */
  const save = async () => {
    const body = decisionBody(form);
    const result =
      editing.mode === "edit"
        ? await call(`${base}/${encodeURIComponent(editing.id)}`, {
            method: "PATCH",
            body: { ...body, version: editing.version },
            fallbackKey: "home_care.errors.save_failed"
          })
        : await call(base, { method: "POST", body, fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return false;
    apply(result.data);
    setEditing(null);
    setNotice(t("home_care.decision.saved"));
    return true;
  };

  const retract = async (decision) => {
    const result = await call(`${base}/${encodeURIComponent(decision.id)}`, {
      method: "DELETE",
      body: { version: decision.version },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return false;
    apply(result.data);
    setNotice(t("home_care.decision.retracted_notice"));
    return true;
  };

  return { current, decisions, editing, form, notice, setField, openAdd, openEdit, close, save, retract, busy, error, setError };
}
