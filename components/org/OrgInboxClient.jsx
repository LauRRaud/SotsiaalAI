"use client";

import Link from "next/link";

import { useI18n } from "@/components/i18n/I18nProvider";

import OrgHeader from "./OrgHeader";

/**
 * Vastuvõtulaua LOEND.
 *
 * Loend ei kanna lähteobjekti sisu — ainult seisu ja vastutajat. Sisu avaneb
 * ühe kirje avamisel, mis on eraldi teadlik samm ja mis märgib pöördujale
 * nähtava `openedAt` ajatempli.
 *
 * Tühi loend ei tähenda „viga" ega „pole õigust": õiguseta liige näeb sama
 * tühja lauda kui organisatsioon, kuhu pole veel keegi pöördunud. Just see
 * teeb loendist mittepaljastava pinna.
 */
export default function OrgInboxClient({ context, items }) {
  const { t } = useI18n();
  const organizationId = context.organization.id;

  return (
    <section className="ow-shell">
      <OrgHeader context={context} />

      <div className="ow-card">
        <h2 className="ow-title" style={{ fontSize: "1.125rem" }}>
          {t("org.inbox.heading")}
        </h2>
        <p className="ow-subtitle">{t("org.inbox.intro")}</p>
        <p className="ow-notice ow-notice--privacy">{t("org.inbox.privacyNotice")}</p>
      </div>

      {items.length === 0 ? (
        <p className="ow-empty">{t("org.inbox.empty")}</p>
      ) : (
        <div className="ow-tablewrap">
          <table className="ow-table">
            <caption>{t("org.inbox.heading")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("org.inbox.receivedAt")}</th>
                <th scope="col">{t("org.inbox.status")}</th>
                <th scope="col">{t("org.inbox.unit")}</th>
                <th scope="col">{t("org.inbox.assignee")}</th>
                <th scope="col">{t("org.members.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td data-label={t("org.inbox.receivedAt")}>
                    {new Date(item.receivedAt).toISOString().replace("T", " ").slice(0, 16)}
                    {item.urgencyDeclaredBySender ? (
                      <>
                        <br />
                        <span className="ow-chip">{item.urgencyDeclaredBySender}</span>
                      </>
                    ) : null}
                  </td>
                  <td data-label={t("org.inbox.status")}>{t(`org.inboxStatus.${item.status}`)}</td>
                  <td data-label={t("org.inbox.unit")}>{item.unit?.name || "—"}</td>
                  <td data-label={t("org.inbox.assignee")}>
                    {item.assignment
                      ? `${[item.assignment.firstName, item.assignment.lastName]
                          .filter(Boolean)
                          .join(" ") || "—"} · ${t(`org.workStatus.${item.assignment.status}`)}`
                      : t("org.inbox.unassigned")}
                  </td>
                  <td data-label={t("org.members.actions")}>
                    <Link className="ow-nav__link" href={`/org/${organizationId}/vastuvott/${item.id}`}>
                      {t("org.inbox.open")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
