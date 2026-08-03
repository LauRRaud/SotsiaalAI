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
import Input from "@/components/ui/Input";
import { captureLocationPoint } from "@/lib/serviceLog/geolocation";
import ServiceLogRouteMap from "./ServiceLogRouteMap";

/** Toimingud, mille jaoks küsime enne põhjust (server nõuab seda niikuinii). */
const REASON_ACTIONS = new Set(["cancel", "not_done", "flag_correction"]);

/** Lõppseisud: siin ei ole enam kuhugi navigeerida. */
const TERMINAL = new Set(["COMPLETED", "CANCELLED", "NOT_DONE"]);
const isTerminal = (status) => TERMINAL.has(status);

/** Millist toimingut pakume SUURE nupuna. Ülejäänud jäävad kõrvalvalikuks. */
const PRIMARY_ACTION = ["arrive", "complete", "depart", "resolve_correction"];

/**
 * KESTUS INIMESE KEELES. „85 min" on tehniliselt õige ja praktikas loetamatu —
 * töötaja peab peast jagama, et teada, kas ta oli tund ja veerand või poolteist.
 * Alla tunni jääb minutitesse, sest „0 h 45 min" oleks omakorda müra.
 *
 * MÕÕDETUD, MITTE KÜSITUD: seda arvu ei sisesta keegi. Ta tuleb kahe vajutuse
 * vahelt ja just see ongi kogu jadanupu mõte.
 */
function formatDuration(minutes) {
  if (!Number.isFinite(Number(minutes)) || Number(minutes) <= 0) return null;
  const total = Math.round(Number(minutes));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

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
  /* Asukohateade käib ÜHE külastuse küljes ja tekib alles vajutuse peale. */
  const [locationNote, setLocationNote] = useState(null);
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  /* AADRESSISOOVITUSED MAA-AMETI REGISTRIST. Vaba tekst tähendas kolme viga
     korraga: navigatsioon valesse kohta, geokodeerimine ei leidnud midagi ja
     sõidulõik jäi mõõtmata. */
  const [suggestions, setSuggestions] = useState([]);

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
    async (action, extra = {}) => {
      setBusy(true);
      try {
        await call("/api/service-visits/route-day", {
          method: "POST",
          body: JSON.stringify({ action, ...extra })
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

      /**
       * ASUKOHT KÜSITAKSE SAMAS SÜNDMUSES, MITTE PÄRAST FETCH'i.
       *
       * See oli päris viga: kutse elas `await fetch(...)` JÄREL ja seega
       * väljaspool kasutaja vajutuse konteksti. Safari (ja iOS-i PWA) näitab
       * asukohadialoogi AINULT kasutaja žesti sees — pärast await'i tehtud
       * kutse ei too dialoogi üldse ette. Töötaja oleks vajutanud [Olen kohal]
       * ega oleks kunagi näinud, et luba küsitakse.
       *
       * Nüüd algab päring KOHE ja tema vastust oodatakse alles siis, kui
       * tempel on juba serveris. Ootamine ei blokeeri midagi.
       */
      /* PUNKT VÕETAKSE KA SÕIDU ALGUSES (omaniku otsus 03.08): „üldiselt võib
         töötaja alustada sõitu igalt poolt, käib enne poes." Märk ISE on
         lähtekoht — konfigureeritavat kontoriaadressi ei ole vaja. DoD 10 ei
         murdu: reegel on üks punkt TEADLIKU SÜNDMUSE kohta ja sõidu algus on
         omaette sündmus. */
      let locationPromise = null;
      if (action === "arrive" || action === "depart") {
        const token = ++visitTokenRef.current;
        locationPromise = captureLocationPoint(undefined, {
          onReason: (why) => {
            if (visitTokenRef.current !== token) return;
            setLocationNote({ visitId, key: `service_log.location.${why}` });
          }
        }).then((point) => (visitTokenRef.current === token ? point : null));
      }

      let reason = null;
      if (REASON_ACTIONS.has(action)) {
        reason = window.prompt(t("service_log.route.reason_prompt", ""));
        /* Tühistatud dialoog EI OLE „põhjuseta jah": kasutaja mõtles ümber. */
        if (!reason || !reason.trim()) return;
      }

      setBusy(true);
      setError("");
      setLocationNote(null);
      try {
        await call(`/api/service-visits/${visitId}`, {
          method: "PATCH",
          body: JSON.stringify({ action, at, reason })
        });

        if (locationPromise) {
          locationPromise.then((point) => {
            if (!point) return;
            /* Teate näitame ainult saabumisel: sõidu alguse punkt on vahend
               kauguse arvutamiseks, mitte kohalolu tõend, ja tema täpsuse
               kuvamine oleks müra keset teele asumist. */
            if (action === "arrive") {
              setLocationNote({
                visitId,
                key: point.trusted ? "service_log.location.captured_accuracy" : "service_log.location.coarse",
                meters: String(point.acc ?? "")
              });
            }
            call(`/api/service-visits/${visitId}`, {
              method: "PATCH",
              /* OMA TOIMING, mitte teine `arrive`: `ARRIVED → ARRIVED` ei ole
                 lubatud üleminek ja punkt oleks alati 409-ga kukkunud. */
              body: JSON.stringify({ action: "attach_location", locationPoint: point })
            })
              /* Ette arvutatud kaugus tuleb serverist selle sama kutse
                 vastusega — vaade laeb uuesti, et ta ekraanile jõuaks. */
              .then(() => load())
              .catch(() => {});
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

  /* Päring käib kirjutamise ajal, aga MITTE iga tähemärgi peale: väline
     register ei ole meie oma ja teda ei koormata meie klaviatuuriga. */
  useEffect(() => {
    const query = address.trim();
    if (query.length < 3) {
      setSuggestions([]);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/service-visits/aadress?q=${encodeURIComponent(query)}`);
        if (!response.ok) return;
        const body = await response.json();
        if (!cancelled) setSuggestions(Array.isArray(body.suggestions) ? body.suggestions : []);
      } catch {
        /* Soovituste puudumine tähendab „kirjuta ise", mitte tõrget. */
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [address]);

  /**
   * KÜLASTUSEST TEENUSKIRJE — üks vajutus, mitte vormi täitmine uuesti.
   *
   * Kestus, kellaajad, klient, suunamine ja asukoht on juba mõõdetud. Töötaja
   * ainus otsus on ÜHIK: tund tuleb mõõdetud minutitest, kord on kord. Kogust
   * ta ei sisesta — server tuletab ta templite vahelt.
   *
   * KIRJET EI LOODA AUTOMAATSELT: külastus ei ole alati arveldatav teenus
   * (tutvumiskäik, kliendi keeldumine). Aga vajutus peab olema ÜKS.
   */
  const makeEntry = useCallback(
    async (visitId, unit) => {
      setBusy(true);
      setError("");
      try {
        await call(`/api/service-visits/${visitId}`, {
          method: "PATCH",
          body: JSON.stringify({
            action: "create_entry",
            unit,
            /* Idempotentsus: kordusvajutus võrgu taastumisel ei tee teist
               arve alusdokumenti. */
            clientRequestId: `visit-entry-${visitId}`
          })
        });
        await load();
      } catch (entryError) {
        setError(entryError.message);
      } finally {
        setBusy(false);
      }
    },
    [call, load]
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
        {/* ÜKS KÜLASTUS ON „1 külastus", mitte „1 külastust". Eesti keeles on
            arvu järel osastav ainsus („3 külastust"), aga ÜKS on nimetavas —
            brauserikontroll näitas ekraanil „1 külastust". */}
        {t(summary.visits === 1 ? "service_log.route.summary_one" : "service_log.route.summary", "", {
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

      {/* JÄRJESTUSE SOOVITUS. Ta on SOOVITUS: rakendub ainult vajutusega.
          Automaatne ümberjärjestamine tähendaks, et töötaja avab hommikul
          telefoni ja tema päev on öösel ümber tehtud. */}
      {day.orderSuggestion ? (
        <div className="sl-suggest-order">
          <p className="sl-entry-meta">
            {t("service_log.route.order_hint", "", {
              current: String(day.orderSuggestion.currentKm ?? 0),
              suggested: String(day.orderSuggestion.km ?? 0)
            })}
          </p>
          <button
            type="button"
            className="sl-entry-btn is-primary"
            disabled={busy}
            onClick={() => routeAction("apply_order", { visitIds: day.orderSuggestion.order })}
          >
            {t("service_log.route.order_apply", "")}
          </button>
        </div>
      ) : null}

      {/* MEIE KAART = ÜLEVAADE, NAVIGAATOR = SÕITMINE.
          Päris teed meie kaardile ei joonista: selleks oleks vaja
          marsruudimootorit, kuhu läheksid KLIENTIDE KODUAADRESSID — ja isegi
          siis ei annaks väike joon hääljuhiseid ega liiklusinfot. Selle asemel
          kannab üleandmine tervet päeva: üks vajutus avab kõik järelejäänud
          külastused mitmepeatuselise marsruudina. */}
      {day.dayNavigation ? (
        <div className="sl-suggest-order">
          <a
            className="sl-entry-btn is-primary"
            href={day.dayNavigation.url}
            target="_blank"
            rel="noreferrer"
          >
            {t("service_log.route.navigate_day", "", { stops: String(day.dayNavigation.stops) })}
          </a>
          {day.dayNavigation.truncated ? (
            <span className="sl-source sl-source-warn">{t("service_log.route.navigate_truncated", "")}</span>
          ) : null}
        </div>
      ) : null}

      <ServiceLogRouteMap visits={visits} />

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
                  {/* KAKS KESTUST, KAKS ERI ASJA ja mõlemad mõõdetud:
                      sõit on teele asumisest kohalejõudmiseni, teenus
                      kohalejõudmisest lõpetamiseni. Töötaja ei sisesta
                      kumbagi. Varem oli ekraanil ainult sõit — teenuse kestus
                      arvutati ja saadeti, aga ei jõudnud reale. */}
                  {formatDuration(visit.travelMinutes)
                    ? ` · ${t("service_log.route.travel_time", "")} ${formatDuration(visit.travelMinutes)}`
                    : ""}
                  {formatDuration(visit.serviceMinutes)
                    ? ` · ${t("service_log.route.service_time", "")} ${formatDuration(visit.serviceMinutes)}`
                    : ""}
                </span>
                {visit.address ? <span className="sl-entry-meta">{visit.address}</span> : null}

                {/* KAUGUS ETTE — ainus hetk, mil see arv on kasulik. Pärast
                    kohalejõudmist on ta ajalugu. */}
                {visit.status === "EN_ROUTE" && visit.plannedTravelKm !== null ? (
                  <span className="sl-entry-meta">
                    {t("service_log.route.ahead", "", {
                      km: String(visit.plannedTravelKm),
                      minutes: String(visit.plannedTravelMinutes ?? 0)
                    })}
                  </span>
                ) : null}
                {visit.outcomeReason ? <span className="sl-source">{visit.outcomeReason}</span> : null}

                {/* RISTKONTROLL. Ühe punkti puhul ei ole võimalik teada, kas ta
                    on õige; kahe sõltumatu allika puhul on. Seade ütles Kopli,
                    aadress on Tabasalus → töötaja NÄEB seda enne, kui kirje
                    läheb arvele. */}
                {visit.locationCheck?.mismatch ? (
                  <span className="sl-source sl-source-warn">
                    {t("service_log.route.location_mismatch", "", {
                      km: String(visit.locationCheck.km)
                    })}
                  </span>
                ) : null}

                {/* Asukohateade ilmub SELLE külastuse alla ja alles pärast
                    vajutust — enne seda ei ole tal midagi öelda. */}
                {locationNote?.visitId === visit.id ? (
                  <span className="sl-source">
                    {t(locationNote.key, "", locationNote.meters ? { meters: locationNote.meters } : undefined)}
                  </span>
                ) : null}

                {/* TURVASIGNAAL. Mitte jälgimine: me ei tea, kus inimene on —
                    ainult et üks nupp on kaua vajutamata. */}
                {needsCheck?.includes(visit.id) ? (
                  <span className="sl-source sl-source-warn">{t("service_log.route.needs_check", "")}</span>
                ) : null}

                {/* E11 — üks puude ja navigatsioon avaneb selles rakenduses,
                    mis kasutajal juba olemas on. Kaardimootorit me ei manusta. */}
                {visit.navigationUrl && !isTerminal(visit.status) ? (
                  <a
                    className="sl-entry-btn"
                    href={visit.navigationUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("service_log.route.navigate", "")}
                  </a>
                ) : null}

                {visit.wazeUrl && !isTerminal(visit.status) ? (
                  <a className="sl-entry-btn" href={visit.wazeUrl} target="_blank" rel="noreferrer">
                    {t("service_log.route.navigate_waze", "")}
                  </a>
                ) : null}

                {primary ? (
                  <Button type="button" onClick={() => transition(visit.id, primary)} disabled={busy}>
                    {t(`service_log.route.action.${primary}`, "")}
                  </Button>
                ) : null}

                {/* SILD ARVELDUSENI. Ilma selleta mõõtis teekond kõik ära ja
                    töötaja pidi sama töö veel kord käsitsi sisestama —
                    mõõtmisest ei ole kasu, kui ta ei jõua sinna, kus temaga
                    midagi tehakse. */}
                {visit.status === "COMPLETED" && !visit.serviceEntryId ? (
                  <div className="sl-entry-actions">
                    <button
                      type="button"
                      className="sl-entry-btn is-primary"
                      disabled={busy}
                      onClick={() => makeEntry(visit.id, "HOUR")}
                    >
                      {t("service_log.route.make_entry_hour", "")}
                    </button>
                    <button
                      type="button"
                      className="sl-entry-btn"
                      disabled={busy}
                      onClick={() => makeEntry(visit.id, "SESSION")}
                    >
                      {t("service_log.route.make_entry_session", "")}
                    </button>
                  </div>
                ) : null}

                {visit.serviceEntryId ? (
                  <span className="sl-source">{t("service_log.route.entry_done", "")}</span>
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

      {/* E12 — SÕIDUPÄEVIK. Odomeetrit siin ei ole ja ei tule (omaniku otsus
          03.08): kaugus tuleb saabumispunktide vahelt. Mõõtmata lõik ütleb
          seda VÄLJA — väljamõeldud number oleks halvem kui puuduv, sest tema
          järgi makstakse. */}
      {day.legs?.length ? (
        <section className="sl-legs">
          <h4 className="sl-list-title">{t("service_log.route.mileage", "")}</h4>
          <ul className="sl-entries">
            {day.legs.map((leg) => (
              <li key={`${leg.fromVisitId}-${leg.toVisitId}`} className="sl-entry">
                <span className="sl-entry-meta">
                  {leg.fromClient} → {leg.toClient}
                </span>
                <span className="sl-entry-meta">
                  {leg.km === null
                    ? t("service_log.route.km_unknown", "")
                    : t(
                        leg.source === "road"
                          ? "service_log.route.km_road"
                          : leg.source === "address"
                            ? "service_log.route.km_address"
                            : leg.estimated
                              ? "service_log.route.km_estimated"
                              : "service_log.route.km_confirmed",
                        "",
                        { km: String(leg.km) }
                      )}
                  {leg.minutes !== null ? ` · ${leg.minutes} min` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="sl-source">
            {t("service_log.route.mileage_total", "", {
              km: String(day.mileage?.km ?? 0),
              minutes: String(day.mileage?.minutes ?? 0)
            })}
            {day.mileage?.missing
              ? ` · ${t("service_log.route.km_missing", "", { count: String(day.mileage.missing) })}`
              : ""}
          </p>
        </section>
      ) : null}

      {!dayClosed ? (
        adding ? (
          <div className="sl-route-add">
            <label className="sl-field">
              <span className="sl-label">{t("service_log.form.client", "")}</span>
              <Input
                className="sl-input"
                name="routeClientName"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                maxLength={200}
              />
            </label>
            <label className="sl-field">
              <span className="sl-label">{t("service_log.route.address", "")}</span>
              <Input
                className="sl-input"
                name="routeAddress"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                maxLength={300}
              />
            </label>
            {suggestions.length ? (
              <ul className="sl-suggest">
                {suggestions.map((item) => (
                  <li key={`${item.label}-${item.adsId || ""}`}>
                    <button
                      type="button"
                      className="sl-entry-btn"
                      onClick={() => {
                        setAddress(item.label);
                        setSuggestions([]);
                      }}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

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
