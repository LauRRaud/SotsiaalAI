import assert from "node:assert/strict";
import test from "node:test";

import { buildHelpMediationHandoff } from "../../lib/journey/helpMediationHandoff.js";
import { buildPreInquiryPrefillFromJourney } from "../../lib/journey/preInquiryHandoff.js";
import { buildServiceMapHandoff } from "../../lib/journey/serviceMapHandoff.js";

test("SOL-JOUR-13: all Journey handoffs resolve Pärnu identically", () => {
  const journey = {
    id: "journey-parnu",
    title: "Abi",
    summary: "Vajan transporti Pärnus",
    domains: ["igapäevaelu toimingud"],
    context: {}
  };

  assert.equal(buildServiceMapHandoff(journey).filters.municipalityName, "Pärnu");
  assert.equal(
    buildPreInquiryPrefillFromJourney(journey, { shareKeys: ["municipality"] }).municipality,
    "Pärnu"
  );
  assert.equal(buildHelpMediationHandoff(journey).municipalityName, "Pärnu");
});

test("SOL-JOUR-13: a municipality id is never exposed as a display name", () => {
  const journey = {
    summary: "Vajan transporti",
    domains: ["igapäevaelu toimingud"],
    context: { municipalityId: "kov-internal-123" }
  };
  const handoff = buildHelpMediationHandoff(journey);
  assert.equal(handoff.municipalityId, "kov-internal-123");
  assert.equal(handoff.municipalityName, "");
  assert.doesNotMatch(handoff.createRequestHref, /kov-internal-123/u);
});
