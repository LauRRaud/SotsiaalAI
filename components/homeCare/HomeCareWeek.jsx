"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgHeader from "@/components/org/OrgHeader";

import { minutesLabel } from "./HomeCareDecisionView";
import { planDayLabel } from "./HomeCarePlanView";
import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Hooldusjuhi nädalaplaan (K3-f): seitse päeva ühel real, iga töötaja kohta käikude arv
 * päeva kaupa ja nädala plaanitud aeg. Puudumise päev ja päev, kus on katmata või
 * määramata käike, on märgitud sõnaga, mitte ainult värviga. Iga lahter viib selle päeva
 * plaani, kus käigu saab ümber tõsta või ära jätta; siin midagi ei muudeta.
 */
export default function HomeCareWeek({ context, initial }) {
  const { t } = useI18n();
  const { call, busy, error } = useHomeCareApi();
  const headingId = useId();
  const organizationId = context.organization.id;
  const [data, setData] = useState(initial);

  const load = async (week) => {
    const result = await call(`${homeCareBase(organizationId)}/nadal?nadal=${encodeURIComponent(week)}`, {
      fallbackKey: "home_care.errors.list_failed"
    });
    if (result.ok) setData(result.data);
  };

  const dayHref = (day) => `/org/${organizationId}/koduteenus/paev?paev=${encodeURIComponent(day)}`;
  const weekdayOf = (day) => data.days.find((item) => item.day === day)?.weekday;
  const dayName = (day) => `${t(`home_care.slots.weekdays_long.${weekdayOf(day)}`)} ${planDayLabel(day)}`;

  /* Üks lahter: nädalapäeva täht, arv ja vajadusel sõna. Lahter on link selle päeva plaani. */
  const cell = (key, day, { count, note = "", tone = "", label }) => (
    <Link
      key={key}
      className={`hc-week__cell${tone ? ` hc-week__cell--${tone}` : ""}${day === data.today ? " hc-week__cell--today" : ""}`}
      href={dayHref(day)}
      aria-label={label}
    >
      <span className="hc-week__day" aria-hidden="true">
        {t(`home_care.slots.weekdays.${weekdayOf(day)}`)}
      </span>
      <span className="hc-week__count" aria-hidden="true">
        {count}
      </span>
      {note ? (
        <span className="hc-week__note" aria-hidden="true">
          {note}
        </span>
      ) : null}
    </Link>
  );

  const empty = data.totals.visits === 0 && data.totals.uncovered === 0;

  return (
    <section className="ow-shell hc-shell">
      <OrgHeader context={context} />

      <div className="hc-head">
        <Link className="hc-back" href={`/org/${organizationId}/koduteenus`}>
          {t("home_care.client.back")}
        </Link>
        <h2 className="hc-title">{t("home_care.week.title")}</h2>
        <p className="hc-sub">{t("home_care.week.intro")}</p>
      </div>

      <section className="hc-section" aria-live="polite" aria-labelledby={headingId}>
        <h3 className="hc-section-title" id={headingId}>
          {t("home_care.week.heading", { week: data.week, from: planDayLabel(data.monday), to: planDayLabel(data.sunday) })}
        </h3>
        <div className="hc-row">
          <button className="hc-btn hc-btn--quiet" type="button" onClick={() => load(data.previousWeek)} disabled={busy || !data.previousWeek}>
            {t("home_care.week.previous")}
          </button>
          {data.monday !== data.thisWeek ? (
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => load(data.thisWeek)} disabled={busy}>
              {t("home_care.week.this_week")}
            </button>
          ) : null}
          <button className="hc-btn hc-btn--quiet" type="button" onClick={() => load(data.nextWeek)} disabled={busy || !data.nextWeek}>
            {t("home_care.week.next")}
          </button>
        </div>
        <p className="hc-sub">
          {t("home_care.week.totals", {
            visits: data.totals.visits,
            amount: minutesLabel(t, data.totals.minutes),
            unassigned: data.totals.unassigned,
            uncovered: data.totals.uncovered
          })}
        </p>
        {error ? (
          <p className="hc-error" role="alert">
            {error}
          </p>
        ) : null}

        {/* Päevad: kõik käigud kokku; sõna ütleb, kui päeval on katmata või määramata käike. */}
        <div className="hc-week" role="group" aria-label={t("home_care.week.days_label")}>
          {data.days.map((day) => {
            const open = day.unassigned + day.uncovered;
            return cell(day.day, day.day, {
              count: day.visits,
              note: open ? t("home_care.week.open_short", { count: open }) : "",
              tone: open ? "danger" : day.visits ? "" : "off",
              label: t("home_care.week.day_cell", {
                day: dayName(day.day),
                visits: day.visits,
                unassigned: day.unassigned,
                uncovered: day.uncovered
              })
            });
          })}
        </div>
      </section>

      {empty ? <p className="hc-sub">{t("home_care.week.empty")}</p> : null}

      {data.unassigned.visits ? (
        <section className="hc-section">
          <h3 className="hc-section-title">{t("home_care.day.unassigned_title")}</h3>
          <p className="hc-sub">{t("home_care.week.worker_total", { visits: data.unassigned.visits, amount: minutesLabel(t, data.unassigned.minutes) })}</p>
          <div className="hc-week" role="group" aria-label={t("home_care.day.unassigned_title")}>
            {data.unassigned.days.map((day) =>
              cell(`u-${day.day}`, day.day, {
                count: day.visits,
                tone: day.visits ? "danger" : "off",
                label: t("home_care.week.cell", { day: dayName(day.day), visits: day.visits, amount: minutesLabel(t, day.minutes) })
              })
            )}
          </div>
        </section>
      ) : null}

      {data.workers.map((worker) => (
        <section className="hc-section" key={worker.membershipId}>
          <h3 className="hc-section-title">
            {worker.name || "—"}
            {worker.active ? null : (
              <>
                {" "}
                <span className="hc-badge hc-badge--warn">{t("home_care.slots.worker_inactive")}</span>
              </>
            )}
          </h3>
          <p className="hc-sub">
            {t("home_care.week.worker_total", { visits: worker.visits, amount: minutesLabel(t, worker.minutes) })}
            {worker.heavy ? ` · ${t("home_care.work_nature.heavy_visits", { count: worker.heavy })}` : ""}
            {worker.uncovered ? ` · ${t("home_care.week.worker_uncovered", { count: worker.uncovered })}` : ""}
          </p>
          <div className="hc-week" role="group" aria-label={worker.name || "—"}>
            {worker.days.map((day) =>
              cell(`${worker.membershipId}-${day.day}`, day.day, {
                count: day.absent ? (day.uncovered ? day.uncovered : "–") : day.visits,
                note: day.absent ? t("home_care.week.absent_short") : "",
                tone: day.absent ? (day.uncovered ? "danger" : "warn") : day.visits ? "" : "off",
                label: day.absent
                  ? t("home_care.week.cell_absent", { day: dayName(day.day), uncovered: day.uncovered })
                  : t("home_care.week.cell", { day: dayName(day.day), visits: day.visits, amount: minutesLabel(t, day.minutes) })
              })
            )}
          </div>
        </section>
      ))}

      {empty ? null : <p className="hc-hint">{t("home_care.week.legend")}</p>}
    </section>
  );
}
