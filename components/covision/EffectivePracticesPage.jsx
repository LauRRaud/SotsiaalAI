"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { createLatestRequestGate, isAbortError } from "@/lib/client/latestRequestGate";
import {
  applyEffectivePracticeView,
  EFFECTIVE_PRACTICE_HISTORY_KEY,
  effectivePracticeViewKey,
  parseEffectivePracticeView
} from "@/lib/client/effectivePracticeView";

const EMPTY_WORKSPACE = Object.freeze({
  profile: { professionalRole: "", capabilities: [] },
  capabilities: { canCreate: false, canReview: false, types: [] },
  practices: [],
  candidates: [],
  myApplications: [],
  reviewQueue: [],
  applicationQueue: []
});

const EMPTY_DRAFT = Object.freeze({
  title: "",
  summary: "",
  background: "",
  mainChallenge: "",
  whatHelped: "",
  networkOrServiceRole: "",
  outcome: "",
  learningPoints: "",
  sources: "",
  suitableContext: "",
  conditions: "",
  limitations: "",
  steps: "",
  practiceType: "",
  targetGroups: "",
  environments: "",
  maturityLevel: "practice_candidate",
  riskLevel: "LOW",
  topics: "",
  ownerConfirmedNoIdentifiers: false
});

const EMPTY_APPLICATION = Object.freeze({
  context: "",
  targetGroup: "",
  adaptations: "",
  whatWorked: "",
  whatDidNot: "",
  limitationOrRisk: "",
  followUpAt: "",
  needsReview: false
});

function m(t, key, fallback, vars) {
  return typeof t === "function" ? t(key, vars || {}, fallback) : fallback;
}

function splitList(value) {
  return String(value || "").split(/[\n,;]/).map((item) => item.trim()).filter(Boolean);
}

function joinList(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function formatDate(value, locale) {
  if (value == null || value === "") return "—";
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale || "et", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function useModalFocusTrap(dialogRef) {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const onKeyDown = (event) => {
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
    dialog.addEventListener("keydown", onKeyDown);
    return () => dialog.removeEventListener("keydown", onKeyDown);
  }, [dialogRef]);
}

function writeEffectivePracticeView(view, { history = "push", parentView = { kind: "list", id: "" } } = {}) {
  const currentUrl = new URL(window.location.href);
  const nextUrl = applyEffectivePracticeView(currentUrl, view);
  if (`${nextUrl.pathname}${nextUrl.search}` === `${currentUrl.pathname}${currentUrl.search}`) return false;
  const method = history === "replace" ? "replaceState" : "pushState";
  window.history[method]({
    ...(window.history.state || {}),
    [EFFECTIVE_PRACTICE_HISTORY_KEY]: {
      view: effectivePracticeViewKey(view),
      parent: effectivePracticeViewKey(parentView)
    }
  }, "", nextUrl);
  return true;
}

function canReturnToEffectivePracticeView(currentView, targetView) {
  const marker = window.history.state?.[EFFECTIVE_PRACTICE_HISTORY_KEY];
  return marker?.view === effectivePracticeViewKey(currentView)
    && marker?.parent === effectivePracticeViewKey(targetView);
}

function LoadingDialog({ error, t, onClose, onRetry }) {
  const dialogRef = useRef(null);
  useModalFocusTrap(dialogRef);
  const label = m(t, "effective_practices.detail_loading", "Praktika avaneb…");
  return (
    <div className="epp-dialog-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="epp-dialog epp-state"
        role="dialog"
        aria-modal="true"
        aria-labelledby="epp-loading-title"
        aria-busy={!error}
      >
        <header><h2 id="epp-loading-title">{label}</h2><button type="button" autoFocus onClick={onClose} aria-label={m(t, "common.close", "Sulge")}>×</button></header>
        {error ? <><p role="alert">{error}</p><button type="button" onClick={onRetry}>{m(t, "common.retry", "Proovi uuesti")}</button></> : <><div className="epp-loader" /><p>{label}</p></>}
      </section>
    </div>
  );
}

function roleLabel(role, t) {
  const key = {
    SOCIAL_WORKER: ["effective_practices.profile.social_worker", "Sotsiaaltöö spetsialist"],
    SERVICE_PROVIDER: ["effective_practices.profile.service_provider", "Teenuseosutaja"],
    ADMIN: ["effective_practices.profile.admin", "Platvormi administraator"]
  }[role] || ["effective_practices.profile.professional", "Spetsialist"];
  return m(t, key[0], key[1]);
}

function statusLabel(status, t) {
  const key = {
    DRAFT: ["effective_practices.status.draft", "Privaatne mustand"],
    WAITING_FOR_REVIEW: ["effective_practices.status.waiting", "Ootab retsensendi määramist"],
    SUBMITTED: ["effective_practices.status.submitted", "Esitatud ülevaatamiseks"],
    IN_REVIEW: ["effective_practices.status.in_review", "Retsenseerimisel"],
    NEEDS_CHANGES: ["effective_practices.status.needs_changes", "Vajab täiendamist"],
    READY_TO_PUBLISH: ["effective_practices.status.ready", "Kinnitamiseks valmis"],
    PUBLISHED: ["effective_practices.status.published", "Kinnitatud praktika"],
    RE_REVIEW: ["effective_practices.status.re_review", "Uuesti ülevaatamisel"],
    ACCEPTED: ["effective_practices.status.accepted", "Üle vaadatud ja vastu võetud"],
    REJECTED: ["effective_practices.status.rejected", "Tagasi lükatud"],
    ARCHIVED: ["effective_practices.status.archived", "Arhiveeritud"]
  }[status] || ["effective_practices.status.candidate", "Praktikakandidaat"];
  return m(t, key[0], key[1]);
}

function capabilityLabel(type, t) {
  const key = {
    REVIEWER: ["effective_practices.capability.reviewer", "Valdkondlik retsensent"],
    ETHICS: ["effective_practices.capability.ethics", "Eetika ja privaatsuse kontrollija"],
    EDITOR: ["effective_practices.capability.editor", "Metoodiline toimetaja"],
    APPROVER: ["effective_practices.capability.approver", "Lõplik kinnitaja"]
  }[type] || ["effective_practices.capability.professional", "Professionaalne ülevaataja"];
  return m(t, key[0], key[1]);
}

function PracticeCard({ practice, t, locale, onOpen }) {
  return (
    <article className="epp-card">
      <header>
        <div className="epp-bookmark" aria-hidden="true">⌑</div>
        <div className="epp-card-heading">
          <span className="epp-eyebrow">{practice.practiceType || m(t, "effective_practices.labels.professional_method", "Professionaalne tööviis")}</span>
          <h2>{practice.title}</h2>
        </div>
        <span className="epp-maturity">{statusLabel(practice.status, t)}</span>
      </header>
      {practice.reviewOverdue ? <p className="epp-inline-error" role="status">{m(t, "effective_practices.labels.review_overdue", "Uue professionaalse ülevaatuse tähtaeg on möödunud.")}</p> : null}
      <p className="epp-summary">{practice.summary}</p>
      <div className="epp-context-pair">
        <section><small>{m(t, "effective_practices.labels.suitable", "Sobib, kui")}</small><p>{practice.suitableContext}</p></section>
        <section className="is-limit"><small>{m(t, "effective_practices.labels.limitation", "Oluline piirang")}</small><p>{practice.limitations}</p></section>
      </div>
      <div className="epp-condition-line"><span>{m(t, "effective_practices.labels.conditions", "Tingimused")}</span><p>{(practice.conditions || []).slice(0, 3).join(" · ") || "—"}</p></div>
      <footer>
        <div className="epp-evidence">
          <span>▤ {m(t, "effective_practices.labels.applications", "{count} rakendamiskogemust", { count: practice.applicationCount || 0 })}</span>
          <span>↻ {m(t, "effective_practices.labels.followups", "{count} järelvaadet", { count: practice.followUpCount || 0 })}</span>
        </div>
        <div className="epp-version">
          <span>{m(t, "effective_practices.labels.version", "Versioon")} {practice.version}</span>
          <span>{m(t, "effective_practices.labels.updated", "Viimati uuendatud")}: {formatDate(practice.updatedAt, locale)}</span>
          <span>{m(t, "effective_practices.labels.reviewed", "Professionaalselt üle vaadatud")}: {formatDate(practice.professionalReviewedAt, locale)}</span>
        </div>
        <button type="button" onClick={(event) => onOpen(practice.id, { trigger: event.currentTarget })}>{m(t, "effective_practices.actions.open", "Ava praktika")} <span aria-hidden="true">→</span></button>
      </footer>
    </article>
  );
}

function CandidateCard({ candidate, t, locale, onOpen, review = false }) {
  return (
    <article className={`epp-candidate ${review ? "is-review" : ""}`}>
      <header><span>◎</span><div><small>{review ? m(t, "effective_practices.labels.review_task", "Ülevaatuse ülesanne") : statusLabel(candidate.status, t)}</small><h2>{candidate.title}</h2></div></header>
      <p>{candidate.summary || m(t, "effective_practices.labels.summary_missing", "Lühikokkuvõte vajab täiendamist.")}</p>
      <dl>
        <div><dt>{m(t, "effective_practices.labels.risk", "Riskitase")}</dt><dd>{candidate.riskLevel === "HIGH" ? m(t, "effective_practices.risk.high", "Kõrgem risk") : m(t, "effective_practices.risk.low", "Madalam risk")}</dd></div>
        <div><dt>{m(t, "effective_practices.labels.identifiers", "Isikustamine")}</dt><dd>{candidate.identifiersConfirmed ? m(t, "effective_practices.labels.confirmed", "Autori kontroll kinnitatud") : m(t, "effective_practices.labels.unconfirmed", "Kontrollimata")}</dd></div>
        <div><dt>{m(t, "effective_practices.labels.modified", "Viimati muudetud")}</dt><dd>{formatDate(candidate.updatedAt, locale)}</dd></div>
      </dl>
      <button type="button" onClick={(event) => onOpen(candidate.id, { trigger: event.currentTarget })}>{review ? m(t, "effective_practices.actions.review", "Ava ülevaatamiseks") : m(t, "effective_practices.actions.open_draft", "Ava mustand")}</button>
    </article>
  );
}

function ApplicationReviewCard({ application, types, t, busy, onReview }) {
  const eligible = types.filter((item) => (
    item === application.assignedCapabilityType && ["REVIEWER", "ETHICS", "EDITOR"].includes(item)
  ));
  const [capabilityType, setCapabilityType] = useState(eligible[0] || "REVIEWER");
  const [action, setAction] = useState("ACCEPTED");
  const [reviewNote, setReviewNote] = useState("");
  return (
    <article className="epp-application-review">
      <header><span aria-hidden="true">↻</span><div><small>{m(t, "effective_practices.application.review_task", "Rakendamiskogemuse ülevaatus")}</small><h2>{application.practice.title}</h2></div></header>
      <dl><div><dt>{m(t, "effective_practices.application.context", "Kasutamise kontekst")}</dt><dd>{application.context}</dd></div><div><dt>{m(t, "effective_practices.application.target", "Sihtrühm")}</dt><dd>{application.targetGroup}</dd></div><div><dt>{m(t, "effective_practices.application.adaptations", "Kohandused")}</dt><dd>{application.adaptations}</dd></div><div><dt>{m(t, "effective_practices.application.worked", "Mis toimis")}</dt><dd>{application.whatWorked}</dd></div><div><dt>{m(t, "effective_practices.application.not_worked", "Mis ei toiminud")}</dt><dd>{application.whatDidNot}</dd></div><div><dt>{m(t, "effective_practices.application.limitation", "Piirang või risk")}</dt><dd>{application.limitationOrRisk}</dd></div><div><dt>{m(t, "effective_practices.application.follow_up", "Järelvaate aeg")}</dt><dd>{formatDate(application.followUpAt)}</dd></div><div><dt>{m(t, "effective_practices.application.needs_review", "Uus risk või ülevaatuse vajadus")}</dt><dd>{application.needsReview ? m(t, "common.yes", "Jah") : m(t, "common.no", "Ei")}</dd></div></dl>
      <div className="epp-application-review-controls">
        <label>{m(t, "effective_practices.review.role", "Ülevaatuse roll")}<select value={capabilityType} onChange={(event) => setCapabilityType(event.target.value)}>{eligible.map((item) => <option key={item} value={item}>{capabilityLabel(item, t)}</option>)}</select></label>
        <label>{m(t, "effective_practices.review.decision", "Otsus")}<select value={action} onChange={(event) => setAction(event.target.value)}><option value="ACCEPTED">{m(t, "effective_practices.application.accept", "Sobib dokumenteeritud kogemuseks")}</option><option value="NEEDS_CHANGES">{m(t, "effective_practices.review.changes", "Vajab täiendamist")}</option><option value="REJECTED">{m(t, "effective_practices.application.reject", "Ei sobi avaldamiseks")}</option></select></label>
        <label>{m(t, "effective_practices.application.review_note", "Tagasiside lisajale")}<textarea rows={2} required={action !== "ACCEPTED"} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} /></label>
        <button type="button" disabled={busy || !eligible.length} onClick={() => onReview(application.id, { expectedVersion: application.version, action, capabilityType, reviewNote })}>{m(t, "effective_practices.actions.save_review", "Salvesta ülevaatus")}</button>
      </div>
    </article>
  );
}

function OwnApplicationCard({ application, t, locale, busy, onResubmit }) {
  const [value, setValue] = useState(() => ({
    context: application.context || "",
    targetGroup: application.targetGroup || "",
    adaptations: application.adaptations || "",
    whatWorked: application.whatWorked || "",
    whatDidNot: application.whatDidNot || "",
    limitationOrRisk: application.limitationOrRisk || "",
    followUpAt: application.followUpAt ? String(application.followUpAt).slice(0, 10) : "",
    needsReview: Boolean(application.needsReview)
  }));
  const set = (field, next) => setValue((current) => ({ ...current, [field]: next }));
  const editable = application.status === "NEEDS_CHANGES";
  return (
    <article className="epp-own-application">
      <header><span aria-hidden="true">↻</span><div><small>{m(t, "effective_practices.application.my_experience", "Minu rakendamiskogemus")}</small><h2>{application.practice.title}</h2></div><strong>{statusLabel(application.status, t)}</strong></header>
      {application.reviewNote ? <p className="epp-application-feedback"><strong>{m(t, "effective_practices.application.reviewer_feedback", "Retsensendi tagasiside")}</strong>{application.reviewNote}</p> : null}
      {editable ? <form className="epp-application" onSubmit={(event) => { event.preventDefault(); onResubmit(application.id, { action: "RESUBMIT", expectedVersion: application.version, ...value }); }}>
        <label>{m(t, "effective_practices.application.context", "Kasutamise kontekst")}<textarea required rows={2} value={value.context} onChange={(event) => set("context", event.target.value)} /></label>
        <label>{m(t, "effective_practices.application.target", "Sihtrühm")}<input required value={value.targetGroup} onChange={(event) => set("targetGroup", event.target.value)} /></label>
        <label>{m(t, "effective_practices.application.adaptations", "Mida kohandasin")}<textarea required rows={2} value={value.adaptations} onChange={(event) => set("adaptations", event.target.value)} /></label>
        <label>{m(t, "effective_practices.application.worked", "Mis toimis")}<textarea required rows={2} value={value.whatWorked} onChange={(event) => set("whatWorked", event.target.value)} /></label>
        <label>{m(t, "effective_practices.application.not_worked", "Mis ei toiminud")}<textarea required rows={2} value={value.whatDidNot} onChange={(event) => set("whatDidNot", event.target.value)} /></label>
        <label>{m(t, "effective_practices.application.limitation", "Ilmnenud piirang või risk")}<textarea required rows={2} value={value.limitationOrRisk} onChange={(event) => set("limitationOrRisk", event.target.value)} /></label>
        <label>{m(t, "effective_practices.application.follow_up", "Järelvaate aeg")}<input type="date" required value={value.followUpAt} onChange={(event) => set("followUpAt", event.target.value)} /></label>
        <label className="epp-confirm"><input type="checkbox" checked={value.needsReview} onChange={(event) => set("needsReview", event.target.checked)} /><span>{m(t, "effective_practices.application.needs_review", "Kogemus toob esile uue riski või vajaduse praktika uuesti üle vaadata.")}</span></label>
        <button type="submit" disabled={busy}>{m(t, "effective_practices.application.resubmit", "Saada täiendatud kogemus uuesti")}</button>
      </form> : <dl><div><dt>{m(t, "effective_practices.labels.modified", "Viimati muudetud")}</dt><dd>{formatDate(application.updatedAt, locale)}</dd></div><div><dt>{m(t, "effective_practices.application.follow_up", "Järelvaate aeg")}</dt><dd>{formatDate(application.followUpAt, locale)}</dd></div></dl>}
    </article>
  );
}

function CandidateEditor({ initial, t, busy, error, onCancel, onSave }) {
  const dialogRef = useRef(null);
  useModalFocusTrap(dialogRef);
  const [draft, setDraft] = useState(() => initial ? {
    title: initial.title || "",
    summary: initial.summary || "",
    background: initial.background || "",
    mainChallenge: initial.mainChallenge || "",
    whatHelped: initial.whatHelped || "",
    networkOrServiceRole: initial.networkOrServiceRole || "",
    outcome: initial.outcome || "",
    learningPoints: initial.learningPoints || "",
    sources: initial.sources || "",
    suitableContext: initial.suitableContext || "",
    conditions: joinList(initial.conditions),
    limitations: initial.limitations || "",
    steps: joinList(initial.steps),
    practiceType: initial.practiceType || "",
    targetGroups: joinList(initial.targetGroups),
    environments: joinList(initial.environments),
    maturityLevel: initial.maturityLevel || "practice_candidate",
    riskLevel: initial.riskLevel || "LOW",
    topics: joinList(initial.topics),
    ownerConfirmedNoIdentifiers: Boolean(initial.identifiersConfirmed)
  } : { ...EMPTY_DRAFT });
  const set = (field, value) => setDraft((current) => ({
    ...current,
    [field]: value,
    ...(field === "ownerConfirmedNoIdentifiers" ? {} : { ownerConfirmedNoIdentifiers: false })
  }));
  const submit = (event) => {
    event.preventDefault();
    onSave({
      ...draft,
      conditions: splitList(draft.conditions),
      steps: splitList(draft.steps),
      targetGroups: splitList(draft.targetGroups),
      environments: splitList(draft.environments),
      topics: splitList(draft.topics)
    });
  };
  return (
    <form ref={dialogRef} className="epp-editor" onSubmit={submit}>
      <header><div><small>{m(t, "effective_practices.editor.private", "Privaatne praktikakandidaat")}</small><h2 id="epp-editor-title">{initial ? m(t, "effective_practices.editor.edit", "Täienda kandidaati") : m(t, "effective_practices.editor.create", "Loo praktikakandidaat")}</h2></div><button type="button" autoFocus onClick={onCancel} aria-label={m(t, "common.close", "Sulge")}>×</button></header>
      {error ? <p className="epp-inline-error" role="alert">{error}</p> : null}
      <div className="epp-form-grid">
        <label className="is-wide">{m(t, "effective_practices.fields.title", "Pealkiri")}<input required maxLength={180} value={draft.title} onChange={(event) => set("title", event.target.value)} /></label>
        <label className="is-wide">{m(t, "effective_practices.fields.summary", "Lühikokkuvõte")}<textarea required rows={3} value={draft.summary} onChange={(event) => set("summary", event.target.value)} /></label>
        <label>{m(t, "effective_practices.fields.type", "Praktika tüüp")}<input value={draft.practiceType} onChange={(event) => set("practiceType", event.target.value)} /></label>
        <label>{m(t, "effective_practices.fields.risk", "Riskitase")}<select value={draft.riskLevel} onChange={(event) => set("riskLevel", event.target.value)}><option value="LOW">{m(t, "effective_practices.risk.low", "Madalam risk")}</option><option value="HIGH">{m(t, "effective_practices.risk.high", "Kõrgem risk")}</option></select></label>
        <label className="is-wide">{m(t, "effective_practices.fields.context", "Sobiv kontekst")}<textarea required rows={3} value={draft.suitableContext} onChange={(event) => set("suitableContext", event.target.value)} /></label>
        <label>{m(t, "effective_practices.fields.conditions", "Vajalikud tingimused")}<textarea required rows={5} value={draft.conditions} onChange={(event) => set("conditions", event.target.value)} placeholder={m(t, "effective_practices.editor.one_per_line", "Üks tingimus reale")} /></label>
        <label>{m(t, "effective_practices.fields.steps", "Rakendamissammud")}<textarea required rows={5} value={draft.steps} onChange={(event) => set("steps", event.target.value)} placeholder={m(t, "effective_practices.editor.one_per_line", "Üks samm reale")} /></label>
        <label className="is-wide">{m(t, "effective_practices.fields.limitations", "Oluline piirang või risk")}<textarea required rows={3} value={draft.limitations} onChange={(event) => set("limitations", event.target.value)} /></label>
        <label>{m(t, "effective_practices.fields.background", "Üldistatud taust")}<textarea rows={3} value={draft.background} onChange={(event) => set("background", event.target.value)} /></label>
        <label>{m(t, "effective_practices.fields.challenge", "Peamine professionaalne väljakutse")}<textarea rows={3} value={draft.mainChallenge} onChange={(event) => set("mainChallenge", event.target.value)} /></label>
        <label>{m(t, "effective_practices.fields.what_helped", "Mis aitas")}<textarea rows={3} value={draft.whatHelped} onChange={(event) => set("whatHelped", event.target.value)} /></label>
        <label>{m(t, "effective_practices.fields.network_role", "Võrgustiku või teenuse roll")}<textarea rows={3} value={draft.networkOrServiceRole} onChange={(event) => set("networkOrServiceRole", event.target.value)} /></label>
        <label>{m(t, "effective_practices.fields.outcome", "Üldistatud tulemus")}<textarea rows={3} value={draft.outcome} onChange={(event) => set("outcome", event.target.value)} /></label>
        <label>{m(t, "effective_practices.fields.learning", "Õppimis- ja tõendusalus")}<textarea required rows={3} value={draft.learningPoints} onChange={(event) => set("learningPoints", event.target.value)} /></label>
        <label className="is-wide">{m(t, "effective_practices.fields.sources", "Allikad ja professionaalne alus")}<textarea rows={2} value={draft.sources} onChange={(event) => set("sources", event.target.value)} /></label>
        <label>{m(t, "effective_practices.fields.targets", "Sihtrühmad")}<textarea rows={3} value={draft.targetGroups} onChange={(event) => set("targetGroups", event.target.value)} /></label>
        <label>{m(t, "effective_practices.fields.environments", "Rakendamiskeskkonnad")}<textarea rows={3} value={draft.environments} onChange={(event) => set("environments", event.target.value)} /></label>
        <label className="is-wide">{m(t, "effective_practices.fields.topics", "Teemad ja märksõnad")}<input value={draft.topics} onChange={(event) => set("topics", event.target.value)} /></label>
      </div>
      <label className="epp-confirm"><input type="checkbox" checked={draft.ownerConfirmedNoIdentifiers} onChange={(event) => set("ownerConfirmedNoIdentifiers", event.target.checked)} /><span>{m(t, "effective_practices.editor.identifiers_confirm", "Kinnitan pärast viimaseid muudatusi, et see kandidaatversioon ei sisalda klienti, last, perekonda ega konkreetset juhtumit tuvastavaid detaile.")}</span></label>
      <footer><button type="button" data-variant="quiet" onClick={onCancel}>{m(t, "common.cancel", "Loobu")}</button><button type="submit" disabled={busy}>{busy ? m(t, "common.saving", "Salvestan…") : m(t, "effective_practices.actions.save_private", "Salvesta privaatne mustand")}</button></footer>
    </form>
  );
}

function ApplicationForm({ practice, t, busy, error, onSubmit }) {
  const [value, setValue] = useState({ ...EMPTY_APPLICATION });
  const set = (field, next) => setValue((current) => ({ ...current, [field]: next }));
  const submit = (event) => {
    event.preventDefault();
    onSubmit({ ...value, versionUsed: practice.version, submit: true });
  };
  return (
    <form className="epp-application" onSubmit={submit}>
      <h3>{m(t, "effective_practices.application.title", "Lisa struktureeritud rakendamiskogemus")}</h3>
      <p>{m(t, "effective_practices.application.note", "See ei ole hinne ega kommentaar. Kirjelda konteksti, kohandusi, piiranguid ja järelvaadet.")}</p>
      {error ? <p className="epp-inline-error" role="alert">{error}</p> : null}
      <label>{m(t, "effective_practices.application.context", "Kasutamise kontekst")}<textarea required rows={2} value={value.context} onChange={(event) => set("context", event.target.value)} /></label>
      <label>{m(t, "effective_practices.application.target", "Sihtrühm")}<input required value={value.targetGroup} onChange={(event) => set("targetGroup", event.target.value)} /></label>
      <label>{m(t, "effective_practices.application.adaptations", "Mida kohandasin")}<textarea required rows={2} value={value.adaptations} onChange={(event) => set("adaptations", event.target.value)} /></label>
      <label>{m(t, "effective_practices.application.worked", "Mis toimis")}<textarea required rows={2} value={value.whatWorked} onChange={(event) => set("whatWorked", event.target.value)} /></label>
      <label>{m(t, "effective_practices.application.not_worked", "Mis ei toiminud")}<textarea required rows={2} value={value.whatDidNot} onChange={(event) => set("whatDidNot", event.target.value)} /></label>
      <label>{m(t, "effective_practices.application.limitation", "Ilmnenud piirang või risk")}<textarea required rows={2} value={value.limitationOrRisk} onChange={(event) => set("limitationOrRisk", event.target.value)} /></label>
      <label>{m(t, "effective_practices.application.follow_up", "Järelvaate aeg")}<input type="date" required value={value.followUpAt} onChange={(event) => set("followUpAt", event.target.value)} /></label>
      <label className="epp-confirm"><input type="checkbox" checked={value.needsReview} onChange={(event) => set("needsReview", event.target.checked)} /><span>{m(t, "effective_practices.application.needs_review", "Kogemus toob esile uue riski või vajaduse praktika uuesti üle vaadata.")}</span></label>
      <button type="submit" disabled={busy}>{m(t, "effective_practices.actions.submit_application", "Saada rakendamiskogemus ülevaatamiseks")}</button>
    </form>
  );
}

function DetailDialog({ detail, types, t, locale, busy, error, onClose, onEdit, onAction, onApplication }) {
  const dialogRef = useRef(null);
  useModalFocusTrap(dialogRef);
  const practice = detail.practice;
  const reviewRoles = (practice.assignedReviewRoles || []).filter((item) => types.includes(item));
  const [reviewType, setReviewType] = useState(() => reviewRoles[0] || "REVIEWER");
  const [decision, setDecision] = useState("APPROVED");
  const [conflictStatus, setConflictStatus] = useState("");
  const [authorFeedback, setAuthorFeedback] = useState("");
  const [privateNotes, setPrivateNotes] = useState("");
  const [nextReviewAt, setNextReviewAt] = useState("");
  const isPublished = detail.kind === "published";
  const isOwner = detail.kind === "candidate";
  const isReviewer = detail.kind === "review";
  const canReviewNow = isReviewer
    && ["SUBMITTED", "IN_REVIEW", "RE_REVIEW"].includes(practice.status)
    && reviewRoles.length > 0;
  return (
    <div className="epp-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="epp-dialog" role="dialog" aria-modal="true" aria-labelledby="epp-dialog-title">
        <header><div><small>{isPublished ? statusLabel(practice.status, t) : isReviewer ? m(t, "effective_practices.labels.review_workspace", "Retsenseerimise tööruum") : m(t, "effective_practices.editor.private", "Privaatne praktikakandidaat")}</small><h2 id="epp-dialog-title">{practice.title}</h2></div><button type="button" autoFocus onClick={onClose} aria-label={m(t, "common.close", "Sulge")}>×</button></header>
        {error ? <p className="epp-inline-error" role="alert">{error}</p> : null}
        <div className="epp-dialog-scroll">
          <section className="epp-detail-intro"><p>{practice.summary}</p><div><span>{m(t, "effective_practices.labels.version", "Versioon")} {practice.version}</span><span>{statusLabel(practice.status, t)}</span></div></section>
          <div className="epp-detail-grid">
            <section><small>{m(t, "effective_practices.labels.suitable", "Sobib, kui")}</small><p>{practice.suitableContext || "—"}</p></section>
            <section className="is-limit"><small>{m(t, "effective_practices.labels.limitation", "Oluline piirang")}</small><p>{practice.limitations || "—"}</p></section>
            <section><h3>{m(t, "effective_practices.labels.conditions", "Vajalikud tingimused")}</h3><ul>{(practice.conditions || []).map((item) => <li key={item}>{item}</li>)}</ul></section>
            <section><h3>{m(t, "effective_practices.labels.steps", "Rakendamissammud")}</h3><ol>{(practice.steps || []).map((item) => <li key={item}>{item}</li>)}</ol></section>
            <section><small>{m(t, "effective_practices.fields.targets", "Sihtrühmad")}</small><p>{(practice.targetGroups || []).join(" · ") || "—"}</p></section>
            <section><small>{m(t, "effective_practices.fields.environments", "Rakendamiskeskkonnad")}</small><p>{(practice.environments || []).join(" · ") || "—"}</p></section>
            <section><small>{m(t, "effective_practices.fields.outcome", "Üldistatud tulemus")}</small><p>{practice.expectedOutcome || practice.outcome || "—"}</p></section>
            <section><small>{m(t, "effective_practices.fields.learning", "Õppimis- ja tõendusalus")}</small><p>{practice.learningPoints || "—"}</p></section>
            <section><small>{m(t, "effective_practices.fields.sources", "Allikad ja professionaalne alus")}</small><p>{practice.sources || "—"}</p></section>
            <section><small>{m(t, "effective_practices.fields.topics", "Teemad ja märksõnad")}</small><p>{[...(practice.topics || []), ...(practice.tags || [])].join(" · ") || "—"}</p></section>
            {!isPublished ? <>
              <section><small>{m(t, "effective_practices.fields.background", "Üldistatud taust")}</small><p>{practice.background || "—"}</p></section>
              <section><small>{m(t, "effective_practices.fields.challenge", "Peamine professionaalne väljakutse")}</small><p>{practice.mainChallenge || "—"}</p></section>
              <section><small>{m(t, "effective_practices.fields.what_helped", "Mis aitas")}</small><p>{practice.whatHelped || "—"}</p></section>
              <section><small>{m(t, "effective_practices.fields.network_role", "Võrgustiku või teenuse roll")}</small><p>{practice.networkOrServiceRole || "—"}</p></section>
            </> : null}
          </div>
          {isPublished ? <section className="epp-review-proof"><h3>{m(t, "effective_practices.labels.review_basis", "Professionaalse ülevaatuse alus")}</h3><p>{(practice.reviewRoles || []).map((item) => capabilityLabel(item, t)).join(" · ")}</p><dl><div><dt>{m(t, "effective_practices.labels.reviewed", "Professionaalselt üle vaadatud")}</dt><dd>{formatDate(practice.professionalReviewedAt, locale)}</dd></div><div><dt>{m(t, "effective_practices.labels.next_review", "Järgmine ülevaatus")}</dt><dd>{formatDate(practice.nextReviewAt, locale)}</dd></div></dl></section> : null}
          {practice.versionHistory?.length ? <section className="epp-review-proof"><h3>{m(t, "effective_practices.version_history", "Avaldatud versioonide ajalugu")}</h3>{practice.versionHistory.map((item) => <article key={item.version}><strong>{m(t, "effective_practices.labels.version", "Versioon")} {item.version} · {formatDate(item.publishedAt, locale)}</strong><p>{item.snapshot.title}</p><p>{item.snapshot.summary || "—"}</p><small>{(item.reviewRoles || []).map((role) => capabilityLabel(role, t)).join(" · ")}</small></article>)}</section> : null}
          {isOwner ? <section className="epp-owner-actions"><h3>{m(t, "effective_practices.candidate.next", "Kandidaadi järgmine samm")}</h3><p>{practice.source?.linked ? m(t, "effective_practices.candidate.from_closure", "Mustand loodi lõpetatud juhtumi kinnitatud üldistusest. Juhtumilugu ei ole kopeeritud.") : m(t, "effective_practices.candidate.from_experience", "Mustand põhineb sinu üldistatud professionaalsel kogemusel.")}</p><div>{["DRAFT", "NEEDS_CHANGES"].includes(practice.status) ? <button type="button" data-variant="quiet" onClick={() => onEdit(practice)}>{m(t, "effective_practices.actions.edit", "Täienda")}</button> : null}{["DRAFT", "NEEDS_CHANGES"].includes(practice.status) ? <button type="button" disabled={busy} onClick={() => onAction({ action: "submit", expectedVersion: practice.version })}>{m(t, "effective_practices.actions.submit_review", "Esita ülevaatamiseks")}</button> : null}<button type="button" data-variant="quiet" disabled={busy} onClick={() => { if (window.confirm(m(t, "effective_practices.actions.archive_confirm", "Kas arhiveerida see praktikakandidaat?"))) onAction({ action: "archive", expectedVersion: practice.version }); }}>{m(t, "effective_practices.actions.archive", "Arhiveeri")}</button></div></section> : null}
          {canReviewNow ? <form className="epp-review-form" onSubmit={(event) => { event.preventDefault(); onAction({ action: "review", expectedVersion: practice.version, capabilityType: reviewType, decision, conflictStatus, authorFeedback, privateNotes }); }}>
            <h3>{m(t, "effective_practices.review.title", "Professionaalne ülevaatus")}</h3>
            <label>{m(t, "effective_practices.review.role", "Ülevaatuse roll")}<select value={reviewType} onChange={(event) => setReviewType(event.target.value)}>{reviewRoles.map((item) => <option key={item} value={item}>{capabilityLabel(item, t)}</option>)}</select></label>
            <label>{m(t, "effective_practices.review.conflict_status", "Huvide konflikti kontroll")}<select required value={conflictStatus} onChange={(event) => { const value = event.target.value; setConflictStatus(value); if (value === "DECLINED") setDecision("CONFLICT"); else if (decision === "CONFLICT") setDecision("APPROVED"); }}><option value="">{m(t, "effective_practices.review.choose_conflict", "Vali kontrolli tulemus")}</option><option value="NONE">{m(t, "effective_practices.review.no_conflict", "Huvide konflikti ei ole")}</option><option value="MANAGEABLE">{m(t, "effective_practices.review.manageable_conflict", "Seos on olemas, kuid juhitav")}</option><option value="DECLINED">{m(t, "effective_practices.review.declined_conflict", "Taandun huvide konflikti tõttu")}</option></select></label>
            <label>{m(t, "effective_practices.review.decision", "Otsus")}<select value={decision} onChange={(event) => { const value = event.target.value; setDecision(value); if (value === "CONFLICT") setConflictStatus("DECLINED"); else if (conflictStatus === "DECLINED") setConflictStatus("NONE"); }}><option value="APPROVED">{m(t, "effective_practices.review.approve", "Sobib järgmisse kontrolli")}</option><option value="NEEDS_CHANGES">{m(t, "effective_practices.review.changes", "Vajab täiendamist")}</option><option value="DECLINED">{m(t, "effective_practices.review.decline", "Ei sobi avaldamiseks")}</option><option value="CONFLICT">{m(t, "effective_practices.review.conflict", "Huvide konflikt")}</option></select></label>
            <label>{m(t, "effective_practices.review.author_feedback", "Autorile nähtav tagasiside")}<textarea rows={4} required={["NEEDS_CHANGES", "DECLINED"].includes(decision)} value={authorFeedback} onChange={(event) => setAuthorFeedback(event.target.value)} /></label>
            <label>{m(t, "effective_practices.review.private_notes", "Privaatsed märkmed ülevaatuse töövoole")}<textarea rows={3} required={decision === "CONFLICT" || conflictStatus !== "NONE"} value={privateNotes} onChange={(event) => setPrivateNotes(event.target.value)} /></label>
            <button type="submit" disabled={busy}>{m(t, "effective_practices.actions.save_review", "Salvesta ülevaatus")}</button>
          </form> : null}
          {isReviewer && practice.status === "READY_TO_PUBLISH" && types.includes("APPROVER") ? <form className="epp-publish" onSubmit={(event) => { event.preventDefault(); onAction({ action: "publish", expectedVersion: practice.version, nextReviewAt }); }}><h3>{m(t, "effective_practices.publish.title", "Lõplik kinnitamine")}</h3><p>{m(t, "effective_practices.publish.note", "Avaldamine lukustab eraldi versiooni. RAG-sünk käivitub alles pärast edukat avaldamist ja selle olek raporteeritakse eraldi.")}</p><label>{m(t, "effective_practices.labels.next_review", "Järgmine ülevaatus")}<input type="date" required value={nextReviewAt} onChange={(event) => setNextReviewAt(event.target.value)} /></label><button type="submit" disabled={busy}>{m(t, "effective_practices.actions.publish", "Kinnita ja avalda versioon")}</button></form> : null}
          {isPublished && types.includes("ETHICS") ? <section className="epp-owner-actions"><h3>{m(t, "effective_practices.status.re_review", "Uuesti ülevaatamine")}</h3><button type="button" disabled={busy} onClick={() => { if (window.confirm(m(t, "effective_practices.actions.re_review_confirm", "Kas eemaldada versioon teadmistekogust ja alustada uut ülevaatust?"))) onAction({ action: "re_review", expectedVersion: practice.version }); }}>{m(t, "effective_practices.actions.re_review", "Alusta uut ülevaatust")}</button></section> : null}
          {isPublished ? <ApplicationForm practice={practice} t={t} busy={busy} error="" onSubmit={onApplication} /> : null}
        </div>
      </section>
    </div>
  );
}

export default function EffectivePracticesPage({ user = {} }) {
  const { locale, t } = useI18n();
  const [workspace, setWorkspace] = useState(EMPTY_WORKSPACE);
  const [tab, setTab] = useState("library");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [sort, setSort] = useState("updated");
  const [maturity, setMaturity] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [dialogError, setDialogError] = useState("");
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const returnFocusRef = useRef(null);
  const activeViewRef = useRef({ kind: "list", id: "" });
  const overlayRequestGateRef = useRef(createLatestRequestGate());
  const mutationRequestGateRef = useRef(createLatestRequestGate());
  const listRequestRef = useRef(0);
  const [isPending, startTransition] = useTransition();
  const headers = useMemo(() => ({ Accept: "application/json", "x-ui-locale": locale }), [locale]);

  const load = useCallback(async ({ quiet = false } = {}) => {
    const requestId = listRequestRef.current + 1;
    listRequestRef.current = requestId;
    if (!quiet) setLoading(true);
    const params = new URLSearchParams({ sort });
    if (deferredQuery.trim()) params.set("q", deferredQuery.trim());
    if (maturity) params.set("maturity", maturity);
    try {
      const response = await fetch(`/api/effective-practices?${params}`, { headers, cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error("load"), { payload });
      if (listRequestRef.current !== requestId) return;
      startTransition(() => setWorkspace({ ...EMPTY_WORKSPACE, ...payload }));
      setError("");
      if (!payload.capabilities?.canReview && tab === "review") setTab("library");
    } catch (requestError) {
      if (!quiet && listRequestRef.current === requestId) setError(resolveApiMessage({ payload: requestError?.payload, t, fallbackKey: "effective_practices.errors.load_failed", fallbackText: "Praktikakogu ei õnnestunud laadida." }));
    } finally {
      if (!quiet && listRequestRef.current === requestId) setLoading(false);
    }
  }, [deferredQuery, headers, maturity, sort, startTransition, t, tab]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 180);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openDetail = useCallback(async (id, { history = "push", trigger = null } = {}) => {
    const normalizedId = String(id || "").trim();
    if (!normalizedId) return;
    if (trigger && typeof trigger.focus === "function") returnFocusRef.current = trigger;
    const previousView = activeViewRef.current;
    const view = { kind: "detail", id: normalizedId };
    mutationRequestGateRef.current.invalidate();
    const request = overlayRequestGateRef.current.begin(effectivePracticeViewKey(view));
    activeViewRef.current = view;
    setBusy(false);
    setDialogError("");
    setEditing(null);
    setSelected({ loading: true, id: normalizedId });
    if (history !== "none") {
      writeEffectivePracticeView(view, { history, parentView: previousView });
    }
    try {
      const response = await fetch(`/api/effective-practices/${encodeURIComponent(normalizedId)}`, { headers, cache: "no-store", signal: request.signal });
      const payload = await response.json().catch(() => ({}));
      if (!request.isCurrent() || effectivePracticeViewKey(activeViewRef.current) !== effectivePracticeViewKey(view)) return;
      if (!response.ok) throw Object.assign(new Error("detail"), { payload });
      setSelected(payload);
    } catch (requestError) {
      if (isAbortError(requestError) || !request.isCurrent() || effectivePracticeViewKey(activeViewRef.current) !== effectivePracticeViewKey(view)) return;
      setSelected({ loading: true, id: normalizedId });
      setDialogError(resolveApiMessage({ payload: requestError?.payload, t, fallbackKey: "effective_practices.errors.detail_failed", fallbackText: "Praktikat ei saanud avada." }));
    }
  }, [headers, t]);

  const closeDetail = useCallback(({ history = "auto" } = {}) => {
    const opener = returnFocusRef.current;
    const currentView = activeViewRef.current;
    const targetView = { kind: "list", id: "" };
    overlayRequestGateRef.current.invalidate();
    mutationRequestGateRef.current.invalidate();
    activeViewRef.current = targetView;
    setBusy(false);
    setSelected(null);
    setEditing(null);
    setDialogError("");
    if (history !== "none") {
      if (history === "auto" && canReturnToEffectivePracticeView(currentView, targetView)) {
        window.history.back();
      } else {
        writeEffectivePracticeView(targetView, { history: "replace", parentView: targetView });
      }
    }
    window.requestAnimationFrame(() => opener?.focus?.());
  }, []);

  const openEditor = useCallback((value = {}, trigger = null, { history = "push" } = {}) => {
    if (trigger && typeof trigger.focus === "function") returnFocusRef.current = trigger;
    const previousView = activeViewRef.current;
    const view = { kind: "editor", id: String(value?.id || "").trim() };
    overlayRequestGateRef.current.invalidate();
    mutationRequestGateRef.current.invalidate();
    activeViewRef.current = view;
    setBusy(false);
    setDialogError("");
    setSelected(null);
    setEditing(value);
    if (history !== "none") writeEffectivePracticeView(view, { history, parentView: previousView });
  }, []);

  const loadEditor = useCallback(async (id) => {
    const normalizedId = String(id || "").trim();
    if (!normalizedId) {
      openEditor({}, null, { history: "none" });
      return;
    }
    const view = { kind: "editor", id: normalizedId };
    mutationRequestGateRef.current.invalidate();
    const request = overlayRequestGateRef.current.begin(effectivePracticeViewKey(view));
    activeViewRef.current = view;
    setBusy(false);
    setEditing(null);
    setSelected({ loading: true, id: normalizedId, editor: true });
    setDialogError("");
    try {
      const response = await fetch(`/api/effective-practices/${encodeURIComponent(normalizedId)}`, { headers, cache: "no-store", signal: request.signal });
      const payload = await response.json().catch(() => ({}));
      if (!request.isCurrent() || effectivePracticeViewKey(activeViewRef.current) !== effectivePracticeViewKey(view)) return;
      if (!response.ok || payload?.kind !== "candidate" || !payload?.practice) throw Object.assign(new Error("editor"), { payload });
      setSelected(null);
      setEditing(payload.practice);
    } catch (requestError) {
      if (isAbortError(requestError) || !request.isCurrent() || effectivePracticeViewKey(activeViewRef.current) !== effectivePracticeViewKey(view)) return;
      setSelected({ loading: true, id: normalizedId, editor: true });
      setDialogError(resolveApiMessage({ payload: requestError?.payload, t, fallbackKey: "effective_practices.errors.detail_failed", fallbackText: "Praktikat ei saanud avada." }));
    }
  }, [headers, openEditor, t]);

  const closeEditor = useCallback(({ history = "auto" } = {}) => {
    const opener = returnFocusRef.current;
    const currentView = activeViewRef.current;
    const targetView = currentView.id
      ? { kind: "detail", id: currentView.id }
      : { kind: "list", id: "" };
    overlayRequestGateRef.current.invalidate();
    mutationRequestGateRef.current.invalidate();
    setBusy(false);
    setEditing(null);
    setSelected(null);
    setDialogError("");
    if (history === "none") {
      activeViewRef.current = targetView;
    } else if (history === "auto" && canReturnToEffectivePracticeView(currentView, targetView)) {
      activeViewRef.current = targetView;
      window.history.back();
    } else {
      activeViewRef.current = targetView;
      writeEffectivePracticeView(targetView, { history: "replace", parentView: { kind: "list", id: "" } });
      if (targetView.kind === "detail") openDetail(targetView.id, { history: "none" });
    }
    window.requestAnimationFrame(() => opener?.focus?.());
  }, [openDetail]);

  useEffect(() => {
    const syncFromLocation = () => {
      const view = parseEffectivePracticeView(window.location.search);
      if (view.kind === "detail") {
        openDetail(view.id, { history: "none" });
      } else if (view.kind === "editor") {
        if (view.id) loadEditor(view.id);
        else openEditor({}, null, { history: "none" });
      } else {
        overlayRequestGateRef.current.invalidate();
        mutationRequestGateRef.current.invalidate();
        activeViewRef.current = view;
        setBusy(false);
        setSelected(null);
        setEditing(null);
        setDialogError("");
      }
    };
    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, [loadEditor, openDetail, openEditor]);

  useEffect(() => () => {
    overlayRequestGateRef.current.invalidate();
    mutationRequestGateRef.current.invalidate();
  }, []);

  useEffect(() => {
    if (!selected && !editing) return undefined;
    const previous = document.body.style.overflow;
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      if (editing) closeEditor();
      else closeDetail();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [closeDetail, closeEditor, editing, selected]);

  const saveCandidate = useCallback(async (data) => {
    const existing = String(editing?.id || "").trim();
    const currentView = { kind: "editor", id: existing };
    const viewKey = effectivePracticeViewKey(currentView);
    if (effectivePracticeViewKey(activeViewRef.current) !== viewKey) return;
    const request = mutationRequestGateRef.current.begin(viewKey);
    setBusy(true);
    setDialogError("");
    try {
      const response = await fetch(existing ? `/api/effective-practices/${encodeURIComponent(existing)}` : "/api/effective-practices", {
        method: existing ? "PATCH" : "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(existing ? { expectedVersion: editing.version, ...data } : data),
        signal: request.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!request.isCurrent() || effectivePracticeViewKey(activeViewRef.current) !== viewKey) return;
      if (!response.ok) throw Object.assign(new Error("save"), { payload });
      await load({ quiet: true });
      if (!request.isCurrent() || effectivePracticeViewKey(activeViewRef.current) !== viewKey) return;
      const savedId = String(payload?.candidate?.id || existing).trim();
      if (!savedId) throw Object.assign(new Error("save"), { payload });
      const targetView = { kind: "detail", id: savedId };
      setEditing(null);
      setSelected(null);
      setDialogError("");
      if (existing && canReturnToEffectivePracticeView(currentView, targetView)) {
        activeViewRef.current = targetView;
        window.history.back();
      } else {
        activeViewRef.current = targetView;
        writeEffectivePracticeView(targetView, { history: "replace", parentView: { kind: "list", id: "" } });
        await openDetail(savedId, { history: "none" });
      }
    } catch (requestError) {
      if (isAbortError(requestError) || !request.isCurrent() || effectivePracticeViewKey(activeViewRef.current) !== viewKey) return;
      setDialogError(resolveApiMessage({ payload: requestError?.payload, t, fallbackKey: "effective_practices.errors.save_failed", fallbackText: "Mustandit ei saanud salvestada." }));
    } finally {
      if (request.isCurrent()) setBusy(false);
    }
  }, [editing, headers, load, openDetail, t]);

  const workflowAction = useCallback(async (body) => {
    if (!selected?.practice?.id) return;
    const practiceId = selected.practice.id;
    const view = { kind: "detail", id: practiceId };
    const viewKey = effectivePracticeViewKey(view);
    if (effectivePracticeViewKey(activeViewRef.current) !== viewKey) return;
    const request = mutationRequestGateRef.current.begin(viewKey);
    setBusy(true);
    setDialogError("");
    try {
      const response = await fetch(`/api/effective-practices/${encodeURIComponent(practiceId)}/actions`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: request.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!request.isCurrent() || effectivePracticeViewKey(activeViewRef.current) !== viewKey) return;
      if (!response.ok) throw Object.assign(new Error("action"), { payload, status: response.status });
      if (payload.kind === "action_result") closeDetail();
      else setSelected(payload);
      await load({ quiet: true });
    } catch (requestError) {
      if (isAbortError(requestError) || !request.isCurrent() || effectivePracticeViewKey(activeViewRef.current) !== viewKey) return;
      setDialogError(resolveApiMessage({ payload: requestError?.payload, t, fallbackKey: "effective_practices.errors.action_failed", fallbackText: "Toimingut ei saanud salvestada." }));
      if (requestError?.status === 409) await openDetail(practiceId, { history: "none" });
    } finally {
      if (request.isCurrent()) setBusy(false);
    }
  }, [closeDetail, headers, load, openDetail, selected, t]);

  const addApplication = useCallback(async (body) => {
    if (!selected?.practice?.id) return;
    const practiceId = selected.practice.id;
    const viewKey = effectivePracticeViewKey({ kind: "detail", id: practiceId });
    if (effectivePracticeViewKey(activeViewRef.current) !== viewKey) return;
    const request = mutationRequestGateRef.current.begin(viewKey);
    setBusy(true);
    setDialogError("");
    try {
      const response = await fetch(`/api/effective-practices/${encodeURIComponent(practiceId)}/applications`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: request.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!request.isCurrent() || effectivePracticeViewKey(activeViewRef.current) !== viewKey) return;
      if (!response.ok) throw Object.assign(new Error("application"), { payload });
      await load({ quiet: true });
      if (!request.isCurrent() || effectivePracticeViewKey(activeViewRef.current) !== viewKey) return;
      await openDetail(practiceId, { history: "none" });
    } catch (requestError) {
      if (isAbortError(requestError) || !request.isCurrent() || effectivePracticeViewKey(activeViewRef.current) !== viewKey) return;
      setDialogError(resolveApiMessage({ payload: requestError?.payload, t, fallbackKey: "effective_practices.errors.application_failed", fallbackText: "Rakendamiskogemust ei saanud salvestada." }));
    } finally {
      if (request.isCurrent()) setBusy(false);
    }
  }, [headers, load, openDetail, selected, t]);

  const reviewApplication = useCallback(async (id, body) => {
    setBusy(true);
    setDialogError("");
    try {
      const response = await fetch(`/api/effective-practices/applications/${encodeURIComponent(id)}/actions`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error("application-review"), { payload });
      await load({ quiet: true });
    } catch (requestError) {
      setError(resolveApiMessage({ payload: requestError?.payload, t, fallbackKey: "effective_practices.errors.action_failed", fallbackText: "Ülevaatust ei saanud salvestada." }));
    } finally {
      setBusy(false);
    }
  }, [headers, load, t]);

  const canViewOwnWork = workspace.capabilities.canCreate || workspace.myApplications.length > 0;
  const tabs = [
    ["library", "effective_practices.tabs.library", "Praktikakogu", workspace.practices.length],
    ...(canViewOwnWork ? [["candidates", "effective_practices.tabs.candidates", "Minu tööd", workspace.candidates.length + workspace.myApplications.length]] : []),
    ...(workspace.capabilities.canReview ? [["review", "effective_practices.tabs.review", "Retsenseerimine", workspace.reviewQueue.length + workspace.applicationQueue.length]] : [])
  ];
  const content = tab === "candidates" ? [...workspace.candidates, ...workspace.myApplications] : tab === "review" ? [...workspace.reviewQueue, ...workspace.applicationQueue] : workspace.practices;

  return (
    <main className="epp-shell" aria-labelledby="epp-title">
      <aside className="epp-sidebar">
        <Link className="epp-brand" href="/kovisioon"><span aria-hidden="true">◌</span><strong>{m(t, "effective_practices.brand", "KOVISIOON")}</strong></Link>
        <nav aria-label={m(t, "effective_practices.navigation", "Kovisiooni põhilehed")}>
          <Link href="/kovisioon"><span aria-hidden="true">＋</span>{m(t, "covision.workspace.nav.new", "Uus Kovisioon")}</Link>
          <Link href="/teemaseemned"><span aria-hidden="true">◇</span>{m(t, "covision.workspace.nav.seeds", "Teemaseemned")}</Link>
          <Link href="/lopetatud-juhtumid"><span aria-hidden="true">□</span>{m(t, "covision.workspace.nav.completed", "Lõpetatud juhtumid")}</Link>
          <Link className="is-active" aria-current="page" href="/parimad-praktikad"><span aria-hidden="true">▤</span>{m(t, "covision.workspace.nav.practices", "Parimad praktikad")}</Link>
        </nav>
        <section className="epp-quality"><span aria-hidden="true">⌁</span><h2>{m(t, "effective_practices.quality.title", "Kvaliteedi tagamine")}</h2><p>{m(t, "effective_practices.quality.text", "Iga avaldatud praktika läbib avaldamiseelse kontrolli. Professionaalse retsenseerimise tase on praktika juures nähtav.")}</p></section>
        <Link className="epp-privacy" href="/privaatsustingimused">{m(t, "effective_practices.privacy", "Privaatsus ja andmekaitse")} →</Link>
      </aside>

      <div className="epp-main">
        <header className="epp-header">
          <div><span className="epp-kicker">{m(t, "effective_practices.kicker", "Professionaalne teadmistekogu")}</span><h1 id="epp-title">{m(t, "effective_practices.title", "Parimad praktikad")}</h1><p>{m(t, "effective_practices.lead", "Praktikakogu sisaldab eri küpsus- ja ülevaatustasemel professionaalseid tööviise. Iga praktika juures on nähtav kontekst, tingimused ja piirangud.")}</p></div>
          <div className="epp-profile"><button type="button" onClick={() => setHelpOpen((current) => !current)} aria-expanded={helpOpen} aria-controls="epp-help" aria-label={m(t, "effective_practices.help.title", "Abi")}>?</button><div><strong>{user.name || m(t, "effective_practices.profile.you", "Sina")}</strong><small>{roleLabel(user.role, t)}</small></div><span aria-hidden="true">{String(user.name || "S").slice(0, 1).toUpperCase()}</span></div>
        </header>

        {helpOpen ? <section id="epp-help" className="epp-help"><strong>{m(t, "effective_practices.help.title", "Abi")}</strong><p>{m(t, "effective_practices.help.text", "Praktika ei ole universaalne lahendus. Kontrolli enne kasutamist sobivat konteksti, tingimusi, piiranguid ja versiooni.")}</p></section> : null}

        <nav className="epp-tabs" aria-label={m(t, "effective_practices.tabs.title", "Praktikakogu vaated")}>{tabs.map(([value, key, fallback, count]) => <button key={value} type="button" aria-current={tab === value ? "page" : undefined} onClick={() => setTab(value)}>{m(t, key, fallback)} <span>{count}</span></button>)}</nav>

        {workspace.profile.capabilities.length ? <section className="epp-capabilities" aria-label={m(t, "effective_practices.capability.title", "Kinnitatud platvormiõigused")}><strong>{m(t, "effective_practices.capability.title", "Kinnitatud platvormiõigused")}</strong>{workspace.profile.capabilities.map((item) => <span key={`${item.type}-${item.scope}`}>{capabilityLabel(item.type, t)} · {item.scope === "*" ? m(t, "effective_practices.capability.all_scopes", "kõik valdkonnad") : item.scope}</span>)}</section> : null}

        <section className="epp-toolbar">
          <label className="epp-search"><span aria-hidden="true">⌕</span><input type="search" aria-label={m(t, "effective_practices.search_label", "Otsi praktikakogust")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={m(t, "effective_practices.search", "Otsi praktikat, teemat, sihtrühma või tööfookust…")} /></label>
          <select value={maturity} onChange={(event) => setMaturity(event.target.value)} aria-label={m(t, "effective_practices.filters.maturity", "Küpsustase")}><option value="">{m(t, "effective_practices.filters.all_levels", "Kõik kinnitustasemed")}</option><option value="confirmed">{m(t, "effective_practices.status.published", "Kinnitatud praktika")}</option></select>
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label={m(t, "effective_practices.sort.title", "Sortimine")}><option value="updated">{m(t, "effective_practices.sort.updated", "Hiljuti uuendatud")}</option><option value="reviewed">{m(t, "effective_practices.sort.reviewed", "Viimati üle vaadatud")}</option><option value="applications">{m(t, "effective_practices.sort.applications", "Enim dokumenteeritud kogemusi")}</option><option value="alphabetical">{m(t, "effective_practices.sort.alpha", "Tähestikuline")}</option><option value="review_due">{m(t, "effective_practices.sort.review_due", "Vajab uut ülevaatust")}</option></select>
          {tab === "candidates" && workspace.capabilities.canCreate ? <button type="button" onClick={(event) => openEditor({}, event.currentTarget)}>{m(t, "effective_practices.actions.create", "Loo praktikakandidaat")}</button> : null}
        </section>

        {error ? <section className="epp-state is-error" role="alert"><p>{error}</p><button type="button" onClick={() => load()}>{m(t, "common.retry", "Proovi uuesti")}</button></section> : null}
        {(loading || isPending) && !error ? <section className="epp-state" aria-busy="true"><div className="epp-loader" /><p>{m(t, "effective_practices.loading", "Praktikakogu avaneb…")}</p></section> : null}
        {!loading && !isPending && !error && !content.length ? <section className="epp-state"><span aria-hidden="true">▤</span><h2>{tab === "candidates" ? m(t, "effective_practices.empty.candidates_title", "Sul pole veel praktikakandidaate") : tab === "review" ? m(t, "effective_practices.empty.review_title", "Sul pole praegu määratud ülevaatusi") : m(t, "effective_practices.empty.library_title", "Praktikakogu alles kujuneb")}</h2><p>{tab === "library" ? m(t, "effective_practices.empty.library_text", "Siia ilmuvad ainult lukustatud ja avaldamiseks kinnitatud praktikaversioonid.") : m(t, "effective_practices.empty.personal_text", "Uued tööobjektid ilmuvad siia pärast teadlikku loomist või määramist.")}</p>{tab === "candidates" && workspace.capabilities.canCreate ? <button type="button" onClick={(event) => openEditor({}, event.currentTarget)}>{m(t, "effective_practices.actions.create", "Loo praktikakandidaat")}</button> : null}</section> : null}
        {!loading && content.length ? <section id="practice-library" className={`epp-grid is-${tab}`} aria-live="polite">
          {tab === "library" ? workspace.practices.map((item) => <PracticeCard key={item.id} practice={item} t={t} locale={locale} onOpen={openDetail} />) : null}
          {tab === "candidates" ? <>
            <div className="epp-review-section"><h2>{m(t, "effective_practices.candidate.my_candidates", "Minu praktikakandidaadid")}</h2>{workspace.candidates.map((item) => <CandidateCard key={item.id} candidate={item} t={t} locale={locale} onOpen={openDetail} />)}</div>
            <div className="epp-review-section"><h2>{m(t, "effective_practices.application.my_applications", "Minu rakendamiskogemused")}</h2>{workspace.myApplications.map((item) => <OwnApplicationCard key={item.id} application={item} t={t} locale={locale} busy={busy} onResubmit={reviewApplication} />)}</div>
          </> : null}
          {tab === "review" ? <>
            <div className="epp-review-section"><h2>{m(t, "effective_practices.review.candidates", "Praktikakandidaadid")}</h2>{workspace.reviewQueue.map((item) => <CandidateCard key={item.id} candidate={item} t={t} locale={locale} review onOpen={openDetail} />)}</div>
            <div className="epp-review-section"><h2>{m(t, "effective_practices.review.applications", "Rakendamiskogemused")}</h2>{workspace.applicationQueue.map((item) => <ApplicationReviewCard key={item.id} application={item} types={workspace.capabilities.types || []} t={t} busy={busy} onReview={reviewApplication} />)}</div>
          </> : null}
        </section> : null}
      </div>

      {editing ? <div className="epp-dialog-backdrop"><section className="epp-dialog is-editor" role="dialog" aria-modal="true" aria-labelledby="epp-editor-title"><CandidateEditor initial={editing.id ? editing : null} t={t} busy={busy} error={dialogError} onCancel={closeEditor} onSave={saveCandidate} /></section></div> : null}
      {selected?.practice ? <DetailDialog detail={selected} types={workspace.capabilities.types || []} t={t} locale={locale} busy={busy} error={dialogError} onClose={closeDetail} onEdit={(practice) => openEditor(practice)} onAction={workflowAction} onApplication={addApplication} /> : null}
      {selected?.loading ? <LoadingDialog
        error={dialogError}
        t={t}
        onClose={() => (activeViewRef.current.kind === "editor" ? closeEditor() : closeDetail())}
        onRetry={() => (activeViewRef.current.kind === "editor" ? loadEditor(activeViewRef.current.id) : openDetail(activeViewRef.current.id, { history: "none" }))}
      /> : null}
      {!selected && dialogError && !editing ? <div className="epp-toast" role="alert">{dialogError}</div> : null}
    </main>
  );
}
