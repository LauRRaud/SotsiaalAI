import test from "node:test";
import assert from "node:assert/strict";

import {
  buildModeSelectionPrompt,
  resolveModeSelection,
  shouldBypassPendingWorkflowForSubstantiveQuestion
} from "../../lib/chat/modeSelection.js";
import { bootstrapChatRequest } from "../../lib/chat/requestBootstrap.js";

function jsonRequest(payload = {}) {
  return {
    cookies: {},
    json: async () => payload
  };
}

function makeBootstrapDeps({ documentWorkflowState = null, helpWorkflowState = null } = {}) {
  return {
    getServerSessionSafe: async () => ({ user: { id: "user-1" } }),
    enforceChatRateLimit: () => null,
    resolveSessionRoleState: () => ({ effectiveRole: "SOCIAL_WORKER", isAdmin: false }),
    requireSubscription: async () => ({ ok: true }),
    canSpendMonthlyBudget: async () => ({ allowed: true }),
    getHelpWorkflowState: async () => helpWorkflowState,
    detectHelpChatIntent: () => null,
    shouldAllowChatWithoutSubscription: () => false,
    getDocumentWorkflowState: async () => documentWorkflowState,
    shouldUseHelpWorkflowMode: ({ helpWorkflowActive, explicitHelpModeActive, inactiveHelpStateCanResume }) =>
      Boolean(helpWorkflowActive || explicitHelpModeActive || inactiveHelpStateCanResume),
    isGreeting: () => false,
    detectCrisis: () => false,
    pickReplyLang: () => "et",
    langStrings: () => ({}),
    countClarifyingTurns: () => 0,
    inferRequestedThoroughness: () => false
  };
}

async function bootstrapForMessage(message, deps) {
  return bootstrapChatRequest({
    req: jsonRequest({
      message,
      history: [],
      persist: false,
      stream: false
    }),
    prisma: {},
    makeError: (key, status = 400, extra = {}) => ({ key, status, extra }),
    logInfo: () => {},
    logEvent: async () => {},
    limits: {
      chatPostRateLimitMax: 24,
      chatRateLimitWindowMs: 60_000,
      historyMaxItems: 8,
      historyMaxChars: 800,
      historyWithDocMaxItems: 8,
      historyWithDocMaxChars: 800,
      ephemeralChunksMax: 80,
      ephemeralChunkCharsMax: 1800
    },
    deps
  });
}

function pendingModeHistory() {
  return [
    {
      role: "user",
      text: "Aita mul valida reziim"
    },
    {
      role: "assistant",
      text: buildModeSelectionPrompt({
        replyLang: "et",
        suggestedMode: "document",
        role: "SOCIAL_WORKER"
      })
    }
  ];
}

test("substantive questions bypass pending mode selection", () => {
  const result = resolveModeSelection({
    message: "Mis on murekohad lastekaitses?",
    history: pendingModeHistory(),
    replyLang: "et",
    role: "SOCIAL_WORKER"
  });

  assert.equal(result.handled, false);
  assert.equal(result.pending_workflow_bypassed, true);
  assert.equal(result.pending_workflow_bypass_reason, "substantive_question");
  assert.equal(result.routed_to_chat_rag_due_to_substantive_question, true);
  assert.equal(result.routedMessage, "Mis on murekohad lastekaitses?");
});

test("overview questions bypass pending mode selection", () => {
  for (const message of [
    "Millised on probleemid lastekaitses?",
    "Millised on peamised kitsaskohad sotsiaaltöös?",
    "Millised teemad korduvad sotsiaaltöö praktikas?"
  ]) {
    const result = resolveModeSelection({
      message,
      history: pendingModeHistory(),
      replyLang: "et",
      role: "SOCIAL_WORKER"
    });

    assert.equal(result.handled, false);
    assert.equal(result.pendingWorkflowBypassed, true, message);
  }
});

test("guidance practice and AI questions bypass pending mode selection", () => {
  for (const message of [
    "Kuidas toetada terviseprobleemiga lapse peret?",
    "Millised põhimõtted on olulised puudega lapse pere toetamisel?",
    "Kuidas spetsialist peaks looma turvalise suhtluskeskkonna lapse ja perega?",
    "Millised on tehisintellekti kasutamise riskid sotsiaaltöös?",
    "Kuidas võib AI mõjutada sotsiaaltöötaja otsustusvastutust?"
  ]) {
    const result = resolveModeSelection({
      message,
      history: pendingModeHistory(),
      replyLang: "et",
      role: "SOCIAL_WORKER"
    });

    assert.equal(result.handled, false);
    assert.equal(result.pendingWorkflowBypassed, true, message);
  }
});

test("organization contact disability and material questions bypass pending mode selection", () => {
  for (const message of [
    "Millised organisatsioonid toetavad nagemispuudega inimesi?",
    "Kust leida abi kuulmispuudega inimesele?",
    "Millised puuetega inimeste kojad tegutsevad Eestis?",
    "Kelle poole poorduda, kui inimesel on liitpuue?",
    "Kas on moni organisatsioon, kes aitab pimekurte inimesi?",
    "Millised kontaktid on nagemispuudega inimeste noustamiseks?",
    "Kas selle teema kohta on juhendmaterjale voi PDF-e?",
    "Millised vormid voi taotlused on selle teenusega seotud?"
  ]) {
    const result = resolveModeSelection({
      message,
      history: pendingModeHistory(),
      replyLang: "et",
      role: "SOCIAL_WORKER"
    });

    assert.equal(result.handled, false);
    assert.equal(result.pendingWorkflowBypassed, true, message);
  }
});

test("legal public-sector and information-system questions bypass pending mode selection", () => {
  for (const message of [
    "Mis on SHS?",
    "Mis on STAR?",
    "Kuidas taotleda toovoime hindamist?",
    "Milline maarus seda reguleerib?",
    "Milline oigusakt seda reguleerib?",
    "Mida teeb Sotsiaalkindlustusamet?",
    "Kas Riigi Teataja määrus seda kinnitab?"
  ]) {
    const result = resolveModeSelection({
      message,
      history: pendingModeHistory(),
      replyLang: "et",
      role: "SOCIAL_WORKER"
    });

    assert.equal(result.handled, false);
    assert.equal(result.pendingWorkflowBypassed, true, message);
  }
});

test("assistant capability questions do not bypass pending document workflow", async () => {
  for (const message of [
    "Kas sa saad teha PDF?",
    "Kas saad dokumendi vormistada?"
  ]) {
    const result = await bootstrapForMessage(
      message,
      makeBootstrapDeps({
        documentWorkflowState: {
          namespace: "document",
          step: "preview",
          flowLocked: true,
          draft: {
            documentType: "avaldus"
          }
        }
      })
    );

    assert.equal(result.response, null);
    assert.equal(result.data.pendingWorkflowBypassed, false, message);
    assert.equal(result.data.shouldUseDocumentWorkflow, true, message);
  }
});

test("workflow confirmations and numeric choices still resolve pending mode selection", () => {
  const yes = resolveModeSelection({
    message: "jah",
    history: pendingModeHistory(),
    replyLang: "et",
    role: "SOCIAL_WORKER"
  });
  const one = resolveModeSelection({
    message: "1",
    history: pendingModeHistory(),
    replyLang: "et",
    role: "SOCIAL_WORKER"
  });

  assert.equal(yes.handled, false);
  assert.equal(yes.resolvedMode, "document");
  assert.equal(yes.pending_workflow_bypassed, undefined);
  assert.equal(one.handled, false);
  assert.equal(one.resolvedMode, "rag");
});

test("document workflow is bypassed for a new KOV substantive question", async () => {
  const result = await bootstrapForMessage(
    "Millised on Kuusalu valla koduteenuse tingimused?",
    makeBootstrapDeps({
      documentWorkflowState: {
        namespace: "document",
        step: "preview",
        flowLocked: true,
        draft: {
          documentType: "avaldus"
        }
      }
    })
  );

  assert.equal(result.response, null);
  assert.equal(result.data.pendingWorkflowBypassed, true);
  assert.equal(result.data.pendingWorkflowBypassReason, "substantive_question");
  assert.equal(result.data.routedToChatRagDueToSubstantiveQuestion, true);
  assert.equal(result.data.shouldUseDocumentWorkflow, false);
});

test("document workflow continues for short format choice", async () => {
  const result = await bootstrapForMessage(
    "PDF",
    makeBootstrapDeps({
      documentWorkflowState: {
        namespace: "document",
        step: "preview",
        flowLocked: true,
        draft: {
          documentType: "avaldus"
        }
      }
    })
  );

  assert.equal(result.response, null);
  assert.equal(result.data.pendingWorkflowBypassed, false);
  assert.equal(result.data.shouldUseDocumentWorkflow, true);
});

test("help workflow continues for confirmation but bypasses substantive questions", async () => {
  const helpState = {
    namespace: "help",
    mode: "draft",
    intent: "create_help_request",
    step: "preview",
    confirmationPending: true
  };
  const confirmation = await bootstrapForMessage("jah", makeBootstrapDeps({ helpWorkflowState: helpState }));
  const substantive = await bootstrapForMessage(
    "Kuidas toetada puudega lapse peret?",
    makeBootstrapDeps({ helpWorkflowState: helpState })
  );

  assert.equal(confirmation.response, null);
  assert.equal(confirmation.data.pendingWorkflowBypassed, false);
  assert.equal(confirmation.data.shouldUseHelpWorkflow, true);
  assert.equal(substantive.response, null);
  assert.equal(substantive.data.pendingWorkflowBypassed, true);
  assert.equal(substantive.data.shouldUseHelpWorkflow, false);
});

test("substantive workflow bypass detection keeps short workflow replies out", () => {
  assert.equal(shouldBypassPendingWorkflowForSubstantiveQuestion("Mis on toimetulekutoetus?"), true);
  assert.equal(shouldBypassPendingWorkflowForSubstantiveQuestion("Millised kontaktid on seotud Kuusalu valla koduteenusega?"), true);
  assert.equal(shouldBypassPendingWorkflowForSubstantiveQuestion("Millised on tehisintellekti väärtuspõhised piirid sotsiaaltöös?"), true);
  assert.equal(shouldBypassPendingWorkflowForSubstantiveQuestion("Millised organisatsioonid toetavad erivajadusega inimesi?"), true);
  assert.equal(shouldBypassPendingWorkflowForSubstantiveQuestion("Kas selle teema kohta on juhendmaterjale voi PDF-e?"), true);
  assert.equal(shouldBypassPendingWorkflowForSubstantiveQuestion("Mis on SHS?"), true);
  assert.equal(shouldBypassPendingWorkflowForSubstantiveQuestion("Mis on STAR?"), true);
  assert.equal(shouldBypassPendingWorkflowForSubstantiveQuestion("Kuidas taotleda toovoime hindamist?"), true);
  assert.equal(shouldBypassPendingWorkflowForSubstantiveQuestion("Milline maarus seda reguleerib?"), true);
  assert.equal(shouldBypassPendingWorkflowForSubstantiveQuestion("Kas sa saad teha PDF?"), false);
  assert.equal(shouldBypassPendingWorkflowForSubstantiveQuestion("Kas saad dokumendi vormistada?"), false);
  assert.equal(shouldBypassPendingWorkflowForSubstantiveQuestion("1"), false);
  assert.equal(shouldBypassPendingWorkflowForSubstantiveQuestion("jah"), false);
  assert.equal(shouldBypassPendingWorkflowForSubstantiveQuestion("ei"), false);
  assert.equal(shouldBypassPendingWorkflowForSubstantiveQuestion("PDF"), false);
});
