"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

import OrgHeader from "./OrgHeader";

/**
 * Organisatsiooni ülevaade.
 *
 * PRIVAATSUSTEADE ON SISU, mitte kaunistus: kasutaja peab nägema mustvalgel,
 * mida organisatsioon tema kohta EI näe (arenduskava §4, §7.4). Seda teadet ei
 * tohi eemaldada „ruumi säästmiseks".
 */
export default function OrgOverviewClient({ context }) {
  const { t } = useI18n();
  const units = context?.units || [];
  const capabilities = context?.capabilities || [];
  const activeModules = context?.activeModules || [];

  return (
    <section className="ow-shell">
      <OrgHeader context={context} />

      {/* Kirjutuskaitse tuleb KAHEST erinevast põhjusest ja neid ei tohi ühte
          teatesse valada: mustand ootab identiteedikontrolli (normaalne samm),
          peatamine on platvormi sekkumine (erakorraline). Sama tekst mõlemale
          ütleks uuele organisatsioonile, et temaga on midagi valesti. */}
      {context?.writable === false ? (
        <p className="ow-notice ow-notice--warning" role="status">
          {context.organization.status === "SUSPENDED"
            ? t("org.overview.readOnlyNotice")
            : t("org.overview.pendingNotice")}
        </p>
      ) : null}

      <p className="ow-notice ow-notice--privacy">{t("org.overview.privacyNotice")}</p>

      <div className="ow-card">
        <dl className="ow-meta">
          <div>
            <dt className="ow-meta__term">{t("org.overview.status")}</dt>
            <dd className="ow-meta__value">{t(`org.status.${context.organization.status}`)}</dd>
          </div>
          <div>
            <dt className="ow-meta__term">{t("org.overview.legalKind")}</dt>
            <dd className="ow-meta__value">{t(`org.legalKind.${context.organization.legalKind}`)}</dd>
          </div>
          <div>
            <dt className="ow-meta__term">{t("org.overview.seatRole")}</dt>
            <dd className="ow-meta__value">{t(`org.seatRole.${context.membership.seatRole}`)}</dd>
          </div>
          <div>
            <dt className="ow-meta__term">{t("org.payer.label")}</dt>
            <dd className="ow-meta__value">{t(`org.payer.${context.payerSource}`)}</dd>
          </div>
        </dl>
      </div>

      <div className="ow-grid">
        <section className="ow-card" aria-labelledby="ow-units-heading">
          <h2 id="ow-units-heading" className="ow-title" style={{ fontSize: "1rem" }}>
            {t("org.overview.yourUnits")}
          </h2>
          {units.length === 0 ? (
            <p className="ow-empty">{t("org.overview.noUnits")}</p>
          ) : (
            <ul className="ow-chips">
              {units.map((unit) => (
                <li key={unit.id} className="ow-chip">
                  {unit.name}
                  {unit.isPrimary ? " ★" : ""}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ow-card" aria-labelledby="ow-caps-heading">
          <h2 id="ow-caps-heading" className="ow-title" style={{ fontSize: "1rem" }}>
            {t("org.overview.yourCapabilities")}
          </h2>
          {capabilities.length === 0 ? (
            <p className="ow-empty">{t("org.overview.noCapabilities")}</p>
          ) : (
            <ul className="ow-chips">
              {capabilities.map((grant) => (
                <li
                  key={`${grant.capability}:${grant.scopeUnitId || "org"}`}
                  className={grant.scopeType === "UNIT" ? "ow-chip ow-chip--scope" : "ow-chip"}
                >
                  {t(`org.capability.${grant.capability}`)}
                  {" · "}
                  {t(`org.scope.${grant.scopeType}`)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ow-card" aria-labelledby="ow-modules-heading">
          <h2 id="ow-modules-heading" className="ow-title" style={{ fontSize: "1rem" }}>
            {t("org.overview.activeModules")}
          </h2>
          {activeModules.length === 0 ? (
            <p className="ow-empty">{t("org.overview.noModules")}</p>
          ) : (
            <ul className="ow-chips">
              {activeModules.map((moduleKey) => (
                <li key={moduleKey} className="ow-chip">
                  {t(`org.module.${moduleKey}`)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
