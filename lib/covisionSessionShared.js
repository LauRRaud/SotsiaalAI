const INVALID_REQUEST = "api.common.invalid_request";
const SAVE_FAILED = "covision.errors.save_failed";
const REQUEST_FAILED = "covision.errors.request_failed";

export const COVISION_STAGES = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);

export const COVISION_STAGE_PHASES = Object.freeze({
  1: Object.freeze([
    "waiting_room",
    "meeting_started",
    "confirmations_pending",
    "ready_to_open_case",
    "transition_to_stage_2",
    "paused",
    "blocked"
  ]),
  2: Object.freeze([
    "ready_to_share_story",
    "story_sharing",
    "story_paused",
    "story_complete",
    "picture_review",
    "focus_formulation",
    "ready_to_explore",
    "transition_to_stage_3",
    "stage_incomplete"
  ]),
  3: Object.freeze([
    "ready_to_explore",
    "exploration_plan",
    "silent_preparation",
    "question_queue",
    "active_question",
    "canvas_clarification",
    "coverage_review",
    "focus_confirmation",
    "ready_to_continue",
    "paused",
    "stage_incomplete"
  ]),
  4: Object.freeze([
    "ready_to_deepen",
    "role_change",
    "silent_reflection",
    "reflection_queue",
    "active_reflection",
    "reflection_placement",
    "perspective_linking",
    "owner_resonance",
    "owner_review",
    "ready_for_possibilities",
    "paused",
    "stage_incomplete"
  ]),
  5: Object.freeze([
    "ready_for_possibilities",
    "creation_open",
    "silent_ideation",
    "possibility_queue",
    "active_possibility",
    "thanks_and_placement",
    "possibility_field",
    "second_creative_round",
    "owner_resonance",
    "ready_for_resources",
    "paused",
    "stage_incomplete"
  ]),
  6: Object.freeze([
    "ready_for_resources",
    "scope_selection",
    "silent_resource_scan",
    "resource_queue",
    "active_resource",
    "factual_clarification",
    "barriers_and_unknowns",
    "impact_review",
    "resource_mirror",
    "owner_support_picture_review",
    "ready_for_selection",
    "paused",
    "stage_incomplete"
  ]),
  7: Object.freeze([
    "ready_for_selection",
    "private_selection",
    "resonance_sorting",
    "direction_drafting",
    "key_insight",
    "next_step_drafting",
    "support_timeframe_progress",
    "follow_up_draft",
    "quality_responsibility_review",
    "owner_confirmation",
    "public_summary",
    "support_consent",
    "case_work_completed",
    "paused",
    "stage_incomplete"
  ]),
  8: Object.freeze([
    "ready_to_summarize",
    "owner_package_review",
    "follow_up_generalization_confirmation",
    "silent_learning_reflection",
    "learning_queue",
    "active_learning_share",
    "process_reflection",
    "group_generalization",
    "retention_choice",
    "practice_candidate_decision",
    "final_review",
    "case_closed",
    "meeting_closed",
    "next_case",
    "paused",
    "stage_incomplete",
    "complete"
  ])
});

// Canonical forward path used by SET_PHASE. The wider phase catalogue above
// also contains optional pauses, blocked/error views and post-gate transitions;
// those must never become mandatory steps merely because they are renderable.
export const COVISION_STAGE_PROGRESS_PHASES = Object.freeze({
  1: Object.freeze([
    "waiting_room", "meeting_started", "confirmations_pending", "ready_to_open_case"
  ]),
  2: Object.freeze([
    "ready_to_share_story", "story_sharing", "story_complete", "picture_review",
    "focus_formulation", "ready_to_explore"
  ]),
  3: Object.freeze([
    "ready_to_explore", "exploration_plan", "silent_preparation", "question_queue",
    "active_question", "canvas_clarification", "coverage_review", "focus_confirmation",
    "ready_to_continue"
  ]),
  4: Object.freeze([
    "ready_to_deepen", "role_change", "silent_reflection", "reflection_queue",
    "active_reflection", "reflection_placement", "perspective_linking", "owner_resonance",
    "owner_review", "ready_for_possibilities"
  ]),
  5: Object.freeze([
    "ready_for_possibilities", "creation_open", "silent_ideation", "possibility_queue",
    "active_possibility", "thanks_and_placement", "possibility_field",
    "second_creative_round", "owner_resonance", "ready_for_resources"
  ]),
  6: Object.freeze([
    "ready_for_resources", "scope_selection", "silent_resource_scan", "resource_queue",
    "active_resource", "factual_clarification", "barriers_and_unknowns", "impact_review",
    "resource_mirror", "owner_support_picture_review", "ready_for_selection"
  ]),
  7: Object.freeze([
    "ready_for_selection", "private_selection", "resonance_sorting", "direction_drafting",
    "key_insight", "next_step_drafting", "support_timeframe_progress", "follow_up_draft",
    "quality_responsibility_review", "owner_confirmation", "public_summary",
    "support_consent", "case_work_completed"
  ]),
  8: Object.freeze([
    "ready_to_summarize", "owner_package_review", "follow_up_generalization_confirmation",
    "silent_learning_reflection", "learning_queue", "active_learning_share",
    "process_reflection", "group_generalization", "retention_choice",
    "practice_candidate_decision", "final_review"
  ])
});

export const COVISION_STAGE_COMPLETION_PHASES = Object.freeze({
  1: "ready_to_open_case",
  2: "ready_to_explore",
  3: "ready_to_continue",
  4: "ready_for_possibilities",
  5: "ready_for_resources",
  6: "ready_for_selection",
  7: "case_work_completed",
  8: "final_review"
});

export const COVISION_PARTICIPANT_ROLES = Object.freeze([
  "meeting_starter",
  "meeting_leader",
  "session_leader",
  "case_owner",
  "summary_keeper",
  "participant",
  "observer"
]);

const STAGE_WORK_OBJECT_KINDS = {
  1: ["participant_state", "agreement", "session_setting"],
  2: [
    "case_anchor",
    "case_core",
    "party_or_role",
    "event_or_timepoint",
    "known_information",
    "person_perspective",
    "worker_observation",
    "worker_interpretation",
    "prior_action",
    "described_outcome",
    "support_or_condition",
    "barrier_or_limit",
    "desired_change",
    "professional_tension",
    "method",
    "free_card"
  ],
  3: ["research_site", "question", "clarification", "open_question", "source"],
  4: [
    "reflection",
    "observation",
    "reaction",
    "possible_interpretation",
    "possible_need_or_value",
    "possible_pattern",
    "alternative_perspective",
    "parked_possibility"
  ],
  5: [
    "possibility",
    "main_possibility",
    "backup_possibility",
    "possibility_cluster",
    "feasibility_note"
  ],
  6: [
    "resource",
    "supporting_condition",
    "required_condition",
    "barrier",
    "critical_prerequisite",
    "resource_reflection",
    "resource_bundle"
  ],
  7: [
    "selected_direction",
    "key_insight",
    "next_step",
    "support_request",
    "progress_marker",
    "fallback_or_stop_condition",
    "follow_up"
  ],
  8: [
    "owner_package",
    "learning_note",
    "process_reflection",
    "group_generalization",
    "topic_seed_follow_up",
    "retention_decision",
    "practice_candidate_decision"
  ]
};

export const COVISION_STAGE_WORK_OBJECT_KINDS = Object.freeze(
  Object.fromEntries(
    Object.entries(STAGE_WORK_OBJECT_KINDS).map(([stage, kinds]) => [stage, Object.freeze([...kinds])])
  )
);

export const COVISION_WORK_OBJECT_KINDS = Object.freeze([
  ...new Set(Object.values(STAGE_WORK_OBJECT_KINDS).flat())
]);

const WORK_OBJECT_STATUSES = Object.freeze([
  "draft",
  "private_draft",
  "shared_draft",
  "ready",
  "queued",
  "active",
  "shared",
  "completed",
  "answered",
  "open",
  "owner_confirmed",
  "needs_review",
  "needs_rephrase",
  "resolved",
  "not_applicable",
  "parked",
  "closed",
  "withdrawn",
  "removed"
]);

const WORK_OBJECT_VISIBILITIES = Object.freeze(["private", "owner_only", "shared"]);
const RESOLUTION_STATUSES = Object.freeze([
  "unresolved",
  "satisfied",
  "check_step",
  "blocks_path",
  "not_applicable",
  "resolved"
]);
const RESOLVED_CRITICAL_STATUSES = new Set([
  "satisfied",
  "check_step",
  "blocks_path",
  "not_applicable",
  "resolved"
]);
const COUNTABLE_SHARED_STATUSES = new Set([
  "shared_draft",
  "ready",
  "queued",
  "shared",
  "completed",
  "answered",
  "open",
  "owner_confirmed",
  "resolved",
  "not_applicable",
  "parked",
  "closed"
]);

const PUBLIC_ERRORS = Object.freeze({
  "api.common.invalid_request": 400,
  "api.common.unauthorized": 401,
  "api.common.forbidden": 403,
  "covision.errors.role_forbidden": 403,
  "api.common.not_found": 404,
  "covision.errors.save_failed": 409
});

const ALLOWED_EVIDENCE_KEYS = Object.freeze({
  1: new Set([
    "participants",
    "caseConfirmed",
    "settingsConfirmed",
    "hasBlockingSafetyOrPrivacyIssue"
  ]),
  2: new Set([
    "workObjects",
    "ownerPictureConfirmed",
    "ownerFocusConfirmed",
    "privacyReviewed",
    "hasBlockingSafetyOrPrivacyIssue"
  ]),
  3: new Set(["workObjects", "ownerEnough", "hasBlockingSafetyOrPrivacyIssue"]),
  4: new Set(["workObjects", "ownerReady", "hasBlockingSafetyOrPrivacyIssue"]),
  5: new Set([
    "workObjects",
    "activeObjectId",
    "ownerResonanceReady",
    "hasBlockingSafetyOrPrivacyIssue"
  ]),
  6: new Set([
    "workObjects",
    "activeObjectId",
    "impactReviewed",
    "ownerReady",
    "hasBlockingSafetyOrPrivacyIssue"
  ]),
  7: new Set([
    "selectedDirection",
    "nextStep",
    "timeframe",
    "progressMarker",
    "followUp",
    "ownerConfirmed",
    "hasBlockingSafetyOrPrivacyIssue"
  ]),
  8: new Set([
    "workObjects",
    "packageConfirmed",
    "followUpConfirmed",
    "generalizationDecision",
    "learningDecision",
    "retentionDecision",
    "practiceDecision",
    "ownerFinalConfirmed",
    "hasBlockingSafetyOrPrivacyIssue"
  ])
});

const TOP_LEVEL_KEYS = new Set(["stage", "phase", "expectedVersion", "evidence"]);
const WORK_OBJECT_KEYS = new Set([
  "id",
  "kind",
  "status",
  "visibility",
  "critical",
  "resolutionStatus"
]);
const PARTICIPANT_KEYS = new Set([
  "participantId",
  "role",
  "roleConfirmed",
  "agreementConfirmed",
  "ready",
  "observerConsent"
]);
const NEXT_STEP_KEYS = new Set(["text", "actorType", "withinOwnerInfluence"]);
const FOLLOW_UP_KEYS = new Set(["when", "responsibleParty", "channel"]);

const NEXT_STEP_ACTOR_TYPES = new Set(["owner", "other_person", "organization", "group"]);
const FOLLOW_UP_RESPONSIBLE_PARTIES = new Set([
  "owner",
  "meeting_leader",
  "session_leader",
  "designated_professional",
  "group"
]);
const FOLLOW_UP_CHANNELS = new Set([
  "platform",
  "meeting",
  "phone",
  "email",
  "other_agreed_channel"
]);
const GENERALIZATION_DECISIONS = new Set(["completed", "skipped_unsafe", "not_retained"]);
const LEARNING_DECISIONS = new Set(["completed", "skipped"]);
const RETENTION_DECISIONS = new Set(["retain", "do_not_retain"]);
const PRACTICE_DECISIONS = new Set(["create_draft", "skip"]);

function createSessionError(message, status, code, details) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

function invalidRequest(code = "invalid_payload") {
  return createSessionError(INVALID_REQUEST, 400, code);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainObject(value, code) {
  if (!isPlainObject(value)) throw invalidRequest(code);
}

function assertOnlyKeys(value, allowedKeys, code) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) throw invalidRequest(code);
  }
}

function normalizeRequiredText(value, { code, maxLength = 500 }) {
  if (typeof value !== "string") throw invalidRequest(code);
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (!normalized || normalized.length > maxLength) throw invalidRequest(code);
  return normalized;
}

function normalizeOptionalText(value, { code, maxLength = 500 }) {
  if (value === undefined || value === null || value === "") return null;
  return normalizeRequiredText(value, { code, maxLength });
}

function normalizeOptionalBoolean(value, code) {
  if (value === undefined) return false;
  if (typeof value !== "boolean") throw invalidRequest(code);
  return value;
}

function normalizeEnum(value, allowed, code, { optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === "")) return null;
  if (typeof value !== "string") throw invalidRequest(code);
  const normalized = value.trim().toLowerCase();
  if (!allowed.has(normalized)) throw invalidRequest(code);
  return normalized;
}

function normalizeWorkObject(value, stage, index) {
  assertPlainObject(value, `invalid_work_object_${index}`);
  assertOnlyKeys(value, WORK_OBJECT_KEYS, `invalid_work_object_keys_${index}`);

  const stageKinds = new Set(COVISION_STAGE_WORK_OBJECT_KINDS[stage]);
  const kind = normalizeEnum(value.kind, stageKinds, `invalid_work_object_kind_${index}`);
  const status = normalizeEnum(
    value.status,
    new Set(WORK_OBJECT_STATUSES),
    `invalid_work_object_status_${index}`
  );
  const visibility = normalizeEnum(
    value.visibility,
    new Set(WORK_OBJECT_VISIBILITIES),
    `invalid_work_object_visibility_${index}`
  );

  if (value.critical !== undefined && typeof value.critical !== "boolean") {
    throw invalidRequest(`invalid_work_object_critical_${index}`);
  }

  return {
    id: normalizeRequiredText(value.id, {
      code: `invalid_work_object_id_${index}`,
      maxLength: 128
    }),
    kind,
    status,
    visibility,
    critical: value.critical === true,
    resolutionStatus: normalizeEnum(
      value.resolutionStatus,
      new Set(RESOLUTION_STATUSES),
      `invalid_work_object_resolution_${index}`,
      { optional: true }
    )
  };
}

function normalizeWorkObjects(value, stage) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 250) throw invalidRequest("invalid_work_objects");
  const normalized = value.map((item, index) => normalizeWorkObject(item, stage, index));
  const ids = new Set();
  for (const item of normalized) {
    if (ids.has(item.id)) throw invalidRequest("duplicate_work_object");
    ids.add(item.id);
  }
  return normalized;
}

function normalizeParticipants(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) throw invalidRequest("invalid_participants");

  const roles = new Set(COVISION_PARTICIPANT_ROLES);
  const ids = new Set();
  return value.map((participant, index) => {
    assertPlainObject(participant, `invalid_participant_${index}`);
    assertOnlyKeys(participant, PARTICIPANT_KEYS, `invalid_participant_keys_${index}`);
    const participantId = normalizeRequiredText(participant.participantId, {
      code: `invalid_participant_id_${index}`,
      maxLength: 128
    });
    if (ids.has(participantId)) throw invalidRequest("duplicate_participant");
    ids.add(participantId);

    for (const key of ["roleConfirmed", "agreementConfirmed", "ready"]) {
      if (participant[key] !== undefined && typeof participant[key] !== "boolean") {
        throw invalidRequest(`invalid_participant_${key}_${index}`);
      }
    }
    if (participant.observerConsent !== undefined && typeof participant.observerConsent !== "boolean") {
      throw invalidRequest(`invalid_participant_observer_consent_${index}`);
    }

    return {
      participantId,
      role: normalizeEnum(participant.role, roles, `invalid_participant_role_${index}`),
      roleConfirmed: participant.roleConfirmed === true,
      agreementConfirmed: participant.agreementConfirmed === true,
      ready: participant.ready === true,
      observerConsent:
        participant.observerConsent === undefined ? null : participant.observerConsent === true
    };
  });
}

function normalizeNextStep(value) {
  if (value === undefined) return null;
  assertPlainObject(value, "invalid_next_step");
  assertOnlyKeys(value, NEXT_STEP_KEYS, "invalid_next_step_keys");
  if (value.withinOwnerInfluence !== undefined && typeof value.withinOwnerInfluence !== "boolean") {
    throw invalidRequest("invalid_next_step_influence");
  }
  return {
    text: normalizeRequiredText(value.text, { code: "invalid_next_step_text", maxLength: 1_000 }),
    actorType: normalizeEnum(value.actorType, NEXT_STEP_ACTOR_TYPES, "invalid_next_step_actor"),
    withinOwnerInfluence: value.withinOwnerInfluence === true
  };
}

function normalizeFollowUp(value) {
  if (value === undefined) return null;
  assertPlainObject(value, "invalid_follow_up");
  assertOnlyKeys(value, FOLLOW_UP_KEYS, "invalid_follow_up_keys");
  return {
    when: normalizeRequiredText(value.when, { code: "invalid_follow_up_when", maxLength: 120 }),
    responsibleParty: normalizeEnum(
      value.responsibleParty,
      FOLLOW_UP_RESPONSIBLE_PARTIES,
      "invalid_follow_up_responsible_party"
    ),
    channel: normalizeEnum(value.channel, FOLLOW_UP_CHANNELS, "invalid_follow_up_channel")
  };
}

function normalizeEvidence(stage, evidence) {
  assertPlainObject(evidence, "invalid_evidence");
  assertOnlyKeys(evidence, ALLOWED_EVIDENCE_KEYS[stage], "invalid_evidence_keys");

  const hasBlockingSafetyOrPrivacyIssue = normalizeOptionalBoolean(
    evidence.hasBlockingSafetyOrPrivacyIssue,
    "invalid_safety_or_privacy_state"
  );

  switch (stage) {
    case 1:
      return {
        participants: normalizeParticipants(evidence.participants),
        caseConfirmed: normalizeOptionalBoolean(evidence.caseConfirmed, "invalid_case_confirmation"),
        settingsConfirmed: normalizeOptionalBoolean(
          evidence.settingsConfirmed,
          "invalid_settings_confirmation"
        ),
        hasBlockingSafetyOrPrivacyIssue
      };
    case 2:
      return {
        workObjects: normalizeWorkObjects(evidence.workObjects, stage),
        ownerPictureConfirmed: normalizeOptionalBoolean(
          evidence.ownerPictureConfirmed,
          "invalid_owner_picture_confirmation"
        ),
        ownerFocusConfirmed: normalizeOptionalBoolean(
          evidence.ownerFocusConfirmed,
          "invalid_owner_focus_confirmation"
        ),
        privacyReviewed: normalizeOptionalBoolean(evidence.privacyReviewed, "invalid_privacy_review"),
        hasBlockingSafetyOrPrivacyIssue
      };
    case 3:
      return {
        workObjects: normalizeWorkObjects(evidence.workObjects, stage),
        ownerEnough: normalizeOptionalBoolean(evidence.ownerEnough, "invalid_owner_enough"),
        hasBlockingSafetyOrPrivacyIssue
      };
    case 4:
      return {
        workObjects: normalizeWorkObjects(evidence.workObjects, stage),
        ownerReady: normalizeOptionalBoolean(evidence.ownerReady, "invalid_owner_ready"),
        hasBlockingSafetyOrPrivacyIssue
      };
    case 5:
      return {
        workObjects: normalizeWorkObjects(evidence.workObjects, stage),
        activeObjectId: normalizeOptionalText(evidence.activeObjectId, {
          code: "invalid_active_object_id",
          maxLength: 128
        }),
        ownerResonanceReady: normalizeOptionalBoolean(
          evidence.ownerResonanceReady,
          "invalid_owner_resonance_ready"
        ),
        hasBlockingSafetyOrPrivacyIssue
      };
    case 6:
      return {
        workObjects: normalizeWorkObjects(evidence.workObjects, stage),
        activeObjectId: normalizeOptionalText(evidence.activeObjectId, {
          code: "invalid_active_object_id",
          maxLength: 128
        }),
        impactReviewed: normalizeOptionalBoolean(evidence.impactReviewed, "invalid_impact_review"),
        ownerReady: normalizeOptionalBoolean(evidence.ownerReady, "invalid_owner_ready"),
        hasBlockingSafetyOrPrivacyIssue
      };
    case 7:
      return {
        selectedDirection: normalizeOptionalText(evidence.selectedDirection, {
          code: "invalid_selected_direction",
          maxLength: 1_000
        }),
        nextStep: normalizeNextStep(evidence.nextStep),
        timeframe: normalizeOptionalText(evidence.timeframe, {
          code: "invalid_timeframe",
          maxLength: 250
        }),
        progressMarker: normalizeOptionalText(evidence.progressMarker, {
          code: "invalid_progress_marker",
          maxLength: 500
        }),
        followUp: normalizeFollowUp(evidence.followUp),
        ownerConfirmed: normalizeOptionalBoolean(evidence.ownerConfirmed, "invalid_owner_confirmation"),
        hasBlockingSafetyOrPrivacyIssue
      };
    case 8:
      return {
        workObjects: normalizeWorkObjects(evidence.workObjects, stage),
        packageConfirmed: normalizeOptionalBoolean(
          evidence.packageConfirmed,
          "invalid_package_confirmation"
        ),
        followUpConfirmed: normalizeOptionalBoolean(
          evidence.followUpConfirmed,
          "invalid_follow_up_confirmation"
        ),
        generalizationDecision: normalizeEnum(
          evidence.generalizationDecision,
          GENERALIZATION_DECISIONS,
          "invalid_generalization_decision",
          { optional: true }
        ),
        learningDecision: normalizeEnum(
          evidence.learningDecision,
          LEARNING_DECISIONS,
          "invalid_learning_decision",
          { optional: true }
        ),
        retentionDecision: normalizeEnum(
          evidence.retentionDecision,
          RETENTION_DECISIONS,
          "invalid_retention_decision",
          { optional: true }
        ),
        practiceDecision: normalizeEnum(
          evidence.practiceDecision,
          PRACTICE_DECISIONS,
          "invalid_practice_decision",
          { optional: true }
        ),
        ownerFinalConfirmed: normalizeOptionalBoolean(
          evidence.ownerFinalConfirmed,
          "invalid_owner_final_confirmation"
        ),
        hasBlockingSafetyOrPrivacyIssue
      };
    default:
      throw invalidRequest("invalid_stage");
  }
}

export function normalizeCovisionStageCompletePayload(input) {
  assertPlainObject(input, "invalid_payload");
  assertOnlyKeys(input, TOP_LEVEL_KEYS, "invalid_payload_keys");

  if (!Number.isInteger(input.stage) || !COVISION_STAGES.includes(input.stage)) {
    throw invalidRequest("invalid_stage");
  }
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) {
    throw invalidRequest("invalid_expected_version");
  }

  const expectedPhase = COVISION_STAGE_COMPLETION_PHASES[input.stage];
  if (input.phase !== expectedPhase) throw invalidRequest("invalid_completion_phase");

  return {
    stage: input.stage,
    phase: expectedPhase,
    expectedVersion: input.expectedVersion,
    evidence: normalizeEvidence(input.stage, input.evidence)
  };
}

function isCountableSharedObject(item) {
  return item.visibility === "shared" && COUNTABLE_SHARED_STATUSES.has(item.status);
}

function hasSharedKind(workObjects, kinds) {
  return workObjects.some((item) => kinds.has(item.kind) && isCountableSharedObject(item));
}

function hasActiveObject(evidence) {
  return Boolean(evidence.activeObjectId) || evidence.workObjects.some((item) => item.status === "active");
}

function gateStageOne(evidence, missing) {
  if (evidence.participants.length === 0) missing.push("participants_required");
  if (evidence.participants.some((participant) => !participant.roleConfirmed)) {
    missing.push("participant_roles_unconfirmed");
  }
  if (evidence.participants.some((participant) => !participant.agreementConfirmed)) {
    missing.push("participant_agreements_unconfirmed");
  }
  if (evidence.participants.some((participant) => !participant.ready)) {
    missing.push("participants_not_ready");
  }
  if (
    evidence.participants.some(
      (participant) => participant.role === "observer" && participant.observerConsent === false
    )
  ) {
    missing.push("observer_consent_missing");
  }
  if (!evidence.caseConfirmed) missing.push("case_unconfirmed");
  if (!evidence.settingsConfirmed) missing.push("settings_unconfirmed");
}

function gateStageTwo(evidence, missing) {
  if (!hasSharedKind(evidence.workObjects, new Set(["case_anchor"]))) {
    missing.push("shared_anchor_required");
  }
  if (!evidence.ownerPictureConfirmed) missing.push("owner_picture_unconfirmed");
  if (!evidence.ownerFocusConfirmed) missing.push("owner_focus_unconfirmed");
  if (!evidence.privacyReviewed) missing.push("privacy_review_required");
}

function gateStageThree(evidence, missing) {
  if (!hasSharedKind(evidence.workObjects, new Set(["question"]))) {
    missing.push("shared_question_required");
  }
  if (!evidence.ownerEnough) missing.push("owner_enough_unconfirmed");
}

function gateStageFour(evidence, missing) {
  if (!hasSharedKind(evidence.workObjects, new Set(["reflection"]))) {
    missing.push("shared_reflection_required");
  }
  if (!evidence.ownerReady) missing.push("owner_not_ready");
}

function gateStageFive(evidence, missing) {
  if (!hasSharedKind(evidence.workObjects, new Set(["possibility"]))) {
    missing.push("shared_possibility_required");
  }
  if (hasActiveObject(evidence)) missing.push("active_object_present");
  if (!evidence.ownerResonanceReady) missing.push("owner_resonance_not_ready");
}

function gateStageSix(evidence, missing) {
  if (
    !hasSharedKind(
      evidence.workObjects,
      new Set(["resource", "supporting_condition", "required_condition"])
    )
  ) {
    missing.push("shared_resource_or_condition_required");
  }
  if (hasActiveObject(evidence)) missing.push("active_object_present");
  if (!evidence.impactReviewed) missing.push("impact_review_required");

  const hasUnresolvedCriticalPrerequisite = evidence.workObjects.some(
    (item) =>
      (item.critical || item.kind === "critical_prerequisite") &&
      !RESOLVED_CRITICAL_STATUSES.has(item.resolutionStatus)
  );
  if (hasUnresolvedCriticalPrerequisite) missing.push("critical_prerequisite_unresolved");
  if (!evidence.ownerReady) missing.push("owner_not_ready");
}

function gateStageSeven(evidence, missing) {
  if (!evidence.selectedDirection) missing.push("selected_direction_required");
  if (!evidence.nextStep) {
    missing.push("next_step_required");
  } else if (evidence.nextStep.actorType !== "owner" || !evidence.nextStep.withinOwnerInfluence) {
    missing.push("next_step_outside_owner_influence");
  }
  if (!evidence.timeframe) missing.push("timeframe_required");
  if (!evidence.progressMarker) missing.push("progress_marker_required");
  if (!evidence.followUp) missing.push("follow_up_required");
  if (!evidence.ownerConfirmed) missing.push("owner_confirmation_required");
}

function gateStageEight(evidence, missing) {
  if (!evidence.packageConfirmed) missing.push("package_confirmation_required");
  if (
    evidence.packageConfirmed &&
    !evidence.workObjects.some(
      (item) =>
        item.kind === "owner_package" &&
        (item.visibility === "shared" || item.visibility === "owner_only") &&
        (item.status === "shared" || item.status === "owner_confirmed")
    )
  ) {
    missing.push("owner_package_metadata_required");
  }
  if (!evidence.followUpConfirmed) missing.push("follow_up_confirmation_required");
  if (!evidence.generalizationDecision) missing.push("generalization_decision_required");
  if (
    evidence.generalizationDecision === "completed" &&
    !hasSharedKind(
      evidence.workObjects,
      new Set(["group_generalization", "topic_seed_follow_up"])
    )
  ) {
    missing.push("completed_generalization_metadata_required");
  }
  if (!evidence.learningDecision) missing.push("learning_completion_or_skip_required");
  if (!evidence.retentionDecision) missing.push("retention_decision_required");
  if (!evidence.practiceDecision) missing.push("practice_decision_required");
  if (
    evidence.practiceDecision === "create_draft" &&
    !evidence.workObjects.some(
      (item) =>
        item.kind === "practice_candidate_decision" &&
        (item.visibility === "shared" || item.visibility === "owner_only") &&
        COUNTABLE_SHARED_STATUSES.has(item.status)
    )
  ) {
    missing.push("practice_candidate_metadata_required");
  }
  if (!evidence.ownerFinalConfirmed) missing.push("owner_final_confirmation_required");
}

export function evaluateCovisionStageGate(input) {
  const payload = normalizeCovisionStageCompletePayload(input);
  const missing = [];

  if (payload.evidence.hasBlockingSafetyOrPrivacyIssue) {
    missing.push("blocking_safety_or_privacy_issue");
  }

  const evaluators = {
    1: gateStageOne,
    2: gateStageTwo,
    3: gateStageThree,
    4: gateStageFour,
    5: gateStageFive,
    6: gateStageSix,
    7: gateStageSeven,
    8: gateStageEight
  };
  evaluators[payload.stage](payload.evidence, missing);

  return {
    ok: missing.length === 0,
    stage: payload.stage,
    phase: payload.phase,
    expectedVersion: payload.expectedVersion,
    missing,
    evidence: payload.evidence
  };
}

export function assertCovisionStageGate(input) {
  const result = evaluateCovisionStageGate(input);
  if (!result.ok) {
    throw createSessionError(SAVE_FAILED, 409, "stage_gate", {
      stage: result.stage,
      missing: result.missing
    });
  }
  return result;
}

export function covisionSessionPublicError(error) {
  const messageKey =
    typeof error?.message === "string"
      ? error.message
      : typeof error?.messageKey === "string"
        ? error.messageKey
        : "";
  const expectedStatus = PUBLIC_ERRORS[messageKey];
  if (expectedStatus && error?.status === expectedStatus) {
    return { messageKey, status: expectedStatus };
  }
  return { messageKey: REQUEST_FAILED, status: 500 };
}
