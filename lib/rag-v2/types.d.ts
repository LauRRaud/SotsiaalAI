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
/** A Riigi Teataja amendment note (muutmismarge), read beside the text since source-structure-v30 (ADR-062).
 * `in_force` is the amendment's entry into force for the provision; null when the source gives none, or gives a day
 * before the note's own publication day that is not a court ruling's (a source error; report warning
 * amendment_note_in_force_before_publication). `applies_from` is set only when the note's own
 * words are nothing but "rakendatakse [tagasiulatuvalt] [alates] <date>" (the verb also as "rakendatake",
 * "rakendatatakse" or "rakend."); `note` keeps those words always, up to the 2,000 characters the reader reads of
 * them. `rt` cites Riigi Teataja by publication day ("RT IV, 21.03.2026, 7") or, before 2010, by year and issue
 * ("RT I 2010, 22, 108", `published` null). `repeal` marks "Kehtetu" in any case and "välja jäetud". */
export type Amendment = {
  act_reference: string | null; rt: string; published: string | null; in_force: string | null;
  adopted?: string; applies_from?: string; note?: string; repeal?: true;
};
/** `offset` is the length of raw_text before the note, so the end of its provision's text: the note belongs to the
 * source location with `start < offset <= end` (the end counts, the start does not: a third of the notes lie on a
 * chunk's end). Null when the text does not confirm the place (report warning amendment_note_position_unresolved).
 * `path` tells a section's own note (".../paragrahv[n]/muutmismarge[k]") from one in an unnumbered subsection, which
 * has the same `provision` ("§ N"). */
export type UnitAmendment = Amendment & { provision: string; offset: number | null; path: string };
export interface SourceUnit {
  id: Id; index: number; raw_text: string; locator: SourceLocator; offset_basis: 'source_unit_text_utf16';
  amendments?: UnitAmendment[];
}
/** document.fields.legal_text.value of a Riigi Teataja act: the act's own dates, apart from the version's validity.
 * `act_in_force_from` is the adoption's entry into force as the source gives it; of an original text never amended
 * (text_kind "algtekst...") the validity start, and the adoption's day only without one. `original_published` is the
 * publication day the adoption names (null: none, or a citation by year and issue). A consolidated text's
 * `act_in_force_from` before it is kept and reported (report warning act_in_force_before_publication). */
export interface LegalText {
  schema_version: 'rag-v2/legal-text-1'; text_kind: string | null; adopted: string | null; original_reference: string | null;
  original_published: string | null; act_in_force_from: string | null; version_from: string | null;
  /** The adoption's own words, when it has any, and the day they give, read as a note's `note` and `applies_from` are. */
  adoption_note?: string; act_applies_from?: string;
  /** The amending acts named on the act itself. */
  history: Amendment[];
  /** What the amendment in force from `version_from` changed; `acts` are the history's acts of that day, by their own
   * day or named by a note of that day. Empty `provisions` means no note carries that day, not that nothing changed. */
  version_change?: { in_force: string; acts: (string | null)[]; provisions: string[] };
  /** Notes outside a section's text: the preamble, a title, a chapter or division, an annex title, a wholly repealed section. */
  structure: (Amendment & { target: string; path: string })[];
  /** The act's own provisions on its application or entry into force that name a day. */
  entry_into_force: { provision: string; unit_index: number; path: string; text: string }[];
}
export type LocalRights = { access: 'local_private'; usage: 'development_only' };
export type Scope = { tenant_id: string; document_version_id: Id };
export type Provenance = {
  kind: string; path?: string; span_ids?: Id[]; asset_hash?: string; version?: string;
  reason?: string; basis?: string; method?: string; raw?: string | null;
  timezone?: string; removed_span_ids?: Id[]; confirmed_by?: string; confirmed_at?: string;
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
  transformation: 'whitespace_only' | 'decoded_source_text' | 'pdf_nul_to_replacement_character_then_whitespace'
    | 'pdf_glyph_char_code_recovered_then_whitespace';
  parent_section_id: Id; block_id: Id; height: number; y: number; rotation?: number; reading_lane?: number; anchor_only?: boolean;
}
export interface Section extends Scope {
  id: Id; title: string | null; parent_id: Id | null; span_ids: Id[]; record_key?: string;
  /** Set on a reference list found before chunking; its lines stay source text only. */
  role?: 'reference_list';
}
export interface Chunk extends Scope {
  id: Id; ordinal: number; parent_section_id: Id; section_path: string[];
  span_ids: Id[]; pdf_pages: number[]; source_locations?: SourceLocation[]; record_key?: string | null; source_text: string; retrieval_text: string;
  retrieval_mapping: { prefix_length: number; body_span_ids: Id[]; operation: 'join_dehyphenated_lines_with_block_breaks' };
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
