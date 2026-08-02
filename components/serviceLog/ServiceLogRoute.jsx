"use client";

/**
 * TEENUSPÄEVIK E2c — TÖÖTAJA PÄEVATEEKOND.
 *
 * ÜKS NUPP, MIS JUHIB JOOKSVAT KÜLASTUST. Sama põhimõte mis OSA I jadanupul —
 * ekraanil on korraga üks otsus — aga nüüd teekonna peal: kui üks klient on
 * tehtud, on järgmine nupp „järgmine klient", mitte „tagasi kontorisse".
 *
 * NELI ASJA, MIS SIIN ON TEADLIKUD:
 *
 * 1. LUBATUD TOIMINGUD TULEVAD SERVERILT (`visit.actions`). Kui UI arvutaks
 *    need ise, läheksid kaks reeglistikku ükskord lahku ja kasutaja näeks
 *    nuppu, mis annab 409.
 *
 * 2. AEG PANNAKSE KIRJA VAJUTUSE HETKEL, mitte serverini jõudmise hetkel.
 *    `at` läheb kaasa iga päringuga: võrguta järjekorras oodanud vajutus peab
 *    kandma oma õiget aega.
 *
 * 3. PÕHJUS KÜSITAKSE ENNE, MITTE PÄRAST. „Jäi ära" ilma põhjuseta on number,
 *    mille tähendust keegi kuu pärast ei tea — ja server keeldub niikuinii.
 *
 * 4. ASUKOHT AINULT SAABUMISEL. Sama reegel mis OSA I-s: üks punkt teadliku
 *    sündmuse kohta, taustajälge ei ole.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { captureLocationPoint } from "@/lib/serviceLog/geolocation";

/** Toimingud, mille jaoks küsime enne põhjust (server nõuab seda niikuinii). */
const REASON_ACTIONS = new Set(["cancel", "not_done", "flag_correction"]);

/** Millist toimingut pakume SUURE nupuna. Ülejäänud jäävad kõrvalvalikuks. */
const PRIMARY_ACTION = ["arrive", "complete", "depart", "resolve_correction"];

function formatTime(value, locale) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale || "et", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

export default function ServiceLogRoute() {
  const { t, locale } = useI18n();
  const [day, setDay] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");

  /* Iga külastus saab oma põletusnumbri: hilinenud asukohavastus ei tohi
     jõuda JÄRGMISE kliendi kirje peale. Sama lõks mis OSA I-s. */
  const visitTokenRef = useRef(0);

  const call = useCallback(
    async (url, options = {}) => {
      const response = await fetch(url, {
        ...options,
        headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et", ...(options.headers || {}) }
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        /* TÕRGE EI TOHI OLLA VAIKNE. Vajutus, mille peale ei juhtu midagi,
           õpetab kasutajale, et nupud on soovituslikud. */
        throw new Error(body?.message || t("service_log.errors.invalid_input", ""));
      }
      return body;
    },
    [locale, t]
  );

  const load = useCallback(async () => {
    try {
      setError("");
      const body = await call("/api/service-visits");
      setDay(body.day || null);
    } catch (loadError) {
      setError(loadError.message);
    }
  }, [call]);

  useEffect(() => {
    load();
  }, [load]);

  const routeAction = useCallback(
    async (action) => {
      setBusy(true);
      try {
        await call("/api/service-visits/route-day", {
          method: "POST",
          body: JSON.stringify({ action })
        });
        await load();
      } catch (actionError) {
        setError(actionError.message);
      } finally {
        setBusy(false);
      }
    },
    [call, load]
  );

  const transition = useCallback(
    async (visitId, action) => {
      /* AEG ENNE KÕIKE MUUD. Ka siis, kui võrk on maas ja põhjuse küsimine
         võtab aega, on see hetk, mis päriselt juhtus. */
      const at = new Date().toISOString();

      let reason = null;
      if (REASON_ACTIONS.has(action)) {
        reason = window.prompt(t("service_log.route.reason_prompt", ""));
        /* Tühistatud dialoog EI OLE „põhjuseta jah": kasutaja mõtles ümber. */
        if (!reason || !reason.trim()) return;
      }

      setBusy(true);
      setError("");
      try {
        await call(`/api/service-visits/${visitId}`, {
          method: "PATCH",
          body: JSON.stringify({ action, at, reason })
        });

        /* ASUKOHT KÜSITAKSE PÄRAST seda, kui tempel on juba serveris. GPS võib
           kesta 20 sekundit ja tema ootamine ei tohi külastuse märkimist edasi
           lükata ega ära jätta. */
        if (action === "arrive") {
          const token = ++visitTokenRef.current;
          captureLocationPoint().then((point) => {
            if (!point || visitTokenRef.current !== token) return;
            call(`/api/service-visits/${visitId}`, {
              method: "PATCH",
              /* OMA TOIMING, mitte teine `arrive`: külastus on juba `ARRIVED`
                 ja `ARRIVED → ARRIVED` ei ole lubatud üleminek. Teise `arrive`
                 kutsega oleks punkt alati 409-ga kukkunud ja asukohatempel
                 poleks kunagi salvestunud. */
              body: JSON.stringify({ action: "attach_location", locationPoint: point })
            }).catch(() => {});
          });
        }

        await load();
      } catch (transitionError) {
        setError(transitionError.message);
      } finally {
        setBusy(false);
      }
    },
    [call, load, t]
  );

  const addVisit = useCallback(async () => {
    if (!clientName.trim()) return;
    setBusy(true);
    setError("");
    try {
      await call("/api/service-visits", {
        method: "POST",
        body: JSON.stringify({
          clientDisplayName: clientName,
          address,
          /* Idempotentsusvõti KLIENDI POOLT: kordussaatmine võrgu taastumisel
             ei tohi teha teist külastust. */
          clientRequestId: `visit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        })
      });
      setClientName("");
      setAddress("");
      setAdding(false);
      await load();
    } catch (addError) {
      setError(addError.message);
    } finally {
      setBusy(false);
    }
  }, [address, call, clientName, load]);

  if (!day) return null;

  const { route, visits, currentVisitId, needsCheck } = day;
  const summary = route?.summary || {};
  const dayClosed = route?.status === "CLOSED" || !route?.id;

  return (
    <section className="sl-route">
      <h3 className="sl-group-title">{t("service_log.route.title", "")}</h3>

      <p className="sl-route-summary">
        {t("service_log.route.summary", "", {
          visits: String(summary.visits ?? 0),
          travel: String(summary.travelMinutes ?? 0),
          service: String(summary.serviceMinutes ?? 0)
        })}
        {summary.breakMinutes
          ? ` · ${t("service_log.route.break_total", "", { minutes: String(summary.breakMinutes) })}`
          : ""}
      </p>

      {error ? <p className="sl-error">{error}</p> : null}

      <div className="sl-route-controls">
        {dayClosed ? (
          <Button type="button" onClick={() => routeAction("start")} disabled={busy}>
            {t("service_log.route.start", "")}
          </Button>
        ) : (
          <>
            <button
              type="button"
              className="sl-flow-undo"
              onClick={() => routeAction(route.onBreak ? "break_end" : "break_start")}
              disabled={busy}
            >
              {t(route.onBreak ? "service_log.route.break_end" : "service_log.route.break_start", "")}
            </button>
            <button
              type="button"
              className="sl-flow-undo"
              onClick={() => routeAction("end")}
              disabled={busy}
            >
              {t("service_log.route.end", "")}
            </button>
          </>
        )}
      </div>

      {route?.onBreak ? <p className="sl-warn" role="status">{t("service_log.route.on_break", "")}</p> : null}

      {visits.length === 0 ? (
        <p className="sl-empty">{t("service_log.route.empty", "")}</p>
      ) : (
        <ul className="sl-entries">
          {visits.map((visit) => {
            const isCurrent = visit.id === currentVisitId;
            const primary = PRIMARY_ACTION.find((action) => visit.actions.includes(action));
            const secondary = visit.actions.filter((action) => action !== primary);
            return (
              <li
                key={visit.id}
                className={isCurrent ? "sl-entry sl-entry-current" : "sl-entry"}
              >
                <span className="sl-entry-client">{visit.clientDisplayName || "—"}</span>
                <span className="sl-entry-meta">
                  {t(`service_log.route.status.${visit.status.toLowerCase()}`, visit.status)}
                  {visit.arrivedAt ? ` · ${formatTime(visit.arrivedAt, locale)}` : ""}
                  {visit.travelMinutes !== null ? ` · ${visit.travelMinutes} min` : ""}
                </span>
                {visit.address ? <span className="sl-entry-meta">{visit.address}</span> : null}
                {visit.outcomeReason ? <span className="sl-source">{visit.outcomeReason}</span> : null}

                {/* TURVASIGNAAL. Mitte jälgimine: me ei tea, kus inimene on —
                    ainult et üks nupp on kaua vajutamata. */}
                {needsCheck?.includes(visit.id) ? (
                  <span className="sl-source sl-source-warn">{t("service_log.route.needs_check", "")}</span>
                ) : null}

                {primary ? (
                  <Button type="button" onClick={() => transition(visit.id, primary)} disabled={busy}>
                    {t(`service_log.route.action.${primary}`, "")}
                  </Button>
                ) : null}

                {secondary.map((action) => (
                  <button
                    key={action}
                    type="button"
                    className="sl-flow-undo"
                    onClick={() => transition(visit.id, action)}
                    disabled={busy}
                  >
                    {t(`service_log.route.action.${action}`, "")}
                  </button>
                ))}
              </li>
            );
          })}
        </ul>
      )}

      {!dayClosed ? (
        adding ? (
          <div className="sl-route-add">
            <label className="sl-field">
              <span className="sl-label">{t("service_log.form.client", "")}</span>
              <input
                className="sl-input"
                name="routeClientName"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                maxLength={200}
              />
            </label>
            <label className="sl-field">
              <span className="sl-label">{t("service_log.route.address", "")}</span>
              <input
                className="sl-input"
                name="routeAddress"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                maxLength={300}
              />
            </label>
            <Button type="button" onClick={addVisit} disabled={busy || !clientName.trim()}>
              {t("service_log.route.add_visit", "")}
            </Button>
          </div>
        ) : (
          <Button type="button" variant="secondary" onClick={() => setAdding(true)} disabled={busy}>
            {visits.length ? t("service_log.route.next_client", "") : t("service_log.route.add_visit", "")}
          </Button>
        )
      ) : null}
    </section>
  );
}
