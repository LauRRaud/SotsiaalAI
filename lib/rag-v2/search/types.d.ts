import type { Id, SourceSpan } from '../types';
export interface TrustedLocalContext { tenant: string; subject: string; usage: 'development_only' }
export interface EmbeddingConfig {
  embedding_mode: 'mock'; provider: 'local-mock'; model: string; dimensions: number; distance: 'Cosine';
  tokenizer: 'js-tiktoken@1.0.21/cl100k_base'; input_version: string; max_input_tokens: number;
}
export interface SearchQuery {
  text: string; language: 'et' | 'en' | 'ru'; generation_id?: Id; graph?: boolean;
  filters?: { region?: string; publication_from?: string; publication_to?: string; valid_at?: string };
  limits?: { topK?: number; perDocument?: number; candidates?: number; contextTokens?: number; graphSteps?: number; graphAdditions?: number };
}
export interface Evidence {
  evidence_id: Id; document_id: Id; document_version_id: Id; unit_id: Id; chunk_id: Id;
  span_ids: SourceSpan['id'][]; pdf_pages: number[]; source_text: string;
  bibliography: { title: string; authors: string[] | null; publication_date: string | null };
  search_aids: { heading_prefix: string; legacy_description: unknown; role: 'not_source_quote' };
  selection: { reason: string | { type: 'structural_expansion'; seed_evidence_id: Id; via: string; edge_ids: Id[] };
    ranks: Record<string, number>; rrf_contributions: Record<string, number>; rrf_score: number | null };
  limitations: unknown[];
}
export interface EvidenceBundle {
  schema_version: 'rag-v2/evidence-1'; query_id: Id; tenant: string; generation_id: Id | null;
  embedding_mode: 'mock'; state: 'ok' | 'empty' | 'degraded' | 'error'; error?: string;
  channels: string[]; warnings: string[]; evidence: Evidence[];
  measurements: { timings_ms: Record<string, number>; candidate_counts: Record<string, number>;
    context_tokens: number; external_embedding_calls: 0; generation_calls: 0; mock_embedding_calls: number;
    graph_steps?: number; graph_additions?: number };
}
