"""SOL-RAGSVC-07/08 — versioned vector staging and atomic registry activation."""

from pathlib import Path
import tempfile
import unittest

from document_versions import (
    DocumentDeleteError,
    DocumentVersionError,
    delete_document_versioned,
    is_active_document_version,
    patch_document_metadata_consistently,
    stage_document_version,
)
from registry_store import RegistryStore


def payload(doc_id="doc-1"):
    return {
        "count": 2,
        "documents": ["new a", "new b"],
        "metadatas": [{"doc_id": doc_id}, {"doc_id": doc_id}],
        "ids": [f"{doc_id}:0", f"{doc_id}:1"],
        "embeddings": [[0.1], [0.2]],
    }


class FakeCollection:
    def __init__(self, *, get_error=False, upsert_error=False, verify_missing=False, delete_error=False):
        self.rows = {
            "old-0": {"metadata": {"doc_id": "doc-1"}, "document": "old"},
        }
        self.get_error = get_error
        self.upsert_error = upsert_error
        self.verify_missing = verify_missing
        self.delete_error = delete_error

    def get(self, *, where, include=None, limit=None, offset=0):
        if self.get_error:
            raise RuntimeError("get failed")
        rows = []
        for item_id, row in self.rows.items():
            metadata = row["metadata"]
            if "$and" in where:
                matches = all(metadata.get(key) == value for clause in where["$and"] for key, value in clause.items())
            else:
                matches = all(metadata.get(key) == value for key, value in where.items())
            if matches:
                rows.append((item_id, row))
        rows = rows[offset : offset + (limit or len(rows))]
        ids = [item[0] for item in rows]
        if self.verify_missing and any(row[1]["metadata"].get("document_version") for row in rows):
            ids = ids[:-1]
        return {"ids": ids}

    def upsert(self, *, documents, metadatas, ids, embeddings):
        for item_id, document, metadata in zip(ids, documents, metadatas):
            self.rows[item_id] = {"metadata": metadata, "document": document}
        if self.upsert_error:
            raise RuntimeError("partial upsert")

    def delete(self, *, ids=None, where=None):
        if where is not None:
            matching = [item_id for item_id, row in self.rows.items() if all(row["metadata"].get(k) == v for k, v in where.items())]
            if self.delete_error:
                raise RuntimeError("vector delete failed")
            for item_id in matching:
                self.rows.pop(item_id, None)
            return
        if self.delete_error and ids and "old-0" in ids:
            raise RuntimeError("old cleanup failed")
        for item_id in list(ids or []):
            self.rows.pop(item_id, None)


class FailingStore:
    def __init__(self, wrapped):
        self.wrapped = wrapped

    def load(self):
        return self.wrapped.load()

    def upsert(self, *_args, **_kwargs):
        raise RuntimeError("registry commit failed")


class MetadataCollection:
    def __init__(self, fail_update_call=None):
        self.metadatas = {
            "c1": {"doc_id": "doc-1", "title": "old"},
            "c2": {"doc_id": "doc-1", "title": "old"},
        }
        self.update_calls = 0
        self.fail_update_call = fail_update_call

    def get(self, *, where, include=None, limit=None, offset=0):
        ids = [item_id for item_id, metadata in self.metadatas.items() if all(metadata.get(k) == v for k, v in where.items())]
        ids = ids[offset : offset + (limit or len(ids))]
        return {"ids": ids, "metadatas": [dict(self.metadatas[item_id]) for item_id in ids]}

    def update(self, *, ids, metadatas):
        self.update_calls += 1
        for item_id, metadata in zip(ids, metadatas):
            self.metadatas[item_id] = dict(metadata)
        if self.update_calls == self.fail_update_call:
            raise RuntimeError("partial metadata update")


class DocumentVersionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="sotsiaalai-rag-version-")
        self.root = Path(self.temp.name)
        self.store = RegistryStore(self.root / "registry.json")
        self.store.upsert("doc-1", {"title": "old"}, updated_at="old")

    def tearDown(self):
        self.temp.cleanup()

    def test_backup_read_failure_never_deletes_old_vectors(self):
        collection = FakeCollection(get_error=True)
        with self.assertRaises(DocumentVersionError):
            stage_document_version(collection, self.store, self.root / "locks", "doc-1", payload(), "v2")
        self.assertIn("old-0", collection.rows)

    def test_partial_upsert_and_verification_failure_remove_only_staging_rows(self):
        for options in ({"upsert_error": True}, {"verify_missing": True}):
            with self.subTest(options=options):
                collection = FakeCollection(**options)
                with self.assertRaises(DocumentVersionError):
                    stage_document_version(collection, self.store, self.root / "locks", "doc-1", payload(), "v2")
                self.assertEqual(set(collection.rows), {"old-0"})

    def test_registry_commit_failure_keeps_old_active_and_removes_staging(self):
        collection = FakeCollection()
        stage = stage_document_version(collection, FailingStore(self.store), self.root / "locks", "doc-1", payload(), "v2")
        with self.assertRaises(DocumentVersionError):
            stage.commit({"title": "new"}, updated_at="new")
        self.assertEqual(set(collection.rows), {"old-0"})
        self.assertNotIn("activeVersion", self.store.load()["doc-1"])

    def test_success_activates_verified_version_then_removes_old(self):
        collection = FakeCollection()
        stage = stage_document_version(collection, self.store, self.root / "locks", "doc-1", payload(), "v2")
        result = stage.commit({"title": "new"}, updated_at="new")
        entry = self.store.load()["doc-1"]
        self.assertEqual(entry["activeVersion"], "v2")
        self.assertEqual(entry["lifecycleState"], "ACTIVE")
        self.assertEqual(entry["cleanupState"], "CLEAN")
        self.assertNotIn("old-0", collection.rows)
        self.assertEqual(result.count, 2)
        self.assertTrue(all(row["metadata"]["document_version"] == "v2" for row in collection.rows.values()))

    def test_old_cleanup_failure_is_visible_but_active_filter_uses_only_new_version(self):
        collection = FakeCollection(delete_error=True)
        stage = stage_document_version(collection, self.store, self.root / "locks", "doc-1", payload(), "v2")
        stage.commit({"title": "new"}, updated_at="new")
        registry = self.store.load()
        self.assertEqual(registry["doc-1"]["cleanupState"], "PENDING")
        self.assertFalse(is_active_document_version(collection.rows["old-0"]["metadata"], registry))
        new_rows = [row for key, row in collection.rows.items() if key != "old-0"]
        self.assertTrue(all(is_active_document_version(row["metadata"], registry) for row in new_rows))

    def test_main_binds_file_text_url_and_search_to_the_active_version_contract(self):
        source = (Path(__file__).parent / "main.py").read_text(encoding="utf-8")
        self.assertGreaterEqual(source.count("_commit_vector_stage("), 7)
        self.assertGreaterEqual(source.count("_version_source_dir("), 3)
        self.assertGreaterEqual(source.count("is_active_document_version("), 2)
        self.assertIn('"document_version": meta_common.get("document_version")', source)

    def test_delete_failure_keeps_a_retryable_tombstone_and_never_reports_success(self):
        collection = FakeCollection(delete_error=True)
        with self.assertRaises(DocumentDeleteError):
            delete_document_versioned(
                collection,
                self.store,
                self.root / "locks",
                "doc-1",
                updated_at="delete-1",
                delete_source=lambda _entry: None,
            )
        entry = self.store.load()["doc-1"]
        self.assertEqual(entry["lifecycleState"], "DELETE_FAILED")
        self.assertEqual(entry["deleteErrorCode"], "VECTOR_DELETE_FAILED")
        self.assertIn("old-0", collection.rows)

    def test_delete_verifies_vectors_and_source_then_keeps_deleted_tombstone(self):
        collection = FakeCollection()
        source_deleted = []
        result = delete_document_versioned(
            collection,
            self.store,
            self.root / "locks",
            "doc-1",
            updated_at="delete-2",
            delete_source=lambda entry: source_deleted.append(entry["title"]),
        )
        self.assertTrue(result.deleted)
        self.assertEqual(collection.rows, {})
        self.assertEqual(source_deleted, ["old"])
        entry = self.store.load()["doc-1"]
        self.assertEqual(entry["lifecycleState"], "DELETED")
        self.assertEqual(entry["path"], None)
        self.assertFalse(is_active_document_version({"doc_id": "doc-1"}, self.store.load()))

    def test_metadata_update_failure_restores_chunks_and_keeps_registry_old(self):
        collection = MetadataCollection(fail_update_call=1)
        with self.assertRaises(DocumentVersionError):
            patch_document_metadata_consistently(
                collection,
                self.store,
                self.root / "locks",
                "doc-1",
                {"title": "new"},
                updated_at="meta-1",
            )
        self.assertEqual(self.store.load()["doc-1"]["title"], "old")
        self.assertTrue(all(metadata["title"] == "old" for metadata in collection.metadatas.values()))

    def test_metadata_patch_commits_chunks_before_registry_and_returns_paged_count(self):
        collection = MetadataCollection()
        count = patch_document_metadata_consistently(
            collection,
            self.store,
            self.root / "locks",
            "doc-1",
            {"title": "new"},
            updated_at="meta-2",
        )
        self.assertEqual(count, 2)
        self.assertEqual(self.store.load()["doc-1"]["title"], "new")
        self.assertTrue(all(metadata["title"] == "new" for metadata in collection.metadatas.values()))

    def test_nullable_metadata_fields_set_then_clear_from_registry_and_every_chunk(self):
        nullable = {
            "collection_id": "collection",
            "content_hash": "hash",
            "authority": "authority",
            "source_status": "active",
            "last_checked": "2026-08-12",
            "checked_at": "2026-08-12",
            "retrieved_at": "2026-08-12",
            "valid_from": "2026-01-01",
            "valid_to": "2026-12-31",
            "url_canonical": "https://example.test/canonical",
            "url": "https://example.test",
            "source_url": "https://example.test/source",
            "is_current_version": True,
            "historical": False,
            "supersedes_doc_id": "older",
            "jurisdiction_level": "NATIONAL",
            "country": "EE",
            "year": 2026,
        }
        collection = MetadataCollection()
        patch_document_metadata_consistently(
            collection, self.store, self.root / "locks", "doc-1", nullable, updated_at="set"
        )
        patch_document_metadata_consistently(
            collection,
            self.store,
            self.root / "locks",
            "doc-1",
            {},
            clear_fields=set(nullable),
            updated_at="clear",
        )
        entry = self.store.load()["doc-1"]
        for key in nullable:
            self.assertNotIn(key, entry)
            self.assertTrue(all(key not in metadata for metadata in collection.metadatas.values()))

    def test_metadata_clear_chroma_failure_restores_old_values(self):
        self.store.patch("doc-1", {"title": "old"}, updated_at="before-clear")
        collection = MetadataCollection(fail_update_call=1)
        with self.assertRaises(DocumentVersionError):
            patch_document_metadata_consistently(
                collection,
                self.store,
                self.root / "locks",
                "doc-1",
                {},
                clear_fields={"title"},
                updated_at="clear-failed",
            )
        self.assertEqual(self.store.load()["doc-1"]["title"], "old")
        self.assertTrue(all(metadata["title"] == "old" for metadata in collection.metadatas.values()))


if __name__ == "__main__":
    unittest.main()
