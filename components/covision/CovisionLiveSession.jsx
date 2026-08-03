"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import useStationFlight from "@/components/register/useStationFlight";
import Dropdown from "@/components/ui/Dropdown";
import Form from "@/components/ui/Form";
import Input from "@/components/ui/Input";
import {
  COVISION_STAGE_COMPLETION_PHASES,
  COVISION_STAGE_PROGRESS_PHASES,
  COVISION_STAGE_WORK_OBJECT_KINDS,
  evaluateCovisionStageGate
} from "@/lib/covisionSessionShared";

const ACTIONS = Object.freeze({
  start: "START_SESSION",
  confirmParticipant: "CONFIRM_PARTICIPANT",
  confirmCase: "CONFIRM_CASE",
  confirmSettings: "CONFIRM_SETTINGS",
  inviteParticipant: "INVITE_PARTICIPANT",
  setPhase: "SET_PHASE",
  submitWorkItem: "SUBMIT_WORK_ITEM",
  savePrivateState: "SAVE_PRIVATE_STATE",
  updateWorkItem: "UPDATE_WORK_ITEM",
  completeStage: "COMPLETE_STAGE",
  pause: "PAUSE",
  resume: "RESUME"
});

const STAGE_NUMBERS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);

const MANAGER_ROLES = new Set([
  "OWNER",
  "CO_MODERATOR",
  "SUMMARY_REVIEWER",
  "meeting_starter",
  "meeting_leader",
  "session_leader",
  "case_owner",
  "summary_keeper"
]);

const LEADER_ROLES = new Set([
  "OWNER",
  "CO_MODERATOR",
  "meeting_starter",
  "meeting_leader",
  "session_leader",
  "case_owner"
]);

const OWNER_ROLES = new Set(["OWNER", "case_owner"]);
const NON_PROGRESS_PHASES = new Set(["paused", "blocked", "stage_incomplete"]);

function copyObject(t) {
  const value = t("covision.live");
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function copyValue(copy, path, fallback = "") {
  let value = copy;
  for (const part of String(path).split(".")) {
    if (!value || typeof value !== "object") return fallback;
    value = value[part];
  }
  return typeof value === "string" ? value : fallback;
}

function formatCopy(template, values = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match
  ));
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function lower(value, fallback = "") {
  return typeof value === "string" ? value.toLowerCase() : fallback;
}

function contentOf(record) {
  return record?.content && typeof record.content === "object" && !Array.isArray(record.content)
    ? record.content
    : {};
}

function firstText(value, copy) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const keys = [
    "text",
    "title",
    "question",
    "reflection",
    "possibility",
    "resource",
    "selectedDirection",
    "progressMarker",
    "summary",
    "description"
  ];
  for (const key of keys) {
    if (typeof value[key] === "string" && value[key].trim()) return value[key].trim();
  }
  if (value.nextStep && typeof value.nextStep.text === "string") return value.nextStep.text.trim();
  if (value.followUp && typeof value.followUp.when === "string") {
    return `${copyValue(copy, "ui.follow_up_prefix")} ${value.followUp.when}`;
  }
  return "";
}

function normalizeModel(snapshot) {
  const session = snapshot?.session && typeof snapshot.session === "object" ? snapshot.session : {};
  return {
    covisionCase: snapshot?.case || {},
    session,
    me: snapshot?.me || snapshot?.capabilities?.me || {},
    participants: list(snapshot?.participants),
    items: list(snapshot?.items ?? session.workItems),
    privateStates: list(snapshot?.privateStates ?? session.privateStates),
    snapshots: list(snapshot?.snapshots ?? session.stageSnapshots),
    capabilities: snapshot?.capabilities || session.capabilities || {},
    serverNow: snapshot?.serverNow ?? session.serverNow ?? null
  };
}

function stageKinds(stage) {
  return list(COVISION_STAGE_WORK_OBJECT_KINDS?.[stage]);
}

function currentStageItems(items, stage) {
  return items.filter((item) => Number(item?.stage) === stage && lower(item?.visibility, "shared") === "shared");
}

function currentPrivateStates(states, stage) {
  return states.filter((item) => Number(item?.stage) === stage);
}

function workObjectEvidence(items) {
  return items.map((item) => {
    const content = contentOf(item);
    return {
      id: String(item.id || ""),
      kind: String(item.kind || ""),
      status: lower(item.status, "shared_draft"),
      visibility: lower(item.visibility, "shared"),
      ...(content.critical === true ? { critical: true } : {}),
      ...(typeof content.resolutionStatus === "string"
        ? { resolutionStatus: lower(content.resolutionStatus) }
        : {})
    };
  });
}

function contentValue(records, key) {
  for (const record of [...records].reverse()) {
    const content = contentOf(record);
    if (Object.prototype.hasOwnProperty.call(content, key)) return content[key];
  }
  return undefined;
}

function stateByKind(records, kind) {
  return records.find((record) => record?.kind === kind) || null;
}

function mapRole(role) {
  const value = String(role || "PARTICIPANT");
  const roles = {
    OWNER: "case_owner",
    CO_MODERATOR: "session_leader",
    SUMMARY_REVIEWER: "summary_keeper",
    PARTICIPANT: "participant",
    OBSERVER: "observer"
  };
  return roles[value] || value;
}

function participantEvidence(participants) {
  return participants
    .filter((participant) => participant?.inviteStatus === "ACCEPTED")
    .map((participant) => {
      const state = participant?.state || participant?.sessionState || {};
      const role = mapRole(participant?.role);
      return {
        participantId: String(participant?.id || participant?.participantId || ""),
        role,
        roleConfirmed: Boolean(state.roleConfirmedAt ?? participant?.roleConfirmed),
        agreementConfirmed: Boolean(state.agreementConfirmedAt ?? participant?.agreementConfirmed),
        ready: Boolean(state.readyAt ?? participant?.ready),
        ...(role === "observer"
          ? { observerConsent: Boolean(state.agreementConfirmedAt ?? participant?.observerConsent) }
          : {})
      };
    });
}

function structuredState(records, kind, key) {
  const content = contentOf(stateByKind(records, kind));
  const value = content[key] ?? content;
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function stageSevenConfirmationIsFresh(privateStates) {
  const kinds = new Set(["selected_direction", "next_step", "progress_marker", "follow_up"]);
  const relevant = privateStates.filter((state) => kinds.has(state.kind));
  const confirmation = stateByKind(relevant, "follow_up");
  if (contentOf(confirmation).ownerConfirmed !== true) return false;
  const confirmationAt = new Date(confirmation?.updatedAt || 0).getTime();
  const latestEditAt = Math.max(
    ...relevant.map((state) => new Date(state.updatedAt || 0).getTime())
  );
  return Number.isFinite(confirmationAt)
    && Number.isFinite(latestEditAt)
    && confirmationAt >= latestEditAt;
}

function buildEvidence({ stage, session, participants, items, privateStates }) {
  const workObjects = workObjectEvidence(items);
  const hasBlockingSafetyOrPrivacyIssue = session?.settings?.hasBlockingSafetyOrPrivacyIssue === true
    || [...items, ...privateStates].some(
      (record) => contentOf(record).hasBlockingSafetyOrPrivacyIssue === true
    );

  if (stage === 1) {
    return {
      participants: participantEvidence(participants),
      caseConfirmed: Boolean(session.caseConfirmedAt),
      settingsConfirmed: Boolean(session.settingsConfirmedAt),
      hasBlockingSafetyOrPrivacyIssue
    };
  }
  if (stage === 2) {
    return {
      workObjects,
      ownerPictureConfirmed: contentValue(privateStates, "ownerPictureConfirmed") === true,
      ownerFocusConfirmed: contentValue(privateStates, "ownerFocusConfirmed") === true,
      privacyReviewed: contentValue([...items, ...privateStates], "privacyReviewed") === true,
      hasBlockingSafetyOrPrivacyIssue
    };
  }
  if (stage === 3) {
    return {
      workObjects,
      ownerEnough: contentValue(privateStates, "ownerEnough") === true,
      hasBlockingSafetyOrPrivacyIssue
    };
  }
  if (stage === 4) {
    return {
      workObjects,
      ownerReady: contentValue(privateStates, "ownerReady") === true,
      hasBlockingSafetyOrPrivacyIssue
    };
  }
  if (stage === 5) {
    const active = items.find((item) => lower(item?.status) === "active");
    return {
      workObjects,
      activeObjectId: active?.id || null,
      ownerResonanceReady: contentValue(privateStates, "ownerResonanceReady") === true,
      hasBlockingSafetyOrPrivacyIssue
    };
  }
  if (stage === 6) {
    const active = items.find((item) => lower(item?.status) === "active");
    return {
      workObjects,
      activeObjectId: active?.id || null,
      impactReviewed: contentValue([...items, ...privateStates], "impactReviewed") === true,
      ownerReady: contentValue(privateStates, "ownerReady") === true,
      hasBlockingSafetyOrPrivacyIssue
    };
  }
  if (stage === 7) {
    const selected = contentOf(stateByKind(privateStates, "selected_direction"));
    const marker = contentOf(stateByKind(privateStates, "progress_marker"));
    return {
      selectedDirection: selected.selectedDirection || selected.text || null,
      nextStep: structuredState(privateStates, "next_step", "nextStep"),
      timeframe: contentValue(privateStates, "timeframe") || null,
      progressMarker: marker.progressMarker || marker.text || contentValue(privateStates, "progressMarker") || null,
      followUp: structuredState(privateStates, "follow_up", "followUp"),
      ownerConfirmed: contentValue(privateStates, "ownerConfirmed") === true,
      hasBlockingSafetyOrPrivacyIssue
    };
  }
  return {
    workObjects,
    packageConfirmed: contentValue(privateStates, "packageConfirmed") === true,
    followUpConfirmed: contentValue(privateStates, "followUpConfirmed") === true,
    generalizationDecision: contentValue(privateStates, "generalizationDecision") || null,
    learningDecision: contentValue(privateStates, "learningDecision") || null,
    retentionDecision: contentValue(privateStates, "retentionDecision") || null,
    practiceDecision: contentValue(privateStates, "practiceDecision") || null,
    ownerFinalConfirmed: contentValue(privateStates, "ownerFinalConfirmed") === true,
    hasBlockingSafetyOrPrivacyIssue
  };
}

function formatClock(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function useSessionClock(serverNow) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const serverTime = new Date(serverNow || 0).getTime();
  return Number.isFinite(serverTime) && serverTime > 0
    ? serverTime + tick * 1000
    : Date.now();
}

function participantName(participant, index, copy) {
  const candidate = participant?.displayName
    || participant?.name
    || participant?.user?.displayName
    || participant?.user?.name;
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : formatCopy(copyValue(copy, "ui.participant_fallback"), { number: index + 1 });
}

function roleLabel(role, copy) {
  return copyValue(copy, `roles.${role}`, String(role || "").toLowerCase().replaceAll("_", " "));
}

function kindLabel(kind, copy) {
  return copyValue(copy, `kinds.${kind}`, String(kind || "").replaceAll("_", " "));
}

function phaseLabel(phase, copy) {
  return copyValue(copy, `phases.${phase}`, String(phase || "").replaceAll("_", " "));
}

function statusLabel(status, copy) {
  return copyValue(copy, `statuses.${status}`, String(status || "").replaceAll("_", " "));
}

function nextCanonicalPhase(stage, phase) {
  if (NON_PROGRESS_PHASES.has(phase)) return null;
  const sequence = list(COVISION_STAGE_PROGRESS_PHASES?.[stage]);
  const currentIndex = sequence.indexOf(phase);
  return currentIndex >= 0 ? sequence[currentIndex + 1] || null : null;
}

function InvitationAcceptance({ participant, me, busy, dispatchAction, copy }) {
  const state = participant?.state || participant?.sessionState || {};
  const roleConfirmed = Boolean(state.roleConfirmedAt ?? participant?.roleConfirmed);
  const agreementConfirmed = Boolean(state.agreementConfirmedAt ?? participant?.agreementConfirmed);
  const ready = Boolean(state.readyAt ?? participant?.ready);
  return (
    <main className="cvl-shell" aria-busy={busy}>
      <div className="cvl-lower-workspace">
      <section className="cvl-stage-seven cvl-private" aria-labelledby="cvl-invitation-title">
        <span className="cvl-session-sigil" aria-hidden="true">{copyValue(copy, "ui.sigil")}</span>
        <p className="cvl-kind">{copyValue(copy, "invitation.kicker")}</p>
        <h1 id="cvl-invitation-title">{copyValue(copy, "invitation.title")}</h1>
        <p>{copyValue(copy, "invitation.privacy_notice")}</p>
        <dl>
          <div><dt>{copyValue(copy, "ui.your_role")}</dt><dd>{roleLabel(me?.role, copy)}</dd></div>
          <div><dt>{copyValue(copy, "invitation.access")}</dt><dd>{agreementConfirmed ? copyValue(copy, "invitation.access_accepted") : copyValue(copy, "invitation.access_locked")}</dd></div>
        </dl>
        <div className="cvl-confirm-stack" aria-label={copyValue(copy, "invitation.steps_aria")}>
          <button
            type="button"
            disabled={busy || roleConfirmed}
            onClick={() => dispatchAction(ACTIONS.confirmParticipant, { present: true, roleConfirmed: true })}
          >
            <span>{roleConfirmed ? "✓" : "1"}</span>
            {copyValue(copy, "actions.confirm_role")}
          </button>
          <button
            type="button"
            disabled={busy || !roleConfirmed || agreementConfirmed}
            onClick={() => dispatchAction(ACTIONS.confirmParticipant, { agreementConfirmed: true })}
          >
            <span>{agreementConfirmed ? "✓" : "2"}</span>
            {copyValue(copy, "actions.accept_agreement")}
          </button>
          <button
            type="button"
            disabled={busy || !agreementConfirmed || ready}
            onClick={() => dispatchAction(ACTIONS.confirmParticipant, { ready: true })}
          >
            <span>{ready ? "✓" : "3"}</span>
            {copyValue(copy, "actions.ready")}
          </button>
        </div>
        <small>{copyValue(copy, "invitation.reload_notice")}</small>
      </section>
      </div>
    </main>
  );
}

/* Jaamanav — etapi OSADE (jaamade) vahetus. Vaatamine on vaba: chip viib
   jaama igal hetkel; töö järjekorda hoiavad serveriväravad, mitte nav. */
function StationNav({ stations, activeIndex, flyTo, copy }) {
  return (
    <nav className="cvf-station-nav" aria-label={copyValue(copy, "stations.nav_aria")}>
      <button
        type="button"
        className="cvf-station-arrow"
        disabled={activeIndex <= 0}
        onClick={() => flyTo(activeIndex - 1)}
        aria-label={copyValue(copy, "stations.back")}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <div className="cvf-station-chips">
        {stations.map((def, index) => (
          <button
            key={def.key}
            type="button"
            className={`cvf-station-chip ${index === activeIndex ? "is-active" : ""}`}
            aria-current={index === activeIndex ? "true" : undefined}
            onClick={() => flyTo(index)}
          >
            {copyValue(copy, `stations.${def.key}`)}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="cvf-station-arrow"
        disabled={activeIndex >= stations.length - 1}
        onClick={() => flyTo(activeIndex + 1)}
        aria-label={copyValue(copy, "stations.next")}
      >
        <span aria-hidden="true">›</span>
      </button>
    </nav>
  );
}

/* Etapidokk — etapid 1–8 alumises kiirmenüü paneelis (sama .gc-shortcut-*
   DNA mis avalehe kaardimenüüs ja registreerimise dokis). Dokk on
   asukohanäit + vaatamise nav, MITTE väravast möödapääs: tulevane etapp
   on lukus koos põhjusega, läbitud etapi klõps viib Kompassi jälje juurde. */
function StageDock({ stage, snapshots, completed, copy, onSelect }) {
  const completedStages = new Set(snapshots.map((item) => Number(item?.stage)));
  return (
    <nav className="cvf-stage-dock gc-shortcut-menu" aria-label={copyValue(copy, "stations.dock_aria")}>
      <div className="gc-shortcut-track">
        {STAGE_NUMBERS.map((value) => {
          const meta = copy?.stages?.[value] || {};
          const done = completed || completedStages.has(value) || value < stage;
          const state = done ? "done" : value === stage ? "active" : "future";
          const stateHint = state === "future"
            ? copyValue(copy, "stations.dock_locked")
            : state === "done"
              ? copyValue(copy, "stations.dock_done")
              : copyValue(copy, "stations.dock_active");
          return (
            <button
              key={value}
              type="button"
              className="gc-shortcut"
              data-on={state === "active" ? "1" : "0"}
              data-state={state}
              disabled={state === "future"}
              aria-current={!completed && value === stage ? "step" : undefined}
              aria-label={formatCopy(copyValue(copy, "stations.dock_step"), {
                number: value,
                label: meta.short || "",
                state: stateHint
              })}
              onClick={() => onSelect(state)}
            >
              <span className="gc-shortcut-icon" aria-hidden="true">
                <span className="cvf-dock-num">{done ? "✓" : value}</span>
              </span>
              <span className="gc-shortcut-text" aria-hidden="true">{meta.short}</span>
              <span className="gc-shortcut-tooltip" aria-hidden="true">{stateHint}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ParticipantList({ participants, me, stage, busy, dispatchAction, copy }) {
  const myParticipant = participants.find((item) => (
    item?.id === me?.participantId || (me?.userId && item?.userId === me.userId)
  ));
  const myState = myParticipant?.state || myParticipant?.sessionState || {};

  return (
    <section className="cvl-side-section" aria-labelledby="cvl-participants-title">
      <header className="cvl-section-heading">
        <div>
          <p>{copyValue(copy, "ui.shared_circle")}</p>
          <h2 id="cvl-participants-title">{copyValue(copy, "ui.participants")}</h2>
        </div>
        <span>{participants.length}</span>
      </header>
      <ul className="cvl-participants">
        {participants.map((participant, index) => {
          const state = participant?.state || participant?.sessionState || {};
          const ready = Boolean(state.readyAt ?? participant?.ready);
          const current = participant?.id === me?.participantId || (me?.userId && participant?.userId === me.userId);
          const name = participantName(participant, index, copy);
          const invited = participant?.inviteStatus === "INVITED";
          return (
            <li key={participant?.id || `${participant?.role}-${index}`} className={current ? "is-current" : ""}>
              <span className="cvl-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
              <span className="cvl-person-copy">
                <strong>{name}{current ? copyValue(copy, "ui.current_user_suffix") : ""}</strong>
                <small>{roleLabel(participant?.role, copy)}{invited ? copyValue(copy, "ui.invited_suffix") : ""}</small>
              </span>
              <span className={`cvl-readiness ${ready ? "is-ready" : ""}`} title={ready ? copyValue(copy, "ui.ready") : copyValue(copy, "ui.readiness_unconfirmed")}>
                <span aria-hidden="true" />
                <span className="cvl-sr-only">{ready ? copyValue(copy, "ui.ready") : copyValue(copy, "ui.readiness_unconfirmed")}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {stage === 1 && myParticipant ? (
        <div className="cvl-confirm-stack" aria-label={copyValue(copy, "ui.my_confirmations")}>
          <button
            type="button"
            disabled={busy || Boolean(myState.roleConfirmedAt)}
            onClick={() => dispatchAction(ACTIONS.confirmParticipant, { present: true, roleConfirmed: true })}
          >
            <span>{myState.roleConfirmedAt ? "✓" : "1"}</span>
            {copyValue(copy, "actions.confirm_role")}
          </button>
          <button
            type="button"
            disabled={busy || !myState.roleConfirmedAt || Boolean(myState.agreementConfirmedAt)}
            onClick={() => dispatchAction(ACTIONS.confirmParticipant, { agreementConfirmed: true })}
          >
            <span>{myState.agreementConfirmedAt ? "✓" : "2"}</span>
            {copyValue(copy, "actions.accept_agreement")}
          </button>
          <button
            type="button"
            disabled={busy || !myState.agreementConfirmedAt || Boolean(myState.readyAt)}
            onClick={() => dispatchAction(ACTIONS.confirmParticipant, { ready: true })}
          >
            <span>{myState.readyAt ? "✓" : "3"}</span>
            {copyValue(copy, "actions.ready")}
          </button>
        </div>
      ) : null}
    </section>
  );
}

const CARD_NUDGE = 14;
const CARD_NUDGE_LARGE = 48;

function GripIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 24" focusable="false">
      <circle cx="6" cy="6" r="1.6" />
      <circle cx="12" cy="6" r="1.6" />
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="6" cy="18" r="1.6" />
      <circle cx="12" cy="18" r="1.6" />
    </svg>
  );
}

function ItemCard({
  item,
  hero = false,
  canManage,
  busy,
  dispatchAction,
  copy,
  movable = false,
  offset = { x: 0, y: 0 },
  isFront = false,
  isMoving = false,
  registerRef,
  dragHandlers,
  onNudge
}) {
  const status = lower(item?.status, "shared_draft");
  const text = firstText(contentOf(item), copy);
  const closed = ["closed", "parked", "withdrawn", "completed"].includes(status);
  const positioned = offset.x !== 0 || offset.y !== 0;
  return (
    <article
      ref={movable && registerRef ? (el) => registerRef(item?.id, el) : undefined}
      className={`cvl-card ${hero ? "cvl-hero" : ""} is-${status}`}
      data-front={movable && isFront ? "true" : undefined}
      data-moving={movable && isMoving ? "true" : undefined}
      data-positioned={movable && positioned ? "true" : undefined}
      style={movable ? { "--cvl-drag-x": `${offset.x}px`, "--cvl-drag-y": `${offset.y}px` } : undefined}
    >
      <header>
        {movable ? (
          <button
            type="button"
            className="cvl-drag-handle"
            aria-label={formatCopy(copyValue(copy, "spatial.drag_handle"), { title: kindLabel(item?.kind, copy) })}
            aria-describedby="cvl-move-instructions"
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home"
            title={copyValue(copy, "spatial.move_hint")}
            onPointerDown={(event) => dragHandlers?.begin(event, item)}
            onPointerMove={dragHandlers?.move}
            onPointerUp={(event) => dragHandlers?.end(event)}
            onPointerCancel={(event) => dragHandlers?.end(event, { cancelled: true })}
            onKeyDown={(event) => onNudge?.(event, item)}
          >
            <GripIcon />
          </button>
        ) : null}
        <span className="cvl-kind">{kindLabel(item?.kind, copy)}</span>
        <span className="cvl-status">{statusLabel(status, copy)}</span>
      </header>
      <p>{text || copyValue(copy, "ui.card_content_hidden")}</p>
      {item?.sourceLabel ? <small className="cvl-source">{copyValue(copy, "ui.related_prefix")} {item.sourceLabel}</small> : null}
      {canManage && item?.id ? (
        <div className="cvl-card-actions">
          {status !== "active" && !closed ? (
            <button
              type="button"
              data-variant
              disabled={busy}
              onClick={() => dispatchAction(ACTIONS.updateWorkItem, { id: item.id, status: "active" })}
            >
              {copyValue(copy, "actions.focus_card")}
            </button>
          ) : null}
          {status === "active" ? (
            <button
              type="button"
              data-variant
              disabled={busy}
              onClick={() => dispatchAction(ACTIONS.updateWorkItem, { id: item.id, status: "shared" })}
            >
              {copyValue(copy, "actions.mark_shared")}
            </button>
          ) : null}
          {!closed ? (
            <button
              type="button"
              data-variant
              disabled={busy}
              onClick={() => dispatchAction(ACTIONS.updateWorkItem, { id: item.id, status: "parked" })}
            >
              {copyValue(copy, "actions.park")}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/* Laud = liigutatav ruum (omanik 20.07: „pane kastide asemele liigutatavad
   kastid nagu teemaseemnetel"). Jagatud kaardid seisavad voolus ja iga kaart
   kannab drag-nihet (--cvl-drag-x/y) pidemest lohistades või nooleklahvidega;
   piirid arvutatakse canvas'ist (kest ei keri, R5.0). Muster = TeemaseemnedPage
   pointer-drag, ilma suuruse muutmiseta. */
function WorkField({ items, stage, canManage, busy, dispatchAction, copy }) {
  const active = items.find((item) => lower(item?.status) === "active") || items.at(-1) || null;
  const meta = copy?.stages?.[stage] || {};
  const [offsets, setOffsets] = useState({});
  const [movingId, setMovingId] = useState(null);
  const [frontId, setFrontId] = useState(null);
  const [notice, setNotice] = useState("");
  const boundsRef = useRef(null);
  const cardRefs = useRef(new Map());
  const dragRef = useRef(null);

  const registerRef = useCallback((id, el) => {
    if (!id) return;
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  const getOffset = useCallback((id) => offsets[id] || { x: 0, y: 0 }, [offsets]);

  const getBounds = useCallback((cardEl, currentOffset) => {
    const boundsEl = boundsRef.current;
    if (!boundsEl || !cardEl) return null;
    const b = boundsEl.getBoundingClientRect();
    const c = cardEl.getBoundingClientRect();
    const baseLeft = c.left - currentOffset.x;
    const baseTop = c.top - currentOffset.y;
    const inset = 6;
    return {
      minX: b.left + inset - baseLeft,
      maxX: b.right - inset - (baseLeft + c.width),
      minY: b.top + inset - baseTop,
      maxY: b.bottom - inset - (baseTop + c.height)
    };
  }, []);

  const constrain = useCallback((o, bounds) => {
    if (!bounds) return o;
    return {
      x: Math.round(Math.min(Math.max(o.x, bounds.minX), bounds.maxX)),
      y: Math.round(Math.min(Math.max(o.y, bounds.minY), bounds.maxY))
    };
  }, []);

  const applyLive = useCallback((el, o) => {
    if (!el) return;
    el.style.setProperty("--cvl-drag-x", `${o.x}px`);
    el.style.setProperty("--cvl-drag-y", `${o.y}px`);
  }, []);

  const dragHandlers = useMemo(() => ({
    begin(event, item) {
      if (event.button !== 0 || !item?.id) return;
      const cardEl = cardRefs.current.get(item.id);
      if (!cardEl) return;
      const initial = getOffset(item.id);
      dragRef.current = {
        item,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        initial,
        latest: initial,
        bounds: getBounds(cardEl, initial),
        cardEl
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setFrontId(item.id);
      setMovingId(item.id);
      setNotice(formatCopy(copyValue(copy, "spatial.moving"), { title: kindLabel(item.kind, copy) }));
    },
    move(event) {
      const d = dragRef.current;
      if (!d || d.pointerId !== event.pointerId) return;
      const next = constrain(
        { x: d.initial.x + event.clientX - d.startX, y: d.initial.y + event.clientY - d.startY },
        d.bounds
      );
      d.latest = next;
      applyLive(d.cardEl, next);
    },
    end(event, { cancelled = false } = {}) {
      const d = dragRef.current;
      if (!d || d.pointerId !== event.pointerId) return;
      const final = cancelled ? d.initial : d.latest;
      applyLive(d.cardEl, final);
      if (!cancelled) {
        setOffsets((prev) => ({ ...prev, [d.item.id]: final }));
        setNotice(formatCopy(copyValue(copy, "spatial.moved"), { title: kindLabel(d.item.kind, copy) }));
      }
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      dragRef.current = null;
      setMovingId(null);
    }
  }), [applyLive, constrain, copy, getBounds, getOffset]);

  const onNudge = useCallback((event, item) => {
    if (!item?.id) return;
    if (event.key === "Home") {
      event.preventDefault();
      setFrontId(item.id);
      setOffsets((prev) => ({ ...prev, [item.id]: { x: 0, y: 0 } }));
      setNotice(formatCopy(copyValue(copy, "spatial.reset_one"), { title: kindLabel(item.kind, copy) }));
      return;
    }
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!dir) return;
    event.preventDefault();
    setFrontId(item.id);
    const current = getOffset(item.id);
    const cardEl = cardRefs.current.get(item.id);
    const step = event.shiftKey ? CARD_NUDGE_LARGE : CARD_NUDGE;
    const next = constrain(
      { x: current.x + dir[0] * step, y: current.y + dir[1] * step },
      getBounds(cardEl, current)
    );
    setOffsets((prev) => ({ ...prev, [item.id]: next }));
    setNotice(formatCopy(copyValue(copy, "spatial.moved"), { title: kindLabel(item.kind, copy) }));
  }, [constrain, copy, getBounds, getOffset]);

  const hasAdjusted = Object.values(offsets).some((o) => o.x !== 0 || o.y !== 0);
  const resetLayout = useCallback(() => {
    setOffsets({});
    setNotice(copyValue(copy, "spatial.reset_notice"));
  }, [copy]);

  return (
    <section className="cvl-work-field" aria-labelledby="cvl-work-title">
      <header className="cvl-work-heading">
        <div>
          <p>{meta.eyebrow}</p>
          <h2 id="cvl-work-title">{meta.title}</h2>
        </div>
        <span className="cvl-phase-chip">{formatCopy(copyValue(copy, "ui.shared_cards_count"), { count: items.length })}</span>
      </header>
      <p className="cvl-stage-lead">{meta.lead}</p>
      <p id="cvl-move-instructions" className="cvl-sr-only">{copyValue(copy, "spatial.move_hint")}</p>
      <div className="cvl-canvas" data-stage={stage} ref={boundsRef}>
        {items.length ? (
          <div className="cvl-card-field" aria-label={copyValue(copy, "ui.supporting_cards_aria")}>
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                hero={item === active}
                canManage={canManage}
                busy={busy}
                dispatchAction={dispatchAction}
                copy={copy}
                movable
                offset={getOffset(item.id)}
                isFront={frontId === item.id}
                isMoving={movingId === item.id}
                registerRef={registerRef}
                dragHandlers={dragHandlers}
                onNudge={onNudge}
              />
            ))}
          </div>
        ) : (
          <div className="cvl-hero-slot">
            <article className="cvl-card cvl-hero cvl-empty-hero">
              <span className="cvl-kind">{copyValue(copy, "ui.stage_focus")}</span>
              <p>{meta.hero}</p>
              <small>{copyValue(copy, "ui.first_shared_card_hint")}</small>
            </article>
          </div>
        )}
        {hasAdjusted ? (
          <button type="button" data-variant className="cvl-layout-reset" onClick={resetLayout}>
            {copyValue(copy, "spatial.reset_layout")}
          </button>
        ) : null}
      </div>
      <span className="cvl-sr-only" role="status" aria-live="polite">{notice}</span>
    </section>
  );
}

function ContinuityPanel({ stage, items, snapshots, completed, copy }) {
  if (completed) {
    return (
      <section className="cvl-side-section" aria-labelledby="cvl-continuity-title">
        <header className="cvl-section-heading">
          <div>
            <p>{copyValue(copy, "continuity.kicker")}</p>
            <h2 id="cvl-continuity-title">{copyValue(copy, "continuity.completed_title")}</h2>
          </div>
        </header>
        <p className="cvl-muted">{copyValue(copy, "continuity.completed_body")}</p>
        <Link href="/lopetatud-juhtumid">{copyValue(copy, "continuity.open_completed")}</Link>
      </section>
    );
  }

  const sharedContext = items.filter((item) => {
    if (lower(item?.visibility, "shared") !== "shared") return false;
    const itemStage = Number(item?.stage);
    return (stage >= 3 && itemStage === 2 && ["case_anchor", "case_core"].includes(item?.kind))
      || (stage >= 4 && itemStage === 3 && item?.kind === "question");
  });
  const stageSevenSnapshot = stage === 8
    ? snapshots.find((item) => Number(item?.stage) === 7)
    : null;
  const stageSevenEvidence = stageSevenSnapshot?.payload?.evidence;
  const confirmedStageSeven = stageSevenEvidence?.ownerConfirmed === true ? stageSevenEvidence : null;
  if (!sharedContext.length && !confirmedStageSeven) return null;

  const summaryRows = confirmedStageSeven ? [
    [copyValue(copy, "continuity.selected_direction"), confirmedStageSeven.selectedDirection],
    [copyValue(copy, "continuity.next_step"), confirmedStageSeven.nextStep?.text],
    [copyValue(copy, "continuity.timeframe"), confirmedStageSeven.timeframe],
    [copyValue(copy, "continuity.progress_marker"), confirmedStageSeven.progressMarker],
    [copyValue(copy, "continuity.follow_up"), confirmedStageSeven.followUp?.when]
  ].filter(([, value]) => typeof value === "string" && value.trim()) : [];

  return (
    <section className="cvl-side-section" aria-labelledby="cvl-continuity-title">
      <header className="cvl-section-heading">
        <div><p>{copyValue(copy, "continuity.kicker")}</p><h2 id="cvl-continuity-title">{copyValue(copy, "continuity.title")}</h2></div>
        <span>{sharedContext.length + summaryRows.length}</span>
      </header>
      {sharedContext.length ? (
        <ol className="cvl-queue">
          {sharedContext.map((item) => (
            <li key={item.id}>
              <span>{kindLabel(item.kind, copy)}</span>
              <small>{firstText(contentOf(item), copy)}</small>
            </li>
          ))}
        </ol>
      ) : null}
      {summaryRows.length ? (
        <dl className="cvl-guidance">
          {summaryRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      ) : null}
      <p className="cvl-private-note">{copyValue(copy, "continuity.read_only_notice")}</p>
    </section>
  );
}

function Composer({ stage, canWrite, isOwner, paused, busy, dispatchAction, copy, prefillText = "" }) {
  const kinds = stageKinds(stage);
  const [mode, setMode] = useState(
    stage === 7 || (stage === 2 && Boolean(prefillText.trim())) ? "private" : "shared"
  );
  const [kind, setKind] = useState(kinds[0] || "");
  const [text, setText] = useState(stage === 2 ? prefillText : "");
  const [sourceLabel, setSourceLabel] = useState("");
  const previousStageRef = useRef(stage);
  const appliedPrefillRef = useRef(stage === 2 ? prefillText : "");
  const modeTouchedRef = useRef(false);

  useEffect(() => {
    if (previousStageRef.current === stage) {
      if (stage === 2 && prefillText && appliedPrefillRef.current !== prefillText) {
        appliedPrefillRef.current = prefillText;
        setText((current) => current.trim() ? current : prefillText);
        if (!modeTouchedRef.current) setMode("private");
      }
      return;
    }

    previousStageRef.current = stage;
    appliedPrefillRef.current = stage === 2 ? prefillText : "";
    modeTouchedRef.current = false;
    const nextKinds = stageKinds(stage);
    setMode(stage === 7 || (stage === 2 && Boolean(prefillText.trim())) ? "private" : "shared");
    setKind(nextKinds[0] || "");
    setText(stage === 2 ? prefillText : "");
    setSourceLabel("");
  }, [prefillText, stage]);

  const chooseMode = (nextMode) => {
    modeTouchedRef.current = true;
    setMode(nextMode);
  };

  if (!canWrite || stage === 1 || (stage === 7 && !isOwner)) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (!kind || !text.trim() || (paused && mode === "shared")) return;
    const payload = {
      stage,
      kind,
      content: { text: text.trim() }
    };
    const result = mode === "private"
      ? await dispatchAction(ACTIONS.savePrivateState, payload)
      : await dispatchAction(ACTIONS.submitWorkItem, {
        ...payload,
        status: "shared",
        ...(sourceLabel.trim() ? { sourceLabel: sourceLabel.trim() } : {})
      });
    if (!result) return;
    setText("");
    setSourceLabel("");
  };

  return (
    <section className={`cvl-composer ${mode === "private" ? "cvl-private" : ""}`} aria-labelledby="cvl-composer-title">
      <header>
        <div>
          <p>{mode === "private" ? copyValue(copy, "ui.only_your_workspace") : copyValue(copy, "ui.to_shared_circle")}</p>
          <h2 id="cvl-composer-title">{mode === "private" ? copyValue(copy, "ui.private_draft") : copyValue(copy, "ui.add_shared_card")}</h2>
        </div>
        {mode === "private" ? <span className="cvl-lock" aria-label={copyValue(copy, "ui.private_aria")}>⌁</span> : null}
      </header>
      <div className="cvl-mode-switch" aria-label={copyValue(copy, "ui.card_visibility_aria")}>
        <button type="button" disabled={paused} className={mode === "shared" ? "is-active" : ""} onClick={() => chooseMode("shared")}>{copyValue(copy, "ui.shared")}</button>
        <button type="button" className={mode === "private" ? "is-active" : ""} onClick={() => chooseMode("private")}>{copyValue(copy, "ui.private")}</button>
      </div>
      <Form onSubmit={submit}>
        <label>
          {copyValue(copy, "fields.card_kind")}
          <Dropdown
            value={kind}
            onChange={setKind}
            ariaLabel={copyValue(copy, "fields.card_kind")}
            options={kinds.map((value) => ({ value, label: kindLabel(value, copy) }))}
          />
        </label>
        <label>
          {copyValue(copy, "fields.wording")}
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={4}
            maxLength={4000}
            placeholder={stage === 3 ? copyValue(copy, "placeholders.question") : copyValue(copy, "placeholders.clear_thought")}
          />
        </label>
        {mode === "shared" ? (
          <label>
            {copyValue(copy, "fields.source")} <small>{copyValue(copy, "ui.optional")}</small>
            <Input value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} maxLength={240} />
          </label>
        ) : (
          <p className="cvl-private-note">{copyValue(copy, "ui.private_draft_notice")}</p>
        )}
        <button type="submit" className="cvl-primary" disabled={busy || !text.trim() || (paused && mode === "shared")}>
          {mode === "private" ? copyValue(copy, "actions.save_private") : copyValue(copy, "actions.share_with_circle")}
        </button>
      </Form>
    </section>
  );
}

function FlagButton({ active, disabled, children, onClick }) {
  return (
    <button type="button" className={`cvl-flag ${active ? "is-active" : ""}`} disabled={disabled || active} onClick={onClick}>
      <span aria-hidden="true">{active ? "✓" : "○"}</span>
      {children}
    </button>
  );
}

function StageOneControls({ session, covisionCase, isOwner, canLead, busy, dispatchAction, copy }) {
  const [durationMinutes, setDurationMinutes] = useState(String(session?.settings?.durationMinutes || 90));
  const [supportRule, setSupportRule] = useState(session?.settings?.supportRule || copyValue(copy, "defaults.support_rule"));
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("PARTICIPANT");

  const saveSettings = (event) => {
    event.preventDefault();
    dispatchAction(ACTIONS.confirmSettings, {
      settings: {
        durationMinutes: Math.max(30, Math.min(240, Number(durationMinutes) || 90)),
        supportRule: supportRule.trim(),
        privacyBoundary: copyValue(copy, "defaults.privacy_boundary"),
        hasBlockingSafetyOrPrivacyIssue: false
      }
    });
  };

  const invite = async (event) => {
    event.preventDefault();
    if (!inviteEmail.trim()) return;
    const result = await dispatchAction(ACTIONS.inviteParticipant, {
      email: inviteEmail.trim(),
      role: inviteRole
    });
    if (result) setInviteEmail("");
  };

  return (
    <section className="cvl-stage-controls" aria-labelledby="cvl-stage-one-actions">
      <header>
        <p>{copyValue(copy, "ui.personal_responsibility")}</p>
        <h2 id="cvl-stage-one-actions">{copyValue(copy, "ui.opening_confirmations")}</h2>
      </header>
      {isOwner ? (
        <FlagButton
          active={Boolean(session.caseConfirmedAt)}
          disabled={busy}
          onClick={() => dispatchAction(ACTIONS.confirmCase, {})}
        >
          {copyValue(copy, "actions.confirm_case_boundary")}
        </FlagButton>
      ) : (
        <p className="cvl-muted">{copyValue(copy, "ui.owner_confirms_boundary")}</p>
      )}
      {canLead ? (
        <Form className="cvl-settings-form" onSubmit={saveSettings}>
          <label>
            {copyValue(copy, "fields.duration_minutes")}
            <Input type="number" min="30" max="240" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} />
          </label>
          <label>
            {copyValue(copy, "fields.support_agreement")}
            <textarea rows={2} maxLength={500} value={supportRule} onChange={(event) => setSupportRule(event.target.value)} />
          </label>
          <button type="submit" disabled={busy || Boolean(session.settingsConfirmedAt)}>
            {session.settingsConfirmedAt ? copyValue(copy, "actions.settings_confirmed") : copyValue(copy, "actions.confirm_settings")}
          </button>
        </Form>
      ) : null}
      {canLead && !session.startedAt ? (
        <button type="button" className="cvl-primary" disabled={busy} onClick={() => dispatchAction(ACTIONS.start, {})}>
          {copyValue(copy, "actions.start_meeting")}
        </button>
      ) : null}
      {canLead && session?.id ? (
        <Form className="cvl-settings-form" onSubmit={invite}>
          <strong>{copyValue(copy, "invite_participant.title")}</strong>
          <label>
            {copyValue(copy, "fields.email")}
            <Input
              type="email"
              autoComplete="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder={copyValue(copy, "placeholders.email")}
              required
            />
          </label>
          <label>
            {copyValue(copy, "fields.role")}
            <Dropdown
              value={inviteRole}
              onChange={setInviteRole}
              ariaLabel={copyValue(copy, "fields.role")}
              options={["CO_MODERATOR", "SUMMARY_REVIEWER", "PARTICIPANT", "OBSERVER"].map((value) => ({
                value,
                label: roleLabel(value, copy)
              }))}
            />
          </label>
          <p className="cvl-private-note">{copyValue(copy, "invite_participant.privacy_notice")}</p>
          <button type="submit" disabled={busy || !inviteEmail.trim()}>{copyValue(copy, "actions.send_invite")}</button>
        </Form>
      ) : canLead ? <p className="cvl-muted">{copyValue(copy, "invite_participant.session_required")}</p> : null}
      <div className="cvl-case-boundary">
        <small>{copyValue(copy, "ui.shared_case_title")}</small>
        <strong>{covisionCase?.title || copyValue(copy, "ui.title_missing")}</strong>
      </div>
    </section>
  );
}

function OwnerCheckpoint({
  stage,
  privateStates,
  isOwner,
  role,
  participants,
  busy,
  dispatchAction,
  copy
}) {
  if (stage < 2 || stage > 6) return null;
  const hasAcceptedSummaryReviewer = participants.some((participant) => (
    participant.role === "SUMMARY_REVIEWER" && participant.inviteStatus === "ACCEPTED"
  ));
  const isPrivacyReviewer = stage === 2
    && hasAcceptedSummaryReviewer
    && role === "SUMMARY_REVIEWER";
  const configuration = {
    2: {
      kind: "case_anchor",
      flags: [
        ["ownerPictureConfirmed", "owner_picture"],
        ["ownerFocusConfirmed", "owner_focus"]
      ]
    },
    3: { kind: "question", flags: [["ownerEnough", "owner_enough"]] },
    4: { kind: "reflection", flags: [["ownerReady", "owner_ready_possibilities"]] },
    5: { kind: "possibility", flags: [["ownerResonanceReady", "resonance_complete"]] },
    6: {
      kind: "resource",
      flags: [
        ["impactReviewed", "impact_reviewed"],
        ["ownerReady", "support_picture_ready"]
      ]
    }
  }[stage];
  const flags = [
    ...(isOwner ? configuration.flags : []),
    ...(stage === 2 && (isPrivacyReviewer || (isOwner && !hasAcceptedSummaryReviewer))
      ? [["privacyReviewed", "privacy_reviewed"]]
      : [])
  ];
  if (flags.length === 0) return null;
  const existing = contentOf(stateByKind(privateStates, configuration.kind));

  const saveFlag = (key) => dispatchAction(ACTIONS.savePrivateState, {
    stage,
    kind: configuration.kind,
    content: { ...existing, [key]: true }
  });

  return (
    <section className="cvl-stage-controls cvl-private" aria-labelledby="cvl-owner-checkpoint-title">
      <header>
        <div>
          <p>{copyValue(copy, isPrivacyReviewer
            ? "ui.only_summary_reviewer_confirmation"
            : "ui.only_your_confirmation")}</p>
          <h2 id="cvl-owner-checkpoint-title">{copyValue(copy, isPrivacyReviewer
            ? "ui.summary_reviewer_checkpoint"
            : "ui.owner_checkpoint")}</h2>
        </div>
        <span className="cvl-lock" aria-label={copyValue(copy, "ui.private_aria")}>⌁</span>
      </header>
      {flags.map(([key, label]) => (
        <FlagButton
          key={key}
          active={contentValue(privateStates, key) === true}
          disabled={busy}
          onClick={() => saveFlag(key)}
        >
          {copyValue(copy, `checkpoints.${label}`)}
        </FlagButton>
      ))}
      <p className="cvl-private-note">{copyValue(copy, "ui.private_gate_notice")}</p>
    </section>
  );
}

function StageSevenOwnerPanel({ privateStates, isOwner, busy, dispatchAction, copy }) {
  const selectedState = contentOf(stateByKind(privateStates, "selected_direction"));
  const nextState = contentOf(stateByKind(privateStates, "next_step"));
  const markerState = contentOf(stateByKind(privateStates, "progress_marker"));
  const followState = contentOf(stateByKind(privateStates, "follow_up"));
  const [selectedDirection, setSelectedDirection] = useState(selectedState.selectedDirection || selectedState.text || "");
  const [nextStep, setNextStep] = useState(nextState.nextStep?.text || nextState.text || "");
  const [timeframe, setTimeframe] = useState(nextState.timeframe || "");
  const [progressMarker, setProgressMarker] = useState(markerState.progressMarker || markerState.text || "");
  const [followWhen, setFollowWhen] = useState(followState.followUp?.when || "");
  const [followResponsible, setFollowResponsible] = useState(followState.followUp?.responsibleParty || "owner");
  const [followChannel, setFollowChannel] = useState(followState.followUp?.channel || "platform");

  if (!isOwner) {
    return (
      <section className="cvl-stage-controls cvl-private cvl-private-wait" aria-labelledby="cvl-private-choice-title">
        <header>
          <p>{copyValue(copy, "stage7.private_choice")}</p>
          <h2 id="cvl-private-choice-title">{copyValue(copy, "stage7.owner_drafting")}</h2>
        </header>
        <p>{copyValue(copy, "stage7.group_wait_notice")}</p>
      </section>
    );
  }

  const save = (kind, content) => dispatchAction(ACTIONS.savePrivateState, { stage: 7, kind, content });
  const savedSelectedDirection = selectedState.selectedDirection || selectedState.text || "";
  const savedNextStep = nextState.nextStep?.text || nextState.text || "";
  const savedTimeframe = nextState.timeframe || "";
  const savedProgressMarker = markerState.progressMarker || markerState.text || "";
  const savedFollowUp = followState.followUp || {};
  const hasUnsavedPackageEdit = selectedDirection.trim() !== savedSelectedDirection
    || nextStep.trim() !== savedNextStep
    || timeframe.trim() !== savedTimeframe
    || progressMarker.trim() !== savedProgressMarker
    || followWhen.trim() !== (savedFollowUp.when || "")
    || followResponsible !== (savedFollowUp.responsibleParty || "owner")
    || followChannel !== (savedFollowUp.channel || "platform");
  const ownerConfirmed = stageSevenConfirmationIsFresh(privateStates)
    && !hasUnsavedPackageEdit;

  return (
    <section className="cvl-stage-seven cvl-private" aria-labelledby="cvl-stage-seven-title">
      <header>
        <div>
          <p>{copyValue(copy, "stage7.only_your_decision")}</p>
          <h2 id="cvl-stage-seven-title">{copyValue(copy, "stage7.title")}</h2>
        </div>
        <span className="cvl-lock" aria-label={copyValue(copy, "ui.private_aria")}>⌁</span>
      </header>
      <div className="cvl-structured-grid">
        <Form onSubmit={(event) => { event.preventDefault(); save("selected_direction", { selectedDirection: selectedDirection.trim() }); }}>
          <label>{copyValue(copy, "stage7.selected_direction")}
            <textarea rows={3} value={selectedDirection} onChange={(event) => setSelectedDirection(event.target.value)} placeholder={copyValue(copy, "placeholders.direction")} />
          </label>
          <button type="submit" disabled={busy || !selectedDirection.trim()}>{copyValue(copy, "actions.save_direction")}</button>
        </Form>
        <Form onSubmit={(event) => {
          event.preventDefault();
          save("next_step", {
            nextStep: { text: nextStep.trim(), actorType: "owner", withinOwnerInfluence: true },
            timeframe: timeframe.trim()
          });
        }}>
          <label>{copyValue(copy, "stage7.first_step")}
            <textarea rows={3} value={nextStep} onChange={(event) => setNextStep(event.target.value)} placeholder={copyValue(copy, "placeholders.next_step")} />
          </label>
          <label>{copyValue(copy, "continuity.timeframe")}
            <Input value={timeframe} onChange={(event) => setTimeframe(event.target.value)} placeholder={copyValue(copy, "placeholders.timeframe")} />
          </label>
          <button type="submit" disabled={busy || !nextStep.trim() || !timeframe.trim()}>{copyValue(copy, "actions.save_step")}</button>
        </Form>
        <Form onSubmit={(event) => {
          event.preventDefault();
          save("progress_marker", { progressMarker: progressMarker.trim() });
        }}>
          <label>{copyValue(copy, "stage7.progress_marker")}
            <textarea rows={3} value={progressMarker} onChange={(event) => setProgressMarker(event.target.value)} placeholder={copyValue(copy, "placeholders.progress_marker")} />
          </label>
          <button type="submit" disabled={busy || !progressMarker.trim()}>{copyValue(copy, "actions.save_marker")}</button>
        </Form>
        <Form onSubmit={(event) => {
          event.preventDefault();
          save("follow_up", {
            ...followState,
            followUp: {
              when: followWhen.trim(),
              responsibleParty: followResponsible,
              channel: followChannel
            },
            ownerConfirmed: false
          });
        }}>
          <label>{copyValue(copy, "stage7.follow_up_when")}
            <Input value={followWhen} onChange={(event) => setFollowWhen(event.target.value)} placeholder={copyValue(copy, "placeholders.follow_up_when")} />
          </label>
          <label>{copyValue(copy, "stage7.follow_up_responsible")}
            <Dropdown
              value={followResponsible}
              onChange={setFollowResponsible}
              ariaLabel={copyValue(copy, "stage7.follow_up_responsible")}
              options={Object.entries(copy?.follow_up_responsible || {}).map(([value, label]) => ({ value, label }))}
            />
          </label>
          <label>{copyValue(copy, "stage7.follow_up_channel")}
            <Dropdown
              value={followChannel}
              onChange={setFollowChannel}
              ariaLabel={copyValue(copy, "stage7.follow_up_channel")}
              options={Object.entries(copy?.follow_up_channels || {}).map(([value, label]) => ({ value, label }))}
            />
          </label>
          <button type="submit" disabled={busy || !followWhen.trim()}>{copyValue(copy, "actions.save_follow_up")}</button>
        </Form>
      </div>
      <p className="cvl-private-note">{copyValue(copy, "stage7.share_notice")}</p>
      <FlagButton
        active={ownerConfirmed}
        disabled={busy || hasUnsavedPackageEdit || !selectedState.selectedDirection || !nextState.nextStep || !markerState.progressMarker || !followState.followUp}
        onClick={() => save("follow_up", { ...followState, ownerConfirmed: true })}
      >
        {copyValue(copy, "actions.confirm_owner_direction")}
      </FlagButton>
    </section>
  );
}

function StageEightPanel({ privateStates, isOwner, busy, dispatchAction, copy }) {
  const existing = contentOf(stateByKind(privateStates, "owner_package"));
  const [values, setValues] = useState({
    generalizationDecision: existing.generalizationDecision || "",
    learningDecision: existing.learningDecision || "",
    retentionDecision: existing.retentionDecision || "",
    practiceDecision: existing.practiceDecision || ""
  });
  if (!isOwner) {
    return (
      <section className="cvl-stage-controls" aria-labelledby="cvl-stage-eight-shared-title">
        <header><p>{copyValue(copy, "stage8.shared_ending")}</p><h2 id="cvl-stage-eight-shared-title">{copyValue(copy, "stage8.learning_and_generalization")}</h2></header>
        <p className="cvl-muted">{copyValue(copy, "stage8.participant_notice")}</p>
      </section>
    );
  }

  const save = (event) => {
    event.preventDefault();
    dispatchAction(ACTIONS.savePrivateState, {
      stage: 8,
      kind: "owner_package",
      content: {
        ...existing,
        ...values,
        packageConfirmed: true,
        followUpConfirmed: true,
        ownerFinalConfirmed: true
      }
    });
  };
  const complete = [
    values.generalizationDecision,
    values.learningDecision,
    values.retentionDecision,
    values.practiceDecision
  ].every(Boolean);

  return (
    <section className="cvl-stage-eight cvl-private" aria-labelledby="cvl-stage-eight-title">
      <header>
        <div><p>{copyValue(copy, "stage8.owner_only")}</p><h2 id="cvl-stage-eight-title">{copyValue(copy, "stage8.title")}</h2></div>
        <span className="cvl-lock" aria-label={copyValue(copy, "ui.private_aria")}>⌁</span>
      </header>
      <Form onSubmit={save}>
        {[
          ["generalizationDecision", "fields.group_generalization", copy?.decisions?.generalization],
          ["learningDecision", "fields.learning_circle", copy?.decisions?.learning],
          ["retentionDecision", "fields.retention", copy?.decisions?.retention],
          ["practiceDecision", "fields.practice_candidate", copy?.decisions?.practice]
        ].map(([field, labelKey, decisions]) => (
          <label key={field}>
            {copyValue(copy, labelKey)}
            <Dropdown
              value={values[field]}
              onChange={(next) => setValues((current) => ({ ...current, [field]: next }))}
              ariaLabel={copyValue(copy, labelKey)}
              placeholder={copyValue(copy, "ui.choose")}
              options={Object.entries(decisions || {}).map(([value, label]) => ({ value, label }))}
            />
          </label>
        ))}
        <button type="submit" className="cvl-primary" disabled={busy || !complete}>{copyValue(copy, "actions.confirm_owner_package")}</button>
      </Form>
      <p className="cvl-private-note">{copyValue(copy, "stage8.not_close_notice")}</p>
    </section>
  );
}

function GuidancePanel({ stage, role, privateStates, copy }) {
  const meta = copy?.stages?.[stage] || {};
  const privateCount = privateStates.length;
  return (
    <section className="cvl-guidance" aria-labelledby="cvl-guidance-title">
      <header>
        <p>{copyValue(copy, "ui.compass")}</p>
        <h2 id="cvl-guidance-title">{copyValue(copy, "ui.hold_now")}</h2>
      </header>
      <div className="cvl-compass-mark" aria-hidden="true"><span /></div>
      <strong>{meta.eyebrow}</strong>
      <p>{meta.hero}</p>
      <dl>
        <div><dt>{copyValue(copy, "ui.your_role")}</dt><dd>{roleLabel(role, copy)}</dd></div>
        <div><dt>{copyValue(copy, "ui.private_drafts")}</dt><dd>{privateCount}</dd></div>
      </dl>
      <div className="cvl-boundary-note">
        <span aria-hidden="true">⌁</span>
        <p>{copyValue(copy, "ui.private_boundary_notice")}</p>
      </div>
    </section>
  );
}

function PhaseControl({ stage, phase, started, canLead, paused, busy, dispatchAction, copy }) {
  if (!canLead || !started) return null;
  const completionPhase = COVISION_STAGE_COMPLETION_PHASES[stage];
  const nextPhase = nextCanonicalPhase(stage, phase);
  const exceptional = NON_PROGRESS_PHASES.has(phase);
  const atGate = phase === completionPhase;

  return (
    <section className="cvl-stage-controls cvl-phase-control" aria-labelledby="cvl-phase-control-title">
      <header>
        <p>{copyValue(copy, "phase_control.kicker")}</p>
        <h2 id="cvl-phase-control-title">{copyValue(copy, "phase_control.title")}</h2>
      </header>
      <div className="cvl-phase-route">
        <span>{phaseLabel(phase, copy)}</span>
        <span aria-hidden="true">→</span>
        <strong>{nextPhase ? phaseLabel(nextPhase, copy) : atGate ? copyValue(copy, "phase_control.stage_gate") : copyValue(copy, "phase_control.leader_decision")}</strong>
      </div>
      {exceptional ? (
        <p className="cvl-muted">{copyValue(copy, "phase_control.exception_notice")}</p>
      ) : atGate ? (
        <p className="cvl-muted">{copyValue(copy, "phase_control.gate_ready_notice")}</p>
      ) : nextPhase ? (
        <button
          type="button"
          disabled={busy || paused}
          onClick={() => dispatchAction(ACTIONS.setPhase, { phase: nextPhase })}
        >
          {copyValue(copy, "actions.continue_prefix")} {phaseLabel(nextPhase, copy)}
        </button>
      ) : (
        <p className="cvl-muted">{copyValue(copy, "phase_control.no_next_phase")}</p>
      )}
    </section>
  );
}

function GateBar({
  stage,
  phase,
  version,
  evidence,
  canLead,
  isOwner,
  serverOnlyPrivacyReview,
  paused,
  busy,
  dispatchAction,
  completed,
  copy
}) {
  const expectedPhase = COVISION_STAGE_COMPLETION_PHASES[stage];
  const evaluation = useMemo(() => {
    try {
      return evaluateCovisionStageGate({ stage, phase: expectedPhase, expectedVersion: version, evidence });
    } catch {
      return { ok: false, missing: ["stage_evidence_unavailable"] };
    }
  }, [evidence, expectedPhase, stage, version]);
  const privateEvidenceVisible = isOwner || stage === 1;
  const phaseReady = phase === expectedPhase;
  const knownMissing = privateEvidenceVisible
    ? evaluation.missing.filter((missing) => (
      !serverOnlyPrivacyReview || missing !== "privacy_review_required"
    ))
    : [];
  const hasPrivateServerCheck = !privateEvidenceVisible || serverOnlyPrivacyReview;
  const disabledReason = completed
    ? copyValue(copy, "gate.completed")
    : !canLead
      ? copyValue(copy, "gate.leader_only")
      : paused
        ? copyValue(copy, "gate.resume_first")
        : !phaseReady
          ? formatCopy(copyValue(copy, "gate.phase_required"), { phase: phaseLabel(expectedPhase, copy) })
          : knownMissing.length
            ? copyValue(copy, `missing.${knownMissing[0]}`, copyValue(copy, "gate.evidence_missing"))
            : "";
  const disabled = busy || completed || !canLead || paused || !phaseReady || knownMissing.length > 0;

  return (
    <footer className={`cvl-gate ${disabled ? "is-closed" : "is-open"}`}>
      <div className="cvl-gate-mark" aria-hidden="true">{disabled ? "◇" : "✓"}</div>
      <div className="cvl-gate-copy">
        <small>{formatCopy(copyValue(copy, "gate.stage_label"), { number: stage })}</small>
        <strong>{disabledReason || copyValue(copy, "gate.visible_conditions_met")}</strong>
        {hasPrivateServerCheck && !completed ? <span>{copyValue(copy, "gate.server_checks_private")}</span> : null}
        {knownMissing.length > 1 ? <span>{formatCopy(copyValue(copy, "gate.more_conditions"), { count: knownMissing.length - 1 })}</span> : null}
      </div>
      <button
        type="button"
        className="cvl-primary"
        disabled={disabled}
        onClick={() => dispatchAction(ACTIONS.completeStage, { stage, phase: expectedPhase, evidence })}
      >
        {copy?.stages?.[stage]?.gate || copyValue(copy, "actions.complete_stage")}
      </button>
    </footer>
  );
}

export default function CovisionLiveSession({ snapshot, busy = false, onAction, onRefresh }) {
  const { t } = useI18n();
  const copy = useMemo(() => copyObject(t), [t]);
  const model = useMemo(() => normalizeModel(snapshot), [snapshot]);
  const stage = Math.min(8, Math.max(1, Number(model.session?.stage) || 1));
  const phase = String(model.session?.phase || "");
  const version = Math.max(0, Number(model.session?.version) || 0);
  const items = useMemo(() => currentStageItems(model.items, stage), [model.items, stage]);
  const privateStates = useMemo(
    () => currentPrivateStates(model.privateStates, stage),
    [model.privateStates, stage]
  );
  const role = model.me?.role || "PARTICIPANT";
  const isOwner = OWNER_ROLES.has(role) || model.me?.userId === model.covisionCase?.ownerId;
  const caseAnchorPrefill = useMemo(() => {
    if (!isOwner || stage !== 2 || items.some((item) => item.kind === "case_anchor")) return "";
    const content = contentOf(stateByKind(privateStates, "case_anchor"));
    return typeof content.text === "string" ? content.text : "";
  }, [isOwner, items, privateStates, stage]);
  const serverOnlyPrivacyReview = model.participants.some((participant) => (
    participant.role === "SUMMARY_REVIEWER" && participant.inviteStatus === "ACCEPTED"
  ));
  const completed = stage === 8 && phase === "complete";
  const canLead = !completed && !model.me?.readOnly && LEADER_ROLES.has(role);
  const canManage = !completed && !model.me?.readOnly && MANAGER_ROLES.has(role);
  const canWrite = !completed && !model.me?.readOnly && !["OBSERVER", "observer"].includes(role);
  const paused = Boolean(model.session?.pausedAt);
  const now = useSessionClock(model.serverNow);
  const startedAt = new Date(model.session?.startedAt || 0).getTime();
  const stageStartedAt = new Date(model.session?.stageStartedAt || 0).getTime();
  const totalPausedMs = Math.max(0, Number(model.session?.totalPausedMs) || 0);
  const durationMinutes = Math.max(0, Number(model.session?.settings?.durationMinutes) || 0);
  const elapsed = startedAt > 0 ? Math.max(0, now - startedAt - totalPausedMs) : 0;
  const stageElapsed = stageStartedAt > 0 ? Math.max(0, now - stageStartedAt) : 0;
  const remaining = durationMinutes > 0 ? Math.max(0, durationMinutes * 60_000 - elapsed) : null;
  const [supportOpen, setSupportOpen] = useState(false);

  const dispatchAction = useCallback(async (action, payload = {}) => {
    if (busy || typeof onAction !== "function") return null;
    return onAction(action, payload);
  }, [busy, onAction]);

  const evidence = useMemo(() => buildEvidence({
    stage,
    session: model.session,
    participants: model.participants,
    items,
    privateStates
  }), [items, model.participants, model.session, privateStates, stage]);

  /* Jaamad = etapi osad (omaniku mudel 20.07): üks jaam = üks tegevus.
     „Kirjuta" puudub etapil 1 (avaring kinnitab, ei kirjuta) ja suletud
     sessioonis; etappidel 7–8 on ta olemas ka mittekirjutajale (seal elab
     ausa ootamise teade — kus tegevus parasjagu toimub). */
  const stations = useMemo(() => {
    const defs = [{ key: "laud" }, { key: "ring" }];
    if (!completed && stage !== 1 && (canWrite || stage >= 7)) defs.push({ key: "kirjuta" });
    defs.push({ key: "kompass" });
    return defs;
  }, [canWrite, completed, stage]);
  const {
    dollyRef,
    planeProps,
    activeIndex,
    mode: flightMode,
    flyTo
  } = useStationFlight({ count: stations.length });
  const mountedStageRef = useRef(stage);

  /* Etapivahetus = suur samm: lend algab uue etapi laualt (drift-saabumine).
     Mount'il ei lennata — kaamera on juba jaamas 0. */
  useEffect(() => {
    if (mountedStageRef.current === stage) return;
    mountedStageRef.current = stage;
    flyTo(0, { drift: true });
  }, [stage, flyTo]);

  /* Jaamaloend võib kahaneda (nt sulgemine peidab Kirjuta) — ära jää
     olematusse jaama. */
  useEffect(() => {
    if (activeIndex > stations.length - 1) flyTo(stations.length - 1, { instant: true });
  }, [activeIndex, stations.length, flyTo]);

  const activeStationKey = stations[Math.min(activeIndex, stations.length - 1)]?.key || "laud";

  /* SCROLL JUHIB LENDU (omanik 21.07: „flight peab olema kasutusel — erinevaid
     tööpindu ühes ekraaniaknas lihtsalt scrollides"). Keris/svaip = üks tööpind
     edasi/tagasi (diskreetne jaama-target, MITTE scrollY-kaardistus — säilitab
     flight-effekti robustse mudeli). Kui žesti all on veel keritavat sisu
     (pikk kaart/vorm), keritakse KÕIGEPEALT seda ja lennatakse alles piiril —
     nii mahub ühte etappi rohkem tööpindu, kui ekraanile korraga mahuks. */
  const stageViewRef = useRef(null);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const stationCountRef = useRef(stations.length);
  stationCountRef.current = stations.length;

  useEffect(() => {
    const el = stageViewRef.current;
    if (!el) return undefined;
    const cooldown = { until: 0 };

    const innerCanScroll = (target, delta) => {
      let node = target;
      while (node && node !== el) {
        if (node.nodeType === 1) {
          const oy = getComputedStyle(node).overflowY;
          if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight + 1) {
            const atTop = node.scrollTop <= 0;
            const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
            if (delta < 0 && !atTop) return true;
            if (delta > 0 && !atBottom) return true;
          }
        }
        node = node.parentElement;
      }
      return false;
    };

    const fly = (dir, stamp) => {
      if (stamp < cooldown.until) return;
      const next = activeIndexRef.current + dir;
      if (next < 0 || next > stationCountRef.current - 1) return;
      flyTo(next);
      /* Käib useStationFlight tempoga kaasa (lend ~0,51 s) — ooteaeg ja lend
         peavad püsima ühes mõõdus, muidu tekib surnud aeg (omanik 02.08). */
      cooldown.until = stamp + 440;
    };

    const onWheel = (event) => {
      if (Math.abs(event.deltaY) < 4) return;
      if (innerCanScroll(event.target, event.deltaY)) return;
      event.preventDefault();
      fly(event.deltaY > 0 ? 1 : -1, event.timeStamp);
    };

    let startY = 0;
    let startX = 0;
    let startTarget = null;
    const onTouchStart = (event) => {
      startY = event.touches[0].clientY;
      startX = event.touches[0].clientX;
      startTarget = event.target;
    };
    const onTouchEnd = (event) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      const dy = startY - touch.clientY;
      const dx = startX - touch.clientX;
      if (Math.abs(dy) < 56 || Math.abs(dx) > Math.abs(dy)) return;
      if (innerCanScroll(startTarget, dy)) return;
      fly(dy > 0 ? 1 : -1, event.timeStamp);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [flyTo]);

  const myParticipant = model.participants.find((item) => (
    item?.id === model.me?.participantId || (model.me?.userId && item?.userId === model.me.userId)
  ));
  const myParticipantState = myParticipant?.state || myParticipant?.sessionState || {};
  const inviteFlowRequired = !isOwner
    && model.me?.inviteStatus !== "DECLINED"
    && !Boolean(myParticipantState.readyAt ?? myParticipant?.ready)
    && (
      model.me?.inviteStatus === "INVITED"
      || Boolean(myParticipantState.roleConfirmedAt ?? myParticipant?.roleConfirmed)
      || Boolean(myParticipantState.agreementConfirmedAt ?? myParticipant?.agreementConfirmed)
    );

  if (inviteFlowRequired) {
    return (
      <InvitationAcceptance
        participant={myParticipant}
        me={model.me}
        busy={busy}
        dispatchAction={dispatchAction}
        copy={copy}
      />
    );
  }

  return (
    <main className={`cvl-shell ${paused ? "is-paused" : ""}`} data-stage={stage} aria-busy={busy}>
      <header className="cvl-topbar">
        <div className="cvl-session-identity">
          <span className="cvl-session-sigil" aria-hidden="true">{copyValue(copy, "ui.sigil")}</span>
          <div>
            <small>{copyValue(copy, "ui.private_professional_workspace")}</small>
            <h1>{model.covisionCase?.title || copyValue(copy, "ui.session_fallback")}</h1>
          </div>
        </div>
        <div className="cvl-time-pair" aria-label={copyValue(copy, "ui.session_times_aria")}>
          <div>
            <small>{remaining == null ? copyValue(copy, "ui.meeting_elapsed") : copyValue(copy, "ui.meeting_remaining")}</small>
            <strong>{formatClock(remaining == null ? elapsed : remaining)}</strong>
          </div>
          <div>
            <small>{formatCopy(copyValue(copy, "ui.stage_elapsed"), { number: stage })}</small>
            <strong>{formatClock(stageElapsed)}</strong>
          </div>
        </div>
        <div className="cvl-top-actions">
          <button type="button" disabled={busy} onClick={() => setSupportOpen((value) => !value)}>
            {copyValue(copy, "actions.need_support")}
          </button>
          {canLead ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => dispatchAction(paused ? ACTIONS.resume : ACTIONS.pause, {})}
            >
              {paused ? copyValue(copy, "actions.resume") : copyValue(copy, "actions.pause")}
            </button>
          ) : null}
          <button type="button" disabled={busy || typeof onRefresh !== "function"} onClick={onRefresh} aria-label={copyValue(copy, "actions.refresh_aria")}>
            ↻
          </button>
          <span className="cvl-role-chip">{roleLabel(role, copy)}</span>
        </div>
      </header>

      {supportOpen ? (
        <section className="cvl-support-banner" role="status">
          <div><strong>{copyValue(copy, "support.pause_title")}</strong><p>{copyValue(copy, "support.body")}</p></div>
          <button type="button" onClick={() => setSupportOpen(false)}>{copyValue(copy, "actions.support_received")}</button>
        </section>
      ) : null}
      {paused ? <div className="cvl-pause-banner" role="status">{copyValue(copy, "support.paused_notice")}</div> : null}

      <StationNav stations={stations} activeIndex={activeIndex} flyTo={flyTo} copy={copy} />
      <p className="cvl-sr-only" aria-live="polite">
        {formatCopy(copyValue(copy, "stations.announce"), {
          current: Math.min(activeIndex, stations.length - 1) + 1,
          total: stations.length,
          label: copyValue(copy, `stations.${activeStationKey}`)
        })}
      </p>

      {/* Lennulava: etapi osad on jaamad sügavuses, kaamera lendab osade
          vahel (useStationFlight). Keris/svaip lava kohal = lend järgmisele
          tööpinnale; sisu kerib enne, kui seda on. */}
      <section className="cvf-stage-view" data-mode={flightMode} ref={stageViewRef}>
        {activeIndex < stations.length - 1 ? (
          <span className="cvf-scroll-hint" aria-hidden="true">
            {copyValue(copy, "stations.scroll_hint")}
          </span>
        ) : null}
        <div className="cvf-dolly" ref={dollyRef}>
          {stations.map((def, index) => (
            <section
              key={def.key}
              {...planeProps(index)}
              className="cvf-plane"
              data-station={def.key}
              aria-label={copyValue(copy, `stations.${def.key}`)}
            >
              <div className="cvf-plane-inner">
                {def.key === "laud" ? (
                  <WorkField
                    items={items}
                    stage={stage}
                    canManage={canManage}
                    busy={busy}
                    dispatchAction={dispatchAction}
                    copy={copy}
                  />
                ) : null}
                {def.key === "ring" ? (
                  <>
                    <ParticipantList
                      participants={model.participants}
                      me={model.me}
                      stage={stage}
                      busy={busy}
                      dispatchAction={dispatchAction}
                      copy={copy}
                    />
                    {items.length ? (
                      <section className="cvl-side-section cvl-queue" aria-labelledby="cvl-queue-title">
                        <header className="cvl-section-heading">
                          <div><p>{copyValue(copy, "ui.shared_queue")}</p><h2 id="cvl-queue-title">{copyValue(copy, "ui.card_field")}</h2></div>
                          <span>{items.length}</span>
                        </header>
                        <ol>
                          {items.slice(-8).map((item) => (
                            <li key={item.id}>
                              <span>{kindLabel(item.kind, copy)}</span>
                              <small>{statusLabel(lower(item.status, "shared_draft"), copy)}</small>
                            </li>
                          ))}
                        </ol>
                      </section>
                    ) : null}
                    {stage === 1 ? (
                      <StageOneControls
                        session={model.session}
                        covisionCase={model.covisionCase}
                        isOwner={isOwner}
                        canLead={canLead}
                        busy={busy}
                        dispatchAction={dispatchAction}
                        copy={copy}
                      />
                    ) : null}
                  </>
                ) : null}
                {def.key === "kirjuta" ? (
                  <>
                    <OwnerCheckpoint
                      stage={stage}
                      privateStates={privateStates}
                      isOwner={isOwner}
                      role={role}
                      participants={model.participants}
                      busy={busy}
                      dispatchAction={dispatchAction}
                      copy={copy}
                    />
                    {stage === 7 ? (
                      <StageSevenOwnerPanel
                        privateStates={privateStates}
                        isOwner={isOwner}
                        busy={busy}
                        dispatchAction={dispatchAction}
                        copy={copy}
                      />
                    ) : null}
                    {stage === 8 && !completed ? (
                      <StageEightPanel
                        privateStates={privateStates}
                        isOwner={isOwner}
                        busy={busy}
                        dispatchAction={dispatchAction}
                        copy={copy}
                      />
                    ) : null}
                    {!completed ? (
                      <Composer
                        stage={stage}
                        canWrite={canWrite}
                        isOwner={isOwner}
                        paused={paused}
                        busy={busy}
                        dispatchAction={dispatchAction}
                        copy={copy}
                        prefillText={caseAnchorPrefill}
                      />
                    ) : null}
                  </>
                ) : null}
                {def.key === "kompass" ? (
                  <>
                    <GuidancePanel stage={stage} role={role} privateStates={privateStates} copy={copy} />
                    <ContinuityPanel
                      stage={stage}
                      items={model.items}
                      snapshots={model.snapshots}
                      completed={completed}
                      copy={copy}
                    />
                    <PhaseControl
                      stage={stage}
                      phase={phase}
                      started={Boolean(model.session?.startedAt)}
                      canLead={canLead}
                      paused={paused}
                      busy={busy}
                      dispatchAction={dispatchAction}
                      copy={copy}
                    />
                  </>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </section>

      <GateBar
        stage={stage}
        phase={phase}
        version={version}
        evidence={evidence}
        canLead={canLead}
        isOwner={isOwner}
        serverOnlyPrivacyReview={serverOnlyPrivacyReview}
        paused={paused}
        busy={busy}
        dispatchAction={dispatchAction}
        completed={completed}
        copy={copy}
      />
      <StageDock
        stage={stage}
        snapshots={model.snapshots}
        completed={completed}
        copy={copy}
        onSelect={(state) => flyTo(state === "done" ? stations.length - 1 : 0)}
      />
    </main>
  );
}
