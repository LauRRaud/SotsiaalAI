export const STRUCTURAL_ROLE_VERSION = 'bibliographic-pretitle-label-v1';
const text = value => typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '';

// A declared publication label before the main title is a discovery aid. Length is never a predicate.
export function structuralRole(chunk, bundle) {
  const publication = text(bundle.document.fields.journal_title?.value);
  const firstTitle = bundle.sections.find(section => section.parent_id && text(section.title) === text(bundle.document.fields.title.value));
  const firstTitleSpan = firstTitle && bundle.spans.find(s => firstTitle.span_ids.includes(s.id));
  const section = bundle.sections.find(s => s.id === chunk.parent_section_id);
  const spans = chunk.span_ids.map(id => bundle.spans.find(s => s.id === id));
  const preTitle = firstTitleSpan && spans.length && spans.every(s => s && (
    s.pdf_page < firstTitleSpan.pdf_page || s.pdf_page === firstTitleSpan.pdf_page && s.start < firstTitleSpan.start));
  if (publication && section?.parent_id === null && preTitle && text(chunk.source_text) === publication) {
    return { role: 'document_label', evidence_eligible: false, basis: 'declared_publication_label_before_main_title', version: STRUCTURAL_ROLE_VERSION };
  }
  return { role: 'source_content', evidence_eligible: true, basis: 'no_bibliographic_label_rule_matched', version: STRUCTURAL_ROLE_VERSION };
}
