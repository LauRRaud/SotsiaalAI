import atexit
import os
import shutil
import tempfile
import unittest
from unittest.mock import patch

os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("RAG_SERVICE_API_KEY", "test-rag-service-key-32-characters-minimum")
_TEST_STORAGE = tempfile.mkdtemp(prefix="rag-chunk-integrity-")
os.environ.setdefault("RAG_STORAGE_DIR", _TEST_STORAGE)
atexit.register(shutil.rmtree, _TEST_STORAGE, ignore_errors=True)

from rag_test_stubs import install_chromadb_stub_if_missing

install_chromadb_stub_if_missing()
import main


class ChunkIntegrityTests(unittest.TestCase):
    def test_char_splitter_has_no_positive_length_gap_at_sentence_cut(self):
        marker = "UNIQUE-MIDDLE-CONTENT"
        text = ("a" * 62) + ". " + marker + ("b" * 90)
        chunks = main._split_chunks_chars(text, max_chars=100, overlap=10)
        self.assertTrue(any(marker in chunk for chunk in chunks), chunks)

        normalized = main._clean_text(text)
        cursor = 0
        for chunk in chunks:
            found = normalized.find(chunk, max(0, cursor - 10))
            self.assertGreaterEqual(found, 0)
            self.assertLessEqual(found, cursor, f"gap before {chunk!r}")
            cursor = max(cursor, found + len(chunk))
        self.assertEqual(cursor, len(normalized))

    def test_char_splitter_covers_long_text_without_sentence_boundaries(self):
        text = "0123456789" * 40
        chunks = main._split_chunks_chars(text, max_chars=73, overlap=11)
        reconstructed = chunks[0] + "".join(chunk[11:] for chunk in chunks[1:])
        self.assertEqual(reconstructed, text)

    def test_short_three_page_pdf_chunk_carries_all_pages_and_range(self):
        captured = []

        def embed(texts):
            captured.extend(texts)
            return {"embeddings": [[1.0] for _ in texts]}

        with patch.object(main, "CHUNK_MODE", "chars"), patch.object(main, "SINGLE_CHUNK_CHAR_LIMIT", 10_000), patch.object(
            main, "_embed_batch_with_usage", side_effect=embed
        ):
            payload = main._build_ingest_payload(
                "pdf-doc",
                [(1, "first"), (2, "middle"), (3, "LAST-PAGE-NEEDLE")],
                {"mimeType": "application/pdf"},
            )

        self.assertEqual(payload["count"], 1)
        self.assertEqual(payload["metadatas"][0]["pages"], "1, 2, 3")
        self.assertEqual(payload["metadatas"][0]["pageRange"], "1–3")
        self.assertIn("LAST-PAGE-NEEDLE", payload["documents"][0])
        self.assertEqual(captured, payload["documents"])

    def test_empty_extraction_is_422_before_collection_or_registry_change(self):
        with patch.object(main, "stage_document_version") as stage:
            with self.assertRaises(main.HTTPException) as raised:
                main._replace_document_vectors_payload(
                    "existing-doc",
                    {"count": 0, "documents": [], "metadatas": [], "ids": [], "embeddings": []},
                )
        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(raised.exception.detail["code"], "EXTRACTION_EMPTY")
        stage.assert_not_called()

    def test_embedding_input_is_never_silently_shorter_than_stored_document(self):
        original_limit = main.EMBED_MAX_TOKENS_PER_INPUT
        try:
            main.EMBED_MAX_TOKENS_PER_INPUT = 2
            with patch.object(main, "_embed_subbatch_raw") as provider:
                with self.assertRaises(main.HTTPException) as raised:
                    main._embed_batch_with_usage(["keyword-before " + "x" * 100 + " keyword-after"])
            self.assertEqual(raised.exception.status_code, 413)
            self.assertEqual(raised.exception.detail["code"], "EMBEDDING_INPUT_TOO_LARGE")
            provider.assert_not_called()
        finally:
            main.EMBED_MAX_TOKENS_PER_INPUT = original_limit


if __name__ == "__main__":
    unittest.main()
