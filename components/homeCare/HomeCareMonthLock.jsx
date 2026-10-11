"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { minutesLabel } from "./HomeCareDecisionView";
import { clientHref, formatDateTime, homeCareBase, useHomeCareApi } from "./homeCareClient";

const DRIFT_TEXT = Object.freeze({
  visits: "visits",
  minutes: "minutes",
  withoutLength: "without_length",
  missed: "missed",
  cancelled: "cancelled",
  notDone: "not_done"
});

/**
 * Kuu lukustamine (K5-p). Lukustamata kuu: selgitus ja kahe sammuga lukustamine (hooldusjuht
 * näeb enne kinnitamist, mis arvud lukku lähevad). Lukustatud kuu: kes ja millal lukustas,
 * mille poolest praegune seis lukustatust erineb, mis on pärast lukustamist lisatud või
 * muudetud, ja uuesti avamine põhjusega.
 */
export default function HomeCareMonthLock({ organizationId, timeZone, data, onChange, onReload }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const [step, setStep] = useState("idle");
  const [reason, setReason] = useState("");
  const lock = data.lock;
  if (!lock) return null;
  const url = `${homeCareBase(organizationId)}/kuu/lukk`;

  const doLock = async () => {
    const result = await call(url, {
      method: "POST",
      body: { month: data.month, seen: { visits: data.totals.visits, minutes: data.totals.minutes, open: lock.openItemCount } },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (result.ok) {
      onChange(result.data);
      return;
    }
    /* Arvud muutusid vahepeal või keegi jõudis ette: näita uut seisu; veateade jääb ette. */
    if (result.status === 409) onReload?.();
  };

  const doReopen = async (event) => {
    event.preventDefault();
    const result = await call(url, { method: "PATCH", body: { month: data.month, reason }, fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) onChange(result.data);
  };

  const close = () => {
    setStep("idle");
    setError("");
  };

  const signedMinutes = (value) => `${value > 0 ? "+" : "−"}${minutesLabel(t, Math.abs(value))}`;
  const signed = (value) => (value > 0 ? `+${value}` : `−${Math.abs(value)}`);
  const driftList = lock.drift
    ? Object.keys(DRIFT_TEXT)
        .filter((key) => lock.drift[key])
        .map((key) => t(`home_care.month_lock.drift_${DRIFT_TEXT[key]}`, { delta: key === "minutes" ? signedMinutes(lock.drift[key]) : signed(lock.drift[key]) }))
        .join(", ")
    : "";
  const after = lock.after;
  const afterEntries = after ? after.added + after.corrected + after.retracted : 0;

  return (
    <section className="hc-section" aria-labelledby={`${fieldId}-title`}>
      <h3 className="hc-section-title" id={`${fieldId}-title`}>
        {t("home_care.month_lock.title")}
      </h3>

      {lock.state === "OPEN" ? (
        <>
          <p className="hc-sub">{t("home_care.month_lock.intro")}</p>
          {lock.blocked === "NOT_OVER" ? <p className="hc-hint">{t("home_care.month_lock.not_over")}</p> : null}
          {lock.blocked === "SCOPE" ? <p className="hc-hint">{t("home_care.month_lock.scope_only")}</p> : null}
          {lock.canLock && lock.openItemCount ? <p className="hc-notice">{t("home_care.month_lock.open_warning", { count: lock.openItemCount })}</p> : null}
          {error ? (
            <p className="hc-error" role="alert">
              {error}
            </p>
          ) : null}
          {lock.canLock && step === "idle" ? (
            <div className="hc-row">
              <button className="hc-btn hc-btn--primary" type="button" onClick={() => setStep("confirm")} disabled={busy}>
                {t("home_care.month_lock.lock")}
              </button>
            </div>
          ) : null}
          {lock.canLock && step === "confirm" ? (
            <>
              <p className="hc-sub">{t("home_care.month_lock.confirm_hint", { visits: data.totals.visits, amount: minutesLabel(t, data.totals.minutes) })}</p>
              <div className="hc-row">
                <button className="hc-btn hc-btn--primary" type="button" onClick={doLock} disabled={busy}>
                  {t("home_care.month_lock.confirm")}
                </button>
                <button className="hc-btn hc-btn--quiet" type="button" onClick={close} disabled={busy}>
                  {t("home_care.month_lock.cancel")}
                </button>
              </div>
            </>
          ) : null}
        </>
      ) : (
        <>
          <p className="hc-sub">{t("home_care.month_lock.locked_line", { name: lock.lockedByName || "—", date: formatDateTime(lock.lockedAt, timeZone) })}</p>
          {lock.openItemCount ? <p className="hc-hint">{t("home_care.month_lock.locked_open", { count: lock.openItemCount })}</p> : null}
          {lock.snapshotShown ? (
            <p className={driftList ? "hc-notice" : "hc-hint"}>{driftList ? t("home_care.month_lock.drift", { list: driftList }) : t("home_care.month_lock.no_drift")}</p>
          ) : (
            <p className="hc-hint">{t("home_care.month_lock.unit_hint")}</p>
          )}

          {after?.total ? (
            <>
              <h4 className="hc-label">{t("home_care.month_lock.after_title")}</h4>
              <p className="hc-sub">
                {t("home_care.month_lock.after_counts", { added: after.added, corrected: after.corrected, retracted: after.retracted, plan: after.planChanged })}
              </p>
              {after.items.length ? (
                <ul className="hc-list">
                  {after.items.map((item) => (
                    <li key={item.key}>
                      <Link className="hc-client" href={clientHref(organizationId, item.client.id)} prefetch={false}>
                        <span className="hc-client__name">{item.client.displayName}</span>
                        <span className="hc-client__meta">
                          {t(`home_care.month_lock.after_kinds.${item.kind}`)} · {item.actorName || "—"} · {formatDateTime(item.at, timeZone)} ·{" "}
                          {t("home_care.month_lock.after_occurred", { when: formatDateTime(item.occurredAt, timeZone) })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              {afterEntries > after.items.length ? (
                <p className="hc-hint">{t("home_care.month_lock.after_more", { shown: after.items.length, count: afterEntries })}</p>
              ) : null}
              {lock.canReopen ? <p className="hc-hint">{t("home_care.month_lock.after_hint")}</p> : null}
            </>
          ) : null}

          {error ? (
            <p className="hc-error" role="alert">
              {error}
            </p>
          ) : null}
          {lock.canReopen && step === "idle" ? (
            <div className="hc-row">
              <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setStep("reopen")} disabled={busy}>
                {t("home_care.month_lock.reopen")}
              </button>
            </div>
          ) : null}
          {lock.canReopen && step === "reopen" ? (
            <form className="hc-form" onSubmit={doReopen} aria-busy={busy}>
              <label className="hc-label" htmlFor={`${fieldId}-reason`}>
                {t("home_care.month_lock.reopen_reason")}
              </label>
              <input
                className="hc-input"
                id={`${fieldId}-reason`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={HOME_CARE_LIMITS.MONTH_REOPEN_REASON_MAX}
                autoComplete="off"
                required
              />
              <p className="hc-hint">{t("home_care.month_lock.reopen_hint")}</p>
              <div className="hc-row">
                <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || !reason.trim()}>
                  {t("home_care.month_lock.reopen_confirm")}
                </button>
                <button className="hc-btn hc-btn--quiet" type="button" onClick={close} disabled={busy}>
                  {t("home_care.month_lock.cancel")}
                </button>
              </div>
            </form>
          ) : null}
        </>
      )}

      {lock.history?.length ? (
        <>
          <h4 className="hc-label">{t("home_care.month_lock.history_title")}</h4>
          <ul className="hc-list hc-list--plain">
            {lock.history.map((row) => (
              <li key={row.id} className="hc-sub">
                {t("home_care.month_lock.history_line", {
                  lockedBy: row.lockedByName || "—",
                  lockedAt: formatDateTime(row.lockedAt, timeZone),
                  reopenedBy: row.reopenedByName || "—",
                  reopenedAt: formatDateTime(row.reopenedAt, timeZone),
                  reason: row.reopenReason
                })}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
