import test from "node:test";
import assert from "node:assert/strict";

import {
  isFreeHelpWorkflowEligible,
  shouldAllowChatWithoutSubscription
} from "../../lib/chat/subscriptionGate.js";
import { shouldUseHelpWorkflowMode } from "../../lib/chat/workflowModeRouting.js";

// Contract 6: one shared predicate governs the subscription gate AND the workflow route,
// so a free (subscription-less) help intent can only reach the help mediation workflow —
// never the general RAG/LLM path as a free backdoor.

const activeState = intent => ({ intent, step: "collect" });

const SCENARIOS = [
  { name: "explicit help_request mode", input: { forcedMode: "help_request" }, expectFree: true },
  { name: "explicit help_offer mode", input: { forcedMode: "help_offer" }, expectFree: true },
  { name: "explicit help intent", input: { explicitHelpIntent: "create_help_request" }, expectFree: true },
  {
    name: "active free-help workflow",
    input: { helpWorkflowActive: true, helpWorkflowState: activeState("browse_help_offers") },
    expectFree: true
  },
  {
    name: "resumable inactive free-help state",
    input: { helpWorkflowState: activeState("create_help_offer"), helpWorkflowActive: false, detectedHelpIntent: "create_help_offer" },
    expectFree: true
  },
  // Closed backdoor: a bare detected intent on a first message (no explicit mode, no state)
  // must NOT grant free access — otherwise it would fall through to the general LLM.
  { name: "bare detected intent, no state", input: { detectedHelpIntent: "create_help_request" }, expectFree: false },
  { name: "document mode is never free", input: { forcedMode: "document", detectedHelpIntent: "create_help_request" }, expectFree: false },
  { name: "plain question", input: { detectedHelpIntent: "service_guidance" }, expectFree: false },
  { name: "room mode is never free chat", input: { roomId: "room-1", forcedMode: "help_request" }, expectFree: false }
];

test("the gate delegates to the shared free-help predicate", () => {
  for (const { name, input } of SCENARIOS) {
    const viaGate = shouldAllowChatWithoutSubscription({
      roomId: input.roomId ?? null,
      requestedChatMode: input.forcedMode ?? null,
      explicitHelpIntent: input.explicitHelpIntent ?? null,
      detectedHelpIntent: input.detectedHelpIntent ?? null,
      helpWorkflowState: input.helpWorkflowState ?? null,
      helpWorkflowActive: input.helpWorkflowActive ?? false
    });
    const viaPredicate = isFreeHelpWorkflowEligible({
      roomId: input.roomId ?? null,
      forcedMode: input.forcedMode ?? null,
      explicitHelpIntent: input.explicitHelpIntent ?? null,
      detectedHelpIntent: input.detectedHelpIntent ?? null,
      helpWorkflowState: input.helpWorkflowState ?? null,
      helpWorkflowActive: input.helpWorkflowActive ?? false
    });
    assert.equal(viaGate, viaPredicate, `gate must match predicate for: ${name}`);
  }
});

test("free access implies the request is routed to the help workflow (no free LLM leak)", () => {
  for (const { name, input, expectFree } of SCENARIOS) {
    const freeHelpEligible = isFreeHelpWorkflowEligible({
      roomId: input.roomId ?? null,
      forcedMode: input.forcedMode ?? null,
      explicitHelpIntent: input.explicitHelpIntent ?? null,
      detectedHelpIntent: input.detectedHelpIntent ?? null,
      helpWorkflowState: input.helpWorkflowState ?? null,
      helpWorkflowActive: input.helpWorkflowActive ?? false
    });
    assert.equal(freeHelpEligible, expectFree, `unexpected free eligibility for: ${name}`);

    const routed = shouldUseHelpWorkflowMode({
      userId: "user-1",
      roomId: input.roomId ?? null,
      forcedMode: input.forcedMode ?? null,
      explicitHelpModeActive: input.forcedMode === "help_request" || input.forcedMode === "help_offer",
      helpWorkflowActive: input.helpWorkflowActive ?? false,
      inactiveHelpStateCanResume: Boolean(
        input.helpWorkflowState &&
        !input.helpWorkflowActive &&
        input.detectedHelpIntent &&
        input.detectedHelpIntent !== "service_guidance"
      ),
      freeHelpEligible
    });

    if (freeHelpEligible) {
      assert.equal(routed, true, `free access must route to the help workflow for: ${name}`);
    }
  }
});

test("a closed-backdoor request neither is free nor silently routes to a free LLM", () => {
  // Bare detected intent, unauthenticated-style first message: not free, and with no help
  // state/mode it does not route to the help workflow either — so it must hit the paid gate,
  // not a free general-LLM answer.
  const input = { detectedHelpIntent: "create_help_request" };
  const freeHelpEligible = isFreeHelpWorkflowEligible(input);
  assert.equal(freeHelpEligible, false);
  const routed = shouldUseHelpWorkflowMode({
    userId: "user-1",
    forcedMode: null,
    explicitHelpModeActive: false,
    helpWorkflowActive: false,
    inactiveHelpStateCanResume: false,
    freeHelpEligible
  });
  assert.equal(routed, false);
});
