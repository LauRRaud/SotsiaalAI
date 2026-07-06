import test from "node:test";
import assert from "node:assert/strict";

import { buildJourneyDraft } from "../../lib/journey/draft.js";
import { buildAssistiveDevicesHandoff } from "../../lib/journey/assistiveDevices.js";
import { buildHelpMediationHandoff } from "../../lib/journey/helpMediationHandoff.js";
import { buildPreInquiryPrefillFromJourney } from "../../lib/journey/preInquiryHandoff.js";

function actionTypes(draft) {
  return (draft.suggestedActions || []).map((action) => action?.type || "");
}

test("journey draft separates assistive devices from help mediation", () => {
  const draft = buildJourneyDraft({
    situation: "Ema vajab dušitooli ja kodus on trepid, aga me ei tea, kas vaja on kodukohandust."
  });

  assert.equal(draft.context.assistiveDevices.length > 0, true);
  assert.equal(actionTypes(draft).includes("ASSISTIVE_DEVICES"), true);
  assert.equal(buildAssistiveDevicesHandoff(draft).hasAssistiveDeviceNeed, true);
  assert.equal(buildHelpMediationHandoff(draft).hasPracticalNeed, false);
});

test("assistive device practical transport can still offer help mediation separately", () => {
  const draft = buildJourneyDraft({
    situation: "Vajan kedagi, kes aitaks rollaatori koju tuua ja hiljem paigaldamisel abiks olla."
  });

  assert.equal(buildAssistiveDevicesHandoff(draft).hasAssistiveDeviceNeed, true);
  assert.equal(buildHelpMediationHandoff(draft).hasPracticalNeed, true);
  assert.equal(actionTypes(draft).includes("ASSISTIVE_DEVICES"), true);
  assert.equal(actionTypes(draft).includes("HELP_MEDIATION"), true);
});

test("pre-inquiry includes assistive device details only when selected", () => {
  const draft = buildJourneyDraft({
    situation: "Inimesel on rollaator olemas, aga ta ei kasuta seda trepikojas."
  });

  const withoutSelection = buildPreInquiryPrefillFromJourney(draft, {
    shareKeys: ["summary", "domains"]
  });
  const withSelection = buildPreInquiryPrefillFromJourney(draft, {
    shareKeys: ["summary", "domains", "assistiveDevices"]
  });

  assert.equal(withoutSelection.situation.includes("Abivahendid ja kohandused"), false);
  assert.equal(withSelection.situation.includes("Abivahendid ja kohandused"), true);
  assert.equal(withSelection.sharedJourneyInfo.contextNote.includes("rollaator"), true);
});
