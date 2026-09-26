import { fail, id, hash, stable, SCHEMA_VERSION, validateBundle } from './contracts.js';
import { prepareKnowledge } from './knowledge.js';
import { makeChunks, referenceSections, referenceSpans } from './chunking.js';
import { SOURCE_FORMATS } from './source-locations.js';
import { metadataValue } from './metadata-values.js';

export function normalize({ metadata, originalMetadata = metadata, parsed, structured, tenant, documentId, versionId, pdfHash, metadataHash, config, profile, rights, ingestedAt }) {
  const { pages, source_units, spans, sections, blocks, removed, nulReplacements = 0, glyphRecoveries = 0 } = structured;
  const format = parsed.source_format ?? metadata.source_format ?? 'pdf';
  const scope = { tenant_id: tenant, document_version_id: versionId };
  const fields = {};
  const warnings = [...(structured.warnings || [])];
  const pdfSource = matches => ({ kind: 'pdf_text', span_ids: matches.map(s => s.id) });
  const policy = reason => ({ kind: 'normalization_policy', version: config.normalization, reason });
  const metaSource = field => {
    if (metadata[field] === undefined) return policy('not_supplied');
    const origin = metadata.metadata_adaptation?.origins?.[field];
    if (origin === null || origin === undefined && !Object.hasOwn(originalMetadata, field)) return policy('generated_by_metadata_adapter');
    return { kind: 'metadata', asset_hash: metadataHash, path: origin ?? `/${field}`,
      ...(stable(metadataValue(field, metadata[field])) !== stable(metadata[field]) ? { raw: metadata[field] } : {}) };
  };
  const set = (key, value, provenance, extra = {}) => { fields[key] = { value, provenance, ...extra }; };
  const mappings = { title: 'title', authors: 'authors', journal_title: 'journalTitle', issue_label: 'issueLabel',
    issue_id_candidate: 'docId', source_type: 'source_type', language: 'language', authority: 'authority',
    legacy_section: 'section', source_status: 'source_status', historical: 'historical', audience: 'audience',
    collection_id: 'collection_id', publication_year: 'year', source_checked_at: 'last_checked',
    publication_date: 'publication_date', valid_from: 'valid_from', valid_to: 'valid_to', journal_page_range: 'pageRange',
    country: 'country', county: 'county', municipality_id: 'municipality_id', municipality_name: 'municipality_name',
    jurisdiction_level: 'jurisdiction_level', retrieved_at: 'retrieved_at', copyright_status: 'copyright_status',
    display_full_text: 'display_full_text', allow_excerpts: 'allow_excerpts' };
  for (const [target, source] of Object.entries(mappings)) {
    set(target, metadataValue(target, metadata[source] ?? null), [metadata[source] === undefined ? policy('not_supplied') : metaSource(source)]);
  }
  const regions = [...new Set([...(metadata.regions || []), metadata.municipality_id].filter(value => typeof value === 'string' && value.trim()))];
  set('regions', regions.length ? regions : null, regions.length ? [
    ...(metadata.regions?.length ? [metaSource('regions')] : []),
    ...(metadata.municipality_id ? [metaSource('municipality_id')] : []), policy('canonical_region_ids_from_metadata'),
  ] : [policy('unknown_not_inferred')]);
  fields.source_checked_at.review_state = 'imported_not_verified';
  if (parsed.structured_record) set('structured_record', parsed.structured_record,
    [{ kind: 'json_source', asset_hash: pdfHash, path: parsed.structured_record.path }], { review_state: 'imported_not_verified' });
  for (const key of ['described_period']) set(key, null, [policy('unknown_not_inferred')]);
  // A first-page date line ("Tallinn, 16. jaanuar 2023", "Uurimus/analüüs 06. juuni 2025") dates
  // the document; a date inside running text or a footnote ("registri andmed 1. jaanuar 2009")
  // describes something else. A year the metadata file confirmed after review is not in conflict;
  // the date stays a candidate.
  const yearConfirmed = (metadata.metadata_adaptation?.confirmed || []).some(item => item.field === 'year');
  for (const s of spans.filter(s => s.pdf_page === 1)) {
    const match = s.source_text.trim().match(/^(?:\p{L}[\p{L} ./-]{0,30},?\s+)?(\d{1,2})\.\s+(\p{L}+)\s+(\d{4})\.?$/u);
    const month = match ? profile.months?.indexOf(match[2].toLowerCase()) + 1 : 0;
    if (month > 0) {
      const date = `${match[3]}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      if (new Date(date).toISOString().slice(0, 10) === date) {
        fields.publication_date.candidates = [{ value: date, provenance: pdfSource([s]) }];
        if (metadata.year && metadata.year !== Number(match[3]) && !yearConfirmed) warnings.push({ code: 'publication_year_conflict', resolution: 'Imported bibliography retained; first-page date remains a candidate.' });
        break;
      }
    }
  }
  const category = spans.find(s => s.pdf_page === 1 && profile.categoryLabels?.some(label => s.source_text.includes(label)));
  set('source_category', category ? profile.categoryLabels.find(label => category.source_text.includes(label)) : null,
    [category ? pdfSource([category]) : policy('not_detected')]);
  set('pdf_page_range', format === 'pdf' ? [1, pages.length] : null, [{ kind: 'parser', path: '/pages', version: config.parser }], {
    candidates: [{ value: [metadata.pdf_start_page ?? null, metadata.pdf_end_page ?? null], provenance: [metaSource('pdf_start_page'), metaSource('pdf_end_page')] }],
  });
  if ((metadata.pdf_start_page && metadata.pdf_start_page !== 1) || (metadata.pdf_end_page && metadata.pdf_end_page !== pages.length)) warnings.push({ code: 'pdf_page_range_conflict', resolution: 'Actual asset pages selected; legacy range retained' });
  const rawCreation = typeof parsed.info?.CreationDate === 'string' ? parsed.info.CreationDate : undefined;
  const creation = rawCreation?.replaceAll('\u0000', '\uFFFD');
  const creationMatch = creation?.match(/^D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})([+-])(\d{2})'(\d{2})'/);
  set('asset_created_at', creationMatch ? `${creationMatch[1]}-${creationMatch[2]}-${creationMatch[3]}T${creationMatch[4]}:${creationMatch[5]}:${creationMatch[6]}${creationMatch[7]}${creationMatch[8]}:${creationMatch[9]}` : null,
    [{ kind: 'pdf_metadata', path: '/CreationDate', raw: creation ?? null }]);
  set('ingested_at', ingestedAt, [{ kind: 'ingest_clock', timezone: 'UTC' }]);
  const urls = [...new Set([metadata.source_url, metadata.url, ...(metadata.source_urls || []), ...removed.flatMap(s => s.source_text.match(/https?:\/\/[^\s]+/g) || [])].filter(value => typeof value === 'string' && /^https?:\/\//u.test(value)))];
  const urlOrigins = ['source_url', 'url', 'source_urls'].filter(key => metadata[key] !== undefined).map(metaSource);
  const urlMargins = removed.filter(s => /https?:\/\//u.test(s.source_text)).map(s => s.id);
  if (urlMargins.length) urlOrigins.push({ kind: 'parser_margin', removed_span_ids: urlMargins });
  set('source_urls', urls, urlOrigins.length ? urlOrigins : [policy('not_supplied')]);
  // Title and authors are compared by letters and digits only, so case, spacing, punctuation and
  // line-break hyphens do not matter. A value the source itself declares (an XML act's own title,
  // which its body never repeats) is not compared.
  const letters = text => text.normalize('NFKC').toLocaleLowerCase('et').replace(/[^\p{L}\p{N}]+/gu, '');
  const sourceLetters = letters(spans.map(s => s.source_text).join(' '));
  for (const field of ['title', 'authors']) {
    if (parsed.source_metadata?.[field] !== undefined) continue;
    const values = [].concat(fields[field].value || []);
    fields[field].review_state = values.every(value => typeof value === 'string' && sourceLetters.includes(letters(value))) ? 'text_match' : 'needs_review';
    fields[field].provenance.push({ kind: 'parser_comparison', method: 'letters_only_text_match', version: config.normalization });
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
  if (nulReplacements || rawCreation?.includes('\u0000')) warnings.push({ code: 'pdf_nul_replaced',
    detail: `${nulReplacements + (rawCreation ? rawCreation.split('\u0000').length - 1 : 0)} NUL code points were replaced with U+FFFD before persistence.` });
  if (glyphRecoveries) warnings.push({ code: 'pdf_glyph_char_codes_recovered',
    detail: `${glyphRecoveries} glyphs mapped by their font to U+FFFD, or to a space before the character, were restored from the glyph data.` });
  if (format === 'pdf') warnings.push({ code: 'layout_coverage_limit', detail: 'Text-layer single columns and persistent two-column gutters are supported; OCR, complex tables, footnotes and irregular layouts require review.' });
  for (const conflict of metadata.metadata_adaptation?.conflicts || []) warnings.push({ code: 'metadata_candidate_conflict', detail: conflict.field });
  // A value the metadata file confirmed after review says so, with who confirmed it, when and why.
  for (const item of metadata.metadata_adaptation?.confirmed || []) {
    for (const [target, source] of Object.entries(mappings)) if (source === item.field) {
      fields[target] = { ...fields[target], review_state: 'confirmed', provenance: [...fields[target].provenance,
        { kind: 'metadata_confirmation', confirmed_by: item.confirmed_by, confirmed_at: item.confirmed_at, basis: item.basis,
          ...(item.absent ? { reason: 'confirmed_absent' } : {}) }] };
    }
  }
  for (const [field, raw] of Object.entries(parsed.source_metadata || {})) {
    // XML Schema dates may carry a zone without a time. Keep the source calendar date
    // for validity filters and retain its exact lexical form in provenance.
    const value = metadataValue(field, raw), zonedDate = value !== raw;
    if (fields[field]?.value != null && fields[field].value !== value) warnings.push({ code: 'source_metadata_conflict', detail: field });
    set(field, value, [{ kind: parsed.metadata_basis, asset_hash: pdfHash, path: parsed.metadata_paths?.[field] ?? field, ...(zonedDate ? { raw } : {}) }],
      metadata[field] === undefined ? {} : { candidates: [{ value: metadata[field], provenance: metaSource(field) }] });
  }
  // A Riigi Teataja validity element with a start and no end means the version is in force with no
  // end date yet (a proven open end); any other source without an end date has unknown validity.
  if (parsed.metadata_basis === 'riigi_teataja_xml' && parsed.metadata_paths?.valid_from && fields.valid_from?.value && !parsed.source_metadata?.valid_to) {
    fields.valid_to = { ...fields.valid_to, open_end: true, provenance: [...fields.valid_to?.provenance || [],
      { kind: parsed.metadata_basis, asset_hash: pdfHash, path: parsed.metadata_paths.valid_from, basis: 'validity_without_end' }] };
  }
  set('source_format', format, [{ kind: 'asset_format', asset_hash: pdfHash }]);
  const externalIds = Object.fromEntries(['docId', 'articleId', 'source_id', 'document_id'].map(key => [key, metadata[key] ?? null]));
  const document = { id: documentId, tenant_id: tenant, external_ids: externalIds, fields, search_aids: searchAids,
    legacy_metadata: originalMetadata, rights, domain_profile: { id: profile.id, version: profile.version } };
  // Retrieval context: the municipality of a municipal record, or the issuer of a legal act.
  const retrievalContext = fields.municipality_name?.value || (fields.source_type?.value === 'legal_act' ? fields.authority?.value : null) || null;
  const chunks = makeChunks({ spans, blocks, sections, source_units, metadata: { ...metadata, title: fields.title.value, retrieval_context: retrievalContext },
    versionId, scope, config });
  // Counts the lines actually left out; text after a list was split into its own section before.
  const references = referenceSections({ sections, spans, blocks }), splits = structured.referenceSplits || [];
  const excluded = referenceSpans({ sections, spans, blocks }).size;
  const continued = splits.filter(split => split.section_id), returned = splits.filter(split => split.lead_section_id);
  if (references.size) warnings.push({ code: 'reference_list_not_chunked', section_ids: [...references],
    ...continued.length ? { continued_section_ids: continued.map(split => split.section_id) } : {},
    ...returned.length ? { returned_section_ids: returned.map(split => split.lead_section_id) } : {},
    detail: `${excluded} reference list lines stay source text but are not retrieval chunks.`
      + (continued.length ? ` Text after ${continued.length} of the lists is chunked in its own section: ${continued.filter(split => split.titled).length} under the next title, the rest without the list's name.` : '')
      + (returned.length ? ` Text read before ${returned.length} of the lists (another column of the page) is chunked in the section it continues.` : '') });
  const expandedChars = chunks.reduce((total, chunk) => total + chunk.source_text.length + chunk.retrieval_text.length
    + chunk.section_path.reduce((sum, value) => sum + value.length, 0), 0);
  if (expandedChars > config.maxExpandedChars) fail('expanded_representation_too_large');
  const relations = [];
  const edge = (type, from, to, spanIds) => relations.push({ ...scope, id: id('relation', type, from, to), type,
    from_id: from, to_id: to, span_ids: spanIds, verification_state: 'parser_structural', scope: 'document_version', valid_from: null, valid_to: null });
  for (const chunk of chunks) { edge('BELONGS_TO', chunk.id, documentId, chunk.span_ids); edge('PARENT_SECTION', chunk.id, chunk.parent_section_id, chunk.span_ids); }
  sections.filter(s => s.parent_id).forEach(s => edge('PARENT_SECTION', s.id, s.parent_id, s.span_ids));
  const blockMap = new Map(blocks.map(block => [block.id, block]));
  spans.slice(1).forEach((s, i) => {
    if ((blockMap.get(spans[i].block_id).record_key ?? null) === (blockMap.get(s.block_id).record_key ?? null)) edge('NEXT_SPAN', spans[i].id, s.id, [spans[i].id, s.id]);
  });
  const assets = [
    { id: id('asset', tenant, pdfHash, 'source'), tenant_id: tenant, sha256: pdfHash, mime_type: SOURCE_FORMATS[format].mime, path: SOURCE_FORMATS[format].asset, rights },
    { id: id('asset', tenant, metadataHash, 'metadata'), tenant_id: tenant, sha256: metadataHash, mime_type: 'application/json', path: 'metadata.json', rights },
  ];
  const bundle = { schema_version: SCHEMA_VERSION, tenant_id: tenant, document, assets,
    version: { id: versionId, tenant_id: tenant, document_id: documentId, source_format: format, source_hash: pdfHash, pdf_hash: format === 'pdf' ? pdfHash : null, metadata_hash: metadataHash,
      processing_config: config, profile_hash: hash(stable(profile)), ingested_at: ingestedAt, state: 'staged' },
    pages, source_units, spans, sections, blocks, chunks, relations, knowledge_cards: [],
    report: { quality_state: 'usable_with_warnings', warnings, errors: [], transformations: removed,
      field_provenance: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.provenance])),
      coverage: { pdf_pages: pages.length, documents: 1, corpus_completeness: 'not_assessed' },
      model_calls: 0, embedding_calls: 0, generation_calls: 0 },
  };
  if (metadata.knowledge !== undefined) {
    Object.assign(bundle, prepareKnowledge(metadata.knowledge, bundle));
    warnings.push({ code: 'knowledge_import_unreviewed', detail: 'Source anchors are checked; imported claims and dependencies are not semantically verified.' });
  }
  return validateBundle(bundle);
}
