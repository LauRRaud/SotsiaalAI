import { createSourceSelection, projectSourceSelectionTrace, renderSourceSelection, sourceSelectionRecovery } from "./sourceSelection.js";
import { recoveryWorkflow } from "./conversationalRecovery.js";
import { buildImmediateChatResponse, finalizeAssistantReply } from "./responseFinalizer.js";
import { persistDone } from "./persistence.js";
import { persistAttemptTerminal, staleAttemptError } from "./ragAttemptStore.js";
import { projectAttemptRuntime, stableEvidenceHash } from "./ragAttemptEvidence.js";
import { callOpenAI } from "./openaiRuntime.js";

const sourceId = source => source?.sourceId || source?.source_id || source?.id;
const safeTitle = value => String(value).replace(/[\r\n]/gu, " ").replace(/[\\`*_{}[\]()<>#+.!|~-]/gu, "\\$&");

export function composeSelectedReplies(parts) {
  if (new Set(parts.map(part => part.option.sourceId)).size !== parts.length) throw new Error("source_selection_ambiguous_source_id");
  const sources = [];
  const sections = parts.map(({ option, output }) => {
    const local = output.displayedSources || output.sources || [];
    if (local.some(source => {
      const documents = [source.document_id, source.documentId, source.doc_id, source.docId].filter(Boolean);
      return sourceId(source) !== option.sourceId || !documents.length || documents.some(id => id !== option.documentId);
    })) throw new Error("source_selection_cross_document_source");
    const mapping = local.map(source => {
      let index = sources.findIndex(item => sourceId(item) === sourceId(source));
      if (index < 0) { sources.push(source); index = sources.length - 1; }
      return index + 1;
    });
    const reply = output.reply.replace(/\[(\d+)\]/gu, (original, number) => {
      if (!mapping[Number(number) - 1]) throw new Error("source_selection_unbound_citation");
      return `[${mapping[Number(number) - 1]}]`;
    });
    return `### ${safeTitle(option.title)}\n\n${reply}`;
  });
  return { reply: sections.join("\n\n"), sources };
}

// The child is the existing single-document answer pipeline, with every write,
// usage settlement and stream disabled. Only its final validated publication is
// captured. The parent publishes and settles exactly once.
export async function handleSourceSelectionResponse(input, deps, runPartition) {
  const turn = input.sourceSelectionTurn;
  const controller = input.ragAttemptController;
  if (!input.persist || !input.claimedTurn || !controller || !turn.rootUserMessageId) throw staleAttemptError();
  let modelCalls = 0;
  const parts = [];
  let reply = "";
  let sources = [];
  let options = turn.options;
  let status = turn.kind === "selected" ? "answered_separately" : turn.kind === "offer" ? "offered" : "unavailable";
  try {
    if (turn.kind === "selected") {
      const results = await Promise.allSettled(turn.partitions.map(async ({ option, retrieval }) => {
        let output;
        const response = await runPartition({ ...input, ...retrieval, sourceSelectionTurn: null, sourceSelectionPartition: true,
          persist: false, convId: null, userId: null, roomId: null, clientTurnKey: null, claimedTurn: null,
          ragAttemptController: null, onAttemptFailure: null, onUsageCommit: null, onUsageRelease: null,
          wantStream: false, wantsDocumentDownload: false, history: [], metadataExtra: null,
          effectiveMessage: turn.context.rootMessage, ragContractMessage: turn.context.rootMessage,
          modelUserMessage: turn.context.rootMessage, expectedRecoveryAssistantMessageId: null,
          recoveryRootUserMessageId: null, logEvent: async () => {}, logInfo: () => {}, logError: () => {} }, {
          ...deps,
          callOpenAI: async request => {
            const index = ++modelCalls;
            if (!await controller.stage("model")) throw staleAttemptError();
            return (deps.callOpenAI || callOpenAI)({ ...request, onRuntimeObservation: async observation => {
              await request.onRuntimeObservation?.(observation);
              const runtime = projectAttemptRuntime(observation);
              if (!await controller.stage("model", { runtime, modelCall: { index, runtime } })) throw staleAttemptError();
            } });
          },
          finalizeAssistantReply: async publication => {
            output = publication;
            return { attachments: [], persisted: { required: false, durable: true } };
          }
        });
        if (!response.ok || !output?.reply) throw new Error("source_selection_partition_failed");
        return { option, output, retrieval };
      }));
      const failed = results.find(result => result.status === "rejected");
      if (failed) throw failed.reason;
      parts.push(...results.map(result => result.value));
      ({ reply, sources } = composeSelectedReplies(parts));
    }
    // The source may have changed while the model was working. Never publish an
    // answer after this fence fails; ask for a fresh choice on the next turn.
    if (turn.recheck && !await turn.recheck()) {
      reply = ""; sources = []; options = turn.refresh ? await turn.refresh() : []; status = "changed";
    }
    const offer = options.length ? createSourceSelection(options, turn.rootUserMessageId) : null;
    const recovery = sourceSelectionRecovery(offer, turn.rootUserMessageId);
    const workflow = recoveryWorkflow(recovery);
    const selectionText = renderSourceSelection(offer?.options || [], input.replyLang,
      status === "changed" || (turn.context && turn.kind !== "selected") ? "refresh" : turn.kind === "selected" ? "continue" : "offer");
    reply = reply ? `${reply}\n\n${selectionText}` : selectionText;
    const selectionTrace = projectSourceSelectionTrace({ version: "source_selection_v1", status,
      binding: turn.context?.binding, revision: offer?.revision,
      offered_document_ids: offer?.options.map(option => option.documentId) || [],
      selected_document_ids: turn.context?.binding.selectedIds || [],
      parts: parts.map(({ option, output, retrieval }) => ({ document_id: option.documentId,
        source_id: option.sourceId, document_version: option.documentVersion,
        reply_hash: stableEvidenceHash(output.reply), context_hash: retrieval.retrievalMeta.renderedContextHash,
        published: status === "answered_separately",
        identity_eligible: retrieval.retrievalMeta.documentIdentityEvidence?.decision?.eligible === true,
        semantic_outcome: output.ragTrace?.fact_validation?.response_decision?.semantic_outcome,
        fact_validation_passed: output.ragTrace?.fact_validation?.passed ?? null,
        fact_validation_reason: output.ragTrace?.fact_validation?.reason,
        displayed_source_ids: (output.displayedSources || output.sources || []).map(sourceId) })) });
    const ragTrace = { version: "v1", diagnostic_turn_id: input.claimedTurn.id,
      retrieved_source_ids: [...new Set(parts.flatMap(part => part.output.ragTrace?.retrieved_source_ids || []))],
      selected_context_source_ids: [...new Set(parts.flatMap(part => part.output.ragTrace?.selected_context_source_ids || []))],
      displayed_source_ids: sources.map(sourceId), source_selection: selectionTrace,
      conversational_recovery: recovery ? { active: true, action: "ask_clarification", target: "source_selection" } : null };
    const { attachments, persisted } = await (deps.finalizeAssistantReply || finalizeAssistantReply)({
      persist: true, persistInitialized: true, turnId: input.claimedTurn.id, convId: input.convId, userId: input.userId,
      role: input.normalizedRole, userMessage: input.effectiveMessage, reply, sources, displayedSources: sources,
      ragTrace, attachments: [], cards: [], metadataExtra: { ...input.metadataExtra, workflow },
      isCrisis: false, replyLang: input.replyLang, ragAttempt: controller.fence, attemptNumber: controller.fence.attempt,
      sourceSelectionBinding: turn.context?.binding || null,
      settleUsage: input.onUsageCommit ? tx => input.onUsageCommit(tx) : null
    }, { persistDone: (publication, options) => persistAttemptTerminal(publication, {
      controller, persist: deps.persistDone || persistDone, onFailure: input.onAttemptFailure
    }, options) });
    if (!persisted?.durable) return input.makeError("chat.error.not_saved", 503);
    return buildImmediateChatResponse({ wantStream: input.wantStream, reply, sources, displayedSources: sources,
      ragTrace, attachments, cards: [], workflow, isCrisis: false, convId: input.convId, diagnosticRef: persisted.diagnosticRef });
  } finally { controller.stop(); }
}
