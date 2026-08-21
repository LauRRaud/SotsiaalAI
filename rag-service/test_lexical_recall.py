import atexit
import os
import shutil
import tempfile
import unittest
from unittest.mock import patch

os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("RAG_SERVICE_API_KEY", "test-rag-service-key-32-characters-minimum")
_TEST_STORAGE = tempfile.mkdtemp(prefix="rag-lexical-recall-")
os.environ.setdefault("RAG_STORAGE_DIR", _TEST_STORAGE)
atexit.register(shutil.rmtree, _TEST_STORAGE, ignore_errors=True)

from rag_test_stubs import install_chromadb_stub_if_missing

install_chromadb_stub_if_missing()
import main


class LexicalRecallTests(unittest.TestCase):
    def test_compose_chroma_where_flattens_single_logical_filter_group(self):
        where = main._compose_chroma_where({
            "audience": {"$in": ["BOTH", "SOCIAL_WORKER"]},
            "$and": [{
                "$or": [
                    {"source_type": {"$in": ["journal_article", "research_report"]}},
                    {"collection_id": {"$in": ["sotsiaaltoo_articles", "research_reports"]}},
                ]
            }],
        })

        self.assertEqual(where, {
            "$and": [
                {"audience": {"$in": ["BOTH", "SOCIAL_WORKER"]}},
                {
                    "$or": [
                        {"source_type": {"$in": ["journal_article", "research_report"]}},
                        {"collection_id": {"$in": ["sotsiaaltoo_articles", "research_reports"]}},
                    ]
                },
            ]
        })

    def test_high_coverage_body_match_is_not_buried_below_dense_noise(self):
        precise = {
            "id": "precise",
            "retrieval_channels": ["bm25"],
            "lexical_score": 5.7,
            "lexical_rank": 1,
            "bm25_coverage": 0.8,
            "bm25_matches": 8,
        }
        dense_noise = {
            "id": "dense-noise",
            "retrieval_channels": ["dense"],
            "distance": 1.0,
            "dense_rank": 1,
        }

        rows = [dense_noise, precise]
        main._apply_hybrid_ranking(rows)

        self.assertEqual(rows[0]["id"], "precise")
        self.assertGreater(precise["bm25_coverage_boost"], 0)

    def test_journal_chunks_leave_result_slots_for_independent_sources(self):
        rows = [
            {
                "id": f"article-a-{index}",
                "doc_id": "article-a",
                "source_type": "journal_article",
            }
            for index in range(6)
        ] + [
            {
                "id": "independent-report",
                "doc_id": "report-b",
                "source_type": "research_report",
            },
            {
                "id": "article-c-1",
                "doc_id": "article-c",
                "source_type": "journal_article",
            },
            {
                "id": "article-c-2",
                "doc_id": "article-c",
                "source_type": "journal_article",
            },
        ]

        selected = main._select_diverse_search_results(rows, 8)
        selected_ids = [item["id"] for item in selected]

        self.assertEqual(selected_ids[:3], ["article-a-0", "article-a-1", "article-a-2"])
        self.assertIn("independent-report", selected_ids)
        self.assertEqual(len([item for item in selected if item.get("doc_id") == "article-a"]), 3)

    def test_dense_candidate_pool_reaches_beyond_one_long_article(self):
        self.assertEqual(main._dense_candidate_limit(8), 64)
        self.assertEqual(main._dense_candidate_limit(14), 84)
        self.assertEqual(main._dense_candidate_limit(36), 200)

    def test_inflected_long_terms_and_named_entities_rank_the_matching_passage(self):
        query = "Kuidas kasutab Helsingi Hester tehisintellekti ja kuidas kaitseb isikuandmeid?"
        ids = ["generic", "hester"]
        documents = [
            "Tehisintellekti üldine käsitlus ja isikuandmete kaitse põhimõtted.",
            (
                "Helsingi Hester on tehisintellektil põhinev vestlusrobot. "
                "Isikuandmete kaitseks eemaldatakse delikaatne teave ja logid "
                "kustutatakse kuue kuu möödudes."
            ),
        ]
        metadatas = [
            {"title": "Üldine tehisintellekti juhend"},
            {"title": "Tehisintellekt sotsiaaltöös"},
        ]

        scored = main._score_lexical_rows(
            query,
            {"title_match", "exact_phrase", "bm25"},
            ids,
            documents,
            metadatas,
        )

        self.assertTrue(scored)
        self.assertEqual(scored[0]["id"], "hester")
        self.assertIn("bm25", scored[0]["channels"])

    def test_targeted_document_shortlist_reaches_a_chunk_beyond_the_bounded_full_scan(self):
        class Collection:
            def __init__(self):
                self.calls = []

            def get(self, **kwargs):
                self.calls.append(kwargs)
                if kwargs.get("where_document"):
                    return {
                        "ids": ["article-29"],
                        "documents": [
                            "89% avaliku sektori organisatsioonidest ei rakenda "
                            "nõusolekuteenust ja 70% ei kasuta andmejälgijat."
                        ],
                        "metadatas": [{"title": "Tehisintellekt sotsiaaltöös", "year": 2025}],
                    }
                if "offset" in kwargs:
                    return {
                        "ids": ["wrong-title"],
                        "documents": ["Avaliku sektori koostöö üldine kirjeldus."],
                        "metadatas": [{"title": "Avaliku sektori koostöö"}],
                    }
                return {"ids": [], "documents": [], "metadatas": []}

        collection = Collection()
        query = (
            "Kui suur osa avaliku sektori organisatsioonidest ei rakenda "
            "nõusolekuteenust ja kui suur osa ei kasuta andmejälgijat?"
        )
        with patch.object(main, "collection", collection), patch.object(
            main, "_registry_title_shortlist_doc_ids", return_value=[]
        ):
            result = main._fetch_lexical_candidates(
                query,
                None,
                20,
                ["title_match", "exact_phrase", "bm25"],
            )

        self.assertTrue(any(call.get("where_document") for call in collection.calls))
        self.assertIn("article-29", [item["id"] for item in result["candidates"]])

    def test_found_article_expands_to_question_relevant_sibling_chunks(self):
        class Collection:
            def __init__(self):
                self.where = None

            def get(self, **kwargs):
                self.where = kwargs.get("where")
                return {
                    "ids": ["article-7", "article-8"],
                    "documents": [
                        "Helsingi Hester annab ööpäev läbi teenuste kohta teavet.",
                        (
                            "Tehisintellekti kasutav Helsingi Hester eemaldab "
                            "isikuandmete kaitseks delikaatse teabe ja "
                            "kustutab vestluslogid kuue kuu möödudes."
                        ),
                    ],
                    "metadatas": [
                        {"doc_id": "ai-article", "article_id": "ai-2025", "title": "Tehisintellekt sotsiaaltöös"},
                        {"doc_id": "ai-article", "article_id": "ai-2025", "title": "Tehisintellekt sotsiaaltöös"},
                    ],
                }

        collection = Collection()
        dense_results = [
            {
                "id": f"article-{index}",
                "doc_id": f"ai-article-{index}",
                "articleId": f"ai-2025-{index}",
                "source_type": "journal_article",
            }
            for index in range(1, 7)
        ]
        with patch.object(main, "collection", collection):
            siblings = main._fetch_article_sibling_candidates(
                "Kuidas kasutab Helsingi Hester tehisintellekti ja kuidas kaitseb isikuandmeid?",
                {"source_type": {"$ne": "agent_document"}},
                dense_results,
                20,
                ["title_match", "exact_phrase", "bm25"],
            )

        self.assertTrue(siblings)
        self.assertEqual(siblings[0]["id"], "article-8")
        self.assertIn("$and", collection.where)
        self.assertEqual(
            collection.where["$and"][1]["doc_id"]["$in"],
            ["ai-article-1"],
        )


if __name__ == "__main__":
    unittest.main()
