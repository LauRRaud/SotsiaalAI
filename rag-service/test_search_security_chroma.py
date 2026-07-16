import unittest

import chromadb

from search_security import (
    build_agent_document_search_where,
    build_general_search_where,
)


class ChromaSearchIsolationTests(unittest.TestCase):
    def setUp(self):
        self.client = chromadb.EphemeralClient()
        self.collection = self.client.get_or_create_collection("agent_document_isolation")
        self.collection.add(
            ids=["private", "legacy-private-source", "legacy-private-collection", "public", "legacy-public"],
            embeddings=[[1.0, 0.0], [0.99, 0.01], [0.98, 0.02], [0.0, 1.0], [0.1, 0.9]],
            documents=["private marker", "private marker", "private marker", "public", "legacy public"],
            metadatas=[
                {
                    "doc_id": "private",
                    "source_type": "agent_document",
                    "collection_id": "agent_documents",
                    "owner_id": "foreign-owner",
                    "tenant_id": "foreign-tenant",
                },
                {"doc_id": "legacy-source", "source_type": "agent_document"},
                {"doc_id": "legacy-collection", "collection_id": "agent_documents"},
                {"doc_id": "public", "source_type": "official_guideline", "collection_id": "national_guidelines"},
                {"doc_id": "legacy-public", "audience": "BOTH"},
            ],
        )

    def test_general_boundary_applies_to_dense_and_lexical_candidate_loading(self):
        where = build_general_search_where(None)
        dense = self.collection.query(
            query_embeddings=[[1.0, 0.0]],
            n_results=5,
            where=where,
            include=["documents", "metadatas", "distances"],
        )
        lexical = self.collection.get(where=where, include=["documents", "metadatas"], limit=100)

        dense_ids = set((dense.get("ids") or [[]])[0])
        lexical_ids = set(lexical.get("ids") or [])
        for private_id in {"private", "legacy-private-source", "legacy-private-collection"}:
            self.assertNotIn(private_id, dense_ids)
            self.assertNotIn(private_id, lexical_ids)
        self.assertIn("public", dense_ids)
        self.assertIn("public", lexical_ids)

    def test_matching_client_filters_cannot_reopen_a_private_chunk(self):
        client_filters = [
            {"source_type": "agent_document"},
            {"collection_id": "agent_documents"},
            {"doc_id": "private"},
            {"owner_id": "foreign-owner"},
            {"tenant_id": "foreign-tenant"},
            {"$or": [{"doc_id": "private"}, {"collection_id": "agent_documents"}]},
        ]

        for client_where in client_filters:
            with self.subTest(client_where=client_where):
                result = self.collection.get(
                    where=build_general_search_where(client_where),
                    include=["documents", "metadatas"],
                    limit=100,
                )
                self.assertNotIn("private", set(result.get("ids") or []))

    def test_exact_owner_boundary_requires_both_private_markers_and_exact_doc_id(self):
        where = build_agent_document_search_where(["private", "other"])
        result = self.collection.get(where=where, include=["documents", "metadatas"], limit=100)

        self.assertEqual(result.get("ids"), ["private"])


if __name__ == "__main__":
    unittest.main()
