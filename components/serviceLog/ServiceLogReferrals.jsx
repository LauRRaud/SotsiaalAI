"use client";

/**
 * TEENUSPÄEVIK-V1 E3 UI — suunamised ja jääk.
 *
 * DoD punkt 4: „suunamise jääk ALATI nähtav, ületamine hoiatab." Seepärast on
 * jääk siin iga rea juures, mitte eraldi klõpsu taga — ja ta tuleb loendiga
 * KOOS, ilma teise päringuta.
 *
 * KOLM ASJA, MIS PEAVAD OLEMA ERALDI NÄHTAVAD:
 *   1. kinnitatud maht (`used`) — see läheb arvele;
 *   2. kinnitamata maht (`pending`) — see on tehtud töö, mis arvele veel ei lähe;
 *   3. jääk (`remaining`) — ja kui ta on negatiivne, siis kui palju üle.
 * Ühte numbrisse kokku surutuna kaob just see, mille pärast osutaja vaatab.
 *
 * MÄÄRAMATA MAHT EI OLE NULL. Kui suunamisel mahtu ei ole, ütleme seda välja;
 * „0" tähendaks, et maht on otsas, ja see on vastupidine olukord.
 */

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";

function formatQuantity(value, unit, t) {
  if (value === null || value === undefined) return "—";
  const unitLabel = t(`service_log.units.${String(unit || "").toLowerCase()}`, unit || "");
  return `${value} ${unitLabel}`;
}

export default function ServiceLogReferrals({ month }) {
  const { t } = useI18n();
  const [referrals, setReferrals] = useState(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoadError(false);
      const params = new URLSearchParams();
      if (month) params.set("month", month);
      const response = await fetch(`/api/service-referrals?${params}`);
      if (!response.ok) throw new Error("load_failed");
      const body = await response.json();
      setReferrals(Array.isArray(body.referrals) ? body.referrals : []);
    } catch {
      setLoadError(true);
      setReferrals((current) => current || []);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  if (loadError) {
    return <p className="sl-error">{t("service_log.referrals.load_error", "")}</p>;
  }
  if (referrals === null) return null;
  if (!referrals.length) {
    return <p className="sl-empty">{t("service_log.referrals.empty", "")}</p>;
  }

  return (
    <ul className="sl-referrals">
      {referrals.map((referral) => {
        const balance = referral.balance || {};
        const undefinedAllocation = balance.remaining === null || balance.remaining === undefined;
        return (
          <li
            key={referral.id}
            className={`sl-referral${balance.overrun ? " is-overrun" : ""}${
              referral.status === "ENDED" ? " is-ended" : ""
            }`}
          >
            <div className="sl-referral-head">
              <span className="sl-referral-client">
                {referral.clientDisplayName || referral.clientUserId || "—"}
              </span>
              <span className="sl-referral-kov">{referral.kovName}</span>
            </div>

            {undefinedAllocation ? (
              /* „Maht määramata" ja „maht otsas" on vastandlikud olukorrad —
                 nulli kuvamine oleks vale info, mitte lihtsustus. */
              <p className="sl-referral-note">{t("service_log.referrals.no_allocation", "")}</p>
            ) : (
              <dl className="sl-balance">
                <div>
                  <dt>{t("service_log.referrals.allocated", "")}</dt>
                  <dd>{formatQuantity(balance.allocated, referral.unit, t)}</dd>
                </div>
                <div>
                  <dt>{t("service_log.referrals.used", "")}</dt>
                  <dd>{formatQuantity(balance.used, referral.unit, t)}</dd>
                </div>
                <div>
                  <dt>{t("service_log.referrals.pending", "")}</dt>
                  <dd>{formatQuantity(balance.pending, referral.unit, t)}</dd>
                </div>
                <div className={balance.overrun ? "sl-balance-bad" : "sl-balance-good"}>
                  <dt>{t("service_log.referrals.remaining", "")}</dt>
                  <dd>{formatQuantity(balance.remaining, referral.unit, t)}</dd>
                </div>
              </dl>
            )}

            {balance.overrun ? (
              <p className="sl-warn" role="status">
                {t("service_log.referrals.overrun", "")} {formatQuantity(balance.overrunBy, referral.unit, t)}
              </p>
            ) : null}

            {referral.status === "ENDED" ? (
              <p className="sl-referral-note">{t("service_log.referrals.ended", "")}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
