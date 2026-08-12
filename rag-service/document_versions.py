"""Versioned Chroma staging with registry-pointer activation."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List

from filelock import FileLock, Timeout


class DocumentVersionError(RuntimeError):
    pass


class DocumentDeleteError(RuntimeError):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def _where_for_version(doc_id: str, version_id: str) -> Dict:
    return {"$and": [{"doc_id": doc_id}, {"document_version": version_id}]}


def _all_ids(collection, where: Dict, page_size: int = 1000) -> List[str]:
    ids: List[str] = []
    offset = 0
    while True:
        result = collection.get(where=where, include=[], limit=page_size, offset=offset)
        page = [str(item) for item in (result.get("ids") or [])]
        ids.extend(page)
        if len(page) < page_size:
            return ids
        offset += len(page)


def _all_metadata_rows(collection, where: Dict, page_size: int = 1000):
    rows = []
    offset = 0
    while True:
        result = collection.get(where=where, include=["metadatas"], limit=page_size, offset=offset)
        ids = [str(item) for item in (result.get("ids") or [])]
        metadatas = list(result.get("metadatas") or [])
        for index, item_id in enumerate(ids):
            metadata = metadatas[index] if index < len(metadatas) and isinstance(metadatas[index], dict) else {}
            rows.append((item_id, dict(metadata)))
        if len(ids) < page_size:
            return rows
        offset += len(ids)


def is_active_document_version(metadata: Dict, registry: Dict[str, Dict]) -> bool:
    doc_id = str(metadata.get("doc_id") or metadata.get("docId") or "").strip()
    if not doc_id:
        return False
    entry = registry.get(doc_id) or {}
    if entry.get("lifecycleState") in {"DELETE_PENDING", "DELETE_FAILED", "DELETED"}:
        return False
    active_version = str(entry.get("activeVersion") or "").strip()
    row_version = str(metadata.get("document_version") or "").strip()
    if active_version:
        return row_version == active_version
    return not row_version


@dataclass(frozen=True)
class DocumentVersionResult:
    count: int
    version_id: str
    previous_entry: Dict
    cleanup_pending: bool


@dataclass(frozen=True)
class DocumentDeleteResult:
    deleted: bool
    had_entry: bool


class DocumentVersionStage:
    def __init__(
        self,
        *,
        collection,
        registry_store,
        lock,
        doc_id: str,
        version_id: str,
        new_ids: List[str],
        old_ids: List[str],
        previous_entry: Dict,
    ):
        self.collection = collection
        self.registry_store = registry_store
        self.lock = lock
        self.doc_id = doc_id
        self.version_id = version_id
        self.new_ids = new_ids
        self.old_ids = old_ids
        self.previous_entry = previous_entry
        self.closed = False

    @property
    def count(self) -> int:
        return len(self.new_ids)

    def _release(self):
        if not self.closed:
            self.closed = True
            self.lock.release()

    def abort(self):
        try:
            self.collection.delete(ids=self.new_ids)
        finally:
            self._release()

    def commit(self, entry: Dict, *, updated_at: str) -> DocumentVersionResult:
        cleanup_pending = False
        try:
            activated = {
                **entry,
                "activeVersion": self.version_id,
                "lifecycleState": "ACTIVE",
                "cleanupState": "CLEAN",
            }
            self.registry_store.upsert(self.doc_id, activated, updated_at=updated_at)
        except Exception as error:
            try:
                self.collection.delete(ids=self.new_ids)
            finally:
                self._release()
            raise DocumentVersionError("registry activation failed") from error

        old_ids = [item for item in self.old_ids if item not in set(self.new_ids)]
        if old_ids:
            try:
                self.collection.delete(ids=old_ids)
            except Exception:
                cleanup_pending = True
                try:
                    self.registry_store.patch(
                        self.doc_id,
                        {"cleanupState": "PENDING"},
                        updated_at=updated_at,
                    )
                except Exception:
                    pass
        self._release()
        return DocumentVersionResult(
            count=len(self.new_ids),
            version_id=self.version_id,
            previous_entry=dict(self.previous_entry),
            cleanup_pending=cleanup_pending,
        )


def stage_document_version(
    collection,
    registry_store,
    lock_root: Path,
    doc_id: str,
    payload: Dict,
    version_id: str,
) -> DocumentVersionStage:
    lock_root = Path(lock_root)
    lock_root.mkdir(parents=True, exist_ok=True)
    lock = FileLock(str(lock_root / f"{doc_id.encode('utf-8').hex()}.lock"), timeout=30)
    try:
        lock.acquire()
    except Timeout as error:
        raise DocumentVersionError("document lock timeout") from error

    new_ids = [f"{item}:version:{version_id}" for item in list(payload.get("ids") or [])]
    try:
        if not new_ids or len(new_ids) != int(payload.get("count") or 0):
            raise DocumentVersionError("staging payload is empty or incomplete")
        registry = registry_store.load()
        previous_entry = dict(registry.get(doc_id) or {})
        old_ids = _all_ids(collection, {"doc_id": doc_id})
        metadatas = [
            {**dict(metadata or {}), "doc_id": doc_id, "document_version": version_id}
            for metadata in list(payload.get("metadatas") or [])
        ]
        if len(metadatas) != len(new_ids):
            raise DocumentVersionError("staging metadata count mismatch")
        try:
            collection.upsert(
                documents=list(payload.get("documents") or []),
                metadatas=metadatas,
                ids=new_ids,
                embeddings=list(payload.get("embeddings") or []),
            )
        except Exception as error:
            try:
                collection.delete(ids=new_ids)
            finally:
                raise DocumentVersionError("staging upsert failed") from error

        verified = set(_all_ids(collection, _where_for_version(doc_id, version_id)))
        if verified != set(new_ids):
            collection.delete(ids=new_ids)
            raise DocumentVersionError("staging verification failed")
        return DocumentVersionStage(
            collection=collection,
            registry_store=registry_store,
            lock=lock,
            doc_id=doc_id,
            version_id=version_id,
            new_ids=new_ids,
            old_ids=old_ids,
            previous_entry=previous_entry,
        )
    except DocumentVersionError:
        lock.release()
        raise
    except Exception as error:
        lock.release()
        raise DocumentVersionError("staging preparation failed") from error


def delete_document_versioned(
    collection,
    registry_store,
    lock_root: Path,
    doc_id: str,
    *,
    updated_at: str,
    delete_source,
) -> DocumentDeleteResult:
    lock_root = Path(lock_root)
    lock_root.mkdir(parents=True, exist_ok=True)
    lock = FileLock(str(lock_root / f"{doc_id.encode('utf-8').hex()}.lock"), timeout=30)
    try:
        lock.acquire()
    except Timeout as error:
        raise DocumentDeleteError("DOCUMENT_LOCK_TIMEOUT") from error

    def mark_failed(code: str):
        try:
            registry_store.patch(
                doc_id,
                {"lifecycleState": "DELETE_FAILED", "deleteErrorCode": code},
                updated_at=updated_at,
            )
        except Exception:
            pass
        raise DocumentDeleteError(code)

    try:
        registry = registry_store.load()
        entry = registry.get(doc_id)
        if entry is None:
            return DocumentDeleteResult(deleted=False, had_entry=False)

        try:
            registry_store.patch(
                doc_id,
                {"lifecycleState": "DELETE_PENDING", "deleteErrorCode": None},
                updated_at=updated_at,
            )
        except Exception as error:
            raise DocumentDeleteError("TOMBSTONE_WRITE_FAILED") from error

        try:
            collection.delete(where={"doc_id": doc_id})
            if _all_ids(collection, {"doc_id": doc_id}):
                mark_failed("VECTOR_DELETE_INCOMPLETE")
        except DocumentDeleteError:
            raise
        except Exception:
            mark_failed("VECTOR_DELETE_FAILED")

        try:
            delete_source(entry)
        except Exception:
            mark_failed("SOURCE_DELETE_FAILED")

        try:
            registry_store.patch(
                doc_id,
                {
                    "lifecycleState": "DELETED",
                    "deleteErrorCode": None,
                    "deletedAt": updated_at,
                    "path": None,
                    "cleanupState": "CLEAN",
                },
                updated_at=updated_at,
            )
        except Exception as error:
            raise DocumentDeleteError("TOMBSTONE_FINALIZE_FAILED") from error
        return DocumentDeleteResult(deleted=True, had_entry=True)
    finally:
        lock.release()


def patch_document_metadata_consistently(
    collection,
    registry_store,
    lock_root: Path,
    doc_id: str,
    updates: Dict,
    *,
    updated_at: str,
    clear_fields=None,
) -> int:
    lock_root = Path(lock_root)
    lock_root.mkdir(parents=True, exist_ok=True)
    lock = FileLock(str(lock_root / f"{doc_id.encode('utf-8').hex()}.lock"), timeout=30)
    try:
        lock.acquire()
    except Timeout as error:
        raise DocumentVersionError("document lock timeout") from error

    try:
        registry = registry_store.load()
        if doc_id not in registry:
            raise DocumentVersionError("document not in registry")
        rows = _all_metadata_rows(collection, {"doc_id": doc_id})
        ids = [item_id for item_id, _metadata in rows]
        old_metadatas = [metadata for _item_id, metadata in rows]
        clear_keys = set(clear_fields or [])
        new_metadatas = [
            {**{key: value for key, value in metadata.items() if key not in clear_keys}, **updates}
            for metadata in old_metadatas
        ]

        def restore_chunks():
            if ids:
                collection.update(ids=ids, metadatas=old_metadatas)

        if ids:
            try:
                collection.update(ids=ids, metadatas=new_metadatas)
                verified = _all_metadata_rows(collection, {"doc_id": doc_id})
                verified_by_id = {item_id: metadata for item_id, metadata in verified}
                if any(
                    item_id not in verified_by_id
                    or any(verified_by_id[item_id].get(key) != value for key, value in updates.items())
                    or any(key in verified_by_id[item_id] for key in clear_keys)
                    for item_id in ids
                ):
                    raise RuntimeError("metadata verification failed")
            except Exception as error:
                try:
                    restore_chunks()
                except Exception:
                    try:
                        registry_store.patch(
                            doc_id,
                            {"metadataState": "REPAIR_REQUIRED"},
                            updated_at=updated_at,
                        )
                    except Exception:
                        pass
                raise DocumentVersionError("chunk metadata update failed") from error

        try:
            patch_values = {**updates, "metadataState": "CONSISTENT"}
            if clear_keys:
                registry_store.patch(
                    doc_id, patch_values, updated_at=updated_at, clear_fields=clear_keys
                )
            else:
                registry_store.patch(doc_id, patch_values, updated_at=updated_at)
        except Exception as error:
            try:
                restore_chunks()
            except Exception:
                pass
            raise DocumentVersionError("registry metadata commit failed") from error
        return len(ids)
    finally:
        lock.release()
