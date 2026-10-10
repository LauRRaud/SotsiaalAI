"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { planDayLabel } from "./HomeCarePlanView";
import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/** Sõidu rida ühe lausena käigu juurde: „sõit kell 9.40: perearsti juurde". */
export function rideText(t, ride) {
  return ride.time ? t("home_care.transport.ride_today", { time: ride.time, destination: ride.destination }) : t("home_care.transport.ride_today_no_time", { destination: ride.destination });
}

/**
 * Transport (K5-w): kliendi eesolevad sõidud ja soovid. Soovi („Telli transport") esitab
 * kliendi meeskonna liige või hooldusjuht; hooldusjuht vastab, kas sõit on korraldatud ja mis
 * kell auto tuleb. Loevad kõik, kes lehte näevad: korraldatud sõit on lehe ülaosas, et
 * hooldaja saaks kliendi valmis panna. Sõitu ennast platvorm ei telli.
 */
export default function HomeCareTransport({ organizationId, clientId, initial = null, canRequest = false, isCoordinator = false, canWrite = false, today = "" }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const [data, setData] = useState(initial || { requests: [], next: null });
  /* `mode`: null | "new" | { kind: "arrange" | "decline", id }. */
  const [mode, setMode] = useState(null);
  const [form, setForm] = useState({});

  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/transport`;
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const open = (next, values) => {
    setForm(values);
    setError("");
    setMode(next);
  };
  const close = () => {
    setMode(null);
    setError("");
  };
  const done = (result) => {
    if (!result.ok) return;
    setData(result.data.transport || { requests: [], next: null });
    setMode(null);
  };

  const create = async (event) => {
    event.preventDefault();
    done(
      await call(base, {
        method: "POST",
        body: { wantedOn: form.wantedOn, wantedTime: form.wantedTime, destination: form.destination, needs: form.needs },
        fallbackKey: "home_care.errors.save_failed"
      })
    );
  };
  const answer = async (event) => {
    event.preventDefault();
    const arranged = mode.kind === "arrange";
    done(
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

  const when = (item) => (item.wantedTime ? t("home_care.transport.when_time", { date: planDayLabel(item.wantedOn), time: item.wantedTime }) : planDayLabel(item.wantedOn));
  const stateLine = (item) => {
    if (item.state === "REQUESTED") return t("home_care.transport.state_requested", { name: item.requestedByName || "—" });
    if (item.state === "DECLINED") return t("home_care.transport.state_declined", { reason: item.answerNote || "" });
    return [item.pickupTime ? t("home_care.transport.state_arranged_time", { time: item.pickupTime }) : t("home_care.transport.state_arranged"), item.answerNote].filter(Boolean).join(" · ");
  };

  if (!data.requests.length && !canRequest) return null;

  return (
    <section className="hc-section" aria-labelledby={`${fieldId}-title`}>
      <h2 className="hc-section-title" id={`${fieldId}-title`}>
        {t("home_care.transport.title")}
      </h2>
      {data.next ? (
        <p className="hc-notice">
          {t("home_care.transport.next", { date: planDayLabel(data.next.wantedOn) })} {rideText(t, data.next)}
        </p>
      ) : null}

      {data.requests.length ? (
        <ul className="hc-list hc-list--plain">
          {data.requests.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{when(item)}</strong> · {item.destination}
                {item.needs ? ` · ${item.needs}` : ""}
              </div>
              <div className="hc-sub">{stateLine(item)}</div>
              {canWrite && !mode ? (
                <div className="hc-row">
                  {isCoordinator && item.state === "REQUESTED" ? (
                    <>
                      <button className="hc-btn hc-btn--quiet" type="button" onClick={() => open({ kind: "arrange", id: item.id }, { pickupTime: item.wantedTime || "", answerNote: "" })} disabled={busy}>
                        {t("home_care.transport.arrange")}
                      </button>
                      <button className="hc-btn hc-btn--quiet" type="button" onClick={() => open({ kind: "decline", id: item.id }, { answerNote: "" })} disabled={busy}>
                        {t("home_care.transport.decline")}
                      </button>
                    </>
                  ) : null}
                  {(isCoordinator && (item.state === "REQUESTED" || item.state === "ARRANGED")) || (item.isMine && canRequest && item.state === "REQUESTED") ? (
                    <button className="hc-btn hc-btn--quiet" type="button" onClick={() => withdraw(item)} disabled={busy}>
                      {t("home_care.transport.withdraw")}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {mode && mode !== "new" && mode.id === item.id ? (
                <form className="hc-form" onSubmit={answer} aria-busy={busy}>
                  {mode.kind === "arrange" ? (
                    <>
                      <label className="hc-label" htmlFor={`${fieldId}-pickup`}>
                        {t("home_care.transport.pickup_label")}
                      </label>
                      <input className="hc-input" id={`${fieldId}-pickup`} type="time" value={form.pickupTime || ""} onChange={(event) => setField("pickupTime", event.target.value)} />
                    </>
                  ) : null}
                  <label className="hc-label" htmlFor={`${fieldId}-answer-note`}>
                    {mode.kind === "arrange" ? t("home_care.transport.arrange_note_label") : t("home_care.transport.decline_reason_label")}
                  </label>
                  <input
                    className="hc-input"
                    id={`${fieldId}-answer-note`}
                    value={form.answerNote || ""}
                    onChange={(event) => setField("answerNote", event.target.value)}
                    maxLength={HOME_CARE_LIMITS.TRANSPORT_TEXT_MAX}
                    autoComplete="off"
                    required={mode.kind === "decline"}
                  />
                  {error ? (
                    <p className="hc-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                  <div className="hc-row">
                    <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || (mode.kind === "decline" && !String(form.answerNote || "").trim())}>
                      {mode.kind === "arrange" ? t("home_care.transport.arrange_save") : t("home_care.transport.decline_save")}
                    </button>
                    <button className="hc-btn hc-btn--quiet" type="button" onClick={close} disabled={busy}>
                      {t("home_care.transport.cancel")}
                    </button>
                  </div>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="hc-sub">{t("home_care.transport.none")}</p>
      )}

      {canRequest && mode === "new" ? (
        <form className="hc-form" onSubmit={create} aria-busy={busy}>
          <label className="hc-label" htmlFor={`${fieldId}-day`}>
            {t("home_care.transport.day_label")}
          </label>
          <input className="hc-input" id={`${fieldId}-day`} type="date" value={form.wantedOn || ""} min={today || undefined} onChange={(event) => setField("wantedOn", event.target.value)} required />
          <label className="hc-label" htmlFor={`${fieldId}-time`}>
            {t("home_care.transport.time_label")}
          </label>
          <input className="hc-input" id={`${fieldId}-time`} type="time" value={form.wantedTime || ""} onChange={(event) => setField("wantedTime", event.target.value)} />
          <label className="hc-label" htmlFor={`${fieldId}-destination`}>
            {t("home_care.transport.destination_label")}
          </label>
          <input
            className="hc-input"
            id={`${fieldId}-destination`}
            value={form.destination || ""}
            onChange={(event) => setField("destination", event.target.value)}
            maxLength={HOME_CARE_LIMITS.TRANSPORT_TEXT_MAX}
            autoComplete="off"
            required
          />
          <label className="hc-label" htmlFor={`${fieldId}-needs`}>
            {t("home_care.transport.needs_label")}
          </label>
          <input
            className="hc-input"
            id={`${fieldId}-needs`}
            value={form.needs || ""}
            onChange={(event) => setField("needs", event.target.value)}
            maxLength={HOME_CARE_LIMITS.TRANSPORT_TEXT_MAX}
            autoComplete="off"
          />
          <p className="hc-hint">{t("home_care.transport.request_hint")}</p>
          {error ? (
            <p className="hc-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="hc-row">
            <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || !form.wantedOn || !String(form.destination || "").trim()}>
              {t("home_care.transport.request_save")}
            </button>
            <button className="hc-btn hc-btn--quiet" type="button" onClick={close} disabled={busy}>
              {t("home_care.transport.cancel")}
            </button>
          </div>
        </form>
      ) : null}

      {error && !mode ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}
      {canRequest && !mode ? (
        <div className="hc-row">
          <button className="hc-btn hc-btn--quiet" type="button" onClick={() => open("new", { wantedOn: "", wantedTime: "", destination: "", needs: "" })} disabled={busy}>
            {t("home_care.transport.request")}
          </button>
          <button className="hc-btn hc-btn--quiet" type="button" onClick={openCard} disabled={busy}>
            {t("home_care.transport.card_open")}
          </button>
        </div>
      ) : null}
      {canRequest && !mode ? <p className="hc-hint">{t("home_care.transport.card_hint")}</p> : null}
    </section>
  );
}
