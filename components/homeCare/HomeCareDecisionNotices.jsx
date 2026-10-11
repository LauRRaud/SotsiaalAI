"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CARE_NOTICE_ANSWERS, CARE_NOTICE_CHANNELS, CARE_NOTICE_REASONS, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { planDayLabel } from "./HomeCarePlanView";
import { formatDateTime, homeCareBase, useHomeCareApi } from "./homeCareClient";

/** Päeviku kirje lühidalt valiku jaoks. */
function shortText(text, max = 90) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Teated otsustajale (K5-r): hooldusjuht koostab kliendi kohta teate omavalitsuse
 * sotsiaaltöötajale, kopeerib teksti e-kirja või STAR-i ja märgib hiljem vastuse. Platvorm
 * ise teadet ei saada. Jaotist näeb ainult hooldusjuht.
 */
export default function HomeCareDecisionNotices({ organizationId, clientId, initial = [], entries = [], canEdit = false, today = "", timeZone = "Europe/Tallinn" }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const [notices, setNotices] = useState(initial || []);
  /* `mode`: null | "new" | { kind: "answer" | "withdraw", id }. */
  const [mode, setMode] = useState(null);
  const [form, setForm] = useState({});
  const [shownId, setShownId] = useState("");
  const [copyState, setCopyState] = useState("");

  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/teated`;
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const pickable = entries.filter((entry) => !entry.retractedAt && entry.text).slice(0, HOME_CARE_LIMITS.NOTICE_ENTRIES_PICK);

  const open = (next, values) => {
    setForm(values);
    setError("");
    setMode(next);
  };
  const close = () => {
    setMode(null);
    setError("");
  };

  const toggleEntry = (id) =>
    setForm((previous) => {
      const picked = previous.entryIds || [];
      if (picked.includes(id)) return { ...previous, entryIds: picked.filter((value) => value !== id) };
      return picked.length >= HOME_CARE_LIMITS.NOTICE_ENTRIES_MAX ? previous : { ...previous, entryIds: [...picked, id] };
    });

  const create = async (event) => {
    event.preventDefault();
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
    if (!result.ok) return;
    setNotices(result.data.decisionNotices || []);
    /* Uue teate tekst kohe ette: järgmine samm on see kopeerida ja saata. */
    setShownId(result.data.noticeId || "");
    setCopyState("");
    setMode(null);
  };

  const answer = async (event) => {
    event.preventDefault();
    const result = await call(`${base}/${encodeURIComponent(mode.id)}/vastus`, {
      method: "POST",
      body: { answer: form.answer, answeredOn: form.answeredOn, reassessBy: form.answer === "REASSESS" ? form.reassessBy : null, answerNote: form.answerNote },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    setNotices(result.data.decisionNotices || []);
    setMode(null);
  };

  const withdraw = async (event) => {
    event.preventDefault();
    const result = await call(`${base}/${encodeURIComponent(mode.id)}/tagasi`, { method: "POST", body: { reason: form.reason }, fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return;
    setNotices(result.data.decisionNotices || []);
    setMode(null);
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("ok");
    } catch {
      setCopyState("failed");
    }
  };

  const stateLine = (item) => {
    if (item.state === "WITHDRAWN") return t("home_care.notice.withdrawn", { reason: item.withdrawReason || "" });
    if (item.state === "WAITING") return item.waitingDays ? t("home_care.notice.waiting", { days: item.waitingDays }) : t("home_care.notice.waiting_today");
    return [
      t("home_care.notice.answered", { date: planDayLabel(item.answeredOn), answer: t(`home_care.notice.answers.${item.answer}`) }),
      item.reassessBy ? t("home_care.notice.reassess_by", { date: planDayLabel(item.reassessBy) }) : null,
      item.answerNote
    ]
      .filter(Boolean)
      .join(" · ");
  };

  if (!canEdit && !notices.length) return null;
  const noteRequired = form.answer === "VOLUME_STAYS" || form.answer === "OTHER";

  return (
    <section className="hc-section" aria-labelledby={`${fieldId}-title`}>
      <h2 className="hc-section-title" id={`${fieldId}-title`}>
        {t("home_care.notice.title")}
      </h2>
      <p className="hc-hint">{t("home_care.notice.intro")}</p>

      {notices.length ? (
        <ul className="hc-list hc-list--plain">
          {notices.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{t("home_care.notice.line", { date: planDayLabel(item.sentOn), reason: t(`home_care.notice.reasons.${item.reason}`), channel: t(`home_care.notice.channels.${item.channel}`) })}</strong>
                {item.recipient ? ` · ${item.recipient}` : ""}
                {item.reassessOverdue ? (
                  <>
                    {" "}
                    <span className="hc-badge hc-badge--warn">{t("home_care.notice.reassess_overdue")}</span>
                  </>
                ) : null}
              </div>
              <div className="hc-sub">{stateLine(item)}</div>
              <div className="hc-row">
                <button
                  className="hc-btn hc-btn--quiet"
                  type="button"
                  aria-expanded={shownId === item.id}
                  onClick={() => {
                    setShownId(shownId === item.id ? "" : item.id);
                    setCopyState("");
                  }}
                >
                  {shownId === item.id ? t("home_care.notice.hide_text") : t("home_care.notice.show_text")}
                </button>
                {canEdit && item.state === "WAITING" && !mode ? (
                  <>
                    <button
                      className="hc-btn hc-btn--quiet"
                      type="button"
                      onClick={() => open({ kind: "answer", id: item.id }, { answer: "", answeredOn: today, reassessBy: "", answerNote: "" })}
                      disabled={busy}
                    >
                      {t("home_care.notice.answer_add")}
                    </button>
                    <button className="hc-btn hc-btn--quiet" type="button" onClick={() => open({ kind: "withdraw", id: item.id }, { reason: "" })} disabled={busy}>
                      {t("home_care.notice.withdraw")}
                    </button>
                  </>
                ) : null}
              </div>

              {shownId === item.id ? (
                <>
                  <textarea className="hc-textarea" readOnly rows={10} value={item.sentText} aria-label={t("home_care.notice.text_title")} />
                  <div className="hc-row">
                    <button className="hc-btn hc-btn--primary" type="button" onClick={() => copy(item.sentText)}>
                      {t("home_care.notice.copy")}
                    </button>
                  </div>
                  <p className="hc-hint" aria-live="polite">
                    {copyState === "ok" ? t("home_care.notice.copied") : copyState === "failed" ? t("home_care.notice.copy_failed") : t("home_care.notice.sent_hint")}
                  </p>
                </>
              ) : null}

              {mode?.kind === "answer" && mode.id === item.id ? (
                <form className="hc-form" onSubmit={answer} aria-busy={busy}>
                  <fieldset className="hc-fieldset">
                    <legend className="hc-label">{t("home_care.notice.answer_label")}</legend>
                    <div className="hc-chips" role="group" aria-label={t("home_care.notice.answer_label")}>
                      {CARE_NOTICE_ANSWERS.map((value) => (
                        <button key={value} type="button" className="hc-chip" aria-pressed={form.answer === value} onClick={() => setField("answer", value)}>
                          {t(`home_care.notice.answers.${value}`)}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <label className="hc-label" htmlFor={`${fieldId}-answered-on`}>
                    {t("home_care.notice.answered_on_label")}
                  </label>
                  <input className="hc-input" id={`${fieldId}-answered-on`} type="date" value={form.answeredOn || ""} max={today || undefined} min={item.sentOn} onChange={(event) => setField("answeredOn", event.target.value)} />
                  {form.answer === "REASSESS" ? (
                    <>
                      <label className="hc-label" htmlFor={`${fieldId}-reassess-by`}>
                        {t("home_care.notice.reassess_by_label")}
                      </label>
                      <input className="hc-input" id={`${fieldId}-reassess-by`} type="date" value={form.reassessBy || ""} min={item.sentOn} onChange={(event) => setField("reassessBy", event.target.value)} required />
                    </>
                  ) : null}
                  <label className="hc-label" htmlFor={`${fieldId}-answer-note`}>
                    {noteRequired ? t("home_care.notice.answer_note_required") : t("home_care.notice.answer_note_label")}
                  </label>
                  <input
                    className="hc-input"
                    id={`${fieldId}-answer-note`}
                    value={form.answerNote || ""}
                    onChange={(event) => setField("answerNote", event.target.value)}
                    maxLength={HOME_CARE_LIMITS.NOTICE_ANSWER_NOTE_MAX}
                    autoComplete="off"
                  />
                  {error ? (
                    <p className="hc-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                  <div className="hc-row">
                    <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || !form.answer}>
                      {t("home_care.notice.answer_save")}
                    </button>
                    <button className="hc-btn hc-btn--quiet" type="button" onClick={close} disabled={busy}>
                      {t("home_care.notice.cancel")}
                    </button>
                  </div>
                </form>
              ) : null}

              {mode?.kind === "withdraw" && mode.id === item.id ? (
                <form className="hc-form" onSubmit={withdraw} aria-busy={busy}>
                  <label className="hc-label" htmlFor={`${fieldId}-withdraw`}>
                    {t("home_care.notice.withdraw_reason")}
                  </label>
                  <input
                    className="hc-input"
                    id={`${fieldId}-withdraw`}
                    value={form.reason || ""}
                    onChange={(event) => setField("reason", event.target.value)}
                    maxLength={HOME_CARE_LIMITS.NOTICE_WITHDRAW_REASON_MAX}
                    autoComplete="off"
                    required
                  />
                  {error ? (
                    <p className="hc-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                  <div className="hc-row">
                    <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || !String(form.reason || "").trim()}>
                      {t("home_care.notice.withdraw_save")}
                    </button>
                    <button className="hc-btn hc-btn--quiet" type="button" onClick={close} disabled={busy}>
                      {t("home_care.notice.cancel")}
                    </button>
                  </div>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="hc-sub">{t("home_care.notice.none")}</p>
      )}

      {canEdit && mode === "new" ? (
        <form className="hc-form" onSubmit={create} aria-busy={busy}>
          <fieldset className="hc-fieldset">
            <legend className="hc-label">{t("home_care.notice.reason_label")}</legend>
            <div className="hc-chips" role="group" aria-label={t("home_care.notice.reason_label")}>
              {CARE_NOTICE_REASONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="hc-chip"
                  aria-pressed={form.reason === value}
                  /* Ülevaate juurde käivad arvud: märge pannakse ette, hooldusjuht saab selle maha võtta. */
                  onClick={() => setForm((previous) => ({ ...previous, reason: value, withFigures: value === "REVIEW" ? true : previous.withFigures }))}
                >
                  {t(`home_care.notice.reasons.${value}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="hc-label" htmlFor={`${fieldId}-text`}>
            {t("home_care.notice.text_label")}
          </label>
          <textarea
            className="hc-textarea hc-textarea--short"
            id={`${fieldId}-text`}
            value={form.text || ""}
            onChange={(event) => setField("text", event.target.value)}
            maxLength={HOME_CARE_LIMITS.NOTICE_TEXT_MAX}
            rows={3}
            required
          />
          <p className="hc-hint">{t("home_care.notice.text_hint")}</p>

          <label className="hc-check">
            <input type="checkbox" checked={Boolean(form.withFigures)} onChange={(event) => setField("withFigures", event.target.checked)} />
            <span>{t("home_care.notice.figures_label")}</span>
          </label>
          <p className="hc-hint">{t("home_care.notice.figures_hint")}</p>

          <fieldset className="hc-fieldset">
            <legend className="hc-label">{t("home_care.notice.entries_label", { limit: HOME_CARE_LIMITS.NOTICE_ENTRIES_MAX })}</legend>
            {pickable.length ? (
              pickable.map((entry) => {
                const picked = (form.entryIds || []).includes(entry.id);
                return (
                  <label className="hc-check" key={entry.id}>
                    <input
                      type="checkbox"
                      checked={picked}
                      disabled={!picked && (form.entryIds || []).length >= HOME_CARE_LIMITS.NOTICE_ENTRIES_MAX}
                      onChange={() => toggleEntry(entry.id)}
                    />
                    <span>
                      {formatDateTime(entry.occurredAt, timeZone)}: {shortText(entry.text)}
                    </span>
                  </label>
                );
              })
            ) : (
              <p className="hc-hint">{t("home_care.notice.entries_none")}</p>
            )}
            <p className="hc-hint">{t("home_care.notice.entries_hint")}</p>
          </fieldset>

          <label className="hc-label" htmlFor={`${fieldId}-recipient`}>
            {t("home_care.notice.recipient_label")}
          </label>
          <input
            className="hc-input"
            id={`${fieldId}-recipient`}
            value={form.recipient || ""}
            onChange={(event) => setField("recipient", event.target.value)}
            maxLength={HOME_CARE_LIMITS.NOTICE_RECIPIENT_MAX}
            autoComplete="off"
          />
          <fieldset className="hc-fieldset">
            <legend className="hc-label">{t("home_care.notice.channel_label")}</legend>
            <div className="hc-chips" role="group" aria-label={t("home_care.notice.channel_label")}>
              {CARE_NOTICE_CHANNELS.map((value) => (
                <button key={value} type="button" className="hc-chip" aria-pressed={form.channel === value} onClick={() => setField("channel", value)}>
                  {t(`home_care.notice.channels.${value}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="hc-label" htmlFor={`${fieldId}-sent-on`}>
            {t("home_care.notice.sent_on_label")}
          </label>
          <input className="hc-input" id={`${fieldId}-sent-on`} type="date" value={form.sentOn || ""} max={today || undefined} onChange={(event) => setField("sentOn", event.target.value)} />

          {error ? (
            <p className="hc-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="hc-row">
            <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || !form.reason || !form.channel || !String(form.text || "").trim()}>
              {t("home_care.notice.save")}
            </button>
            <button className="hc-btn hc-btn--quiet" type="button" onClick={close} disabled={busy}>
              {t("home_care.notice.cancel")}
            </button>
          </div>
        </form>
      ) : null}

      {canEdit && !mode ? (
        <div className="hc-row">
          <button
            className="hc-btn hc-btn--quiet"
            type="button"
            onClick={() => open("new", { reason: "", text: "", recipient: "", channel: "", sentOn: today, entryIds: [], withFigures: false })}
            disabled={busy}
          >
            {t("home_care.notice.add")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
