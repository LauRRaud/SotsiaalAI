import { id, hash, stable, SCHEMA_VERSION, validateBundle } from './contracts.js';

export function normalize({ metadata, parsed, structured, tenant, documentId, versionId, pdfHash, metadataHash, config, profile, rights, ingestedAt }) {
  const { pages, spans, sections, blocks, removed } = structured;
  const scope = { tenant_id: tenant, document_version_id: versionId };
  const fields = {};
  const warnings = [];
  const metaSource = field => ({ kind: 'metadata', asset_hash: metadataHash, path: `/${field}` });
  const pdfSource = matches => ({ kind: 'pdf_text', span_ids: matches.map(s => s.id) });
  const policy = reason => ({ kind: 'normalization_policy', version: config.normalization, reason });
  const set = (key, value, provenance, extra = {}) => { fields[key] = { value, provenance, ...extra }; };
  const mappings = { title: 'title', authors: 'authors', journal_title: 'journalTitle', issue_label: 'issueLabel',
    issue_id_candidate: 'docId', source_type: 'source_type', language: 'language', authority: 'authority',
    legacy_section: 'section', source_status: 'source_status', historical: 'historical', audience: 'audience',
    collection_id: 'collection_id', publication_year: 'year', source_checked_at: 'last_checked' };
  for (const [target, source] of Object.entries(mappings)) {
    set(target, metadata[source] ?? null, [metadata[source] === undefined ? policy('not_supplied') : metaSource(source)]);
  }
  fields.source_checked_at.review_state = 'imported_not_verified';
  for (const key of ['publication_date', 'described_period', 'valid_from', 'valid_to', 'journal_page_range']) set(key, null, [policy('unknown_not_inferred')]);
  for (const s of spans.filter(s => s.pdf_page === 1)) {
    const match = s.source_text.match(/\b(\d{1,2})\.\s+(\p{L}+)\s+(\d{4})\b/u);
    const month = match ? profile.months?.indexOf(match[2].toLowerCase()) + 1 : 0;
    if (month > 0) {
      const date = `${match[3]}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      if (new Date(date).toISOString().slice(0, 10) === date) {
        set('publication_date', date, [pdfSource([s])]);
        set('publication_year', Number(match[3]), [pdfSource([s])], { candidates: metadata.year ? [{ value: metadata.year, provenance: metaSource('year') }] : [] });
        if (metadata.year && metadata.year !== Number(match[3])) warnings.push({ code: 'publication_year_conflict', resolution: 'PDF publication date selected; metadata candidate retained' });
        break;
      }
    }
  }
  const category = spans.find(s => s.pdf_page === 1 && profile.categoryLabels?.some(label => s.source_text.includes(label)));
  set('source_category', category ? profile.categoryLabels.find(label => category.source_text.includes(label)) : null,
    [category ? pdfSource([category]) : policy('not_detected')]);
  set('pdf_page_range', [1, pages.length], [{ kind: 'parser', path: '/pages', version: config.parser }], {
    candidates: [{ value: [metadata.pdf_start_page ?? null, metadata.pdf_end_page ?? null], provenance: [metaSource('pdf_start_page'), metaSource('pdf_end_page')] }],
  });
  if ((metadata.pdf_start_page && metadata.pdf_start_page !== 1) || (metadata.pdf_end_page && metadata.pdf_end_page !== pages.length)) warnings.push({ code: 'pdf_page_range_conflict', resolution: 'Actual asset pages selected; legacy range retained' });
  const creation = parsed.info?.CreationDate;
  const creationMatch = creation?.match(/^D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})([+-])(\d{2})'(\d{2})'/);
  set('asset_created_at', creationMatch ? `${creationMatch[1]}-${creationMatch[2]}-${creationMatch[3]}T${creationMatch[4]}:${creationMatch[5]}:${creationMatch[6]}${creationMatch[7]}${creationMatch[8]}:${creationMatch[9]}` : null,
    [{ kind: 'pdf_metadata', path: '/CreationDate', raw: creation ?? null }]);
  set('ingested_at', ingestedAt, [{ kind: 'ingest_clock', timezone: 'UTC' }]);
  const urls = [...new Set(removed.flatMap(s => s.source_text.match(/https?:\/\/[^\s]+/g) || []))];
  set('source_urls', urls, [{ kind: 'parser_margin', removed_span_ids: removed.filter(s => /https?:\/\//.test(s.source_text)).map(s => s.id) }]);
  for (const field of ['title', 'authors']) {
    const values = [].concat(fields[field].value || []);
    const normalizedPdf = spans.map(s => s.source_text).join(' ').replace(/\s+/g, ' ');
    fields[field].review_state = values.every(value => normalizedPdf.includes(value)) ? 'text_match' : 'needs_review';
    fields[field].provenance.push({ kind: 'parser_comparison', method: 'literal_text_match', version: config.normalization });
    if (fields[field].review_state === 'needs_review') warnings.push({ code: `${field}_not_matched_in_pdf` });
  }
  const review = profile.assetReviews?.[pdfHash];
  const referenceSpan = review ? spans.find(s => s.pdf_page === review.reference_page && s.source_text.includes(review.reference_heading)) : null;
  set('reference_list_state', referenceSpan ? review.reference_list_state : 'not_assessed',
    referenceSpan ? [pdfSource([referenceSpan]), { kind: 'asset_review', asset_hash: pdfHash, basis: review.basis }] : [policy('not_assessed')]);
  set('in_text_citations_present', spans.some(s => /\([^)]*\p{L}[^)]*\b(?:19|20)\d{2}/u.test(s.source_text)),
    [{ kind: 'parser', method: 'author_year_pattern_candidate', version: config.normalization }]);
  const searchAids = Object.fromEntries(['description', 'tags'].map(key => [key, {
    value: metadata[key] ?? null, role: 'search_aid_only', review_state: 'not_verified', provenance: [metaSource(key)],
  }]));
  if (metadata.description) warnings.push({ code: 'description_not_verified', detail: review?.description_review ?? 'Imported description is not source evidence.' });
  if (referenceSpan) warnings.push({ code: 'reference_list_not_visible', span_ids: [referenceSpan.id] });
  warnings.push({ code: 'layout_coverage_limit', detail: 'Single-column text layer supported; tables, footnotes, OCR and multi-column reading order require separate fixtures and review. No semantic relations inferred.' });
  const externalIds = Object.fromEntries(['docId', 'articleId', 'source_id', 'document_id'].map(key => [key, metadata[key] ?? null]));
  const document = { id: documentId, tenant_id: tenant, external_ids: externalIds, fields, search_aids: searchAids,
    legacy_metadata: metadata, rights, domain_profile: { id: profile.id, version: profile.version } };
  const chunks = [];
  let group = [], size = 0;
  function flush() {
    if (!group.length) return;
    const section = sections.find(s => s.id === group[0].parent_section_id);
    const sectionPath = [metadata.title, section.title].filter(Boolean);
    const sourceText = group.map(s => s.source_text).join('\n');
    const bodyText = group.map((s, i) => `${i ? (s.block_id === group[i - 1].block_id ? '\n' : '\n\n') : ''}${s.retrieval_text}`).join('');
    const prefix = `${sectionPath.join(' > ')}\n\n`;
    const retrievalText = prefix + bodyText;
    chunks.push({ ...scope, id: id('chunk', versionId, chunks.length), ordinal: chunks.length,
      parent_section_id: section.id, section_path: sectionPath, span_ids: group.map(s => s.id),
      pdf_pages: [...new Set(group.map(s => s.pdf_page))], source_text: sourceText, retrieval_text: retrievalText,
      retrieval_mapping: { prefix_length: prefix.length, body_span_ids: group.map(s => s.id), operation: 'join_normalized_lines_with_block_breaks' },
      embedding_input_hash: hash(stable([config.embeddingInputVersion, retrievalText])), index_version: config.embeddingInputVersion,
    });
    group = []; size = 0;
  }
  for (const span of spans) {
    if (group.length && (size + span.source_text.length + 1 > config.chunkMaxChars || group[0].parent_section_id !== span.parent_section_id)) flush();
    group.push(span); size += span.source_text.length + 1;
  }
  flush();
  chunks.forEach((c, i) => { c.previous_id = chunks[i - 1]?.id ?? null; c.next_id = chunks[i + 1]?.id ?? null; });
  const relations = [];
  const edge = (type, from, to, spanIds) => relations.push({ ...scope, id: id('relation', type, from, to), type,
    from_id: from, to_id: to, span_ids: spanIds, verification_state: 'parser_structural', scope: 'document_version', valid_from: null, valid_to: null });
  for (const chunk of chunks) { edge('BELONGS_TO', chunk.id, documentId, chunk.span_ids); edge('PARENT_SECTION', chunk.id, chunk.parent_section_id, chunk.span_ids); }
  sections.filter(s => s.parent_id).forEach(s => edge('PARENT_SECTION', s.id, s.parent_id, s.span_ids));
  spans.slice(1).forEach((s, i) => edge('NEXT_SPAN', spans[i].id, s.id, [spans[i].id, s.id]));
  const assets = [
    { id: id('asset', tenant, pdfHash), tenant_id: tenant, sha256: pdfHash, mime_type: 'application/pdf', path: 'original.pdf', rights },
    { id: id('asset', tenant, metadataHash), tenant_id: tenant, sha256: metadataHash, mime_type: 'application/json', path: 'metadata.json', rights },
  ];
  return validateBundle({ schema_version: SCHEMA_VERSION, tenant_id: tenant, document, assets,
    version: { id: versionId, tenant_id: tenant, document_id: documentId, pdf_hash: pdfHash, metadata_hash: metadataHash,
      processing_config: config, profile_hash: hash(stable(profile)), ingested_at: ingestedAt, state: 'staged' },
    pages, spans, sections, blocks, chunks, relations, knowledge_cards: [],
    report: { quality_state: 'usable_with_warnings', warnings, errors: [], transformations: removed,
      field_provenance: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.provenance])),
      coverage: { pdf_pages: pages.length, documents: 1, corpus_completeness: 'not_assessed' },
      model_calls: 0, embedding_calls: 0, generation_calls: 0 },
  });
}
