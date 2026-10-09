"use client";

/**
 * Mentorluse avaleht: leia mentor, minu suhted, taotlused ja mina mentorina.
 *
 * KUJU (09.10). Leht oli üks pikk veerg klaaspaneeli sees olevas tumedas
 * kaardis. Nüüd on see sammulava (`components/stage/StepFlight.jsx`) laua
 * kujul: leht avaneb kõigi osade ülevaates (igal plaadil esimene rida või
 * tühjuse põhjus) ja osa avaneb omaette vaates. Osad ei ole sammud, seepärast
 * annab leht lavale `parts` ja oma sõnad („Kogu mentorlus”).
 *
 * Vaated on failis ./entry/HomeViews.jsx, read ehitab ./entry/entryRows.js.
 * Siin on andmed, päringud ja see, mis vaateid olekuga seob.
 *
 * MIS ON TEISITI KUI ENNE (ja miks):
 *  - Filtrid on valikud kataloogi enda väärtustest ja rakenduvad kohe. Server
 *    võrdleb terve sildiga täpselt; vabatekstina trükitud „laste” ei leidnud
 *    sildiga „Lastekaitse” mentorit ja leht ei öelnud, miks.
 *  - Filter jääb kehtima ka pärast taotlusele vastamist (enne laaditi kataloog
 *    siis uuesti filtrita, kuigi väljad näitasid filtrit edasi).
 *  - Kataloogi laadimise viga on viga, mitte lause „mentoreid ei ole”.
 *  - Keeldumine ja taotluse tühistamine on lõplikud (keeldumisele järgneb 30
 *    päeva ooteaeg), seepärast küsib nupp teist vajutust.
 *  - Seisu sõna tuleb loendist (`statusWord`): tundmatu kood ei jõua ekraanile.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { localizePath } from "@/lib/localizePath";

import { EntryShell } from "./entry/EntryParts";
import {
  CATALOG_CAP,
  catalogFacets,
  filterQuery,
  homeParts,
  incomingRows,
  mentorRows,
  pickGroup,
  relationRows,
  sentRows,
  statusWord
} from "./entry/entryRows";
import { FindView, MentorView, RelationsView, RequestsView } from "./entry/HomeViews";
import styles from "./entry/entry.module.css";

/* Teine vajutus (keeldumine, tühistamine) peab tulema selle aja sees. */
const CONFIRM_MS = 8000;
const NO_FILTERS = Object.freeze({ field: "", topic: "", language: "" });
const NO_FACETS = Object.freeze({ field: [], topic: [], language: [] });

const catalogUrl = (query) => (query ? `/api/mentoring/catalog?${query}` : "/api/mentoring/catalog");

export default function MentoringHomePage() {
  const { t, locale } = useI18n();
  const [overview, setOverview] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [facets, setFacets] = useState(NO_FACETS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [busyKey, setBusyKey] = useState("");
  const [filters, setFilters] = useState(NO_FILTERS);
  const [filterNotice, setFilterNotice] = useState("");
  const [relationGroup, setRelationGroup] = useState("open");
  const [requestGroup, setRequestGroup] = useState("incoming");
  /* Teist vajutust ootav tegevus: `decline:<id>` või `cancel:<id>`. */
  const [confirming, setConfirming] = useState("");
  const confirmTimer = useRef(0);
  /* Kehtiv filter ja kataloogi päringu järjekorranumber: hilinenud vastus ei
     tohi värskemat loendit üle kirjutada. */
  const filtersRef = useRef(NO_FILTERS);
  const catalogRun = useRef(0);

  const armConfirm = useCallback((key) => {
    window.clearTimeout(confirmTimer.current);
    setConfirming(key);
    confirmTimer.current = window.setTimeout(() => setConfirming(""), CONFIRM_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(confirmTimer.current), []);

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale || "et", { dateStyle: "medium" }),
    [locale]
  );
  const formatDate = useCallback((value) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? formatter.format(date) : "";
  }, [formatter]);

  const load = useCallback(async (signal) => {
    setLoadError("");
    try {
      const query = filterQuery(filtersRef.current);
      const run = ++catalogRun.current;
      const [overviewResponse, catalogResponse] = await Promise.all([
        fetch("/api/mentoring/overview", { cache: "no-store", signal }),
        fetch(catalogUrl(query), { cache: "no-store", signal })
      ]);
      const overviewPayload = await overviewResponse.json().catch(() => ({}));
      const catalogPayload = await catalogResponse.json().catch(() => ({}));
      if (!overviewResponse.ok || overviewPayload?.ok === false) {
        throw new Error(resolveApiMessage({
          payload: overviewPayload,
          t,
          fallbackKey: "mentoring.errors.load_failed"
        }));
      }
      setOverview(overviewPayload);
      if (run !== catalogRun.current) return;
      const catalogOk = catalogResponse.ok && catalogPayload?.ok !== false;
      const profiles = catalogOk && Array.isArray(catalogPayload?.profiles) ? catalogPayload.profiles : [];
      setCatalog(profiles);
      setCatalogFailed(!catalogOk);
      /* Filtrite valikud tulevad filtrita kataloogist: filtreeritud vastuses on
         ainult osa väärtusi. */
      if (catalogOk && !query) setFacets(catalogFacets(profiles, locale));
    } catch (error) {
      if (error?.name === "AbortError") return;
      setLoadError(error?.message || t("mentoring.errors.load_failed"));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [locale, t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const changeFilter = useCallback(async (key, value) => {
    const previous = filtersRef.current;
    const next = { ...previous, [key]: value };
    filtersRef.current = next;
    setFilters(next);
    setFilterNotice("");
    const run = ++catalogRun.current;
    const query = filterQuery(next);
    try {
      const response = await fetch(catalogUrl(query), { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error("catalog");
      if (run !== catalogRun.current) return;
      const profiles = Array.isArray(payload?.profiles) ? payload.profiles : [];
      setCatalog(profiles);
      setCatalogFailed(false);
      if (!query) setFacets(catalogFacets(profiles, locale));
    } catch {
      if (run !== catalogRun.current) return;
      /* Loend jäi selliseks, nagu ta oli. Siis läheb ka valik tagasi: muidu
         näitaks filter üht ja loend teist. */
      filtersRef.current = previous;
      setFilters(previous);
      setFilterNotice(t("mentoring.home.filter_failed"));
    }
  }, [locale, t]);

  const postRequestAction = useCallback(async (requestId, body) => {
    const response = await fetch(`/api/mentoring/requests/${encodeURIComponent(requestId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      const error = new Error(resolveApiMessage({ payload, t, fallbackKey: "mentoring.errors.save_failed" }));
      error.status = response.status;
      throw error;
    }
    return payload;
  }, [t]);

  /* Seis muutus mujal (taotlus aegus, tühistati või sai vastuse teises aknas):
     loend värskendatakse, et vananenud rida ette ei jääks. */
  const reloadIfStale = useCallback(async (error) => {
    if (error?.status === 409 || error?.status === 404) await load();
  }, [load]);

  const respond = useCallback(async (requestId, decision) => {
    setBusyKey(`respond:${requestId}`);
    setFeedback(null);
    setConfirming("");
    try {
      const payload = await postRequestAction(requestId, { action: "respond", decision });
      setFeedback(decision === "ACCEPT"
        ? { text: t("mentoring.home.request_accepted_feedback"), tone: "ok", relationId: String(payload?.relationId || "") }
        : { text: t("mentoring.home.request_declined_feedback") });
      await load();
    } catch (error) {
      setFeedback({ text: error?.message || t("mentoring.errors.save_failed"), tone: "risk" });
      await reloadIfStale(error);
    } finally {
      setBusyKey("");
    }
  }, [load, postRequestAction, reloadIfStale, t]);

  const cancelRequest = useCallback(async (requestId) => {
    setBusyKey(`cancel:${requestId}`);
    setFeedback(null);
    setConfirming("");
    try {
      await postRequestAction(requestId, { action: "cancel" });
      setFeedback({ text: t("mentoring.home.request_cancelled_feedback") });
      await load();
    } catch (error) {
      setFeedback({ text: error?.message || t("mentoring.errors.save_failed"), tone: "risk" });
      await reloadIfStale(error);
    } finally {
      setBusyKey("");
    }
  }, [load, postRequestAction, reloadIfStale, t]);

  const rowContext = { t, formatDate };
  const relations = relationRows(overview?.relations, rowContext);
  const openRelations = relations.filter((row) => !row.closed);
  const closedRelations = relations.filter((row) => row.closed);
  const incoming = incomingRows(overview?.incomingRequests, rowContext);
  const sent = sentRows(overview?.myRequests, rowContext);
  const mentors = mentorRows(catalog, rowContext);
  const profile = overview?.profile || null;

  const parts = homeParts({ t, mentors, catalogFailed, openRelations, closedRelations, incoming, sent, profile });

  const renderView = (step) => {
    switch (step.key) {
      case "relations": {
        const counts = { open: openRelations.length, closed: closedRelations.length };
        const group = pickGroup(relationGroup, ["open", "closed"], counts);
        const labels = {
          open: t("mentoring.home.views.relations.group_open"),
          closed: t("mentoring.home.views.relations.group_closed")
        };
        return (
          <RelationsView
            t={t}
            groups={["open", "closed"].filter((key) => counts[key] > 0).map((key) => ({ value: key, label: labels[key] }))}
            group={group}
            onGroup={setRelationGroup}
            rows={(group === "closed" ? closedRelations : openRelations).map((row) => ({ ...row, href: localizePath(row.href) }))}
            empty={{
              title: t("mentoring.home.empty_title"),
              help: t("mentoring.home.empty_help"),
              note: t("mentoring.home.boundary_note")
            }}
          />
        );
      }
      case "requests": {
        const counts = { incoming: incoming.length, sent: sent.length };
        const group = pickGroup(requestGroup, ["incoming", "sent"], counts);
        const labels = {
          incoming: t("mentoring.home.views.requests.group_incoming"),
          sent: t("mentoring.home.views.requests.group_sent")
        };
        return (
          <RequestsView
            t={t}
            notice={feedback
              ? {
                  text: feedback.text,
                  tone: feedback.tone,
                  href: feedback.relationId ? localizePath(`/mentorlus/suhe/${encodeURIComponent(feedback.relationId)}`) : ""
                }
              : null}
            groups={["incoming", "sent"].filter((key) => counts[key] > 0).map((key) => ({ value: key, label: labels[key] }))}
            group={group}
            onGroup={setRequestGroup}
            incoming={incoming.map((row) => ({
              ...row,
              busy: busyKey === `respond:${row.id}`,
              onAccept: () => respond(row.id, "ACCEPT"),
              declineLabel: confirming === `decline:${row.id}`
                ? t("mentoring.home.views.requests.confirm_decline")
                : t("mentoring.home.decline"),
              onDecline: () => (confirming === `decline:${row.id}` ? respond(row.id, "DECLINE") : armConfirm(`decline:${row.id}`))
            }))}
            sent={sent.map((row) => ({
              ...row,
              busy: busyKey === `cancel:${row.id}`,
              cancelLabel: confirming === `cancel:${row.id}`
                ? t("mentoring.home.views.requests.confirm_cancel")
                : t("mentoring.home.cancel_request"),
              onCancel: () => (confirming === `cancel:${row.id}` ? cancelRequest(row.id) : armConfirm(`cancel:${row.id}`))
            }))}
          />
        );
      }
      case "mentor": {
        const word = profile ? statusWord("profile_status", profile.status, t) : null;
        /* Märgil „võtab taotlusi vastu” on mõte ainult kataloogis nähtaval
           profiilil: mustandi või peatatud profiili kõrval see eksitaks. */
        const active = String(profile?.status || "").toUpperCase() === "ACTIVE";
        const full = String(profile?.capacity || "").toUpperCase() === "FULL";
        return (
          <MentorView
            t={t}
            href={localizePath("/mentorlus/profiil")}
            profile={profile
              ? {
                  name: profile.displayName,
                  chip: word.text,
                  tone: word.tone,
                  capacity: active ? (full ? t("mentoring.capacity.full") : t("mentoring.capacity.open")) : ""
                }
              : null}
          />
        );
      }
      default: {
        const filterItems = [
          { key: "field", label: t("mentoring.home.filter_field"), all: t("mentoring.home.filter_all_field") },
          { key: "topic", label: t("mentoring.home.filter_topic"), all: t("mentoring.home.filter_all_topic") },
          { key: "language", label: t("mentoring.home.filter_language"), all: t("mentoring.home.filter_all_language") }
        ];
        return (
          <FindView
            t={t}
            filters={filterItems
              .filter((item) => facets[item.key].length > 0)
              .map((item) => ({
                key: item.key,
                label: item.label,
                value: filters[item.key],
                options: [{ value: "", label: item.all }, ...facets[item.key].map((value) => ({ value, label: value }))],
                onChange: (value) => void changeFilter(item.key, String(value || ""))
              }))}
            notice={filterNotice}
            failed={catalogFailed}
            onRetry={() => void load()}
            rows={mentors.map((row) => (row.external ? row : { ...row, href: localizePath(row.href) }))}
            emptyText={filterQuery(filters) ? t("mentoring.home.filter_empty") : t("mentoring.home.catalog_empty")}
            capNote={mentors.length >= CATALOG_CAP ? t("mentoring.home.catalog_capped", { count: CATALOG_CAP }) : ""}
          />
        );
      }
    }
  };

  return (
    <EntryShell
      title={t("mentoring.home.title")}
      loadingText={loading ? t("mentoring.labels.loading") : ""}
      error={loadError}
      retryText={t("mentoring.labels.retry")}
      onRetry={() => {
        setLoading(true);
        void load();
      }}
    >
      {!loading && !loadError ? (
        <StepFlight
          label={t("mentoring.home.title")}
          steps={parts}
          startWide
          parts
          texts={{
            all: t("mentoring.home.all_parts"),
            position: (current, total, label) => t("mentoring.labels.part_position", { current, total, label })
          }}
          wideLead={<p className={styles.lead}>{t("mentoring.home.lead")}</p>}
        >
          {renderView}
        </StepFlight>
      ) : null}
    </EntryShell>
  );
}
