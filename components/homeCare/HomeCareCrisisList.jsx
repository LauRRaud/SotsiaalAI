"use client";

import Link from "next/link";
import { useId } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgHeader from "@/components/org/OrgHeader";
import { composeCrisisSheet } from "@/lib/homeCare/crisisSheet";

import { minutesLabel } from "./HomeCareDecisionView";
import { planDayLabel } from "./HomeCarePlanView";
import { clientHref } from "./homeCareClient";

/**
 * Kriisinimekiri hooldusjuhile (K5-b): kelle juurde peab kriisis jõudma iga päev, kelle
 * juurde kord või kaks nädalas ja kes saab varudega ise hakkama. Iga rühma juures on
 * klientide arv ja nädala plaanitud käiguaeg. Nimekirja saab tabelifailina alla laadida
 * ja välja printida, sest kriisis ei pruugi rakendus töötada.
 *
 * Lingid kliendi lehele on `prefetch={false}`: lehe avamine jätab avamislogisse rea.
 */
export default function HomeCareCrisisList({ context, list }) {
  const { t } = useI18n();
  const fieldId = useId();
  const organizationId = context.organization.id;

  const download = () => {
    const blob = new Blob([composeCrisisSheet(t, list)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kriisinimekiri-${list.today}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const row = (item) => (
    <li key={item.client.id}>
      <Link className="hc-client" href={clientHref(organizationId, item.client.id)} prefetch={false}>
        <span className="hc-client__name">{item.client.displayName}</span>
        <span className="hc-client__meta">
          {[
            item.address,
            item.phone,
            item.crisis?.dependencies?.length
              ? t("home_care.crisis.depends_on", { list: item.crisis.dependencies.map((code) => t(`home_care.crisis.dependencies.${code}`)).join(", ") })
              : null,
            item.crisis?.helper ? t("home_care.crisis.helper_line", { name: item.crisis.helper }) : null,
            item.crisis?.note,
            item.weeklyMinutes ? t("home_care.crisis.weekly", { time: minutesLabel(t, item.weeklyMinutes) }) : t("home_care.crisis.no_visits")
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </Link>
    </li>
  );

  return (
    <section className="ow-shell hc-shell">
      <OrgHeader context={context} />

      <div className="hc-head">
        <Link className="hc-back" href={`/org/${organizationId}/koduteenus`}>
          {t("home_care.client.back")}
        </Link>
        <h2 className="hc-title">{t("home_care.crisis.list_title")}</h2>
        <p className="hc-sub">{t("home_care.crisis.list_intro", { count: list.clientCount, date: planDayLabel(list.today) })}</p>
        {list.truncated ? <p className="hc-notice">{t("home_care.crisis.truncated", { count: list.clientCount })}</p> : null}
        <div className="hc-row">
          <button className="hc-btn hc-btn--primary" type="button" onClick={download} disabled={!list.clientCount}>
            {t("home_care.crisis.download")}
          </button>
        </div>
        <p className="hc-hint">{t("home_care.crisis.download_hint")}</p>
      </div>

      {list.groups.map((group) => (
        <section className="hc-section" aria-labelledby={`${fieldId}-${group.level}`} key={group.level}>
          <h3 className="hc-section-title" id={`${fieldId}-${group.level}`}>
            {t(`home_care.crisis.levels.${group.level}`)}
            {group.clients.length ? ` · ${group.clients.length}` : ""}
          </h3>
          {group.clients.length ? (
            <>
              <p className="hc-sub">{t("home_care.crisis.group_time", { time: minutesLabel(t, group.weeklyMinutes) })}</p>
              <ul className="hc-list">{group.clients.map(row)}</ul>
            </>
          ) : (
            <p className="hc-sub">{t("home_care.crisis.group_empty")}</p>
          )}
        </section>
      ))}

      <section className="hc-section" aria-labelledby={`${fieldId}-unset`}>
        <h3 className="hc-section-title" id={`${fieldId}-unset`}>
          {t("home_care.crisis.unset_title")}
          {list.unset.length ? ` · ${list.unset.length}` : ""}
        </h3>
        {list.unset.length ? <ul className="hc-list">{list.unset.map(row)}</ul> : <p className="hc-sub">{t("home_care.crisis.unset_empty")}</p>}
      </section>
    </section>
  );
}
