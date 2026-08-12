import atexit
import base64
import os
import shutil
import tempfile
import unittest
from unittest.mock import patch

os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("RAG_SERVICE_API_KEY", "test-rag-service-key-32-characters-minimum")
_TEST_STORAGE = tempfile.mkdtemp(prefix="rag-api-input-")
os.environ.setdefault("RAG_STORAGE_DIR", _TEST_STORAGE)
atexit.register(shutil.rmtree, _TEST_STORAGE, ignore_errors=True)

from fastapi.testclient import TestClient
from rag_test_stubs import install_chromadb_stub_if_missing

install_chromadb_stub_if_missing()
import main


class ApiInputContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app)
        cls.headers = {"X-API-Key": os.environ["RAG_SERVICE_API_KEY"]}

    def test_base64_empty_padding_characters_and_null_only_fail_before_worker(self):
        cases = [
            ("", "FILE_EMPTY"),
            ("abc", "BASE64_INVALID"),
            ("@@@@", "BASE64_INVALID"),
            (base64.b64encode(b"\x00\x00\x00").decode("ascii"), "FILE_EMPTY"),
        ]
        with patch.object(main, "_process_ingest_file") as worker:
            for encoded, code in cases:
                with self.subTest(code=code, encoded=encoded):
                    response = self.client.post(
                        "/ingest/file",
                        headers=self.headers,
                        json={"docId": "existing-doc", "fileName": "file.txt", "data": encoded},
                    )
                    self.assertEqual(response.status_code, 400, response.text)
                    self.assertEqual(response.json()["detail"]["code"], code)
        worker.assert_not_called()

    def test_validation_errors_are_route_and_field_specific_without_body_echo(self):
        cases = [
            ("/search", {}, "SEARCH_VALIDATION_ERROR", "query"),
            ("/search/agent-documents", {"query": "x"}, "AGENT_SEARCH_VALIDATION_ERROR", "doc_ids"),
            ("/ingest/text", {}, "INGEST_TEXT_VALIDATION_ERROR", "doc_id"),
            ("/documents/doc/patch-meta", {"metadata": []}, "DOCUMENT_VALIDATION_ERROR", "metadata"),
            ("/upload", {}, "UPLOAD_VALIDATION_ERROR", "file"),
        ]
        for path, body, code, field in cases:
            with self.subTest(path=path):
                response = self.client.post(path, headers=self.headers, json=body)
                self.assertEqual(response.status_code, 422, response.text)
                payload = response.json()
                self.assertEqual(payload["code"], code)
                self.assertEqual(payload["route"], path)
                self.assertIn(field, [error["field"] for error in payload["errors"]])
                serialized = response.text
                self.assertNotIn("Upload endpoint expects", serialized)


if __name__ == "__main__":
    unittest.main()
