import atexit
import os
import shutil
import tempfile
import unittest
from unittest.mock import patch

os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("RAG_SERVICE_API_KEY", "test-rag-service-key-32-characters-minimum")
_TEST_STORAGE = tempfile.mkdtemp(prefix="rag-article-batch-")
os.environ.setdefault("RAG_STORAGE_DIR", _TEST_STORAGE)
atexit.register(shutil.rmtree, _TEST_STORAGE, ignore_errors=True)

from rag_test_stubs import install_chromadb_stub_if_missing

install_chromadb_stub_if_missing()
import main


def embeddings(texts):
    return {"embeddings": [[float(index)] for index, _ in enumerate(texts)]}


class ArticleBatchIdentityTests(unittest.TestCase):
    def test_same_text_different_article_ids_get_distinct_server_ids(self):
        pages = [(1, "same article text"), (2, "same article text")]
        articles = [
            main.IngestArticle(title="A", articleId="article-a", startPage=1, endPage=1),
            main.IngestArticle(title="B", articleId="article-b", startPage=2, endPage=2),
        ]
        with patch.object(main, "_embed_batch_with_usage", side_effect=lambda texts: embeddings(texts)):
            payload, manifest = main._build_articles_batch_payload("doc", {}, pages, articles)

        self.assertEqual(len(payload["ids"]), 2)
        self.assertEqual(len(set(payload["ids"])), 2)
        self.assertIn(":article:article-a:", payload["ids"][0])
        self.assertIn(":article:article-b:", payload["ids"][1])
        self.assertEqual([item["articleId"] for item in manifest], ["article-a", "article-b"])

    def test_second_article_build_failure_occurs_before_any_stage_upsert(self):
        pages = [(1, "first"), (2, "second")]
        articles = [
            main.IngestArticle(title="A", articleId="a", startPage=1, endPage=1),
            main.IngestArticle(title="B", articleId="b", startPage=2, endPage=2),
        ]
        with patch.object(main, "_build_ingest_payload", side_effect=[
            {"count": 1, "documents": ["first"], "metadatas": [{}], "ids": ["old"], "embeddings": [[1.0]]},
            RuntimeError("second article failed"),
        ]), patch.object(main.collection, "upsert", create=True) as upsert:
            with self.assertRaisesRegex(RuntimeError, "second article failed"):
                main._build_articles_batch_payload("doc", {}, pages, articles)
        upsert.assert_not_called()

    def test_client_chunk_id_is_metadata_only_and_two_documents_cannot_collide(self):
        chunk = main.IngestTextChunk(text="same", metadata={"chunk_id": "shared-client-id"})
        with patch.object(main, "_embed_batch_with_usage", side_effect=lambda texts: embeddings(texts)):
            first = main._build_explicit_chunk_payload("doc-a", [chunk], {})
            second = main._build_explicit_chunk_payload("doc-b", [chunk], {})

        self.assertNotEqual(first["ids"][0], second["ids"][0])
        self.assertTrue(first["ids"][0].startswith("doc-a:chunk:"))
        self.assertTrue(second["ids"][0].startswith("doc-b:chunk:"))
        self.assertEqual(first["metadatas"][0]["client_chunk_id"], "shared-client-id")
        self.assertEqual(second["metadatas"][0]["client_chunk_id"], "shared-client-id")

    def test_duplicate_article_identity_is_a_conflict_before_embedding_second_copy(self):
        pages = [(1, "one"), (2, "two")]
        articles = [
            main.IngestArticle(title="A", articleId="duplicate", startPage=1, endPage=1),
            main.IngestArticle(title="B", articleId="duplicate", startPage=2, endPage=2),
        ]
        with patch.object(main, "_embed_batch_with_usage", side_effect=lambda texts: embeddings(texts)):
            with self.assertRaises(main.HTTPException) as raised:
                main._build_articles_batch_payload("doc", {}, pages, articles)
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(raised.exception.detail["code"], "DUPLICATE_ARTICLE_ID")


if __name__ == "__main__":
    unittest.main()
