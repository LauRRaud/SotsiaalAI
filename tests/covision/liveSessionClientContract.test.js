import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  COVISION_STAGE_PROGRESS_PHASES,
  COVISION_STAGE_WORK_OBJECT_KINDS
} from "../../lib/covisionSessionShared.js";

const root = process.cwd();
const source = fs.readFileSync(
  path.join(root, "components", "covision", "CovisionLiveSession.jsx"),
  "utf8"
);
const styles = fs.readFileSync(
  path.join(root, "app", "styles", "covision-live.css"),
  "utf8"
);

test("live session is driven by the server snapshot and parent action adapter", () => {
  assert.match(source, /snapshot\?\.session/);
  assert.match(source, /session\.workItems/);
  assert.match(source, /session\.privateStates/);
  assert.match(source, /session\.stageSnapshots/);
  assert.match(source, /onAction\(action, payload\)/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /DEMO_|role switcher|setRole\s*\(/i);
});

test("all eight stages use shared phase, completion and work-kind contracts", () => {
  assert.match(source, /COVISION_STAGE_PROGRESS_PHASES/);
  assert.match(source, /COVISION_STAGE_COMPLETION_PHASES/);
  assert.match(source, /COVISION_STAGE_WORK_OBJECT_KINDS/);
  assert.match(source, /STAGE_NUMBERS = Object\.freeze\(\[1, 2, 3, 4, 5, 6, 7, 8\]\)/);
  assert.match(source, /stageKinds\(stage\)/);
  assert.match(source, /const expectedPhase = COVISION_STAGE_COMPLETION_PHASES\[stage\]/);
});

test("mutations use the locked server action vocabulary", () => {
  for (const action of [
    "START_SESSION",
    "CONFIRM_PARTICIPANT",
    "CONFIRM_CASE",
    "CONFIRM_SETTINGS",
    "INVITE_PARTICIPANT",
    "SET_PHASE",
    "SUBMIT_WORK_ITEM",
    "SAVE_PRIVATE_STATE",
    "UPDATE_WORK_ITEM",
    "COMPLETE_STAGE",
    "PAUSE",
    "RESUME"
  ]) {
    assert.match(source, new RegExp(`"${action}"`));
  }
  assert.doesNotMatch(source, /ADD_ITEM|CLOSE_CASE|CLOSE_SESSION|\/close/);
  assert.match(source, /dispatchAction\(ACTIONS\.completeStage, \{ stage, phase: expectedPhase, evidence \}\)/);
});

test("leader phase control advances only to the next canonical normal phase", () => {
  assert.match(source, /const NON_PROGRESS_PHASES = new Set\(\["paused", "blocked", "stage_incomplete"\]\)/);
  assert.match(source, /function nextCanonicalPhase\(stage, phase\)/);
  assert.match(source, /sequence\[currentIndex \+ 1\] \|\| null/);
  assert.match(source, /dispatchAction\(ACTIONS\.setPhase, \{ phase: nextPhase \}\)/);
  assert.match(source, /!session\.startedAt/);
  assert.match(source, /dispatchAction\(ACTIONS\.start, \{\}\)/);
  assert.deepEqual(
    COVISION_STAGE_PROGRESS_PHASES[2].slice(0, 3),
    ["ready_to_share_story", "story_sharing", "story_complete"]
  );
});

test("private drafts and shared work are structurally separate", () => {
  assert.match(source, /mode === "private"/);
  assert.match(source, /ACTIONS\.savePrivateState/);
  assert.match(source, /ACTIONS\.submitWorkItem/);
  assert.match(source, /ui\.only_your_workspace/);
  assert.match(source, /ui\.private_draft_notice/);
  assert.match(source, /lower\(item\?\.visibility, "shared"\) === "shared"/);
  assert.match(source, /const result = mode === "private"/);
  assert.match(source, /if \(!result\) return;[\s\S]*setText\(""\)/);
});

test("live session has one case-title heading and labelled owner decision fields", () => {
  assert.match(source, /<h1>\{model\.covisionCase\?\.title/);
  assert.match(source, /<h2 id="cvl-work-title">/);
  assert.doesNotMatch(source, /<h1 id="cvl-work-title">/);
  for (const key of [
    "stage7.selected_direction",
    "stage7.first_step",
    "continuity.timeframe",
    "stage7.progress_marker",
    "stage7.follow_up_when",
    "stage7.follow_up_responsible",
    "stage7.follow_up_channel"
  ]) {
    assert.match(source, new RegExp(`<label>\\{copyValue\\(copy, "${key.replaceAll(".", "\\.")}"\\)`));
  }
});

test("owner leader delegates the reviewer privacy checkpoint to a server-only gate check", () => {
  assert.match(source, /participant\.role === "SUMMARY_REVIEWER"/);
  assert.match(source, /participant\.inviteStatus === "ACCEPTED"/);
  assert.match(source, /missing !== "privacy_review_required"/);
  assert.match(source, /hasPrivateServerCheck/);
  assert.match(source, /gate\.server_checks_private/);
});

test("stage seven confirmation visibly expires after any package edit", () => {
  assert.match(source, /function stageSevenConfirmationIsFresh/);
  assert.match(source, /confirmationAt >= latestEditAt/);
  assert.match(source, /const hasUnsavedPackageEdit = selectedDirection\.trim\(\)/);
  assert.match(source, /const ownerConfirmed = stageSevenConfirmationIsFresh\(privateStates\)/);
  assert.match(source, /disabled=\{busy \|\| hasUnsavedPackageEdit/);
});

test("stage eight closes atomically through COMPLETE_STAGE without a separate close API", () => {
  for (const kind of [
    "owner_package",
    "group_generalization",
    "topic_seed_follow_up",
    "practice_candidate_decision"
  ]) {
    assert.ok(COVISION_STAGE_WORK_OBJECT_KINDS[8].includes(kind));
  }
  assert.match(source, /ACTIONS\.completeStage/);
  assert.match(source, /phase === "complete"/);
  assert.doesNotMatch(source, /action[^\n]*close/i);
});

test("an invited participant sees only the acceptance sequence before readiness", () => {
  assert.match(source, /function InvitationAcceptance/);
  assert.match(source, /model\.me\?\.inviteStatus === "INVITED"/);
  assert.match(source, /invitation\.privacy_notice/);
  assert.match(source, /present: true, roleConfirmed: true/);
  assert.match(source, /agreementConfirmed: true/);
  assert.match(source, /ready: true/);
  assert.match(source, /\.filter\(\(participant\) => participant\?\.inviteStatus === "ACCEPTED"\)/);
});

test("leaders can invite roles without exposing case content before acceptance", () => {
  assert.match(source, /ACTIONS\.inviteParticipant/);
  assert.match(source, /email: inviteEmail\.trim\(\)/);
  for (const role of ["CO_MODERATOR", "SUMMARY_REVIEWER", "PARTICIPANT", "OBSERVER"]) {
    assert.match(source, new RegExp(`"${role}"`));
  }
  assert.match(source, /invite_participant\.privacy_notice/);
  assert.match(source, /canLead && session\?\.id/);
  assert.doesNotMatch(source, /session\?\.id && session\?\.startedAt/);
});

test("read-only continuity keeps confirmed shared context across stages and closure", () => {
  assert.match(source, /function ContinuityPanel/);
  assert.match(source, /\["case_anchor", "case_core"\]/);
  assert.match(source, /item\?\.kind === "question"/);
  assert.match(source, /stageSevenSnapshot\?\.payload\?\.evidence/);
  assert.match(source, /stageSevenEvidence\?\.ownerConfirmed === true/);
  assert.match(source, /href="\/lopetatud-juhtumid"/);
  assert.doesNotMatch(source, /ContinuityPanel[\s\S]{0,500}privateStates/);
});

test("all visible live-session copy comes from the covision.live dictionary", () => {
  assert.match(source, /useI18n/);
  assert.match(source, /t\("covision\.live"\)/);
});

test("spatial CSS keeps one hero, private boundaries and accessibility fallbacks", () => {
  assert.match(styles, /\.cvl-canvas\s*\{/);
  assert.match(styles, /\.cvl-hero\s*\{/);
  assert.match(styles, /\.cvl-private\s*\{/);
  assert.match(styles, /border-style:\s*dashed/);
  assert.match(styles, /@media \(max-width: 820px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(prefers-contrast: more\)/);
  assert.match(styles, /\.cvl-shell\s*\{[\s\S]*height:\s*100%[\s\S]*min-height:\s*0[\s\S]*overflow-y:\s*auto/);
});
