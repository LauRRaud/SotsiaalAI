"""SOL-RAGSVC-03 — every protected HTTP surface rejects a missing/wrong key."""

import atexit
import os
import shutil
import tempfile
import unittest
from unittest.mock import patch


os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ["RAG_SERVICE_API_KEY"] = "test-rag-service-key-32-characters-minimum"
_TEST_STORAGE = tempfile.mkdtemp(prefix="sotsiaalai-rag-auth-")
os.environ.setdefault("RAG_STORAGE_DIR", _TEST_STORAGE)
atexit.register(shutil.rmtree, _TEST_STORAGE, ignore_errors=True)

from fastapi.testclient import TestClient

from rag_test_stubs import install_chromadb_stub_if_missing

install_chromadb_stub_if_missing()
import main


EXPECTED_PROTECTED_ROUTES = {
    ("POST", "/analyze"),
    ("POST", "/ingest/file"),
    ("POST", "/ingest/text"),
    ("POST", "/upload"),
    ("POST", "/ingest/pdf-with-metadata"),
    ("POST", "/ingest/url"),
    ("POST", "/ingest/articles"),
    ("POST", "/ingest/articles/{doc_id}"),
    ("GET", "/documents"),
    ("GET", "/documents/{doc_id}"),
    ("GET", "/documents/{doc_id}/chunks"),
    ("GET", "/documents/{doc_id}/source"),
    ("POST", "/documents/{doc_id}/reindex"),
    ("POST", "/documents/{doc_id}/update-meta"),
    ("POST", "/documents/{doc_id}/patch-meta"),
    ("DELETE", "/documents/{doc_id}"),
    ("POST", "/search"),
    ("POST", "/search/agent-documents"),
}


def protected_routes():
    found = set()
    for route in main.app.routes:
        dependant = getattr(route, "dependant", None)
        if dependant is None:
            continue
        if not any(dep.call is main._require_key for dep in dependant.dependencies):
            continue
        for method in route.methods:
            if method not in {"HEAD", "OPTIONS"}:
                found.add((method, route.path))
    return found


class EndpointAuthTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app)

    def test_route_inventory_is_explicit_and_complete(self):
        self.assertEqual(protected_routes(), EXPECTED_PROTECTED_ROUTES)

    def test_search_query_limit_rejects_before_embedding(self):
        key = {"X-API-Key": os.environ["RAG_SERVICE_API_KEY"]}
        with patch.object(main, "_embed_batch") as embed:
            response = self.client.post(
                "/search",
                headers=key,
                json={"query": "x" * (main.MAX_QUERY_CHARS + 1)},
            )
        self.assertEqual(response.status_code, 422, response.text)
        embed.assert_not_called()

    def test_asgi_declared_body_limit_rejects_before_route(self):
        key = {
            "X-API-Key": os.environ["RAG_SERVICE_API_KEY"],
            "Content-Length": str(main.MAX_REQUEST_BYTES + 1),
            "Content-Type": "application/json",
        }
        response = self.client.post("/search", headers=key, content=b"{}")
        self.assertEqual(response.status_code, 413, response.text)
        self.assertEqual(response.json()["detail"]["code"], "RAG_REQUEST_TOO_LARGE")

    def test_every_protected_route_returns_401_for_missing_and_wrong_key(self):
        for method, path_template in sorted(EXPECTED_PROTECTED_ROUTES):
            path = path_template.replace("{doc_id}", "auth-test-doc")
            for headers in ({}, {"X-API-Key": "wrong-key"}):
                with self.subTest(method=method, path=path, headers=headers):
                    response = self.client.request(method, path, headers=headers, json={})
                    self.assertEqual(response.status_code, 401, response.text)

    def test_corrupt_registry_makes_health_red_and_blocks_list_ingest_and_delete(self):
        registry_path = main.REGISTRY_STORE.path
        original = registry_path.read_bytes() if registry_path.exists() else None
        registry_path.write_text('{"old-doc": ', encoding="utf-8")
        calls = []

        class Collection:
            def delete(self, **kwargs):
                calls.append(("delete", kwargs))

            def upsert(self, **kwargs):
                calls.append(("upsert", kwargs))

        key = {"X-API-Key": os.environ["RAG_SERVICE_API_KEY"]}
        try:
            with patch.object(main, "collection", Collection()):
                health = self.client.get("/health")
                listing = self.client.get("/documents", headers=key)
                ingest = self.client.post(
                    "/ingest/text",
                    headers=key,
                    json={"doc_id": "new-doc", "text": "must not be embedded"},
                )
                deletion = self.client.delete("/documents/old-doc", headers=key)
        finally:
            if original is None:
                registry_path.unlink(missing_ok=True)
            else:
                registry_path.write_bytes(original)

        for response in (health, listing, ingest, deletion):
            self.assertEqual(response.status_code, 503, response.text)
            self.assertEqual(response.json()["error"]["code"], "REGISTRY_CORRUPT")
        self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main()
