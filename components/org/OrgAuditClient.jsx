"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

import OrgHeader from "./OrgHeader";

/**
 * Organisatsiooni auditivaade. Näitab HALDUSTOIMINGUID — mitte inimeste
 * tegevust. Ridadel ei ole IP-d, seadet ega ühtegi sisuvälja.
 */
export default function OrgAuditClient({ context, events }) {
  const { t } = useI18n();

  return (
    <section className="ow-shell">
      <OrgHeader context={context} />

      <div className="ow-card">
        <h2 className="ow-title" style={{ fontSize: "1.125rem" }}>
          {t("org.audit.heading")}
        </h2>
        <p className="ow-notice ow-notice--privacy">{t("org.audit.intro")}</p>
      </div>

      {events.length === 0 ? (
        <p className="ow-empty">{t("org.audit.empty")}</p>
      ) : (
        <div className="ow-tablewrap">
          <table className="ow-table">
            <caption>{t("org.audit.heading")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("org.audit.time")}</th>
                <th scope="col">{t("org.audit.action")}</th>
                <th scope="col">{t("org.audit.resource")}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td data-label={t("org.audit.time")}>
                    {new Date(event.createdAt).toISOString().replace("T", " ").slice(0, 16)}
                  </td>
                  <td data-label={t("org.audit.action")}>{event.action}</td>
                  <td data-label={t("org.audit.resource")}>{event.resourceType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
