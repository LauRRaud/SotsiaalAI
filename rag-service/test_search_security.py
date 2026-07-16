import unittest

from search_security import (
    AGENT_DOCUMENT_COLLECTION_ID,
    AGENT_DOCUMENT_SOURCE_TYPE,
    build_agent_document_search_where,
    build_general_search_where,
    is_general_search_metadata_allowed,
)


class GeneralSearchIsolationTests(unittest.TestCase):
    def test_client_filters_cannot_remove_or_replace_the_deny_boundary(self):
        untrusted = {
            "source_type": AGENT_DOCUMENT_SOURCE_TYPE,
            "collection_id": AGENT_DOCUMENT_COLLECTION_ID,
            "doc_id": "foreign-doc",
            "owner_id": "foreign-owner",
            "tenant_id": "foreign-tenant",
        }

        protected = build_general_search_where(untrusted)

        self.assertEqual(protected["$and"][0], untrusted)
        self.assertEqual(
            protected["$and"][-2:],
            [
                {"source_type": {"$ne": AGENT_DOCUMENT_SOURCE_TYPE}},
                {"collection_id": {"$ne": AGENT_DOCUMENT_COLLECTION_ID}},
            ],
        )
        self.assertNotEqual(id(protected["$and"][0]), id(untrusted))

    def test_source_type_and_collection_are_each_independent_fail_closed_markers(self):
        cases = [
            {"source_type": AGENT_DOCUMENT_SOURCE_TYPE, "collection_id": "other"},
            {"source_type": "file", "collection_id": AGENT_DOCUMENT_COLLECTION_ID},
            {
                "source_type": AGENT_DOCUMENT_SOURCE_TYPE,
                "collection_id": AGENT_DOCUMENT_COLLECTION_ID,
                # Legacy private chunks had no owner or tenant metadata.
            },
        ]

        for metadata in cases:
            with self.subTest(metadata=metadata):
                self.assertFalse(is_general_search_metadata_allowed(metadata))

    def test_public_metadata_remains_eligible(self):
        self.assertTrue(
            is_general_search_metadata_allowed(
                {"source_type": "official_guideline", "collection_id": "national_guidelines"}
            )
        )

    def test_exact_agent_document_search_is_server_constructed(self):
        protected = build_agent_document_search_where(["doc-a", "doc-a", "doc-b"])

        self.assertEqual(
            protected,
            {
                "$and": [
                    {"doc_id": {"$in": ["doc-a", "doc-b"]}},
                    {"source_type": AGENT_DOCUMENT_SOURCE_TYPE},
                    {"collection_id": AGENT_DOCUMENT_COLLECTION_ID},
                ]
            },
        )

    def test_exact_agent_document_search_rejects_missing_ids(self):
        with self.assertRaises(ValueError):
            build_agent_document_search_where([])


if __name__ == "__main__":
    unittest.main()
