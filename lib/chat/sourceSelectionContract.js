// Browser-safe projection of source-selection diagnostics; no offer creation or hashing.
export const SOURCE_SELECTION_VERSION = "source_selection_v1";
export const isSourceSelectionId = value => typeof value === "string" && /^[\p{L}\p{N}_.:/+-]{1,180}$/u.test(value) && !/^sk-/iu.test(value);
export const isSourceSelectionDigest = value => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const id = isSourceSelectionId, digest = isSourceSelectionDigest;

export function projectSourceSelectionBinding(raw) {
  if (!raw || raw.version !== SOURCE_SELECTION_VERSION || !id(raw.issuingMessageId) ||
    ![raw.revision, raw.operationId, raw.inputHash].every(digest) ||
    !["selected", "clarify", "expired"].includes(raw.action) || !Array.isArray(raw.selectedIds) || raw.selectedIds.length > 2 ||
    raw.selectedIds.some(value => !id(value)) || new Set(raw.selectedIds).size !== raw.selectedIds.length ||
    (raw.action === "selected" ? raw.selectedIds.length < 1 : raw.selectedIds.length !== 0)) return null;
  return { version: SOURCE_SELECTION_VERSION, issuingMessageId: raw.issuingMessageId, revision: raw.revision,
    operationId: raw.operationId, inputHash: raw.inputHash, action: raw.action, selectedIds: [...raw.selectedIds] };
}

export function projectSourceSelectionTrace(raw) {
  if (!raw || raw.version !== SOURCE_SELECTION_VERSION) return null;
  const binding = projectSourceSelectionBinding(raw.binding);
  const allowed = ["offered", "selected", "clarify", "expired", "changed", "unavailable", "answered_separately"];
  return { version: SOURCE_SELECTION_VERSION, ...(allowed.includes(raw.status) ? { status: raw.status } : {}),
    ...(binding ? { binding } : {}),
    selected_document_ids: (Array.isArray(raw.selected_document_ids) ? raw.selected_document_ids : []).filter(id).slice(0, 2),
    parts: (Array.isArray(raw.parts) ? raw.parts : []).slice(0, 2).flatMap(part =>
      [part.document_id, part.source_id, part.document_version].every(id) ? [{
        document_id: part.document_id, source_id: part.source_id, document_version: part.document_version,
        ...(digest(part.reply_hash) ? { reply_hash: part.reply_hash } : {}),
        ...(digest(part.context_hash) ? { context_hash: part.context_hash } : {}),
        identity_eligible: part.identity_eligible === true,
        published: part.published === true,
        ...(["FULL", "PARTIAL", "NONE"].includes(part.semantic_outcome) ? { semantic_outcome: part.semantic_outcome } : {}),
        fact_validation_passed: typeof part.fact_validation_passed === "boolean" ? part.fact_validation_passed : null,
        ...(/^[a-z][a-z_]{0,100}$/u.test(part.fact_validation_reason || "") ? { fact_validation_reason: part.fact_validation_reason } : {}),
        displayed_source_ids: (Array.isArray(part.displayed_source_ids) ? part.displayed_source_ids : []).filter(id).slice(0, 8)
      }] : []),
    offered_document_ids: (Array.isArray(raw.offered_document_ids) ? raw.offered_document_ids : []).filter(id).slice(0, 5),
    ...(digest(raw.revision) ? { revision: raw.revision } : {}) };
}
