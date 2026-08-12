"""SOL-RAGSVC-05/06 — fail-closed, process-safe JSON registry."""

import json
import multiprocessing
from pathlib import Path
import tempfile
import unittest

from registry_store import RegistryCorruptError, RegistryStore


def _worker(path, worker_id):
    store = RegistryStore(Path(path))
    for index in range(25):
        doc_id = f"w{worker_id}-{index}"
        store.upsert(doc_id, {"title": doc_id}, updated_at=f"u-{worker_id}-{index}")
    for index in range(25):
        doc_id = f"w{worker_id}-{index}"
        store.patch(doc_id, {"worker": worker_id}, updated_at=f"p-{worker_id}-{index}")
    for index in range(5):
        store.pop(f"w{worker_id}-{index}")


class RegistryStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="sotsiaalai-rag-registry-")
        self.path = Path(self.temp.name) / "registry.json"
        self.store = RegistryStore(self.path)

    def tearDown(self):
        self.temp.cleanup()

    def test_corrupt_existing_registry_is_never_treated_as_empty_or_overwritten(self):
        self.store.upsert("old-doc", {"title": "old"}, updated_at="v1")
        self.assertTrue(self.store.backup_path.exists())
        last_good = self.store.backup_path.read_bytes()

        corrupt = b'{"old-doc": '
        self.path.write_bytes(corrupt)
        with self.assertRaises(RegistryCorruptError):
            self.store.load()
        with self.assertRaises(RegistryCorruptError):
            self.store.upsert("new-doc", {"title": "new"}, updated_at="v2")
        with self.assertRaises(RegistryCorruptError):
            self.store.pop("old-doc")

        self.assertEqual(self.path.read_bytes(), corrupt)
        self.assertEqual(self.store.backup_path.read_bytes(), last_good)

    def test_invalid_registry_shape_fails_closed(self):
        for invalid in ([], {"doc": "not-an-object"}, {"doc": {"docId": "other"}}):
            with self.subTest(invalid=invalid):
                self.path.write_text(json.dumps(invalid), encoding="utf-8")
                with self.assertRaises(RegistryCorruptError):
                    self.store.load()

    def test_four_processes_preserve_register_patch_and_delete_updates(self):
        processes = [multiprocessing.Process(target=_worker, args=(str(self.path), worker)) for worker in range(4)]
        for process in processes:
            process.start()
        for process in processes:
            process.join(timeout=30)
            self.assertEqual(process.exitcode, 0)

        registry = self.store.load()
        self.assertEqual(len(registry), 80)
        for worker in range(4):
            for index in range(5, 25):
                row = registry[f"w{worker}-{index}"]
                self.assertEqual(row["worker"], worker)
                self.assertEqual(row["docId"], f"w{worker}-{index}")

    def test_atomic_writes_leave_no_shared_orphan_temp_file(self):
        self.store.upsert("doc", {"title": "one"}, updated_at="v1")
        self.store.patch("doc", {"title": "two"}, updated_at="v2")
        leftovers = [item.name for item in self.path.parent.iterdir() if ".tmp-" in item.name]
        self.assertEqual(leftovers, [])


if __name__ == "__main__":
    unittest.main()
