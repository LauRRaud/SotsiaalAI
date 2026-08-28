"""Process-safe, fail-closed storage for the RAG document registry."""

from __future__ import annotations

import json
import hashlib
import os
from pathlib import Path
import threading
from typing import Callable, Dict, Optional
import uuid

from filelock import FileLock, Timeout


class RegistryError(RuntimeError):
    code = "REGISTRY_UNAVAILABLE"


class RegistryCorruptError(RegistryError):
    code = "REGISTRY_CORRUPT"


class RegistryIoError(RegistryError):
    code = "REGISTRY_IO_ERROR"


def _validate_registry(value) -> Dict[str, Dict]:
    if not isinstance(value, dict):
        raise RegistryCorruptError("registry root must be an object")
    for doc_id, entry in value.items():
        if not isinstance(doc_id, str) or not doc_id or not isinstance(entry, dict):
            raise RegistryCorruptError("registry entries must be document objects")
        embedded_id = entry.get("docId")
        if embedded_id is not None and embedded_id != doc_id:
            raise RegistryCorruptError("registry document id mismatch")
    return value


class _FrozenDict(dict):
    def _immutable(self, *args, **kwargs):
        raise TypeError("registry snapshot is immutable")

    __setitem__ = _immutable
    __delitem__ = _immutable
    clear = _immutable
    pop = _immutable
    popitem = _immutable
    setdefault = _immutable
    update = _immutable
    __ior__ = _immutable


class _FrozenList(list):
    def _immutable(self, *args, **kwargs):
        raise TypeError("registry snapshot is immutable")

    __setitem__ = _immutable
    __delitem__ = _immutable
    append = _immutable
    clear = _immutable
    extend = _immutable
    insert = _immutable
    pop = _immutable
    remove = _immutable
    reverse = _immutable
    sort = _immutable
    __iadd__ = _immutable
    __imul__ = _immutable


def _freeze_value(value):
    if isinstance(value, dict):
        frozen = _FrozenDict()
        dict.update(frozen, {key: _freeze_value(item) for key, item in value.items()})
        return frozen
    if isinstance(value, list):
        frozen = _FrozenList()
        list.extend(frozen, (_freeze_value(item) for item in value))
        return frozen
    return value


def _registry_generation(value: Dict[str, Dict]) -> str:
    payload = json.dumps(
        value or {},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


class RegistrySnapshot(_FrozenDict):
    def __init__(self, value: Dict[str, Dict]):
        dict.__init__(self, {key: _freeze_value(item) for key, item in value.items()})
        self.generation = _registry_generation(self)


class RegistryStore:
    def __init__(self, path: Path, lock_timeout: float = 30.0):
        self.path = Path(path)
        self.backup_path = self.path.with_suffix(f"{self.path.suffix}.last-good")
        self.lock_path = self.path.with_suffix(f"{self.path.suffix}.lock")
        self.lock_timeout = lock_timeout
        self._cache_lock = threading.RLock()
        self._snapshot: Optional[RegistrySnapshot] = None
        self._snapshot_signature = None

    def _lock(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        return FileLock(str(self.lock_path), timeout=self.lock_timeout)

    def _read_unlocked(self) -> Dict[str, Dict]:
        if not self.path.exists():
            return {}
        try:
            raw = self.path.read_text(encoding="utf-8")
            return _validate_registry(json.loads(raw))
        except RegistryError:
            raise
        except (json.JSONDecodeError, UnicodeDecodeError, OSError) as error:
            if isinstance(error, OSError):
                raise RegistryIoError("registry cannot be read") from error
            raise RegistryCorruptError("registry is not valid JSON") from error

    def _file_signature(self):
        try:
            stat = self.path.stat()
            return (True, stat.st_mtime_ns, stat.st_ctime_ns, stat.st_size)
        except FileNotFoundError:
            return (False, 0, 0, 0)
        except OSError as error:
            raise RegistryIoError("registry cannot be inspected") from error

    def _cached_snapshot(self, signature):
        with self._cache_lock:
            if self._snapshot is not None and self._snapshot_signature == signature:
                return self._snapshot
        return None

    def _install_snapshot(self, data: Dict[str, Dict], signature=None) -> RegistrySnapshot:
        snapshot = RegistrySnapshot(_validate_registry(data))
        resolved_signature = signature if signature is not None else self._file_signature()
        with self._cache_lock:
            self._snapshot = snapshot
            self._snapshot_signature = resolved_signature
        return snapshot

    def _fsync_parent(self):
        try:
            descriptor = os.open(str(self.path.parent), os.O_RDONLY)
        except OSError:
            return
        try:
            os.fsync(descriptor)
        except OSError:
            pass
        finally:
            os.close(descriptor)

    def _write_atomic(self, target: Path, data: Dict[str, Dict]):
        temporary = target.with_name(f"{target.name}.tmp-{os.getpid()}-{uuid.uuid4().hex}")
        payload = json.dumps(data, ensure_ascii=False, indent=2)
        try:
            with temporary.open("w", encoding="utf-8", newline="\n") as handle:
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, target)
            self._fsync_parent()
        except OSError as error:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass
            raise RegistryIoError("registry cannot be written atomically") from error

    def _commit_unlocked(self, current: Dict[str, Dict], updated: Dict[str, Dict]):
        _validate_registry(updated)
        if self.path.exists():
            self._write_atomic(self.backup_path, current)
        self._write_atomic(self.path, updated)
        if not self.backup_path.exists():
            self._write_atomic(self.backup_path, updated)
        self._install_snapshot(updated)

    def _under_lock(self, operation: Callable[[], object]):
        try:
            with self._lock():
                return operation()
        except Timeout as error:
            raise RegistryIoError("registry lock timeout") from error

    def load(self) -> Dict[str, Dict]:
        signature = self._file_signature()
        cached = self._cached_snapshot(signature)
        if cached is not None:
            return cached

        def operation():
            locked_signature = self._file_signature()
            locked_cached = self._cached_snapshot(locked_signature)
            if locked_cached is not None:
                return locked_cached
            return self._install_snapshot(self._read_unlocked(), locked_signature)

        return self._under_lock(operation)

    def replace(self, data: Dict[str, Dict]) -> None:
        def operation():
            current = self._read_unlocked()
            self._commit_unlocked(current, data)
        self._under_lock(operation)

    def upsert(self, doc_id: str, entry: Dict, *, updated_at: str) -> Dict:
        def operation():
            current = self._read_unlocked()
            registry = dict(current)
            merged = dict(registry.get(doc_id) or {})
            if not merged.get("createdAt"):
                merged["createdAt"] = updated_at
            merged.update(entry)
            merged["docId"] = doc_id
            merged["updatedAt"] = updated_at
            registry[doc_id] = merged
            self._commit_unlocked(current, registry)
            return dict(merged)
        return self._under_lock(operation)

    def patch(self, doc_id: str, updates: Dict, *, updated_at: str, clear_fields=None) -> Optional[Dict]:
        def operation():
            current = self._read_unlocked()
            registry = dict(current)
            entry = registry.get(doc_id)
            if entry is None:
                return None
            updated = dict(entry)
            updated.update(updates)
            for key in set(clear_fields or []):
                updated.pop(key, None)
            updated["docId"] = doc_id
            updated["updatedAt"] = updated_at
            registry[doc_id] = updated
            self._commit_unlocked(current, registry)
            return dict(updated)
        return self._under_lock(operation)

    def pop(self, doc_id: str) -> bool:
        def operation():
            current = self._read_unlocked()
            registry = dict(current)
            if doc_id not in registry:
                return False
            registry.pop(doc_id)
            self._commit_unlocked(current, registry)
            return True
        return bool(self._under_lock(operation))
