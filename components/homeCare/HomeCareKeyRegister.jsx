"use client";

import Link from "next/link";
import { useId } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgHeader from "@/components/org/OrgHeader";

import { keyHolderText, keyName } from "./HomeCareKeys";
import { clientHref } from "./homeCareClient";

/**
 * Võtmeraamat hooldusjuhile (K4-b): kõik asutuse käes olevad võtmed kliendi kaupa ja
 * eraldi lõppenud teenusega klientide tagastamata võtmed. Võtme annab üle või lõpetab
 * kliendi lehel; siin on ülevaade.
 *
 * Lingid kliendi lehele on `prefetch={false}`: lehe avamine jätab avamislogisse rea.
 */
export default function HomeCareKeyRegister({ context, register }) {
  const { t } = useI18n();
  const fieldId = useId();
  const organizationId = context.organization.id;

  const row = (key) => (
    <li key={key.id}>
      <Link className="hc-client" href={clientHref(organizationId, key.client.id)} prefetch={false}>
        <span className="hc-client__name">
          {key.client.displayName}
          {key.holderInactive ? (
            <>
              {" "}
              <span className="hc-badge hc-badge--danger">{t("home_care.keys.holder_inactive")}</span>
            </>
          ) : null}
        </span>
        <span className="hc-client__meta">{[keyName(t, key), keyHolderText(t, key)].join(" · ")}</span>
      </Link>
    </li>
  );

  const section = (key, items) => (
    <section className="hc-section" aria-labelledby={`${fieldId}-${key}`}>
      <h3 className="hc-section-title" id={`${fieldId}-${key}`}>
        {t(`home_care.keys.${key}_title`)}
        {items.length ? ` · ${items.length}` : ""}
      </h3>
      {items.length === 0 ? <p className="hc-sub">{t(`home_care.keys.${key}_empty`)}</p> : <ul className="hc-list">{items.map(row)}</ul>}
    </section>
  );

  return (
    <section className="ow-shell hc-shell">
      <OrgHeader context={context} />

      <div className="hc-head">
        <Link className="hc-back" href={`/org/${organizationId}/koduteenus`}>
          {t("home_care.client.back")}
        </Link>
        <h2 className="hc-title">{t("home_care.keys.register_title")}</h2>
        <p className="hc-sub">{t("home_care.keys.register_intro")}</p>
        {register.truncated ? <p className="hc-notice">{t("home_care.keys.truncated", { count: register.total })}</p> : null}
      </div>

      {section("unreturned", register.unreturned)}
      {section("register", register.keys)}
    </section>
  );
}
