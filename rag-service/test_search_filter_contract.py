import atexit
import os
import shutil
import tempfile
import unittest
from unittest.mock import patch

os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("RAG_SERVICE_API_KEY", "test-rag-service-key-32-characters-minimum")
_TEST_STORAGE = tempfile.mkdtemp(prefix="rag-search-filter-")
os.environ.setdefault("RAG_STORAGE_DIR", _TEST_STORAGE)
atexit.register(shutil.rmtree, _TEST_STORAGE, ignore_errors=True)

from starlette.requests import Request
from rag_test_stubs import install_chromadb_stub_if_missing

install_chromadb_stub_if_missing()
import main


def request():
    return Request({
        "type": "http", "method": "POST", "path": "/search", "root_path": "",
        "scheme": "http", "server": ("test", 80), "client": ("test", 1),
        "headers": [], "query_string": b"",
    })


def or_groups(where):
    if not isinstance(where, dict):
        return []
    groups = [where["$or"]] if "$or" in where else []
    for value in where.values():
        if isinstance(value, dict):
            groups.extend(or_groups(value))
        elif isinstance(value, list):
            for item in value:
                groups.extend(or_groups(item))
    return groups


class SearchFilterContractTests(unittest.TestCase):
    def test_ingest_writes_normalized_author_and_tag_slots_with_diacritics(self):
        with patch.object(main, "_embed_batch_with_usage", return_value={"embeddings": [[1.0]]}):
            payload = main._build_ingest_payload(
                "doc",
                "content",
                {"authors": ["Jüri Öö", "Mari Mägi"], "tags": ["Laste kaitse", "Töövõime"]},
            )
        metadata = payload["metadatas"][0]
        self.assertEqual(metadata["author_token_1"], "juri oo")
        self.assertEqual(metadata["author_token_2"], "mari magi")
        self.assertEqual(metadata["tag_token_1"], "laste")
        self.assertEqual(metadata["tag_token_2"], "kaitse")
        self.assertIn("toovoime", [metadata.get(f"tag_token_{index}") for index in range(1, 9)])

    def test_user_or_author_and_tag_groups_survive_and_dense_lexical_share_where(self):
        class Collection:
            def __init__(self):
                self.query_where = None
                self.get_where = None

            def query(self, **kwargs):
                self.query_where = kwargs["where"]
                return {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]}

            def get(self, **kwargs):
                self.get_where = kwargs.get("where")
                return {"ids": [], "documents": [], "metadatas": []}

        collection = Collection()
        payload = main.SearchIn(
            query="needle",
            top_k=5,
            retrievers=["dense", "bm25"],
            where={
                "$or": [{"country": "EE"}, {"country": "FI"}],
                "authors": {"$in": ["Jüri Öö"]},
                "tags": {"$in": ["Laste kaitse"]},
            },
        )
        with patch.object(main, "collection", collection), patch.object(
            main, "_embed_batch_with_usage", return_value={"embeddings": [[1.0]]}
        ), patch.object(main, "_load_registry", return_value={}):
            main._execute_search(payload, request())

        self.assertEqual(collection.query_where, collection.get_where)
        groups = or_groups(collection.query_where)
        self.assertGreaterEqual(len(groups), 3)
        serialized = str(collection.query_where)
        self.assertIn("author_token_1", serialized)
        self.assertIn("juri oo", serialized)
        self.assertIn("tag_token_1", serialized)
        self.assertIn("laste", serialized)
        self.assertIn("country", serialized)


if __name__ == "__main__":
    unittest.main()
