import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHelpRequestProjectionFromJourney,
  partitionHelpRequestShareKeys
} from "../../lib/journey/helpRequestProjection.js";
import { normalizeJourneyCreateInput } from "../../lib/journey/validation.js";

const journey = {
  id: "journey-owner-a",
  title: "Praktiline abi",
  summary: "SUMMARY_MARKER vajan transporti",
  domains: ["igapäevaelu toimingud"],
  riskSignals: ["RISK_MARKER ei tohi liikuda"],
  context: {
    municipalityName: "REGION_MARKER vald",
    personWish: "OWN_WORDS_MARKER soovin abi koju",
    helpMediation: {
      timing: "TIMING_MARKER kord nädalas",
      conditions: "CONDITIONS_MARKER ainult tööpäeval"
    }
  }
};

const persistedJourney = { id: journey.id, ...normalizeJourneyCreateInput(journey) };

function serialized(keys) {
  return JSON.stringify(buildHelpRequestProjectionFromJourney(persistedJourney, { shareKeys: keys }));
}

test("SOL-JOUR-10: every help-request share key controls its own persisted marker", () => {
  const empty = serialized([]);
  for (const marker of ["SUMMARY_MARKER", "REGION_MARKER", "OWN_WORDS_MARKER", "TIMING_MARKER", "CONDITIONS_MARKER", "RISK_MARKER"]) {
    assert.doesNotMatch(empty, new RegExp(marker));
  }

  assert.match(serialized(["summary"]), /SUMMARY_MARKER/);
  assert.doesNotMatch(serialized(["summary"]), /OWN_WORDS_MARKER|REGION_MARKER/);

  const categoryOnly = buildHelpRequestProjectionFromJourney(persistedJourney, { shareKeys: ["category"] });
  assert.equal(categoryOnly.draft.categoryCode, "TRANSPORT");
  assert.doesNotMatch(JSON.stringify(categoryOnly), /SUMMARY_MARKER|REGION_MARKER|OWN_WORDS_MARKER/);

  assert.match(serialized(["region"]), /REGION_MARKER/);
  assert.doesNotMatch(serialized(["region"]), /SUMMARY_MARKER|OWN_WORDS_MARKER/);
  assert.match(serialized(["ownWords"]), /OWN_WORDS_MARKER/);
  assert.match(serialized(["timing"]), /TIMING_MARKER/);
  assert.match(serialized(["conditions"]), /CONDITIONS_MARKER/);

  const all = serialized(["summary", "category", "region", "ownWords", "timing", "conditions"]);
  assert.doesNotMatch(all, /RISK_MARKER/);
});

test("SOL-JOUR-10: malformed and unknown share keys fail closed", () => {
  assert.throws(
    () => partitionHelpRequestShareKeys("summary"),
    { code: "INVALID_HELP_REQUEST_SHARE_KEYS", status: 400 }
  );
  assert.deepEqual(partitionHelpRequestShareKeys(["summary", "unknown", "summary"]), {
    confirmedKeys: ["summary"],
    ignoredKeys: ["unknown"]
  });
});
