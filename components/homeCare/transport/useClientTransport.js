"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";

/**
 * Transport (K5-w): olek ja päringud. Vaated on failis ./TransportViews.jsx,
 * kokku paneb need ./ClientTransport.jsx.
 *
 * Kliendi eesolevad sõidud ja soovid. Soovi („Telli transport") esitab kliendi
 * meeskonna liige või hooldusjuht; hooldusjuht vastab, kas sõit on korraldatud ja mis
 * kell auto tuleb. Loevad kõik, kes lehte näevad. Sõitu ennast platvorm ei telli.
 */
export function useClientTransport({ organizationId, clientId, initial = null, onChanged }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const [data, setDataState] = useState(initial || { requests: [], next: null });
  /* Leht hoiab sama seisu osade laua plaadi jaoks: muutus läheb ka sinna. */
  const setData = (next) => {
    setDataState(next);
    onChanged?.(next);
  };
  const [form, setForm] = useState({});

  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/transport`;
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  /* Uus vorm (soov või vastus) algab antud väärtustega. */
  const start = (values) => {
    setForm(values);
    setError("");
  };
  const done = (result) => {
    if (!result.ok) return false;
    setData(result.data.transport || { requests: [], next: null });
    return true;
  };

  const create = async () =>
    done(
      await call(base, {
        method: "POST",
        body: { wantedOn: form.wantedOn, wantedTime: form.wantedTime, destination: form.destination, needs: form.needs },
        fallbackKey: "home_care.errors.save_failed"
      })
    );
  /* `mode`: { kind: "arrange" | "decline", id }. */
  const answer = async (mode) => {
    const arranged = mode.kind === "arrange";
    return done(
      await call(`${base}/${encodeURIComponent(mode.id)}`, {
        method: "PATCH",
        body: { state: arranged ? "ARRANGED" : "DECLINED", pickupTime: arranged ? form.pickupTime : null, answerNote: form.answerNote },
        fallbackKey: "home_care.errors.save_failed"
      })
    );
  };
  const withdraw = async (item) => done(await call(`${base}/${encodeURIComponent(item.id)}`, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" }));

  /* Transpordikaart (K5-y): aken avatakse KOHE vajutuse peale, muidu blokeerib brauser selle hüpikaknana. */
  const openCard = async () => {
    const sheet = window.open("", "_blank");
    const result = await call(`${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/transpordikaart`, {
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

  return { data, form, setField, start, create, answer, withdraw, openCard, busy, error, setError };
}
