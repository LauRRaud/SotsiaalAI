import test from "node:test";
import assert from "node:assert/strict";

import { buildJourneyDraft } from "../../lib/journey/draft.js";
import { buildHelpMediationHandoff } from "../../lib/journey/helpMediationHandoff.js";

function actionTypes(draft) {
  return (draft.suggestedActions || []).map((action) => action?.type || "");
}

test("journey draft adds help mediation when practical support is signalled", () => {
  const draft = buildJourneyDraft({
    situation: "Vajan transporti arsti juurde ja vahel abi poes käimisel."
  });

  assert.equal(draft.context.helpMediation.categoryCode, "TRANSPORT");
  assert.equal(actionTypes(draft).includes("HELP_MEDIATION"), true);
});

test("journey draft does not add help mediation for a general information need", () => {
  const draft = buildJourneyDraft({
    situation: "Soovin aru saada, millised sotsiaaltoetused võivad minu olukorras olemas olla."
  });

  assert.equal(draft.context.helpMediation, undefined);
  assert.equal(actionTypes(draft).includes("HELP_MEDIATION"), false);
});

test("help mediation handoff reads existing suggested actions and municipality text", () => {
  const handoff = buildHelpMediationHandoff({
    id: "journey-1",
    summary: "Olukord vajab täpsustamist.",
    suggestedActions: [
      { title: "Loo abisoov koduabi leidmiseks" }
    ],
    context: {
      municipalityText: "Tartu linn"
    }
  });

  assert.equal(handoff.hasPracticalNeed, true);
  assert.equal(handoff.categoryCode, "HOME_HELP");
  assert.equal(handoff.municipalityName, "Tartu linn");
  assert.match(handoff.viewOffersHref, /type=HELP_OFFER/);
  assert.match(handoff.createRequestHref, /fromJourney=journey-1/);
});
