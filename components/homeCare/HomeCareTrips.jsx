"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgHeader from "@/components/org/OrgHeader";
import { CARE_TRIP_VEHICLES, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";
import { composeTripSheet } from "@/lib/homeCare/tripSheet";

import { planDayLabel } from "./HomeCarePlanView";
import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/** `AAAA-KK` → `KK.AAAA`. */
function monthLabel(month) {
  const [year, number] = String(month || "").split("-");
  return year && number ? `${number}.${year}` : "";
}

/**
 * Sõidupäevik (K6-a): töötaja paneb iga töösõidu kirja läbisõidumõõdiku alg- ja lõppnäiduga;
 * kilomeetrid tulevad näitude vahest. Kogu asutuse hooldusjuht näeb kuu kokkuvõtet töötaja
 * kaupa ja saab tabelifaili raamatupidamisele. Hüvitist siin ei arvutata.
 */
export default function HomeCareTrips({ context, initial }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const organizationId = context.organization.id;
  const [data, setData] = useState(initial);
  /* `mode`: null | "new" | { retract: id }. */
  const [mode, setMode] = useState(null);
  const [form, setForm] = useState({});
  const base = `${homeCareBase(organizationId)}/soidud`;
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const load = async (month) => {
    if (!month) return;
    const result = await call(`${base}?kuu=${encodeURIComponent(month)}`, { fallbackKey: "home_care.errors.list_failed" });
    if (result.ok) setData(result.data);
  };

  const startNew = () => {
    /* Uue sõidu algnäidu ettepanek on eelmise sõidu lõppnäit: vahe nende vahel oleks erasõit. */
    const last = data.mine.last;
    setForm({
      day: data.today,
      vehicle: last?.vehicle || "OWN",
      plate: last?.plate || "",
      startOdometer: last ? String(last.endOdometer) : "",
      endOdometer: "",
      purpose: ""
    });
    setError("");
    setMode("new");
  };
  const startRetract = (trip) => {
    setForm({ reason: "" });
    setError("");
    setMode({ retract: trip.id });
  };
  const close = () => {
    setMode(null);
    setError("");
  };

  const add = async (event) => {
    event.preventDefault();
    const result = await call(base, { method: "POST", body: form, fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return;
    setData(result.data);
    setMode(null);
  };
  const retract = async (event) => {
    event.preventDefault();
    const result = await call(`${base}/${encodeURIComponent(mode.retract)}`, { method: "PATCH", body: { reason: form.reason }, fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return;
    setData(result.data);
    setMode(null);
  };

  const download = () => {
    const text = composeTripSheet(t, { month: data.month, trips: data.all.trips, workers: data.all.workers }, { day: planDayLabel });
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `soidupaevik-${data.month}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const km = Number(form.endOdometer) - Number(form.startOdometer);
  const kmShown = form.startOdometer !== "" && form.endOdometer !== "" && Number.isFinite(km) && km >= 0;
  const tripLine = (trip, withWorker) =>
    [
      withWorker ? trip.workerName || "—" : null,
      t("home_care.trips.odometer_line", { start: trip.startOdometer, end: trip.endOdometer }),
      t(`home_care.trips.vehicles.${trip.vehicle}`) + (trip.plate ? ` ${trip.plate}` : ""),
      trip.purpose
    ]
      .filter(Boolean)
      .join(" · ");

  /* Oma sõidu tühistab töötaja oma loendis; kõigi töötajate loendis tühistab hooldusjuht teiste sõite. */
  const canRetract = (trip, withWorker) => (withWorker ? data.isCoordinator && !trip.isMine : trip.isMine);

  const tripRow = (trip, withWorker = false) => (
    <li key={trip.id}>
      <div>
        <strong>
          {planDayLabel(trip.day)} · {t("home_care.trips.km", { km: trip.km })}
        </strong>
      </div>
      <div className="hc-sub">{tripLine(trip, withWorker)}</div>
      {data.canAdd && !mode && canRetract(trip, withWorker) ? (
        <div className="hc-row">
          <button className="hc-btn hc-btn--quiet" type="button" onClick={() => startRetract(trip)} disabled={busy}>
            {t("home_care.trips.retract")}
          </button>
        </div>
      ) : null}
      {mode?.retract === trip.id && canRetract(trip, withWorker) ? (
        <form className="hc-form" onSubmit={retract} aria-busy={busy}>
          <label className="hc-label" htmlFor={`${fieldId}-reason`}>
            {t("home_care.trips.retract_reason")}
          </label>
          <input className="hc-input" id={`${fieldId}-reason`} value={form.reason || ""} onChange={(event) => setField("reason", event.target.value)} maxLength={HOME_CARE_LIMITS.TRIP_PURPOSE_MAX} autoComplete="off" required />
          {error ? (
            <p className="hc-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="hc-row">
            <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || !String(form.reason || "").trim()}>
              {t("home_care.trips.retract_save")}
            </button>
            <button className="hc-btn hc-btn--quiet" type="button" onClick={close} disabled={busy}>
              {t("home_care.trips.cancel")}
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );

  return (
    <section className="ow-shell hc-shell">
      <OrgHeader context={context} />

      <div className="hc-head">
        <Link className="hc-back" href={`/org/${organizationId}/koduteenus`}>
          {t("home_care.client.back")}
        </Link>
        <h2 className="hc-title">{t("home_care.trips.title")}</h2>
        <p className="hc-sub">{t("home_care.trips.intro")}</p>
      </div>

      <section className="hc-section" aria-live="polite">
        <div className="hc-row hc-row--between">
          <button className="hc-btn hc-btn--quiet" type="button" onClick={() => load(data.previousMonth)} disabled={busy}>
            {t("home_care.month.previous")}
          </button>
          <h3 className="hc-section-title">{monthLabel(data.month)}</h3>
          <button className="hc-btn hc-btn--quiet" type="button" onClick={() => load(data.nextMonth)} disabled={busy || !data.nextMonth}>
            {t("home_care.month.next")}
          </button>
        </div>
        {error && !mode ? (
          <p className="hc-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="hc-section" aria-labelledby={`${fieldId}-mine`}>
        <h3 className="hc-section-title" id={`${fieldId}-mine`}>
          {t("home_care.trips.mine_title")}
          {data.mine.trips.length ? ` · ${t("home_care.trips.km", { km: data.mine.km })}` : ""}
        </h3>
        {data.mine.trips.length ? <ul className="hc-list hc-list--plain">{data.mine.trips.map((trip) => tripRow(trip))}</ul> : <p className="hc-sub">{t("home_care.trips.mine_empty")}</p>}

        {data.canAdd && mode === "new" ? (
          <form className="hc-form" onSubmit={add} aria-busy={busy}>
            <label className="hc-label" htmlFor={`${fieldId}-day`}>
              {t("home_care.trips.day_label")}
            </label>
            <input className="hc-input" id={`${fieldId}-day`} type="date" value={form.day || ""} max={data.today} onChange={(event) => setField("day", event.target.value)} required />
            <fieldset className="hc-fieldset">
              <legend className="hc-label">{t("home_care.trips.vehicle_label")}</legend>
              <div className="hc-chips" role="group" aria-label={t("home_care.trips.vehicle_label")}>
                {CARE_TRIP_VEHICLES.map((value) => (
                  <button key={value} type="button" className="hc-chip" aria-pressed={form.vehicle === value} onClick={() => setField("vehicle", value)}>
                    {t(`home_care.trips.vehicles.${value}`)}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="hc-label" htmlFor={`${fieldId}-plate`}>
              {t("home_care.trips.plate_label")}
            </label>
            <input className="hc-input" id={`${fieldId}-plate`} value={form.plate || ""} onChange={(event) => setField("plate", event.target.value)} maxLength={HOME_CARE_LIMITS.TRIP_PLATE_MAX} autoComplete="off" />
            <label className="hc-label" htmlFor={`${fieldId}-start`}>
              {t("home_care.trips.start_label")}
            </label>
            <input className="hc-input" id={`${fieldId}-start`} inputMode="numeric" pattern="[0-9]*" value={form.startOdometer || ""} onChange={(event) => setField("startOdometer", event.target.value)} maxLength={7} autoComplete="off" required />
            <label className="hc-label" htmlFor={`${fieldId}-end`}>
              {t("home_care.trips.end_label")}
            </label>
            <input className="hc-input" id={`${fieldId}-end`} inputMode="numeric" pattern="[0-9]*" value={form.endOdometer || ""} onChange={(event) => setField("endOdometer", event.target.value)} maxLength={7} autoComplete="off" required />
            {kmShown ? <p className="hc-sub">{t("home_care.trips.km", { km })}</p> : null}
            <label className="hc-label" htmlFor={`${fieldId}-purpose`}>
              {t("home_care.trips.purpose_label")}
            </label>
            <input className="hc-input" id={`${fieldId}-purpose`} value={form.purpose || ""} onChange={(event) => setField("purpose", event.target.value)} maxLength={HOME_CARE_LIMITS.TRIP_PURPOSE_MAX} autoComplete="off" required />
            <p className="hc-hint">{t("home_care.trips.purpose_hint")}</p>
            {error ? (
              <p className="hc-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="hc-row">
              <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || !kmShown || !String(form.purpose || "").trim()}>
                {t("home_care.trips.save")}
              </button>
              <button className="hc-btn hc-btn--quiet" type="button" onClick={close} disabled={busy}>
                {t("home_care.trips.cancel")}
              </button>
            </div>
          </form>
        ) : null}
        {data.canAdd && !mode ? (
          <div className="hc-row">
            <button className="hc-btn hc-btn--primary" type="button" onClick={startNew} disabled={busy}>
              {t("home_care.trips.add")}
            </button>
          </div>
        ) : null}
      </section>

      {/* Kogu asutuse hooldusjuht: kuu kokkuvõte töötaja kaupa, kõik read ja tabelifail raamatupidamisele. */}
      {data.all ? (
        <section className="hc-section" aria-labelledby={`${fieldId}-all`}>
          <h3 className="hc-section-title" id={`${fieldId}-all`}>
            {t("home_care.trips.all_title")}
          </h3>
          {data.all.workers.length ? (
            <>
              <ul className="hc-list hc-list--plain">
                {data.all.workers.map((row) => (
                  <li key={row.membershipId}>
                    <span>{row.name || "—"}</span>
                    <span className="hc-entry__meta"> {t("home_care.trips.worker_line", { trips: row.trips, km: row.km, ownKm: row.ownKm })}</span>
                  </li>
                ))}
              </ul>
              <ul className="hc-list hc-list--plain">{data.all.trips.map((trip) => tripRow(trip, true))}</ul>
              {data.all.truncated ? <p className="hc-notice">{t("home_care.trips.truncated", { count: data.all.trips.length })}</p> : null}
              <div className="hc-row">
                <button className="hc-btn hc-btn--quiet" type="button" onClick={download}>
                  {t("home_care.trips.download")}
                </button>
              </div>
              <p className="hc-hint">{t("home_care.trips.download_hint")}</p>
            </>
          ) : (
            <p className="hc-sub">{t("home_care.trips.all_empty")}</p>
          )}
        </section>
      ) : null}
    </section>
  );
}
