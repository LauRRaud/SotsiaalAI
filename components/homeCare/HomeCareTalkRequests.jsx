"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { clientHref, formatDateTime, homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Lahtised soovid „soovin sellest rääkida" (K6-k) tähtaegade lehel: kes soovib rääkida, mis
 * juhtumi järel ja mis ajast. Hooldusjuht märgib siin, et rääkimine on toimunud. Ilma lahtiste
 * soovideta jaotist ei ole.
 */
export default function HomeCareTalkRequests({ organizationId, initial = [], canEdit = false, timeZone }) {
  const { t } = useI18n();
  const { call, busy, error } = useHomeCareApi();
  const fieldId = useId();
  const [items, setItems] = useState(initial || []);

  const handled = async (item) => {
    const result = await call(`${homeCareBase(organizationId)}/raagime/${encodeURIComponent(item.id)}`, { method: "PATCH", fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) setItems((current) => current.filter((row) => row.id !== item.id));
  };

  if (!items.length) return null;

  return (
    <section className="hc-section" aria-labelledby={`${fieldId}-title`}>
      <h3 className="hc-section-title" id={`${fieldId}-title`}>
        {t("home_care.talk.list_title")} · {items.length}
      </h3>
      <p className="hc-hint">{t("home_care.talk.list_hint")}</p>
      <ul className="hc-list hc-list--plain">
        {items.map((item) => (
          <li key={item.id}>
            <span>
              {t("home_care.talk.list_line", {
                name: item.requesterName || "—",
                type: item.incidentType ? t(`home_care.incident.types.${item.incidentType}`) : "—",
                date: formatDateTime(item.requestedAt, timeZone)
              })}
            </span>{" "}
            <Link href={clientHref(organizationId, item.client.id)} prefetch={false}>
              {item.client.displayName}
            </Link>
            {canEdit ? (
              <span className="hc-row">
                <button className="hc-btn hc-btn--quiet" type="button" onClick={() => handled(item)} disabled={busy}>
                  {t("home_care.talk.handled")}
                </button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
