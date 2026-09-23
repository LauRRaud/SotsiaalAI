-- Existing generations keep their verified eager reader until explicitly reindexed.
ALTER TABLE rag_v2_generation_document
 ADD COLUMN retrieval_directory jsonb,
 ADD COLUMN retrieval_hash text,
 ADD CONSTRAINT rag_v2_retrieval_directory_pair CHECK ((retrieval_directory IS NULL) = (retrieval_hash IS NULL));
