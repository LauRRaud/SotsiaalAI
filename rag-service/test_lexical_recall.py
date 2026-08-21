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
    def test_compound_body_or_anchored_title_shortlist_can_finish_without_corpus_scan(self):
        compound_body = {
            "channels": ["title_match", "bm25"],
            "bm25_coverage": 0.65,
            "bm25_matches": 11,
            "bm25_body_matches": 11,
            "bm25_named_entity_matches": 0,
            "bm25_query_tokens": 17,
        }
        anchored_title = {
            "channels": ["title_match", "bm25"],
            "bm25_coverage": 0.44,
            "bm25_matches": 7,
            "bm25_body_matches": 7,
            "bm25_named_entity_matches": 0,
            "bm25_query_tokens": 16,
        }

        self.assertTrue(main._lexical_shortlist_is_conclusive([compound_body]))
        self.assertTrue(main._lexical_shortlist_is_conclusive([anchored_title]))

    def test_compound_fact_query_is_split_into_bounded_semantic_segments(self):
        segments = main._split_fact_query_segments(
            "Mida soovitas dementsuse ennetamise artikkel nädalase liikumise "
            "ja ööune kohta ning mitu korda suurem on dementsuse risk "
            "kuulmislangusega inimesel?"
        )

        self.assertGreaterEqual(len(segments), 2)
        self.assertLessEqual(len(segments), 6)
        self.assertTrue(any("ööune" in segment for segment in segments))
        self.assertTrue(any("dementsuse ennetamise artikkel" in segment and "ööune" in segment for segment in segments))
        lexical_segments = main._split_fact_query_segments(
            "Mida soovitas dementsuse ennetamise artikkel nädalase liikumise "
            "ja ööune kohta ning mitu korda suurem on dementsuse risk "
            "kuulmislangusega inimesel?",
            anchor_short=False,
        )
        self.assertIn("ööune kohta", lexical_segments)
        self.assertEqual(main._search_tokens("ööune kohta"), ["ooune"])
        self.assertTrue(any("kuulmislangusega" in segment for segment in segments))
        self.assertEqual(main._split_fact_query_segments("Mis on koduteenus?"), [])

    def test_three_word_fact_segment_stays_specific_for_document_lookup(self):
        segments = main._split_fact_query_segments(
            "Milliseid arvulisi muutusi tõi OSKA seire välja hooldustöötajate palga, "
            "töötajate arvu, hooldekodude nõuete täitmise ja riikliku koolitustellimuse kohta?"
        )

        care_home_segment = next(segment for segment in segments if "hooldekodude" in segment)
        self.assertEqual(care_home_segment, "hooldekodude nõuete täitmise")

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

    def test_narrow_fact_search_can_keep_deeper_evidence_from_one_article(self):
        rows = [
            {
                "id": f"article-a-{index}",
                "doc_id": "article-a",
                "source_type": "journal_article",
            }
            for index in range(8)
        ] + [{
            "id": "independent-report",
            "doc_id": "report-b",
            "source_type": "research_report",
        }]

        selected = main._select_diverse_search_results(
            rows,
            9,
            journal_chunks_per_document=8,
        )

        self.assertEqual(
            len([item for item in selected if item.get("doc_id") == "article-a"]),
            8,
        )
        self.assertEqual(selected[-1]["id"], "independent-report")

    def test_narrow_fact_search_preserves_two_best_chunks_for_each_query_segment(self):
        rows = [
            {
                "id": f"article-a-{index}",
                "doc_id": "article-a",
                "source_type": "journal_article",
                **(
                    {"fact_segment_ranks": {"sleep": 2}}
                    if index == 13
                    else {}
                ),
            }
            for index in range(14)
        ]
        rows[4]["fact_segment_ranks"] = {"sleep": 1}

        baseline = main._select_diverse_search_results(
            rows,
            12,
            journal_chunks_per_document=12,
        )
        selected = main._select_fact_covered_search_results(
            rows,
            baseline,
            12,
            journal_chunks_per_document=12,
        )

        selected_ids = {item["id"] for item in selected}
        self.assertIn("article-a-4", selected_ids)
        self.assertIn("article-a-13", selected_ids)
        self.assertNotIn("article-a-11", selected_ids)

    def test_fact_coverage_keeps_adjacent_chunk_of_mandatory_fact_hit(self):
        rows = [
            {"id": f"guide-{index}", "doc_id": "guide", "source_type": "official_guideline"}
            for index in range(6)
        ]
        rows.extend([
            {
                "id": "fact-hit",
                "doc_id": "guide",
                "source_type": "official_guideline",
                "fact_segment_ranks": {"0": 1},
            },
            {
                "id": "fact-continuation",
                "doc_id": "guide",
                "source_type": "official_guideline",
                "fact_segment_ranks": {"0": 2},
                "fact_neighbor": True,
                "fact_neighbor_of": "fact-hit",
            },
        ])
        baseline = rows[:6]

        selected = main._select_fact_covered_search_results(
            rows,
            baseline,
            6,
            journal_chunks_per_document=8,
        )

        self.assertIn("fact-hit", {item["id"] for item in selected})
        self.assertIn("fact-continuation", {item["id"] for item in selected})

    def test_fact_neighbor_does_not_displace_second_direct_lexical_fact_hit(self):
        rows = [
            {
                "id": "direct-first",
                "doc_id": "guide",
                "fact_segment_ranks": {"0": 1},
                "fact_segment_lexical_ranks": {"0": 1},
            },
            {
                "id": "neighbor",
                "doc_id": "guide",
                "fact_segment_ranks": {"0": 2},
                "fact_segment_lexical_ranks": {"0": 2},
                "fact_neighbor": True,
            },
            {
                "id": "direct-second",
                "doc_id": "guide",
                "fact_segment_ranks": {"0": 2},
                "fact_segment_lexical_ranks": {"0": 2},
            },
            {"id": "filler", "doc_id": "guide"},
        ]

        selected = main._select_fact_covered_search_results(
            rows,
            rows[:2],
            2,
            journal_chunks_per_document=8,
        )

        self.assertEqual({item["id"] for item in selected}, {"direct-first", "direct-second"})

    def test_fact_neighbor_of_best_dense_hit_precedes_second_dense_hit(self):
        rows = [
            {"id": "dense-first", "doc_id": "guide", "fact_segment_ranks": {"0": 1}},
            {"id": "dense-second", "doc_id": "guide", "fact_segment_ranks": {"0": 2}},
            {
                "id": "dense-first-continuation",
                "doc_id": "guide",
                "fact_segment_ranks": {"0": 2},
                "fact_adjacent_to_best_segments": ["0"],
            },
        ]

        selected = main._select_fact_covered_search_results(
            rows,
            rows[:2],
            2,
            journal_chunks_per_document=8,
        )

        self.assertEqual(
            {item["id"] for item in selected},
            {"dense-first", "dense-first-continuation"},
        )

    def test_fact_coverage_does_not_remove_a_source_found_by_the_full_query(self):
        baseline = [
            {"id": "newer-1", "doc_id": "newer", "source_type": "journal_article"},
            {"id": "newer-2", "doc_id": "newer", "source_type": "journal_article"},
            {"id": "older-facts", "doc_id": "older", "source_type": "journal_article"},
        ]
        results = [
            baseline[0],
            {
                "id": "newer-segment",
                "doc_id": "newer",
                "source_type": "journal_article",
                "fact_segment_ranks": {"0": 1},
            },
            baseline[1],
            baseline[2],
        ]

        selected = main._select_fact_covered_search_results(
            results,
            baseline,
            3,
            journal_chunks_per_document=8,
        )

        selected_ids = {item["id"] for item in selected}
        self.assertIn("older-facts", selected_ids)
        self.assertIn("newer-segment", selected_ids)

    def test_fact_coverage_keeps_each_sources_best_full_query_chunk(self):
        baseline = [
            {"id": "facts", "doc_id": "article", "source_type": "journal_article"},
            {"id": "detail", "doc_id": "article", "source_type": "journal_article"},
        ]
        segment = {
            "id": "segment",
            "doc_id": "article",
            "source_type": "journal_article",
            "fact_segment_ranks": {"0": 1},
        }

        selected = main._select_fact_covered_search_results(
            [segment, *baseline],
            baseline,
            2,
            journal_chunks_per_document=8,
        )

        self.assertEqual({item["id"] for item in selected}, {"facts", "segment"})

    def test_fact_coverage_can_replace_lower_ranked_singleton_sources(self):
        baseline = [
            {"id": f"source-{index}", "doc_id": f"source-{index}"}
            for index in range(5)
        ]
        segment_rows = [
            {
                "id": f"guide-fact-{index}",
                "doc_id": "source-0",
                "fact_segment_ranks": {str(index): 1},
            }
            for index in range(2)
        ]

        selected = main._select_fact_covered_search_results(
            [*baseline, *segment_rows],
            baseline,
            5,
            journal_chunks_per_document=8,
        )

        selected_ids = {item["id"] for item in selected}
        self.assertTrue({"source-0", "source-1", "source-2"}.issubset(selected_ids))
        self.assertTrue({"guide-fact-0", "guide-fact-1"}.issubset(selected_ids))
        self.assertNotIn("source-4", selected_ids)

    def test_lexical_candidates_leave_room_for_a_second_document(self):
        crowded = [
            {
                "id": f"guide-{index}",
                "score": 10 - index / 10,
                "metadata": {"doc_id": "privacy-guide"},
            }
            for index in range(10)
        ]
        targeted = {
            "id": "hester-detail",
            "score": 6.7,
            "metadata": {"doc_id": "ai-article"},
        }

        selected = main._select_lexical_candidates([*crowded, targeted], 8)

        self.assertIn("hester-detail", [item["id"] for item in selected])
        self.assertEqual(
            len([item for item in selected if item["metadata"]["doc_id"] == "privacy-guide"]),
            4,
        )

    def test_dense_candidate_pool_reaches_beyond_one_long_article(self):
        self.assertEqual(main._dense_candidate_limit(8), 64)
        self.assertEqual(main._dense_candidate_limit(14), 84)
        self.assertEqual(main._dense_candidate_limit(36), 200)

    def test_dense_article_anchor_requires_specific_title_evidence(self):
        query = (
            "Millised kolm osakaalu näitas erihooldekodude elanike kaardistus: "
            "kui paljud saaksid hakkama kergemal teenusel, kui paljud vajavad "
            "ööpäevaringset juhendamist ja kui paljud pidevaid hooldamistoiminguid?"
        )
        dense_results = [
            {
                "doc_id": "newer-generic",
                "source_type": "journal_article",
                "title": "Erihoolekande teenused tulevikus",
            },
            {
                "doc_id": "newer-generic",
                "source_type": "journal_article",
                "title": "Erihoolekande teenused tulevikus",
            },
            {
                "doc_id": "newer-generic",
                "source_type": "journal_article",
                "title": "Erihoolekande teenused tulevikus",
            },
            {
                "doc_id": "correct-map",
                "source_type": "journal_article",
                "title": "Erihooldekodude elanike kaardistus",
            },
        ]

        self.assertEqual(
            main._dense_article_anchor_doc_ids(query, dense_results),
            ["correct-map"],
        )

    def test_dense_article_anchor_accepts_clear_top_eight_document_dominance(self):
        query = (
            "Kui suur osa õpilastest koges koolikiusamist ja kui suured olid "
            "vastavad näitajad küberkiusamise puhul?"
        )
        dense_results = [
            {
                "doc_id": "bullying-study",
                "source_type": "journal_article",
                "title": "Kiusamise levimus Eesti noorte seas",
            }
            for _ in range(5)
        ] + [
            {
                "doc_id": f"other-{index}",
                "source_type": "research_report",
                "title": "Noorte heaolu uuring",
            }
            for index in range(3)
        ]

        self.assertEqual(
            main._dense_article_anchor_doc_ids(query, dense_results),
            ["bullying-study"],
        )

    def test_dense_article_shortlist_scores_only_the_anchored_article(self):
        class Collection:
            def __init__(self):
                self.calls = []

            def get(self, **kwargs):
                self.calls.append(kwargs)
                if "offset" in kwargs:
                    raise AssertionError("anchored article lookup must not scan the full corpus")
                return {
                    "ids": ["survey-11", "survey-18"],
                    "documents": [
                        "Uuringus tundis 61% hooldajatest, et vajab täiendavat abi.",
                        (
                            "Mõne tegevuse juures vajas palju abi 26%. Suure "
                            "abivajadusega riskirühma kuulus 11% ja keskmise "
                            "abivajadusega riskirühma 18%."
                        ),
                    ],
                    "metadatas": [
                        {
                            "doc_id": "care-survey",
                            "source_type": "journal_article",
                            "title": "Hoolduskoormuse uuring",
                        },
                        {
                            "doc_id": "care-survey",
                            "source_type": "journal_article",
                            "title": "Hoolduskoormuse uuring",
                        },
                    ],
                }

        collection = Collection()
        query = (
            "Kui suur osa hooldajatest tundis hoolduskoormuse uuringus, et vajab "
            "täiendavat abi, kui suur osa vajas palju abi ning kui suur osa "
            "kuulus suure ja keskmise abivajadusega riskirühma?"
        )
        with patch.object(main, "collection", collection):
            result = main._fetch_lexical_candidates(
                query,
                None,
                12,
                ["title_match", "exact_phrase", "bm25"],
                dense_article_doc_ids=["care-survey"],
            )

        self.assertEqual(result.get("strategy"), "dense_article_shortlist")
        self.assertEqual(result.get("scanned"), 2)
        self.assertEqual(
            collection.calls[0]["where"]["doc_id"]["$in"],
            ["care-survey"],
        )
        self.assertEqual(
            {item["id"] for item in result["candidates"]},
            {"survey-11", "survey-18"},
        )

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

    def test_named_entity_case_form_can_anchor_a_specific_passage(self):
        scored = main._score_lexical_rows(
            "Kuidas kaitseb Helsingi Hester isikuandmeid ja kui kaua vestluslogisid säilitatakse?",
            {"bm25"},
            ["hester-detail"],
            [
                "Delikaatne teave eemaldatakse automaatselt ja logid kustutatakse "
                "kuue kuu möödudes. Hesteri näide toetab inimkeskset teenust."
            ],
            [{"title": "Tehisintellekt sotsiaaltöös"}],
        )

        self.assertEqual(scored[0]["id"], "hester-detail")
        self.assertEqual(scored[0]["bm25_named_entity_matches"], 1)

    def test_named_entity_anchor_is_not_buried_below_generic_dense_results(self):
        named = {
            "id": "hester-detail",
            "retrieval_channels": ["bm25"],
            "lexical_score": 4.0,
            "lexical_rank": 1,
            "bm25_matches": 1,
            "bm25_coverage": 0.125,
            "bm25_named_entity_matches": 1,
        }
        generic = {
            "id": "generic-dense",
            "retrieval_channels": ["dense"],
            "distance": 1.0,
            "dense_rank": 1,
        }

        rows = [generic, named]
        main._apply_hybrid_ranking(rows)

        self.assertEqual(rows[0]["id"], "hester-detail")
        self.assertGreater(named["named_entity_boost"], 0)

    def test_fact_segment_hit_is_not_buried_below_full_query_dense_noise(self):
        segment_hit = {
            "id": "sleep-detail",
            "retrieval_channels": ["dense"],
            "distance": 0.9,
            "dense_rank": 8,
            "fact_segment_hits": 1,
            "fact_segment_best_rank": 1,
        }
        full_query_hit = {
            "id": "generic-summary",
            "retrieval_channels": ["dense"],
            "distance": 0.1,
            "dense_rank": 1,
        }

        rows = [full_query_hit, segment_hit]
        main._apply_hybrid_ranking(rows)

        self.assertEqual(rows[0]["id"], "sleep-detail")
        self.assertGreater(segment_hit["fact_segment_boost"], 0)

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

    def test_targeted_shortlist_budget_is_independent_of_twelve_result_response_limit(self):
        class Collection:
            def __init__(self):
                self.calls = []

            def get(self, **kwargs):
                self.calls.append(kwargs)
                if kwargs.get("where_document") and int(kwargs.get("limit") or 0) >= 216:
                    return {
                        "ids": ["care-home-intro"],
                        "documents": [
                            "Erihooldekodude elanike kaardistus näitas kolme osakaalu: "
                            "25%, 45% ja 30%."
                        ],
                        "metadatas": [{
                            "doc_id": "care-home-2017",
                            "title": "Suurte erihooldekodude ümberkorraldamine",
                        }],
                    }
                if kwargs.get("where_document"):
                    return {"ids": [], "documents": [], "metadatas": []}
                return {"ids": [], "documents": [], "metadatas": []}

        collection = Collection()
        with patch.object(main, "collection", collection), patch.object(
            main, "_registry_title_shortlist_doc_ids", return_value=[]
        ):
            result = main._fetch_lexical_candidates(
                "Millised kolm osakaalu näitas erihooldekodude elanike kaardistus?",
                None,
                12,
                ["title_match", "exact_phrase", "bm25"],
            )

        targeted_limits = [
            int(call.get("limit") or 0)
            for call in collection.calls
            if call.get("where_document")
        ]
        self.assertTrue(targeted_limits)
        self.assertGreaterEqual(targeted_limits[0], 216)
        self.assertIn("care-home-intro", [item["id"] for item in result["candidates"]])

    def test_strong_targeted_body_match_skips_the_bounded_corpus_scan(self):
        class Collection:
            def __init__(self):
                self.calls = []

            def get(self, **kwargs):
                self.calls.append(kwargs)
                if kwargs.get("where_document"):
                    return {
                        "ids": ["ott-detail"],
                        "documents": [
                            "OTT-süsteem hindab pikaajalise töötuse riski 45 näitaja alusel."
                        ],
                        "metadatas": [{"title": "Tehisintellekt sotsiaaltöös"}],
                    }
                if "offset" in kwargs:
                    raise AssertionError("strong body coverage must not trigger the 8000-row fallback")
                return {"ids": [], "documents": [], "metadatas": []}

        collection = Collection()
        with patch.object(main, "collection", collection), patch.object(
            main, "_registry_title_shortlist_doc_ids", return_value=[]
        ):
            result = main._fetch_lexical_candidates(
                "Milline süsteem hindab pikaajalise töötuse riski 45 näitaja alusel?",
                None,
                20,
                ["title_match", "exact_phrase", "bm25"],
            )

        self.assertEqual(result.get("strategy"), "targeted_document_shortlist")
        self.assertEqual([item["id"] for item in result["candidates"]], ["ott-detail"])
        self.assertFalse(any("offset" in call for call in collection.calls))

    def test_compound_targeted_matches_in_one_document_skip_corpus_scan(self):
        class Collection:
            def __init__(self):
                self.calls = []

            def get(self, **kwargs):
                self.calls.append(kwargs)
                if kwargs.get("where_document"):
                    metadata = {"doc_id": "fire-guide", "title": "Tuleohutuse juhend"}
                    return {
                        "ids": ["door", "call", "evacuate"],
                        "documents": [
                            "Enne ruumi sisenemist kontrolli ust.",
                            "Tulekahju korral helista 112.",
                            "Alusta inimeste evakueerimisega.",
                        ],
                        "metadatas": [metadata, metadata, metadata],
                    }
                if "offset" in kwargs:
                    raise AssertionError("one-document compound coverage must not trigger the corpus scan")
                return {"ids": [], "documents": [], "metadatas": []}

        collection = Collection()
        with patch.object(main, "collection", collection), patch.object(
            main, "_registry_title_shortlist_doc_ids", return_value=[]
        ):
            result = main._fetch_lexical_candidates(
                "Mida teha enne ruumi sisenemist, kellele helistada ja millega alustada?",
                None,
                12,
                ["title_match", "exact_phrase", "bm25"],
            )

        self.assertEqual(result.get("strategy"), "targeted_compound_document_shortlist")
        self.assertEqual({item["id"] for item in result["candidates"]}, {"door", "call", "evacuate"})
        self.assertGreaterEqual(
            len([call for call in collection.calls if call.get("where_document")]),
            2,
        )
        self.assertFalse(any("offset" in call for call in collection.calls))

    def test_partial_targeted_body_match_still_uses_the_bounded_corpus_scan(self):
        class Collection:
            def __init__(self):
                self.calls = []

            def get(self, **kwargs):
                self.calls.append(kwargs)
                if kwargs.get("where_document"):
                    return {
                        "ids": ["partial"],
                        "documents": ["OTT-süsteem hindab pikaajalise töötuse riski."],
                        "metadatas": [{"title": "Tehisintellekt sotsiaaltöös"}],
                    }
                if "offset" in kwargs:
                    return {"ids": [], "documents": [], "metadatas": []}
                return {"ids": [], "documents": [], "metadatas": []}

        collection = Collection()
        with patch.object(main, "collection", collection), patch.object(
            main, "_registry_title_shortlist_doc_ids", return_value=[]
        ):
            main._fetch_lexical_candidates(
                "Milline süsteem hindab pikaajalise töötuse riski 45 näitaja alusel?",
                None,
                20,
                ["title_match", "exact_phrase", "bm25"],
            )

        self.assertTrue(any("offset" in call for call in collection.calls))

    def test_targeted_body_match_is_kept_when_a_different_title_also_matches(self):
        class Collection:
            def __init__(self):
                self.calls = []

            def get(self, **kwargs):
                self.calls.append(kwargs)
                if kwargs.get("where_document"):
                    return {
                        "ids": ["hester-detail"],
                        "documents": [
                            "Helsingi Hester kaitseb isikuandmeid nii, et delikaatne "
                            "teave eemaldatakse automaatselt ja vestluslogisid "
                            "säilitatakse kuus kuud."
                        ],
                        "metadatas": [{"title": "Tehisintellekt sotsiaaltöös"}],
                    }
                if kwargs.get("where"):
                    return {
                        "ids": ["privacy-guide"],
                        "documents": ["Isikuandmete kaitse üldised põhimõtted."],
                        "metadatas": [{"title": "Isikuandmete töötleja üldjuhend"}],
                    }
                return {"ids": [], "documents": [], "metadatas": []}

        collection = Collection()
        with patch.object(main, "collection", collection), patch.object(
            main, "_registry_title_shortlist_doc_ids", return_value=["privacy-guide"]
        ):
            result = main._fetch_lexical_candidates(
                "Kuidas kaitseb Helsingi Hester isikuandmeid ja kui kaua vestluslogisid säilitatakse?",
                None,
                20,
                ["title_match", "exact_phrase", "bm25"],
            )

        self.assertTrue(any(call.get("where_document") for call in collection.calls))
        self.assertIn("hester-detail", [item["id"] for item in result["candidates"]])

    def test_found_document_expands_to_question_relevant_sibling_chunks(self):
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
            siblings = main._fetch_document_sibling_candidates(
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

    def test_found_guideline_also_expands_to_question_relevant_sibling_chunks(self):
        class Collection:
            def get(self, **_kwargs):
                return {
                    "ids": ["guide-summary", "guide-detail"],
                    "documents": [
                        "Juhendi üldine sissejuhatus.",
                        "Vahetu ohu korral helista 112 ja ära jäta noort üksinda.",
                    ],
                    "metadatas": [
                        {"doc_id": "mental-health-guide", "source_type": "official_guideline", "title": "Vaimse tervise juhend"},
                        {"doc_id": "mental-health-guide", "source_type": "official_guideline", "title": "Vaimse tervise juhend"},
                    ],
                }

        with patch.object(main, "collection", Collection()):
            siblings = main._fetch_document_sibling_candidates(
                "Vahetu ohu korral helista 112 ja ära jäta noort üksinda",
                None,
                [{"id": "guide-summary", "doc_id": "mental-health-guide", "source_type": "official_guideline"}],
                12,
                ["title_match", "exact_phrase", "bm25"],
            )

        self.assertTrue(siblings)
        self.assertEqual(siblings[0]["id"], "guide-detail")

    def test_compound_guideline_query_lexically_recovers_each_segment_inside_document(self):
        class Collection:
            def get(self, **_kwargs):
                metadata = {"doc_id": "school-guide", "source_type": "official_guideline", "title": "Kooli tugijuhend"}
                return {
                    "ids": ["reduce", "replace", "exempt"],
                    "documents": [
                        "Õpitulemuste vähendamine eeldab järjepidevat individuaalset tuge.",
                        "Õpitulemuste asendamine toimub ühe õppeaine raames.",
                        "Õppeainest vabastamine on äärmuslik sekkumine.",
                    ],
                    "metadatas": [metadata, metadata, metadata],
                }

        with patch.object(main, "collection", Collection()):
            candidates = main._fetch_fact_segment_candidates(
                [],
                ["õpitulemuste vähendamine", "asendamine ühe õppeaine raames", "vabastamine äärmuslik sekkumine"],
                None,
                [{"id": "reduce", "doc_id": "school-guide", "source_type": "official_guideline"}],
                {},
                is_general_search=True,
                per_document=8,
            )

        self.assertEqual({item["id"] for item in candidates}, {"reduce", "replace", "exempt"})
        self.assertTrue(all(item.get("fact_segment_hits") for item in candidates))

    def test_fact_segment_recovery_keeps_adjacent_chunks_at_split_boundary(self):
        class Collection:
            def get(self, **_kwargs):
                rows = [
                    ("before", 7, "Koolituste arv oli 95."),
                    ("match", 8, "Hooldustöötajate keskmine palk tõusis 16%."),
                    ("after", 9, "Nõude täitis 68% hooldekodudest."),
                ]
                return {
                    "ids": [row[0] for row in rows],
                    "documents": [row[2] for row in rows],
                    "metadatas": [{
                        "doc_id": "oska-report",
                        "chunk_index": row[1],
                        "source_type": "research_report",
                    } for row in rows],
                }

        with patch.object(main, "collection", Collection()):
            candidates = main._fetch_fact_segment_candidates(
                [],
                ["hooldustöötajate keskmine palk"],
                None,
                [{"id": "match", "doc_id": "oska-report", "source_type": "research_report"}],
                {},
                is_general_search=True,
                per_document=8,
            )

        self.assertEqual({item["id"] for item in candidates}, {"before", "match", "after"})
        self.assertFalse(next(item for item in candidates if item["id"] == "match").get("fact_neighbor", False))
        self.assertIn(
            "0",
            next(item for item in candidates if item["id"] == "after").get("fact_adjacent_to_best_segments", []),
        )
        self.assertTrue(next(item for item in candidates if item["id"] == "after").get("fact_neighbor"))

    def test_global_and_fact_segment_dense_ranks_keep_separate_provenance(self):
        results = [{
            "id": "target",
            "doc_id": "care-home-2017",
            "retrieval_channels": ["dense"],
            "dense_rank": 177,
            "global_dense_rank": 177,
        }]
        candidates = [{
            "id": "target",
            "doc_id": "care-home-2017",
            "retrieval_channels": ["dense"],
            "dense_rank": 1,
            "fact_segment_dense_rank": 1,
            "fact_segment_indexes": [0],
            "fact_segment_ranks": {"0": 1},
            "fact_segment_hits": 1,
            "fact_segment_best_rank": 1,
        }]

        main._merge_fact_segment_candidates(results, candidates)
        main._apply_hybrid_ranking(results)

        self.assertEqual(results[0]["dense_rank"], 177)
        self.assertEqual(results[0]["global_dense_rank"], 177)
        self.assertEqual(results[0]["fact_segment_dense_rank"], 1)
        self.assertEqual(results[0]["retrieval_scores"]["global_dense_rank"], 177)
        self.assertEqual(results[0]["retrieval_scores"]["fact_segment_dense_rank"], 1)

    def test_percentage_shape_intent_counts_requested_facts_but_ignores_plain_years(self):
        self.assertEqual(
            main._expected_percentage_fact_count(
                "Millised kolm osakaalu näitas erihooldekodude elanike kaardistus?"
            ),
            3,
        )
        self.assertEqual(
            main._expected_percentage_fact_count("Mida näitas 2022. aasta uuring?"),
            0,
        )

    def test_current_version_filter_rejects_only_explicit_false_and_keeps_legacy_rows(self):
        requirement = main._requires_current_version({
            "is_current_version": {"$ne": False},
        })

        self.assertTrue(requirement)
        self.assertFalse(main._metadata_matches_current_version_requirement(
            {"is_current_version": False},
            requirement,
        ))
        self.assertTrue(main._metadata_matches_current_version_requirement(
            {"is_current_version": True},
            requirement,
        ))
        self.assertTrue(main._metadata_matches_current_version_requirement({}, requirement))

    def test_sibling_ranking_ignores_repeated_description_and_scores_real_body(self):
        repeated_prefix = (
            "[TITLE] Eakate abivajaduse uuring\n"
            "[DESC] Kokkuvõte ütleb kõigi lõikude ees, et 61% vajas lisaabi.\n"
            "[AUTHORS] Mari Näide\n"
            "[YEAR] 2023\n"
            "[STATUS] active\n"
        )
        scored = main._score_lexical_rows(
            "Kui paljud eakad vajasid uuringus lisaabi?",
            {"title_match", "exact_phrase", "bm25"},
            ["background", "actual-evidence"],
            [
                repeated_prefix + "See lõik kirjeldab uuringu valimit ja meetodit.",
                repeated_prefix + "Abi ebapiisavust kogenutest 61% vajas igapäevaseks toimetulekuks lisaabi.",
            ],
            [
                {"doc_id": "survey", "title": "Eakate abivajaduse uuring"},
                {"doc_id": "survey", "title": "Eakate abivajaduse uuring"},
            ],
            body_only=True,
        )

        self.assertTrue(scored)
        self.assertEqual(scored[0]["id"], "actual-evidence")
        self.assertIn("61%", main._strip_synthetic_rag_prefix(scored[0]["document"]))


if __name__ == "__main__":
    unittest.main()
