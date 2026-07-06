import test from "node:test";
import assert from "node:assert/strict";

import { isHelpAiExtractorEnabled } from "../../lib/help/aiExtraction.js";
import { runHelpChatWorkflow } from "../../lib/help/chatWorkflow.js";
import { calculateMatchScore } from "../../lib/help/matches.js";

async function withoutHelpAiExtractor(fn) {
  const previous = process.env.HELP_WORKFLOW_AI_EXTRACTOR;
  process.env.HELP_WORKFLOW_AI_EXTRACTOR = "false";
  try {
    return await fn();
  } finally {
    if (previous == null) {
      delete process.env.HELP_WORKFLOW_AI_EXTRACTOR;
    } else {
      process.env.HELP_WORKFLOW_AI_EXTRACTOR = previous;
    }
  }
}

test("help AI extractor is enabled by default but can be disabled", () => {
  assert.equal(isHelpAiExtractorEnabled({}), true);
  assert.equal(isHelpAiExtractorEnabled({ HELP_WORKFLOW_AI_EXTRACTOR: "false" }), false);
  assert.equal(isHelpAiExtractorEnabled({ HELP_WORKFLOW_AI_EXTRACTOR: "1" }), true);
});

// NB (2026-07-06): need testid feilisid, sest kogu chat.helpWorkflow.questions
// i18n-puu (159 võtit/lokaal) kustutati ekslikult 583 surnud võtme puhastuses
// (727a2320) — võtmeid ehitatakse koodis dünaamiliselt ja grep ei näinud neid.
// Puu on git-ajaloost taastatud (commit dd93be2a seisust).
test("help request first turn shows a draft and asks the next useful question", async () => {
  const result = await withoutHelpAiExtractor(() => runHelpChatWorkflow({
    message: "Vajan emale abi poes kaimisega",
    userId: "user-1",
    forcedIntent: "create_help_request",
    replyLang: "et"
  }, {}));

  assert.equal(result.handled, true);
  assert.match(result.reply, /Panin kuulutuse mustandi kokku/);
  assert.match(result.reply, /Kus abi vaja on/);
  assert.equal(result.workflowState.draft.categoryCode, "DAILY_TASKS");
  assert.equal(result.workflowState.draft.beneficiaryLabel, "Emale");
  assert.deepEqual(result.workflowState.draft.targetGroupCodes, []);
});

test("help request does not infer a category from a relation word alone", async () => {
  const result = await withoutHelpAiExtractor(() => runHelpChatWorkflow({
    message: "Vajan abi emale",
    userId: "user-1",
    forcedIntent: "create_help_request",
    replyLang: "et"
  }, {}));

  assert.equal(result.handled, true);
  assert.equal(result.workflowState.draft.categoryCode, "");
  assert.equal(result.workflowState.draft.beneficiaryLabel, "Emale");
  assert.match(result.reply, /Mis liiki abiga on tegu/);
});

test("matching prefers listings with overlapping concrete description terms", () => {
  const request = {
    id: "request-1",
    userId: "requester",
    status: "OPEN",
    primaryCategoryId: "daily",
    primaryCategory: { code: "DAILY_TASKS" },
    title: "Poeabi emale",
    description: "Vajan emale abi poes kaimisega",
    structuredSummary: "Poeabi",
    roleLabel: "Emale"
  };
  const matchingOffer = {
    id: "offer-1",
    userId: "offerer-1",
    status: "OPEN",
    primaryCategoryId: "daily",
    primaryCategory: { code: "DAILY_TASKS" },
    title: "Poeabi",
    description: "Pakun abi poes kaimisega",
    structuredSummary: "Poeabi",
    roleLabel: "Poeabi"
  };
  const genericOffer = {
    id: "offer-2",
    userId: "offerer-2",
    status: "OPEN",
    primaryCategoryId: "daily",
    primaryCategory: { code: "DAILY_TASKS" },
    title: "Igapaevaabi",
    description: "Pakun tuge asjaajamisel",
    structuredSummary: "Igapaevaabi",
    roleLabel: "Igapaevaabi"
  };

  const matchingScore = calculateMatchScore(request, matchingOffer);
  const genericScore = calculateMatchScore(request, genericOffer);

  assert.ok(matchingScore.score > genericScore.score);
  assert.ok(matchingScore.reasons.descriptionOverlap.includes("poes"));
});
