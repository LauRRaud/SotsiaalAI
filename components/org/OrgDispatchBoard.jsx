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
import Dropdown from "@/components/ui/Dropdown";
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

export default function OrgDispatchBoard({ organizationId, initialBoard, initialWorkers = [] }) {
  const { t, locale } = useI18n();
  const [board, setBoard] = useState(initialBoard || null);
  const [workers, setWorkers] = useState(initialWorkers);
  const [date, setDate] = useState(initialBoard?.date || "");
  const [assignTo, setAssignTo] = useState("");
  const [client, setClient] = useState("");
  const [address, setAddress] = useState("");
  const [startAt, setStartAt] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

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
        if (Array.isArray(body.workers)) setWorkers(body.workers);
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

  const post = useCallback(
    async (payload) => {
      setBusy(true);
      setNotice("");
      try {
        const response = await fetch(`/api/org/${organizationId}/graafik`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" },
          body: JSON.stringify(payload)
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          /* TÕRGE EI TOHI OLLA VAIKNE: „vajutasin määra, ei juhtunud midagi"
             tähendab juhi jaoks, et töötaja EI TEA tööst — ja ta ei saa seda
             kuidagi teada. */
          setNotice(body?.message || t("org.board.assign_failed"));
          return false;
        }
        setNotice(t("org.board.assigned"));
        await load(date);
        return true;
      } catch {
        setNotice(t("org.board.assign_failed"));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [date, load, locale, organizationId, t]
  );

  const assign = useCallback(async () => {
    if (!assignTo || !client.trim()) return;
    const ok = await post({
      action: "assign",
      workerUserId: assignTo,
      clientDisplayName: client,
      address,
      plannedStartAt: startAt ? new Date(startAt).toISOString() : null
    });
    if (ok) {
      setClient("");
      setAddress("");
      setStartAt("");
    }
  }, [address, assignTo, client, post, startAt]);

  /* ASENDUS. Nimi küsitakse loendist, mitte vabalt: vale nimi tähendaks, et
     töö läheb inimesele, kes sellest ei tea. */
  const reassign = useCallback(
    async (visitId) => {
      const names = workers.map((worker, index) => `${index + 1}. ${worker.name}`).join(", ");
      const pick = window.prompt(`${t("org.board.reassign_prompt")} — ${names}`);
      const index = Number(pick) - 1;
      const worker = workers[index];
      if (!worker) return;
      const reason = window.prompt(t("org.board.reassign_reason"));
      if (!reason || !reason.trim()) return;
      await post({ action: "reassign", visitId, workerUserId: worker.userId, reason });
    },
    [post, t, workers]
  );

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

      {/* MÄÄRAMINE ON PLAAN, MITTE TEHTUD TÖÖ. Juht loob plaanitud külastuse;
          kohalejõudmise ja teenuse märgib see, kes päriselt kohal käis. */}
      {workers.length ? (
        <div className="org-assign">
          <h3>{t("org.board.assign")}</h3>
          <label className="org-field">
            <span>{t("org.board.assign_worker")}</span>
            <Dropdown
              value={assignTo}
              onChange={setAssignTo}
              ariaLabel={t("org.board.assign_worker")}
              placeholder="—"
              options={workers.map((worker) => ({
                value: worker.userId,
                label: `${worker.name}${worker.jobTitle ? ` · ${worker.jobTitle}` : ""}`
              }))}
            />
          </label>
          <label className="org-field">
            <span>{t("org.board.assign_client")}</span>
            <input value={client} onChange={(event) => setClient(event.target.value)} maxLength={200} />
          </label>
          <label className="org-field">
            <span>{t("org.board.assign_address")}</span>
            <input value={address} onChange={(event) => setAddress(event.target.value)} maxLength={300} />
          </label>
          <label className="org-field">
            <span>{t("org.board.assign_time")}</span>
            <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
          </label>
          <button
            type="button"
            className="sl-entry-btn is-primary"
            disabled={busy || !assignTo || !client.trim()}
            onClick={assign}
          >
            {t("org.board.assign_send")}
          </button>
          {notice ? <p className="org-hint">{notice}</p> : null}
        </div>
      ) : null}

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
                      {/* ALUSTATUD TÖÖD EI SAA ÜMBER MÄÄRATA — nuppu ei ole.
                          Asendus tähendab „mine sina selle asemel", mitte
                          „kirjuta tema tehtud töö enda nimele". */}
                      {visit.status === "PLANNED" && workers.length > 1 ? (
                        <button
                          type="button"
                          className="sl-entry-btn"
                          disabled={busy}
                          onClick={() => reassign(visit.id)}
                        >
                          {t("org.board.reassign")}
                        </button>
                      ) : null}
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
