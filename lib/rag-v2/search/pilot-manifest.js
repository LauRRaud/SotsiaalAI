import { fail, hash, id, stable } from '../contracts.js';
import { assertSnapshot } from './snapshot.js';
import { checkedTokens, embeddingConfig, OPENAI_EMBEDDING_ENDPOINT } from './embedding.js';

export const realEmbeddingConfig = () => embeddingConfig({ embedding_mode: 'real', provider: 'openai', model: 'text-embedding-3-large', dimensions: 3072, endpoint: OPENAI_EMBEDDING_ENDPOINT });
export function buildPilotManifest(snapshot, questions, baseline) {
  assertSnapshot(snapshot);
  const config = realEmbeddingConfig();
  const inputs = [
    ...snapshot.bundles.flatMap(b => b.chunks.map(c => ({ kind: 'document', document_id: b.document.id, version_id: b.version.id, chunk_id: c.id, text: c.retrieval_text }))),
    ...questions.cases.map(q => ({ kind: 'query', query_id: q.id, language: q.language, text: q.query })),
  ].map(input => ({ ...input, id: id('pilot_input', input.kind, hash(input.text)), input_hash: hash(input.text), tokens: checkedTokens(input.text, config) }));
  if (new Set(inputs.map(i => i.id)).size !== inputs.length) fail('duplicate_pilot_input');
  const declared = [...baseline.document_inputs, ...baseline.queries];
  const differences = [];
  if (inputs.length !== declared.length) differences.push('input_count');
  for (const [index, input] of inputs.entries()) if (input.input_hash !== declared[index]?.input_hash || input.tokens !== declared[index]?.tokens) differences.push(`input_${index}_hash_or_tokens`);
  const files = snapshot.bundles.map(b => ({ document_id: b.document.id, version_id: b.version.id, pdf_sha256: b.version.pdf_hash, metadata_sha256: b.version.metadata_hash }));
  if (stable(files) !== stable(baseline.files)) differences.push('source_files');
  if (baseline.model !== config.model || baseline.dimensions !== config.dimensions || baseline.provider !== config.provider) differences.push('embedding_configuration');
  const manifest = { schema_version: 'rag-v2/egress-manifest-1', tenant: snapshot.tenant, source_plan_id: baseline.plan_id,
    config, files, inputs: inputs.map(({ text: _text, ...item }) => item),
    total_input_tokens: inputs.reduce((n, i) => n + i.tokens, 0), max_api_attempts: inputs.length, retries: 0, generation_calls: 0 };
  if (manifest.total_input_tokens !== baseline.max_total_input_tokens || manifest.max_api_attempts !== baseline.max_api_attempts) differences.push('baseline_limits');
  return { manifest, manifest_sha256: hash(stable(manifest)), inputs, differences, matches_baseline: differences.length === 0 };
}
export function nanoUsd(value) {
  const text = String(value);
  if (!/^\d+(?:\.\d{1,9})?$/.test(text)) fail('invalid_usd_amount');
  const [whole, part = ''] = text.split('.'); return BigInt(whole) * 1000000000n + BigInt(part.padEnd(9, '0'));
}
export function formatUsd(nanos) { const n = BigInt(nanos); return `${n / 1000000000n}.${String(n % 1000000000n).padStart(9, '0')}`; }
export function costNanos(tokens, price) {
  if (!Number.isSafeInteger(tokens) || tokens < 0) fail('invalid_token_usage');
  return (BigInt(tokens) * nanoUsd(price.input_per_million) + 999999n) / 1000000n;
}
export function validatePrice(price, now = Date.now()) {
  if (!price || price.currency !== 'USD' || typeof price.version !== 'string' || !price.version || nanoUsd(price.input_per_million) <= 0n
    || price.source !== 'https://developers.openai.com/api/docs/models/text-embedding-3-large') fail('verified_price_required');
  const checked = Date.parse(price.checked_at);
  if (!Number.isFinite(checked) || checked > now + 60000 || now - checked > 86400000) fail('price_verification_stale');
}
export function validateApproval(prepared, approval, price, now = Date.now()) {
  const { manifest, manifest_sha256: digest } = prepared;
  embeddingConfig(manifest.config);
  if (hash(stable(manifest)) !== digest || prepared.inputs.length !== manifest.inputs.length || manifest.max_api_attempts !== prepared.inputs.length
    || manifest.total_input_tokens !== prepared.inputs.reduce((n, i) => n + i.tokens, 0)
    || prepared.inputs.some((i, n) => { const { text, ...descriptor } = i;
      return stable(descriptor) !== stable(manifest.inputs[n]) || hash(text) !== i.input_hash || checkedTokens(text, manifest.config) !== i.tokens;
    })) fail('pilot_input_hash_mismatch');
  if (!prepared.matches_baseline || prepared.differences.length) fail('pilot_baseline_changed');
  validatePrice(price, now);
  const fields = ['schema_version','state','material_egress_approved','spend_cap_approved','approved_by','approved_at','approval_basis',
    'source_plan_id','egress_manifest_sha256','tenant','config','files','max_api_attempts','max_total_input_tokens','retries','generation_calls','currency','approved_spend_cap'];
  if (approval && Object.keys(approval).some(k => !fields.includes(k))) fail('unknown_approval_field');
  if (!approval || approval.schema_version !== 'rag-v2/pilot-approval-1' || approval.state !== 'approved'
    || approval.material_egress_approved !== true || approval.spend_cap_approved !== true || typeof approval.approved_by !== 'string' || !approval.approved_by.trim()
    || typeof approval.approval_basis !== 'string' || !approval.approval_basis.trim()
    || !Number.isFinite(Date.parse(approval.approved_at)) || Date.parse(approval.approved_at) > now + 60000) fail('pilot_approval_required');
  if (approval.egress_manifest_sha256 !== digest || approval.source_plan_id !== manifest.source_plan_id || approval.tenant !== manifest.tenant
    || stable(approval.config) !== stable(manifest.config) || stable(approval.files) !== stable(manifest.files)
    || approval.currency !== 'USD' || approval.retries !== 0 || approval.generation_calls !== 0) fail('pilot_approval_scope_mismatch');
  if (!Number.isSafeInteger(approval.max_api_attempts) || approval.max_api_attempts < manifest.max_api_attempts
    || !Number.isSafeInteger(approval.max_total_input_tokens) || approval.max_total_input_tokens < manifest.total_input_tokens) fail('pilot_approval_limits_exceeded');
  if (costNanos(manifest.total_input_tokens, price) > nanoUsd(approval.approved_spend_cap)) fail('pilot_spend_cap_exceeded');
}
