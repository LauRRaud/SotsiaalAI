ALTER TABLE rag_v2_unit ADD COLUMN morphology jsonb NOT NULL DEFAULT '{}';
ALTER TABLE rag_v2_unit ADD COLUMN morphology_vector tsvector GENERATED ALWAYS AS (
 setweight(to_tsvector('pg_catalog.simple',coalesce(morphology->>'title','')),'A') ||
 setweight(to_tsvector('pg_catalog.simple',coalesce(morphology->>'body','')),'B') ||
 setweight(to_tsvector('pg_catalog.simple',coalesce(morphology->>'aids','')),'D')
) STORED;
CREATE INDEX rag_v2_unit_morphology_idx ON rag_v2_unit USING gin(morphology_vector);
