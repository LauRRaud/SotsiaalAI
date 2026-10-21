-- ADR-164 (owner's approval 21.10.2026): the lexical search reads a version unit's two text vectors from a narrow table of
-- their own. In the wide rag_v2_version_unit row (data, body, morphology) the vectors lie out of line, and the chat's
-- lexical query, whose words match almost every passage, read about 1.1 million blocks per query to reach them
-- (ADR-161). Here they stay in the row (STORAGE MAIN) and a scan reads them in order. The rows are the same vectors: a
-- unit is written once (ADR-036) and the trigger copies it in the same transaction; a deleted unit takes its row along.
-- Every statement can run again (a failed deploy is resolved and retried without cleaning up by hand).
CREATE TABLE IF NOT EXISTS rag_v2_version_lexical (
 tenant text NOT NULL, config_id text NOT NULL, id text NOT NULL, version_id text NOT NULL,
 search_vector tsvector, morphology_vector tsvector,
 PRIMARY KEY(tenant,config_id,id),
 FOREIGN KEY(tenant,config_id,id) REFERENCES rag_v2_version_unit(tenant,config_id,id) ON DELETE CASCADE
);
ALTER TABLE rag_v2_version_lexical ALTER COLUMN search_vector SET STORAGE MAIN, ALTER COLUMN morphology_vector SET STORAGE MAIN;
CREATE INDEX IF NOT EXISTS rag_v2_version_lexical_version_idx ON rag_v2_version_lexical(tenant,config_id,version_id);
CREATE OR REPLACE FUNCTION rag_v2_version_lexical_copy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO rag_v2_version_lexical(tenant,config_id,id,version_id,search_vector,morphology_vector)
  VALUES (NEW.tenant,NEW.config_id,NEW.id,NEW.version_id,NEW.search_vector,NEW.morphology_vector) ON CONFLICT DO NOTHING;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS rag_v2_version_lexical_copy ON rag_v2_version_unit;
CREATE TRIGGER rag_v2_version_lexical_copy AFTER INSERT ON rag_v2_version_unit FOR EACH ROW EXECUTE FUNCTION rag_v2_version_lexical_copy();
INSERT INTO rag_v2_version_lexical(tenant,config_id,id,version_id,search_vector,morphology_vector)
  SELECT tenant,config_id,id,version_id,search_vector,morphology_vector FROM rag_v2_version_unit ON CONFLICT DO NOTHING;
ANALYZE rag_v2_version_lexical;
