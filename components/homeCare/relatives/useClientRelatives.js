"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";

const EMPTY = Object.freeze({ relativeId: "", name: "", relation: "", phone: "", level: 0, noTell: "" });

/**
 * Lähedased ja jagamisaste (K5-k): olek ja päringud. Vaated on failis
 * ./RelativesViews.jsx, kokku paneb need ./ClientRelatives.jsx.
 *
 * Kellele ja mida klient on lubanud rääkida. Loevad meeskond ja hooldusjuht; muudab
 * hooldusjuht. Kokkulepe tehakse kliendiga ilma lähedaseta; siin on selle tulemus.
 */
export function useRelatives({ organizationId, clientId, initial = [], onChanged }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const [items, setItemsState] = useState(initial || []);
  /* Leht hoiab sama seisu osade laua plaadi jaoks: muutus läheb ka sinna. */
  const setItems = (next) => {
    setItemsState(next);
    onChanged?.(next);
  };
  const [form, setForm] = useState({ ...EMPTY });

  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/lahedased`;
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  /* Vorm algab lähedase praeguste andmetega; uus lähedane tühjalt. */
  const start = (item = null) => {
    setForm(item ? { relativeId: item.id, name: item.name, relation: item.relation || "", phone: item.phone || "", level: item.level, noTell: item.noTell || "" } : { ...EMPTY });
    setError("");
  };

  const save = async () => {
    /* Salvestamine kinnitab kokkuleppe tänase päevaga: klient ütles seda nüüd. */
    const result = await call(base, {
      method: "POST",
      body: { relativeId: form.relativeId || null, name: form.name, relation: form.relation, phone: form.phone, level: form.level, noTell: form.noTell },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return false;
    setItems(result.data.relatives || []);
    return true;
  };

  /* „Klient ei mäleta, et lubas" (K5-u): kuni hooldusjuht üle küsib, kehtib kõige kitsam aste. */
  const flagDoubt = async (item) => {
    const result = await call(`${base}/${encodeURIComponent(item.id)}/kahtlus`, { method: "POST", fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) setItems(result.data.relatives || []);
    return result.ok;
  };

  /* Jagamiskaart paberil (K5-u): aken avatakse KOHE vajutuse peale, muidu blokeerib brauser selle hüpikaknana. */
  const openCard = async () => {
    const sheet = window.open("", "_blank");
    const result = await call(`${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/jagamiskaart`, {
      method: "POST",
      fallbackKey: "home_care.errors.open_failed"
    });
    if (!result.ok) {
      sheet?.close();
      return;
    }
    if (!sheet) {
      setError(t("home_care.fridge.popup_blocked"));
      return;
    }
    sheet.document.open();
    sheet.document.write(result.data.html);
    sheet.document.close();
  };

  const remove = async (item) => {
    const result = await call(`${base}/${encodeURIComponent(item.id)}`, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) setItems(result.data.relatives || []);
    return result.ok;
  };

  return { items, form, setField, start, save, flagDoubt, openCard, remove, busy, error, setError };
}

const NO_REPRESENTATIVE = { name: "", phone: "", basis: "", scope: "", validFrom: "", validUntil: "", copyKept: "", checkedOn: "" };

/**
 * Esindusõigus (K6-i): olek ja päringud.
 *
 * Kes tohib kliendi eest otsustada ja alla kirjutada, mis alusel ja mis ulatuses. Loeb
 * igaüks, kes lehte näeb; lisab ja lõpetab hooldusjuht. Platvorm dokumenti ei hoia.
 */
export function useRepresentatives({ organizationId, clientId, initial = [], onChanged }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const [items, setItemsState] = useState(initial || []);
  /* Leht hoiab sama seisu: osa on laual, kuni esindaja on kirjas. */
  const setItems = (next) => {
    setItemsState(next);
    onChanged?.(next);
  };
  const [form, setForm] = useState(NO_REPRESENTATIVE);

  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/esindajad`;
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const start = () => {
    setForm(NO_REPRESENTATIVE);
    setError("");
  };

  const save = async () => {
    const result = await call(base, {
      method: "POST",
      body: { ...form, validFrom: form.validFrom || null, validUntil: form.validUntil || null, checkedOn: form.checkedOn || null },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return false;
    setItems(result.data.representatives || []);
    return true;
  };

  const end = async (item) => {
    const result = await call(`${base}/${encodeURIComponent(item.id)}`, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return false;
    setItems(result.data.representatives || []);
    return true;
  };

  return { items, form, setField, start, save, end, busy, error, setError };
}
