-- The owner-scoped conversation search uses case-insensitive contains on all
-- three fields. Trigram GIN indexes prevent each authenticated request from
-- scanning the user's full conversation and message history.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Conversation_title_trgm_idx"
  ON "Conversation" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "Conversation_summary_trgm_idx"
  ON "Conversation" USING GIN ("summary" gin_trgm_ops);
CREATE INDEX "ConversationMessage_content_trgm_idx"
  ON "ConversationMessage" USING GIN ("content" gin_trgm_ops);
