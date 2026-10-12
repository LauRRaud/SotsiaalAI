"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";
import { NEW_LINE, planBody, startFrom } from "./planEditorRows";

/**
 * Hoolduskava koostamine: olek ja päringud. Vaated on ühised
 * (../client/PartViews.jsx), kokku paneb need ./PlanEditor.jsx.
 *
 * Muudetakse MUSTANDIT; kehtiv kava jääb samaks, kuni mustand kehtestatakse.
 * Kehtestatakse see, mis ekraanil on: salvestamata muudatused salvestatakse enne.
 */
export function usePlanEditor({ organizationId, client, activities, initial }) {
  const { t } = useI18n();
  const { call, busy, error } = useHomeCareApi();
  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(client.id)}/kava`;

  const [active, setActive] = useState(initial.active || null);
  const [draft, setDraft] = useState(initial.draft || null);
  const [history, setHistory] = useState(initial.history || []);
  const [form, setForm] = useState(() => startFrom(initial.draft || initial.active, activities));
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState("");
  /* Kahe sammuga toimingud: "activate" | "discard" | null. */
  const [confirm, setConfirm] = useState(null);

  const touch = () => {
    setDirty(true);
    setNotice("");
    setConfirm(null);
  };
  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    touch();
  };
  const toggleLine = (activityId) => {
    setForm((current) => {
      const lines = { ...current.lines };
      if (lines[activityId]) delete lines[activityId];
      else lines[activityId] = { ...NEW_LINE };
      return { ...current, lines };
    });
    touch();
  };
  const setLine = (activityId, patch) => {
    setForm((current) => ({ ...current, lines: { ...current.lines, [activityId]: { ...current.lines[activityId], ...patch } } }));
    touch();
  };

  const body = () => planBody(form, activities, draft);

  const saveDraft = async () => {
    const result = await call(base, { method: "PUT", body: body(), fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return null;
    setDraft(result.data.draft);
    setDirty(false);
    return result.data.draft;
  };

  /* Tagastab true, kui mustand on salvestatud. */
  const save = async () => {
    if (!(await saveDraft())) return false;
    setNotice(t("home_care.plan.draft_saved"));
    return true;
  };

  const activate = async () => {
    /* Kehtestatakse see, mis ekraanil on: salvestamata muudatused salvestatakse enne. */
    const current = dirty || !draft ? await saveDraft() : draft;
    if (!current) return false;
    const result = await call(`${base}/kehtesta`, {
      method: "POST",
      body: { version: current.version },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return false;
    setActive(result.data.active);
    setDraft(null);
    setHistory(result.data.history || []);
    setForm(startFrom(result.data.active, activities));
    setDirty(false);
    setConfirm(null);
    setNotice(t("home_care.plan.activated"));
    return true;
  };

  const discard = async () => {
    if (draft) {
      const result = await call(base, { method: "DELETE", body: { version: draft.version }, fallbackKey: "home_care.errors.save_failed" });
      if (!result.ok) return false;
    }
    setDraft(null);
    setForm(startFrom(active, activities));
    setDirty(false);
    setConfirm(null);
    setNotice(t("home_care.plan.draft_discarded"));
    return true;
  };

  return { active, draft, history, form, dirty, notice, confirm, setConfirm, setField, toggleLine, setLine, save, activate, discard, busy, error };
}
