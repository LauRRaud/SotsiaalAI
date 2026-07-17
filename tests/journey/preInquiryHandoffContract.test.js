import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPreInquiryPrefillFromJourney,
  partitionJourneyShareKeys
} from "../../lib/journey/preInquiryHandoff.js";
import { normalizePreInquiryJourneySharedInfo } from "../../lib/preInquiryJourneySharedInfo.js";

const MARKERS = Object.freeze({
  summary: "MARKER_SUMMARY_71",
  domains: "MARKER_DOMAINS_72",
  missingInfo: "MARKER_MISSING_73",
  wish: "MARKER_WISH_74",
  personContext: "MARKER_PERSON_75",
  assistiveDevices: "MARKER_DEVICE_76",
  serviceContinuity: "MARKER_CONTINUITY_77",
  municipality: "MARKER_MUNICIPALITY_78",
  document: "MARKER_DOCUMENT_79",
  title: "MARKER_TITLE_80",
  risk: "MARKER_RISK_NEVER_81"
});

const JOURNEY_SHARE_KEYS = Object.freeze([
  "summary", "domains", "missingInfo", "wish", "personContext",
  "assistiveDevices", "serviceContinuity", "municipality", "document", "title"
]);

const journey = Object.freeze({
  id: "journey-contract",
  title: MARKERS.title,
  summary: MARKERS.summary,
  domains: [MARKERS.domains],
  missingInfo: [MARKERS.missingInfo],
  suggestedActions: ["MARKER_ACTION_NEVER_82"],
  riskSignals: [MARKERS.risk],
  context: {
    personWish: MARKERS.wish,
    personContext: MARKERS.personContext,
    municipality: MARKERS.municipality,
    contextNote: MARKERS.document,
    assistiveDevices: [{ title: MARKERS.assistiveDevices }],
    serviceContinuity: { serviceName: MARKERS.serviceContinuity }
  }
});

function serialized(value) {
  return JSON.stringify(value);
}

test("empty manifest is fail-closed and never includes journey content", () => {
  const value = buildPreInquiryPrefillFromJourney(journey, { shareKeys: [] });
  const text = serialized(value);
  for (const marker of Object.values(MARKERS)) assert.doesNotMatch(text, new RegExp(marker));
  assert.deepEqual(value.sharedJourneyInfo?.confirmedKeys || [], []);
  assert.equal(value.sourceJourneyId, journey.id);
});

test("every allowlisted key admits only its own marker", () => {
  for (const key of JOURNEY_SHARE_KEYS) {
    const text = serialized(buildPreInquiryPrefillFromJourney(journey, { shareKeys: [key] }));
    for (const [markerKey, marker] of Object.entries(MARKERS)) {
      const expected = markerKey === key || (key === "assistiveDevices" && markerKey === "assistiveDevices");
      if (expected) assert.match(text, new RegExp(marker), `${key} should include ${markerKey}`);
      else assert.doesNotMatch(text, new RegExp(marker), `${key} leaked ${markerKey}`);
    }
  }
});

test("risk signals are excluded for every allowlist subset", () => {
  const combinations = [[], [...JOURNEY_SHARE_KEYS]];
  for (const key of JOURNEY_SHARE_KEYS) combinations.push([key]);
  for (const keys of combinations) {
    assert.doesNotMatch(serialized(buildPreInquiryPrefillFromJourney(journey, { shareKeys: keys })), /MARKER_RISK_NEVER_81/);
  }
});

test("wish never implies third-party personContext", () => {
  const wish = serialized(buildPreInquiryPrefillFromJourney(journey, { shareKeys: ["wish"] }));
  assert.match(wish, /MARKER_WISH_74/);
  assert.doesNotMatch(wish, /MARKER_PERSON_75/);
});

test("unknown keys are reported and non-array manifests fail closed", () => {
  assert.deepEqual(partitionJourneyShareKeys(["summary", "xyz", "summary"]), {
    confirmedKeys: ["summary"],
    ignoredKeys: ["xyz"]
  });
  assert.throws(() => partitionJourneyShareKeys("summary"), {
    code: "INVALID_JOURNEY_SHARE_KEYS",
    status: 400
  });
});

test("confirmedKeys survives shared-info normalization", () => {
  assert.deepEqual(
    normalizePreInquiryJourneySharedInfo({ summary: "safe", confirmedKeys: ["summary", "xyz"] })?.confirmedKeys,
    ["summary"]
  );
});

test("handoff is deterministic and has no persistence side effect", () => {
  const first = buildPreInquiryPrefillFromJourney(journey, { shareKeys: ["summary", "domains"] });
  const second = buildPreInquiryPrefillFromJourney(journey, { shareKeys: ["summary", "domains"] });
  assert.deepEqual(first, second);
});
