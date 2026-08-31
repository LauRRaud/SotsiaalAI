import { createHash } from "node:crypto";
import { extractGroupFacts, groupPayloadForSlot, isGroupFactSlot } from "./groupFactSemantics.js";
import { responseTextHash } from "./responsePolicy.js";
import { isResearchOrJournalSource } from "../rag/sourceMetadata.js";

const hash = value => createHash("sha256").update(String(value || "")).digest("hex");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const identifier = value => typeof value === "string" && value.length > 0 && value.length <= 512;
const sourceId = source => String(source?.source_id || source?.sourceId || source?.id || "");
const slotDescriptor = slot => ({ slot_index: Number(slot.index || slot.slot_index),
  payload_kind: slot.payload_kind, group_role: slot.group_role || null, group_population: slot.group_population || null });

function bindLocator(group, block, bodySpan, candidate, blockIndex) {
  const original = String(group.bodies?.[bodySpan.original_body_index] || "");
  const evidence = String(block.evidenceText || "").slice(bodySpan.rendered_start_offset, bodySpan.rendered_end_offset);
  const fragment = evidence.slice(candidate.start, candidate.end);
  const at = original.indexOf(fragment);
  if (!fragment || at < 0 || original.lastIndexOf(fragment) !== at ||
    !Number.isInteger(bodySpan.literal_original_start) ||
    at !== bodySpan.literal_original_start + candidate.start ||
    hash(original) !== bodySpan.original_body_hash || hash(evidence) !== bodySpan.rendered_body_hash) return null;
  // Clipping must not remove a condition, retraction or other assertion frame.
  const originalResult = extractGroupFacts(original);
  if (originalResult.status !== "ADMITTED" || !originalResult.candidates.some(item =>
    item.start === at && item.end === at + fragment.length &&
    same(item.partition, candidate.partition) && same(item.membership, candidate.membership))) return null;
  const provenance = bodySpan.provenance || [];
  if (!provenance.length || !provenance.every(item =>
    item.document_id === group.docId && item.source_status === "active" && identifier(item.chunk_id) && identifier(item.document_version) &&
    /^[a-f0-9]{64}$/u.test(item.chunk_hash || "") &&
    item.normalized_body_hash === hash(original) &&
    Number.isInteger(item.chunk_body_offset) && item.chunk_body_offset >= 0) ||
    new Set(provenance.map(item => item.document_version)).size !== 1) return null;
  const selected = provenance[0];
  return {
    document_id: group.docId, source_id: String(group.sourceId || group.docId),
    chunk_id: selected.chunk_id, document_version: selected.document_version, chunk_hash: selected.chunk_hash,
    rendered_block_index: blockIndex, rendered_body_hash: hash(block.evidenceText),
    offset_basis: "rendered_evidence_text_utf16",
    start: bodySpan.rendered_start_offset + candidate.start, end: bodySpan.rendered_start_offset + candidate.end,
    chunk_offset_basis: "retrieved_chunk_text_utf16",
    chunk_start: selected.chunk_body_offset + at, chunk_end: selected.chunk_body_offset + at + fragment.length,
    fragment_hash: hash(fragment)
  };
}

export function buildGroupFactContract({ slots, groups, blocks, documentId, replyLang, baseTrace }) {
  const requirements = slots.map(slotDescriptor);
  const fail = reason => ({ instruction: "", trace: { ...baseTrace, reason,
    group_contract_version: "group_fact_contract_v1", group_requirements: requirements,
    missing_slot_indexes: requirements.map(slot => slot.slot_index), slots: [] } });
  if (!slots.length || !slots.every(isGroupFactSlot) || slots.length > 12 ||
    slots.some(slot => slot.group_role && !["intervention", "control"].includes(slot.group_role)) ||
    slots.some(slot => !Number.isInteger(slot.index) || slot.index < 1 || slot.index > 12) ||
    new Set(slots.map(slot => slot.index)).size !== slots.length) return fail("group_requirements_not_supported");
  if (!Array.isArray(blocks) || blocks.length !== groups.length) return fail("group_locator_missing");
  const located = [];
  for (const [index, group] of groups.entries()) {
    if (String(group.docId || "") !== documentId) continue;
    const block = blocks[index];
    if (!block || group.sourceStatus !== "active") return fail("group_source_not_active");
    const spans = block.bodySpans || [];
    for (const span of spans) {
      const body = String(block.evidenceText || "").slice(span.rendered_start_offset, span.rendered_end_offset);
      const result = extractGroupFacts(body);
      if (["CONFLICT", "UNCHECKABLE"].includes(result.status)) return fail(
        result.status === "CONFLICT" ? "group_evidence_conflict" : "group_evidence_uncheckable");
      if (result.status !== "ADMITTED") continue;
      for (const candidate of result.candidates) {
        const locator = bindLocator(group, block, span, candidate, index);
        if (!locator) return fail("group_locator_missing");
        located.push({ candidate, locator });
      }
    }
  }
  if (!located.length) return fail("group_evidence_missing");
  const populations = slots.map(slot => slot.group_population).filter(Boolean);
  if (populations.some(population => located.some(item =>
    item.candidate.partition.population !== population + "is"))) return fail("group_population_mismatch");
  if (new Set(located.map(item => item.locator.document_version)).size !== 1) return fail("group_source_version_conflict");
  if (located.some(item => !same(item.candidate.partition, located[0].candidate.partition))) return fail("group_evidence_conflict");
  const memberCandidates = located.filter(item => item.candidate.membership);
  if (memberCandidates.some(item => !same(item.candidate.membership, memberCandidates[0].candidate.membership))) return fail("group_evidence_conflict");
  const mapped = slots.flatMap(slot => {
    const item = slot.payload_kind === "group_distribution" ? located[0] : memberCandidates[0];
    const result = item ? { status: "ADMITTED", candidates: [item.candidate] } : null;
    const payload = groupPayloadForSlot(result, slot);
    if (!payload) return [];
    return [{
      ...slotDescriptor(slot), value_type: slot.value_type, validation_language: replyLang,
      admitted_payload: payload, evidence_locator: item.locator,
      evidence_fragment_hash: item.locator.fragment_hash, evidence_fragment_index: 0,
      minimum_answer_items: 1, minimum_relation_matches: 0, minimum_anchor_matches: 0,
      minimum_evidence_anchor_count: 0, relation_terms: [], matched_relation_terms: [],
      evidence_anchor_terms: [], required_numeric_values: [], action_object_bindings: []
    }];
  });
  const missing = requirements.filter(slot => !mapped.some(item => item.slot_index === slot.slot_index))
    .map(slot => slot.slot_index);
  const complete = missing.length === 0;
  return { instruction: "", trace: { ...baseTrace, enabled: complete, complete,
    reason: complete ? "group_facts_bound" : "group_membership_missing",
    mapped_slot_count: mapped.length, used_for_generation: false, used_for_validation: false,
    group_contract_version: "group_fact_contract_v1", group_requirements: requirements,
    source_id: located[0].locator.source_id, missing_slot_indexes: missing, slots: mapped } };
}

function renderPayload(payload, lang) {
  if (payload.kind === "group_distribution") {
    const intervention = payload.groups.find(group => group.role === "intervention").count;
    const control = payload.groups.find(group => group.role === "control").count;
    if (lang === "en") return "Distribution of " + payload.total + " municipalities: " + intervention +
      " in the group implementing the intervention plan; " + control + " in the control group without intervention activities.";
    if (lang === "ru") return "Распределение " + payload.total + " муниципалитетов: " + intervention +
      " в группе, реализующей план вмешательства; " + control + " в контрольной группе без мероприятий вмешательства.";
    return payload.total + " omavalitsuse jaotus: sekkumiskava rakendavas rühmas " + intervention +
      "; sekkumistegevusteta kontrollrühmas " + control + ".";
  }
  const names = payload.members.map(member => member.source_name + (lang === "en"
    ? member.entity_type === "city" ? " (city)" : " (rural municipality)"
    : lang === "ru" ? member.entity_type === "city" ? " (город)" : " (волость)"
    : member.entity_type === "city" ? " linn" : " vald"));
  const prefix = lang === "en" ? "Municipalities implementing the intervention plan: "
    : lang === "ru" ? "Муниципалитеты, реализующие план вмешательства: "
    : "Sekkumiskava rakendavad omavalitsused: ";
  return prefix + names.join(", ") + ".";
}

function missingReply(lang) {
  return lang === "en" ? "I cannot confirm the complete list of municipalities in the requested group from the available evidence."
    : lang === "ru" ? "По имеющимся доказательствам я не могу подтвердить полный список муниципалитетов запрошенной группы."
    : "Küsitud rühma omavalitsuste täielikku nimeloetelu ei saa ma olemasoleva tõendi põhjal kinnitada.";
}

function failureReply(lang) {
  return lang === "en" ? "I cannot confirm the requested distribution and group membership from the selected source."
    : lang === "ru" ? "Не могу подтвердить запрошенное распределение и состав групп по выбранному источнику."
    : "Ma ei saa küsitud jaotust ja rühma liikmesust valitud allika põhjal kinnitada.";
}

// Called both before the deterministic route and by the fact validator.
// No draft is authorized just because it mentions the right numbers or names.
export function validateGroupFactReply({ retrievalMeta, sources = [], reply = null, replyLang = "et" } = {}) {
  const requested = retrievalMeta?.queryPlan?.semantic_turn_contract;
  const slots = requested?.requested_facts;
  if (!Array.isArray(slots) || !slots.some(isGroupFactSlot)) return null;
  const contract = retrievalMeta?.requestedQualitativeSlotContract;
  const identity = retrievalMeta?.documentIdentityEvidence;
  const base = { enabled: true, buffered: true, passed: false, version: "group_fact_contract_v1",
    requested_qualitative_contract_checked: true, requested_qualitative_slot_count: slots.length,
    selected_document_id: identity?.selectedDocumentId || null,
    document_identity_required: true, document_identity_matched: identity?.matched === true,
    document_identity_confidence: identity?.confidence || null };
  const fail = reason => ({ passed: false, reply: failureReply(replyLang), trace: { ...base, reason } });
  if ((requested.domain_scope?.effective || retrievalMeta.queryPlan.question_planner?.social_scope ||
    retrievalMeta.queryPlan.social_scope) === "out_of_scope" ||
    retrievalMeta.queryPlan.temporal_query_contract?.current_evidence_scope === "current") return fail("group_scope_not_eligible");
  if (retrievalMeta?.queryPlan?.mode !== "specific_research_fact" ||
    requested.requested_fact_contract?.complete !== true || !slots.every(isGroupFactSlot) ||
    !["et", "en", "ru"].includes(replyLang)) return fail("group_requirements_not_supported");
  if (identity?.matched !== true || identity?.confidence !== "high" || !identity.selectedDocumentId) return fail("document_identity_unconfirmed");
  if (contract?.group_contract_version !== "group_fact_contract_v1" ||
    !same(slots.map(slotDescriptor), contract.group_requirements) ||
    !["group_facts_bound", "group_membership_missing"].includes(contract.reason)) {
    return fail(contract?.reason?.startsWith("group_") ? contract.reason : "group_contract_missing");
  }
  const mapped = contract.slots || [];
  if (!mapped.length) return fail("group_evidence_missing");
  if (mapped.length > slots.length || new Set(mapped.map(slot => slot.slot_index)).size !== mapped.length ||
    mapped.some(slot => !slots.some(request => same(slotDescriptor(request), slotDescriptor(slot))))) return fail("group_requirements_not_supported");
  const supportingIds = new Set();
  for (const slot of mapped) {
    const locator = slot.evidence_locator;
    if (!locator || locator.document_id !== identity.selectedDocumentId) return fail("group_locator_missing");
    const source = sources.find(item => sourceId(item) === locator.source_id &&
      String(item.document_id || item.documentId || "") === locator.document_id && item.source_status === "active");
    if (!source || !isResearchOrJournalSource(source)) return fail("identified_document_missing_from_rendered_sources");
    if (locator.offset_basis !== "rendered_evidence_text_utf16" || locator.chunk_offset_basis !== "retrieved_chunk_text_utf16" ||
      !Number.isInteger(locator.rendered_block_index) || source.rendered_block_index !== locator.rendered_block_index ||
      ![locator.start, locator.end, locator.chunk_start, locator.chunk_end].every(value => Number.isInteger(value) && value >= 0) ||
      locator.start >= locator.end) return fail("group_locator_invalid");
    const raw = String(source.evidenceText || "");
    const body = raw.slice(raw.indexOf("\n") + 1);
    if (locator.end > body.length || hash(body) !== locator.rendered_body_hash || source.rendered_body_hash !== locator.rendered_body_hash ||
      hash(body.slice(locator.start, locator.end)) !== locator.fragment_hash) return fail("group_rendered_evidence_changed");
    const span = (source.rendered_body_spans || []).find(item =>
      locator.start >= item.rendered_start_offset && locator.end <= item.rendered_end_offset &&
      (item.provenance || []).some(proof => proof.document_id === locator.document_id &&
        proof.chunk_id === locator.chunk_id && proof.document_version === locator.document_version &&
        proof.chunk_hash === locator.chunk_hash && proof.source_status === "active" &&
        Number.isInteger(item.literal_original_start) &&
        locator.chunk_start === proof.chunk_body_offset + item.literal_original_start + locator.start - item.rendered_start_offset &&
        locator.chunk_end === locator.chunk_start + locator.end - locator.start));
    if (!span) return fail("group_source_version_changed");
    const parsed = extractGroupFacts(body.slice(span.rendered_start_offset, span.rendered_end_offset));
    const payload = groupPayloadForSlot(parsed, { ...slot, group_role: slot.group_role || slot.admitted_payload?.group_role });
    const fragmentPayload = groupPayloadForSlot(extractGroupFacts(body.slice(locator.start, locator.end)), slot);
    if (!same(payload, slot.admitted_payload) || !same(fragmentPayload, payload)) return fail("group_payload_changed");
    if (slots.some(request => request.group_population && payload?.population !== request.group_population + "is")) return fail("group_population_mismatch");
    supportingIds.add(locator.source_id);
  }
  const missing = slots.filter(slot => !mapped.some(item => item.slot_index === slot.index));
  if (missing.some(slot => slot.payload_kind !== "group_membership")) return fail("group_distribution_missing");
  const lines = slots.map(slot => {
    const found = mapped.find(item => item.slot_index === slot.index);
    return found ? renderPayload(found.admitted_payload, replyLang) : missingReply(replyLang);
  });
  const canonicalReply = lines.join("\n");
  if (reply !== null && String(reply).trim() !== canonicalReply) return fail("group_rendered_reply_mismatch");
  const complete = missing.length === 0;
  return { passed: complete, reply: canonicalReply, trace: { ...base, passed: complete,
    reason: complete ? "group_fact_complete" : "group_fact_partial",
    requested_fact_requested_slot_count: slots.length, requested_fact_covered_slot_count: mapped.length,
    requested_fact_missing_slot_indexes: missing.map(slot => slot.index),
    supporting_source_id: [...supportingIds][0], supporting_source_ids: [...supportingIds],
    response_decision: { version: "supported_response_v1", issuer: "group_fact_contract_v1",
      semantic_outcome: complete ? "COMPLETE" : "PARTIAL", publication_allowed: true,
      validated_reply_hash: responseTextHash(canonicalReply),
      admitted_slot_indexes: mapped.map(slot => slot.slot_index), missing_slot_indexes: missing.map(slot => slot.index) },
    group_evidence_locators: mapped.map(slot => ({ slot_index: slot.slot_index, ...slot.evidence_locator })) } };
}
