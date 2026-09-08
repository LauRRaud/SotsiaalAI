import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuestionRequirementsShadow, projectQuestionRequirementsShadow } from '../lib/chat/questionRequirements.js';
import { projectQuestionRequirementsShadow as projectClient } from '../lib/chat/questionRequirementsContract.js';
import { hasValidatedPublication, hasValidatedDirectedRelationPublication, responseTextHash } from '../lib/chat/responsePolicy.js';
import { hasValidatedPublicationRecord } from '../lib/chat/responsePolicyContract.js';
import { createSourceSelection, normalizeSourceSelection, bindSourceSelection, sourceSelectionBindingMatches,
  projectSourceSelectionTrace } from '../lib/chat/sourceSelection.js';
import { projectSourceSelectionTrace as projectSelectionClient } from '../lib/chat/sourceSelectionContract.js';

test('browser question projection preserves diagnostic fields without copying question text', () => {
  const shadow = buildQuestionRequirementsShadow({ originalMessage: 'Millal algab teenus ja mitu kohta on?' });
  assert.ok(shadow.requirements.length > 0);
  const projected = projectClient(shadow);
  assert.deepEqual(projected, projectQuestionRequirementsShadow(shadow));
  assert.equal(projected.contract_hash, shadow.contract_hash);
  assert.equal(projected.used_for_generation, false);
  assert.ok(projected.requirements.every(item => !Object.hasOwn(item, 'text')));
  assert.equal(projectClient({ ...shadow, version: 'unknown' }), null);
});

test('source-selection projection preserves binding while server still rejects a changed offer', () => {
  const offer = createSourceSelection([{ documentId: 'doc-1', sourceId: 'source-1', documentVersion: 'v1',
    title: 'Private source title' }], 'message-123', { now: 1000, offerId: 'offer-1' });
  assert.ok(normalizeSourceSelection(offer));
  const binding = bindSourceSelection('1', offer, 'issuing-message-123', 1001);
  assert.ok(binding);
  assert.equal(sourceSelectionBindingMatches(binding, offer, '1', { now: 1001 }), true);
  const changed = { ...offer, options: [{ ...offer.options[0], documentVersion: 'v2' }] };
  assert.equal(normalizeSourceSelection(changed), null);
  assert.equal(sourceSelectionBindingMatches(binding, changed, '1', { now: 1001 }), false);
  const trace = { version: offer.version, status: 'selected', binding, selected_document_ids: ['doc-1'],
    offered_document_ids: ['doc-1'], revision: offer.revision, private_text: 'Do not expose' };
  assert.deepEqual(projectSelectionClient(trace), projectSourceSelectionTrace(trace));
  assert.deepEqual(projectSelectionClient(trace).binding, binding);
  assert.equal(Object.hasOwn(projectSelectionClient(trace), 'private_text'), false);
});

test('directed publication still requires both locators and the exact server-authorized reply', () => {
  const trace = { enabled: true, passed: true, version: 'directed_relation_contract_v1',
    document_identity_matched: true, document_identity_confidence: 'high',
    selected_document_id: 'document-1', reason: 'directed_relation_complete',
    directed_relation_evidence_locators: [1, 2].map(relation_index => ({ relation_index,
      document_id: 'document-1', source_id: 'source-1', chunk_id: `chunk-${relation_index}`,
      document_version: 'version-1', chunk_hash: 'a'.repeat(64), rendered_body_hash: 'b'.repeat(64),
      fragment_hash: 'c'.repeat(64), start: 0, end: 10, chunk_start: 0, chunk_end: 10 })),
    response_decision: { version: 'supported_response_v1', issuer: 'directed_relation_contract_v1',
      semantic_outcome: 'COMPLETE', publication_allowed: true, validated_reply_hash: responseTextHash('Bound reply'),
      admitted_slot_indexes: [1], missing_slot_indexes: [] } };
  assert.equal(hasValidatedPublicationRecord(trace), true);
  for (const validate of [hasValidatedPublication, hasValidatedDirectedRelationPublication]) {
    assert.equal(validate(trace, 'Bound reply'), true);
    assert.equal(validate(trace, 'Different reply'), false);
    assert.equal(validate({ ...trace, directed_relation_evidence_locators: trace.directed_relation_evidence_locators.slice(0, 1) }, 'Bound reply'), false);
  }
});

test('diagnostic record validation does not replace server reply hash authorization', () => {
  for (const complete of [true, false]) {
    const trace = { enabled: true, version: 'group_fact_contract_v1',
      document_identity_matched: true, document_identity_confidence: 'high', passed: complete,
      reason: complete ? 'group_fact_complete' : 'group_fact_partial',
      response_decision: { version: 'supported_response_v1', issuer: 'group_fact_contract_v1',
        publication_allowed: true, semantic_outcome: complete ? 'COMPLETE' : 'PARTIAL',
        validated_reply_hash: responseTextHash('Validated reply'), admitted_slot_indexes: [1],
        missing_slot_indexes: complete ? [] : [2] } };
    assert.equal(hasValidatedPublicationRecord(trace), true);
    assert.equal(hasValidatedPublication(trace), true);
    assert.equal(hasValidatedPublication(trace, ' Validated reply '), true);
    assert.equal(hasValidatedPublication(trace, 'Changed reply'), false);
    const denied = { ...trace, response_decision: { ...trace.response_decision, publication_allowed: false } };
    assert.equal(hasValidatedPublicationRecord(denied), false);
    assert.equal(hasValidatedPublication(denied, 'Validated reply'), false);
  }
});
