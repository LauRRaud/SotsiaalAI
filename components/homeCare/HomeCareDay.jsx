"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgHeader from "@/components/org/OrgHeader";
import Dropdown from "@/components/ui/Dropdown";
import { CARE_VISIT_CANCEL_REASONS, CarePlannedState, CareVisitChangeKind, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { minutesLabel } from "./HomeCareDecisionView";
import HomeCareOutbox from "./HomeCareOutbox";
import { planDayLabel } from "./HomeCarePlanView";
import { clientHref, homeCareBase, useHomeCareApi } from "./homeCareClient";

const STATE_BADGE = {
  [CarePlannedState.MISSING]: " hc-badge--danger",
  [CarePlannedState.CANCELLED]: " hc-badge--warn"
};

/**
 * Hooldusjuhi päevaplaan: käigumuster koos selle päeva eranditega.
 *
 * Käigud on töötaja kaupa, määramata käigud kõige ees (need vajavad otsust). Iga käigu
 * juures saab selle üheks päevaks ümber tõsta (teine töötaja ja/või kellaaeg) või ära
 * jätta põhjusega; muster ise ei muutu. Käigu seis tuleb käigu kirjetest, käsitsi seda
 * siin ei märgita.
 *
 * Lingid kliendi lehele on `prefetch={false}`: lehe avamine jätab avamislogisse rea.
 */
export default function HomeCareDay({ context, initial }) {
  const { t } = useI18n();
  const { call, busy, error } = useHomeCareApi();
  const fieldId = useId();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const [data, setData] = useState(initial);
  /* Avatud vorm: `{ slotId, mode: "move" | "cancel" }`. Korraga üks. */
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState({ workerMembershipId: "", startTime: "", reason: "", note: "" });
  const [notice, setNotice] = useState("");

  const canEdit = Boolean(data.canEdit);
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const load = async (day) => {
    const result = await call(`${homeCareBase(organizationId)}/paev?paev=${encodeURIComponent(day)}`, {
      fallbackKey: "home_care.errors.list_failed"
    });
    if (!result.ok) return;
    setData(result.data);
    setOpen(null);
    setNotice("");
  };

  const openForm = (visit, mode) => {
    setForm({ workerMembershipId: visit.worker?.membershipId || "", startTime: visit.startTime, reason: "", note: "" });
    setOpen({ slotId: visit.slotId, mode });
    setNotice("");
  };

  const send = async (visit, method, body) => {
    const url = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(visit.client.id)}/kaigud/${encodeURIComponent(visit.slotId)}/erand`;
    const result = await call(url, { method, body: { day: data.day, ...body }, fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return;
    setData(result.data);
    setOpen(null);
    setNotice(t("home_care.day.saved"));
  };

  const workerOptions = [
    { value: "", label: t("home_care.day.worker_none") },
    ...(data.careWorkers || []).map((worker) => ({ value: worker.membershipId, label: worker.name || "—" }))
  ];

  const visitRow = (visit) => {
    const isOpen = open?.slotId === visit.slotId;
    const cancelled = visit.state === CarePlannedState.CANCELLED;
    const done = visit.state === CarePlannedState.DONE;
    return (
      <li key={visit.slotId}>
        <span>
          {visit.startTime}{" "}
          <Link className="hc-entry__link" href={clientHref(organizationId, visit.client.id)} prefetch={false}>
            {visit.client.displayName}
          </Link>
        </span>{" "}
        <span className={`hc-badge${STATE_BADGE[visit.state] || ""}`}>{t(`home_care.day.states.${visit.state}`)}</span>
        {visit.change?.workerChanged ? (
          <>
            {" "}
            <span className="hc-badge">{t("home_care.day.changed_worker")}</span>
          </>
        ) : null}
        {visit.change?.timeChanged ? (
          <>
            {" "}
            <span className="hc-badge">{t("home_care.day.changed_time")}</span>
          </>
        ) : null}
        {visit.worker && !visit.worker.active ? (
          <>
            {" "}
            <span className="hc-badge hc-badge--warn">{t("home_care.slots.worker_inactive")}</span>
          </>
        ) : null}
        <span className="hc-entry__meta">
          {" "}
          {[
            minutesLabel(t, visit.plannedMinutes),
            visit.client.address,
            visit.note,
            cancelled && visit.change?.reason ? t(`home_care.day.cancel_reasons.${visit.change.reason}`) : null,
            visit.change?.note
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>

        {canEdit && !open ? (
          <span className="hc-row">
            {!cancelled && !done && data.day >= data.today ? (
              <button className="hc-btn hc-btn--quiet" type="button" onClick={() => openForm(visit, "move")} disabled={busy}>
                {t("home_care.day.move")}
              </button>
            ) : null}
            {!cancelled && !done ? (
              <button className="hc-btn hc-btn--quiet" type="button" onClick={() => openForm(visit, "cancel")} disabled={busy}>
                {t("home_care.day.cancel")}
              </button>
            ) : null}
            {visit.change ? (
              <button className="hc-btn hc-btn--quiet" type="button" onClick={() => send(visit, "DELETE", {})} disabled={busy}>
                {t("home_care.day.restore")}
              </button>
            ) : null}
          </span>
        ) : null}

        {isOpen && open.mode === "move" ? (
          <form
            className="hc-form"
            onSubmit={(event) => {
              event.preventDefault();
              send(visit, "PUT", {
                kind: CareVisitChangeKind.MOVED,
                workerMembershipId: form.workerMembershipId || null,
                startTime: form.startTime,
                note: form.note
              });
            }}
            aria-busy={busy}
          >
            <h4 className="hc-section-title">{t("home_care.day.move_title", { client: visit.client.displayName })}</h4>
            <div className="hc-field">
              <span className="hc-label">{t("home_care.day.worker_label")}</span>
              <Dropdown
                value={form.workerMembershipId}
                onChange={(value) => setField("workerMembershipId", value)}
                ariaLabel={t("home_care.day.worker_label")}
                options={workerOptions}
              />
            </div>
            <div className="hc-field">
              <label className="hc-label" htmlFor={`${fieldId}-time`}>
                {t("home_care.day.time_label")}
              </label>
              <input
                id={`${fieldId}-time`}
                className="hc-input"
                type="time"
                value={form.startTime}
                onChange={(event) => setField("startTime", event.target.value)}
                required
              />
            </div>
            <div className="hc-field">
              <label className="hc-label" htmlFor={`${fieldId}-move-note`}>
                {t("home_care.day.note_label")}
              </label>
              <input
                id={`${fieldId}-move-note`}
                className="hc-input"
                value={form.note}
                onChange={(event) => setField("note", event.target.value)}
                maxLength={HOME_CARE_LIMITS.VISIT_CHANGE_NOTE_MAX}
                autoComplete="off"
              />
            </div>
            {error ? (
              <p className="hc-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="hc-row">
              <button className="hc-btn hc-btn--primary" type="submit" disabled={busy}>
                {t("home_care.day.move_save")}
              </button>
              <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setOpen(null)} disabled={busy}>
                {t("home_care.day.close_form")}
              </button>
            </div>
          </form>
        ) : null}

        {isOpen && open.mode === "cancel" ? (
          <form
            className="hc-form"
            onSubmit={(event) => {
              event.preventDefault();
              send(visit, "PUT", { kind: CareVisitChangeKind.CANCELLED, reason: form.reason, note: form.note });
            }}
            aria-busy={busy}
          >
            <h4 className="hc-section-title">{t("home_care.day.cancel_title", { client: visit.client.displayName })}</h4>
            <div className="hc-field">
              <span className="hc-label">{t("home_care.day.reason_label")}</span>
              <div className="hc-chips" role="group" aria-label={t("home_care.day.reason_label")}>
                {CARE_VISIT_CANCEL_REASONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="hc-chip"
                    aria-pressed={form.reason === value}
                    onClick={() => setField("reason", value)}
                  >
                    {t(`home_care.day.cancel_reasons.${value}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="hc-field">
              <label className="hc-label" htmlFor={`${fieldId}-cancel-note`}>
                {t("home_care.day.note_label")}
              </label>
              <input
                id={`${fieldId}-cancel-note`}
                className="hc-input"
                value={form.note}
                onChange={(event) => setField("note", event.target.value)}
                maxLength={HOME_CARE_LIMITS.VISIT_CHANGE_NOTE_MAX}
                autoComplete="off"
              />
            </div>
            {error ? (
              <p className="hc-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="hc-row">
              <button className="hc-btn hc-btn--danger" type="submit" disabled={busy || !form.reason}>
                {t("home_care.day.cancel_save")}
              </button>
              <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setOpen(null)} disabled={busy}>
                {t("home_care.day.close_form")}
              </button>
            </div>
          </form>
        ) : null}
      </li>
    );
  };

  const group = (key, title, visits, hint) => (
    <section className="hc-section" key={key} aria-labelledby={`${fieldId}-${key}`}>
      <h3 className="hc-section-title" id={`${fieldId}-${key}`}>
        {title}
        {visits.length ? ` · ${visits.length}` : ""}
      </h3>
      {hint ? <p className="hc-hint">{hint}</p> : null}
      <ul className="hc-list hc-list--plain">{visits.map(visitRow)}</ul>
    </section>
  );

  const empty = data.unassigned.length === 0 && data.workers.length === 0 && data.away.length === 0;

  return (
    <section className="ow-shell hc-shell">
      <OrgHeader context={context} />
      <HomeCareOutbox ownerId={context.membership?.id || ""} timeZone={timeZone} />

      <div className="hc-head">
        <Link className="hc-back" href={`/org/${organizationId}/koduteenus`}>
          {t("home_care.client.back")}
        </Link>
        <h2 className="hc-title">{t("home_care.day.title")}</h2>
        <p className="hc-sub">{t("home_care.day.intro")}</p>
      </div>

      <section className="hc-section" aria-live="polite">
        <div className="hc-row hc-row--between">
          <button className="hc-btn hc-btn--quiet" type="button" onClick={() => load(data.previousDay)} disabled={busy}>
            {t("home_care.day.previous")}
          </button>
          <h3 className="hc-section-title">
            {t(`home_care.slots.weekdays_long.${data.weekday}`)} {planDayLabel(data.day)}
          </h3>
          <button className="hc-btn hc-btn--quiet" type="button" onClick={() => load(data.nextDay)} disabled={busy}>
            {t("home_care.day.next")}
          </button>
        </div>
        <div className="hc-chips" role="group" aria-label={t("home_care.day.week_label")}>
          {data.week.map((item) => (
            <button
              key={item.day}
              type="button"
              className="hc-chip"
              aria-pressed={item.day === data.day}
              aria-label={t("home_care.day.week_day", {
                weekday: t(`home_care.slots.weekdays_long.${item.weekday}`),
                date: planDayLabel(item.day),
                planned: item.planned,
                unassigned: item.unassigned,
                missing: item.missing
              })}
              onClick={() => load(item.day)}
              disabled={busy}
            >
              {t(`home_care.slots.weekdays.${item.weekday}`)} {item.planned}
              {item.unassigned || item.missing ? " !" : ""}
            </button>
          ))}
        </div>
        {data.day !== data.today ? (
          <button className="hc-btn hc-btn--quiet" type="button" onClick={() => load(data.today)} disabled={busy}>
            {t("home_care.day.today_button")}
          </button>
        ) : null}
        <p className="hc-sub">
          {t("home_care.day.totals", {
            planned: data.totals.planned,
            amount: minutesLabel(t, data.totals.minutes),
            done: data.totals.done,
            missing: data.totals.missing,
            cancelled: data.totals.cancelled,
            unassigned: data.totals.unassigned
          })}
        </p>
        {notice ? (
          <p className="hc-ok" role="status">
            {notice}
          </p>
        ) : null}
        {!open && error ? (
          <p className="hc-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {empty ? <p className="hc-sub">{t("home_care.day.empty")}</p> : null}
      {data.unassigned.length ? group("unassigned", t("home_care.day.unassigned_title"), data.unassigned) : null}
      {data.workers.map((worker) => group(`w-${worker.membershipId}`, worker.name || "—", worker.visits))}
      {data.away.length ? group("away", t("home_care.day.away_title"), data.away, t("home_care.day.away_hint")) : null}
    </section>
  );
}
