"use client";

/**
 * TEENUSPÄEVIK-V1 E4 UI — kuuvaade.
 *
 * See on pind, mille pärast kogu moodul olemas on: kuu lõpus peab esitis
 * sündima juba sisestatud kirjetest, ilma uue sisestuseta.
 *
 * NELI ASJA, MIS PEAVAD SIIN VÄLJA PAISTMA:
 *
 * 1. KINNITAMATA KIRJETE ARV kõige ees. Esitamata mustand on kõige tavalisem
 *    põhjus, miks kuu maht on vale — ta ei tohi olla peidus tabeli lõpus.
 *
 * 2. ÜHIKUD ERALDI RIDADENA. „12" ei tähenda midagi, kui ta on 8 tundi pluss
 *    4 korda. Kokkuliidetud number näeks õigem välja ja oleks vale.
 *
 * 3. TÄHTAEG kui kuupäev, mitte kui hoiatus. Üks leebe meeldetuletus, mitte
 *    punane triip terve kuu.
 *
 * 4. AASTASTE RÜTMIDE ALLIKAS. Iga rütm kannab `source` välja ja UI kuvab
 *    selle VÄLJA: tagasisideküsitlus ja vahehindamine tulevad SKA
 *    kvaliteedijuhisest, MITTE seadusest. Vale vastavusväide töövahendis on
 *    tõsisem viga kui puuduv meeldetuletus, sest töövahendit usutakse.
 *
 * KEELEPÄIS ON KLIENDI KOHUSTUS. `localeFromRequest` loeb päringut ja päiseid,
   AGA MITTE keeleküpsist — ilma `x-ui-locale`-ta tuleb serveri veateade
   inglise keeles keset eestikeelset pinda. Brauserikontroll näitas seda
   („The entry is already final."); `i18n:check` ei saa seda püüda, sest
   võtmed on kõigis keeltes olemas — vale on KUTSE, mitte sõnastik.
   Sama muster, mida kasutab admin-kiht (`x-ui-locale: locale`).
 */

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import ServiceLogNarrative from "./ServiceLogNarrative";
import ServiceLogExport from "./ServiceLogExport";
import ServiceLogBaseline from "./ServiceLogBaseline";

function unitLabel(t, unit) {
  return t(`service_log.units.${String(unit || "").toLowerCase()}`, unit || "");
}

export default function ServiceLogMonth({ month, onMonthChange }) {
  const { t, locale } = useI18n();
  const [report, setReport] = useState(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoadError(false);
      const params = new URLSearchParams();
      if (month) params.set("month", month);
      const response = await fetch(`/api/service-log/month?${params}`, { headers: { "x-ui-locale": locale || "et" } });
      if (!response.ok) throw new Error("load_failed");
      const body = await response.json();
      setReport(body.report || null);
    } catch {
      setLoadError(true);
    }
  }, [locale, month]);

  useEffect(() => {
    load();
  }, [load]);

  if (loadError) return <p className="sl-error">{t("service_log.month.load_error", "")}</p>;
  if (!report) return null;

  const { summary, rhythm, annualRhythms } = report;

  return (
    <div className="sl-month">
      <label className="sl-field sl-month-picker">
        <span className="sl-label">{t("service_log.month.pick", "")}</span>
        <input
          name="month"
          className="sl-input"
          type="month"
          value={report.month}
          onChange={(event) => onMonthChange?.(event.target.value)}
        />
      </label>

      {/* Kinnitamata kirjed KÕIGE EES — see on number, mis kuu maha jätab. */}
      {summary.unconfirmed > 0 ? (
        <p className="sl-warn" role="status">
          {t("service_log.month.unconfirmed", "")}: {summary.unconfirmed}
        </p>
      ) : null}

      {rhythm ? (
        <p className={`sl-deadline${rhythm.overdue ? " is-overdue" : ""}`}>
          {t("service_log.month.due", "")}{" "}
          {new Date(rhythm.dueAt).toISOString().slice(0, 10)}
          {rhythm.overdue ? ` · ${t("service_log.month.overdue", "")}` : ""}
        </p>
      ) : null}

      <section>
        <h3 className="sl-list-title">{t("service_log.month.totals", "")}</h3>
        {summary.totalsByUnit.length === 0 ? (
          <p className="sl-empty">{t("service_log.month.empty", "")}</p>
        ) : (
          <ul className="sl-entries">
            {/* Iga ühik on OMA rida. Kokkuliitmine on siin keelatud. */}
            {summary.totalsByUnit.map((total) => (
              <li key={total.unit} className="sl-entry">
                <span className="sl-entry-client">{unitLabel(t, total.unit)}</span>
                <span className="sl-entry-meta">
                  {t("service_log.month.confirmed", "")}: {total.final}
                  {total.draft > 0 ? ` · ${t("service_log.month.draft", "")}: ${total.draft}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {summary.clients.length > 0 ? (
        <section>
          <h3 className="sl-list-title">{t("service_log.month.by_client", "")}</h3>
          <ul className="sl-entries">
            {summary.clients.map((client) => (
              <li key={client.key} className="sl-entry">
                <span className="sl-entry-client">
                  {client.clientDisplayName || client.clientUserId || "—"}
                </span>
                {client.services.map((service) => (
                  <span key={`${service.serviceId}|${service.unit}`} className="sl-entry-meta">
                    {service.final} {unitLabel(t, service.unit)}
                    {service.draft > 0
                      ? ` (+${service.draft} ${t("service_log.month.draft", "")})`
                      : ""}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {annualRhythms?.length ? (
        <section>
          <h3 className="sl-list-title">{t("service_log.month.annual", "")}</h3>
          <ul className="sl-entries">
            {annualRhythms.map((item) => (
              <li key={item.key} className="sl-entry">
                <span className="sl-entry-client">{t(`service_log.rhythms.${item.key}`, item.key)}</span>
                <span className="sl-entry-meta">
                  {item.neverDone
                    ? t("service_log.month.never_done", "")
                    : item.due
                      ? t("service_log.month.rhythm_due", "")
                      : t("service_log.month.rhythm_ok", "")}
                </span>
                {/* ALLIKAS ON NÄHTAV. Ilma selleta loeks kasutaja seda
                    seadusest tuleneva nõudena — ja see oleks vale. */}
                <span className="sl-source">{t("service_log.month.source_quality_guide", "")}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Sisuaruanne (E5) elab kuuvaate all: kirjutaja vajab samu numbreid,
          mille peale ta loo kirjutab. */}
      <ServiceLogNarrative month={report.month} referrals={report.referrals || []} />

      {/* Eksport (E6) on kuuvaate lõpus: fail sünnib sellest, mida kasutaja
          just üle vaatas. */}
      <ServiceLogExport month={report.month} referrals={report.referrals || []} />

      {/* Baasjoon (E8) on koige all: ta ei ole toeoeriist, vaid peegel selle
          kohta, kui kalliks toeoeriist ise laeheb. */}
      <ServiceLogBaseline />
    </div>
  );
}
