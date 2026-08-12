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
import DateField from "@/components/ui/DateField";
import ServiceLogNarrative from "./ServiceLogNarrative";
import ServiceLogShare from "./ServiceLogShare";
import ServiceLogExport from "./ServiceLogExport";
import ServiceLogBaseline from "./ServiceLogBaseline";
import { isServiceLogMeasurementUiEnabled } from "@/lib/serviceLog/flags";

function unitLabel(t, unit) {
  return t(`service_log.units.${String(unit || "").toLowerCase()}`, unit || "");
}

/**
 * Kuupäev kasutaja keeles. `Intl` teeb selle õigesti ka siis, kui brauseri
 * keel erineb platvormi keelest — käsitsi kokku pandud „02.08.2026" oleks üks
 * lokaat, mis peab kolme jaoks sobima.
 */
function formatDate(value, locale) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale || "et", { dateStyle: "short" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export default function ServiceLogMonth({ month, onMonthChange }) {
  const { t, locale } = useI18n();
  const [report, setReport] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");

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

  /**
   * KINNITAMINE KOLIS PÄEVA LEHELT SIIA.
   *
   * Omanik: „ma ei näe, mida kinnitan" ja „kas need kirjed peavad seal lehel
   * olema... need on päeva kirjed". Mõlemad viitasid samale: kinnitamine ei ole
   * päeva toiming, vaid KUU LÕPU oma. Seda tehakse siis, kui koond on ees ja
   * eksport tuleb — mitte iga kirje järel eraldi.
   *
   * Ja siin on koond PÄRISELT ees: kinnitamata arv on lehe ülaosas ja
   * kinnitamata read on loendis esimesed.
   */
  const lifecycle = useCallback(
    async (entryId, action) => {
      setBusy(entryId);
      setActionError("");
      try {
        const response = await fetch(`/api/service-entries/${entryId}/lifecycle`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" },
          body: JSON.stringify({ action })
        });
        if (!response.ok) {
          /* TÕRGE EI TOHI OLLA VAIKNE: kinnitamata kirje tähendab kuu lõpus
             tühja eksporti ja seda avastataks alles KOV-i küsimuse peale. */
          const body = await response.json().catch(() => ({}));
          setActionError(body?.message || t("service_log.errors.invalid_input", ""));
          return;
        }
        await load();
      } catch {
        setActionError(t("service_log.errors.invalid_input", ""));
      } finally {
        setBusy("");
      }
    },
    [load, locale, t]
  );

  if (loadError) return <p className="sl-error">{t("service_log.month.load_error", "")}</p>;
  if (!report) return null;

  const { summary, rhythm, annualRhythms } = report;

  return (
    <div className="sl-month">
      <label className="sl-field sl-month-picker">
        <span className="sl-label">{t("service_log.month.pick", "")}</span>
        <DateField
          name="month"
          mode="month"
          value={report.month}
          onChange={(next) => onMonthChange?.(next)}
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

      {/* KUU KIRJED — kinnitamata ees. Siin otsustatakse, kas eksport tuleb
          täis või tühi, ja siin peab olema NÄHA, mida kinnitatakse. */}
      {report.entries?.length ? (
        <section>
          <h3 className="sl-list-title">{t("service_log.month.entries", "")}</h3>
          {actionError ? <p className="sl-error">{actionError}</p> : null}
          <ul className="sl-entries">
            {report.entries.map((entry) => (
              <li key={entry.id} className="sl-entry">
                <span className="sl-entry-client">{entry.clientDisplayName || "—"}</span>
                <span className="sl-entry-meta">
                  {entry.date} · {entry.quantity} {unitLabel(t, entry.unit)} ·{" "}
                  {t(`service_log.status.${String(entry.status || "DRAFT").toLowerCase()}`, entry.status)}
                </span>
                {/* MIDA MA KINNITAN. Märkus ja tema päritolu on täpselt see,
                    mida kuu lõpus üle vaadatakse: kas „kliendi öeldu" on
                    tõesti kliendi öeldu. */}
                {entry.note ? (
                  <span className="sl-entry-meta">
                    {entry.note}
                    {entry.noteProvenance
                      ? ` · ${t(`casework.provenance.${entry.noteProvenance.toLowerCase()}`, entry.noteProvenance)}`
                      : ""}
                  </span>
                ) : null}
                <div className="sl-entry-actions">
                  {!entry.clientUserId && entry.status === "FINAL" ? (
                    <button
                      type="button"
                      className={`sl-entry-btn${entry.confirmedManually ? " is-active" : ""}`}
                      disabled={busy === entry.id}
                      aria-pressed={Boolean(entry.confirmedManually)}
                      onClick={() =>
                        lifecycle(entry.id, entry.confirmedManually ? "unconfirm_manual" : "confirm_manual")
                      }
                    >
                      {t("service_log.list.manual_confirm", "")}
                    </button>
                  ) : null}
                  {entry.status === "DRAFT" ? (
                    <button
                      type="button"
                      className="sl-entry-btn is-primary"
                      disabled={busy === entry.id}
                      onClick={() => lifecycle(entry.id, "finalize")}
                    >
                      {t("service_log.month.finalize", "")}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {/* TAGAJÄRG ÖELDAKSE VÄLJA. „Kinnita" ei ole salvestamine — ta teeb
              kirjest arve alusdokumendi. */}
          <p className="sl-source">{t("service_log.month.finalize_hint", "")}</p>
        </section>
      ) : null}

      {/* ESITATUD ARUANDED. Kuuvaade on esimene koht, kust inimene küsib „kas ma
          selle kuu aruande juba saatsin" — enne seda ei osanud platvorm vastata,
          sest eksport oli allalaadimine ja jäljetu.

          KORDUSVÄLJASTUS ON NÄHTAV. „3 korda" ei ole viga: e-kiri võis
          põrkuda ja fail uuesti teele minna. Vaikselt peidetuna näeks kolm
          saatmist välja nagu üks. */}
      {report.reports?.length ? (
        <section>
          <h3 className="sl-list-title">{t("service_log.month.reports", "")}</h3>
          <ul className="sl-entries">
            {report.reports.map((item) => (
              <li key={item.id} className="sl-entry">
                <span className="sl-entry-client">{item.kovName || item.fileName}</span>
                <span className="sl-entry-meta">
                  {t("service_log.month.report_meta", "", {
                    format: String(item.format || "").toUpperCase(),
                    date: formatDate(item.lastIssuedAt || item.createdAt, locale)
                  })}
                </span>
                {item.issuedCount > 1 ? (
                  <span className="sl-entry-meta">
                    {t("service_log.month.report_issued_times", "", { count: String(item.issuedCount) })}
                  </span>
                ) : null}
                <span className="sl-source">{t("service_log.month.report_stored", "")}</span>
                {/* SALVESTATUD ARUANNET PEAB SAAMA AVADA.
                    Esimene versioon loetles aruanded, aga ei andnud ühtegi teed
                    nendeni — omanik ütles otse: „ma ei saanud aruandeid avada".
                    Loend, millest midagi ei avane, on halvem kui loendi
                    puudumine: ta lubab midagi, mida ei ole. */}
                <div className="sl-entry-actions">
                  <a className="sl-entry-btn" href={`/api/documents/${item.id}/download`} download>
                    {t("service_log.month.report_open", "")}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* JAGAMINE JÄRGNEB SALVESTATUD ARUANDELE, mitte ekspordile: saata saab
          seda, mis on juba olemas. Plokk peidab end ise, kui saata ei ole
          midagi või kellelegi. */}
      <ServiceLogShare month={report.month} reports={report.reports || []} onShared={load} />

      {/* Sisuaruanne (E5) elab kuuvaate all: kirjutaja vajab samu numbreid,
          mille peale ta loo kirjutab. */}
      <ServiceLogNarrative month={report.month} referrals={report.referrals || []} />

      {/* Eksport (E6) on kuuvaate lõpus: fail sünnib sellest, mida kasutaja
          just üle vaatas. */}
      <ServiceLogExport
        month={report.month}
        referrals={report.referrals || []}
        onExported={load}
      />

      {/* Baasjoon (E8) on PILOODI vahend, mitte puesiv naeidik (omanik 02.08).
          Vaeljas lipuga ei kuvata teda ega koguta proove — vaikimisi vaeljas. */}
      {isServiceLogMeasurementUiEnabled() ? <ServiceLogBaseline /> : null}
    </div>
  );
}
