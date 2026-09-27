-- ADR-036: a document version's index rows and vectors are written once per search config and shared by every
-- generation that lists the version. Existing generations keep their own rows (layout 'generation').
ALTER TABLE rag_v2_generation ADD COLUMN layout text NOT NULL DEFAULT 'generation' CHECK(layout IN ('generation','versions-v1'));
CREATE TABLE rag_v2_version_index (
 tenant text NOT NULL, config_id text NOT NULL, version_id text NOT NULL, document_id text NOT NULL,
 item jsonb NOT NULL, retrieval_directory jsonb NOT NULL, retrieval_hash text NOT NULL, morphology_hash text NOT NULL,
 state text NOT NULL DEFAULT 'staged' CHECK(state IN ('staged','ready')),
 PRIMARY KEY(tenant,config_id,version_id),
 FOREIGN KEY(tenant,document_id,version_id) REFERENCES rag_v2_version(tenant,document_id,id)
);
CREATE TABLE rag_v2_version_unit (
 tenant text NOT NULL, config_id text NOT NULL, id text NOT NULL, document_id text NOT NULL, version_id text NOT NULL, chunk_id text NOT NULL,
 ordinal integer NOT NULL, data jsonb NOT NULL, title text NOT NULL, authors text NOT NULL, body text NOT NULL, search_aids text NOT NULL,
 morphology jsonb NOT NULL,
 search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('pg_catalog.simple',title || ' ' || authors),'A') ||
  setweight(to_tsvector('pg_catalog.simple',body),'B') || setweight(to_tsvector('pg_catalog.simple',search_aids),'D')
 ) STORED,
 morphology_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('pg_catalog.simple',coalesce(morphology->>'title','')),'A') ||
  setweight(to_tsvector('pg_catalog.simple',coalesce(morphology->>'body','')),'B') ||
  setweight(to_tsvector('pg_catalog.simple',coalesce(morphology->>'aids','')),'D')
 ) STORED,
 PRIMARY KEY(tenant,config_id,id),
 FOREIGN KEY(tenant,config_id,version_id) REFERENCES rag_v2_version_index(tenant,config_id,version_id),
 FOREIGN KEY(tenant,version_id,chunk_id) REFERENCES rag_v2_object(tenant,version_id,id)
);
CREATE INDEX rag_v2_version_unit_version_idx ON rag_v2_version_unit(tenant,config_id,version_id);
CREATE INDEX rag_v2_version_unit_search_idx ON rag_v2_version_unit USING gin(search_vector);
CREATE INDEX rag_v2_version_unit_morphology_idx ON rag_v2_version_unit USING gin(morphology_vector);
