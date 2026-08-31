import { buildRagHeaders, ragServiceRequest } from "../documents/ragService.js";
import { selectionDocumentCurrent } from "./sourceSelectionEvidence.js";

export async function checkSourceSelectionDocument(option, role, request = ragServiceRequest) {
  try {
    const detail = await request(`/documents/${encodeURIComponent(option.documentId)}`, {
      cache: "no-store", headers: buildRagHeaders("application/json", { route: "api/chat", stage: "source_selection_check" })
    });
    return selectionDocumentCurrent(detail, option, role);
  } catch { return false; }
}

// Independent documents get independent retrieval/identity/fact contracts. Never
// put two selected documents into the single-document validator's context.
export async function assembleSourceSelection({ context, rootUserMessageId, args, assemble, check = checkSourceSelectionDocument, now = Date.now() }) {
  if (context) args = { ...args, rawHistory: [], trustedRagRecoveryState: null, ephemeralChunks: [], ephemeralSource: null,
    combineSources: false, forceSources: true, forcedMode: "rag" };
  const checkOptions = async options => {
    const checks = await Promise.all(options.map(option => check(option, args.normalizedRole)));
    return options.filter((_, index) => checks[index]);
  };
  const refresh = async () => checkOptions((await assemble(args))?.retrievalMeta?.sourceSelectionCandidates || []);
  if (context && context.binding.action === "selected" && now >= context.offer.issuedAt && now < context.offer.expiresAt) {
    const selected = context.binding.selectedIds.map(id => context.offer.options.find(option => option.documentId === id));
    if (selected.every(Boolean) && (await checkOptions(selected)).length === selected.length) {
      const partitions = await Promise.all(selected.map(async option => ({ option, retrieval: await assemble({ ...args,
        rawHistory: [], trustedRagRecoveryState: null, ephemeralChunks: [], ephemeralSource: null, combineSources: false,
        trustedSourceSelectionDocument: option }) })));
      // Retrieval must actually prove the pinned identity. A missing version or
      // denied chunk must not fall through to a general answer.
      if (partitions.every(({ option, retrieval }) => retrieval.retrievalMeta?.documentIdentityEvidence?.selectedDocumentId === option.documentId &&
        retrieval.retrievalMeta?.documentIdentityEvidence?.decision?.eligible === true && retrieval.sources?.length > 0)) {
        return { ...partitions[0].retrieval, sourceSelectionTurn: { kind: "selected", context, partitions,
          rootUserMessageId, options: context.offer.options,
          refresh, recheck: async () => (await checkOptions(context.offer.options)).length === context.offer.options.length } };
      }
    }
  }
  const retrieval = await assemble(args);
  if (!retrieval) return retrieval;
  const candidates = retrieval.retrievalMeta?.sourceSelectionCandidates || [];
  if (!context && candidates.length < 2) return retrieval;
  const options = await checkOptions(candidates);
  if (!context && options.length < 2) return retrieval;
  return { ...retrieval, sourceSelectionTurn: { kind: options.length ? "offer" : "unavailable", context,
    rootUserMessageId, options, partitions: [], refresh, recheck: async () => (await checkOptions(options)).length === options.length } };
}
