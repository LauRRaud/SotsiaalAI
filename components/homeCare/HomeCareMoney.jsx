"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CARE_MONEY_KINDS, CareMoneyKind, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { planDayLabel } from "./HomeCarePlanView";
import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/** Sendid eurodeks keele kombel („12,50 €"). */
export function euroText(cents, locale) {
  try {
    return new Intl.NumberFormat(locale === "en" ? "en-IE" : locale || "et", { style: "currency", currency: "EUR" }).format((cents || 0) / 100);
  } catch {
    return `${((cents || 0) / 100).toFixed(2)} EUR`;
  }
}

/**
 * Kliendi sularaha hooldaja käes (K4-c): mida sain, mida kulutasin, mida tagastasin, ja
 * jääk. See on arvestus, mitte makse. Iga hooldaja näeb oma ridu; hooldusjuht näeb ka,
 * kui palju selle kliendi raha kellegi käes on.
 */
export default function HomeCareMoney({ organizationId, clientId, initial, canWrite = false, isCoordinator = false }) {
  const { t, locale } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const [money, setMoney] = useState(initial || { balanceCents: 0, entries: [], holders: [], today: "" });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ kind: "", amount: "", note: "" });

  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/raha`;
  const setField = (name, value) => setForm((previous) => ({ ...previous, [name]: value }));

  const start = () => {
    setForm({ kind: money.balanceCents > 0 ? CareMoneyKind.SPENT : CareMoneyKind.RECEIVED, amount: "", note: "" });
    setError("");
    setAdding(true);
  };

  const save = async (event) => {
    event.preventDefault();
    const result = await call(base, {
      method: "POST",
      body: { kind: form.kind, amount: form.amount, note: form.note },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    setMoney(result.data.money);
    setAdding(false);
  };

  const retract = async (entry) => {
    const result = await call(`${base}/${encodeURIComponent(entry.id)}`, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) setMoney(result.data.money);
  };

  const holders = money.holders || [];
  /* Jaotist näeb see, kes saab rea lisada, või see, kellel on midagi vaadata. */
  if (!canWrite && !money.entries.length && !holders.length) return null;
  const noteRequired = form.kind === CareMoneyKind.SPENT;

  return (
    <section className="hc-section" aria-labelledby={`${fieldId}-title`}>
      <h2 className="hc-section-title" id={`${fieldId}-title`}>
        {t("home_care.money.title")}
      </h2>
      <p className={money.balanceCents > 0 ? "hc-notice" : "hc-hint"}>
        {money.balanceCents > 0 ? t("home_care.money.balance", { amount: euroText(money.balanceCents, locale) }) : t("home_care.money.balance_none")}
      </p>

      {isCoordinator && holders.length ? (
        <>
          <p className="hc-sub">{t("home_care.money.holders_title")}</p>
          <ul className="hc-list hc-list--plain">
            {holders.map((holder) => (
              <li key={holder.membershipId}>
                {t("home_care.money.holder_line", {
                  name: holder.name || "—",
                  amount: euroText(holder.balanceCents, locale),
                  date: planDayLabel(holder.lastOn)
                })}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {money.entries.length ? (
        <ul className="hc-list hc-list--plain">
          {money.entries.map((entry) => (
            <li key={entry.id}>
              <span>
                {planDayLabel(entry.occurredOn)} {t(`home_care.money.kinds.${entry.kind}`)} {euroText(entry.amountCents, locale)}
              </span>
              {[isCoordinator ? entry.holderName : null, entry.note].filter(Boolean).length ? (
                <span className="hc-entry__meta"> {[isCoordinator ? entry.holderName : null, entry.note].filter(Boolean).join(" · ")}</span>
              ) : null}
              {canWrite && !adding && entry.canRetract ? (
                <span className="hc-row">
                  <button className="hc-btn hc-btn--quiet" type="button" onClick={() => retract(entry)} disabled={busy}>
                    {t("home_care.money.retract")}
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {adding ? (
        <form className="hc-form" onSubmit={save} aria-busy={busy}>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.money.kind_label")}</span>
            <div className="hc-chips" role="group" aria-label={t("home_care.money.kind_label")}>
              {CARE_MONEY_KINDS.map((kind) => (
                <button key={kind} type="button" className="hc-chip" aria-pressed={form.kind === kind} onClick={() => setField("kind", kind)}>
                  {t(`home_care.money.kinds.${kind}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-amount`}>
              {t("home_care.money.amount_label")}
            </label>
            <input
              id={`${fieldId}-amount`}
              className="hc-input"
              value={form.amount}
              onChange={(event) => setField("amount", event.target.value)}
              inputMode="decimal"
              maxLength={10}
              autoComplete="off"
              required
            />
          </div>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-note`}>
              {t("home_care.money.note_label")}
            </label>
            <input
              id={`${fieldId}-note`}
              className="hc-input"
              value={form.note}
              onChange={(event) => setField("note", event.target.value)}
              maxLength={HOME_CARE_LIMITS.MONEY_NOTE_MAX}
              autoComplete="off"
              required={noteRequired}
            />
            {noteRequired ? <p className="hc-hint">{t("home_care.money.note_hint")}</p> : null}
          </div>
          <p className="hc-hint">{t("home_care.money.intro")}</p>
          {error ? (
            <p className="hc-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="hc-row">
            <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || !form.kind || !form.amount.trim() || (noteRequired && !form.note.trim())}>
              {t("home_care.money.save")}
            </button>
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setAdding(false)} disabled={busy}>
              {t("home_care.money.cancel")}
            </button>
          </div>
        </form>
      ) : canWrite ? (
        <div className="hc-row">
          <button className="hc-btn hc-btn--quiet" type="button" onClick={start} disabled={busy}>
            {t("home_care.money.add")}
          </button>
        </div>
      ) : null}
      {!adding && error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
