"use client";

/**
 * TEENUSPÄEVIK E8 — baasjoon töötaja enda vaates.
 *
 * MIKS SEE ON EKRAANIL, MITTE AINULT ANDMEBAASIS: leping lubab „kirje sisestus
 * alla 30 sekundiga (mõõdetud)". Number, mida keegi ei näe, ei tõenda midagi —
 * ja mõõtmine, mida mõõdetav ei näe, on jälgimine, mitte tagasiside.
 *
 * SEE ON TÖÖTAJA ENDA PEEGEL. Ülemuse vaade on org-kihi (E10) küsimus ja nõuab
 * oma otsust; siin ei ole seda ette ära otsustatud. Vastus tuleb API-st, mis
 * skoobib kutsuja enda profiilile.
 *
 * „MÕÕDETUD EI OLE" ON AUS SEIS. Kui proove pole, ei kuvata nulle — sest
 * „mediaan 0 s" oleks vale väide selle asemel, et öelda „veel ei tea".
 */

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { MIN_SAMPLES_FOR_CLAIM, meetsEntryTarget } from "@/lib/serviceLog/measurement";

export default function ServiceLogBaseline() {
  const { t, locale } = useI18n();
  const [baseline, setBaseline] = useState(null);
  const [state, setState] = useState("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch("/api/service-log/measure", {
        headers: { "x-ui-locale": locale || "et" }
      });
      if (!response.ok) {
        setState("error");
        return;
      }
      const body = await response.json();
      setBaseline(body?.baseline || null);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [locale]);

  useEffect(() => {
    load();
  }, [load]);

  if (state === "loading") return null;

  const entry = baseline?.entryInput || null;

  return (
    <section className="sl-section">
      <h3 className="sl-list-title">{t("service_log.baseline.title", "")}</h3>

      {state === "error" ? (
        <p className="sl-error" role="alert">
          {t("service_log.baseline.load_error", "")}
        </p>
      ) : !entry ? (
        <p className="sl-empty">{t("service_log.baseline.empty", "")}</p>
      ) : (
        <>
          <ul className="sl-entries">
            <li className="sl-entry">
              <span className="sl-entry-client">{t("service_log.baseline.median", "")}</span>
              <span className="sl-entry-meta">
                {t("service_log.baseline.seconds", "", { seconds: entry.medianSeconds })}
              </span>
            </li>
            <li className="sl-entry">
              <span className="sl-entry-client">{t("service_log.baseline.p90", "")}</span>
              <span className="sl-entry-meta">
                {t("service_log.baseline.seconds", "", { seconds: entry.p90Seconds })}
              </span>
            </li>
            <li className="sl-entry">
              <span className="sl-entry-client">
                {t("service_log.baseline.under_target", "", { target: entry.targetSeconds })}
              </span>
              <span className="sl-entry-meta">
                {t("service_log.baseline.share", "", { share: entry.underTargetShare })}
              </span>
            </li>
            <li className="sl-entry">
              <span className="sl-entry-client">{t("service_log.baseline.samples", "")}</span>
              <span className="sl-entry-meta">
                {t("service_log.baseline.count", "", {
                  count: entry.count,
                  days: baseline.windowDays
                })}
              </span>
            </li>
          </ul>

          {/* VÄIDE ON ERALDI NUMBRITEST. Kolm kiiret sisestust ei tõenda
              lubadust; seda ütleb tekst välja, mitte ei jäta lugejale
              tõlgendada. */}
          <p className="sl-source">
            {meetsEntryTarget(entry)
              ? t("service_log.baseline.claim_met", "", { target: entry.targetSeconds })
              : entry.count < MIN_SAMPLES_FOR_CLAIM
                ? t("service_log.baseline.claim_not_enough", "", { needed: MIN_SAMPLES_FOR_CLAIM })
                : t("service_log.baseline.claim_not_met", "", { target: entry.targetSeconds })}
          </p>
        </>
      )}

      {/* Mida mõõdetakse — ilma selleta loeks kasutaja seda teenuse kestusena. */}
      <p className="sl-source">{t("service_log.baseline.explainer", "")}</p>
    </section>
  );
}
