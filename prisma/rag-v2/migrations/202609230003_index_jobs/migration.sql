CREATE TABLE rag_v2_index_job (
 tenant text NOT NULL, generation_id text NOT NULL, plan jsonb NOT NULL, plan_hash text NOT NULL,
 storage_root text NOT NULL, document_offset integer NOT NULL DEFAULT 0 CHECK(document_offset>=0),
 unit_offset integer NOT NULL DEFAULT 0 CHECK(unit_offset>=0), completed_units integer NOT NULL DEFAULT 0 CHECK(completed_units>=0),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','ready')),
 lease_token uuid, lease_until timestamptz,
 PRIMARY KEY(tenant,generation_id),
 FOREIGN KEY(tenant,generation_id) REFERENCES rag_v2_generation(tenant,id),
 CHECK((lease_token IS NULL) = (lease_until IS NULL)),
 CHECK(state<>'ready' OR lease_token IS NULL)
);
