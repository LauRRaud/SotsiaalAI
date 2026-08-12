import atexit
import json
import os
import shutil
import tempfile
import unittest
from unittest.mock import patch

os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("RAG_SERVICE_API_KEY", "test-rag-service-key-32-characters-minimum")
_TEST_STORAGE = tempfile.mkdtemp(prefix="rag-ops-views-")
os.environ.setdefault("RAG_STORAGE_DIR", _TEST_STORAGE)
atexit.register(shutil.rmtree, _TEST_STORAGE, ignore_errors=True)

from rag_test_stubs import install_chromadb_stub_if_missing

install_chromadb_stub_if_missing()
import main


REGISTRY = {
    "doc": {
        "title": "Visible title",
        "path": "C:/private/rag/storage/docs/secret.pdf",
        "source_path": "C:/private/source/secret.pdf",
        "activeVersion": "v1",
        "lifecycleState": "ACTIVE",
    }
}


class BrokenCollection:
    def count(self):
        raise RuntimeError("chroma count failed")

    def get(self, **_kwargs):
        raise RuntimeError("chroma get failed")


class OperationalViewTests(unittest.TestCase):
    def test_health_is_503_degraded_without_internal_configuration(self):
        with patch.object(main, "_load_registry", return_value=REGISTRY), patch.object(main, "collection", BrokenCollection()):
            response = main.health()
        self.assertEqual(response.status_code, 503)
        payload = json.loads(response.body)
        self.assertFalse(payload["ok"])
        self.assertEqual(payload["error"]["code"], "VECTOR_STORE_UNAVAILABLE")
        serialized = json.dumps(payload)
        for forbidden in ("storage_dir", "embed_model", "collection", "allowed_mime"):
            self.assertNotIn(forbidden, serialized)

    def test_document_list_and_detail_are_degraded_not_completed_and_hide_paths(self):
        with patch.object(main, "_load_registry", return_value=REGISTRY), patch.object(main, "collection", BrokenCollection()):
            listing = main.documents()
            detail = main.get_document("doc")

        self.assertEqual(listing[0]["status"], "DEGRADED")
        self.assertIsNone(listing[0]["chunks"])
        self.assertEqual(detail["status"], "DEGRADED")
        self.assertIsNone(detail["chunks"])
        self.assertEqual(detail["error"]["code"], "VECTOR_STORE_UNAVAILABLE")
        for payload in (listing[0], detail):
            self.assertNotIn("path", payload)
            self.assertNotIn("source_path", payload)
            self.assertNotIn("C:/private", json.dumps(payload))


if __name__ == "__main__":
    unittest.main()
