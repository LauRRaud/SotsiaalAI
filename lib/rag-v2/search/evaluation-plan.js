import { fail, hash, id } from '../contracts.js';
import { checkedTokens, embeddingConfig, TOKENIZER } from './embedding.js';

export function evaluationPlan(snapshot, questions, pricing = null) {
  const b = snapshot.bundles.find(b => b.version.pdf_hash === questions.source_pdf_sha256);
  if (!b) fail('evaluation_asset_missing');
  const inputs = snapshot.bundles.flatMap(bundle => bundle.chunks.map(chunk => ({ kind: 'document', document_id: bundle.document.id,
    version_id: bundle.version.id, chunk_id: chunk.id, input_hash: hash(chunk.retrieval_text), tokens: checkedTokens(chunk.retrieval_text, embeddingConfig()) })));
  const queries = questions.cases.map(q => {
    const anchors = q.expected_anchors.map(anchor => {
      const spans = b.spans.filter(s => s.pdf_page === anchor.pdf_page && s.source_text.includes(anchor.contains));
      if (!spans.length) fail('evaluation_anchor_missing');
      return { ...anchor, version_id: b.version.id, span_ids: spans.map(s => s.id) };
    });
    return { ...q, expected_anchors: anchors, input_hash: hash(q.query), tokens: checkedTokens(q.query, embeddingConfig()) };
  });
  if (pricing && (typeof pricing.input_per_million !== 'number' || pricing.input_per_million < 0 || !Number.isFinite(pricing.input_per_million) || !pricing.currency || !pricing.version)) fail('invalid_pricing_configuration');
  const total = [...inputs, ...queries].reduce((n, x) => n + x.tokens, 0);
  return { schema_version: 'rag-v2/external-pilot-plan-1', plan_id: id('pilot_plan', snapshot.documents, questions, pricing),
    state: 'prepared_not_authorized_not_run', material_egress_approved: false, spend_cap_approved: false,
    provider: 'openai', embedding_mode: 'real', model: 'text-embedding-3-large', dimensions: 3072, distance: 'Cosine', tokenizer: TOKENIZER,
    max_tokens_per_input: 8191, max_total_input_tokens: total, max_api_attempts: inputs.length + queries.length,
    request_strategy: 'one input per request; cold cache; one attempt; no retries', generation_calls: 0,
    prices: pricing, estimated_cost: pricing ? total / 1000000 * pricing.input_per_million : null,
    monetary_state: pricing ? 'estimate_not_approved_cap' : 'unknown_price_not_configured',
    files: snapshot.bundles.map(b => ({ document_id: b.document.id, version_id: b.version.id, pdf_sha256: b.version.pdf_hash, metadata_sha256: b.version.metadata_hash })),
    document_inputs: inputs, queries, comparisons: questions.comparisons, top_k: questions.top_k, context_tokens: questions.context_tokens,
    missing_corpus: 'Additional permitted real distractors and historical sources have not been supplied.',
    safety: 'No executor/provider API call exists in this M2.1 plan generator. Approval must name these materials and a monetary cap before M2.2.',
  };
}
