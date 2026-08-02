"use client";

/**
 * TEENUSPÄEVIK E10 — juhi staatustahvel.
 *
 * MIDA SIIN EI OLE JA MIKS. Kaarti ei ole. Koordinaate ei ole. Märkuste sisu
 * ei ole. Leping: „Juhi staatustahvel näitab olekut ja hilinemist, mitte elavat
 * GPS-jada." See ei ole tehniline piirang, vaid kogu meie eristus — kui siia
 * tekib kaardil liikuv punkt, oleme lihtsalt üks logistikarakendus juurde.
 *
 * JÄRJESTUS ON TÄHENDUSEGA: kes vajab tähelepanu, on ees. Juht avab tahvli
 * hommikul ja tema esimene küsimus ei ole „kes on tubli", vaid „kus on
 * probleem".
 */

import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Panel from "@/components/ui/Panel";

function formatTime(value, locale) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale || "et", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

export default function OrgDispatchBoard({ organizationId, initialBoard }) {
  const { t, locale } = useI18n();
  const [board, setBoard] = useState(initialBoard || null);
  const [date, setDate] = useState(initialBoard?.date || "");

  const load = useCallback(
    async (nextDate) => {
      try {
        const params = new URLSearchParams();
        if (nextDate) params.set("date", nextDate);
        const response = await fetch(`/api/org/${organizationId}/graafik?${params}`, {
          headers: { "x-ui-locale": locale || "et" }
        });
        if (!response.ok) return;
        const body = await response.json();
        setBoard(body.board || null);
      } catch {
        /* Vaikne: tahvel on ülevaade, mitte toiming. Tema laadimise tõrge ei
           tohi juhti takistada mujal tööd tegemast. */
      }
    },
    [locale, organizationId]
  );

  useEffect(() => {
    if (date && date !== board?.date) load(date);
  }, [board?.date, date, load]);

  if (!board?.allowed) {
    return (
      <Panel as="section" variant="secondary" padding="sm">
        <h2>{t("org.board.title")}</h2>
        {/* ÕIGUSETA LIIGE EI SAA VIGA, vaid selgituse. Veakood ütleks, et siin
            on midagi, mida ta näha ei tohi. */}
        <p className="org-empty">{t("org.board.no_access")}</p>
      </Panel>
    );
  }

  const totals = board.totals || {};

  return (
    <Panel as="section" variant="secondary" padding="sm">
      <h2>{t("org.board.title")}</h2>
      <p className="org-hint">{t("org.board.intro")}</p>

      <label className="org-field">
        <span>{t("org.board.date")}</span>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>

      <p className="org-hint">
        {t("org.board.totals", {
          workers: String(totals.workers ?? 0),
          open: String(totals.open ?? 0)
        })}
        {totals.late ? ` · ${t("org.board.late_count", { count: String(totals.late) })}` : ""}
        {totals.needsCheck ? ` · ${t("org.board.check_count", { count: String(totals.needsCheck) })}` : ""}
      </p>

      {board.workers.length === 0 ? (
        <p className="org-empty">{t("org.board.empty")}</p>
      ) : (
        <ul className="org-list">
          {board.workers.map((worker) => (
            <li key={worker.membershipId} className="org-list__item">
              <div className="org-list__main">
                <strong>{worker.name}</strong>
                {worker.jobTitle ? <span> · {worker.jobTitle}</span> : null}
              </div>

              <div className="org-list__meta">
                {worker.routeStatus === null
                  ? t("org.board.not_started")
                  : worker.routeStatus === "CLOSED"
                    ? t("org.board.day_closed", { time: formatTime(worker.endedAt, locale) })
                    : t("org.board.day_open", { time: formatTime(worker.startedAt, locale) })}
                {worker.onBreak ? ` · ${t("org.board.on_break")}` : ""}
                {` · ${t("org.board.day_summary", {
                  visits: String(worker.summary?.visits ?? 0),
                  travel: String(worker.summary?.travelMinutes ?? 0)
                })}`}
              </div>

              {/* HILINEMINE, MITTE ASUKOHT. Ainus „kus ta on" küsimus, millele
                  vastame — ja vastus on „ei ole veel alustanud". */}
              {worker.late.map((item) => (
                <div key={item.id} className="org-list__meta org-warn">
                  {t("org.board.late", {
                    client: item.client || "—",
                    minutes: String(item.minutesLate)
                  })}
                </div>
              ))}

              {worker.needsCheck.map((item) => (
                <div key={item.id} className="org-list__meta org-warn">
                  {t("org.board.needs_check", { client: item.client || "—" })}
                </div>
              ))}

              {worker.visits.length ? (
                <ol className="org-list__sub">
                  {worker.visits.map((visit) => (
                    <li key={visit.id}>
                      {visit.client || "—"} ·{" "}
                      {t(`service_log.route.status.${visit.status.toLowerCase()}`, visit.status)}
                      {visit.arrivedAt ? ` · ${formatTime(visit.arrivedAt, locale)}` : ""}
                      {/* PÕHJUS ON NÄHTAV. „Tegemata" ilma põhjuseta on number,
                          mille tähendust juht kuu pärast ei tea. */}
                      {visit.outcomeReason ? ` — ${visit.outcomeReason}` : ""}
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="org-hint">{t("org.board.privacy_note")}</p>
    </Panel>
  );
}
