"""Rebuildable Estonian lemma FTS5 shadow index.

The index is derived from active Chroma chunks and never participates in production
ranking.  It stores no source text: only lemma search fields, bounded identifiers and
metadata needed to apply the same retrieval filters as the production lexical index.
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import sqlite3
import threading
import time
import uuid
from typing import Callable, Dict, Iterable, List, Optional, Sequence

from filelock import FileLock, Timeout

from lexical_index import (
    _active_registry_document_count,
    _compile_filter,
    _match_expression,
    _prefix_terms,
    _registry_generation,
)


LEMMA_INDEX_SCHEMA_VERSION = "lemma-fts-shadow-v2"
LEMMA_ANALYZER_VERSION = "estnltk-vabamorf-1.7.5-v2"
_WORD_RE = re.compile(r"[^\W\d_]+|\d+", flags=re.UNICODE)
_SAFE_LEMMA_TOKEN_RE = re.compile(r"[^\W_]+(?:-[^\W_]+)*", flags=re.UNICODE)


class LemmaIndexError(RuntimeError):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _bounded_reason(value: object, fallback: str) -> str:
    reason = str(value or fallback).strip().upper()
    if re.fullmatch(r"[A-Z0-9_]{1,80}", reason):
        return reason
    return fallback


class EstonianLemmaAnalyzer:
    """One lazy, process-wide Vabamorf instance guarded by a bounded batch lock."""

    def __init__(self, *, max_tokens_per_text: int = 4096, max_batch_tokens: int = 12000):
        self.max_tokens_per_text = max(32, min(12000, int(max_tokens_per_text or 4096)))
        self.max_batch_tokens = max(
            self.max_tokens_per_text,
            min(50000, int(max_batch_tokens or 12000)),
        )
        self._lock = threading.RLock()
        self._vabamorf = None
        self._load_attempted = False
        self._error_code: Optional[str] = None

    @property
    def version(self) -> str:
        return LEMMA_ANALYZER_VERSION

    def _load(self):
        with self._lock:
            if self._vabamorf is not None:
                return self._vabamorf
            self._load_attempted = True
            try:
                from estnltk.vabamorf.morf import Vabamorf

                self._vabamorf = Vabamorf.instance()
                self._error_code = None
                return self._vabamorf
            except Exception as error:
                self._error_code = "LEMMA_ANALYZER_UNAVAILABLE"
                raise LemmaIndexError(self._error_code) from error

    def status(self) -> Dict[str, object]:
        with self._lock:
            return {
                "version": self.version,
                "load_attempted": self._load_attempted,
                "available": self._vabamorf is not None,
                "reason": self._error_code,
            }

    def _tokenize(self, value: object) -> List[str]:
        # Vabamorf uses casing when propername=True. Lowercasing before the
        # analyzer made that option ineffective and damaged name analysis.
        return _WORD_RE.findall(str(value or ""))[: self.max_tokens_per_text]

    @staticmethod
    def _word_lemma_tokens(word_result: object, original: str) -> List[str]:
        analyses = word_result.get("analysis") if isinstance(word_result, dict) else None
        # The lemma channel supplements rather than replaces the user's or
        # document's surface token. This keeps proper names and analyzer
        # uncertainty searchable while bounded alternatives improve recall.
        candidates: List[object] = [str(original or "").lower()]
        for selected in (analyses[:8] if isinstance(analyses, list) else []):
            if not isinstance(selected, dict):
                continue
            candidates.append(selected.get("lemma"))
            root_tokens = selected.get("root_tokens")
            if isinstance(root_tokens, list):
                candidates.extend(root_tokens)

        output: List[str] = []
        seen = set()
        for candidate in candidates:
            token = str(candidate or "").strip().lower()
            if not token or not _SAFE_LEMMA_TOKEN_RE.fullmatch(token) or token in seen:
                continue
            seen.add(token)
            output.append(token)
        return output or [str(original or "").lower()]

    @staticmethod
    def _estonian_language_hint(tokens: Sequence[Dict[str, object]]) -> Dict[str, object]:
        function_lemmas = {
            "kes", "mis", "milline", "mitu", "kuidas", "millal", "kus",
            "miks", "kas", "ja", "ning", "või", "olema", "saama",
        }
        function_hits = 0
        inflected_hits = 0
        compound_hits = 0
        diacritic_hits = 0
        for token in tokens:
            surface = str(token.get("surface") or "").strip().lower()
            lemmas = [str(item or "").strip().lower() for item in token.get("lemmas") or []]
            roots = [str(item or "").strip().lower() for item in token.get("root_tokens") or []]
            if any(lemma in function_lemmas for lemma in lemmas):
                function_hits += 1
            if len(surface) >= 4 and any(lemma and lemma != surface for lemma in lemmas):
                inflected_hits += 1
            if len([root for root in roots if root]) >= 2:
                compound_hits += 1
            if any(character in surface for character in "äöõüšž"):
                diacritic_hits += 1
        confidence = 0.0
        reason = "INSUFFICIENT_MORPHOLOGY_SIGNAL"
        if function_hits >= 1 and (inflected_hits >= 1 or diacritic_hits >= 1):
            confidence = 0.94
            reason = "ESTONIAN_FUNCTION_AND_MORPHOLOGY"
        elif inflected_hits >= 2:
            confidence = 0.88
            reason = "ESTONIAN_INFLECTION_PATTERN"
        elif diacritic_hits >= 1 and (inflected_hits >= 1 or compound_hits >= 1):
            confidence = 0.82
            reason = "ESTONIAN_DIACRITIC_AND_MORPHOLOGY"
        return {
            "language_hint": "et" if confidence >= 0.8 else None,
            "language_hint_confidence": confidence,
            "language_hint_reason": reason,
        }

    def lemmatize_texts(self, values: Sequence[object]) -> Dict[str, object]:
        token_lists = [self._tokenize(value) for value in values]
        output_lists: List[List[str]] = [[] for _item in token_lists]
        analyzer = self._load()

        pending_words: List[str] = []
        pending_assignments: List[tuple[int, int]] = []
        analysis_ms = 0

        def flush() -> None:
            nonlocal pending_words, pending_assignments, analysis_ms
            if not pending_words:
                return
            started_at = time.perf_counter()
            try:
                with self._lock:
                    analyzed = analyzer.analyze(
                        pending_words,
                        # A batch contains words from unrelated chunks. Context
                        # disambiguation across that boundary creates false
                        # cross-document context, so retrieval keeps bounded
                        # alternatives instead.
                        disambiguate=False,
                        guess=True,
                        propername=True,
                        compound=True,
                        phonetic=False,
                        stem=False,
                    )
            except Exception as error:
                raise LemmaIndexError("LEMMA_ANALYSIS_FAILED") from error
            analysis_ms += int((time.perf_counter() - started_at) * 1000)
            if not isinstance(analyzed, list) or len(analyzed) != len(pending_words):
                raise LemmaIndexError("LEMMA_ANALYSIS_INVALID")
            for word_result, original, (text_index, _word_index) in zip(
                analyzed,
                pending_words,
                pending_assignments,
            ):
                output_lists[text_index].extend(self._word_lemma_tokens(word_result, original))
            pending_words = []
            pending_assignments = []

        for text_index, tokens in enumerate(token_lists):
            for word_index, token in enumerate(tokens):
                if len(pending_words) >= self.max_batch_tokens:
                    flush()
                pending_words.append(token)
                pending_assignments.append((text_index, word_index))
            # Vabamorf disambiguation may use neighboring tokens. Never let
            # the end of one document become linguistic context for the next.
            flush()

        return {
            "texts": [" ".join(tokens) for tokens in output_lists],
            "input_token_count": sum(len(tokens) for tokens in token_lists),
            "lemma_token_count": sum(len(tokens) for tokens in output_lists),
            "analysis_ms": analysis_ms,
        }

    def analyze_query(self, value: object) -> Dict[str, object]:
        """Analyze one user turn without replacing its surface form.

        Query analysis deliberately keeps bounded alternatives. Vabamorf's
        disambiguation needs sentence context that a batched list of unrelated
        queries does not provide, so planner-facing analysis is always scoped
        to one turn and uses ``disambiguate=False``.
        """
        text = str(value or "")
        matches = list(_WORD_RE.finditer(text))[: self.max_tokens_per_text]
        words = [match.group(0) for match in matches]
        if not words:
            return {
                "tokens": [],
                "proper_name_spans": [],
                "input_token_count": 0,
                "analysis_ms": 0,
            }

        analyzer = self._load()
        started_at = time.perf_counter()
        try:
            with self._lock:
                analyzed = analyzer.analyze(
                    words,
                    disambiguate=False,
                    guess=True,
                    propername=True,
                    compound=True,
                    phonetic=False,
                    stem=False,
                )
        except Exception as error:
            raise LemmaIndexError("LEMMA_ANALYSIS_FAILED") from error
        analysis_ms = int((time.perf_counter() - started_at) * 1000)
        if not isinstance(analyzed, list) or len(analyzed) != len(words):
            raise LemmaIndexError("LEMMA_ANALYSIS_INVALID")

        tokens: List[Dict[str, object]] = []
        for match, surface, word_result in zip(matches, words, analyzed):
            analyses = word_result.get("analysis") if isinstance(word_result, dict) else []
            analyses = analyses if isinstance(analyses, list) else []
            lemmas: List[str] = []
            roots: List[str] = []
            parts_of_speech: List[str] = []
            forms: List[str] = []
            for analysis in analyses[:8]:
                if not isinstance(analysis, dict):
                    continue
                lemma = str(analysis.get("lemma") or "").strip().lower()
                if lemma and _SAFE_LEMMA_TOKEN_RE.fullmatch(lemma) and lemma not in lemmas:
                    lemmas.append(lemma)
                for root in analysis.get("root_tokens") or []:
                    root_text = str(root or "").strip().lower()
                    if root_text and _SAFE_LEMMA_TOKEN_RE.fullmatch(root_text) and root_text not in roots:
                        roots.append(root_text)
                part_of_speech = str(analysis.get("partofspeech") or "").strip()[:8]
                if part_of_speech and part_of_speech not in parts_of_speech:
                    parts_of_speech.append(part_of_speech)
                form = str(analysis.get("form") or "").strip()[:32]
                if form and form not in forms:
                    forms.append(form)
            tokens.append({
                "surface": surface,
                "start": match.start(),
                "end": match.end(),
                "lemmas": lemmas[:8] or [surface.lower()],
                "root_tokens": roots[:8],
                "part_of_speech": parts_of_speech[:8],
                "forms": forms[:8],
                "proper_name_candidate": "H" in parts_of_speech or (
                    len(surface) > 1 and surface[0].isupper() and surface[1:].islower()
                ),
            })

        proper_name_spans: List[Dict[str, object]] = []
        run: List[Dict[str, object]] = []

        def flush_name_run() -> None:
            nonlocal run
            if len(run) >= 2:
                for start_index in range(len(run)):
                    bounded = run[start_index:start_index + 4]
                    if len(bounded) < 2:
                        continue
                    start = int(bounded[0]["start"])
                    end = int(bounded[-1]["end"])
                    canonical_parts = []
                    for token in bounded:
                        token_lemmas = token.get("lemmas") or []
                        lemma = str(token_lemmas[0] if token_lemmas else token["surface"]).strip()
                        canonical_parts.append(lemma[:1].upper() + lemma[1:] if lemma else "")
                    proper_name_spans.append({
                        "text": text[start:end],
                        "canonical_text": " ".join(part for part in canonical_parts if part),
                        "start": start,
                        "end": end,
                    })
                    break
            run = []

        for token in tokens:
            if token["proper_name_candidate"]:
                run.append(token)
            else:
                flush_name_run()
        flush_name_run()

        return {
            "tokens": tokens,
            "proper_name_spans": proper_name_spans[:12],
            "input_token_count": len(tokens),
            "analysis_ms": analysis_ms,
            **self._estonian_language_hint(tokens),
        }


class PersistentLemmaIndex:
    def __init__(
        self,
        path: Path,
        *,
        analyzer: EstonianLemmaAnalyzer,
        page_size: int = 128,
        candidate_limit: int = 80,
        lock_timeout_seconds: int = 120,
    ):
        self.path = Path(path)
        self.stale_path = self.path.with_suffix(self.path.suffix + ".stale")
        self.lock_path = self.path.with_suffix(self.path.suffix + ".lock")
        self.analyzer = analyzer
        self.page_size = max(32, min(512, int(page_size or 128)))
        self.candidate_limit = max(12, min(500, int(candidate_limit or 80)))
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
            rows = connection.execute("SELECT key, value FROM lemma_metadata").fetchall()
        return {str(row["key"]): str(row["value"]) for row in rows}

    def status(self, registry: Dict[str, Dict], *, verify: bool = False) -> Dict[str, object]:
        expected_generation = _registry_generation(registry)
        base: Dict[str, object] = {
            "ready": False,
            "reason": None,
            "schema_version": LEMMA_INDEX_SCHEMA_VERSION,
            "analyzer_version": self.analyzer.version,
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
            base["reason"] = _bounded_reason(stale.get("reason"), "LEMMA_INDEX_STALE")
            return base
        if not self.path.exists():
            base["reason"] = "LEMMA_INDEX_MISSING"
            return base
        try:
            metadata = self._read_metadata()
            base.update(
                {
                    "generation": metadata.get("generation"),
                    "chunk_count": int(metadata.get("chunk_count") or 0),
                    "document_count": int(metadata.get("document_count") or 0),
                    "built_at": metadata.get("built_at"),
                }
            )
            if metadata.get("schema_version") != LEMMA_INDEX_SCHEMA_VERSION:
                base["reason"] = "LEMMA_INDEX_SCHEMA_MISMATCH"
                return base
            if metadata.get("analyzer_version") != self.analyzer.version:
                base["reason"] = "LEMMA_INDEX_ANALYZER_MISMATCH"
                return base
            if metadata.get("state") != "ready":
                base["reason"] = _bounded_reason(
                    metadata.get("reason"), "LEMMA_INDEX_NOT_READY"
                )
                return base
            if metadata.get("generation") != expected_generation:
                base["reason"] = "LEMMA_INDEX_GENERATION_MISMATCH"
                return base
            if verify:
                with self._connect_readonly() as connection:
                    result = connection.execute("PRAGMA quick_check").fetchone()
                    if not result or str(result[0]).lower() != "ok":
                        base["reason"] = "LEMMA_INDEX_INTEGRITY_FAILED"
                        return base
            base["ready"] = True
            return base
        except (OSError, sqlite3.Error, ValueError):
            base["reason"] = "LEMMA_INDEX_UNREADABLE"
            return base

    def mark_stale(self, reason: str) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(
            {
                "reason": _bounded_reason(reason, "LEMMA_INDEX_STALE"),
                "marked_at": _utc_now(),
            },
            ensure_ascii=False,
            sort_keys=True,
        )
        temporary = self.stale_path.with_suffix(
            self.stale_path.suffix + f".{uuid.uuid4().hex}.tmp"
        )
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
            raise LemmaIndexError("LEMMA_INDEX_BUILD_LOCK_TIMEOUT") from error

        generation = _registry_generation(registry)
        temporary = self.path.with_suffix(self.path.suffix + f".{uuid.uuid4().hex}.tmp")
        started_at = time.perf_counter()
        total_analysis_ms = 0
        try:
            connection = sqlite3.connect(str(temporary), timeout=30)
            try:
                connection.execute("PRAGMA journal_mode=DELETE")
                connection.execute("PRAGMA synchronous=FULL")
                connection.execute("PRAGMA temp_store=FILE")
                connection.executescript(
                    """
                    CREATE TABLE lemma_metadata (
                      key TEXT PRIMARY KEY,
                      value TEXT NOT NULL
                    );
                    CREATE TABLE chunks (
                      rowid INTEGER PRIMARY KEY,
                      chunk_id TEXT NOT NULL UNIQUE,
                      doc_id TEXT NOT NULL,
                      document_version TEXT,
                      metadata_json TEXT NOT NULL
                    );
                    CREATE INDEX chunks_doc_id_idx ON chunks(doc_id);
                    CREATE VIRTUAL TABLE chunks_fts USING fts5(
                      title_lemmas,
                      body_lemmas,
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
                    active_rows: List[Dict[str, object]] = []
                    texts: List[str] = []
                    for index, item_id in enumerate(ids):
                        document = (
                            documents[index]
                            if index < len(documents) and isinstance(documents[index], str)
                            else ""
                        )
                        metadata = (
                            metadatas[index]
                            if index < len(metadatas) and isinstance(metadatas[index], dict)
                            else {}
                        )
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
                        active_rows.append(
                            {
                                "chunk_id": str(item_id),
                                "doc_id": doc_id,
                                "document_version": str(metadata.get("document_version") or "") or None,
                                "metadata": metadata,
                            }
                        )
                        texts.extend([searchable_title, document[:12000]])

                    lemma_result = self.analyzer.lemmatize_texts(texts)
                    total_analysis_ms += int(lemma_result.get("analysis_ms") or 0)
                    lemma_texts = list(lemma_result.get("texts") or [])
                    if len(lemma_texts) != len(active_rows) * 2:
                        raise LemmaIndexError("LEMMA_INDEX_ANALYSIS_INVALID")

                    for row_index, row in enumerate(active_rows):
                        metadata = row["metadata"]
                        metadata_json = json.dumps(
                            metadata,
                            ensure_ascii=False,
                            sort_keys=True,
                            separators=(",", ":"),
                            default=str,
                        )
                        cursor = connection.execute(
                            "INSERT INTO chunks(chunk_id, doc_id, document_version, metadata_json) VALUES (?, ?, ?, ?)",
                            (
                                row["chunk_id"],
                                row["doc_id"],
                                row["document_version"],
                                metadata_json,
                            ),
                        )
                        connection.execute(
                            "INSERT INTO chunks_fts(rowid, title_lemmas, body_lemmas) VALUES (?, ?, ?)",
                            (
                                cursor.lastrowid,
                                " ".join(filter(None, [
                                    normalize_search_text(lemma_texts[row_index * 2]),
                                    _prefix_terms([normalize_search_text(lemma_texts[row_index * 2])]),
                                ])),
                                " ".join(filter(None, [
                                    normalize_search_text(lemma_texts[row_index * 2 + 1]),
                                    _prefix_terms([normalize_search_text(lemma_texts[row_index * 2 + 1])]),
                                ])),
                            ),
                        )
                        indexed_documents.add(str(row["doc_id"]))
                        chunk_count += 1

                    if len(ids) < self.page_size:
                        break
                    offset += len(ids)

                if load_registry is not None and _registry_generation(load_registry()) != generation:
                    raise LemmaIndexError("LEMMA_INDEX_REGISTRY_CHANGED_DURING_BUILD")
                metadata_values = {
                    "state": "ready",
                    "reason": "",
                    "schema_version": LEMMA_INDEX_SCHEMA_VERSION,
                    "analyzer_version": self.analyzer.version,
                    "generation": generation,
                    "chunk_count": str(chunk_count),
                    "document_count": str(len(indexed_documents)),
                    "active_registry_document_count": str(
                        _active_registry_document_count(registry)
                    ),
                    "rows_scanned": str(rows_scanned),
                    "analysis_ms": str(total_analysis_ms),
                    "built_at": _utc_now(),
                }
                connection.executemany(
                    "INSERT INTO lemma_metadata(key, value) VALUES (?, ?)",
                    list(metadata_values.items()),
                )
                connection.execute("INSERT INTO chunks_fts(chunks_fts) VALUES ('optimize')")
                connection.commit()
                quick_check = connection.execute("PRAGMA quick_check").fetchone()
                if not quick_check or str(quick_check[0]).lower() != "ok":
                    raise LemmaIndexError("LEMMA_INDEX_INTEGRITY_FAILED")
            finally:
                connection.close()

            with temporary.open("rb") as handle:
                os.fsync(handle.fileno())
            if load_registry is not None and _registry_generation(load_registry()) != generation:
                raise LemmaIndexError("LEMMA_INDEX_REGISTRY_CHANGED_DURING_BUILD")
            os.replace(temporary, self.path)
            self._fsync_parent()
            self.stale_path.unlink(missing_ok=True)
            self._fsync_parent()
            status = self.status(registry, verify=True)
            if not status.get("ready"):
                raise LemmaIndexError(str(status.get("reason") or "LEMMA_INDEX_NOT_READY"))
            status.update(
                {
                    "build_ms": int((time.perf_counter() - started_at) * 1000),
                    "analysis_ms": total_analysis_ms,
                    "rows_scanned": rows_scanned,
                }
            )
            return status
        except LemmaIndexError:
            self.mark_stale("LEMMA_INDEX_BUILD_FAILED")
            raise
        except Exception as error:
            self.mark_stale("LEMMA_INDEX_BUILD_FAILED")
            raise LemmaIndexError("LEMMA_INDEX_BUILD_FAILED") from error
        finally:
            temporary.unlink(missing_ok=True)
            lock.release()

    def search(
        self,
        *,
        lemma_query_tokens: Iterable[str],
        where: Optional[Dict[str, object]],
        registry: Dict[str, Dict],
        limit: Optional[int] = None,
    ) -> Dict[str, object]:
        status = self.status(registry)
        if not status.get("ready"):
            raise LemmaIndexError(str(status.get("reason") or "LEMMA_INDEX_NOT_READY"))
        match = _match_expression(lemma_query_tokens)
        filter_sql, filter_params = _compile_filter(where)
        candidate_limit = max(1, min(self.candidate_limit, int(limit or self.candidate_limit)))
        started_at = time.perf_counter()
        try:
            with self._connect_readonly() as connection:
                rows = connection.execute(
                    f"""
                    SELECT chunks.chunk_id, chunks.doc_id,
                           bm25(chunks_fts, 6.0, 1.0) AS fts_rank
                    FROM chunks_fts
                    JOIN chunks ON chunks.rowid = chunks_fts.rowid
                    WHERE chunks_fts MATCH ? AND {filter_sql}
                    ORDER BY fts_rank ASC, chunks.rowid ASC
                    LIMIT ?
                    """,
                    [match, *filter_params, candidate_limit],
                ).fetchall()
        except sqlite3.Error as error:
            raise LemmaIndexError("LEMMA_INDEX_QUERY_FAILED") from error
        return {
            "candidates": [
                {
                    "chunk_id": str(row["chunk_id"]),
                    "document_id": str(row["doc_id"]),
                    "rank": index + 1,
                    "fts_rank": float(row["fts_rank"] or 0.0),
                }
                for index, row in enumerate(rows)
            ],
            "query_ms": int((time.perf_counter() - started_at) * 1000),
            "status": status,
        }
