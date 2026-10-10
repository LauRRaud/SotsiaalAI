"use client";

import Link from "next/link";
import { useId } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgHeader from "@/components/org/OrgHeader";

import { daysLabel, minutesLabel } from "./HomeCareDecisionView";
import { euroText } from "./HomeCareMoney";
import HomeCareOutbox from "./HomeCareOutbox";
import { preconditionLine } from "./HomeCarePreconditions";
import { changeSignalLine, changeWaitingText } from "./HomeCareChangeSignals";
import { planDayLabel } from "./HomeCarePlanView";
import { workerRecordLine } from "./HomeCareWorkers";
import { clientHref, formatDateTime } from "./homeCareClient";

/**
 * Tähtajad hooldusjuhile: neli nimekirja, mida muidu peab ise meeles pidama.
 *   1. Otsus lõpeb 60 päeva jooksul.
 *   2. Kehtivat otsust ei ole.
 *   3. Hoolduskava ootab ülevaatamist.
 *   4. Kehtivat hoolduskava ei ole.
 *
 * Lingid kliendi lehele on `prefetch={false}`: lehe avamine jätab avamislogisse rea.
 */
export default function HomeCareDeadlines({ context, deadlines }) {
  const { t, locale } = useI18n();
  const fieldId = useId();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";

  const clientLine = (item, meta, badge, key = item.client.id) => (
    <li key={key}>
      <Link className="hc-client" href={clientHref(organizationId, item.client.id)} prefetch={false}>
        <span className="hc-client__name">
          {item.client.displayName}
          {item.client.status === "AWAY" ? (
            <>
              {" "}
              <span className="hc-badge hc-badge--warn">{t("home_care.status.AWAY")}</span>
            </>
          ) : null}
          {badge ? (
            <>
              {" "}
              {badge}
            </>
          ) : null}
        </span>
        {meta ? <span className="hc-client__meta">{meta}</span> : null}
      </Link>
    </li>
  );

  const section = (key, items, render) => (
    <section className="hc-section" aria-labelledby={`${fieldId}-${key}`}>
      <h3 className="hc-section-title" id={`${fieldId}-${key}`}>
        {t(`home_care.deadlines.${key}_title`)}
        {items.length ? ` · ${items.length}` : ""}
      </h3>
      {items.length === 0 ? <p className="hc-sub">{t(`home_care.deadlines.${key}_empty`)}</p> : <ul className="hc-list">{items.map(render)}</ul>}
    </section>
  );

  return (
    <section className="ow-shell hc-shell">
      <OrgHeader context={context} />
      <HomeCareOutbox ownerId={context.membership?.id || ""} timeZone={timeZone} />

      <div className="hc-head">
        <Link className="hc-back" href={`/org/${organizationId}/koduteenus`}>
          {t("home_care.client.back")}
        </Link>
        <h2 className="hc-title">{t("home_care.deadlines.title")}</h2>
        <p className="hc-sub">{t("home_care.deadlines.intro", { count: deadlines.clientCount })}</p>
        {deadlines.truncated ? <p className="hc-notice">{t("home_care.deadlines.truncated", { count: deadlines.clientCount })}</p> : null}
      </div>

      {section("changes_open", deadlines.changesOpen || [], (item) => clientLine(item, `${changeSignalLine(t, item)} · ${changeWaitingText(t, item)}`, null, item.id))}

      {section("decisions_ending", deadlines.decisionsEnding, (item) =>
        clientLine(
          item,
          t("home_care.deadlines.ends_on", { date: planDayLabel(item.validUntil), when: daysLabel(t, item.daysLeft) }),
          item.soon ? <span className="hc-badge hc-badge--danger">{t("home_care.deadlines.soon_badge")}</span> : null
        )
      )}

      {section("no_decision", deadlines.noDecision, (item) =>
        clientLine(
          item,
          [
            item.lastEndedOn ? t("home_care.deadlines.last_ended", { date: planDayLabel(item.lastEndedOn) }) : t("home_care.deadlines.never"),
            item.nextFrom ? t("home_care.deadlines.next_from", { date: planDayLabel(item.nextFrom) }) : null
          ]
            .filter(Boolean)
            .join(" · ")
        )
      )}

      {section("plans_due", deadlines.plansDue, (item) =>
        clientLine(
          item,
          t("home_care.deadlines.review_on", { date: planDayLabel(item.reviewOn), when: daysLabel(t, item.daysLeft) }),
          item.overdue ? <span className="hc-badge hc-badge--danger">{t("home_care.deadlines.overdue_badge")}</span> : null
        )
      )}

      {section("no_plan", deadlines.noPlan, (item) => clientLine(item, null))}

      {section("preconditions_open", deadlines.preconditionsOpen || [], (item) =>
        clientLine(
          item,
          preconditionLine(t, item),
          item.overdue ? <span className="hc-badge hc-badge--danger">{t("home_care.deadlines.overdue_badge")}</span> : null,
          item.id
        )
      )}

      {section("money_open", deadlines.moneyOpen || [], (item) =>
        clientLine(
          item,
          t("home_care.money.open_line", { name: item.holderName || "—", amount: euroText(item.balanceCents, locale), date: planDayLabel(item.lastOn) }),
          null,
          item.key
        )
      )}

      {section("safety_due", deadlines.safetyDue || [], (item) =>
        clientLine(item, item.state === "OLD" ? t("home_care.deadlines.safety_old", { date: planDayLabel(item.assessedOn) }) : t("home_care.deadlines.safety_none"))
      )}

      {section("relatives_due", deadlines.relativesDue || [], (item) =>
        clientLine(
          item,
          item.doubt
            ? t("home_care.deadlines.relatives_doubt_line", { name: item.relation ? `${item.name} (${item.relation})` : item.name, by: item.doubtByName || "—" })
            : t("home_care.deadlines.relatives_line", { name: item.relation ? `${item.name} (${item.relation})` : item.name, date: planDayLabel(item.agreedOn) }),
          null,
          item.key
        )
      )}

      {section("risk_lines_due", deadlines.riskLinesDue || [], (item) =>
        clientLine(item, t("home_care.deadlines.risk_lines_line", { count: item.lines, date: planDayLabel(item.oldestOn) }))
      )}

      {/* Esmakäigud lähipäevil, mille kohta kliendile ei ole teatatud (K6-c); rida viib selle päeva plaani, kus teatamine märgitakse. */}
      {(deadlines.firstVisitsAhead || []).length
        ? section("first_visits", deadlines.firstVisitsAhead, (item) => (
            <li key={item.key}>
              <Link className="hc-client" href={`/org/${organizationId}/koduteenus/paev?paev=${item.day}`}>
                <span className="hc-client__name">{item.client.displayName}</span>
                <span className="hc-client__meta">
                  {t(item.notReached ? "home_care.deadlines.first_visits_not_reached" : "home_care.deadlines.first_visits_line", {
                    date: planDayLabel(item.day),
                    time: item.startTime,
                    name: item.workerName || "—"
                  })}
                </span>
              </Link>
            </li>
          ))
        : null}

      {/* Transpordi soovid, mis ootavad korraldamist (K5-w). */}
      {(deadlines.transportOpen || []).length
        ? section("transport_open", deadlines.transportOpen, (item) =>
            clientLine(
              item,
              t("home_care.deadlines.transport_open_line", {
                date: item.wantedTime ? t("home_care.transport.when_time", { date: planDayLabel(item.wantedOn), time: item.wantedTime }) : planDayLabel(item.wantedOn),
                destination: item.destination,
                name: item.requestedByName || "—"
              }),
              null,
              item.key
            )
          )
        : null}

      {/* Teated otsustajale (K5-r): vastuseta teated ja lubatud uus hindamine, mille päev on möödas. */}
      {(deadlines.noticesWaiting || []).length
        ? section("notices_waiting", deadlines.noticesWaiting, (item) =>
            clientLine(
              item,
              t("home_care.deadlines.notices_waiting_line", { reason: t(`home_care.notice.reasons.${item.reason}`), date: planDayLabel(item.sentOn), days: item.days }),
              null,
              item.key
            )
          )
        : null}
      {(deadlines.reassessOverdue || []).length
        ? section("reassess_overdue", deadlines.reassessOverdue, (item) =>
            clientLine(item, t("home_care.deadlines.reassess_overdue_line", { date: planDayLabel(item.reassessBy), days: item.days }), null, item.key)
          )
        : null}

      {/* Koju tulnud kliendid, kelle juures ei ole pärast naasmist käidud (K6-f). */}
      {(deadlines.homecomingsOpen || []).length
        ? section("homecomings", deadlines.homecomingsOpen, (item) =>
            clientLine(
              item,
              [
                item.reason ? t(`home_care.status_reason.AWAY.${item.reason}`) : null,
                t("home_care.deadlines.homecomings_line", { date: planDayLabel(item.returnedOn), from: planDayLabel(item.awayFrom) })
              ]
                .filter(Boolean)
                .join(" · ")
            )
          )
        : null}

      {/* Abi rohkem kui kavas (K6-d): käigul märgitud viis on olnud kava reast suurem. */}
      {(deadlines.helpDriftDue || []).length
        ? section("help_drift", deadlines.helpDriftDue, (item) => clientLine(item, t("home_care.deadlines.help_drift_line", { more: item.more, total: item.total })))
        : null}

      {/* Osutatud aeg kolm lukustatud kuud järjest üle otsustatu (K5-q): põhjus otsustajale teada anda. */}
      {(deadlines.overVolumeStreak || []).length
        ? section("over_volume", deadlines.overVolumeStreak, (item) =>
            clientLine(
              item,
              t("home_care.deadlines.over_volume_line", {
                list: item.months
                  .map((month) => `${month.month.split("-").reverse().join(".")} +${minutesLabel(t, month.minutes - month.expectedMinutes)}`)
                  .join(" · ")
              })
            )
          )
        : null}

      {/* Lukustatud kuud, kuhu on hiljem lisatud või muudetud (K5-p); rida viib selle kuu kokkuvõttesse. */}
      {(deadlines.monthLocksChanged || []).length
        ? section("month_changed", deadlines.monthLocksChanged, (item) => (
            <li key={item.month}>
              <Link className="hc-client" href={`/org/${organizationId}/koduteenus/kuu?kuu=${item.month}`}>
                <span className="hc-client__name">{item.month.split("-").reverse().join(".")}</span>
                <span className="hc-client__meta">{t("home_care.deadlines.month_changed_line", { count: item.changes })}</span>
              </Link>
            </li>
          ))
        : null}

      {/* Töötajate kaardid (K5-e): ainult kogu asutuse hooldusjuhile; rida viib töötajate lehele. */}
      {(deadlines.workerRecordsDue || []).length
        ? section("workers_due", deadlines.workerRecordsDue, (item) => (
            <li key={item.key}>
              <Link className="hc-client" href={`/org/${organizationId}/koduteenus/tootajad`}>
                <span className="hc-client__name">
                  {item.worker.name}
                  {item.expired ? (
                    <>
                      {" "}
                      <span className="hc-badge hc-badge--danger">{t("home_care.workers.expired")}</span>
                    </>
                  ) : null}
                </span>
                <span className="hc-client__meta">{workerRecordLine(t, item)}</span>
              </Link>
            </li>
          ))
        : null}

      {section("away_long", deadlines.awayLong || [], (item) =>
        clientLine(
          item,
          [
            item.reason ? t(`home_care.status_reason.AWAY.${item.reason}`) : null,
            t("home_care.deadlines.away_since", { date: planDayLabel(item.since), days: item.days })
          ]
            .filter(Boolean)
            .join(" · ")
        )
      )}

      {section("supplies_open", deadlines.suppliesOpen || [], (item) =>
        clientLine(
          item,
          t("home_care.supplies.open_line", {
            kind: t(`home_care.supplies.kinds.${item.kind}`),
            state: t(`home_care.supplies.states.${item.state}`),
            name: item.responsible,
            when: formatDateTime(item.checkedAt, timeZone)
          }),
          item.state === "OUT" ? <span className="hc-badge hc-badge--danger">{t("home_care.supplies.states.OUT")}</span> : null,
          item.id
        )
      )}

      {/* Tagasiside (K4-d): kellelt on aeg küsida. Kirja pannakse see kliendi päevikusse. */}
      <p className="hc-hint">{t("home_care.deadlines.feedback_hint")}</p>
      {section("feedback_overdue", deadlines.feedbackOverdue || [], (item) =>
        clientLine(
          item,
          item.lastOn ? t("home_care.deadlines.feedback_last", { date: planDayLabel(item.lastOn) }) : t("home_care.deadlines.feedback_never")
        )
      )}
      {section("feedback_at_end", deadlines.feedbackAtEnd || [], (item) =>
        clientLine(item, t("home_care.deadlines.feedback_ended_on", { date: planDayLabel(item.endedOn) }))
      )}

      {section("work_nature_due", deadlines.workNatureDue || [], (item) =>
        clientLine(
          item,
          t("home_care.deadlines.review_on", { date: planDayLabel(item.reviewOn), when: daysLabel(t, item.daysLeft) }),
          item.overdue ? <span className="hc-badge hc-badge--danger">{t("home_care.deadlines.overdue_badge")}</span> : null
        )
      )}
    </section>
  );
}
