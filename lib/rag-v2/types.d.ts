/** Persisted JSON contracts. Version 2 uses source_units[].raw_text UTF-16 offsets;
 * historical version 1 uses pages[].raw_text. Source bytes remain in immutable assets. */
export type Id = string;
export type SourceFormat = 'pdf' | 'html' | 'xml' | 'json';
export type SourceLocator = { kind: 'pdf'; pdf_page: number }
  | { kind: 'html'; path: string; element_id?: string }
  | { kind: 'xml'; path: string; element_id?: string; act_reference?: string }
  | { kind: 'json'; path: string; record_id: string | null; source_keys: string[] };
export type SourceLocation = SourceLocator & {
  source_unit_id: Id; start: number; end: number; offset_basis: 'source_unit_text_utf16';
};
export interface SourceUnit {
  id: Id; index: number; raw_text: string; locator: SourceLocator; offset_basis: 'source_unit_text_utf16';
}
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
  size_bytes: number; path: 'original.pdf' | 'original.html' | 'original.xml' | 'original.json' | 'metadata.json'; rights: LocalRights;
}
export interface Document {
  id: Id; tenant_id: string; external_ids: Record<string, string | null>;
  fields: Record<string, Field>; legacy_metadata: Record<string, unknown>;
  rights: LocalRights; domain_profile: { id: string; version: string };
  search_aids: Record<string, Field & { role: 'search_aid_only' }>;
}
export interface DocumentVersion {
  id: Id; tenant_id: string; document_id: Id; pdf_hash: string | null; metadata_hash: string;
  source_format?: SourceFormat; source_hash?: string;
  processing_config: Record<string, string | number>; profile_hash: string;
  ingested_at: string; state: 'staged';
}
export interface SourceSpan extends Scope {
  id: Id; pdf_page: number | null; parser_page_index: number | null; source_unit_index?: number; start: number; end: number;
  bbox: number[]; item_indices: number[]; source_text: string; retrieval_text: string;
  transformation: 'whitespace_only' | 'decoded_source_text' | 'pdf_nul_to_replacement_character_then_whitespace';
  parent_section_id: Id; block_id: Id; height: number; y: number; rotation?: number; reading_lane?: number;
}
export interface Section extends Scope {
  id: Id; title: string | null; parent_id: Id | null; span_ids: Id[]; record_key?: string;
}
export interface Chunk extends Scope {
  id: Id; ordinal: number; parent_section_id: Id; section_path: string[];
  span_ids: Id[]; pdf_pages: number[]; source_locations?: SourceLocation[]; record_key?: string | null; source_text: string; retrieval_text: string;
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
export type KnowledgeAnchor = { start: number; end: number; quote: string; span_ids: Id[] } & (
  { pdf_page: number; source_unit_index?: never; source_location?: never }
  | { pdf_page?: never; source_unit_index: number; source_location: SourceLocator }
);
export interface KnowledgeCard extends Scope {
  id: Id; key: string; kind: 'assertion' | 'condition' | 'exception' | 'definition';
  statement: string; scope: string; subject?: string; predicate?: string; object?: string;
  anchors: KnowledgeAnchor[]; span_ids: Id[]; verification_state: 'source_anchored_unreviewed';
  provenance: { kind: 'metadata'; asset_hash: string; schema_version: 'rag-v2/knowledge-input-1' | 'rag-v2/knowledge-input-2' };
}
export interface SemanticDependency extends Scope {
  id: Id; key: string; type: 'MENTIONS' | 'RELATED_TOPIC' | 'CITES' | 'DESCRIBES' | 'REQUIRES' | 'EXCEPTION_TO' | 'DEFINES' | 'QUALIFIES' | 'SUPERSEDES';
  from_card_id: Id; targets: { document_id: Id; document_version_id: Id; card_id: Id }[];
  operator: 'all' | 'any'; scope: string; anchors: KnowledgeAnchor[]; span_ids: Id[];
  verification_state: 'source_anchored_unreviewed'; provenance: KnowledgeCard['provenance'];
}
export interface KnowledgeGap extends Scope {
  id: Id; key: string; from_card_id: Id | null; statement: string; reason: string;
  anchors: KnowledgeAnchor[]; span_ids: Id[]; verification_state: 'source_anchored_unreviewed'; provenance: KnowledgeCard['provenance'];
}
export interface BundleContents {
  tenant_id: string; document: Document;
  assets: SourceAsset[]; pages: { raw_text: string; pdf_page: number; parser_page_index: number; view: number[]; lines: unknown[]; columns?: number }[];
  spans: SourceSpan[]; sections: Section[]; chunks: Chunk[]; relations: Relation[];
  blocks: (Scope & { id: Id; kind: 'heading' | 'paragraph' | 'quote' | 'list_item' | 'table_row' | 'legal_unit'; span_ids: Id[]; record_key?: string })[];
  knowledge_cards: KnowledgeCard[]; dependencies?: SemanticDependency[]; knowledge_gaps?: KnowledgeGap[]; report: IngestReport;
}
export type Bundle = BundleContents & (
  { schema_version: 'rag-v2/1'; version: DocumentVersion & { pdf_hash: string }; source_units?: never }
  | { schema_version: 'rag-v2/2'; version: DocumentVersion & { source_format: SourceFormat; source_hash: string }; source_units: SourceUnit[] }
);
export interface IngestJob {
  id: string; tenant_id: string;
  state: 'received' | 'validated' | 'parsed' | 'staged' | 'published' | 'failed';
  states: string[]; document_id?: Id; version_id?: Id; model_calls: 0; errors: { code: string }[];
}
