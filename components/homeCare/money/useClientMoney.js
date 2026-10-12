"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CareMoneyKind } from "@/lib/homeCare/constants";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";
import { euroText } from "./moneyRows";

const MONEY_EXCEEDS_BALANCE = "home_care.errors.money_exceeds_balance";

/**
 * Kliendi sularaha hooldaja käes (K4-c): olek ja päringud. Vaated on failis
 * ./MoneyViews.jsx, kokku paneb need ./ClientMoney.jsx.
 *
 * Mida sain, mida kulutasin, mida tagastasin, ja jääk. See on arvestus, mitte makse.
 * Iga hooldaja näeb oma ridu; hooldusjuht näeb ka, kui palju selle kliendi raha
 * kellegi käes on.
 */
export function useClientMoney({ organizationId, clientId, initial, onChanged }) {
  const { t, locale } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const [money, setMoneyState] = useState(initial || { balanceCents: 0, entries: [], holders: [], today: "" });
  /* Leht hoiab sama seisu osade laua plaadi jaoks: muutus läheb ka sinna. */
  const setMoney = (next) => {
    setMoneyState(next);
    onChanged?.(next);
  };
  const [form, setForm] = useState({ kind: "", amount: "", note: "" });

  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/raha`;
  const setField = (name, value) => setForm((previous) => ({ ...previous, [name]: value }));

  /* Uus rida: kui raha on käes, on kõige sagedasem rida kulutus; muidu saamine. */
  const start = () => {
    setForm({ kind: money.balanceCents > 0 ? CareMoneyKind.SPENT : CareMoneyKind.RECEIVED, amount: "", note: "" });
    setError("");
  };

  const save = async () => {
    const result = await call(base, {
      method: "POST",
      body: { kind: form.kind, amount: form.amount, note: form.note },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) {
      /* Summa samal kujul nagu jääk vormi kohal („7,60 €"), mitte serveri „7.60 EUR". */
      if (result.messageKey === MONEY_EXCEEDS_BALANCE && Number.isInteger(result.details?.heldCents)) {
        setError(t(MONEY_EXCEEDS_BALANCE, { held: euroText(result.details.heldCents, locale) }));
      }
      return false;
    }
    setMoney(result.data.money);
    return true;
  };

  const retract = async (entry) => {
    const result = await call(`${base}/${encodeURIComponent(entry.id)}`, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return false;
    setMoney(result.data.money);
    return true;
  };

  return { money, form, setField, start, save, retract, busy, error, setError };
}
