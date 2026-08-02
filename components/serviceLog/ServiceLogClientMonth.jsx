"use client";

/**
 * TEENUSPÄEVIK E7 — kliendi enda kuuvaade ja kinnitus.
 *
 * KLIENT NÄEB VÄHEM KUI OSUTAJA. Siin ei ole märkusi ega päritolumärgiseid:
 * osutaja faktimärge on kirjutatud aruande jaoks, ja kui klient teda loeks,
 * hakkaks osutaja kirjutama kliendile, mitte aruandele. Vt `lib/serviceLog/clientView.js`.
 *
 * KINNITUS ON PÖÖRDUMATU. Nupp ütleb selle enne vajutust välja — „kinnitan, et
 * see vastab toimunule" on avaldus, mitte eelistus.
 */

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import DateField from "@/components/ui/DateField";

function currentMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function ServiceLogClientMonth() {
  const { t, locale } = useI18n();
  const [month, setMonth] = useState(currentMonth);
  const [report, setReport] = useState(null);
  const [state, setState] = useState("loading");
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (targetMonth) => {
      setState("loading");
      try {
        const response = await fetch(
          `/api/service-log/client?month=${encodeURIComponent(targetMonth)}`,
          { headers: { "x-ui-locale": locale || "et" } }
        );
        if (!response.ok) {
          setState("error");
          return;
        }
        const body = await response.json();
        setReport(body?.report || null);
        setState("ready");
      } catch {
        setState("error");
      }
    },
    [locale]
  );

  useEffect(() => {
    load(month);
  }, [load, month]);

  const confirm = useCallback(async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/service-log/client", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" },
        body: JSON.stringify({ month })
      });
      if (response.ok) await load(month);
      else setState("error");
    } catch {
      setState("error");
    } finally {
      setSaving(false);
    }
  }, [load, locale, month]);

  return (
    <div className="sl-day">
      <h2 className="sl-list-title">{t("service_log.client.title", "")}</h2>

      <label className="sl-field">
        <span className="sl-label">{t("service_log.month.pick", "")}</span>
        <DateField name="month" mode="month" value={month} onChange={setMonth} />
      </label>

      {state === "error" ? (
        <p className="sl-error" role="alert">
          {t("service_log.client.load_error", "")}
        </p>
      ) : null}

      {state === "ready" && report ? (
        report.entries.length === 0 ? (
          <p className="sl-empty">{t("service_log.client.empty", "")}</p>
        ) : (
          <>
            <ul className="sl-entries">
              {report.entries.map((entry) => (
                <li key={entry.id} className="sl-entry">
                  <span className="sl-entry-client">{entry.providerName || "—"}</span>
                  <span className="sl-entry-meta">
                    {entry.date} · {entry.quantity}{" "}
                    {t(`service_log.units.${String(entry.unit).toLowerCase()}`, entry.unit)}
                    {entry.confirmedByClientAt ? ` · ${t("service_log.client.confirmed", "")}` : ""}
                  </span>
                </li>
              ))}
            </ul>

            {Object.entries(report.totals).map(([unit, value]) => (
              <p key={unit} className="sl-source">
                {t(`service_log.units.${unit.toLowerCase()}`, unit)}: {value}
              </p>
            ))}

            {report.confirmed ? (
              <p className="sl-source" role="status">
                {t("service_log.client.all_confirmed", "")}
              </p>
            ) : (
              <>
                {/* TAGAJÄRG ÖELDAKSE ENNE VAJUTUST. Pöördumatu nupp, mille mõju
                    selgub alles pärast, ei ole kinnitus vaid lõks. */}
                <p className="sl-source">{t("service_log.client.confirm_explainer", "")}</p>
                <Button onClick={confirm} disabled={saving}>
                  {saving ? t("service_log.form.saving", "") : t("service_log.client.confirm", "")}
                </Button>
              </>
            )}
          </>
        )
      ) : null}
    </div>
  );
}
