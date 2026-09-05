CREATE TABLE rag_v2_document (tenant text NOT NULL, id text NOT NULL, external_ids jsonb NOT NULL, PRIMARY KEY(tenant,id));
CREATE TABLE rag_v2_version (
 tenant text NOT NULL, id text NOT NULL, document_id text NOT NULL, bundle jsonb NOT NULL, bundle_hash text NOT NULL, assets jsonb NOT NULL,
 PRIMARY KEY(tenant,id), UNIQUE(tenant,document_id,id), FOREIGN KEY(tenant,document_id) REFERENCES rag_v2_document(tenant,id)
);
CREATE TABLE rag_v2_object (
 tenant text NOT NULL, version_id text NOT NULL, id text NOT NULL, kind text NOT NULL, data jsonb NOT NULL, from_id text, to_id text,
 PRIMARY KEY(tenant,version_id,id), FOREIGN KEY(tenant,version_id) REFERENCES rag_v2_version(tenant,id),
 FOREIGN KEY(tenant,version_id,from_id) REFERENCES rag_v2_object(tenant,version_id,id),
 FOREIGN KEY(tenant,version_id,to_id) REFERENCES rag_v2_object(tenant,version_id,id),
 CHECK ((kind = 'relation' AND from_id IS NOT NULL AND to_id IS NOT NULL) OR (kind <> 'relation' AND from_id IS NULL AND to_id IS NULL))
);
CREATE TABLE rag_v2_generation (
 tenant text NOT NULL, id text NOT NULL, sequence bigserial UNIQUE, snapshot jsonb NOT NULL, config jsonb NOT NULL,
 collection text NOT NULL, state text NOT NULL DEFAULT 'staged' CHECK(state IN ('staged','ready')), expected_count integer NOT NULL CHECK(expected_count>=0),
 PRIMARY KEY(tenant,id)
);
CREATE TABLE rag_v2_head (
 tenant text PRIMARY KEY, active_id text, requested_sequence bigint NOT NULL,
 FOREIGN KEY(tenant,active_id) REFERENCES rag_v2_generation(tenant,id)
);
CREATE TABLE rag_v2_generation_document (
 tenant text NOT NULL, generation_id text NOT NULL, document_id text NOT NULL, version_id text NOT NULL,
 PRIMARY KEY(tenant,generation_id,document_id), UNIQUE(tenant,generation_id,document_id,version_id),
 FOREIGN KEY(tenant,generation_id) REFERENCES rag_v2_generation(tenant,id),
 FOREIGN KEY(tenant,document_id,version_id) REFERENCES rag_v2_version(tenant,document_id,id)
);
CREATE TABLE rag_v2_unit (
 tenant text NOT NULL, generation_id text NOT NULL, id text NOT NULL, document_id text NOT NULL, version_id text NOT NULL, chunk_id text NOT NULL,
 ordinal integer NOT NULL, data jsonb NOT NULL, title text NOT NULL, authors text NOT NULL, body text NOT NULL, search_aids text NOT NULL,
 search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('pg_catalog.simple',title || ' ' || authors),'A') ||
  setweight(to_tsvector('pg_catalog.simple',body),'B') || setweight(to_tsvector('pg_catalog.simple',search_aids),'D')
 ) STORED,
 PRIMARY KEY(tenant,generation_id,id),
 FOREIGN KEY(tenant,generation_id,document_id,version_id) REFERENCES rag_v2_generation_document(tenant,generation_id,document_id,version_id),
 FOREIGN KEY(tenant,version_id,chunk_id) REFERENCES rag_v2_object(tenant,version_id,id)
);
CREATE INDEX rag_v2_unit_search_idx ON rag_v2_unit USING gin(search_vector);
CREATE TABLE rag_v2_vector_cache (
 tenant text NOT NULL, key text NOT NULL, config_id text NOT NULL, input_hash text NOT NULL, vector jsonb NOT NULL,
 PRIMARY KEY(tenant,key)
);
