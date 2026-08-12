import atexit
import json
import logging
import os
import shutil
import tempfile
import unittest
from unittest.mock import patch

os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("RAG_ALLOW_INSECURE_NO_AUTH", "1")
os.environ.setdefault("RAG_BIND_HOST", "127.0.0.1")
_TEST_STORAGE = tempfile.mkdtemp(prefix="sotsiaalai-rag-b0b-")
os.environ.setdefault("RAG_STORAGE_DIR", _TEST_STORAGE)
atexit.register(shutil.rmtree, _TEST_STORAGE, ignore_errors=True)

from starlette.requests import Request

from rag_test_stubs import install_chromadb_stub_if_missing

install_chromadb_stub_if_missing()
import main


def make_request(headers=None, path="/search"):
    raw_headers = [
        (str(key).lower().encode("latin-1"), str(value).encode("latin-1"))
        for key, value in (headers or {}).items()
    ]
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": path,
            "root_path": "",
            "scheme": "http",
            "server": ("testserver", 80),
            "client": ("testclient", 1234),
            "headers": raw_headers,
            "query_string": b"",
        }
    )


def embedding_result(values=None):
    return {
        "embeddings": [[0.1, 0.2]] if values is None else values,
        "model": "test-embedding",
        "latency_ms": 3,
        "embedding_input_count": 1,
    }


def chroma_result(ids=None):
    ids = ["chunk-a", "chunk-b"] if ids is None else ids
    metadata = [
        {
            "doc_id": f"doc-{index}",
            "title": f"Title {index}",
            "source_id": f"source-{index}",
            "source_type": "official_guideline",
            "collection_id": "national_guidelines",
        }
        for index, _ in enumerate(ids)
    ]
    return {
        "ids": [ids],
        "documents": [[f"document-{index}" for index, _ in enumerate(ids)]],
        "metadatas": [metadata],
        "distances": [[0.1 + index for index, _ in enumerate(ids)]],
    }


class FakeCollection:
    def __init__(self, result=None, error=None):
        self.result = result if result is not None else chroma_result()
        self.error = error
        self.calls = []

    def query(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return self.result

    def get(self, **_kwargs):
        return {"ids": [], "documents": [], "metadatas": []}


def stage_records(log_records):
    return [
        json.loads(record.getMessage().split(" ", 1)[1])
        for record in log_records
        if record.getMessage().startswith("rag.search.stage ")
    ]


class SearchObservabilityTests(unittest.TestCase):
    def run_search(self, payload, *, headers=None, collection=None, embed=None):
        embed = embedding_result() if embed is None else embed
        collection = FakeCollection() if collection is None else collection
        with patch.object(main, "collection", collection), patch.object(
            main, "_embed_batch_with_usage", return_value=embed
        ):
            return main._execute_search(payload, make_request(headers), agent_document_ids=None)

    def test_successful_search_returns_complete_timings_and_preserves_order(self):
        result = self.run_search(main.SearchIn(query="private query", top_k=2))

        self.assertEqual([item["id"] for item in result["results"]], ["chunk-a", "chunk-b"])
        self.assertEqual(result["request_id"].startswith("rag-"), True)
        self.assertEqual(result["timings"]["outcome"], "ok")
        self.assertIsInstance(result["timings"]["embedding_ms"], int)
        self.assertIsInstance(result["timings"]["retrieval_ms"], int)
        self.assertIsInstance(result["timings"]["total_ms"], int)

    def test_successful_empty_search_returns_complete_timings(self):
        result = self.run_search(
            main.SearchIn(query="no matches"),
            collection=FakeCollection(chroma_result([])),
        )

        self.assertEqual(result["results"], [])
        self.assertEqual(result["timings"]["outcome"], "ok")
        self.assertIsInstance(result["timings"]["retrieval_ms"], int)

    def test_empty_embedding_returns_no_embedding_timings(self):
        result = self.run_search(main.SearchIn(query="empty embedding"), embed=embedding_result([]))

        self.assertEqual(result["timings"]["outcome"], "no_embedding")
        self.assertIsNone(result["timings"]["retrieval_ms"])

    def test_success_logs_exactly_three_info_events_through_stage_logger(self):
        with patch.object(main.logger, "warning") as main_warning, patch.object(
            main.logger, "info"
        ) as main_info:
            with self.assertLogs(main.stage_logger, level="INFO") as captured:
                self.run_search(main.SearchIn(query="private query", top_k=2))

        records = stage_records(captured.records)
        self.assertEqual(
            [(item["stage"], item["outcome"]) for item in records],
            [("embedding", "ok"), ("retrieval", "ok"), ("search_total", "ok")],
        )
        self.assertEqual(len(records), 3)
        self.assertTrue(all(record.levelno == logging.INFO for record in captured.records))
        main_warning.assert_not_called()
        self.assertFalse(
            any(call.args and call.args[0] == "rag.search.stage" for call in main_info.call_args_list)
        )
        self.assertEqual(main.stage_logger.name, "uvicorn.error.rag_stage")
        self.assertTrue(main.stage_logger.propagate)
        self.assertEqual(main.stage_logger.handlers, [])

    def test_embedding_error_logs_error_and_reraises(self):
        error = main.HTTPException(status_code=503, detail="embedding failed")
        with self.assertLogs(main.stage_logger, level="INFO") as captured:
            with patch.object(main, "_embed_batch_with_usage", side_effect=error):
                with self.assertRaises(main.HTTPException) as raised:
                    main._execute_search(main.SearchIn(query="private query"), make_request())

        self.assertIs(raised.exception, error)
        records = stage_records(captured.records)
        self.assertEqual([(item["stage"], item["outcome"]) for item in records], [
            ("embedding", "error"),
            ("search_total", "error"),
        ])
        self.assertEqual(records[0]["error_class"], "HTTPException")
        self.assertNotIn("embedding failed", captured.output[0])

    def test_chroma_error_is_structured_503_not_an_empty_success(self):
        with self.assertLogs(main.stage_logger, level="INFO") as captured:
            with self.assertRaises(main.HTTPException) as raised:
                self.run_search(
                    main.SearchIn(query="retrieval failure"),
                    collection=FakeCollection(error=RuntimeError("chroma private response")),
                )

        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(raised.exception.detail["code"], "RAG_RETRIEVAL_UNAVAILABLE")
        self.assertEqual(raised.exception.detail["timings"]["outcome"], "query_failed")
        self.assertNotIn("chroma private response", str(raised.exception.detail))
        records = stage_records(captured.records)
        self.assertEqual(
            [(item["stage"], item["outcome"]) for item in records],
            [("embedding", "ok"), ("retrieval", "query_failed"), ("search_total", "query_failed")],
        )

    def test_request_id_prefers_payload_then_header_then_generated(self):
        payload_result = self.run_search(
            main.SearchIn(query="id", request_id="payload-id"),
            headers={"X-Request-Id": "header-id"},
            embed=embedding_result([]),
        )
        header_result = self.run_search(
            main.SearchIn(query="id"),
            headers={"X-Request-Id": "header-id"},
            embed=embedding_result([]),
        )
        generated_result = self.run_search(main.SearchIn(query="id"), embed=embedding_result([]))

        self.assertEqual(payload_result["request_id"], "payload-id")
        self.assertEqual(header_result["request_id"], "header-id")
        self.assertRegex(generated_result["request_id"], r"^rag-[0-9a-f]+$")

    def test_success_logs_embedding_retrieval_and_total_without_content(self):
        query = "PRIVATE QUERY TEXT"
        source_content = "PRIVATE SOURCE CONTENT"
        with self.assertLogs(main.stage_logger, level="INFO") as captured:
            result = self.run_search(
                main.SearchIn(query=query),
                headers={"X-Observability-Stage": "rag_search_graph_channel"},
                collection=FakeCollection(
                    {
                        **chroma_result(["private-chunk"]),
                        "documents": [[source_content]],
                        "metadatas": [[{
                            "doc_id": "private-doc",
                            "title": "PRIVATE SOURCE TITLE",
                            "source_id": "private-source-id",
                            "source_type": "official_guideline",
                            "collection_id": "national_guidelines",
                        }]],
                    }
                ),
            )

        records = stage_records(captured.records)
        self.assertEqual([item["stage"] for item in records], ["embedding", "retrieval", "search_total"])
        self.assertTrue(all(item["outcome"] == "ok" for item in records))
        self.assertTrue(all("request_id" in item for item in records))
        serialized = "\n".join(captured.output)
        for secret in (query, source_content, "private-source-id", "PRIVATE SOURCE TITLE"):
            self.assertNotIn(secret, serialized)
        self.assertEqual(result["request_id"], records[-1]["request_id"])

    def test_hybrid_results_are_ranked_then_limited_to_top_k(self):
        dense = chroma_result([f"dense-{index}" for index in range(60)])
        for top_k in (1, 5, 20, 50):
            with self.subTest(top_k=top_k):
                result = self.run_search(
                    main.SearchIn(query="private query", top_k=top_k),
                    collection=FakeCollection(dense),
                )
                self.assertEqual(len(result["results"]), top_k)
                self.assertEqual(result["channel_stats"]["result_count"], top_k)

    def test_lexical_scan_pages_and_exposes_the_completeness_contract(self):
        class PagedCollection:
            def __init__(self):
                self.offsets = []

            def get(self, **kwargs):
                offset = kwargs["offset"]
                limit = kwargs["limit"]
                self.offsets.append(offset)
                ids = [f"id-{index}" for index in range(offset, min(offset + limit, 5))]
                return {
                    "ids": ids,
                    "documents": ["needle"] * len(ids),
                    "metadatas": [{} for _ in ids],
                }

        paged = PagedCollection()
        with patch.object(main, "collection", paged), patch.object(main, "RAG_LEXICAL_SCAN_LIMIT", 2), patch.object(
            main, "RAG_LEXICAL_MAX_SCAN", 10
        ), patch.object(main, "_lexical_match", return_value={
            "channels": ["bm25"], "score": 1, "bm25_score": 1,
            "bm25_coverage": 1, "bm25_matches": 1,
            "bm25_title_matches": 0, "bm25_body_matches": 1,
            "bm25_query_tokens": 1,
        }):
            fetched = main._fetch_lexical_candidates("needle", None, 2, ["bm25"])

        self.assertEqual(paged.offsets, [0, 2, 4])
        self.assertEqual(fetched["scanned"], 5)
        self.assertTrue(fetched["complete"])
        self.assertEqual(len(fetched["candidates"]), 2)

    def test_agent_document_search_forwards_payload_request_id_to_searchin(self):
        payload = main.AgentDocumentSearchIn(
            query="agent query",
            doc_ids=["doc-a"],
            request_id="agent-payload-id",
        )
        with patch.object(main, "_execute_search", return_value={}) as execute:
            main.search_agent_documents(payload, make_request({"X-Request-Id": "agent-header-id"}))

        forwarded_payload = execute.call_args.args[0]
        self.assertEqual(forwarded_payload.request_id, "agent-payload-id")
        self.assertEqual(execute.call_args.kwargs["agent_document_ids"], ["doc-a"])


if __name__ == "__main__":
    unittest.main()
