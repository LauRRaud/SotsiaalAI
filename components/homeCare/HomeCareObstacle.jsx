"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CARE_OBSTACLE_KINDS } from "@/lib/homeCare/constants";

import { formatTime, homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * „Mul on takistus" (K3-e): hooldaja teatab hooldusjuhile, et tänane päev ei lähe plaani
 * järgi. Viis valikut, vaba teksti ei ole: põhjust lähemalt kirjutama ei pea. Teade ise
 * käike ei muuda; hooldusjuht näeb seda oma päevaplaanis koos tegemata käikudega.
 *
 * Kaks sammu (valik ja saatmine), et juhuslik puudutus teadet ei saadaks.
 */
export default function HomeCareObstacle({ organizationId, timeZone, initial = null, canReport = true }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const [obstacle, setObstacle] = useState(initial);
  const [choosing, setChoosing] = useState(false);
  const [kind, setKind] = useState("");

  const start = () => {
    setKind("");
    setError("");
    setChoosing(true);
  };

  const report = async (event) => {
    event.preventDefault();
    if (!kind) return;
    const result = await call(`${homeCareBase(organizationId)}/takistus`, {
      method: "POST",
      body: { kind },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    setObstacle(result.data.obstacle || null);
    setChoosing(false);
  };

  const withdraw = async () => {
    const result = await call(`${homeCareBase(organizationId)}/takistus/${encodeURIComponent(obstacle.id)}`, {
      method: "DELETE",
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    setObstacle(result.data.obstacle || null);
  };

  return (
    <div className="hc-section" aria-live="polite">
      {obstacle ? (
        <p className={`hc-notice${obstacle.handled ? "" : " hc-notice--warn"}`}>
          {t("home_care.obstacle.sent", {
            time: formatTime(obstacle.reportedAt, timeZone),
            kind: t(`home_care.obstacle.kinds.${obstacle.kind}`)
          })}{" "}
          {t(obstacle.handled ? "home_care.obstacle.handled_hint" : "home_care.obstacle.sent_hint")}
        </p>
      ) : null}

      {choosing ? (
        <form className="hc-form" onSubmit={report} aria-busy={busy}>
          <div className="hc-field">
            <span className="hc-label">{t("home_care.obstacle.choose_title")}</span>
            <div className="hc-chips" role="group" aria-label={t("home_care.obstacle.choose_title")}>
              {CARE_OBSTACLE_KINDS.map((value) => (
                <button key={value} type="button" className="hc-chip" aria-pressed={kind === value} onClick={() => setKind(value)}>
                  {t(`home_care.obstacle.kinds.${value}`)}
                </button>
              ))}
            </div>
            <p className="hc-hint">{t("home_care.obstacle.hint")}</p>
          </div>
          <div className="hc-row">
            <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || !kind}>
              {t("home_care.obstacle.send")}
            </button>
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setChoosing(false)} disabled={busy}>
              {t("home_care.obstacle.cancel")}
            </button>
          </div>
        </form>
      ) : canReport ? (
        <div className="hc-row">
          <button className="hc-btn" type="button" onClick={start} disabled={busy}>
            {t(obstacle ? (obstacle.handled ? "home_care.obstacle.again" : "home_care.obstacle.change") : "home_care.obstacle.button")}
          </button>
          {obstacle && !obstacle.handled ? (
            <button className="hc-btn hc-btn--quiet" type="button" onClick={withdraw} disabled={busy}>
              {t("home_care.obstacle.withdraw")}
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
