"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CareVisitChangeKind } from "@/lib/homeCare/constants";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";
import { moveForm } from "./dayPlanRows";

/**
 * Hooldusjuhi päevaplaan: olek ja päringud. Vaated on ühised
 * (../client/PartViews.jsx), kokku paneb need ./DayPlan.jsx.
 */
export function useDayPlan({ organizationId, initial }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const [data, setData] = useState(initial);
  const [form, setForm] = useState({ workerMembershipId: "", startTime: "", reason: "", note: "" });
  const [notice, setNotice] = useState("");

  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  /* Tagastab true, kui päev on laaditud. */
  const load = async (day) => {
    const result = await call(`${homeCareBase(organizationId)}/paev?paev=${encodeURIComponent(day)}`, {
      fallbackKey: "home_care.errors.list_failed"
    });
    if (!result.ok) return false;
    setData(result.data);
    setNotice("");
    return true;
  };

  /* Vorm (ümbertõstmine või ära jätmine) algab käigu praeguste andmetega. */
  const openForm = (visit) => {
    setForm(moveForm(visit));
    setNotice("");
    setError("");
  };

  const send = async (visit, method, body) => {
    const url = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(visit.client.id)}/kaigud/${encodeURIComponent(visit.slotId)}/erand`;
    const result = await call(url, { method, body: { day: data.day, ...body }, fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return false;
    setData(result.data);
    setNotice(t("home_care.day.saved"));
    return true;
  };

  /* Ümbertõstmine ja ära jätmine saadavad vormi sisu; tagasivõtmine kustutab muudatuse. */
  const move = (visit) =>
    send(visit, "PUT", {
      kind: CareVisitChangeKind.MOVED,
      workerMembershipId: form.workerMembershipId || null,
      startTime: form.startTime,
      note: form.note
    });
  const cancel = (visit) => send(visit, "PUT", { kind: CareVisitChangeKind.CANCELLED, reason: form.reason, note: form.note });
  const restore = (visit) => send(visit, "DELETE", {});

  /* Takistuse teade (K3-e): vaadatuks märkimine; „ei saa täna töötada" juurest ka päeva puudumine. */
  const handleObstacle = async (obstacle, markAbsent) => {
    const url = `${homeCareBase(organizationId)}/takistus/${encodeURIComponent(obstacle.id)}`;
    const result = await call(url, { method: "POST", body: { markAbsent }, fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return false;
    setData(result.data);
    setNotice(t(markAbsent ? "home_care.day.obstacle_absent_saved" : "home_care.day.obstacle_handled_saved"));
    return true;
  };

  /* Esmakäik (K5-v): kuidas kliendile teatati; pärast märkimist loetakse päev uuesti. */
  const markFirstVisit = async (visit, outcome) => {
    const result = await call(`${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(visit.client.id)}/esmakaik`, {
      method: "POST",
      body: { day: data.day, workerMembershipId: visit.worker?.membershipId, outcome },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return false;
    return load(data.day);
  };

  /* Päevaleht paberil (K5-t): aken avatakse KOHE vajutuse peale, muidu blokeerib brauser selle hüpikaknana. */
  const printSheet = async (membershipId = null) => {
    const sheet = window.open("", "_blank");
    const result = await call(`${homeCareBase(organizationId)}/paev/leht`, {
      method: "POST",
      body: { day: data.day, membershipId },
      fallbackKey: "home_care.errors.list_failed"
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

  return { data, form, setField, notice, load, openForm, move, cancel, restore, handleObstacle, markFirstVisit, printSheet, busy, error, setError };
}
