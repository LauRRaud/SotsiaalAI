// This is an access check, not the permissive metadata classifier used for search.
const publicCollections = new Set(["sotsiaaltoo_articles", "journal_articles", "research", "research_reports"]);
const audiences = new Set(["CLIENT", "SOCIAL_WORKER", "BOTH"]);
function allowedAudience(value, role) {
  const values = Array.isArray(value) ? value : [value];
  return ["CLIENT", "SOCIAL_WORKER"].includes(role) && values.length > 0 &&
    values.every(item => audiences.has(item)) && values.some(item => item === role || item === "BOTH");
}
export function publicSelectionMetadata(metadata, role) {
  return !!metadata && publicCollections.has(metadata.collection_id) &&
    metadata.collection_id !== process.env.AGENT_RAG_COLLECTION_ID && metadata.source_type !== "agent_document" &&
    metadata.type !== "agent_document" && allowedAudience(metadata.audience || metadata.audiences, role) &&
    (!metadata.audiences || allowedAudience(metadata.audiences, role));
}
export function selectionDocumentCurrent(detail, option, role) {
  return !!detail && detail.id === option.documentId && detail.docId === option.documentId &&
    detail.status === "COMPLETED" && !detail.error && detail.chunks > 0 &&
    detail.lifecycleState === "ACTIVE" && detail.activeVersion === option.documentVersion &&
    publicSelectionMetadata(detail, role) &&
    !(detail.metadataSummary?.source_types || []).includes("agent_document") &&
    !(detail.metadataSummary?.collection_ids || []).some(value => value === "agent_documents" || value === process.env.AGENT_RAG_COLLECTION_ID);
}
export function selectionMatchAllowed(match, option, role) {
  const rows = [match?.metadata, match].filter(Boolean);
  const agrees = (keys, expected) => {
    const values = rows.flatMap(row => keys.map(key => row[key])).filter(value => value !== undefined && value !== null && value !== "");
    return values.length > 0 && values.every(value => value === expected);
  };
  const md = match?.metadata || match;
  return agrees(["doc_id", "docId"], option.documentId) && agrees(["source_id", "sourceId"], option.sourceId) &&
    agrees(["document_version"], option.documentVersion) && publicSelectionMetadata(md, role) &&
    rows.every(row => row.source_type !== "agent_document" && row.type !== "agent_document" &&
      row.is_current_version !== false && (!row.collection_id || row.collection_id === md.collection_id) &&
      (!row.audience || allowedAudience(row.audience, role)));
}
export function scopeSelectionSearch(options, option) {
  if (!option) return options;
  const pin = filters => ({ ...(filters || {}), doc_id: option.documentId, source_id: option.sourceId });
  return { ...options, filters: pin(options.filters), queries: (Array.isArray(options.queries) ? options.queries : [options.queries])
    .filter(Boolean).map(query => typeof query === "string" ? { query, filters: pin() } : { ...query, filters: pin(query.filters) }) };
}

// Bind the offer label to the same group and chunk that confirmed the body topic.
// A ranked metadata candidate or a title keyword cannot manufacture an option.
export function sourceSelectionCandidates(confirmation, groups) {
  if (!confirmation?.topic_evidence?.required || confirmation.candidate_provenance !== "explicit_current_turn" ||
    confirmation.candidate_confidence !== "high" || confirmation.status !== "confirmed_exact") return [];
  const options = new Map();
  for (const candidate of confirmation.topic_evidence.candidates || []) {
    if (!candidate.confirmed || candidate.reason !== "body_topic_confirmed") continue;
    const group = (groups || []).find(item => item.docId === candidate.document_id && item.sourceId === candidate.source_id &&
      item.bodyEvidence?.some(evidence => evidence.document_version === candidate.document_version &&
        evidence.chunk_id === candidate.chunk_id && evidence.chunk_hash === candidate.chunk_hash &&
        evidence.normalized_body_hash === candidate.body_hash));
    if (!group?.title) continue;
    options.set(candidate.document_id, { documentId: candidate.document_id, sourceId: candidate.source_id,
      documentVersion: candidate.document_version, title: group.title, year: group.year || null });
  }
  // Bounded shortlist, never a claim about the author's complete corpus.
  return [...options.values()].slice(0, 5);
}
