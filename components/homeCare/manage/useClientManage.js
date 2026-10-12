"use client";

import { useState } from "react";

import { CARE_STATUS_REASONS, CareClientStatus } from "@/lib/homeCare/constants";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";
import { callReached, isDeath } from "./manageRows";

/**
 * Hooldusjuhi osa: olek ja päringud. Neli konksu ühes osas, igaüks oma asja
 * kohta; vaated on ühised (../client/PartViews.jsx), kokku paneb need
 * ./ClientManage.jsx.
 *  - `useClientStatus`   kliendi seis (aktiivne, ajutiselt ära, lõpetatud)
 *  - `useChangeSignals`  märkamised, mis vajavad vastust (K5-a)
 *  - `useControlCalls`   kontrollkõne kliendile (K6-l)
 *  - `useDecisionNotices` teated otsustajale (K5-r)
 */

/**
 * Kliendi seis (kava II.6.5). Vorm avaneb alati kliendi PRAEGUSE seisuga: pooleli
 * jäänud valik ei tohi järgmisel avamisel ees olla („Lõpetatud" jääks muidu
 * märkamatult salvestama). Alus ja selgitus kuuluvad seisu juurde: teise seisu
 * valimisel eelmise seisu alus ei jää külge. Surma korral on allikas kohustuslik
 * ja salvestamine käib kahes sammus.
 *
 * `data`: kliendi lehe andmed; `onSaved({ client, statusHistory })`: leht võtab uue seisu.
 */
export function useClientStatus({ organizationId, clientId, data, onSaved }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const [status, setStatus] = useState(data?.client?.status || CareClientStatus.ACTIVE);
  const [statusReason, setStatusReason] = useState(data?.client?.statusReason || "");
  const [statusNote, setStatusNote] = useState(data?.client?.statusNote || "");
  const [confirmDeath, setConfirmDeath] = useState(false);

  const base = `${homeCareBase(organizationId)}/kliendid/${clientId}`;
  const form = { status, reason: statusReason, note: statusNote };
  const reasonOptions = CARE_STATUS_REASONS[status] || [];

  const open = () => {
    setStatus(data.client.status);
    setStatusReason(data.client.statusReason || "");
    setStatusNote(data.client.statusNote || "");
    setConfirmDeath(false);
    setError("");
  };

  const chooseStatus = (value) => {
    if (value === status) return;
    setConfirmDeath(false);
    setStatus(value);
    if (!(CARE_STATUS_REASONS[value] || []).includes(statusReason)) setStatusReason("");
    /* Selgitus kuulub samuti seisu juurde: „haiglas alates 9.10" ei tohi minna kaasa lõpetamisele. */
    setStatusNote(value === data.client.status ? data.client.statusNote || "" : "");
  };

  const chooseReason = (value) => {
    setConfirmDeath(false);
    setStatusReason(value);
  };

  /* Tagastab "confirm" (surma esimene vajutus on tehtud, teine salvestab), "saved" või "" (tõrge jääb vaatesse). */
  const save = async () => {
    if (isDeath(form) && !confirmDeath) {
      setConfirmDeath(true);
      return "confirm";
    }
    const result = await call(`${base}/seis`, {
      method: "POST",
      body: { status, statusReason: reasonOptions.length ? statusReason : null, statusNote, version: data.client.version },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return "";
    onSaved({ client: result.data.client, statusHistory: result.data.statusHistory });
    setConfirmDeath(false);
    return "saved";
  };

  return { form, confirmDeath, open, chooseStatus, chooseReason, setNote: setStatusNote, save, busy, error, setError };
}

/**
 * Märkamised, mis vajavad vastust (K5-a). Märkamine tekib, kui kaks eri hooldajat
 * märgivad 14 päeva jooksul sama valdkonna või üks märgib suure muutuse. Vastus
 * ütleb, mida tehti; vastatud märkamist enam ei muudeta.
 *
 * `onChanged(signals)`: leht hoiab sama seisu osade laua plaadi jaoks.
 */
export function useChangeSignals({ organizationId, initial = null, onChanged }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const [signals, setSignalsState] = useState(initial || { open: [], handled: [] });
  const setSignals = (next) => {
    setSignalsState(next);
    onChanged?.(next);
  };
  const [answering, setAnswering] = useState("");
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");

  const start = (id) => {
    setOutcome("");
    setNote("");
    setError("");
    setAnswering(id);
  };

  const save = async () => {
    const result = await call(`${homeCareBase(organizationId)}/muutused/${encodeURIComponent(answering)}`, {
      method: "PATCH",
      body: { outcome, note },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return false;
    setSignals(result.data.changeSignals || { open: [], handled: [] });
    setAnswering("");
    return true;
  };

  return { signals, answering, form: { outcome, note }, setOutcome, setNote, start, save, busy, error, setError };
}

const EMPTY_CALL = { calledOn: "", outcome: "", spokeWith: "", note: "" };

/**
 * Hooldusjuhi kontrollkõne kliendile (K6-l): kord kvartalis helistab hooldusjuht
 * ise ja küsib, kas käigud on toimunud nii, nagu kirjas. Ekslik kirje
 * tühistatakse, ei kustutata.
 */
export function useControlCalls({ organizationId, clientId, initial = null }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const [view, setView] = useState(initial);
  const [form, setForm] = useState(EMPTY_CALL);

  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/kontrollkoned`;
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const reached = callReached(form);

  const start = () => {
    setForm(EMPTY_CALL);
    setError("");
  };

  const save = async () => {
    const result = await call(base, {
      method: "POST",
      body: { calledOn: form.calledOn || null, outcome: form.outcome, spokeWith: reached ? form.spokeWith : null, note: form.note },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return false;
    setView(result.data.controlCalls);
    return true;
  };

  const retract = async (item) => {
    const result = await call(`${base}/${encodeURIComponent(item.id)}`, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return false;
    setView(result.data.controlCalls);
    return true;
  };

  return { view, form, setField, start, save, retract, busy, error, setError };
}

/**
 * Teated otsustajale (K5-r): hooldusjuht koostab kliendi kohta teate
 * omavalitsuse sotsiaaltöötajale, kopeerib teksti e-kirja või STAR-i ja märgib
 * hiljem vastuse. Platvorm ise teadet ei saada.
 */
export function useDecisionNotices({ organizationId, clientId, initial = [] }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const [notices, setNotices] = useState(initial || []);
  const [form, setForm] = useState({});
  const [copyState, setCopyState] = useState("");

  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/teated`;
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  /* Uus vorm (teade, vastus või tagasivõtmine) algab antud väärtustega. */
  const start = (values) => {
    setForm(values);
    setCopyState("");
    setError("");
  };

  /* Tagastab uue teate ID (sellega avatakse teksti vaade, et seda kopeerida ja saata; võib olla tühi) või null (tõrge jääb vaatesse). */
  const create = async () => {
    const result = await call(base, {
      method: "POST",
      body: {
        reason: form.reason,
        text: form.text,
        recipient: form.recipient,
        channel: form.channel,
        sentOn: form.sentOn,
        entryIds: form.entryIds || [],
        withFigures: Boolean(form.withFigures)
      },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return null;
    setNotices(result.data.decisionNotices || []);
    return result.data.noticeId || "";
  };

  /* `mode`: teade, millele vastatakse. */
  const answer = async (mode) => {
    const result = await call(`${base}/${encodeURIComponent(mode.id)}/vastus`, {
      method: "POST",
      body: { answer: form.answer, answeredOn: form.answeredOn, reassessBy: form.answer === "REASSESS" ? form.reassessBy : null, answerNote: form.answerNote },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return false;
    setNotices(result.data.decisionNotices || []);
    return true;
  };

  const withdraw = async (mode) => {
    const result = await call(`${base}/${encodeURIComponent(mode.id)}/tagasi`, { method: "POST", body: { reason: form.reason }, fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return false;
    setNotices(result.data.decisionNotices || []);
    return true;
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("ok");
    } catch {
      setCopyState("failed");
    }
  };

  return { notices, form, setField, setForm, start, create, answer, withdraw, copy, copyState, busy, error, setError };
}
