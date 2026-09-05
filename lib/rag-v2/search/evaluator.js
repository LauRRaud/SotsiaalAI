import { performance } from 'node:perf_hooks';
import { fail, hash, stable } from '../contracts.js';
import { retrieve } from './retrieval.js';
import { indexUnit } from './embedding.js';

export function resolveAnchorGroups(snapshot, groups) {
  const b = snapshot.bundles.find(b => b.version.pdf_hash === groups.source_pdf_sha256);
  if (!b) fail('anchor_asset_missing');
  return Object.fromEntries(Object.entries(groups.families).map(([family, required]) => [family, required.map(group => ({ ...group,
    alternatives: group.alternatives.map(anchor => {
      const spans = b.spans.filter(s => s.pdf_page === anchor.pdf_page && s.source_text.includes(anchor.contains));
      if (!spans.length) fail('anchor_source_missing');
      return { ...anchor, document_id: b.document.id, version_id: b.version.id, span_ids: spans.map(s => s.id) };
    }),
  }))]));
}
export function anchorCoverage(entries, required) {
  return required.map(group => ({ id: group.id, covered: group.alternatives.some(a => entries.some(e =>
    e.document_id === a.document_id && e.document_version_id === a.version_id && e.pdf_pages.includes(a.pdf_page)
    && a.span_ids.some(s => e.span_ids.includes(s)) && e.source_text.includes(a.contains))) }));
}
export async function evaluateRetrieval({ snapshot, questions, groups, postgres, qdrant, embedding, policy, context }) {
  const anchors = resolveAnchorGroups(snapshot, groups); // Resolve before querying, never from winners.
  const methods = [
    { name: 'lexical', method: 'lexical', topK: 5, graph: false },
    { name: 'vector', method: 'vector', topK: 5, graph: false },
    { name: 'hybrid', method: 'hybrid', topK: 5, graph: false },
    { name: 'hybrid_structure', method: 'hybrid', topK: 3, graph: true },
  ];
  const rows = [], start = performance.now();
  const rawEntries = new Map(snapshot.bundles.flatMap(b => b.chunks.map(c => [indexUnit(c, b, embedding.config).id, {
    document_id: b.document.id, document_version_id: b.version.id, source_text: c.source_text, pdf_pages: c.pdf_pages, span_ids: c.span_ids,
  }])));
  for (const question of questions.cases) for (const method of methods) {
    const before = embedding.reads ?? embedding.calls ?? 0;
    const packet = await retrieve({ postgres, qdrant, embedding, policy, context, allowLexicalFallback: false,
      query: { text: question.query, language: question.language, method: method.method, graph: method.graph,
        includeDocumentLabels: false, contextMode: 'compact', finalLimit: 5,
        limits: { topK: method.topK, perDocument: 5, contextTokens: 6000, graphAdditions: 2, graphSteps: 8, candidates: 40 } } });
    const required = anchors[question.family]; if (!required) fail('question_anchor_family_missing');
    const ranking = packet.raw_rankings[method.method] || [];
    const coverage = anchorCoverage(packet.evidence, required);
    const top = Object.fromEntries([1, 3, 5].map(k => {
      const entries = ranking.slice(0, k).map(r => rawEntries.get(r.id)).filter(Boolean);
      return [k, { actual_count: entries.length, groups: anchorCoverage(entries, required),
        all_required: required.length ? anchorCoverage(entries, required).every(g => g.covered) : null }];
    }));
    const first = ranking.findIndex(r => anchorCoverage([rawEntries.get(r.id)].filter(Boolean), required).some(g => g.covered));
    const source = snapshot.bundles.find(b => b.version.pdf_hash === questions.source_pdf_sha256);
    const authorFound = question.family === 'bibliography' ? packet.evidence.some(e => stable(e.bibliography.authors) === stable(source.document.fields.authors.value)) : null;
    const sourceTexts = packet.evidence.map(e => e.source_text);
    rows.push({ question_id: question.id, family: question.family, language: question.language, kind: question.kind, method: method.name,
      state: packet.state, first_anchor_rank: first < 0 ? null : first + 1, top_k: top, final_groups: coverage,
      all_required_in_final_context: required.length ? coverage.every(g => g.covered) : null,
      metadata_author_available: authorFound, metadata_author_provenance: authorFound ? source.document.fields.authors.provenance : null,
      outcome: packet.state === 'error' ? 'technical_error' : question.kind === 'unanswerable_in_supplied_corpus' ? 'required_evidence_absent_by_dataset'
        : question.family === 'bibliography' ? authorFound ? 'metadata_resolved' : 'metadata_missing'
          : coverage.every(g => g.covered) ? 'support_found' : 'support_missing',
      final_count: packet.evidence.length, graph_additions: packet.measurements.graph_additions,
      graph_opportunity: packet.measurements.graph_opportunity,
      repeated_source_chars: sourceTexts.reduce((n, text, i) => n + (sourceTexts.indexOf(text) < i ? text.length : 0), 0),
      vector_reads: (embedding.reads ?? embedding.calls ?? 0) - before, measurements: packet.measurements, packet });
  }
  const misses = rows.filter(r => r.method.startsWith('hybrid') && ['support_missing', 'metadata_missing', 'technical_error'].includes(r.outcome)).map(r => ({ question_id: r.question_id, method: r.method, outcome: r.outcome }));
  return { schema_version: 'rag-v2/retrieval-pilot-results-1', embedding_mode: embedding.config.embedding_mode,
    semantic_claim: embedding.config.embedding_mode === 'real' && embedding.provenance === 'openai_https' ? 'single_article_case_results_only' : 'NOT_PROVEN_test_mechanics_only',
    config: embedding.config, questions_sha256: hash(stable(questions)), anchor_groups_sha256: hash(stable(groups)),
    methods, fixed_final_limit: 5, fixed_model_context_budget: 6000, rows, failures: misses,
    local_evaluation_ms: performance.now() - start, external_embedding_calls_during_comparison: 0, generation_calls: 0,
    limitations: ['Translations are not independent situations.', 'Two content families on one PDF page are not a corpus benchmark.', 'Unanswerable queries may still return candidates.', 'No Luna response or global sufficiency classifier is tested.'] };
}
