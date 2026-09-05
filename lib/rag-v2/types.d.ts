/** Persisted JSON contract, version rag-v2/1. Offsets are UTF-16 offsets in pages[].raw_text. */
export type Id = string;
export type LocalRights = { access: 'local_private'; usage: 'development_only' };
export type Scope = { tenant_id: string; document_version_id: Id };
export type Provenance = {
  kind: string; path?: string; span_ids?: Id[]; asset_hash?: string; version?: string;
  reason?: string; basis?: string; method?: string; raw?: string | null;
  timezone?: string; removed_span_ids?: Id[];
};
export type Field<T = unknown> = {
  value: T; provenance: Provenance[]; review_state?: string;
  candidates?: { value: unknown; provenance: Provenance | Provenance[] }[];
};
export interface SourceAsset {
  id: Id; tenant_id: string; sha256: string; mime_type: string;
  size_bytes: number; path: 'original.pdf' | 'metadata.json'; rights: LocalRights;
}
export interface Document {
  id: Id; tenant_id: string; external_ids: Record<string, string | null>;
  fields: Record<string, Field>; legacy_metadata: Record<string, unknown>;
  rights: LocalRights; domain_profile: { id: string; version: string };
  search_aids: Record<string, Field & { role: 'search_aid_only' }>;
}
export interface DocumentVersion {
  id: Id; tenant_id: string; document_id: Id; pdf_hash: string; metadata_hash: string;
  processing_config: Record<string, string | number>; profile_hash: string;
  ingested_at: string; state: 'staged';
}
export interface SourceSpan extends Scope {
  id: Id; pdf_page: number; parser_page_index: number; start: number; end: number;
  bbox: number[]; item_indices: number[]; source_text: string; retrieval_text: string;
  transformation: 'whitespace_only'; parent_section_id: Id; block_id: Id; height: number; y: number;
}
export interface Section extends Scope {
  id: Id; title: string | null; parent_id: Id | null; span_ids: Id[];
}
export interface Chunk extends Scope {
  id: Id; ordinal: number; parent_section_id: Id; section_path: string[];
  span_ids: Id[]; pdf_pages: number[]; source_text: string; retrieval_text: string;
  retrieval_mapping: { prefix_length: number; body_span_ids: Id[]; operation: 'join_normalized_lines_with_block_breaks' };
  embedding_input_hash: string; index_version: string; previous_id: Id | null; next_id: Id | null;
}
export interface Relation extends Scope {
  id: Id; type: 'BELONGS_TO' | 'PARENT_SECTION' | 'NEXT_SPAN';
  from_id: Id; to_id: Id; span_ids: Id[]; verification_state: 'parser_structural';
  scope: 'document_version'; valid_from: null; valid_to: null;
}
export interface IngestReport {
  quality_state: 'usable_with_warnings'; warnings: { code: string; detail?: string; resolution?: string; span_ids?: Id[] }[];
  errors: { code: string }[]; transformations: unknown[];
  field_provenance: Record<string, Provenance[]>;
  coverage: { pdf_pages: number; documents: number; corpus_completeness: 'not_assessed' };
  model_calls: 0; embedding_calls: 0; generation_calls: 0;
}
export interface Bundle {
  schema_version: 'rag-v2/1'; tenant_id: string; document: Document; version: DocumentVersion;
  assets: SourceAsset[]; pages: { raw_text: string; pdf_page: number; parser_page_index: number; items: unknown[] }[];
  spans: SourceSpan[]; sections: Section[]; chunks: Chunk[]; relations: Relation[];
  blocks: (Scope & { id: Id; kind: 'heading' | 'paragraph' | 'quote' | 'list_item'; span_ids: Id[] })[];
  knowledge_cards: []; report: IngestReport;
}
export interface IngestJob {
  id: string; tenant_id: string;
  state: 'received' | 'validated' | 'parsed' | 'staged' | 'published' | 'failed';
  states: string[]; document_id?: Id; version_id?: Id; model_calls: 0; errors: { code: string }[];
}
