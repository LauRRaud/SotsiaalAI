import { createHash } from "node:crypto";
import {
  directedRelationPairKey,
  directedRelationPayloadForSlot,
  directedRelationPayloadMatches,
  directedRelationSetMatches,
  directedReplyMatchesPayload,
  extractDirectedRelations,
  isDirectedRelationSlot,
  renderDirectedRelationPayload
} from "./directedRelationSemantics.js";
import { responseTextHash } from "./responsePolicy.js";
import { isResearchOrJournalSource } from "../rag/sourceMetadata.js";

const hash = value => createHash("sha256").update(String(value || "")).digest("hex");
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const identifier = value => typeof value === "string" && value.length > 0 && value.length <= 512;
const sourceId = source => String(source?.source_id || source?.sourceId || source?.id || "");
const descriptor = slot => ({
  slot_index: Number(slot?.index || slot?.slot_index),
  payload_kind: slot?.payload_kind,
  expected_cardinality: Number(slot?.expected_cardinality),
  requested_event_keys: Array.isArray(slot?.requested_event_keys) ? [...slot.requested_event_keys].sort() : []
});

function bindLocator(group, block, bodySpan, candidate, blockIndex) {
  const original = String(group.bodies?.[bodySpan.original_body_index] || "");
  const evidence = String(block.evidenceText || "").slice(bodySpan.rendered_start_offset, bodySpan.rendered_end_offset);
  const fragment = evidence.slice(candidate.start, candidate.end);
  const at = original.indexOf(fragment);
  if (!fragment || at < 0 || original.lastIndexOf(fragment) !== at ||
    !Number.isInteger(bodySpan.literal_original_start) ||
    at !== bodySpan.literal_original_start + candidate.start ||
    hash(original) !== bodySpan.original_body_hash || hash(evidence) !== bodySpan.rendered_body_hash) return null;
  const reparsed = extractDirectedRelations(original);
  if (reparsed.status !== "ADMITTED" || !reparsed.candidates.some(item =>
    item.start === at && item.end === at + fragment.length && directedRelationPayloadMatches(item, candidate))) return null;
  const provenance = bodySpan.provenance || [];
  if (!provenance.length || !provenance.every(item =>
    item.document_id === group.docId && item.source_status === "active" && identifier(item.chunk_id) &&
    identifier(item.document_version) && /^[a-f0-9]{64}$/u.test(item.chunk_hash || "") &&
    item.normalized_body_hash === hash(original) && Number.isInteger(item.chunk_body_offset) &&
    item.chunk_body_offset >= 0) || new Set(provenance.map(item => item.document_version)).size !== 1) return null;
  const selected = provenance[0];
  return {
    document_id: group.docId,
    source_id: String(group.sourceId || group.docId),
    chunk_id: selected.chunk_id,
    document_version: selected.document_version,
    chunk_hash: selected.chunk_hash,
    rendered_block_index: blockIndex,
    rendered_body_hash: hash(block.evidenceText),
    offset_basis: "rendered_evidence_text_utf16",
    start: bodySpan.rendered_start_offset + candidate.start,
    end: bodySpan.rendered_start_offset + candidate.end,
    chunk_offset_basis: "retrieved_chunk_text_utf16",
    chunk_start: selected.chunk_body_offset + at,
    chunk_end: selected.chunk_body_offset + at + fragment.length,
    fragment_hash: hash(fragment)
  };
}

function selectedRelationPair(located, expectedCardinality, requestedPairKey) {
  const byPair = new Map();
  for (const item of located) {
    const key = directedRelationPairKey(item.candidate);
    if (!key || key !== requestedPairKey) continue;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key).push(item);
  }
  const valid = [];
  for (const items of byPair.values()) {
    const byApproach = new Map();
    let conflict = false;
    for (const item of items) {
      const key = String(item.candidate.approach || "").normalize("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase();
      const previous = byApproach.get(key);
      if (previous && !directedRelationPayloadMatches(previous.candidate, item.candidate)) conflict = true;
      if (!previous) byApproach.set(key, item);
    }
    if (conflict) return { status: "CONFLICT", items: [] };
    const unique = [...byApproach.values()];
    if (unique.length === expectedCardinality) valid.push(unique);
  }
  if (!valid.length) return { status: "MISSING", items: [] };
  if (valid.length > 1) {
    const payloads = valid.map(items => items.map(item => item.candidate));
    if (payloads.slice(1).some(payload => !directedRelationSetMatches(payloads[0], payload))) {
      return { status: "CONFLICT", items: [] };
    }
  }
  return { status: "ADMITTED", items: valid[0] };
}

export function buildDirectedRelationContract({ slots, groups, blocks, documentId, replyLang, baseTrace }) {
  const requirements = slots.map(descriptor);
  const fail = reason => ({ instruction: "", trace: {
    ...baseTrace,
    reason,
    directed_relation_contract_version: "directed_relation_contract_v1",
    directed_relation_requirements: requirements,
    missing_slot_indexes: requirements.map(item => item.slot_index),
    slots: []
  } });
  if (slots.length !== 1 || !slots.every(isDirectedRelationSlot) || !["et", "en", "ru"].includes(replyLang) ||
    !Number.isInteger(slots[0].index) || slots[0].index < 1 || slots[0].index > 12) {
    return fail("directed_relation_requirements_not_supported");
  }
  if (!Array.isArray(groups) || !Array.isArray(blocks) || blocks.length !== groups.length) {
    return fail("directed_relation_locator_missing");
  }
  const located = [];
  for (const [blockIndex, group] of groups.entries()) {
    if (String(group?.docId || "") !== documentId) continue;
    const block = blocks[blockIndex];
    if (!block || group.sourceStatus !== "active") return fail("directed_relation_source_not_active");
    for (const span of block.bodySpans || []) {
      const body = String(block.evidenceText || "").slice(span.rendered_start_offset, span.rendered_end_offset);
      const parsed = extractDirectedRelations(body);
      if (parsed.status === "CONFLICT") return fail("directed_relation_evidence_conflict");
      if (parsed.status === "UNCHECKABLE") return fail("directed_relation_evidence_uncheckable");
      if (parsed.status !== "ADMITTED") continue;
      for (const candidate of parsed.candidates) {
        const locator = bindLocator(group, block, span, candidate, blockIndex);
        if (!locator) return fail("directed_relation_locator_missing");
        located.push({ candidate, locator });
      }
    }
  }
  if (!located.length) return fail("directed_relation_evidence_missing");
  if (new Set(located.map(item => item.locator.document_version)).size !== 1) {
    return fail("directed_relation_source_version_conflict");
  }
  const requestedPairKey = [...slots[0].requested_event_keys].sort().join("::");
  const selected = selectedRelationPair(located, Number(slots[0].expected_cardinality), requestedPairKey);
  if (selected.status === "CONFLICT") return fail("directed_relation_evidence_conflict");
  if (selected.status !== "ADMITTED") return fail("directed_relation_cardinality_mismatch");
  const payload = directedRelationPayloadForSlot({
    status: "ADMITTED",
    candidates: selected.items.map(item => item.candidate)
  }, slots[0]);
  if (!payload) return fail("directed_relation_cardinality_mismatch");
  const unmatched = [...selected.items];
  const locators = payload.relations.map((relation, relationIndex) => {
    const itemIndex = unmatched.findIndex(item => directedRelationPayloadMatches(item.candidate, relation));
    const [item] = unmatched.splice(itemIndex, 1);
    return { relation_index: relationIndex + 1, ...item.locator };
  });
  const mapped = [{
    ...descriptor(slots[0]),
    value_type: "text_relation",
    validation_language: replyLang,
    admitted_payload: payload,
    evidence_locators: locators,
    evidence_fragment_hash: hash(locators.map(item => item.fragment_hash).join(":")),
    evidence_fragment_index: 0,
    minimum_answer_items: Number(slots[0].expected_cardinality),
    minimum_relation_matches: 0,
    minimum_anchor_matches: 0,
    minimum_evidence_anchor_count: 0,
    relation_terms: [],
    matched_relation_terms: [],
    evidence_anchor_terms: [],
    required_numeric_values: [],
    action_object_bindings: []
  }];
  return { instruction: "", trace: {
    ...baseTrace,
    enabled: true,
    complete: true,
    reason: "directed_relations_bound",
    mapped_slot_count: 1,
    used_for_generation: false,
    used_for_validation: false,
    directed_relation_contract_version: "directed_relation_contract_v1",
    directed_relation_requirements: requirements,
    source_id: locators[0].source_id,
    missing_slot_indexes: [],
    slots: mapped
  } };
}

function failureReply(lang) {
  if (lang === "en") return "I cannot confirm the requested order of events in both approaches from the selected source.";
  if (lang === "ru") return "По выбранному источнику я не могу подтвердить запрошенную последовательность событий в обоих подходах.";
  return "Ma ei saa mõlema lähenemise küsitud sündmuste järjekorda valitud allika põhjal kinnitada.";
}

function validateLocator({ locator, expected, sources, identity }) {
  if (!locator || locator.document_id !== identity.selectedDocumentId) return { reason: "directed_relation_locator_missing" };
  const source = sources.find(item => sourceId(item) === locator.source_id &&
    String(item.document_id || item.documentId || "") === locator.document_id && item.source_status === "active");
  if (!source || !isResearchOrJournalSource(source)) return { reason: "identified_document_missing_from_rendered_sources" };
  if (locator.offset_basis !== "rendered_evidence_text_utf16" || locator.chunk_offset_basis !== "retrieved_chunk_text_utf16" ||
    !Number.isInteger(locator.rendered_block_index) || source.rendered_block_index !== locator.rendered_block_index ||
    ![locator.start, locator.end, locator.chunk_start, locator.chunk_end].every(value => Number.isInteger(value) && value >= 0) ||
    locator.start >= locator.end) return { reason: "directed_relation_locator_invalid" };
  const raw = String(source.evidenceText || "");
  const body = raw.slice(raw.indexOf("\n") + 1);
  if (locator.end > body.length || hash(body) !== locator.rendered_body_hash ||
    source.rendered_body_hash !== locator.rendered_body_hash ||
    hash(body.slice(locator.start, locator.end)) !== locator.fragment_hash) {
    return { reason: "directed_relation_rendered_evidence_changed" };
  }
  const span = (source.rendered_body_spans || []).find(item =>
    locator.start >= item.rendered_start_offset && locator.end <= item.rendered_end_offset &&
    (item.provenance || []).some(proof => proof.document_id === locator.document_id &&
      proof.chunk_id === locator.chunk_id && proof.document_version === locator.document_version &&
      proof.chunk_hash === locator.chunk_hash && proof.source_status === "active" &&
      Number.isInteger(item.literal_original_start) &&
      locator.chunk_start === proof.chunk_body_offset + item.literal_original_start + locator.start - item.rendered_start_offset &&
      locator.chunk_end === locator.chunk_start + locator.end - locator.start));
  if (!span) return { reason: "directed_relation_source_version_changed" };
  const spanBody = body.slice(span.rendered_start_offset, span.rendered_end_offset);
  const relativeStart = locator.start - span.rendered_start_offset;
  const relativeEnd = locator.end - span.rendered_start_offset;
  const parsed = extractDirectedRelations(spanBody);
  const candidate = parsed.status === "ADMITTED" ? parsed.candidates.find(item =>
    item.start === relativeStart && item.end === relativeEnd && directedRelationPayloadMatches(item, expected)) : null;
  const fragmentParsed = extractDirectedRelations(body.slice(locator.start, locator.end));
  const fragment = fragmentParsed.status === "ADMITTED" ? fragmentParsed.candidates.find(item =>
    directedRelationPayloadMatches(item, expected)) : null;
  if (!candidate || !fragment) return { reason: "directed_relation_payload_changed" };
  return { sourceId: locator.source_id, candidate };
}

export function validateDirectedRelationReply({ retrievalMeta, sources = [], reply = null, replyLang = "et" } = {}) {
  const requested = retrievalMeta?.queryPlan?.semantic_turn_contract;
  const slots = requested?.requested_facts;
  if (!Array.isArray(slots) || !slots.some(slot => slot?.payload_kind === "directed_event_relation_set")) return null;
  const contract = retrievalMeta?.requestedQualitativeSlotContract;
  const identity = retrievalMeta?.documentIdentityEvidence;
  const base = {
    enabled: true,
    buffered: true,
    passed: false,
    version: "directed_relation_contract_v1",
    requested_qualitative_contract_checked: true,
    requested_qualitative_slot_count: slots.length,
    selected_document_id: identity?.selectedDocumentId || null,
    document_identity_required: true,
    document_identity_matched: identity?.matched === true,
    document_identity_confidence: identity?.confidence || null
  };
  const fail = reason => ({ passed: false, reply: failureReply(replyLang), trace: { ...base, reason } });
  if ((requested.domain_scope?.effective || retrievalMeta?.queryPlan?.question_planner?.social_scope ||
    retrievalMeta?.queryPlan?.social_scope) === "out_of_scope" ||
    retrievalMeta?.queryPlan?.temporal_query_contract?.current_evidence_scope === "current") {
    return fail("directed_relation_scope_not_eligible");
  }
  if (retrievalMeta?.queryPlan?.mode !== "specific_research_fact" ||
    requested.requested_fact_contract?.complete !== true || slots.length !== 1 || !slots.every(isDirectedRelationSlot) ||
    !["et", "en", "ru"].includes(replyLang)) return fail("directed_relation_requirements_not_supported");
  if (identity?.matched !== true || identity?.confidence !== "high" || !identity.selectedDocumentId) {
    return fail("document_identity_unconfirmed");
  }
  const requirements = slots.map(descriptor);
  if (contract?.directed_relation_contract_version !== "directed_relation_contract_v1" ||
    !same(requirements, contract.directed_relation_requirements) || contract?.reason !== "directed_relations_bound" ||
    contract?.enabled !== true || contract?.complete !== true) {
    return fail(String(contract?.reason || "").startsWith("directed_relation_") ? contract.reason : "directed_relation_contract_missing");
  }
  const mapped = Array.isArray(contract.slots) ? contract.slots : [];
  if (mapped.length !== 1 || !same(descriptor(mapped[0]), requirements[0]) ||
    mapped[0]?.admitted_payload?.kind !== "directed_event_relation_set" ||
    !Array.isArray(mapped[0].admitted_payload.relations) ||
    mapped[0].admitted_payload.relations.length !== Number(slots[0].expected_cardinality)) {
    return fail("directed_relation_requirements_not_supported");
  }
  const locators = mapped[0].evidence_locators;
  if (!Array.isArray(locators) || locators.length !== mapped[0].admitted_payload.relations.length ||
    new Set(locators.map(item => item.relation_index)).size !== locators.length) {
    return fail("directed_relation_locator_missing");
  }
  const supportingIds = new Set();
  const reparsed = [];
  for (const [index, expected] of mapped[0].admitted_payload.relations.entries()) {
    const result = validateLocator({ locator: locators[index], expected, sources, identity });
    if (result.reason) return fail(result.reason);
    supportingIds.add(result.sourceId);
    reparsed.push(result.candidate);
  }
  if (!directedRelationSetMatches(reparsed, mapped[0].admitted_payload.relations)) {
    return fail("directed_relation_payload_changed");
  }
  const canonicalReply = renderDirectedRelationPayload(mapped[0].admitted_payload, replyLang);
  if (!canonicalReply) return fail("directed_relation_render_failed");
  if (reply !== null && String(reply).trim() !== canonicalReply &&
    !directedReplyMatchesPayload(reply, mapped[0].admitted_payload)) {
    return fail("directed_relation_rendered_reply_mismatch");
  }
  const locatorTrace = locators.map(item => ({ slot_index: mapped[0].slot_index, ...item }));
  return { passed: true, reply: canonicalReply, trace: {
    ...base,
    passed: true,
    reason: "directed_relation_complete",
    requested_fact_requested_slot_count: 1,
    requested_fact_covered_slot_count: 1,
    requested_fact_missing_slot_indexes: [],
    supporting_source_id: [...supportingIds][0],
    supporting_source_ids: [...supportingIds],
    response_decision: {
      version: "supported_response_v1",
      issuer: "directed_relation_contract_v1",
      semantic_outcome: "COMPLETE",
      publication_allowed: true,
      validated_reply_hash: responseTextHash(canonicalReply),
      admitted_slot_indexes: [mapped[0].slot_index],
      missing_slot_indexes: []
    },
    directed_relation_evidence_locators: locatorTrace
  } };
}
