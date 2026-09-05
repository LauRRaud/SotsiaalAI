import type { Id, SourceSpan } from '../types';
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
  text: string; language: 'et' | 'en' | 'ru'; generation_id?: Id; graph?: boolean;
  method?: 'lexical' | 'vector' | 'hybrid'; contextMode?: 'audit' | 'compact'; includeDocumentLabels?: boolean; finalLimit?: number;
  filters?: { region?: string; publication_from?: string; publication_to?: string; valid_at?: string };
  limits?: { topK?: number; perDocument?: number; candidates?: number; contextTokens?: number; graphSteps?: number; graphAdditions?: number };
}
export interface Evidence {
  evidence_id: Id; document_id: Id; document_version_id: Id; unit_id: Id; chunk_id: Id;
  span_ids: SourceSpan['id'][]; pdf_pages: number[]; source_text: string;
  bibliography: { title: string; authors: string[] | null; publication_date: string | null };
  source_metadata: Record<string, { value: unknown; provenance: unknown[]; review_state: string }>;
  search_aids: { heading_prefix: string; legacy_description: unknown; role: 'not_source_quote' };
  selection: { reason: string | { type: 'structural_expansion'; seed_evidence_id: Id; via: string; edge_ids: Id[] };
    ranks: Record<string, number>; rrf_contributions: Record<string, number>; rrf_score: number | null };
  limitations: unknown[];
}
export interface EvidenceBundle {
  schema_version: 'rag-v2/evidence-1'; query_id: Id; tenant: string; generation_id: Id | null;
  embedding_mode: 'mock' | 'real'; state: 'ok' | 'empty' | 'degraded' | 'error'; error?: string;
  channels: string[]; warnings: string[]; evidence: Evidence[];
  model_context?: ModelContext | null; reference_map?: Record<string, ModelReference>;
  raw_rankings: Record<string, { id: Id; score: number }[]>;
  selection_trace: { unit_id: Id; reason: string }[];
  measurements: { timings_ms: Record<string, number>; candidate_counts: Record<string, number>;
    context_tokens: number; external_embedding_calls: 0; generation_calls: 0; mock_embedding_calls: number;
    graph_steps?: number; graph_additions?: number };
}
export interface ModelContext {
  schema_version: 'rag-v2/model-context-json-1'; sources: Record<string, Record<string, unknown>>;
  evidence: { ref: string; source: string; pdf_pages: number[]; text: string }[];
}
export interface ModelReference {
  tenant: string; query_id: Id; generation_id: Id; evidence_id: Id; document_id: Id; document_version_id: Id;
  unit_id: Id; chunk_id: Id; span_ids: Id[]; pdf_pages: number[]; source_text_sha256: string;
}
