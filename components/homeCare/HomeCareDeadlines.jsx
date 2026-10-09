"use client";

import Link from "next/link";
import { useId } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgHeader from "@/components/org/OrgHeader";

import { daysLabel } from "./HomeCareDecisionView";
import HomeCareOutbox from "./HomeCareOutbox";
import { preconditionLine } from "./HomeCarePreconditions";
import { planDayLabel } from "./HomeCarePlanView";
import { clientHref } from "./homeCareClient";

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
  const { t } = useI18n();
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
