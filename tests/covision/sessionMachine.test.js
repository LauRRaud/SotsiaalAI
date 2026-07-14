import test from "node:test";
import assert from "node:assert/strict";

import {
  COVISION_PARTICIPANT_ROLES,
  COVISION_STAGE_COMPLETION_PHASES,
  COVISION_STAGE_PHASES,
  COVISION_STAGE_PROGRESS_PHASES,
  COVISION_STAGES,
  COVISION_STAGE_WORK_OBJECT_KINDS,
  COVISION_WORK_OBJECT_KINDS,
  assertCovisionStageGate,
  covisionSessionPublicError,
  evaluateCovisionStageGate,
  normalizeCovisionStageCompletePayload
} from "../../lib/covisionSessionShared.js";

function payload(stage, evidence, overrides = {}) {
  return {
    stage,
    phase: COVISION_STAGE_COMPLETION_PHASES[stage],
    expectedVersion: 0,
    evidence,
    ...overrides
  };
}

function sharedWorkObject(stage, kind, overrides = {}) {
  return {
    id: `${stage}-${kind}`,
    kind,
    status: "shared",
    visibility: "shared",
    ...overrides
  };
}

test("stage machine exposes all eight canonical phase sets and work-object kinds", () => {
  assert.deepEqual(COVISION_STAGES, [1, 2, 3, 4, 5, 6, 7, 8]);
  for (const stage of COVISION_STAGES) {
    assert.equal(COVISION_STAGE_PHASES[stage].includes(COVISION_STAGE_COMPLETION_PHASES[stage]), true);
    assert.equal(COVISION_STAGE_WORK_OBJECT_KINDS[stage].length > 0, true);
  }
  assert.equal(COVISION_WORK_OBJECT_KINDS.includes("case_anchor"), true);
  assert.equal(COVISION_WORK_OBJECT_KINDS.includes("practice_candidate_decision"), true);
  assert.equal(COVISION_PARTICIPANT_ROLES.includes("case_owner"), true);
  assert.equal(COVISION_STAGE_PHASES[8].includes("complete"), true);
  assert.equal(COVISION_STAGE_PROGRESS_PHASES[2].includes("story_paused"), false);
  assert.deepEqual(COVISION_STAGE_PROGRESS_PHASES[2].slice(1, 3), [
    "story_sharing", "story_complete"
  ]);
});

test("normalization requires a non-negative integer expectedVersion and the stage completion phase", () => {
  assert.throws(
    () => normalizeCovisionStageCompletePayload(payload(3, {}, { expectedVersion: undefined })),
    (error) => error.message === "api.common.invalid_request" && error.status === 400
  );
  assert.throws(
    () => normalizeCovisionStageCompletePayload(payload(3, {}, { expectedVersion: -1 })),
    /api\.common\.invalid_request/
  );
  assert.throws(
    () => normalizeCovisionStageCompletePayload(payload(3, {}, { phase: "active_question" })),
    /api\.common\.invalid_request/
  );
});

test("completion payload rejects unknown and private-content fields", () => {
  assert.throws(
    () =>
      normalizeCovisionStageCompletePayload(
        payload(4, {
          workObjects: [sharedWorkObject(4, "reflection")],
          ownerReady: true,
          privateResonance: "never persist this"
        })
      ),
    /api\.common\.invalid_request/
  );
  assert.throws(
    () =>
      normalizeCovisionStageCompletePayload(
        payload(4, {
          workObjects: [
            { ...sharedWorkObject(4, "reflection"), content: { text: "private or raw content" } }
          ],
          ownerReady: true
        })
      ),
    /api\.common\.invalid_request/
  );
});

test("work-object normalization accepts metadata only, normalizes enums, and rejects duplicates", () => {
  const normalized = normalizeCovisionStageCompletePayload(
    payload(3, {
      workObjects: [
        { id: "q1", kind: "QUESTION", status: "SHARED", visibility: "SHARED" }
      ],
      ownerEnough: true
    })
  );
  assert.deepEqual(normalized.evidence.workObjects[0], {
    id: "q1",
    kind: "question",
    status: "shared",
    visibility: "shared",
    critical: false,
    resolutionStatus: null
  });
  assert.throws(
    () =>
      normalizeCovisionStageCompletePayload(
        payload(3, {
          workObjects: [
            sharedWorkObject(3, "question", { id: "same" }),
            sharedWorkObject(3, "clarification", { id: "same" })
          ]
        })
      ),
    /api\.common\.invalid_request/
  );
});

test("stage 1 opens only after every participant and both session confirmations are ready", () => {
  const valid = payload(1, {
    participants: [
      {
        participantId: "owner",
        role: "case_owner",
        roleConfirmed: true,
        agreementConfirmed: true,
        ready: true
      },
      {
        participantId: "leader",
        role: "session_leader",
        roleConfirmed: true,
        agreementConfirmed: true,
        ready: true
      }
    ],
    caseConfirmed: true,
    settingsConfirmed: true
  });
  assert.equal(evaluateCovisionStageGate(valid).ok, true);

  const result = evaluateCovisionStageGate(
    payload(1, {
      participants: [
        {
          participantId: "owner",
          role: "case_owner",
          roleConfirmed: true,
          agreementConfirmed: false,
          ready: false
        }
      ]
    })
  );
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, [
    "participant_agreements_unconfirmed",
    "participants_not_ready",
    "case_unconfirmed",
    "settings_unconfirmed"
  ]);
});

test("stage 1 blocks an observer whose explicit consent is false", () => {
  const result = evaluateCovisionStageGate(
    payload(1, {
      participants: [
        {
          participantId: "observer",
          role: "observer",
          roleConfirmed: true,
          agreementConfirmed: true,
          ready: true,
          observerConsent: false
        }
      ],
      caseConfirmed: true,
      settingsConfirmed: true
    })
  );
  assert.deepEqual(result.missing, ["observer_consent_missing"]);
});

test("stage 2 requires a shared anchor, owner picture and focus, and privacy review", () => {
  const valid = payload(2, {
    workObjects: [sharedWorkObject(2, "case_anchor")],
    ownerPictureConfirmed: true,
    ownerFocusConfirmed: true,
    privacyReviewed: true
  });
  assert.equal(evaluateCovisionStageGate(valid).ok, true);

  const privateAnchor = {
    ...sharedWorkObject(2, "case_anchor"),
    visibility: "owner_only"
  };
  const result = evaluateCovisionStageGate(
    payload(2, {
      workObjects: [privateAnchor],
      ownerPictureConfirmed: true,
      ownerFocusConfirmed: true,
      privacyReviewed: true
    })
  );
  assert.deepEqual(result.missing, ["shared_anchor_required"]);
});

test("stage 3 requires at least one shared question and the owner's enough signal", () => {
  assert.equal(
    evaluateCovisionStageGate(
      payload(3, {
        workObjects: [sharedWorkObject(3, "question")],
        ownerEnough: true
      })
    ).ok,
    true
  );
  assert.deepEqual(
    evaluateCovisionStageGate(
      payload(3, {
        workObjects: [sharedWorkObject(3, "clarification")],
        ownerEnough: false
      })
    ).missing,
    ["shared_question_required", "owner_enough_unconfirmed"]
  );
});

test("stage 4 requires a shared reflection and owner readiness", () => {
  assert.equal(
    evaluateCovisionStageGate(
      payload(4, {
        workObjects: [sharedWorkObject(4, "reflection")],
        ownerReady: true
      })
    ).ok,
    true
  );
  assert.deepEqual(evaluateCovisionStageGate(payload(4, {})).missing, [
    "shared_reflection_required",
    "owner_not_ready"
  ]);
});

test("stage 5 requires a shared possibility, no active object, and owner resonance readiness", () => {
  const valid = payload(5, {
    workObjects: [sharedWorkObject(5, "possibility")],
    ownerResonanceReady: true
  });
  assert.equal(evaluateCovisionStageGate(valid).ok, true);

  const result = evaluateCovisionStageGate(
    payload(5, {
      workObjects: [
        sharedWorkObject(5, "possibility"),
        sharedWorkObject(5, "backup_possibility", { id: "active", status: "active" })
      ],
      ownerResonanceReady: true
    })
  );
  assert.deepEqual(result.missing, ["active_object_present"]);
});

test("stage 6 accepts a resource or condition after impact review and resolved critical prerequisites", () => {
  const valid = payload(6, {
    workObjects: [
      sharedWorkObject(6, "supporting_condition"),
      sharedWorkObject(6, "critical_prerequisite", {
        id: "critical",
        critical: true,
        resolutionStatus: "check_step"
      })
    ],
    impactReviewed: true,
    ownerReady: true
  });
  assert.equal(evaluateCovisionStageGate(valid).ok, true);

  const result = evaluateCovisionStageGate(
    payload(6, {
      workObjects: [
        sharedWorkObject(6, "resource"),
        sharedWorkObject(6, "critical_prerequisite", {
          id: "critical",
          critical: true,
          resolutionStatus: "unresolved"
        })
      ],
      impactReviewed: true,
      ownerReady: true
    })
  );
  assert.deepEqual(result.missing, ["critical_prerequisite_unresolved"]);
});

test("stage 7 requires an owner-controlled next step and the full follow-up package", () => {
  const validEvidence = {
    selectedDirection: "Jätkan võrgustikukohtumise ettevalmistamisega.",
    nextStep: {
      text: "Koostan küsimused ja saadan kutse.",
      actorType: "owner",
      withinOwnerInfluence: true
    },
    timeframe: "Järgmise seitsme päeva jooksul",
    progressMarker: "Kutse ja kolm küsimust on valmis.",
    followUp: {
      when: "Kahe nädala pärast",
      responsibleParty: "session_leader",
      channel: "platform"
    },
    ownerConfirmed: true
  };
  assert.equal(evaluateCovisionStageGate(payload(7, validEvidence)).ok, true);

  const result = evaluateCovisionStageGate(
    payload(7, {
      ...validEvidence,
      nextStep: {
        text: "Teine spetsialist peab olukorra lahendama.",
        actorType: "other_person",
        withinOwnerInfluence: false
      }
    })
  );
  assert.deepEqual(result.missing, ["next_step_outside_owner_influence"]);
});

test("stage 8 requires explicit package, follow-up, learning, retention, and practice decisions", () => {
  const valid = payload(8, {
    workObjects: [
      sharedWorkObject(8, "owner_package", { status: "owner_confirmed", visibility: "owner_only" }),
      sharedWorkObject(8, "group_generalization"),
      sharedWorkObject(8, "practice_candidate_decision")
    ],
    packageConfirmed: true,
    followUpConfirmed: true,
    generalizationDecision: "completed",
    learningDecision: "skipped",
    retentionDecision: "retain",
    practiceDecision: "create_draft",
    ownerFinalConfirmed: true
  });
  assert.equal(evaluateCovisionStageGate(valid).ok, true);

  assert.deepEqual(evaluateCovisionStageGate(payload(8, {})).missing, [
    "package_confirmation_required",
    "follow_up_confirmation_required",
    "generalization_decision_required",
    "learning_completion_or_skip_required",
    "retention_decision_required",
    "practice_decision_required",
    "owner_final_confirmation_required"
  ]);
});

test("stage 8 decisions must be backed by safe work-object metadata, never by content", () => {
  const result = evaluateCovisionStageGate(
    payload(8, {
      workObjects: [],
      packageConfirmed: true,
      followUpConfirmed: true,
      generalizationDecision: "completed",
      learningDecision: "completed",
      retentionDecision: "retain",
      practiceDecision: "create_draft",
      ownerFinalConfirmed: true
    })
  );
  assert.deepEqual(result.missing, [
    "owner_package_metadata_required",
    "completed_generalization_metadata_required",
    "practice_candidate_metadata_required"
  ]);

  assert.throws(
    () =>
      normalizeCovisionStageCompletePayload(
        payload(8, {
          workObjects: [
            {
              ...sharedWorkObject(8, "owner_package", { status: "owner_confirmed" }),
              content: { summary: "raw owner package must stay in the WorkItem" }
            }
          ],
          packageConfirmed: true
        })
      ),
    /api\.common\.invalid_request/
  );
});

test("a blocking safety or privacy issue prevents every stage from completing", () => {
  const result = evaluateCovisionStageGate(
    payload(3, {
      workObjects: [sharedWorkObject(3, "question")],
      ownerEnough: true,
      hasBlockingSafetyOrPrivacyIssue: true
    })
  );
  assert.deepEqual(result.missing, ["blocking_safety_or_privacy_issue"]);
});

test("assert gate throws a fixed safe 409 and keeps gate details internal", () => {
  assert.throws(
    () => assertCovisionStageGate(payload(4, {})),
    (error) => {
      assert.equal(error.message, "covision.errors.save_failed");
      assert.equal(error.status, 409);
      assert.equal(error.code, "stage_gate");
      assert.deepEqual(error.details.missing, ["shared_reflection_required", "owner_not_ready"]);
      return true;
    }
  );
});

test("public error mapping exposes only allowlisted key/status pairs", () => {
  assert.deepEqual(
    covisionSessionPublicError(Object.assign(new Error("covision.errors.save_failed"), { status: 409 })),
    { messageKey: "covision.errors.save_failed", status: 409 }
  );
  assert.deepEqual(
    covisionSessionPublicError(
      Object.assign(new Error("database rejected private row secret"), {
        status: 409,
        details: { secret: "do not leak" }
      })
    ),
    { messageKey: "covision.errors.request_failed", status: 500 }
  );
  assert.deepEqual(
    covisionSessionPublicError(Object.assign(new Error("api.common.not_found"), { status: 403 })),
    { messageKey: "covision.errors.request_failed", status: 500 }
  );
});
