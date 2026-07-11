-- P2 internal limits for metrics that were modeled in P0 but intentionally not public yet.

INSERT INTO "PlanDefinition" (
  "id", "key", "name", "role", "price", "currency", "version", "active", "effectiveFrom", "createdAt", "updatedAt"
) VALUES (
  'plan_admin_internal_v1', 'admin_internal', 'Admin internal', 'ADMIN', 0.00, 'EUR', 1, true,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("key", "version") DO UPDATE SET
  "name" = EXCLUDED."name",
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlanEntitlement" (
  "id", "planDefinitionId", "metric", "enabled", "softLimit", "hardLimit", "period", "createdAt", "updatedAt"
) VALUES
  ('ent_client_refine_v1', 'plan_client_v1', 'DOCUMENT_REFINE', true, NULL, 6, 'WEEKLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_client_research_v1', 'plan_client_v1', 'DEEP_RESEARCH_RUN', true, NULL, 2, 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_client_rag_v1', 'plan_client_v1', 'RAG_SEARCH', true, NULL, 2000, 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_client_stt_v1', 'plan_client_v1', 'STT_SECONDS', true, NULL, 900, 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_client_tts_v1', 'plan_client_v1', 'TTS_CHARS', true, NULL, 50000, 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_worker_refine_v1', 'plan_social_worker_v1', 'DOCUMENT_REFINE', true, NULL, 12, 'WEEKLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_worker_research_v1', 'plan_social_worker_v1', 'DEEP_RESEARCH_RUN', true, NULL, 6, 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_worker_rag_v1', 'plan_social_worker_v1', 'RAG_SEARCH', true, NULL, 5000, 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_worker_stt_v1', 'plan_social_worker_v1', 'STT_SECONDS', true, NULL, 3600, 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_worker_tts_v1', 'plan_social_worker_v1', 'TTS_CHARS', true, NULL, 150000, 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_provider_refine_v1', 'plan_service_provider_v1', 'DOCUMENT_REFINE', true, NULL, 24, 'WEEKLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_provider_research_v1', 'plan_service_provider_v1', 'DEEP_RESEARCH_RUN', true, NULL, 12, 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_provider_rag_v1', 'plan_service_provider_v1', 'RAG_SEARCH', true, NULL, 10000, 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_provider_stt_v1', 'plan_service_provider_v1', 'STT_SECONDS', true, NULL, 7200, 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_provider_tts_v1', 'plan_service_provider_v1', 'TTS_CHARS', true, NULL, 300000, 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_admin_chat_v1', 'plan_admin_internal_v1', 'CHAT_ASSISTANT_REPLY', true, 4000, 5000, 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_admin_document_v1', 'plan_admin_internal_v1', 'DOCUMENT_GENERATE', true, NULL, 200, 'WEEKLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_admin_refine_v1', 'plan_admin_internal_v1', 'DOCUMENT_REFINE', true, NULL, 600, 'WEEKLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_admin_analyze_v1', 'plan_admin_internal_v1', 'FILE_ANALYZE', true, NULL, 500, 'WEEKLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_admin_research_v1', 'plan_admin_internal_v1', 'DEEP_RESEARCH_RUN', true, NULL, 100, 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_admin_rag_v1', 'plan_admin_internal_v1', 'RAG_SEARCH', true, NULL, 50000, 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_admin_stt_v1', 'plan_admin_internal_v1', 'STT_SECONDS', true, NULL, 36000, 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_admin_tts_v1', 'plan_admin_internal_v1', 'TTS_CHARS', true, NULL, 1000000, 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_admin_storage_v1', 'plan_admin_internal_v1', 'STORAGE_BYTES', true, NULL, 10737418240, 'LIFETIME', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("planDefinitionId", "metric") DO UPDATE SET
  "enabled" = EXCLUDED."enabled",
  "softLimit" = EXCLUDED."softLimit",
  "hardLimit" = EXCLUDED."hardLimit",
  "period" = EXCLUDED."period",
  "updatedAt" = CURRENT_TIMESTAMP;
