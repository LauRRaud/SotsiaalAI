export const STRUCTURAL_ROLE_VERSION = 'bibliographic-pretitle-label-v1';
const text = value => typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '';

// Lookups of one bundle, built once per bundle object: every chunk used to search all spans and
// sections again, which made a large document quadratic (lexical audit profile, 26.09.2026).
const lookups = new WeakMap();
function bundleLookups(bundle) {
  let found = lookups.get(bundle);
  if (!found) {
    const record = bundle.document.fields.structured_record?.value;
    const firstTitle = bundle.sections.find(section => section.parent_id && text(section.title) === text(bundle.document.fields.title.value));
    const spans = new Map(), sections = new Map();
    for (const span of bundle.spans) if (!spans.has(span.id)) spans.set(span.id, span);
    for (const section of bundle.sections) if (!sections.has(section.id)) sections.set(section.id, section);
    found = { record, bindings: new Set(Object.values(record?.bindings || {}).map(binding => binding.path)),
      paths: new Set(record?.links.map(link => link.path) || []), publication: text(bundle.document.fields.journal_title?.value),
      firstTitleSpan: firstTitle && bundle.spans.find(s => firstTitle.span_ids.includes(s.id)), spans, sections };
    lookups.set(bundle, found);
  }
  return found;
}

// A declared publication label before the main title is a discovery aid. Length is never a predicate.
export function structuralRole(chunk, bundle) {
  const { bindings, paths, publication, firstTitleSpan, spans: spanById, sections } = bundleLookups(bundle);
  if (chunk.source_locations?.some(location => bindings.has(location.path))) {
    return { role: 'record_binding', evidence_eligible: false, basis: 'adapter_verification_identity', version: STRUCTURAL_ROLE_VERSION };
  }
  if (chunk.source_locations?.length && chunk.source_locations.every(location => paths.has(location.path))) {
    return { role: 'record_links', evidence_eligible: false, basis: 'structured_record_link_ids', version: STRUCTURAL_ROLE_VERSION };
  }
  const section = sections.get(chunk.parent_section_id);
  const spans = chunk.span_ids.map(id => spanById.get(id));
  const preTitle = firstTitleSpan && spans.length && spans.every(s => s && (
    s.pdf_page < firstTitleSpan.pdf_page || s.pdf_page === firstTitleSpan.pdf_page && s.start < firstTitleSpan.start));
  if (publication && section?.parent_id === null && preTitle && text(chunk.source_text) === publication) {
    return { role: 'document_label', evidence_eligible: false, basis: 'declared_publication_label_before_main_title', version: STRUCTURAL_ROLE_VERSION };
  }
  return { role: 'source_content', evidence_eligible: true, basis: 'no_bibliographic_label_rule_matched', version: STRUCTURAL_ROLE_VERSION };
}
