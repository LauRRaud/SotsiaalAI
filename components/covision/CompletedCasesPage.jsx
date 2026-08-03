"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Dropdown from "@/components/ui/Dropdown";
import Form from "@/components/ui/Form";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { createLatestRequestGate, isAbortError } from "@/lib/client/latestRequestGate";

const FILTERS = Object.freeze([
  ["all", "completed_cases.filters.all"],
  ["FOLLOW_UP_PENDING", "completed_cases.status.follow_up_pending"],
  ["attention", "completed_cases.filters.attention"],
  ["DECISION_PENDING", "completed_cases.status.decision_pending"],
  ["CLOSED", "completed_cases.status.closed"],
  ["CONTINUATION_PENDING", "completed_cases.status.continuation_pending"],
  ["practice", "completed_cases.filters.practice"],
  ["ARCHIVED", "completed_cases.status.archived"]
]);

const FALLBACK_FILTERS = Object.freeze({
  all: "Kõik",
  FOLLOW_UP_PENDING: "Järelvaates",
  attention: "Vajab tähelepanu",
  DECISION_PENDING: "Ootab jätkuotsust",
  CLOSED: "Suletud",
  CONTINUATION_PENDING: "Ootel jätkuks",
  practice: "Praktikakandidaadiga",
  ARCHIVED: "Arhiveeritud"
});

function m(t, key, fallback) {
  return typeof t === "function" ? t(key, fallback) : fallback;
}

function formatDate(value, locale, fallback = "—") {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale || "et", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function statusMeta(item, t) {
  if (item.attentionStatus === "OVERDUE") {
    return { tone: "attention", icon: "△", label: m(t, "completed_cases.attention.overdue", "Järelvaade vajab tähelepanu") };
  }
  if (item.attentionStatus === "DUE_TODAY") {
    return { tone: "attention", icon: "◷", label: m(t, "completed_cases.attention.today", "Järelvaade on täna") };
  }
  if (item.attentionStatus === "DECISION_REQUIRED") {
    return { tone: "decision", icon: "◇", label: m(t, "completed_cases.status.decision_pending", "Järelvaade tehtud · ootab jätkuotsust") };
  }
  const states = {
    FOLLOW_UP_PENDING: ["followup", "◷", "completed_cases.status.follow_up_pending", "Järelvaates"],
    DECISION_PENDING: ["decision", "◇", "completed_cases.status.decision_pending", "Järelvaade tehtud · ootab jätkuotsust"],
    CLOSED: ["closed", "✓", "completed_cases.status.closed", "Suletud"],
    CONTINUATION_PENDING: ["continuation", "↔", "completed_cases.status.continuation_pending", "Ootel jätkuks"],
    ARCHIVED: ["archived", "□", "completed_cases.status.archived", "Arhiveeritud"]
  };
  const [tone, icon, key, fallback] = states[item.lifecycleStatus] || states.FOLLOW_UP_PENDING;
  return { tone, icon, label: m(t, key, fallback) };
}

function roleLabel(role, t) {
  const labels = {
    SOCIAL_WORKER: ["completed_cases.profile.social_worker", "Sotsiaaltöö spetsialist"],
    SERVICE_PROVIDER: ["completed_cases.profile.service_provider", "Teenuseosutaja"],
    ADMIN: ["completed_cases.profile.admin", "Platvormi administraator"]
  };
  const value = labels[role] || ["completed_cases.profile.professional", "Spetsialist"];
  return m(t, value[0], value[1]);
}

function matchesFilter(item, filter) {
  if (filter === "all") return true;
  if (filter === "attention") {
    return ["OVERDUE", "DUE_TODAY", "DECISION_REQUIRED"].includes(item.attentionStatus);
  }
  if (filter === "practice") return item.practiceStatus !== "NONE";
  return item.lifecycleStatus === filter;
}

function useModalFocusTrap(dialogRef) {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const trapFocus = (event) => {
      if (event.key !== "Tab") return;
      const focusable = [...dialog.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter((element) => !element.hasAttribute("hidden"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", trapFocus);
    return () => dialog.removeEventListener("keydown", trapFocus);
  }, [dialogRef]);
}

function Metric({ icon, label, value, tone = "" }) {
  return (
    <div className={`ccp-metric ${tone ? `is-${tone}` : ""}`}>
      <span aria-hidden="true">{icon}</span>
      <div><small>{label}</small><strong>{value}</strong></div>
    </div>
  );
}

function CaseCard({ item, locale, t, onOpen, listMode }) {
  const state = statusMeta(item, t);
  const ownerName = item.owner?.name || m(t, "completed_cases.labels.case_owner", "Juhtumi tooja");
  const followUpText = item.followUp?.scheduleLabel || m(t, "completed_cases.follow_up.unscheduled", "Aeg täpsustub");
  const primary = item.lifecycleStatus === "DECISION_PENDING"
    ? m(t, "completed_cases.actions.decide", "Tee jätkuotsus")
    : item.lifecycleStatus === "CONTINUATION_PENDING"
      ? m(t, "completed_cases.actions.open_continuation", "Ava jätkuteema")
      : item.lifecycleStatus === "CLOSED" || item.lifecycleStatus === "ARCHIVED"
        ? m(t, "completed_cases.actions.view_follow_up", "Vaata järelvaadet")
        : item.attentionStatus === "OVERDUE"
          ? m(t, "completed_cases.actions.do_follow_up", "Tee järelvaade")
          : m(t, "completed_cases.actions.open_follow_up", "Ava järelvaade");

  return (
    <article className={`ccp-case is-${state.tone} ${listMode ? "is-list" : ""}`}>
      <header className="ccp-case-head">
        <div className="ccp-case-symbol" aria-hidden="true">{state.icon}</div>
        <div className="ccp-case-title">
          <h3>{item.generalizedTitle}</h3>
          <p>
            {m(t, "completed_cases.labels.owner", "Juhtumi tooja")}: {ownerName}
            <span aria-hidden="true"> · </span>
            {m(t, "completed_cases.labels.covision", "Kovisioon")}: {formatDate(item.sessionStartedAt || item.closedAt, locale)}
          </p>
          <p className="ccp-focus">{item.workFocus}</p>
        </div>
        <div className={`ccp-status is-${state.tone}`}><span aria-hidden="true">{state.icon}</span>{state.label}</div>
        <small className="ccp-due">{m(t, "completed_cases.labels.follow_up", "Järelvaade")}: {followUpText}</small>
      </header>
      <dl className="ccp-case-facts">
        <div><dt>{m(t, "completed_cases.labels.direction", "Valitud suund")}</dt><dd>{item.selectedDirection}</dd></div>
        <div><dt>{m(t, "completed_cases.labels.next_step", "Järgmine samm")}</dt><dd>{item.nextStep}</dd></div>
        <div><dt>{m(t, "completed_cases.labels.timeframe", "Ajaraam")}</dt><dd>{item.timeframe}</dd></div>
        <div><dt>{m(t, "completed_cases.labels.progress_marker", "Edenemise märk")}</dt><dd>{item.progressMarker}</dd></div>
      </dl>
      <footer className="ccp-case-foot">
        <p className="ccp-package">
          <span aria-hidden="true">⌁</span>
          {item.package?.contentVisible
            ? m(t, "completed_cases.package.mine_confirmed", "Minu Kovisioonipakk · kinnitatud")
            : `${ownerName} · ${m(t, "completed_cases.package.confirmed_private", "Kovisioonipakk kinnitatud · sisu ainult omanikule")}`}
        </p>
        {item.practiceStatus && item.practiceStatus !== "NONE" ? (
          <span className="ccp-practice">◎ {m(t, "completed_cases.practice.private_draft", "Privaatne praktikakandidaat")}</span>
        ) : null}
        <button
          type="button"
          data-variant="primary"
          onClick={(event) => onOpen(item.id, { trigger: event.currentTarget })}
        >
          {primary}
        </button>
      </footer>
    </article>
  );
}

function DetailPanel({ item, t, busy, error, onClose, onMutate }) {
  const dialogRef = useRef(null);
  useModalFocusTrap(dialogRef);
  const [mode, setMode] = useState("summary");
  const [followUp, setFollowUp] = useState({ whatWasDone: "", whatChanged: "", learning: "" });
  const [scheduleLabel, setScheduleLabel] = useState("");
  const [decisionScheduleLabel, setDecisionScheduleLabel] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [closeConfirmed, setCloseConfirmed] = useState(false);
  const [archiveConfirmed, setArchiveConfirmed] = useState(false);
  const state = statusMeta(item, t);
  const canWorkFollowUp = ["OWNER", "FOLLOW_UP_ASSIGNEE"].includes(item.myAccessRole)
    && item.followUp?.status === "SCHEDULED";
  const isOwner = item.myAccessRole === "OWNER";
  const canViewFollowUpDetails = ["OWNER", "FOLLOW_UP_ASSIGNEE"].includes(item.myAccessRole);

  const submitFollowUp = (event) => {
    event.preventDefault();
    onMutate("follow-up", "PATCH", {
      action: "complete",
      whatWasDone: followUp.whatWasDone,
      whatChanged: followUp.whatChanged,
      learning: followUp.learning
    });
  };
  const reschedule = (event) => {
    event.preventDefault();
    onMutate("follow-up", "PATCH", { action: "reschedule", scheduleLabel });
  };
  const decide = (decision, extra = {}) => onMutate("decision", "POST", { decision, ...extra });

  return (
    <div className="ccp-detail-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section
        ref={dialogRef}
        className="ccp-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ccp-detail-title"
      >
        <header className="ccp-detail-head">
          <div><small>{m(t, "completed_cases.detail.read_only", "Suletud Kovisioon · kinnitatud hetktõmmis")}</small><h2 id="ccp-detail-title">{item.generalizedTitle}</h2></div>
          <button type="button" data-variant className="ccp-close" autoFocus onClick={onClose} aria-label={m(t, "common.close", "Sulge")}>×</button>
        </header>
        <nav className="ccp-detail-tabs" aria-label={m(t, "completed_cases.detail.navigation", "Lõpetatud juhtumi osad")}>
          {[
            ["summary", "completed_cases.detail.tabs.summary", "Kokkuvõte"],
            ["followup", "completed_cases.detail.tabs.follow_up", "Järelvaade"],
            ...(isOwner ? [["links", "completed_cases.detail.tabs.links", "Seosed"]] : []),
            ["data", "completed_cases.detail.tabs.data", "Andmed ja säilitamine"]
          ].map(([value, key, fallback]) => (
            <button key={value} type="button" data-variant aria-current={mode === value ? "page" : undefined} onClick={() => setMode(value)}>{m(t, key, fallback)}</button>
          ))}
        </nav>
        {error ? <p className="ccp-inline-error" role="alert">{error}</p> : null}

        <div className="ccp-detail-scroll">
          {mode === "summary" ? (
            <div className="ccp-detail-grid">
              <section className="ccp-detail-hero">
                <div className={`ccp-status is-${state.tone}`}><span aria-hidden="true">{state.icon}</span>{state.label}</div>
                <h3>{m(t, "completed_cases.labels.work_focus", "Tööfookus")}</h3>
                <p>{item.workFocus}</p>
              </section>
              <section><h3>{m(t, "completed_cases.labels.direction", "Valitud suund")}</h3><p>{item.selectedDirection}</p></section>
              <section><h3>{m(t, "completed_cases.labels.next_step", "Järgmine samm")}</h3><p>{item.nextStep}</p><small>{item.timeframe}</small></section>
              <section><h3>{m(t, "completed_cases.labels.progress_marker", "Edenemise märk")}</h3><p>{item.progressMarker}</p></section>
            </div>
          ) : null}

          {mode === "followup" ? (
            <div className="ccp-followup-workspace">
              <section className="ccp-followup-summary">
                <div><small>{m(t, "completed_cases.labels.follow_up", "Järelvaade")}</small><strong>{item.followUp?.scheduleLabel || "—"}</strong></div>
                <div><small>{m(t, "completed_cases.labels.channel", "Kanal")}</small><strong>{item.followUp?.channel || "—"}</strong></div>
                <div><small>{m(t, "completed_cases.labels.responsible", "Vastutaja")}</small><strong>{item.assignedFollowUpUser?.name || item.owner?.name || "—"}</strong></div>
              </section>
              {item.followUps?.filter((entry) => entry.status === "COMPLETED").map((entry, index) => (
                <section className="ccp-followup-result" key={`${entry.completedAt}-${index}`}>
                  <h3>{m(t, "completed_cases.follow_up.completed", "Järelvaade tehtud")}</h3>
                  {canViewFollowUpDetails ? (
                    <dl>
                      <div><dt>{m(t, "completed_cases.follow_up.what_done", "Mida tegelikult tehti")}</dt><dd>{entry.whatWasDone}</dd></div>
                      <div><dt>{m(t, "completed_cases.follow_up.what_changed", "Mis muutus")}</dt><dd>{entry.whatChanged || "—"}</dd></div>
                      <div><dt>{m(t, "completed_cases.follow_up.learning", "Mida sellest õpiti")}</dt><dd>{entry.learning}</dd></div>
                    </dl>
                  ) : (
                    <p>{m(t, "completed_cases.follow_up.detail_private", "Järelvaate refleksioon on nähtav ainult juhtumi omanikule ja määratud järelvaate tegijale.")}</p>
                  )}
                </section>
              ))}
              {canWorkFollowUp ? (
                <div className="ccp-followup-actions">
                  <Form onSubmit={submitFollowUp}>
                    <h3>{m(t, "completed_cases.follow_up.do_now", "Tee järelvaade")}</h3>
                    <label>{m(t, "completed_cases.follow_up.what_done", "Mida tegelikult tehti")}<textarea required rows={3} value={followUp.whatWasDone} onChange={(event) => setFollowUp((current) => ({ ...current, whatWasDone: event.target.value }))} /></label>
                    <label>{m(t, "completed_cases.follow_up.what_changed", "Mis muutus või ei muutunud")}<textarea rows={3} value={followUp.whatChanged} onChange={(event) => setFollowUp((current) => ({ ...current, whatChanged: event.target.value }))} /></label>
                    <label>{m(t, "completed_cases.follow_up.learning", "Mida sellest õppisin")}<textarea required rows={3} value={followUp.learning} onChange={(event) => setFollowUp((current) => ({ ...current, learning: event.target.value }))} /></label>
                    <button type="submit" data-variant="primary" disabled={busy}>{m(t, "completed_cases.actions.confirm_follow_up", "Kinnita järelvaade")}</button>
                  </Form>
                  <Form onSubmit={reschedule}>
                    <h3>{m(t, "completed_cases.follow_up.reschedule", "Määra uus aeg")}</h3>
                    <label>{m(t, "completed_cases.labels.time", "Kuupäev või sündmus")}<input required value={scheduleLabel} onChange={(event) => setScheduleLabel(event.target.value)} placeholder={m(t, "completed_cases.follow_up.schedule_placeholder", "nt 24.08.2026 või järgmise kohtumise alguses")} /></label>
                    <button type="submit" data-variant="quiet" disabled={busy}>{m(t, "completed_cases.actions.reschedule", "Määra uus aeg")}</button>
                  </Form>
                </div>
              ) : null}
              {isOwner && item.lifecycleStatus === "DECISION_PENDING" ? (
                <section className="ccp-decision">
                  <h3>{m(t, "completed_cases.decision.title", "Jätkuotsus")}</h3>
                  <p>{m(t, "completed_cases.decision.lead", "Järelvaade on tehtud. Vali professionaalne järgmine olek — see ei hinda juhtumi edukust.")}</p>
                  <button type="button" data-variant disabled={busy} onClick={() => decide("practice_candidate")}>{m(t, "completed_cases.actions.create_practice", "Loo privaatne praktikakandidaat")}</button>
                  <Form onSubmit={(event) => { event.preventDefault(); decide("continue", { newQuestion }); }}>
                    <label>{m(t, "completed_cases.decision.new_question", "Uus üldistatud küsimus")}<textarea required rows={2} value={newQuestion} onChange={(event) => setNewQuestion(event.target.value)} /></label>
                    <button type="submit" data-variant="quiet" disabled={busy}>{m(t, "completed_cases.actions.create_continuation", "Loo seotud Teemaseeme")}</button>
                  </Form>
                  <Form onSubmit={(event) => { event.preventDefault(); decide("new_follow_up", { scheduleLabel: decisionScheduleLabel }); }}>
                    <label>{m(t, "completed_cases.decision.new_follow_up_time", "Uue järelvaate kuupäev või sündmus")}<input required value={decisionScheduleLabel} onChange={(event) => setDecisionScheduleLabel(event.target.value)} placeholder={m(t, "completed_cases.follow_up.schedule_placeholder", "nt 24.08.2026 või järgmise kohtumise alguses")} /></label>
                    <button type="submit" data-variant="quiet" disabled={busy}>{m(t, "completed_cases.actions.new_follow_up", "Määra uus järelvaade")}</button>
                  </Form>
                  <Form onSubmit={(event) => { event.preventDefault(); decide("close", { reason: closeReason }); }}>
                    <label>{m(t, "completed_cases.decision.close_reason", "Sulgemise professionaalne põhjendus")}<textarea required rows={3} value={closeReason} onChange={(event) => setCloseReason(event.target.value)} /></label>
                    <label className="ccp-confirm-check"><input type="checkbox" required checked={closeConfirmed} onChange={(event) => setCloseConfirmed(event.target.checked)} />{m(t, "completed_cases.decision.close_confirm", "Kinnitan, et järelvaade on läbi vaadatud ja teema sulgemine on teadlik otsus.")}</label>
                    <button type="submit" data-variant="primary" disabled={busy || !closeConfirmed || !closeReason.trim()}>{m(t, "completed_cases.actions.close_topic", "Sulge teema")}</button>
                  </Form>
                </section>
              ) : null}
            </div>
          ) : null}

          {mode === "links" && isOwner ? (
            <div className="ccp-links-panel">
              <section><span aria-hidden="true">◌</span><div><h3>{m(t, "completed_cases.links.source", "Algne Teemaseeme")}</h3><p>{m(t, "completed_cases.links.source_note", "Seos on nähtav ainult omanikule ega ava teistele privaatset ettevalmistust.")}</p></div></section>
              <section><span aria-hidden="true">↔</span><div><h3>{m(t, "completed_cases.links.continuation", "Jätkuteema")}</h3><p>{item.links?.continuationTopicSeed ? m(t, "completed_cases.links.continuation_ready", "Uus seotud Teemaseeme on loodud.") : m(t, "completed_cases.links.continuation_empty", "Jätkuteemat pole loodud.")}</p>{item.links?.continuationTopicSeed ? <Link href="/teemaseemned">{m(t, "completed_cases.actions.open_continuation", "Ava jätkuteema")}</Link> : null}</div></section>
              <section><span aria-hidden="true">◎</span><div><h3>{m(t, "completed_cases.links.practice", "Praktikakandidaat")}</h3><p>{item.practiceStatus === "NONE" ? m(t, "completed_cases.practice.none", "Kandidaati pole loodud.") : m(t, "completed_cases.practice.private_note", "Privaatne mustand ootab eraldi isikustamist ja kontrolli.")}</p>{item.practice?.id ? <Link href={`/parimad-praktikad?practice=${encodeURIComponent(item.practice.id)}`}>{m(t, "completed_cases.actions.open_practice", "Ava privaatne mustand")}</Link> : null}</div></section>
            </div>
          ) : null}

          {mode === "data" ? (
            <div className="ccp-data-panel">
              <section><h3>{m(t, "completed_cases.data.retention", "Säilitamise olek")}</h3><p>{item.retentionStatus === "DELETED" ? m(t, "completed_cases.data.deleted", "Detailne sessioonitöö on kustutatud. Säilib ainult kinnitatud minimaalne kokkuvõte.") : m(t, "completed_cases.data.selected_only", "Säilib ainult kinnitatud minimaalne kokkuvõte ja omaniku valitud pakett.")}</p></section>
              <section><h3>{m(t, "completed_cases.data.package", "Kovisioonipakk")}</h3><p>{item.package?.contentVisible ? m(t, "completed_cases.package.visible_owner", "Selle paki sisu on nähtav ainult sulle.") : m(t, "completed_cases.package.hidden_other", "Näed paki tehnilist olekut, mitte selle sisu.")}</p>{item.package?.content ? <dl>{Object.entries(item.package.content).filter(([, value]) => typeof value === "string").map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{value}</dd></div>)}</dl> : null}</section>
              {isOwner && ["CLOSED", "CONTINUATION_PENDING"].includes(item.lifecycleStatus) ? (
                <section className="ccp-archive-confirm">
                  <label className="ccp-confirm-check"><input type="checkbox" checked={archiveConfirmed} onChange={(event) => setArchiveConfirmed(event.target.checked)} />{m(t, "completed_cases.data.archive_confirm", "Kinnitan, et soovin selle lõpetatud juhtumi aktiivvaatest arhiveerida.")}</label>
                  <button type="button" data-variant="quiet" disabled={busy || !archiveConfirmed} onClick={() => onMutate("archive", "POST", {})}>{m(t, "completed_cases.actions.archive", "Arhiveeri")}</button>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function DetailLoadingDialog({ error, t, onClose, onRetry }) {
  const dialogRef = useRef(null);
  useModalFocusTrap(dialogRef);
  const title = error
    ? m(t, "completed_cases.errors.detail_failed", "Juhtumi kokkuvõtet ei saanud avada.")
    : m(t, "completed_cases.detail.loading", "Kinnitatud kokkuvõte avaneb…");

  return (
    <div className="ccp-detail-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="ccp-detail ccp-detail-loading"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ccp-detail-loading-title"
        aria-busy={!error}
      >
        <button type="button" data-variant className="ccp-close" autoFocus onClick={onClose} aria-label={m(t, "common.close", "Sulge")}>×</button>
        <div>
          <p id="ccp-detail-loading-title" role={error ? "alert" : undefined}>{error || title}</p>
          {error ? <button type="button" data-variant onClick={onRetry}>{m(t, "common.retry", "Proovi uuesti")}</button> : null}
        </div>
      </section>
    </div>
  );
}

export default function CompletedCasesPage({ owner = {} }) {
  const { locale, t } = useI18n();
  const [cases, setCases] = useState([]);
  const [counts, setCounts] = useState({});
  const [scope, setScope] = useState("visible");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("attention");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("cards");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const selectedIdRef = useRef("");
  const listRequestGateRef = useRef(createLatestRequestGate());
  const detailRequestGateRef = useRef(createLatestRequestGate());
  const mutationRequestGateRef = useRef(createLatestRequestGate());
  const detailOpenerRef = useRef(null);

  const apiHeaders = useMemo(() => ({ Accept: "application/json", "x-ui-locale": locale }), [locale]);

  const loadCases = useCallback(async ({ quiet = false } = {}) => {
    const params = new URLSearchParams({ scope, sort });
    if (query.trim()) params.set("q", query.trim());
    if ([...FILTERS].some(([value]) => value === filter) && /^[A-Z_]+$/.test(filter)) params.set("status", filter);
    const request = listRequestGateRef.current.begin(params.toString());
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`/api/covision/completed?${params}`, { headers: apiHeaders, cache: "no-store", signal: request.signal });
      const payload = await response.json().catch(() => ({}));
      if (!request.isCurrent()) return;
      if (!response.ok) throw Object.assign(new Error("load"), { payload });
      setCases(Array.isArray(payload.cases) ? payload.cases : []);
      setCounts(payload.counts || {});
      setError("");
    } catch (requestError) {
      if (isAbortError(requestError) || !request.isCurrent()) return;
      if (!quiet) setError(resolveApiMessage({ payload: requestError?.payload, t, fallbackKey: "completed_cases.errors.load_failed", fallbackText: "Lõpetatud juhtumeid ei saanud laadida." }));
    } finally {
      if (!quiet && request.isCurrent()) setLoading(false);
    }
  }, [apiHeaders, filter, query, scope, sort, t]);

  useEffect(() => {
    const requestGate = listRequestGateRef.current;
    requestGate.invalidate();
    const timer = window.setTimeout(() => loadCases(), 220);
    return () => {
      window.clearTimeout(timer);
      requestGate.invalidate();
    };
  }, [loadCases]);

  const openDetail = useCallback(async (id, { history = "push", trigger = null } = {}) => {
    const normalizedId = String(id || "").trim();
    if (!normalizedId) return;
    if (trigger && typeof trigger.focus === "function") detailOpenerRef.current = trigger;
    mutationRequestGateRef.current.invalidate();
    const request = detailRequestGateRef.current.begin(normalizedId);
    selectedIdRef.current = normalizedId;
    setDetailBusy(false);
    setSelectedId(normalizedId);
    setDetail(null);
    setDetailError("");
    if (history !== "none") {
      const url = new URL(window.location.href);
      url.searchParams.set("case", normalizedId);
      window.history[history === "replace" ? "replaceState" : "pushState"]({}, "", url);
    }
    try {
      const response = await fetch(`/api/covision/completed/${encodeURIComponent(normalizedId)}`, { headers: apiHeaders, cache: "no-store", signal: request.signal });
      const payload = await response.json().catch(() => ({}));
      if (!request.isCurrent() || selectedIdRef.current !== normalizedId) return;
      if (!response.ok) throw Object.assign(new Error("detail"), { payload });
      setDetail(payload.completedCase || null);
    } catch (requestError) {
      if (isAbortError(requestError) || !request.isCurrent() || selectedIdRef.current !== normalizedId) return;
      setDetailError(resolveApiMessage({ payload: requestError?.payload, t, fallbackKey: "completed_cases.errors.detail_failed", fallbackText: "Juhtumi kokkuvõtet ei saanud avada." }));
    }
  }, [apiHeaders, t]);

  useEffect(() => {
    const syncFromLocation = () => {
      const id = new URLSearchParams(window.location.search).get("case");
      if (id) {
        openDetail(id, { history: "none" });
      } else {
        detailRequestGateRef.current.invalidate();
        mutationRequestGateRef.current.invalidate();
        selectedIdRef.current = "";
        setDetailBusy(false);
        setSelectedId("");
        setDetail(null);
        setDetailError("");
      }
    };
    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, [openDetail]);

  const closeDetail = useCallback(({ history = "push" } = {}) => {
    const opener = detailOpenerRef.current;
    detailRequestGateRef.current.invalidate();
    mutationRequestGateRef.current.invalidate();
    selectedIdRef.current = "";
    setDetailBusy(false);
    setSelectedId("");
    setDetail(null);
    setDetailError("");
    if (history !== "none") {
      const url = new URL(window.location.href);
      url.searchParams.delete("case");
      window.history[history === "replace" ? "replaceState" : "pushState"]({}, "", url);
    }
    window.requestAnimationFrame(() => opener?.focus());
  }, []);

  useEffect(() => () => {
    listRequestGateRef.current.invalidate();
    detailRequestGateRef.current.invalidate();
    mutationRequestGateRef.current.invalidate();
  }, []);

  useEffect(() => {
    if (!selectedId) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeDetail();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeDetail, selectedId]);

  const mutate = useCallback(async (action, method, body) => {
    if (!detail?.id || detailBusy) return;
    const detailId = detail.id;
    const request = mutationRequestGateRef.current.begin(detailId);
    setDetailBusy(true);
    setDetailError("");
    try {
      const response = await fetch(`/api/covision/completed/${encodeURIComponent(detailId)}/${action}`, {
        method,
        headers: { ...apiHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: detail.version, ...body }),
        signal: request.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!request.isCurrent() || selectedIdRef.current !== detailId) return;
      if (!response.ok) throw Object.assign(new Error("mutation"), { payload, status: response.status });
      setDetail(payload.completedCase || detail);
      await loadCases({ quiet: true });
    } catch (requestError) {
      if (isAbortError(requestError) || !request.isCurrent() || selectedIdRef.current !== detailId) return;
      setDetailError(resolveApiMessage({ payload: requestError?.payload, t, fallbackKey: "completed_cases.errors.action_failed", fallbackText: "Toimingut ei saanud salvestada." }));
      if (requestError?.status === 409) await openDetail(detailId, { history: "none" });
    } finally {
      if (request.isCurrent()) setDetailBusy(false);
    }
  }, [apiHeaders, detail, detailBusy, loadCases, openDetail, t]);

  const visibleCases = useMemo(() => cases.filter((item) => matchesFilter(item, filter)), [cases, filter]);
  const attentionCases = useMemo(() => cases.filter((item) => ["OVERDUE", "DUE_TODAY", "DECISION_REQUIRED"].includes(item.attentionStatus)).slice(0, 4), [cases]);
  const followUpDates = useMemo(() => cases.filter((item) => item.followUp?.scheduleLabel).slice(0, 5), [cases]);

  return (
    <main className="ccp-shell" aria-labelledby="ccp-title">
      <header className="ccp-top">
        <div className="ccp-brand">
          <button
            type="button"
            className="ccp-exit"
            title={m(t, "topic_seeds.nav.exit_title", "Tagasi ruumi")}
            onClick={() => window.history.back()}
          >
            {m(t, "topic_seeds.nav.exit", "← Välju")}
          </button>
          <p className="ccp-brand-name">{m(t, "completed_cases.title", "Lõpetatud juhtumid")}</p>
        </div>
        <nav className="ccp-nav" aria-label={m(t, "completed_cases.navigation", "Kovisiooni põhilehed")}>
          <Link className="ccp-nav-link" href="/kovisioon">{m(t, "topic_seeds.nav.covision_room", "Kovisiooni ruum")}</Link>
          <Link className="ccp-nav-link" href="/teemaseemned">{m(t, "covision.workspace.nav.seeds", "Teemaseemned")}</Link>
          <span className="ccp-nav-link" aria-current="page" data-active="1">{m(t, "covision.workspace.nav.completed", "Lõpetatud juhtumid")}</span>
          <Link className="ccp-nav-link" href="/parimad-praktikad">{m(t, "covision.workspace.nav.practices", "Parimad praktikad")}</Link>
        </nav>
        <div className="ccp-tools">
          <button type="button" data-variant aria-expanded={helpOpen} aria-controls="ccp-help-panel" onClick={() => setHelpOpen((current) => !current)}>
            {m(t, "completed_cases.help.title", "Abi")}
          </button>
          <div className="ccp-user">
            <span className="ccp-user-name">{owner.name || m(t, "completed_cases.profile.you", "Sina")}</span>
            <span className="ccp-user-title">{roleLabel(owner.role, t)}</span>
          </div>
        </div>
      </header>

      <div className="ccp-main">
        <header className="ccp-header">
          <div><h1 id="ccp-title">{m(t, "completed_cases.title", "Lõpetatud juhtumid")}</h1><p>{m(t, "completed_cases.lead", "Siin on Kovisioonid, mille aktiivne töö on lõpetatud. Järgmine samm või järelvaade võib veel olla pooleli.")}</p></div>
          <div className="ccp-scope" role="group" aria-label={m(t, "completed_cases.scope.title", "Minu vaated")}>
            <small>{m(t, "completed_cases.scope.title", "Minu vaated")}</small>
            {[
              ["mine", "completed_cases.scope.mine", "Minu juhtumid"],
              ["group", "completed_cases.scope.group", "Minu grupi juhtumid"],
              ["visible", "completed_cases.scope.visible", "Kõik nähtavad"]
            ].map(([value, key, fallback]) => <button key={value} type="button" data-variant aria-pressed={scope === value} onClick={() => setScope(value)}>{m(t, key, fallback)}</button>)}
          </div>
        </header>

        {helpOpen ? <section className="ccp-help" id="ccp-help-panel"><strong>{m(t, "completed_cases.help.title", "Abi")}</strong><p>{m(t, "completed_cases.help.text", "Lõpetatud tähendab, et Kovisiooni protsess on lõppenud — mitte seda, et inimese olukord on kindlasti lahendatud.")}</p></section> : null}

        <section className="ccp-metrics" aria-label={m(t, "completed_cases.metrics.title", "Juhtumite ülevaade")}>
          <Metric icon="◷" label={m(t, "completed_cases.status.follow_up_pending", "Järelvaates")} value={counts.followUp || 0} />
          <Metric icon="△" label={m(t, "completed_cases.filters.attention", "Vajab tähelepanu")} value={counts.attention || 0} tone="attention" />
          <Metric icon="✓" label={m(t, "completed_cases.status.closed", "Suletud")} value={counts.closed || 0} tone="closed" />
          <Metric icon="◎" label={m(t, "completed_cases.filters.practice", "Praktikakandidaadiga")} value={counts.practice || 0} />
          <Metric icon="↔" label={m(t, "completed_cases.status.continuation_pending", "Ootel jätkuks")} value={counts.continuation || 0} />
        </section>

        <div className="ccp-layout">
          <section className="ccp-content">
            <div className="ccp-toolbar">
              <label className="ccp-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label={m(t, "completed_cases.search", "Otsi pealkirja, märksõna või juhtumi tooja järgi…")} placeholder={m(t, "completed_cases.search", "Otsi pealkirja, märksõna või juhtumi tooja järgi…")} /></label>
              <Dropdown
                value={sort}
                onChange={setSort}
                ariaLabel={m(t, "completed_cases.sort.title", "Sortimine")}
                options={[
                  { value: "attention", label: m(t, "completed_cases.sort.attention", "Tähelepanu vajavad ees") },
                  { value: "follow_up", label: m(t, "completed_cases.sort.follow_up", "Lähim järelvaade") },
                  { value: "newest", label: m(t, "completed_cases.sort.newest", "Uusim Kovisioon") },
                  { value: "oldest", label: m(t, "completed_cases.sort.oldest", "Vanim Kovisioon") },
                  { value: "title", label: m(t, "completed_cases.sort.title_alpha", "Pealkiri") }
                ]}
              />
              <div className="ccp-view-switch" aria-label={m(t, "completed_cases.view.title", "Vaade")}><button type="button" data-variant aria-pressed={view === "cards"} onClick={() => setView("cards")}>▦ {m(t, "completed_cases.view.cards", "Kaardivaade")}</button><button type="button" data-variant aria-pressed={view === "list"} onClick={() => setView("list")}>☷ {m(t, "completed_cases.view.list", "Nimekirjavaade")}</button></div>
            </div>
            <div className="ccp-filters" aria-label={m(t, "completed_cases.filters.title", "Olekufiltrid")}>
              {FILTERS.map(([value, key]) => <button key={value} type="button" data-variant aria-pressed={filter === value} onClick={() => setFilter(value)}>{m(t, key, FALLBACK_FILTERS[value])}</button>)}
            </div>
            <p className="ccp-result-count">{m(t, "completed_cases.results", "Kuvatakse")} {visibleCases.length} / {cases.length}</p>
            {error ? <section className="ccp-state is-error" role="alert"><p>{error}</p><button type="button" data-variant onClick={() => loadCases()}>{m(t, "common.retry", "Proovi uuesti")}</button></section> : null}
            {loading ? <section className="ccp-state" aria-busy="true"><p>{m(t, "completed_cases.loading", "Lõpetatud juhtumid avanevad…")}</p></section> : null}
            {!loading && !error && !visibleCases.length ? <section className="ccp-state"><p>{m(t, "completed_cases.empty", "Selles vaates pole veel lõpetatud Kovisioone.")}</p><Link href="/kovisioon">{m(t, "completed_cases.actions.open_covision", "Ava Kovisioon")}</Link></section> : null}
            {!loading && visibleCases.length ? <div className={`ccp-case-list is-${view}`}>{visibleCases.map((item) => <CaseCard key={item.id} item={item} locale={locale} t={t} listMode={view === "list"} onOpen={openDetail} />)}</div> : null}
          </section>

          <aside className="ccp-rail">
            <section className="ccp-attention-panel"><header><h2>{m(t, "completed_cases.attention.title", "Vajab tähelepanu")}</h2><span>{attentionCases.length}</span></header>{attentionCases.length ? <ul>{attentionCases.map((item) => <li key={item.id}><button type="button" onClick={(event) => openDetail(item.id, { trigger: event.currentTarget })}><span aria-hidden="true">△</span><div><strong>{item.generalizedTitle}</strong><small>{statusMeta(item, t).label}</small></div></button></li>)}</ul> : <p>{m(t, "completed_cases.attention.empty", "Praegu pole kiiret järelvaadet ega jätkuotsust.")}</p>}</section>
            <section className="ccp-calendar"><header><h2>{m(t, "completed_cases.calendar.title", "Järelvaadete kalender")}</h2><span aria-hidden="true">◷</span></header><ol>{followUpDates.map((item) => <li key={item.id}><time dateTime={item.followUp?.scheduledFor || undefined}>{item.followUp?.scheduleLabel}</time><button type="button" onClick={(event) => openDetail(item.id, { trigger: event.currentTarget })}>{item.generalizedTitle}</button></li>)}</ol>{!followUpDates.length ? <p>{m(t, "completed_cases.calendar.empty", "Järelvaadete kuupäevi pole veel määratud.")}</p> : null}</section>
            <section className="ccp-quick"><h2>{m(t, "completed_cases.quick.title", "Kiirlingid")}</h2><Link href="/kovisioon">＋ {m(t, "covision.workspace.nav.new", "Uus Kovisioon")}</Link><Link href="/teemaseemned">◇ {m(t, "completed_cases.quick.seeds", "Mine Teemaseemnetesse")}</Link><Link href="/parimad-praktikad">◎ {m(t, "completed_cases.quick.practices", "Mine praktikakogusse")}</Link></section>
            <Link className="ccp-privacy" href="/privaatsustingimused"><span aria-hidden="true">⌁</span>{m(t, "completed_cases.privacy", "Privaatsus ja andmekaitse")}</Link>
          </aside>
        </div>
      </div>

      {selectedId ? detail
        ? <DetailPanel item={detail} t={t} busy={detailBusy} error={detailError} onClose={closeDetail} onMutate={mutate} />
        : <DetailLoadingDialog error={detailError} t={t} onClose={closeDetail} onRetry={() => openDetail(selectedIdRef.current, { history: "none" })} />
        : null}
    </main>
  );
}
