"use client";

import { useState } from "react";

import { CARE_CHANGE_AREAS, CARE_SAFETY_TOPICS } from "@/lib/homeCare/constants";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";

/**
 * Kliendi lehe osa „Ohutus": viie teema olek ja päringud. Vaated on failis
 * ./SafetyViews.jsx, kokku paneb need ./ClientSafety.jsx. Kood on tõstetud siia
 * vanadest komponentidest sõna-sõnalt; iga konks ütleb pärast salvestamist
 * lehele uue seisu (`onChanged`), et osade laua plaat ja vaade „Ukse taga"
 * järgiksid salvestust.
 */

/**
 * Eeltingimus enne teenuse algust (K4-a): mida oodatakse, kes korraldab ja mis ajaks.
 * Loeb igaüks, kes lehte näeb; lisab ja lõpetab hooldusjuht.
 */
export function usePreconditions({ organizationId, clientId, initial = [], onChanged }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const [items, setItems] = useState(initial || []);
  const [form, setForm] = useState({ kind: "", note: "", responsible: "", dueOn: "" });

  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/eeltingimused`;
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const start = () => {
    setForm({ kind: "", note: "", responsible: "", dueOn: "" });
    setError("");
  };

  const save = async () => {
    const result = await call(base, {
      method: "POST",
      body: { kind: form.kind, note: form.note, responsible: form.responsible, dueOn: form.dueOn || null },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return false;
    setItems(result.data.preconditions || []);
    onChanged?.(result.data.preconditions || []);
    return true;
  };

  const close = async (item, outcome) => {
    const result = await call(`${base}/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      body: { outcome },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return false;
    setItems(result.data.preconditions || []);
    onChanged?.(result.data.preconditions || []);
    return true;
  };

  return { items, form, setField, start, save, close, busy, error, setError };
}

/**
 * Ohutuskaart (K5-n): kümme küsimust kodu kui töökoha kohta, vastus jah või ei ja soovi
 * korral lühike märkus. Täidavad meeskond ja hooldusjuht.
 */
export function useSafetyCard({ organizationId, clientId, initial = null, onChanged }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const [card, setCard] = useState(initial || { items: [], assessedOn: null, reviewDue: false });
  const [form, setForm] = useState({});

  const start = () => {
    setForm(
      Object.fromEntries(
        CARE_SAFETY_TOPICS.map((topic) => {
          const item = card.items.find((row) => row.topic === topic);
          return [topic, { answer: item?.answer || "", note: item?.note || "" }];
        })
      )
    );
    setError("");
  };

  const setCell = (topic, key, value) => setForm((previous) => ({ ...previous, [topic]: { ...previous[topic], [key]: value } }));

  const save = async () => {
    /* Märkus ilma vastuseta ei lähe teele: vastamata teema märkus jäetakse välja. */
    const items = Object.fromEntries(Object.entries(form).map(([topic, item]) => [topic, { answer: item.answer || null, note: item.answer ? item.note : "" }]));
    const result = await call(`${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/ohutus`, {
      method: "PUT",
      body: { items },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return false;
    setCard(result.data.safety);
    onChanged?.(result.data.safety);
    return true;
  };

  return { card, form, start, setCell, save, busy, error, setError };
}

/**
 * Kliendi tavaline seis (K5-a): kuidas tal tavaliselt läheb, kuues valdkonnas. Selle
 * järgi hindab iga hooldaja, kas täna oli midagi teisiti. Muudavad meeskond ja hooldusjuht.
 */
export function useUsualState({ organizationId, clientId, initial = [], onChanged }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const [items, setItems] = useState(initial || []);
  const [form, setForm] = useState({});

  const textOf = (area) => items.find((item) => item.area === area)?.text || "";

  const start = () => {
    setForm(Object.fromEntries(CARE_CHANGE_AREAS.map((area) => [area, textOf(area)])));
    setError("");
  };

  const setArea = (area, value) => setForm((previous) => ({ ...previous, [area]: value }));

  const save = async () => {
    const result = await call(`${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/tavaline-seis`, {
      method: "PUT",
      body: { areas: form },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return false;
    setItems(result.data.usualState || []);
    onChanged?.(result.data.usualState || []);
    return true;
  };

  return { items, form, start, setArea, save, busy, error, setError };
}

/**
 * Töö iseloom kliendi juures (K3-g): kas töö on siin füüsiliselt raske, vaimselt kurnav,
 * raskes kodukeskkonnas või ainult kahekesi tehtav, ja miks. Kirjeldab tööd, mitte
 * inimest. Paneb ja muudab hooldusjuht.
 */
export function useWorkNature({ organizationId, clientId, initial = null, onChanged }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const [mark, setMark] = useState(initial);
  const [form, setForm] = useState({ kinds: [], reason: "", reviewOn: "" });

  const url = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/too-iseloom`;

  const start = () => {
    setForm({ kinds: mark?.kinds || [], reason: mark?.reason || "", reviewOn: mark?.reviewOn || "" });
    setError("");
  };

  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const toggle = (kind) =>
    setForm((previous) => ({
      ...previous,
      kinds: previous.kinds.includes(kind) ? previous.kinds.filter((value) => value !== kind) : [...previous.kinds, kind]
    }));

  const save = async () => {
    const result = await call(url, {
      method: "PUT",
      body: { kinds: form.kinds, reason: form.reason, reviewOn: form.reviewOn || null },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return false;
    setMark(result.data.workNature || null);
    onChanged?.(result.data.workNature || null);
    return true;
  };

  const clear = async () => {
    const result = await call(url, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return false;
    setMark(null);
    onChanged?.(null);
    return true;
  };

  return { mark, form, start, setField, toggle, save, clear, busy, error, setError };
}

/**
 * Kriisivalmidus kliendi juures (K5-b): kui palju tuge inimene kriisis vajab, millest ta
 * sõltub ja kes lähedastest saab aidata. Hinnangu paneb hooldusjuht.
 */
export function useCrisis({ organizationId, clientId, initial = null, onChanged }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const [crisis, setCrisis] = useState(initial || null);
  const [form, setForm] = useState({ level: "", dependencies: [], helper: "", note: "" });

  const url = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/kriis`;

  const start = () => {
    setForm({ level: crisis?.level || "", dependencies: crisis?.dependencies || [], helper: crisis?.helper || "", note: crisis?.note || "" });
    setError("");
  };

  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const toggle = (code) =>
    setForm((previous) => ({
      ...previous,
      dependencies: previous.dependencies.includes(code) ? previous.dependencies.filter((item) => item !== code) : [...previous.dependencies, code]
    }));

  const save = async () => {
    const result = await call(url, { method: "PUT", body: form, fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return false;
    setCrisis(result.data.crisis || null);
    onChanged?.(result.data.crisis || null);
    return true;
  };

  const clear = async () => {
    const result = await call(url, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return false;
    setCrisis(null);
    onChanged?.(null);
    return true;
  };

  return { crisis, form, start, setField, toggle, save, clear, busy, error, setError };
}
