import type { Id, SourceSpan, SourceLocation } from '../types';
export interface TrustedLocalContext { tenant: string; subject: string; usage: 'development_only' }
interface EmbeddingBase {
  distance: 'Cosine';
  tokenizer: 'js-tiktoken@1.0.21/cl100k_base'; input_version: string; max_input_tokens: number;
}
export type EmbeddingConfig = EmbeddingBase & (
  { embedding_mode: 'mock'; provider: 'local-mock'; model: string; dimensions: number } |
  { embedding_mode: 'real'; provider: 'openai'; model: 'text-embedding-3-large'; dimensions: 3072; endpoint: 'https://api.openai.com/v1/embeddings' }
);
export interface SearchQuery {
  text: string; language: 'et' | 'en' | 'ru'; generation_id?: Id; graph?: boolean; semanticGraph?: boolean;
  method?: 'lexical' | 'vector' | 'hybrid'; contextMode?: 'audit' | 'compact'; includeDocumentLabels?: boolean; finalLimit?: number;
  filters?: { region?: string; publication_from?: string; publication_to?: string; valid_at?: string };
  limits?: { topK?: number; perDocument?: number; candidates?: number; contextTokens?: number; graphSteps?: number; graphAdditions?: number; dependencySteps?: number; dependencyAdditions?: number };
}
/** A legal act's dates as the answer model reads them (ADR-062, legal-dates.js). An amendment entry names the provisions
 * whose notes share the days and words: a provision ("§ 1 p 1"), a whole section or subsection ("§ 13²", "§ 142⁴⁷ lg 3¹"),
 * a heading ("§ 5 pealkiri") or opening words ("§ 2 sissejuhatav lauseosa", "§ 70 lg 1 sissejuhatav lauseosa"), a closing
 * note that may be the whole section's or subsection's ("§ 9 lg 6 või kogu § 9", "§ 91 lg 2 p 2 või kogu § 91 lg 2"), an
 * added division by its name. The last entry of a cut list is { more }. A day the source does not give is absent
 * (in_force) or null (repealed_from). On a card, changed_on_valid_from_notes are such entries for the parts outside the
 * sections (the preamble, an annex, a division) that the version's first day changed. */
export type AmendmentEntry = { provisions: string[]; in_force?: string; repealed_from?: string | null; applies_from?: string;
  note?: string; more_provisions?: number } | { more: number };
export interface ActDates {
  act_in_force_from?: string; changed_on_valid_from?: string[]; changed_on_valid_from_count?: number; changed_on_valid_from_notes?: AmendmentEntry[];
  entry_into_force?: { provision: string; text: string }[]; scoped_rules?: { provision: string; text: string }[]; entry_into_force_more?: number;
}
export interface Evidence {
  evidence_id: Id; document_id: Id; document_version_id: Id; unit_id: Id; chunk_id: Id;
  span_ids: SourceSpan['id'][]; pdf_pages: number[]; source_locations?: SourceLocation[]; source_text: string;
  bibliography: { title: string; authors: string[] | null; publication_date: string | null;
    publication_year?: number | string; journal_title?: string; issue_label?: string; page_range?: string };
  source_metadata: Record<string, { value: unknown; provenance: unknown[]; review_state: string }>;
  search_aids: { heading_prefix: string; legacy_description: unknown; role: 'not_source_quote' };
  selection: { reason: string | { type: 'structural_expansion'; seed_evidence_id: Id; via: string; edge_ids: Id[] }
    | { type: 'semantic_dependency'; card_id: Id; dependency_id: Id | null; verification_state: 'source_anchored_unreviewed' };
    ranks: Record<string, number>; rrf_contributions: Record<string, number>; rrf_score: number | null };
  limitations: unknown[];
  /** Only for a Riigi Teataja act read with its notes (source-structure-v30); outside every budget measure. */
  legal_dates?: { act?: ActDates; amendments?: AmendmentEntry[] };
  /** Which provision of its act a legal passage is (ADR-123, legal-place.js): the section and the numbered subsections
   * whose text the passage holds, as the act shows its numbers ("133", "15¹"; "5", "2¹"). Outside every budget measure.
   * The sources panel shows it and the provision check reads it (ADR-129), so a lean packet keeps it. */
  legal_place?: { section: string; subsections: string[] };
}
export interface EvidenceBundle {
  schema_version: 'rag-v2/evidence-1'; query_id: Id; tenant: string; generation_id: Id | null;
  embedding_mode: 'mock' | 'real'; state: 'ok' | 'empty' | 'degraded' | 'error'; error?: string;
  channels: string[]; warnings: string[]; evidence: Evidence[];
  model_context?: ModelContext | null; reference_map?: Record<string, ModelReference>;
  dependency_context?: ModelContext['dependencies'];
  retrieval_context?: ModelContext['retrieval'];
  retrieval_audit?: { version: 'rag-v2/unified-retrieval-1'; directory_hash: string; context_hash: string };
  raw_rankings: Record<string, { id: Id; score: number }[]>;
  selection_trace: { unit_id: Id; reason: string }[];
  measurements: { timings_ms: Record<string, number>; candidate_counts: Record<string, number>;
    context_tokens: number; external_embedding_calls: 0; generation_calls: 0; mock_embedding_calls: number;
    loading?: { strategy: 'candidate_documents' | 'legacy_eager'; directory_documents: number; loaded_documents: number; loaded_units: number };
    graph_steps?: number; graph_additions?: number; dependency_steps?: number; dependency_additions?: number };
}
export interface ModelContext {
  /** A legal act's source card may carry act_dates (ActDates) or act_dates_omitted: true (json-3, ADR-062), and a law's
   * card act_abbreviation, the abbreviation Riigi Teataja gives the law (json-5, ADR-129). An excerpt of a legal act
   * carries provision ("§ 133 lg 5–7") or provision_omitted: true (json-5, ADR-123). */
  schema_version: 'rag-v2/model-context-json-5'; sources: Record<string, Record<string, unknown> & { act_abbreviation?: string }>;
  evidence: { ref: string; source: string; pdf_pages: number[]; text: string;
    source_locations?: { kind: 'html' | 'xml' | 'json'; path: string; act_reference?: string; record_id?: string }[];
    provision?: string; provision_omitted?: true; amendments?: AmendmentEntry[]; amendments_omitted?: true }[];
  dependencies?: { schema_version: 'rag-v2/dependency-context-1'; known_context: 'included' | 'incomplete';
    corpus_completeness: 'not_assessed'; verification_state: 'source_anchored_unreviewed';
    claims: Record<string, unknown>[]; relations: Record<string, unknown>[]; unresolved: Record<string, unknown>[] };
  retrieval?: { version: 'rag-v2/unified-retrieval-1'; interpretation: string; semantic_quality: 'NOT_PROVEN';
    temporal: { state: string; periods: DialoguePeriod[] };
    lanes: { key: string; kind: 'knowledge' | 'local_records' | 'publication_period'; state: 'selected' | 'no_evidence'; refs: string[];
      period?: DialoguePeriod; filters?: SearchQuery['filters']; coverage?: {
        counting_unit: 'indexed_source_document'; indexed_documents: number; selected_documents: number;
        missing_publication_date_documents: number; publication_year_only_documents: number; documents_by_publication_year: Record<string, number>;
        article_deduplication: 'not_assessed'; corpus_completeness: 'not_assessed'; selection: 'bounded_excerpts_not_exhaustive_reading';
      } }[] };
}
export interface DialoguePeriod {
  basis: 'publication' | 'event' | 'validity' | 'unspecified'; from: string | null; to: string | null;
  support: { turn: number; quote: string }[];
}
export interface ModelReference {
  tenant: string; query_id: Id; generation_id: Id; evidence_id: Id; document_id: Id; document_version_id: Id;
  unit_id: Id; chunk_id: Id; span_ids: Id[]; pdf_pages: number[]; source_locations?: SourceLocation[]; source_text_sha256: string;
}
