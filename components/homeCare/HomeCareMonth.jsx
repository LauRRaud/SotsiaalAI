"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgHeader from "@/components/org/OrgHeader";
import { composeMonthSheet, monthSheetState } from "@/lib/homeCare/monthSheet";

import { decisionVolumeLabel, minutesLabel } from "./HomeCareDecisionView";
import HomeCareMonthLock from "./HomeCareMonthLock";
import HomeCareOutbox from "./HomeCareOutbox";
import { planDayLabel } from "./HomeCarePlanView";
import { clientHref, formatDateTime, homeCareBase, useHomeCareApi } from "./homeCareClient";

/** `AAAA-KK` → `KK.AAAA`. Käsitsi, et server ja brauser annaksid sama kuju. */
function monthLabel(month) {
  const [year, number] = String(month || "").split("-");
  return year && number ? `${number}.${year}` : "";
}

/**
 * Kuu kokkuvõte hooldusjuhile: kolm loendit ühest ja samast kirjete hulgast.
 *   1. Kliendi kaupa: käigud ja osutatud aeg otsustatud aja kõrval.
 *   2. Töötaja kaupa: käigud ja aeg, eraldi need käigud, kus ta oli kaasas.
 *   3. Ära jäänud käigud (erijuhtumid „ei avanud ust" ja „keeldus abist").
 *
 * Lukustatud kuu (K5-p) arvud tulevad hetktõmmisest; kliendil, keda enam nimekirjas ei ole,
 * on nime asemel selgitus ja linki ei ole.
 *
 * Lingid kliendi lehele on `prefetch={false}`: lehe avamine jätab avamislogisse rea.
 */
export default function HomeCareMonth({ context, initial }) {
  const { t } = useI18n();
  const { call, busy, error } = useHomeCareApi();
  const fieldId = useId();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const [data, setData] = useState(initial);

  const load = async (month) => {
    if (!month) return;
    const result = await call(`${homeCareBase(organizationId)}/kuu?kuu=${encodeURIComponent(month)}`, {
      fallbackKey: "home_care.errors.list_failed"
    });
    if (result.ok) setData(result.data);
  };

  const locked = data.lock?.state === "LOCKED";
  const sheetState = monthSheetState(data);

  /* Kuu tabel failina (K5-q): sellest, mida leht näitab; faili teisel real on kirjas, kas arvud on lukus. */
  const download = () => {
    const text = composeMonthSheet(t, data, { dateTime: (value) => formatDateTime(value, timeZone), day: planDayLabel });
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `koduteenus-kuu-${data.month}${sheetState === "LOCKED" ? "-lukus" : ""}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  /* Rida kliendi kohta, kes võib hetktõmmises olla, aga nimekirjast kadunud. */
  const clientRow = (client, key, name, meta) =>
    client.displayName === null ? (
      <li key={key}>
        <span className="hc-client">
          <span className="hc-client__name">{t("home_care.month_lock.client_gone")}</span>
          <span className="hc-client__meta">{meta}</span>
        </span>
      </li>
    ) : (
      <li key={key}>
        <Link className="hc-client" href={clientHref(organizationId, client.id)} prefetch={false}>
          <span className="hc-client__name">{name}</span>
          <span className="hc-client__meta">{meta}</span>
        </Link>
      </li>
    );

  const clientMeta = (row) =>
    [
      t("home_care.month.client_line", { visits: row.visits, amount: minutesLabel(t, row.minutes) }),
      row.expectedMinutes === null
        ? t("home_care.month.expected_none")
        : t("home_care.month.expected", { amount: minutesLabel(t, row.expectedMinutes) }),
      decisionVolumeLabel(t, row) ? t("home_care.month.decision_volume", { volume: decisionVolumeLabel(t, row) }) : null,
      row.withoutLength ? t("home_care.provided.without_length", { count: row.withoutLength }) : null,
      row.missed ? t("home_care.month.missed_count", { count: row.missed }) : null,
      row.cancelled ? t("home_care.month.cancelled_count", { count: row.cancelled }) : null,
      row.awayDays ? t("home_care.month.away_days", { count: row.awayDays }) : null,
      row.notDone && row.notDone.REFUSED + row.notDone.NOT_NEEDED + row.notDone.COULD_NOT > 0
        ? t("home_care.month.not_done", { refused: row.notDone.REFUSED, notNeeded: row.notDone.NOT_NEEDED, couldNot: row.notDone.COULD_NOT })
        : null,
      /* Ravimitoimingud (K5-i): arvud ümardamata; märkimata ja tegemata on eraldi näha. */
      row.medication
        ? t("home_care.month.medication", {
            reminded: row.medication.reminded,
            sawTaken: row.medication.sawTaken,
            gave: row.medication.gave,
            unmarked: row.medication.unmarked,
            notDone: row.medication.notDone
          })
        : null
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <section className="ow-shell hc-shell">
      <OrgHeader context={context} />
      <HomeCareOutbox ownerId={context.membership?.id || ""} timeZone={timeZone} />

      <div className="hc-head">
        <Link className="hc-back" href={`/org/${organizationId}/koduteenus`}>
          {t("home_care.client.back")}
        </Link>
        <h2 className="hc-title">{t("home_care.month.title")}</h2>
        <p className="hc-sub">{t("home_care.month.intro")}</p>
      </div>

      <section className="hc-section" aria-live="polite">
        <div className="hc-row hc-row--between">
          <button className="hc-btn hc-btn--quiet" type="button" onClick={() => load(data.previousMonth)} disabled={busy}>
            {t("home_care.month.previous")}
          </button>
          <h3 className="hc-section-title">
            {monthLabel(data.month)}
            {locked ? (
              <>
                {" "}
                <span className="hc-badge">{t("home_care.month_lock.badge")}</span>
              </>
            ) : null}
          </h3>
          <button className="hc-btn hc-btn--quiet" type="button" onClick={() => load(data.nextMonth)} disabled={busy || !data.nextMonth}>
            {t("home_care.month.next")}
          </button>
        </div>
        {error ? (
          <p className="hc-error" role="alert">
            {error}
          </p>
        ) : null}
        <p className="hc-sub">
          {t("home_care.month.totals", {
            visits: data.totals.visits,
            amount: minutesLabel(t, data.totals.minutes),
            without: data.totals.withoutLength,
            missed: data.totals.missed
          })}
        </p>
        {locked ? (
          <p className="hc-notice">{data.lock.snapshotShown ? t("home_care.month_lock.locked_banner") : t("home_care.month_lock.locked_banner_unit")}</p>
        ) : null}
        {data.untilDay && data.untilDay === data.today ? (
          <p className="hc-hint">{t("home_care.month.until_today", { date: planDayLabel(data.untilDay) })}</p>
        ) : null}
        {data.truncated ? <p className="hc-notice">{t("home_care.deadlines.truncated", { count: data.clients.length })}</p> : null}
        {data.untilDay ? (
          <>
            <div className="hc-row">
              <button className="hc-btn hc-btn--quiet" type="button" onClick={download}>
                {t("home_care.month_sheet.download")}
              </button>
            </div>
            <p className="hc-hint">{t(sheetState === "LOCKED" ? "home_care.month_sheet.hint_locked" : "home_care.month_sheet.hint_running")}</p>
          </>
        ) : null}
      </section>

      {/* Kuu lahtised asjad (K5-j): mida enne kuu numbrite saatmist üle vaadata. Lukustamine on lehe lõpus. */}
      {data.openItems ? (
        <section className="hc-section" aria-labelledby="hc-month-open">
          <h3 className="hc-section-title" id="hc-month-open">
            {t("home_care.month_open.title")}
          </h3>
          {data.openItems.clear ? (
            <p className="hc-sub">{t("home_care.month_open.clear")}</p>
          ) : (
            <ul className="hc-list hc-list--plain">
              {data.openItems.missingCount ? <li>{t("home_care.month_open.missing", { count: data.openItems.missingCount })}</li> : null}
              {data.openItems.openIncidents ? (
                <li>
                  <Link href={`/org/${organizationId}/koduteenus/erijuhtumid`}>{t("home_care.month_open.incidents", { count: data.openItems.openIncidents })}</Link>
                </li>
              ) : null}
              {data.openItems.openSignals ? (
                <li>
                  <Link href={`/org/${organizationId}/koduteenus/tahtajad`}>{t("home_care.month_open.signals", { count: data.openItems.openSignals })}</Link>
                </li>
              ) : null}
              {data.openItems.medicationUnmarked ? <li>{t("home_care.month_open.medication", { count: data.openItems.medicationUnmarked })}</li> : null}
            </ul>
          )}
          {data.openItems.missing.length ? (
            <ul className="hc-list">
              {data.openItems.missing.map((item) => (
                <li key={`${item.day}-${item.startTime}-${item.client.id}`}>
                  <Link className="hc-client" href={clientHref(organizationId, item.client.id)} prefetch={false}>
                    <span className="hc-client__name">{item.client.displayName}</span>
                    <span className="hc-client__meta">{t("home_care.month_open.missing_line", { date: planDayLabel(item.day), time: item.startTime })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {data.openItems.missingCount > data.openItems.missing.length ? (
            <p className="hc-hint">{t("home_care.month_open.missing_more", { shown: data.openItems.missing.length, count: data.openItems.missingCount })}</p>
          ) : null}
        </section>
      ) : null}

      <section className="hc-section" aria-labelledby={`${fieldId}-clients`}>
        <h3 className="hc-section-title" id={`${fieldId}-clients`}>
          {t("home_care.month.clients_title")}
        </h3>
        {data.clients.length === 0 ? (
          <p className="hc-sub">{t("home_care.month.clients_empty")}</p>
        ) : (
          <ul className="hc-list">
            {data.clients.map((row) =>
              clientRow(
                row.client,
                row.client.id,
                <>
                  {row.client.displayName}
                  {row.client.status && row.client.status !== "ACTIVE" ? (
                    <>
                      {" "}
                      <span className="hc-badge hc-badge--warn">{t(`home_care.status.${row.client.status}`)}</span>
                    </>
                  ) : null}
                  {data.complete && row.expectedMinutes !== null && row.minutes > row.expectedMinutes ? (
                    <>
                      {" "}
                      <span className="hc-badge">{t("home_care.month.over_badge")}</span>
                    </>
                  ) : null}
                </>,
                clientMeta(row)
              )
            )}
          </ul>
        )}
      </section>

      <section className="hc-section" aria-labelledby={`${fieldId}-workers`}>
        <h3 className="hc-section-title" id={`${fieldId}-workers`}>
          {t("home_care.month.workers_title")}
        </h3>
        {data.workers.length === 0 ? (
          <p className="hc-sub">{t("home_care.month.workers_empty")}</p>
        ) : (
          <ul className="hc-list hc-list--plain">
            {data.workers.map((row) => (
              <li key={row.membershipId || row.name}>
                <span>{row.name || "—"}</span>
                <span className="hc-entry__meta">
                  {" "}
                  {[
                    row.visits ? t("home_care.month.worker_line", { visits: row.visits, amount: minutesLabel(t, row.minutes) }) : null,
                    row.heavy ? t("home_care.work_nature.heavy_visits", { count: row.heavy }) : null,
                    row.companionVisits
                      ? t("home_care.month.worker_companion", { visits: row.companionVisits, amount: minutesLabel(t, row.companionMinutes) })
                      : null
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="hc-section" aria-labelledby={`${fieldId}-missed`}>
        <h3 className="hc-section-title" id={`${fieldId}-missed`}>
          {t("home_care.month.missed_title")}
          {data.missed.length ? ` · ${data.missed.length}` : ""}
        </h3>
        {data.missed.length === 0 ? (
          <p className="hc-sub">{t("home_care.month.missed_empty")}</p>
        ) : (
          <ul className="hc-list">
            {data.missed.map((row) =>
              clientRow(row.client, row.entryId, row.client.displayName, `${formatDateTime(row.occurredAt, timeZone)} · ${t(`home_care.incident.types.${row.type}`)}`)
            )}
          </ul>
        )}
        <p className="hc-hint">{t("home_care.month.how")}</p>
      </section>

      {/* Kuu lukustamine (K5-p): kuu sulgemise kolmas samm. Võti nullib vormi, kui kuu või luku seis vahetub. */}
      {data.lock ? (
        <HomeCareMonthLock
          key={`${data.month}:${data.lock.state}`}
          organizationId={organizationId}
          timeZone={timeZone}
          data={data}
          onChange={setData}
          onReload={() => load(data.month)}
        />
      ) : null}
    </section>
  );
}
