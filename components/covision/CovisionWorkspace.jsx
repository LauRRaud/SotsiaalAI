"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { createLatestRequestGate, isAbortError } from "@/lib/client/latestRequestGate";
import CovisionLiveSession from "@/components/covision/CovisionLiveSession";

function message(t, key, fallback) {
  return typeof t === "function" ? t(key, fallback) : fallback;
}

function formatDate(value, locale) {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale || "et", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function readCaseIdFromLocation() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("case")?.trim() || "";
}

function sessionSnapshotFromPayload(payload) {
  if (payload?.snapshot?.session) return payload.snapshot;
  if (payload?.sessionSnapshot?.session) return payload.sessionSnapshot;
  if (payload?.session && payload?.case) return payload;
  return null;
}

export default function CovisionWorkspace() {
  const { locale, t } = useI18n();
  const [workspace, setWorkspace] = useState({ cases: [], seeds: [], capabilities: {} });
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selectedRef = useRef("");
  const actingRef = useRef(false);
  const sessionRequestGateRef = useRef(createLatestRequestGate());
  const actionRequestGateRef = useRef(createLatestRequestGate());
  selectedRef.current = selectedCaseId;
  actingRef.current = acting;

  const apiHeaders = useMemo(() => ({
    Accept: "application/json",
    "x-ui-locale": locale
  }), [locale]);

  const loadWorkspace = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const [casesResponse, seedsResponse] = await Promise.all([
        fetch("/api/covision", { headers: apiHeaders, cache: "no-store" }),
        fetch("/api/topic-seeds", { headers: apiHeaders, cache: "no-store" })
      ]);
      const [casesPayload, seedsPayload] = await Promise.all([
        casesResponse.json().catch(() => ({})),
        seedsResponse.json().catch(() => ({}))
      ]);
      if (!casesResponse.ok) {
        throw Object.assign(new Error("workspace"), { payload: casesPayload });
      }
      if (!seedsResponse.ok) {
        throw Object.assign(new Error("seeds"), { payload: seedsPayload });
      }
      setWorkspace({
        cases: Array.isArray(casesPayload?.cases) ? casesPayload.cases : [],
        seeds: Array.isArray(seedsPayload?.seeds) ? seedsPayload.seeds : [],
        capabilities: casesPayload?.capabilities && typeof casesPayload.capabilities === "object"
          ? casesPayload.capabilities
          : {}
      });
      setError("");
    } catch (requestError) {
      if (!quiet) {
        setError(resolveApiMessage({
          payload: requestError?.payload,
          t,
          fallbackKey: "covision.workspace.errors.load_failed",
          fallbackText: "Kovisiooni tööruumi ei saanud laadida."
        }));
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [apiHeaders, t]);

  const loadSession = useCallback(async (caseId, { quiet = false, allowDuringAction = false } = {}) => {
    const normalizedId = String(caseId || "").trim();
    if (!normalizedId) return null;
    if (quiet && actingRef.current && !allowDuringAction) return null;
    const request = sessionRequestGateRef.current.begin(normalizedId);
    if (!quiet) setSessionLoading(true);
    try {
      const response = await fetch(`/api/covision/${encodeURIComponent(normalizedId)}/session`, {
        headers: apiHeaders,
        cache: "no-store",
        signal: request.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!request.isCurrent() || selectedRef.current !== normalizedId) return null;
      if (!response.ok) {
        if (response.status === 404 && !quiet) {
          selectedRef.current = "";
          setSelectedCaseId("");
          setSnapshot(null);
        }
        throw Object.assign(new Error("session"), { payload, status: response.status });
      }
      const nextSnapshot = sessionSnapshotFromPayload(payload);
      if (!nextSnapshot) throw new Error("invalid_session_snapshot");
      if (!request.isCurrent() || selectedRef.current !== normalizedId) return null;
      setSnapshot(nextSnapshot);
      setError("");
      return nextSnapshot;
    } catch (requestError) {
      if (isAbortError(requestError) || !request.isCurrent() || selectedRef.current !== normalizedId) return null;
      if (!quiet) {
        setError(resolveApiMessage({
          payload: requestError?.payload,
          t,
          fallbackKey: "covision.session.errors.load_failed",
          fallbackText: "Kovisiooni sessiooni ei saanud laadida."
        }));
      }
      return null;
    } finally {
      if (!quiet && request.isCurrent()) setSessionLoading(false);
    }
  }, [apiHeaders, t]);

  useEffect(() => {
    setSelectedCaseId(readCaseIdFromLocation());
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    const onPopState = () => {
      const nextCaseId = readCaseIdFromLocation();
      sessionRequestGateRef.current.invalidate();
      actionRequestGateRef.current.invalidate();
      selectedRef.current = nextCaseId;
      actingRef.current = false;
      setActing(false);
      setSessionLoading(false);
      setError("");
      setNotice("");
      setSnapshot(null);
      setSelectedCaseId(nextCaseId);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!selectedCaseId) {
      sessionRequestGateRef.current.invalidate();
      actionRequestGateRef.current.invalidate();
      setSnapshot(null);
      return undefined;
    }
    loadSession(selectedCaseId);
    const timer = window.setInterval(() => {
      if (!actingRef.current && document.visibilityState === "visible") {
        loadSession(selectedCaseId, { quiet: true });
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [acting, loadSession, selectedCaseId]);

  useEffect(() => () => {
    sessionRequestGateRef.current.invalidate();
    actionRequestGateRef.current.invalidate();
  }, []);

  const openCase = useCallback((caseId) => {
    const id = String(caseId || "").trim();
    if (!id) return;
    sessionRequestGateRef.current.invalidate();
    actionRequestGateRef.current.invalidate();
    selectedRef.current = id;
    actingRef.current = false;
    setActing(false);
    setSessionLoading(false);
    setError("");
    setNotice("");
    setSnapshot(null);
    setSelectedCaseId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("case", id);
    window.history.pushState({}, "", url);
  }, []);

  const closeCase = useCallback(() => {
    sessionRequestGateRef.current.invalidate();
    actionRequestGateRef.current.invalidate();
    selectedRef.current = "";
    actingRef.current = false;
    setActing(false);
    setSessionLoading(false);
    setSelectedCaseId("");
    setSnapshot(null);
    setError("");
    setNotice("");
    const url = new URL(window.location.href);
    url.searchParams.delete("case");
    window.history.pushState({}, "", url);
    loadWorkspace({ quiet: true });
  }, [loadWorkspace]);

  const startFromSeed = useCallback(async (seed) => {
    if (!seed?.id || acting || workspace.capabilities?.canCreate === false) return;
    setActing(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/topic-seeds/${encodeURIComponent(seed.id)}/covision`, {
        method: "POST",
        headers: {
          ...apiHeaders,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ expectedUpdatedAt: seed.updatedAt })
      });
      const payload = await response.json().catch(() => ({}));
      const covisionCaseId = String(payload?.covisionCaseId || payload?.case?.id || "").trim();
      if (!response.ok || !covisionCaseId) {
        setError(resolveApiMessage({
          payload,
          t,
          fallbackKey: "covision.workspace.errors.start_failed",
          fallbackText: "Kovisiooni ei saanud alustada."
        }));
        return;
      }
      await loadWorkspace({ quiet: true });
      openCase(covisionCaseId);
    } catch {
      setError(message(t, "covision.workspace.errors.start_failed", "Kovisiooni ei saanud alustada."));
    } finally {
      setActing(false);
    }
  }, [acting, apiHeaders, loadWorkspace, openCase, t, workspace.capabilities?.canCreate]);

  const runAction = useCallback(async (action, payload = {}) => {
    if (!selectedCaseId || acting) return null;
    const caseId = selectedCaseId;
    sessionRequestGateRef.current.invalidate();
    const request = actionRequestGateRef.current.begin(caseId);
    actingRef.current = true;
    setActing(true);
    setError("");
    setNotice("");
    try {
      const expectedVersion = Number(snapshot?.session?.version ?? 0);
      const response = await fetch(
        `/api/covision/${encodeURIComponent(caseId)}/session/actions`,
        {
          method: "POST",
          headers: {
            ...apiHeaders,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            action,
            expectedVersion,
            payload
          }),
          signal: request.signal
        }
      );
      const result = await response.json().catch(() => ({}));
      if (!request.isCurrent() || selectedRef.current !== caseId) return null;
      if (!response.ok) {
        if (response.status === 409) await loadSession(caseId, { quiet: true, allowDuringAction: true });
        if (!request.isCurrent() || selectedRef.current !== caseId) return null;
        setError(resolveApiMessage({
          payload: result,
          t,
          fallbackKey: "covision.session.errors.action_failed",
          fallbackText: "Toimingut ei saanud salvestada."
        }));
        return null;
      }
      const nextSnapshot = sessionSnapshotFromPayload(result);
      if (nextSnapshot) setSnapshot(nextSnapshot);
      else await loadSession(caseId, { quiet: true, allowDuringAction: true });
      if (!request.isCurrent() || selectedRef.current !== caseId) return null;
      setNotice(message(t, "covision.session.notices.saved", "Salvestatud."));
      return result;
    } catch (requestError) {
      if (isAbortError(requestError) || !request.isCurrent() || selectedRef.current !== caseId) return null;
      setError(message(t, "covision.session.errors.action_failed", "Toimingut ei saanud salvestada."));
      return null;
    } finally {
      if (request.isCurrent()) {
        actingRef.current = false;
        setActing(false);
      }
    }
  }, [acting, apiHeaders, loadSession, selectedCaseId, snapshot?.session?.version, t]);

  const activeCases = useMemo(() => workspace.cases.filter((item) => (
    item?.status !== "closed" && item?.status !== "archived"
  )), [workspace.cases]);
  const waitingSeeds = useMemo(() => workspace.seeds.filter((seed) => (
    seed?.status === "WAITING" && !seed?.covisionCaseId
  )), [workspace.seeds]);
  const canCreate = workspace.capabilities?.canCreate !== false;

  if (selectedCaseId) {
    return (
      <div className="cvw-session-wrap">
        <div className="cvw-session-nav">
          <button type="button" data-variant onClick={closeCase}>
            {message(t, "covision.workspace.back_to_cases", "Tagasi Kovisiooni valikusse")}
          </button>
          {notice ? <p role="status" className="cvw-notice">{notice}</p> : null}
          {error ? <p role="alert" className="cvw-error">{error}</p> : null}
        </div>
        {sessionLoading || !snapshot ? (
          <section className="cvw-state" aria-busy="true">
            <p>{message(t, "covision.session.loading", "Kovisiooni sessioon avaneb…")}</p>
          </section>
        ) : (
          <CovisionLiveSession
            snapshot={snapshot}
            busy={acting}
            onAction={runAction}
            onRefresh={() => loadSession(selectedCaseId)}
          />
        )}
      </div>
    );
  }

  return (
    <main className="cvw" aria-labelledby="cvw-title">
      <header className="cvw-header">
        <div>
          <p className="cvw-kicker">{message(t, "covision.workspace.kicker", "Kinnine professionaalne tööruum")}</p>
          <h1 id="cvw-title">{message(t, "covision.workspace.title", "Kovisioon")}</h1>
          <p>{message(t, "covision.workspace.lead", "Vali aktiivne juhtum või alusta omaniku kinnitatud Teemaseemnest uus Kovisioon.")}</p>
        </div>
        <nav className="cvw-nav" aria-label={message(t, "covision.workspace.navigation", "Kovisiooni põhilehed")}>
          <Link aria-current="page" href="/kovisioon">{message(t, "covision.workspace.nav.new", "Uus Kovisioon")}</Link>
          <Link href="/teemaseemned">{message(t, "covision.workspace.nav.seeds", "Teemaseemned")}</Link>
          <Link href="/lopetatud-juhtumid">{message(t, "covision.workspace.nav.completed", "Lõpetatud juhtumid")}</Link>
          <Link href="/parimad-praktikad">{message(t, "covision.workspace.nav.practices", "Parimad praktikad")}</Link>
        </nav>
      </header>

      {error ? (
        <div className="cvw-error" role="alert">
          <p>{error}</p>
          <button type="button" data-variant onClick={() => loadWorkspace()}>
            {message(t, "common.retry", "Proovi uuesti")}
          </button>
        </div>
      ) : null}

      {loading ? (
        <section className="cvw-state" aria-busy="true">
          <p>{message(t, "covision.workspace.loading", "Kovisiooni tööruum avaneb…")}</p>
        </section>
      ) : (
        <div className="cvw-grid">
          <section className="cvw-panel cvw-active" aria-labelledby="cvw-active-title">
            <header className="cvw-panel-head">
              <div>
                <p className="cvw-panel-kicker">{message(t, "covision.workspace.active.kicker", "Jätka sealt, kus pooleli jäi")}</p>
                <h2 id="cvw-active-title">{message(t, "covision.workspace.active.title", "Aktiivsed Kovisioonid")}</h2>
              </div>
              <span className="cvw-count">{activeCases.length}</span>
            </header>
            {activeCases.length ? (
              <ul className="cvw-card-list">
                {activeCases.map((item) => (
                  <li key={item.id}>
                    <article className="cvw-case-card">
                      <div className="cvw-case-symbol" aria-hidden="true">{String(item.title || "K").slice(0, 1).toUpperCase()}</div>
                      <div className="cvw-case-main">
                        <p className="cvw-case-state">{message(t, `covision.status.${item.status}`, item.status || "")}</p>
                        <h3>{item.title}</h3>
                        <p>{item.centralQuestion || item.summary || message(t, "covision.workspace.active.no_focus", "Tööfookus täpsustub sessioonis.")}</p>
                        <dl>
                          <div>
                            <dt>{message(t, "covision.workspace.active.updated", "Viimati avatud")}</dt>
                            <dd>{formatDate(item.lastActivityAt || item.updatedAt, locale)}</dd>
                          </div>
                          <div>
                            <dt>{message(t, "covision.workspace.active.role", "Minu roll")}</dt>
                            <dd>{message(t, `covision.participant_roles.${item.currentUserRole}`, item.currentUserRole || "owner")}</dd>
                          </div>
                        </dl>
                      </div>
                      <button type="button" data-variant="primary" onClick={() => openCase(item.id)}>
                        {message(t, "covision.workspace.active.open", "Ava Kovisioon")}
                      </button>
                    </article>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="cvw-empty">
                <p>{message(t, "covision.workspace.active.empty", "Sul ei ole praegu aktiivset Kovisiooni.")}</p>
              </div>
            )}
          </section>

          <aside className="cvw-panel cvw-queue" aria-labelledby="cvw-queue-title">
            <header className="cvw-panel-head">
              <div>
                <p className="cvw-panel-kicker">{message(t, "covision.workspace.queue.kicker", "Omaniku kinnitatud üldistused")}</p>
                <h2 id="cvw-queue-title">{message(t, "covision.workspace.queue.title", "Kovisioonijärjekord")}</h2>
              </div>
              <span className="cvw-count">{waitingSeeds.length}</span>
            </header>
            {waitingSeeds.length ? (
              <ul className="cvw-seed-list">
                {waitingSeeds.map((seed) => {
                  const shared = seed.sharedCardSnapshot || {};
                  return (
                    <li key={seed.id}>
                      <article className="cvw-seed-card">
                        <p className="cvw-seed-label">{message(t, "covision.workspace.queue.ready", "Valmis Kovisiooniks")}</p>
                        <h3>{shared.title || seed.title}</h3>
                        <p>{shared.whyNow || seed.whyNow}</p>
                        {canCreate ? (
                          <button
                            type="button"
                            data-variant="primary"
                            disabled={acting}
                            onClick={() => startFromSeed(seed)}
                          >
                            {message(t, "covision.workspace.queue.start", "Loo Kovisioon")}
                          </button>
                        ) : (
                          <p>{message(t, "covision.workspace.queue.invite_only", "Selles rollis saad Kovisiooniga liituda kutse kaudu; uut sessiooni ise käivitada ei saa.")}</p>
                        )}
                      </article>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="cvw-empty">
                <p>{message(t, "covision.workspace.queue.empty", "Järjekorras ei ole veel omaniku kinnitatud Teemaseemneid.")}</p>
                <Link href="/teemaseemned">{message(t, "covision.workspace.queue.open_seeds", "Ava Teemaseemned")}</Link>
              </div>
            )}
            <div className="cvw-privacy-note">
              <span aria-hidden="true">{"⊙"}</span>
              <p>{message(t, "covision.workspace.queue.privacy", "Kovisiooni liigub ainult külmutatud üldistus. Privaatne ettevalmistus jääb Teemaseemne omanikule.")}</p>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
