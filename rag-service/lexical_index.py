"""Atomic SQLite FTS5 index derived from the active RAG registry and Chroma rows.

The file is a rebuildable retrieval accelerator, never a content source of truth.  Every
search validates the registry generation and applies the same metadata filter before the
caller re-scores candidates with the established hybrid ranker.
"""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import time
import uuid
from typing import Callable, Dict, Iterable, List, Optional, Tuple

from filelock import FileLock, Timeout


LEXICAL_INDEX_SCHEMA_VERSION = "fts5-v2"
_FILTER_KEY = re.compile(r"^[A-Za-z0-9_]+$")


class LexicalIndexError(RuntimeError):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _registry_generation(registry: Dict[str, Dict]) -> str:
    cached_generation = getattr(registry, "generation", None)
    if isinstance(cached_generation, str) and re.fullmatch(r"[a-f0-9]{64}", cached_generation):
        return cached_generation
    encoded = json.dumps(
        registry or {},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _active_registry_document_count(registry: Dict[str, Dict]) -> int:
    return sum(
        1
        for entry in (registry or {}).values()
        if isinstance(entry, dict)
        and entry.get("lifecycleState") not in {"DELETE_PENDING", "DELETE_FAILED", "DELETED"}
    )


def _normalized_tokens(value: str) -> List[str]:
    return [
        token
        for token in str(value or "").split()
        if (len(token) >= 3 or token.isdigit())
        and re.fullmatch(r"[^\W_]+", token, flags=re.UNICODE)
    ]


def _prefix_terms(values: Iterable[str]) -> str:
    terms = set()
    for value in values:
        for token in _normalized_tokens(value):
            if len(token) >= 5:
                terms.add(f"p5{token[:5]}")
            if len(token) >= 9:
                terms.add(f"p8{token[:8]}")
    return " ".join(sorted(terms))


def _match_expression(query_tokens: Iterable[str]) -> str:
    groups: List[str] = []
    seen = set()
    for raw_token in query_tokens:
        token = str(raw_token or "").strip().lower()
        if not re.fullmatch(r"[^\W_]+", token, flags=re.UNICODE) or token in seen:
            continue
        seen.add(token)
        variants = [f'"{token}"']
        if len(token) >= 5:
            variants.append(f'"p5{token[:5]}"')
        if len(token) >= 9:
            variants.append(f'"p8{token[:8]}"')
        groups.append(f"({' OR '.join(variants)})")
    if not groups:
        raise LexicalIndexError("LEXICAL_INDEX_QUERY_EMPTY")
    return " OR ".join(groups)


def _json_path(key: str) -> str:
    if not _FILTER_KEY.fullmatch(str(key or "")):
        raise LexicalIndexError("LEXICAL_INDEX_FILTER_UNSUPPORTED")
    return f'$."{key}"'


def _filter_scalar(value):
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, (int, float)) or value is None:
        return value
    text = str(value).strip()
    if text.lower() in {"true", "false"}:
        return 1 if text.lower() == "true" else 0
    return text


def _compile_filter(where: Optional[Dict[str, object]]) -> Tuple[str, List[object]]:
    if not where:
        return "1", []
    if not isinstance(where, dict):
        raise LexicalIndexError("LEXICAL_INDEX_FILTER_UNSUPPORTED")
    if "$and" in where:
        raw_clauses = where.get("$and")
        if set(where) != {"$and"} or not isinstance(raw_clauses, list) or not raw_clauses:
            raise LexicalIndexError("LEXICAL_INDEX_FILTER_UNSUPPORTED")
        if any(not isinstance(clause, dict) for clause in raw_clauses):
            raise LexicalIndexError("LEXICAL_INDEX_FILTER_UNSUPPORTED")
        clauses = [_compile_filter(clause) for clause in raw_clauses]
        return (
            "(" + " AND ".join(clause for clause, _params in clauses) + ")",
            [param for _clause, params in clauses for param in params],
        )
    if "$or" in where:
        raw_clauses = where.get("$or")
        if set(where) != {"$or"} or not isinstance(raw_clauses, list) or not raw_clauses:
            raise LexicalIndexError("LEXICAL_INDEX_FILTER_UNSUPPORTED")
        if any(not isinstance(clause, dict) for clause in raw_clauses):
            raise LexicalIndexError("LEXICAL_INDEX_FILTER_UNSUPPORTED")
        clauses = [_compile_filter(clause) for clause in raw_clauses]
        return (
            "(" + " OR ".join(clause for clause, _params in clauses) + ")",
            [param for _clause, params in clauses for param in params],
        )

    fragments: List[str] = []
    params: List[object] = []
    for key, expected in where.items():
        if key.startswith("$"):
            raise LexicalIndexError("LEXICAL_INDEX_FILTER_UNSUPPORTED")
        path = _json_path(key)
        if isinstance(expected, dict):
            operators = set(expected.keys())
            if operators == {"$in"}:
                values = [_filter_scalar(item) for item in list(expected.get("$in") or [])]
                if not values:
                    fragments.append("0")
                    continue
                placeholders = ",".join("?" for _item in values)
                fragments.append(
                    f"EXISTS (SELECT 1 FROM json_each(chunks.metadata_json, ?) j WHERE j.value IN ({placeholders}))"
                )
                params.extend([path, *values])
                continue
            if operators == {"$ne"}:
                fragments.append(
                    "NOT EXISTS (SELECT 1 FROM json_each(chunks.metadata_json, ?) j WHERE j.value = ?)"
                )
                params.extend([path, _filter_scalar(expected.get("$ne"))])
                continue
            if operators == {"$nin"}:
                values = [_filter_scalar(item) for item in list(expected.get("$nin") or [])]
                if not values:
                    fragments.append("1")
                    continue
                placeholders = ",".join("?" for _item in values)
                fragments.append(
                    f"NOT EXISTS (SELECT 1 FROM json_each(chunks.metadata_json, ?) j WHERE j.value IN ({placeholders}))"
                )
                params.extend([path, *values])
                continue
            raise LexicalIndexError("LEXICAL_INDEX_FILTER_UNSUPPORTED")
        fragments.append(
            "EXISTS (SELECT 1 FROM json_each(chunks.metadata_json, ?) j WHERE j.value = ?)"
        )
        params.extend([path, _filter_scalar(expected)])
    return ("(" + " AND ".join(fragments or ["1"]) + ")", params)


class PersistentLexicalIndex:
    def __init__(
        self,
        path: Path,
        *,
        page_size: int = 2000,
        candidate_limit: int = 1200,
        lock_timeout_seconds: int = 120,
    ):
        self.path = Path(path)
        self.stale_path = self.path.with_suffix(self.path.suffix + ".stale")
        self.lock_path = self.path.with_suffix(self.path.suffix + ".lock")
        self.page_size = max(100, min(5000, int(page_size or 2000)))
        self.candidate_limit = max(100, min(5000, int(candidate_limit or 1200)))
        self.lock_timeout_seconds = max(5, int(lock_timeout_seconds or 120))

    def _connect_readonly(self) -> sqlite3.Connection:
        uri = f"file:{self.path.as_posix()}?mode=ro"
        connection = sqlite3.connect(uri, uri=True, timeout=5)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA query_only=ON")
        return connection

    def _fsync_parent(self) -> None:
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

    def _read_metadata(self) -> Dict[str, str]:
        with self._connect_readonly() as connection:
            rows = connection.execute("SELECT key, value FROM lexical_metadata").fetchall()
        return {str(row["key"]): str(row["value"]) for row in rows}

    def status(self, registry: Dict[str, Dict], *, verify: bool = False) -> Dict[str, object]:
        expected_generation = _registry_generation(registry)
        base = {
            "ready": False,
            "reason": None,
            "schema_version": LEXICAL_INDEX_SCHEMA_VERSION,
            "generation": None,
            "expected_generation": expected_generation,
            "chunk_count": 0,
            "document_count": 0,
            "active_registry_document_count": _active_registry_document_count(registry),
            "size_bytes": self.path.stat().st_size if self.path.exists() else 0,
            "built_at": None,
        }
        if self.stale_path.exists():
            try:
                stale = json.loads(self.stale_path.read_text(encoding="utf-8"))
            except Exception:
                stale = {}
            base["reason"] = str(stale.get("reason") or "LEXICAL_INDEX_STALE")
            return base
        if not self.path.exists():
            base["reason"] = "LEXICAL_INDEX_MISSING"
            return base
        try:
            metadata = self._read_metadata()
            base.update({
                "generation": metadata.get("generation"),
                "chunk_count": int(metadata.get("chunk_count") or 0),
                "document_count": int(metadata.get("document_count") or 0),
                "built_at": metadata.get("built_at"),
            })
            if metadata.get("schema_version") != LEXICAL_INDEX_SCHEMA_VERSION:
                base["reason"] = "LEXICAL_INDEX_SCHEMA_MISMATCH"
                return base
            if metadata.get("state") != "ready":
                base["reason"] = str(metadata.get("reason") or "LEXICAL_INDEX_NOT_READY")
                return base
            if metadata.get("generation") != expected_generation:
                base["reason"] = "LEXICAL_INDEX_GENERATION_MISMATCH"
                return base
            if verify:
                with self._connect_readonly() as connection:
                    result = connection.execute("PRAGMA quick_check").fetchone()
                    if not result or str(result[0]).lower() != "ok":
                        base["reason"] = "LEXICAL_INDEX_INTEGRITY_FAILED"
                        return base
            base["ready"] = True
            return base
        except (OSError, sqlite3.Error, ValueError):
            base["reason"] = "LEXICAL_INDEX_UNREADABLE"
            return base

    def mark_stale(self, reason: str) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(
            {"reason": str(reason or "LEXICAL_INDEX_STALE"), "marked_at": _utc_now()},
            ensure_ascii=False,
            sort_keys=True,
        )
        temporary = self.stale_path.with_suffix(self.stale_path.suffix + f".{uuid.uuid4().hex}.tmp")
        try:
            with temporary.open("w", encoding="utf-8", newline="\n") as handle:
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, self.stale_path)
            self._fsync_parent()
        finally:
            temporary.unlink(missing_ok=True)

    def rebuild(
        self,
        collection,
        registry: Dict[str, Dict],
        *,
        is_active_document_version: Callable[[Dict, Dict[str, Dict]], bool],
        normalize_search_text: Callable[[object], str],
        load_registry: Optional[Callable[[], Dict[str, Dict]]] = None,
    ) -> Dict[str, object]:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        lock = FileLock(str(self.lock_path), timeout=self.lock_timeout_seconds)
        try:
            lock.acquire()
        except Timeout as error:
            raise LexicalIndexError("LEXICAL_INDEX_BUILD_LOCK_TIMEOUT") from error

        generation = _registry_generation(registry)
        temporary = self.path.with_suffix(self.path.suffix + f".{uuid.uuid4().hex}.tmp")
        started_at = time.perf_counter()
        try:
            connection = sqlite3.connect(str(temporary), timeout=30)
            try:
                connection.execute("PRAGMA journal_mode=DELETE")
                connection.execute("PRAGMA synchronous=FULL")
                connection.execute("PRAGMA temp_store=MEMORY")
                connection.executescript(
                    """
                    CREATE TABLE lexical_metadata (
                      key TEXT PRIMARY KEY,
                      value TEXT NOT NULL
                    );
                    CREATE TABLE chunks (
                      rowid INTEGER PRIMARY KEY,
                      chunk_id TEXT NOT NULL UNIQUE,
                      doc_id TEXT NOT NULL,
                      document_version TEXT,
                      document TEXT NOT NULL,
                      metadata_json TEXT NOT NULL
                    );
                    CREATE INDEX chunks_doc_id_idx ON chunks(doc_id);
                    CREATE VIRTUAL TABLE chunks_fts USING fts5(
                      title,
                      body,
                      authors,
                      tags,
                      terms,
                      tokenize='unicode61 remove_diacritics 2'
                    );
                    """
                )
                offset = 0
                indexed_documents = set()
                chunk_count = 0
                rows_scanned = 0
                while True:
                    result = collection.get(
                        include=["documents", "metadatas"],
                        limit=self.page_size,
                        offset=offset,
                    )
                    ids = list(result.get("ids") or [])
                    documents = list(result.get("documents") or [])
                    metadatas = list(result.get("metadatas") or [])
                    rows_scanned += len(ids)
                    for index, item_id in enumerate(ids):
                        document = documents[index] if index < len(documents) and isinstance(documents[index], str) else ""
                        metadata = metadatas[index] if index < len(metadatas) and isinstance(metadatas[index], dict) else {}
                        if not is_active_document_version(metadata, registry):
                            continue
                        doc_id = str(metadata.get("doc_id") or metadata.get("docId") or "").strip()
                        if not doc_id:
                            continue
                        title_value = (
                            metadata.get("title")
                            or metadata.get("fileName")
                            or metadata.get("source_url")
                            or ""
                        )
                        extra_title_value = " ".join(
                            str(metadata.get(key) or "")
                            for key in ("paragraph_title", "section", "act_title")
                        )
                        searchable_title = " ".join(
                            part for part in (str(title_value), extra_title_value) if part.strip()
                        )
                        searchable_body = document[:12000]
                        authors_value = metadata.get("authors") or metadata.get("authors_list") or ""
                        tags_value = metadata.get("tags") or ""
                        normalized_values = (
                            normalize_search_text(searchable_title),
                            normalize_search_text(searchable_body),
                            normalize_search_text(authors_value),
                            normalize_search_text(tags_value),
                        )
                        terms = _prefix_terms(normalized_values)
                        metadata_json = json.dumps(
                            metadata,
                            ensure_ascii=False,
                            sort_keys=True,
                            separators=(",", ":"),
                            default=str,
                        )
                        cursor = connection.execute(
                            "INSERT INTO chunks(chunk_id, doc_id, document_version, document, metadata_json) VALUES (?, ?, ?, ?, ?)",
                            (
                                str(item_id),
                                doc_id,
                                str(metadata.get("document_version") or "") or None,
                                document,
                                metadata_json,
                            ),
                        )
                        connection.execute(
                            "INSERT INTO chunks_fts(rowid, title, body, authors, tags, terms) VALUES (?, ?, ?, ?, ?, ?)",
                            (
                                cursor.lastrowid,
                                searchable_title,
                                searchable_body,
                                str(authors_value),
                                str(tags_value),
                                terms,
                            ),
                        )
                        indexed_documents.add(doc_id)
                        chunk_count += 1
                    if len(ids) < self.page_size:
                        break
                    offset += len(ids)

                if load_registry is not None and _registry_generation(load_registry()) != generation:
                    raise LexicalIndexError("LEXICAL_INDEX_REGISTRY_CHANGED_DURING_BUILD")
                metadata_values = {
                    "state": "ready",
                    "reason": "",
                    "schema_version": LEXICAL_INDEX_SCHEMA_VERSION,
                    "generation": generation,
                    "chunk_count": str(chunk_count),
                    "document_count": str(len(indexed_documents)),
                    "active_registry_document_count": str(_active_registry_document_count(registry)),
                    "rows_scanned": str(rows_scanned),
                    "built_at": _utc_now(),
                }
                connection.executemany(
                    "INSERT INTO lexical_metadata(key, value) VALUES (?, ?)",
                    list(metadata_values.items()),
                )
                connection.execute("INSERT INTO chunks_fts(chunks_fts) VALUES ('optimize')")
                connection.commit()
                quick_check = connection.execute("PRAGMA quick_check").fetchone()
                if not quick_check or str(quick_check[0]).lower() != "ok":
                    raise LexicalIndexError("LEXICAL_INDEX_INTEGRITY_FAILED")
            finally:
                connection.close()

            with temporary.open("rb") as handle:
                os.fsync(handle.fileno())
            if load_registry is not None and _registry_generation(load_registry()) != generation:
                raise LexicalIndexError("LEXICAL_INDEX_REGISTRY_CHANGED_DURING_BUILD")
            os.replace(temporary, self.path)
            self._fsync_parent()
            self.stale_path.unlink(missing_ok=True)
            self._fsync_parent()
            status = self.status(registry, verify=True)
            if not status.get("ready"):
                raise LexicalIndexError(str(status.get("reason") or "LEXICAL_INDEX_NOT_READY"))
            status.update({
                "build_ms": int((time.perf_counter() - started_at) * 1000),
                "rows_scanned": rows_scanned,
            })
            return status
        except LexicalIndexError:
            self.mark_stale("LEXICAL_INDEX_BUILD_FAILED")
            raise
        except Exception as error:
            self.mark_stale("LEXICAL_INDEX_BUILD_FAILED")
            raise LexicalIndexError("LEXICAL_INDEX_BUILD_FAILED") from error
        finally:
            temporary.unlink(missing_ok=True)
            lock.release()

    def search(
        self,
        *,
        query_tokens: Iterable[str],
        where: Optional[Dict[str, object]],
        registry: Dict[str, Dict],
        limit: Optional[int] = None,
    ) -> Dict[str, object]:
        status = self.status(registry)
        if not status.get("ready"):
            raise LexicalIndexError(str(status.get("reason") or "LEXICAL_INDEX_NOT_READY"))
        match = _match_expression(query_tokens)
        filter_sql, filter_params = _compile_filter(where)
        candidate_limit = max(1, min(self.candidate_limit, int(limit or self.candidate_limit)))
        started_at = time.perf_counter()
        sql_started_at = time.perf_counter()
        try:
            with self._connect_readonly() as connection:
                rows = connection.execute(
                    f"""
                    SELECT chunks.chunk_id, chunks.document, chunks.metadata_json,
                           bm25(chunks_fts, 8.0, 1.0, 5.0, 2.0, 0.3) AS fts_rank
                    FROM chunks_fts
                    JOIN chunks ON chunks.rowid = chunks_fts.rowid
                    WHERE chunks_fts MATCH ? AND {filter_sql}
                    ORDER BY fts_rank ASC, chunks.rowid ASC
                    LIMIT ?
                    """,
                    [match, *filter_params, candidate_limit],
                ).fetchall()
        except sqlite3.Error as error:
            raise LexicalIndexError("LEXICAL_INDEX_QUERY_FAILED") from error
        sql_ms = int((time.perf_counter() - sql_started_at) * 1000)
        materialize_started_at = time.perf_counter()
        ids: List[object] = []
        documents: List[object] = []
        metadatas: List[object] = []
        ranks: List[float] = []
        for row in rows:
            try:
                metadata = json.loads(str(row["metadata_json"] or "{}"))
            except Exception:
                raise LexicalIndexError("LEXICAL_INDEX_METADATA_INVALID")
            ids.append(str(row["chunk_id"]))
            documents.append(str(row["document"] or ""))
            metadatas.append(metadata if isinstance(metadata, dict) else {})
            ranks.append(float(row["fts_rank"] or 0.0))
        materialize_ms = int((time.perf_counter() - materialize_started_at) * 1000)
        return {
            "ids": ids,
            "documents": documents,
            "metadatas": metadatas,
            "fts_ranks": ranks,
            "rows_loaded": len(ids),
            "sql_ms": sql_ms,
            "materialize_ms": materialize_ms,
            "query_ms": int((time.perf_counter() - started_at) * 1000),
            "status": status,
        }
