import { budgetLedgerId, digest, reject } from './contracts.js';

// A product adapter may narrow a verified plan, never grant more source access.
// Exact versions keep a changed/unreviewed document out until the collection is updated.
export function restrictPilotSources(config, collection) {
  if (!collection?.id || !Array.isArray(collection.sources) || !collection.sources.length) reject('source_scope_unavailable', 503);
  if (config.fixedPacketFile || config.queryReuse) reject('source_scope_incompatible', 503);
  const documents = Object.fromEntries(collection.sources
    .filter(source => config.documents[source.documentId] === source.versionId)
    .map(source => [source.documentId, source.versionId]));
  if (!Object.keys(documents).length) reject('source_scope_unavailable', 503);
  return { ...config, documents, sourceScope: collection.id,
    configHash: digest({ parent: config.configHash, scope: collection.id, documents }),
    // Scope changes must never create a fresh money/attempt budget. If this
    // scoped turn creates the ledger first, its identity still belongs to the base plan.
    budgetLedger: budgetLedgerId(config), budgetConfigHash: config.budgetConfigHash ?? config.configHash };
}
