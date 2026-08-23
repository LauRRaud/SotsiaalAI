from __future__ import annotations

import base64
import binascii
import time
import uuid
import json
import os
import re
import hashlib
import math
import secrets
import shutil
import unicodedata
from io import BytesIO
import logging
import mimetypes
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

# --- optional libmagic (fall back if missing) ---
try:
    import magic  # type: ignore
    _MAGIC_OK = True
except Exception:
    magic = None  # type: ignore
    _MAGIC_OK = False

import requests
from bs4 import BeautifulSoup
from fastapi import Depends, FastAPI, Header, HTTPException, Request, UploadFile, File, Form, Path as FastPath
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field, ValidationError, field_validator

import chromadb

from auth_config import load_auth_config

from search_security import (
    build_agent_document_search_where,
    build_general_search_where,
    is_general_search_metadata_allowed,
)
from storage_paths import (
    PathOutsideStorage,
    doc_file_path,
    resolve_within,
    safe_basename,
)
from upload_limits import (
    RESPONSE_MAX_FULL_TEXT_CHARS,
    clamp_pages,
    clamp_text,
    mime_conflict,
    zip_expansion_guard,
)
from request_limits import (
    BodySizeLimitMiddleware,
    RequestBodyTooLarge,
    read_upload_bytes_bounded,
    validate_ingest_budget,
)
from parser_worker import ParserLimits, ParserRejected, parse_document
from pinned_fetch import PinnedFetchRejected, open_pinned_response
from registry_store import RegistryError, RegistryStore
from document_versions import (
    DocumentDeleteError,
    DocumentVersionError,
    delete_document_versioned,
    is_active_document_version,
    patch_document_metadata_consistently,
    stage_document_version,
)
from lexical_index import LexicalIndexError, PersistentLexicalIndex

# OpenAI embeddings
from openai import OpenAI, OpenAIError, RateLimitError

# Optional tiktoken for token-aware chunking
try:
    import tiktoken  # type: ignore
    _TIKTOKEN_OK = True
except Exception:
    tiktoken = None  # type: ignore
    _TIKTOKEN_OK = False

# --------------------
# ENV & GLOBALS
# --------------------
RAG_AUTH_CONFIG = load_auth_config(os.environ)
RAG_SERVICE_API_KEY = RAG_AUTH_CONFIG.api_key
STORAGE_DIR = Path(os.getenv("RAG_STORAGE_DIR", "./storage")).resolve()
REGISTRY_PATH = STORAGE_DIR / "registry.json"
COLLECTION_NAME = os.getenv("RAG_COLLECTION", "sotsiaalai")

# OpenAI embeddings — hoia kooskõlas olemasoleva kollektsiooniga
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
EMBED_MODEL = os.getenv("RAG_EMBED_MODEL", os.getenv("EMBEDDING_MODEL", "text-embedding-3-large"))

MAX_MB = int(os.getenv("RAG_SERVER_MAX_MB", "20"))
MAX_FILE_BYTES = MAX_MB * 1024 * 1024
# JSON base64 needs 4/3 overhead; the extra MiB covers metadata/multipart framing.
MAX_REQUEST_BYTES = int(os.getenv("RAG_REQUEST_MAX_BYTES", str((MAX_FILE_BYTES * 4 // 3) + 1024 * 1024)))
MAX_TEXT_CHARS = int(os.getenv("RAG_MAX_TEXT_CHARS", "2000000"))
MAX_QUERY_CHARS = int(os.getenv("RAG_MAX_QUERY_CHARS", "8000"))
MAX_EXPLICIT_CHUNKS = int(os.getenv("RAG_MAX_EXPLICIT_CHUNKS", "512"))
MAX_EXPLICIT_CHUNK_CHARS = int(os.getenv("RAG_MAX_EXPLICIT_CHUNK_CHARS", "32000"))
MAX_METADATA_BYTES = int(os.getenv("RAG_MAX_METADATA_BYTES", str(1024 * 1024)))
PARSER_LIMITS = ParserLimits(
    max_pdf_pages=int(os.getenv("RAG_PARSER_MAX_PDF_PAGES", "1500")),
    max_pdf_objects=int(os.getenv("RAG_PARSER_MAX_PDF_OBJECTS", "250000")),
    timeout_seconds=float(os.getenv("RAG_PARSER_TIMEOUT_SECONDS", "30")),
    max_memory_bytes=int(os.getenv("RAG_PARSER_MAX_MEMORY_BYTES", str(512 * 1024 * 1024))),
    max_cpu_seconds=int(os.getenv("RAG_PARSER_MAX_CPU_SECONDS", "20")),
)

# Chunking config
# Mode: "tokens" (default) uses tiktoken if available, otherwise falls back to char-based.
#       Set RAG_CHUNK_MODE=chars to force char-based splitting.
CHUNK_MODE = os.getenv("RAG_CHUNK_MODE", "tokens").strip().lower()

# Char-based (fallback) config
CHUNK_SIZE = int(os.getenv("RAG_CHUNK_SIZE", "1200"))
CHUNK_OVERLAP = int(os.getenv("RAG_CHUNK_OVERLAP", "200"))
SINGLE_CHUNK_CHAR_LIMIT = int(os.getenv("RAG_SINGLE_CHUNK_CHAR_LIMIT", str(max(3000, CHUNK_SIZE * 2))))

# Token-based config
CHUNK_TOKENS = int(os.getenv("RAG_CHUNK_TOKENS", "700"))
CHUNK_TOKENS_OVERLAP = int(os.getenv("RAG_CHUNK_TOKENS_OVERLAP", "120"))
SINGLE_CHUNK_TOKEN_LIMIT = int(os.getenv("RAG_SINGLE_CHUNK_TOKEN_LIMIT", "1200"))

# Force chunking even for shorter texts
ALWAYS_CHUNK = os.getenv("RAG_ALWAYS_CHUNK", "0").strip() in {"1", "true", "yes"}

# Lightweight lexical retrievers for hybrid RAG. Dense retrieval remains primary;
# these channels add exact/title candidates and traceability without requiring a
# separate search engine in V2.
RAG_LEXICAL_SEARCH_ENABLED = os.getenv("RAG_LEXICAL_SEARCH_ENABLED", "1").strip().lower() in {"1", "true", "yes"}
RAG_LEXICAL_SCAN_LIMIT = int(os.getenv("RAG_LEXICAL_SCAN_LIMIT", "2000"))
RAG_LEXICAL_MAX_SCAN = int(os.getenv("RAG_LEXICAL_MAX_SCAN", "100000"))
RAG_LEXICAL_TOP_K = int(os.getenv("RAG_LEXICAL_TOP_K", "20"))
RAG_PERSISTENT_LEXICAL_INDEX_ENABLED = os.getenv(
    "RAG_PERSISTENT_LEXICAL_INDEX_ENABLED", "1"
).strip().lower() in {"1", "true", "yes"}
RAG_PERSISTENT_LEXICAL_INDEX_PATH = Path(
    os.getenv("RAG_PERSISTENT_LEXICAL_INDEX_PATH", str(STORAGE_DIR / "lexical-index.sqlite3"))
).resolve()
RAG_PERSISTENT_LEXICAL_INDEX_PAGE_SIZE = int(
    os.getenv("RAG_PERSISTENT_LEXICAL_INDEX_PAGE_SIZE", "2000")
)
RAG_PERSISTENT_LEXICAL_INDEX_CANDIDATES = int(
    os.getenv("RAG_PERSISTENT_LEXICAL_INDEX_CANDIDATES", "320")
)
RAG_BM25_MIN_COVERAGE = float(os.getenv("RAG_BM25_MIN_COVERAGE", "0.35"))
RAG_BM25_TITLE_WEIGHT = float(os.getenv("RAG_BM25_TITLE_WEIGHT", "1.8"))
RAG_BM25_BODY_WEIGHT = float(os.getenv("RAG_BM25_BODY_WEIGHT", "1.0"))
RAG_BM25_TITLE_K = float(os.getenv("RAG_BM25_TITLE_K", "0.8"))
RAG_BM25_BODY_K = float(os.getenv("RAG_BM25_BODY_K", "1.5"))
RAG_RRF_K = int(os.getenv("RAG_RRF_K", "60"))
HYBRID_CHANNEL_WEIGHTS = {
    "dense": 1.0,
    "author_match": 1.5,
    "title_match": 1.35,
    "exact_phrase": 1.15,
    "bm25": 1.0,
    "registry_fact": 1.7,
}
HYBRID_CHANNEL_BOOSTS = {
    "author_match": 0.14,
    "title_match": 0.09,
    "exact_phrase": 0.06,
    "bm25": 0.05,
    # A registry-fact candidate is emitted only when the fact description and
    # the document identity narrow to one active source. Treat that bounded
    # match as stronger than a generic methods-heavy dense result.
    "registry_fact": 0.32,
}
RAG_METADATA_SCHEMA_VERSION = os.getenv("RAG_METADATA_SCHEMA_VERSION", "v2.5").strip() or "v2.5"

# Lubatud MIME – kui env on tühi, kasuta mõistlikku vaikimisi komplekti
_DEFAULT_ALLOWED = (
    "application/pdf,"
    "text/plain,"
    "text/markdown,"
    "text/html,"
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)
ALLOWED_MIME = set(
    m.strip() for m in (os.getenv("RAG_ALLOWED_MIME", _DEFAULT_ALLOWED).split(",")) if m.strip()
)

ALLOWED_ORIGINS = [o.strip() for o in os.getenv("RAG_ALLOWED_ORIGINS", "*").split(",") if o.strip()]
ALLOW_PRIVATE_URL_FETCH = os.getenv("RAG_ALLOW_PRIVATE_URL_FETCH", "0").strip().lower() in {"1", "true", "yes"}
URL_FETCH_MAX_BYTES = int(os.getenv("RAG_URL_FETCH_MAX_BYTES", str(MAX_MB * 1024 * 1024)))

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is missing for RAG embeddings")

STORAGE_DIR.mkdir(parents=True, exist_ok=True)
REGISTRY_STORE = RegistryStore(REGISTRY_PATH)

# Chroma client (persistent) – we send precomputed OpenAI embeddings
client = chromadb.PersistentClient(path=str(STORAGE_DIR / "chroma"))
collection = client.get_or_create_collection(name=COLLECTION_NAME)
LEXICAL_INDEX = PersistentLexicalIndex(
    RAG_PERSISTENT_LEXICAL_INDEX_PATH,
    page_size=RAG_PERSISTENT_LEXICAL_INDEX_PAGE_SIZE,
    candidate_limit=RAG_PERSISTENT_LEXICAL_INDEX_CANDIDATES,
)

# OpenAI client
oa = OpenAI(api_key=OPENAI_API_KEY)
logger = logging.getLogger("rag-service")
# B0b: stage events use Uvicorn's existing error logger tree so its handler
# and INFO level carry the records to stderr/journald without touching root
# logging or the application logger used by warnings and errors.
stage_logger = logging.getLogger("uvicorn.error.rag_stage")


def _warm_dense_index() -> None:
    """Load the persisted Chroma dense index before Uvicorn reports ready.

    The warm-up is read-only and reuses one stored embedding, so it does not
    call the embedding provider, alter ranking, or write to the corpus. A
    failed dense read is a startup failure rather than a slow first user's
    request against an index that was never proved readable.
    """
    started_at = time.perf_counter()
    try:
        sample = collection.get(limit=1, include=["embeddings", "metadatas"])
        embeddings = sample.get("embeddings")
        if embeddings is None or len(embeddings) == 0:
            stage_logger.info(
                "rag.startup.warmup %s",
                json.dumps({"outcome": "empty", "dense_ms": 0}, ensure_ascii=False),
            )
            return
        stored_embedding = embeddings[0]
        if hasattr(stored_embedding, "tolist"):
            stored_embedding = stored_embedding.tolist()
        general_started_at = time.perf_counter()
        collection.query(
            query_embeddings=[stored_embedding],
            n_results=64,
            where=build_general_search_where(None),
            include=["documents", "metadatas", "distances"],
        )
        general_ms = int((time.perf_counter() - general_started_at) * 1000)

        document_ms = 0
        metadatas = sample.get("metadatas") or []
        sample_metadata = metadatas[0] if metadatas else {}
        sample_doc_id = str((sample_metadata or {}).get("doc_id") or "").strip()
        if sample_doc_id:
            document_started_at = time.perf_counter()
            collection.query(
                query_embeddings=[stored_embedding],
                n_results=64,
                where=build_agent_document_search_where([sample_doc_id]),
                include=["documents", "metadatas", "distances"],
            )
            document_ms = int((time.perf_counter() - document_started_at) * 1000)
        stage_logger.info(
            "rag.startup.warmup %s",
            json.dumps(
                {
                    "outcome": "ok",
                    "dense_ms": int((time.perf_counter() - started_at) * 1000),
                    "general_ms": general_ms,
                    "document_ms": document_ms,
                },
                ensure_ascii=False,
            ),
        )
    except Exception as exc:
        logger.exception("RAG dense index startup warm-up failed")
        raise RuntimeError("RAG dense index startup warm-up failed") from exc


_warm_dense_index()
OBSERVABILITY_ROUTE_HEADER = "X-Observability-Route"
OBSERVABILITY_STAGE_HEADER = "X-Observability-Stage"
# B0b: kliendipoolne korrelatsiooni-ID. Valikuline ja tagasiühilduv — kui
# klient seda ei saada, genereerime oma, et serverilogi oleks alati seotav.
REQUEST_ID_HEADER = "X-Request-Id"
OBSERVABILITY_USER_ID_HEADER = "X-Observability-User-Id"
OBSERVABILITY_ROLE_HEADER = "X-Observability-Role"
OBSERVABILITY_CONVERSATION_ID_HEADER = "X-Observability-Conversation-Id"
OBSERVABILITY_ARTIFACT_ID_HEADER = "X-Observability-Artifact-Id"
OBSERVABILITY_RESEARCH_JOB_ID_HEADER = "X-Observability-Research-Job-Id"
RAG_COST_MIRROR_URL = os.getenv("RAG_COST_MIRROR_URL", "").strip()
RAG_COST_MIRROR_SECRET = os.getenv("RAG_COST_MIRROR_SECRET", "").strip()
RAG_COST_MIRROR_TIMEOUT_SEC = float(os.getenv("RAG_COST_MIRROR_TIMEOUT_SEC", "1.5"))

# strict_content_type=False: säilitab pre-FastAPI-0.132 käitumise — JSON-keha
# endpointid (/ingest/*, /search jne) ei nõua ranget Content-Type päist.
app = FastAPI(
    title="SotsiaalAI RAG Service (OpenAI embeddings)",
    version="3.9",
    strict_content_type=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(BodySizeLimitMiddleware, max_bytes=MAX_REQUEST_BYTES)


@app.exception_handler(RequestValidationError)
async def handle_request_validation_error(request: Request, exc: RequestValidationError):
    error_summary = [
        {
            "location": list(error.get("loc") or []),
            "field": str((error.get("loc") or ["payload"])[-1]),
            "code": error.get("type"),
        }
        for error in exc.errors()
    ]
    request_id = (
        request.headers.get("x-request-id")
        or request.headers.get("x-correlation-id")
        or request.headers.get("x-amzn-trace-id")
    )

    try:
        logger.warning(
            "Validation error on %s: errors=%s content_type=%s request_id=%s",
            request.url.path,
            error_summary,
            request.headers.get("content-type"),
            request_id,
        )
    except Exception:
        logger.warning("Validation error on %s", request.url.path)

    route = request.url.path
    route_code = "VALIDATION_ERROR"
    for prefix, code in [
        ("/search/agent-documents", "AGENT_SEARCH_VALIDATION_ERROR"),
        ("/search", "SEARCH_VALIDATION_ERROR"),
        ("/ingest/text", "INGEST_TEXT_VALIDATION_ERROR"),
        ("/documents/", "DOCUMENT_VALIDATION_ERROR"),
        ("/upload", "UPLOAD_VALIDATION_ERROR"),
        ("/analyze", "ANALYZE_VALIDATION_ERROR"),
        ("/ingest/", "INGEST_VALIDATION_ERROR"),
    ]:
        if route.startswith(prefix):
            route_code = code
            break
    return JSONResponse(
        status_code=422,
        content={
            "ok": False,
            "code": route_code,
            "route": route,
            "errors": error_summary,
        },
    )


@app.exception_handler(RegistryError)
async def handle_registry_error(_request: Request, exc: RegistryError):
    logger.error("RAG registry unavailable: %s", exc.code)
    return JSONResponse(
        status_code=503,
        content={"ok": False, "error": {"code": exc.code}},
        headers={"Cache-Control": "no-store"},
    )


@app.exception_handler(DocumentVersionError)
async def handle_document_version_error(_request: Request, _exc: DocumentVersionError):
    return JSONResponse(
        status_code=503,
        content={"ok": False, "error": {"code": "DOCUMENT_VERSION_COMMIT_FAILED"}},
        headers={"Cache-Control": "no-store"},
    )


@app.exception_handler(DocumentDeleteError)
async def handle_document_delete_error(_request: Request, exc: DocumentDeleteError):
    return JSONResponse(
        status_code=503,
        content={"ok": False, "error": {"code": exc.code}},
        headers={"Cache-Control": "no-store"},
    )

# --------------------
# Utils
# --------------------
AUDIENCE_VALUES = {"SOCIAL_WORKER", "CLIENT", "BOTH"}
AUDIENCE_ITEM_VALUES = {"SOCIAL_WORKER", "CLIENT"}
JURISDICTION_VALUES = {"NATIONAL", "MUNICIPALITY", "CITY_GOVERNMENT", "UNKNOWN"}

def normalize_string_list(value, limit: int = 50) -> List[str]:
    if not value:
        return []
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return []
        try:
            arr = json.loads(s)
            if isinstance(arr, list):
                out = []
                for item in arr:
                    cleaned = str(item).strip()
                    if cleaned:
                        out.append(cleaned)
                return out[:limit]
        except Exception:
            pass
        return [x.strip() for x in re.split(r"[,;\n]+", s) if x.strip()][:limit]
    out: List[str] = []
    if isinstance(value, (list, tuple, set)):
        for item in value:
            if item is None:
                continue
            cleaned = str(item).strip()
            if cleaned:
                out.append(cleaned)
    else:
        cleaned = str(value).strip()
        if cleaned:
            out.append(cleaned)
    return out[:limit]

def normalize_audience_list(value) -> List[str]:
    raw_values = normalize_string_list(value, limit=8)
    if not raw_values:
        return ["CLIENT", "SOCIAL_WORKER"]
    out: List[str] = []
    for item in raw_values:
        v = str(item or "").strip().upper()
        if not v:
            continue
        if v == "BOTH":
            for each in ["CLIENT", "SOCIAL_WORKER"]:
                if each not in out:
                    out.append(each)
            continue
        if v in AUDIENCE_ITEM_VALUES and v not in out:
            out.append(v)
    return out or ["CLIENT", "SOCIAL_WORKER"]

def normalize_audience(value) -> Optional[str]:
    audiences = normalize_audience_list(value)
    if len(audiences) == 1:
        return audiences[0]
    return "BOTH"

def audience_filter_values(value) -> List[str]:
    normalized = normalize_audience(value)
    if normalized == "CLIENT":
        return ["CLIENT", "BOTH"]
    if normalized == "SOCIAL_WORKER":
        return ["SOCIAL_WORKER", "BOTH"]
    return ["CLIENT", "SOCIAL_WORKER", "BOTH"]

def normalize_authors(value) -> List[str]:
    if not value:
        return []
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return []
        try:
            arr = json.loads(s)
            if isinstance(arr, list):
                return [str(x).strip() for x in arr if str(x).strip()][:12]
        except Exception:
            pass
        return [x.strip() for x in re.split(r"[,;\n]+", s) if x.strip()][:12]
    authors: List[str] = []
    if isinstance(value, (list, tuple, set)):
        for item in value:
            if not item:
                continue
            if isinstance(item, str):
                cleaned = item.strip()
                if cleaned:
                    authors.append(cleaned)
    return authors[:12]

def normalize_tags(value) -> List[str]:
    if not value:
        return []
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return []
        try:
            arr = json.loads(s)
            if isinstance(arr, list):
                return [str(x).strip() for x in arr if str(x).strip()][:30]
        except Exception:
            pass
        return [x.strip() for x in re.split(r"[,;\n]+", s) if x.strip()][:30]
    out: List[str] = []
    if isinstance(value, (list, tuple, set)):
        for item in value:
            if not item:
                continue
            s = str(item).strip()
            if s:
                out.append(s)
    return out[:30]

MAX_TAG_TOKEN_SLOTS = 8
MAX_AUTHOR_TOKEN_SLOTS = 12

def _normalize_token_text(value: object) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return ""
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def normalize_tag_tokens(value) -> List[str]:
    tags = normalize_tags(value)
    out: List[str] = []
    seen = set()

    def _push(token: str):
        cleaned = _normalize_token_text(token)
        if not cleaned or cleaned in seen:
            return
        seen.add(cleaned)
        out.append(cleaned)

    for tag in tags:
        cleaned_tag = _normalize_token_text(tag)
        if not cleaned_tag:
            continue
        for part in re.split(r"[^a-z0-9]+", cleaned_tag):
            if not part:
                continue
            _push(part)
            if 4 <= len(part) <= 5 and part.endswith("i"):
                _push(part[:-1])
            if len(part) >= 6 and part.endswith("mine"):
                _push(part[:-1])
    return out[:30]

def build_tag_token_metadata(value) -> Dict[str, object]:
    tag_tokens = normalize_tag_tokens(value)
    meta: Dict[str, object] = {
        "tag_tokens": tag_tokens,
        "tagTokens": tag_tokens,
    }
    for idx in range(MAX_TAG_TOKEN_SLOTS):
        key = f"tag_token_{idx + 1}"
        meta[key] = tag_tokens[idx] if idx < len(tag_tokens) else None
    return meta


def normalize_author_tokens(value) -> List[str]:
    out: List[str] = []
    for author in normalize_authors(value):
        token = _normalize_token_text(author)
        if token and token not in out:
            out.append(token)
    return out[:MAX_AUTHOR_TOKEN_SLOTS]


def build_author_token_metadata(value) -> Dict[str, object]:
    tokens = normalize_author_tokens(value)
    meta: Dict[str, object] = {}
    for idx in range(MAX_AUTHOR_TOKEN_SLOTS):
        meta[f"author_token_{idx + 1}"] = tokens[idx] if idx < len(tokens) else None
    return meta

def normalize_issue_id(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    v = value.strip()
    return v or None

def normalize_issue_label(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    v = value.strip()
    return v or None

def normalize_article_id(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    v = value.strip()
    return v or None

def _safe_doc_id_segment(value: object) -> str:
    raw = str(value or "").strip().lower()
    cleaned = re.sub(r"[^a-z0-9]+", "-", raw).strip("-")
    return cleaned or hashlib.sha1(str(value or "").encode("utf-8")).hexdigest()[:12]

def resolve_pdf_metadata_doc_id(meta: Dict) -> Tuple[str, Optional[str]]:
    original_doc_id = str(meta.get("doc_id") or meta.get("docId") or "").strip()
    doc_id = original_doc_id or str(uuid.uuid4())
    article_id = normalize_article_id(str(meta.get("article_id") or meta.get("articleId") or "").strip())

    if not article_id:
        return doc_id, None

    article_segment = _safe_doc_id_segment(article_id)
    if article_segment and article_segment not in _safe_doc_id_segment(doc_id):
        doc_id = f"{doc_id.rstrip('-_:')}-{article_segment}"

    if original_doc_id and doc_id != original_doc_id:
        meta["original_doc_id"] = original_doc_id
        meta["originalDocId"] = original_doc_id

    return doc_id, original_doc_id if doc_id != original_doc_id else None

def normalize_section(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    v = value.strip()
    return v or None

def normalize_year(value) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        year = int(value)
        return year if 1800 <= year <= 2100 else None
    except (TypeError, ValueError):
        return None

def normalize_pages(value) -> List[int]:
    if value is None:
        return []
    out: List[int] = []
    if isinstance(value, str):
        parts = re.split(r"[,\s;]+", value)
        for part in parts:
            if not part:
                continue
            try:
                out.append(int(part))
            except ValueError:
                continue
        return out[:50]
    if isinstance(value, (list, tuple, set)):
        for item in value:
            try:
                num = int(item)
                out.append(num)
            except (TypeError, ValueError):
                continue
    return out[:50]

def normalize_country(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    v = str(value).strip().upper()
    if not v:
        return None
    # Keep ISO-like compact values as-is, otherwise cap length for safety.
    return v if len(v) <= 6 else v[:6]

def normalize_jurisdiction(value: Optional[str]) -> str:
    if not value:
        return "UNKNOWN"
    v = str(value).strip().upper()
    return v if v in JURISDICTION_VALUES else "UNKNOWN"

def _stringify_meta(value) -> Optional[str]:
    """
    Chroma metadata does not accept arrays or objects; flatten lists/sets and
    serialize dicts before upsert.
    Keep None as None, other scalars unchanged.
    """
    if value is None:
        return None
    if isinstance(value, (list, tuple, set)):
        parts = []
        for item in value:
            if item is None:
                continue
            s = str(item).strip()
            if s:
                parts.append(s)
        return ", ".join(parts) if parts else None
    if isinstance(value, dict):
        try:
            return json.dumps(value, ensure_ascii=False, sort_keys=True)
        except Exception:
            return str(value)
    return value

# --- Helpers for short references -------------------------------------------
def _collapse_pages(pages):
    """[3,4,28,30,33] -> '3–4, 28, 30, 33'"""
    s = sorted({p for p in pages if isinstance(p, int)})
    if not s:
        return ""
    out = []
    start = prev = None
    for p in s:
        if start is None:
            start = prev = p
            continue
        if p == prev + 1:
            prev = p
            continue
        out.append(f"{start}" if start == prev else f"{start}–{prev}")
        start = prev = p
    out.append(f"{start}" if start == prev else f"{start}–{prev}")
    return ", ".join(out)

def _coerce_page_number(val) -> Optional[int]:
    try:
        if val is None:
            return None
        if isinstance(val, bool):
            return None
        if isinstance(val, (int, float)):
            n = int(val)
        else:
            s = str(val).strip()
            if not s:
                return None
            n = int(s)
        return n if n > 0 else None
    except Exception:
        return None

def _first_author(authors):
    if not authors:
        return None
    if isinstance(authors, list):
        return authors[0] if authors else None
    return str(authors).strip() or None

def _short_issue(meta):
    """Return issue id/label/year for display (no hard-coded journal)."""
    issue = (meta.get("issue") or meta.get("issue_id") or "").strip()
    if issue:
        return issue
    year = meta.get("year")
    if isinstance(year, int):
        return str(year)
    try:
        yy = int(str(year))
        return str(yy)
    except Exception:
        return ""

def _make_short_ref(meta, pages_compact):
    author = _first_author(meta.get("authors"))
    title = (meta.get("title") or "").strip()
    year = meta.get("year")
    issue = _short_issue(meta)
    journal = (meta.get("journal_title") or meta.get("journalTitle") or "").strip()
    issue_str = " ".join([p for p in [journal, issue] if p]).strip()
    pages_str = f"lk {pages_compact}" if pages_compact else ""
    # Compose
    parts = []
    if author and year and title:
        parts.append(f"{author} ({year}) — {title}")
    elif author and title:
        parts.append(f"{author} — {title}")
    elif title:
        parts.append(title)
    elif author:
        parts.append(author)
    if issue_str:
        parts.append(issue_str)
    if pages_str:
        parts.append(pages_str)
    return (". ".join(parts).strip() + ".") if parts else ""

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _load_registry() -> Dict[str, Dict]:
    return REGISTRY_STORE.load()

def _require_key(x_api_key: Optional[str] = Header(default=None, alias="X-API-Key")) -> None:
    if RAG_AUTH_CONFIG.insecure_no_auth:
        return
    if not x_api_key or not secrets.compare_digest(x_api_key, RAG_SERVICE_API_KEY):
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")

def _require_registry_available() -> None:
    REGISTRY_STORE.load()

def _bytes_mb(b: bytes) -> float:
    return len(b) / (1024 * 1024)

def _to_int(value) -> Optional[int]:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except Exception:
        return None

def _clean_observability_value(value: Optional[str], max_len: int = 200) -> Optional[str]:
    if value is None:
        return None
    cleaned = str(value).strip()
    if not cleaned:
        return None
    return cleaned[:max_len]

def _safe_search_observability_stage(value: Optional[str]) -> str:
    """Allow only known non-content search stage labels into stage logs."""
    cleaned = _clean_observability_value(value, max_len=100)
    if not cleaned:
        return "unknown"
    if cleaned == "rag_search":
        return cleaned
    if re.fullmatch(
        r"rag_search_(?:graph_channel|national_fallback|background_scope|"
        r"kov_regulation_package_candidates|q\d+|temporal_fill_\d{4})(?:_q\d+)?",
        cleaned,
    ):
        return cleaned
    return "unknown"

def _request_content_length(request: Optional[Request]) -> Optional[int]:
    if request is None:
        return None
    return _to_int(request.headers.get("content-length"))

def _build_observability_context(
    request: Optional[Request],
    service_stage: str,
    **extra,
) -> Dict[str, object]:
    service_route = request.url.path if request is not None else None
    upstream_route = _clean_observability_value(
        request.headers.get(OBSERVABILITY_ROUTE_HEADER) if request is not None else None
    )
    upstream_stage = _clean_observability_value(
        request.headers.get(OBSERVABILITY_STAGE_HEADER) if request is not None else None
    )
    user_id = _clean_observability_value(
        request.headers.get(OBSERVABILITY_USER_ID_HEADER) if request is not None else None
    )
    role = _clean_observability_value(
        request.headers.get(OBSERVABILITY_ROLE_HEADER) if request is not None else None
    )
    conversation_id = _clean_observability_value(
        request.headers.get(OBSERVABILITY_CONVERSATION_ID_HEADER) if request is not None else None
    )
    artifact_id = _clean_observability_value(
        request.headers.get(OBSERVABILITY_ARTIFACT_ID_HEADER) if request is not None else None
    )
    research_job_id = _clean_observability_value(
        request.headers.get(OBSERVABILITY_RESEARCH_JOB_ID_HEADER) if request is not None else None
    )
    context: Dict[str, object] = {
        "route": upstream_route or service_route,
        "stage": upstream_stage or service_stage,
        "upstream_route": upstream_route,
        "upstream_stage": upstream_stage,
        "service_route": service_route,
        "service_stage": service_stage,
        "request_size_bytes": _request_content_length(request),
        "userId": user_id,
        "role": role,
        "conversation_id": conversation_id,
        "artifact_id": artifact_id,
        "research_job_id": research_job_id,
    }
    for key, value in extra.items():
        if value is not None:
            context[key] = value
    return context

def _mirror_rag_cost_usage(payload: Dict[str, object]) -> None:
    if not RAG_COST_MIRROR_URL or not RAG_COST_MIRROR_SECRET:
        return
    try:
        response = requests.post(
            RAG_COST_MIRROR_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {RAG_COST_MIRROR_SECRET}",
                "Content-Type": "application/json",
            },
            timeout=max(0.2, float(RAG_COST_MIRROR_TIMEOUT_SEC)),
        )
        if response.status_code < 200 or response.status_code >= 300:
            logger.warning(
                "[rag][cost][mirror] failed status=%s event_id=%s",
                response.status_code,
                payload.get("event_id"),
            )
    except Exception as exc:
        logger.warning(
            "[rag][cost][mirror] failed event_id=%s error=%s",
            payload.get("event_id"),
            exc.__class__.__name__,
        )

def _log_rag_cost_usage(
    *,
    model: Optional[str],
    latency_ms: Optional[float],
    prompt_tokens: Optional[int],
    total_tokens: Optional[int],
    embedding_input_count: int,
    text_chars: Optional[int],
    chunk_count: Optional[int],
    result_count: Optional[int] = None,
    top_k: Optional[int] = None,
    embedding_calls: int = 1,
    cost_read_directly: bool = True,
    **context,
) -> None:
    payload = {
        "event": "rag_cost_usage",
        "event_id": str(uuid.uuid4()),
        "provider": "openai",
        "model": model or EMBED_MODEL,
        "userId": context.get("userId"),
        "role": context.get("role"),
        "route": context.get("route"),
        "stage": context.get("stage"),
        "upstream_route": context.get("upstream_route"),
        "upstream_stage": context.get("upstream_stage"),
        "service_route": context.get("service_route"),
        "service_stage": context.get("service_stage"),
        "conversation_id": context.get("conversation_id"),
        "artifact_id": context.get("artifact_id"),
        "research_job_id": context.get("research_job_id"),
        "latency_ms": round(float(latency_ms), 2) if latency_ms is not None else None,
        "request_size_bytes": context.get("request_size_bytes"),
        "file_size_bytes": context.get("file_size_bytes"),
        "text_chars": text_chars,
        "prompt_tokens": prompt_tokens,
        "total_tokens": total_tokens,
        "embedding_calls": embedding_calls,
        "embedding_input_count": embedding_input_count,
        "chunk_count": chunk_count,
        "result_count": result_count,
        "top_k": top_k,
        "doc_id": context.get("doc_id"),
        "article_count": context.get("article_count"),
        "cost_read_directly": cost_read_directly,
    }
    try:
        logger.info("[rag][cost] %s", json.dumps(payload, ensure_ascii=False, sort_keys=True))
    except Exception:
        logger.info("[rag][cost] %s", payload)
    _mirror_rag_cost_usage(payload)

def _detect_mime(name: str, data: bytes, declared: Optional[str]) -> str:
    if declared:
        return declared
    if _MAGIC_OK:
        try:
            return magic.from_buffer(data, mime=True)  # type: ignore
        except Exception:
            pass
    return mimetypes.guess_type(name)[0] or "application/octet-stream"

def _clean_text(s: str) -> str:
    """
    Normaliseeri tekst:
    - CRLF/CR -> LF
    - Eemalda hüüdega poolitused: 'sotsiaal-\\ntöö' -> 'sotsiaaltöö' (väike+väike)
    - Jäta hüüdega sidekriips alles muudel juhtudel: 'COVID-\\n19' -> 'COVID-19'
    - Ülejäänud reavahetused -> tühik; mitmik-tühikud -> üks
    """
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    # 1) poolitus: väiketäht + '-\\n' + väiketäht  => liida kokku ilma kriipsuta
    s = re.sub(r"([a-zäöüõ])-\s*\n\s*([a-zäöüõ])", r"\1\2", s, flags=re.IGNORECASE)
    # 2) muu '-\\n' jääb sidekriipsuga (nt COVID-\\n19)
    s = re.sub(r"-\s*\n\s*", "-", s)
    # 3) ülejäänud reavahetused tühikuks
    s = re.sub(r"\s*\n\s*", " ", s)
    # 4) mitmik-tühikud üheks
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()

ESTONIA_NATIONAL_HOSTS = {
    "riigiteataja.ee",
    "eesti.ee",
    "valitsus.ee",
    "riigikogu.ee",
    "sm.ee",
    "sotsiaalkindlustusamet.ee",
    "tootukassa.ee",
}
ESTONIA_NATIONAL_HOST_SUFFIXES = (".riik.ee",)
ESTONIA_GENERIC_SUBDOMAINS = {"www", "www2", "m", "admin", "portal"}

def _host_without_www(host: str) -> str:
    host = (host or "").strip().lower()
    if host.startswith("www."):
        return host[4:]
    return host

def _guess_municipality_name(host: str, text: str) -> Optional[str]:
    # Prefer explicit "X linna/vallavalitsus" mention from page text.
    match = re.search(r"\b([A-Za-zÕÄÖÜõäöü\-]{3,})\s+(linna|valla)\s*valitsus\b", text, flags=re.IGNORECASE)
    if match:
        return match.group(1).replace("-", " ").strip().title()

    labels = [lbl for lbl in _host_without_www(host).split(".") if lbl]
    if not labels:
        return None
    first = labels[0]
    if first in ESTONIA_GENERIC_SUBDOMAINS and len(labels) > 1:
        first = labels[1]
    first = first.replace("-", " ").strip()
    if not first:
        return None
    return first.title()

def infer_url_geo_metadata(url: str, title: Optional[str], extracted_text: str) -> Dict[str, Optional[str]]:
    parsed = urlparse(url)
    host = _host_without_www(parsed.hostname or "")
    scan_text = f"{title or ''} {extracted_text[:6000]}".lower()

    country = "EE" if host.endswith(".ee") else None
    jurisdiction = "UNKNOWN"
    confidence = "low"

    if host in ESTONIA_NATIONAL_HOSTS or any(host.endswith(sfx) for sfx in ESTONIA_NATIONAL_HOST_SUFFIXES):
        jurisdiction = "NATIONAL"
        confidence = "high"
    elif "linnavalitsus" in host or " linnavalitsus" in scan_text:
        jurisdiction = "CITY_GOVERNMENT"
        confidence = "high"
    elif (
        "vallavalitsus" in host
        or "omavalitsus" in host
        or " vallavalitsus" in scan_text
        or " kohalik omavalitsus" in scan_text
        or " omavalitsus" in scan_text
    ):
        jurisdiction = "MUNICIPALITY"
        confidence = "medium"
    elif " ministeerium" in scan_text or " vabariigi valitsus" in scan_text:
        jurisdiction = "NATIONAL"
        confidence = "medium"

    municipality_name = None
    if jurisdiction in {"MUNICIPALITY", "CITY_GOVERNMENT"}:
        municipality_name = _guess_municipality_name(host, extracted_text)

    return {
        "country": country,
        "jurisdiction_level": jurisdiction,
        "municipality_name": municipality_name,
        "geo_detection_method": "url_heuristic",
        "geo_detection_confidence": confidence,
    }

def _fetch_remote_html(url: str) -> str:
    current = str(url or "").strip()
    for _ in range(5):
        try:
            pinned_response = open_pinned_response(
                current,
                allow_private=ALLOW_PRIVATE_URL_FETCH,
                timeout_seconds=30,
            )
        except PinnedFetchRejected as exc:
            raise HTTPException(422, {"code": "URL_FETCH_REJECTED", "reason": str(exc)}) from exc
        with pinned_response as response:
                if 300 <= response.status_code < 400:
                    location = response.headers.get("location")
                    if not location:
                        raise HTTPException(422, f"Redirect without location: HTTP {response.status_code}")
                    # The next loop resolves, pins and peer-verifies the redirect target anew.
                    current = urljoin(current, location)
                    continue

                response.raise_for_status()

                declared_len = response.headers.get("content-length")
                if declared_len:
                    try:
                        if int(declared_len) > URL_FETCH_MAX_BYTES:
                            raise HTTPException(413, f"Fetched URL is too large ({declared_len} bytes).")
                    except ValueError:
                        pass

                chunks = []
                total = 0
                for chunk in response.iter_content(chunk_size=64 * 1024):
                    if not chunk:
                        continue
                    total += len(chunk)
                    if total > URL_FETCH_MAX_BYTES:
                        raise HTTPException(413, f"Fetched URL exceeds {URL_FETCH_MAX_BYTES} bytes.")
                    chunks.append(chunk)

                encoding = response.encoding or "utf-8"
                return b"".join(chunks).decode(encoding, errors="ignore")

    raise HTTPException(422, "Too many redirects while fetching URL.")

# --- PDF / DOCX / HTML extractors ---
def _extract_text_from_pdf(buff: bytes) -> List[Tuple[int, str]]:
    """Tagasta list (page_no, text)."""
    try:
        return parse_document("pdf", buff, PARSER_LIMITS)
    except ParserRejected as exc:
        raise HTTPException(422, {"code": "DOCUMENT_PARSE_REJECTED", "reason": str(exc)}) from exc

def _extract_text_from_docx(buff: bytes) -> str:
    try:
        return str(parse_document("docx", buff, PARSER_LIMITS) or "")
    except ParserRejected as exc:
        raise HTTPException(422, {"code": "DOCUMENT_PARSE_REJECTED", "reason": str(exc)}) from exc

def _extract_text_from_html(html: str) -> str:
    try:
        return str(parse_document("html", html.encode("utf-8"), PARSER_LIMITS) or "")
    except ParserRejected as exc:
        raise HTTPException(422, {"code": "DOCUMENT_PARSE_REJECTED", "reason": str(exc)}) from exc

# --- Chunking ---
_TOKEN_ENCODER_CACHE = None

def _get_token_encoder():
    global _TOKEN_ENCODER_CACHE
    if _TOKEN_ENCODER_CACHE:
        return _TOKEN_ENCODER_CACHE
    if not _TIKTOKEN_OK:
        return None
    enc = None
    try:
        # Prefer model-specific encoding if available
        enc = tiktoken.encoding_for_model(EMBED_MODEL)
    except Exception:
        try:
            enc = tiktoken.get_encoding("cl100k_base")
        except Exception:
            enc = None
    _TOKEN_ENCODER_CACHE = enc
    return enc

def _split_chunks_chars(text: str, max_chars: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    text = _clean_text(text)
    if not text:
        return []
    chunks: List[str] = []
    n = len(text)
    start = 0
    while start < n:
        end = min(n, start + max_chars)
        window = text[start:end]
        cut = len(window)
        used_sentence_cut = False
        if end < n:
            candidates = [window.rfind(". "), window.rfind("! "), window.rfind("? "), window.rfind("\n\n")]
            best = max(candidates)
            if best != -1 and best > len(window) * 0.5:
                cut = best + 1
                used_sentence_cut = True
            else:
                word_boundary = max(window.rfind(" "), window.rfind("\n"), window.rfind("\t"))
                if word_boundary > len(window) * 0.5:
                    cut = word_boundary
        chunk = _clean_text(window[:cut])
        if chunk:
            chunks.append(chunk)
        if end >= n:
            break
        chunk_end = start + cut
        overlap_target = max(start + 1, chunk_end - max(0, overlap))
        emitted = text[start:chunk_end]
        sentence_starts: List[int] = []
        for boundary in re.finditer(r"[.!?](?=\s|$)|\n{2,}", emitted):
            candidate = start + boundary.end()
            while candidate < chunk_end and text[candidate].isspace():
                candidate += 1
            if overlap_target <= candidate < chunk_end:
                sentence_starts.append(candidate)
        if sentence_starts:
            next_start = sentence_starts[0]
        elif used_sentence_cut:
            next_start = chunk_end
        else:
            word_start = overlap_target
            while word_start < chunk_end and not text[word_start - 1].isspace():
                word_start += 1
            while word_start < chunk_end and text[word_start].isspace():
                word_start += 1
            next_start = word_start if word_start < chunk_end else overlap_target
        start = max(start + 1, next_start)
    return chunks

def _split_chunks_tokens(text: str, max_tokens: int = CHUNK_TOKENS, overlap_tokens: int = CHUNK_TOKENS_OVERLAP) -> List[str]:
    enc = _get_token_encoder()
    if enc is None:
        # Fallback if tiktoken unavailable
        approx_chars = max_tokens * 4
        approx_overlap = overlap_tokens * 4
        return _split_chunks_chars(text, approx_chars, approx_overlap)
    cleaned = _clean_text(text)
    if not cleaned:
        return []
    max_tokens = max(1, int(max_tokens or 1))
    overlap_tokens = max(0, min(max_tokens - 1, int(overlap_tokens or 0)))

    def token_count(value: str) -> int:
        return len(enc.encode(value))

    def join_units(units: List[str]) -> str:
        return _clean_text(" ".join(unit for unit in units if unit))

    # Keep ordinary sentences intact. Fixed token windows used to begin in the
    # middle of a word or claim, so an organization named at the end of one
    # chunk could be detached from its country or system in the next chunk.
    units: List[str] = []
    start = 0
    for boundary in re.finditer(r"[.!?](?=\s|$)|\n{2,}", cleaned):
        end = boundary.end()
        unit = _clean_text(cleaned[start:end])
        if unit:
            units.append(unit)
        start = end
    tail = _clean_text(cleaned[start:])
    if tail:
        units.append(tail)
    if not units:
        units = [cleaned]

    def split_oversized_unit(unit: str) -> List[str]:
        words = re.findall(r"\S+", unit)
        if not words:
            return []
        pieces: List[str] = []
        current_words: List[str] = []
        for word in words:
            candidate = " ".join([*current_words, word])
            if current_words and token_count(candidate) > max_tokens:
                pieces.append(" ".join(current_words))
                overlap_words: List[str] = []
                for previous_word in reversed(current_words):
                    proposed = [previous_word, *overlap_words]
                    if token_count(" ".join(proposed)) > overlap_tokens:
                        break
                    overlap_words = proposed
                current_words = overlap_words
                while current_words and token_count(" ".join([*current_words, word])) > max_tokens:
                    current_words.pop(0)
            current_words.append(word)
        if current_words:
            pieces.append(" ".join(current_words))
        return pieces

    chunks: List[str] = []
    current_units: List[str] = []

    def flush_current() -> None:
        chunk = join_units(current_units)
        if chunk and (not chunks or chunk != chunks[-1]):
            chunks.append(chunk)

    for unit in units:
        if token_count(unit) > max_tokens:
            if current_units:
                flush_current()
                current_units = []
            oversized_pieces = split_oversized_unit(unit)
            if oversized_pieces:
                chunks.extend(piece for piece in oversized_pieces if not chunks or piece != chunks[-1])
            continue

        candidate = join_units([*current_units, unit])
        if current_units and token_count(candidate) > max_tokens:
            previous_units = list(current_units)
            flush_current()
            overlap_units: List[str] = []
            for previous_unit in reversed(previous_units):
                proposed = [previous_unit, *overlap_units]
                if token_count(join_units(proposed)) > overlap_tokens:
                    break
                overlap_units = proposed
            current_units = overlap_units
            while current_units and token_count(join_units([*current_units, unit])) > max_tokens:
                current_units.pop(0)
        current_units.append(unit)

    if current_units:
        flush_current()
    return chunks

def _split_chunks(text: str) -> List[str]:
    """Choose token- or char-based chunking based on env and availability."""
    mode = CHUNK_MODE
    if mode == "tokens" and _TIKTOKEN_OK:
        return _split_chunks_tokens(text)
    # fallback
    return _split_chunks_chars(text)

def _doc_dir_hashed(doc_id: str) -> Path:
    return STORAGE_DIR / "docs" / hashlib.sha1(doc_id.encode("utf-8")).hexdigest()[:12]

def _doc_dir(doc_id: str) -> Path:
    d = _doc_dir_hashed(doc_id)
    d.mkdir(parents=True, exist_ok=True)
    return d

def _sanitize_filename(name: str, fallback: str = "document.pdf") -> str:
    # Üks reegel, üks koht (SOL-RAGSVC-01): teine koopia lahkneks vaikselt ja
    # täpselt siin oli vahe kallis — `main.py` vana versioon ei võtnud `\` maha.
    return safe_basename(name, fallback)


def _storage_path_or_404(raw_path: object, what: str) -> Path:
    """Registris olev tee, mis TÕENDATULT jääb hoidlasse (SOL-RAGSVC-02).

    404, mitte 400: kutsuja küsib dokumendi allikat ja hoidlast välja osutav
    rida ei ole „vigane päring", vaid „sellist allikat ei ole". Vana register
    võib sisaldada ridu, mille `path` osutab suvalisse serverikohta — nemad
    kaovad siit vaikselt ära ega anna kellelegi baiti.
    """
    try:
        return resolve_within(STORAGE_DIR, str(raw_path or ""))
    except PathOutsideStorage:
        logger.warning("Refused to serve %s outside RAG storage: %r", what, raw_path)
        raise HTTPException(404, f"Stored {what} is missing")

# --- OpenAI embedding helpers ---
# OpenAI embeddings API limits (text-embedding-3-*): <=2048 inputs and
# <=300k tokens per request, <=8192 tokens per single input. A large document
# (hundreds of chunks) sent as one request can exceed the per-request token
# limit and fail with BadRequest, so we pack the inputs into safe sub-batches.
EMBED_MAX_INPUTS_PER_REQUEST = int(os.getenv("RAG_EMBED_MAX_INPUTS_PER_REQUEST", "96"))
EMBED_MAX_TOKENS_PER_REQUEST = int(os.getenv("RAG_EMBED_MAX_TOKENS_PER_REQUEST", "200000"))
EMBED_MAX_TOKENS_PER_INPUT = int(os.getenv("RAG_EMBED_MAX_TOKENS_PER_INPUT", "8000"))


def _estimate_tokens(text: str) -> int:
    enc = _get_token_encoder()
    if enc is not None:
        try:
            return len(enc.encode(text or ""))
        except Exception:
            pass
    # Fallback heuristic: ~4 chars per token.
    return max(1, len(str(text or "")) // 4)


def _truncate_to_tokens(text: str, max_tokens: int) -> str:
    enc = _get_token_encoder()
    if enc is not None:
        try:
            tokens = enc.encode(text or "")
            if len(tokens) <= max_tokens:
                return text
            return enc.decode(tokens[:max_tokens])
        except Exception:
            pass
    # Fallback: char-based cap (~4 chars per token).
    max_chars = max_tokens * 4
    return text if len(text) <= max_chars else text[:max_chars]


def _pack_embedding_subbatches(texts: List[str]) -> List[List[str]]:
    """Pack inputs into sub-batches that respect input-count and token limits."""
    batches: List[List[str]] = []
    current: List[str] = []
    current_tokens = 0
    for text in texts:
        safe_text = _truncate_to_tokens(text or "", EMBED_MAX_TOKENS_PER_INPUT)
        if safe_text != (text or ""):
            raise HTTPException(
                413,
                {"code": "EMBEDDING_INPUT_TOO_LARGE", "max_tokens": EMBED_MAX_TOKENS_PER_INPUT},
            )
        tokens = _estimate_tokens(safe_text)
        too_many_inputs = len(current) >= EMBED_MAX_INPUTS_PER_REQUEST
        too_many_tokens = current and (current_tokens + tokens) > EMBED_MAX_TOKENS_PER_REQUEST
        if too_many_inputs or too_many_tokens:
            batches.append(current)
            current = []
            current_tokens = 0
        current.append(safe_text)
        current_tokens += tokens
    if current:
        batches.append(current)
    return batches


def _embed_subbatch_raw(texts: List[str]):
    try:
        return oa.embeddings.create(model=EMBED_MODEL, input=texts)
    except RateLimitError as exc:
        logger.warning("OpenAI embeddings quota/rate limit error: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="OpenAI embeddings quota/rate limit error. Check OPENAI_API_KEY billing/quota for the RAG service.",
        ) from exc
    except OpenAIError as exc:
        logger.exception("OpenAI embeddings request failed")
        raise HTTPException(
            status_code=502,
            detail=f"OpenAI embeddings request failed: {exc.__class__.__name__}",
        ) from exc


def _embed_batch_with_usage(texts: List[str]) -> Dict[str, object]:
    if not texts:
        return {
            "embeddings": [],
            "model": EMBED_MODEL,
            "prompt_tokens": 0,
            "total_tokens": 0,
            "latency_ms": 0.0,
            "embedding_input_count": 0,
            "embedding_calls": 0,
            "text_chars": 0,
            "cost_read_directly": False,
        }
    started = perf_counter()
    subbatches = _pack_embedding_subbatches(texts)
    embeddings: List[List[float]] = []
    prompt_tokens = 0
    total_tokens = 0
    usage_seen = False
    resolved_model = EMBED_MODEL
    for batch in subbatches:
        resp = _embed_subbatch_raw(batch)
        embeddings.extend(d.embedding for d in resp.data)
        resolved_model = getattr(resp, "model", EMBED_MODEL) or EMBED_MODEL
        usage = getattr(resp, "usage", None)
        if usage is not None:
            usage_seen = True
            prompt_tokens += getattr(usage, "prompt_tokens", 0) or 0
            total_tokens += getattr(usage, "total_tokens", 0) or 0
    latency_ms = (perf_counter() - started) * 1000
    return {
        "embeddings": embeddings,
        "model": resolved_model,
        "prompt_tokens": prompt_tokens if usage_seen else None,
        "total_tokens": total_tokens if usage_seen else None,
        "latency_ms": latency_ms,
        "embedding_input_count": len(texts),
        "embedding_calls": len(subbatches),
        "text_chars": sum(len(str(text or "")) for text in texts),
        "cost_read_directly": usage_seen,
    }

def _embed_batch(texts: List[str]) -> List[List[float]]:
    return list(_embed_batch_with_usage(texts).get("embeddings") or [])

# --------------------
# Schemas
# --------------------
class RagMetadata(BaseModel):
    model_config = {"populate_by_name": True, "extra": "allow"}

    docId: Optional[str] = None
    articleId: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    authors: List[str] = Field(default_factory=list)
    year: Optional[int | str] = None
    journalTitle: Optional[str] = None
    issueLabel: Optional[str] = None
    issueId: Optional[str] = None
    section: Optional[str] = None
    audience: Optional[str] = "BOTH"
    audiences: List[str] = Field(default_factory=list)
    metadata_schema_version: Optional[str] = None
    source_id: Optional[str] = None
    document_id: Optional[str] = None
    source_type: Optional[str] = None
    legacy_source_type: Optional[str] = None
    authority: Optional[str] = None
    source_path: Optional[str] = None
    source_url: Optional[str] = None
    url_canonical: Optional[str] = None
    retrieved_at: Optional[str] = None
    last_checked: Optional[str] = None
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None
    historical: Optional[bool] = None
    source_status: Optional[str] = None
    canonical_item_id: Optional[str] = None
    content_hash: Optional[str] = None
    pageRange: Optional[str] = None
    page: Optional[int] = None
    pdf_start_page: Optional[int] = None
    pdf_end_page: Optional[int] = None
    language: Optional[str] = "et"
    tags: List[str] = Field(default_factory=list)
    pages: List[int] = Field(default_factory=list)
    regulationRefs: List[str] = Field(default_factory=list)
    publisher: Optional[str] = None
    doi: Optional[str] = None
    url: Optional[str] = None
    level: Optional[str] = None
    importance: Optional[str] = None
    collection_id: Optional[str] = None
    country: Optional[str] = None
    county: Optional[str] = None
    jurisdiction_level: Optional[str] = "UNKNOWN"
    municipality_name: Optional[str] = None
    municipality_id: Optional[str] = None
    district_name: Optional[str] = None
    district_id: Optional[str] = None
    checked_at: Optional[str] = None
    item_type: Optional[str] = None
    content_status: Optional[str] = None
    resource_type: Optional[str] = None
    source_keys: List[str] = Field(default_factory=list)
    source_urls: List[str] = Field(default_factory=list)
    source_register_file: Optional[str] = None
    source_count: Optional[int] = None
    administering_body: Optional[str] = None
    geo_detection_method: Optional[str] = None
    geo_detection_confidence: Optional[str] = None

    @field_validator("authors", mode="before")
    @classmethod
    def _validate_authors(cls, value):
        return normalize_authors(value)

    @field_validator("tags", mode="before")
    @classmethod
    def _validate_tags(cls, value):
        return normalize_tags(value)

    @field_validator("pages", mode="before")
    @classmethod
    def _validate_pages(cls, value):
        return normalize_pages(value)

    @field_validator("audiences", mode="before")
    @classmethod
    def _validate_audiences(cls, value):
        return normalize_audience_list(value)

    @field_validator("audience", mode="before")
    @classmethod
    def _validate_audience(cls, value):
        return normalize_audience(value)

    @field_validator("language", mode="before")
    @classmethod
    def _validate_language(cls, value):
        return (str(value or "et").strip() or "et").lower()

    @field_validator("country", mode="before")
    @classmethod
    def _validate_country(cls, value):
        return normalize_country(value)

    @field_validator("source_keys", "source_urls", mode="before")
    @classmethod
    def _validate_string_lists(cls, value):
        return normalize_string_list(value)

    @field_validator("jurisdiction_level", mode="before")
    @classmethod
    def _validate_jurisdiction(cls, value):
        return normalize_jurisdiction(value)

    @field_validator("year", mode="before")
    @classmethod
    def _validate_year(cls, value):
        yr = normalize_year(value)
        if yr is not None:
            return yr
        if value is None or value == "":
            return None
        return str(value).strip()

    @field_validator(
        "issueLabel",
        "issueId",
        "articleId",
        "section",
        "journalTitle",
        "metadata_schema_version",
        "title",
        "description",
        "pageRange",
        "publisher",
        "doi",
        "url",
        "level",
        "importance",
        "collection_id",
        "country",
        "county",
        "jurisdiction_level",
        "municipality_name",
        "municipality_id",
        "district_name",
        "district_id",
        "checked_at",
        "item_type",
        "content_status",
        "resource_type",
        "source_register_file",
        "administering_body",
        "geo_detection_method",
        "geo_detection_confidence",
        mode="before",
    )
    @classmethod
    def _strip_strings(cls, value):
        return value.strip() if isinstance(value, str) else value


def build_rag_metadata(meta_common: Dict, doc_id: Optional[str] = None) -> RagMetadata:
    meta = meta_common or {}
    def _first_value(*values):
        for value in values:
            if isinstance(value, list):
                if len(value) > 0:
                    return value
                continue
            if value is None:
                continue
            if isinstance(value, str) and not value.strip():
                continue
            return value
        return None

    def _clean_date(value):
        raw = str(value or "").strip()
        if not raw:
            return None
        match = re.match(r"^(\d{4}-\d{2}-\d{2})", raw)
        return match.group(1) if match else None

    def _normalize_bool(value):
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"true", "1", "yes", "on"}:
                return True
            if normalized in {"false", "0", "no", "off"}:
                return False
        return None

    def _derive_historical():
        explicit = _normalize_bool(_first_value(meta.get("historical"), meta.get("is_historical"), meta.get("isHistorical")))
        if explicit is not None:
            return explicit
        current = _normalize_bool(_first_value(meta.get("is_current_version"), meta.get("isCurrentVersion")))
        if current is not None:
            return not current
        return False

    def _derive_source_status():
        explicit = str(_first_value(meta.get("source_status"), meta.get("sourceStatus")) or "").strip().lower()
        if explicit:
            return explicit
        content_status = str(_first_value(meta.get("content_status"), meta.get("contentStatus"), meta.get("status")) or "").strip().lower()
        if content_status in {"active", "current", "kehtiv"}:
            return "active"
        if content_status in {"inactive"}:
            return "inactive"
        if content_status in {"ended", "archived"}:
            return "archived"
        current = _normalize_bool(_first_value(meta.get("is_current_version"), meta.get("isCurrentVersion")))
        if current is False:
            return "archived"
        if current is True:
            return "active"
        return "unknown"

    resolved_doc_id = doc_id or meta.get("docId") or meta.get("doc_id")
    metadata_schema_version = _first_value(
        meta.get("metadata_schema_version"),
        meta.get("metadataSchemaVersion"),
        RAG_METADATA_SCHEMA_VERSION,
    )
    resolved_source_id = _first_value(
        meta.get("source_id"),
        meta.get("sourceId"),
        meta.get("canonical_source_id"),
        meta.get("canonicalSourceId"),
    )
    resolved_document_id = _first_value(
        meta.get("document_id"),
        meta.get("documentId"),
        meta.get("docId"),
        resolved_doc_id,
    )
    resolved_url_canonical = _first_value(
        meta.get("url_canonical"),
        meta.get("urlCanonical"),
        meta.get("url"),
        meta.get("source_url"),
        meta.get("sourceUrl"),
    )
    resolved_last_checked = _clean_date(_first_value(
        meta.get("last_checked"),
        meta.get("lastChecked"),
        meta.get("checked_at"),
        meta.get("checkedAt"),
    ))
    resolved_valid_from = _clean_date(_first_value(
        meta.get("valid_from"),
        meta.get("validFrom"),
        meta.get("effective_start"),
        meta.get("effectiveStart"),
    ))
    resolved_valid_to = _clean_date(_first_value(
        meta.get("valid_to"),
        meta.get("validTo"),
        meta.get("effective_end"),
        meta.get("effectiveEnd"),
    ))
    resolved_historical = _derive_historical()
    resolved_source_status = _derive_source_status()
    return RagMetadata(
        docId=resolved_doc_id,
        articleId=meta.get("articleId") or meta.get("article_id"),
        title=meta.get("title"),
        description=meta.get("description"),
        authors=meta.get("authors"),
        year=meta.get("year"),
        journalTitle=meta.get("journalTitle") or meta.get("journal_title"),
        issueLabel=meta.get("issueLabel") or meta.get("issue_label"),
        issueId=meta.get("issueId") or meta.get("issue_id"),
        section=meta.get("section"),
        audience=meta.get("audience"),
        audiences=meta.get("audiences") or meta.get("audience"),
        metadata_schema_version=metadata_schema_version,
        source_id=resolved_source_id,
        document_id=resolved_document_id,
        source_type=meta.get("source_type"),
        legacy_source_type=meta.get("legacy_source_type") or meta.get("legacySourceType"),
        authority=meta.get("authority"),
        source_path=meta.get("source_path"),
        source_url=meta.get("source_url") or meta.get("url"),
        url_canonical=resolved_url_canonical,
        retrieved_at=meta.get("retrieved_at") or meta.get("retrievedAt"),
        last_checked=resolved_last_checked,
        valid_from=resolved_valid_from,
        valid_to=resolved_valid_to,
        historical=resolved_historical,
        source_status=resolved_source_status,
        canonical_item_id=meta.get("canonical_item_id") or meta.get("canonicalItemId"),
        content_hash=meta.get("content_hash") or meta.get("contentHash"),
        pageRange=meta.get("pageRange") or meta.get("page_range"),
        page=meta.get("page"),
        pdf_start_page=meta.get("pdf_start_page") or meta.get("pdfStartPage"),
        pdf_end_page=meta.get("pdf_end_page") or meta.get("pdfEndPage"),
        language=meta.get("language"),
        tags=meta.get("tags"),
        pages=meta.get("pages"),
        regulationRefs=meta.get("regulationRefs") or meta.get("regulation_refs") or [],
        publisher=meta.get("publisher"),
        doi=meta.get("doi"),
        url=meta.get("url"),
        level=meta.get("level"),
        importance=meta.get("importance"),
        collection_id=meta.get("collection_id") or meta.get("collectionId"),
        country=meta.get("country"),
        county=meta.get("county"),
        jurisdiction_level=meta.get("jurisdiction_level") or meta.get("jurisdictionLevel"),
        municipality_name=meta.get("municipality_name") or meta.get("municipalityName"),
        municipality_id=meta.get("municipality_id") or meta.get("municipalityId"),
        district_name=meta.get("district_name") or meta.get("districtName"),
        district_id=meta.get("district_id") or meta.get("districtId"),
        checked_at=meta.get("checked_at") or meta.get("checkedAt") or resolved_last_checked,
        item_type=meta.get("item_type") or meta.get("itemType"),
        content_status=meta.get("content_status") or meta.get("contentStatus") or meta.get("status") or resolved_source_status,
        resource_type=meta.get("resource_type") or meta.get("resourceType"),
        source_keys=meta.get("source_keys") or meta.get("sourceKeys") or [],
        source_urls=meta.get("source_urls") or meta.get("sourceUrls") or [],
        source_register_file=meta.get("source_register_file") or meta.get("sourceRegisterFile"),
        source_count=meta.get("source_count") or meta.get("sourceCount"),
        administering_body=meta.get("administering_body") or meta.get("administeringBody"),
        geo_detection_method=meta.get("geo_detection_method") or meta.get("geoDetectionMethod"),
        geo_detection_confidence=meta.get("geo_detection_confidence") or meta.get("geoDetectionConfidence"),
    )

class IngestFile(BaseModel):
    docId: str
    fileName: str
    mimeType: Optional[str] = None
    data: str = Field(max_length=MAX_REQUEST_BYTES)  # base64
    title: Optional[str] = None
    description: Optional[str] = None
    audience: Optional[str] = None
    authors: Optional[List[str]] = None
    issueId: Optional[str] = None
    issueLabel: Optional[str] = None
    year: Optional[int] = None
    articleId: Optional[str] = None
    section: Optional[str] = None
    pages: Optional[List[int]] = None
    pageRange: Optional[str] = None
    journalTitle: Optional[str] = None  # UUS
    tags: Optional[List[str]] = None
    language: Optional[str] = None
    collection_id: Optional[str] = None
    country: Optional[str] = None
    jurisdiction_level: Optional[str] = None
    municipality_name: Optional[str] = None
    municipality_id: Optional[str] = None
    district_name: Optional[str] = None
    district_id: Optional[str] = None

class IngestText(BaseModel):
    model_config = {"populate_by_name": True, "extra": "allow"}

    doc_id: str
    text: Optional[str] = Field(default=None, max_length=MAX_TEXT_CHARS)
    chunks: List["IngestTextChunk"] = Field(default_factory=list, max_length=MAX_EXPLICIT_CHUNKS)
    metadata: Dict[str, object] = Field(default_factory=dict)

class IngestTextChunk(BaseModel):
    model_config = {"populate_by_name": True, "extra": "allow"}

    text: str = Field(max_length=MAX_EXPLICIT_CHUNK_CHARS)
    metadata: Dict[str, object] = Field(default_factory=dict)

class IngestURL(BaseModel):
    docId: Optional[str] = None
    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    audience: Optional[str] = None
    authors: Optional[List[str]] = None
    issueId: Optional[str] = None
    issueLabel: Optional[str] = None
    year: Optional[int] = None
    articleId: Optional[str] = None
    section: Optional[str] = None
    pages: Optional[List[int]] = None
    pageRange: Optional[str] = None
    journalTitle: Optional[str] = None  # UUS
    tags: Optional[List[str]] = None
    language: Optional[str] = None
    collection_id: Optional[str] = None
    country: Optional[str] = None
    jurisdiction_level: Optional[str] = None
    municipality_name: Optional[str] = None
    municipality_id: Optional[str] = None
    district_name: Optional[str] = None
    district_id: Optional[str] = None

class IngestArticle(BaseModel):
    title: str
    pageRange: Optional[str] = None
    offset: Optional[int] = None
    startPage: Optional[int] = None
    endPage: Optional[int] = None
    authors: Optional[List[str]] = None
    section: Optional[str] = None
    description: Optional[str] = None
    year: Optional[int] = None
    journalTitle: Optional[str] = None
    issueLabel: Optional[str] = None
    articleId: Optional[str] = None
    audience: Optional[str] = None
    tags: Optional[List[str]] = None
    collection_id: Optional[str] = None
    country: Optional[str] = None
    jurisdiction_level: Optional[str] = None
    municipality_name: Optional[str] = None
    municipality_id: Optional[str] = None
    district_name: Optional[str] = None
    district_id: Optional[str] = None

class IngestArticlesIn(BaseModel):
    docId: Optional[str] = None
    articles: List[IngestArticle]

class UpdateMetadata(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    audience: Optional[str] = None
    authors: Optional[List[str] | str] = None
    issueId: Optional[str] = None
    issueLabel: Optional[str] = None
    year: Optional[int | str] = None
    articleId: Optional[str] = None
    section: Optional[str] = None
    pages: Optional[List[int]] = None
    pageRange: Optional[str] = None
    journalTitle: Optional[str] = None
    pdf_start_page: Optional[int] = None
    pdf_end_page: Optional[int] = None
    tags: Optional[List[str] | str] = None
    collection_id: Optional[str] = None
    country: Optional[str] = None
    jurisdiction_level: Optional[str] = None
    municipality_name: Optional[str] = None
    municipality_id: Optional[str] = None
    district_name: Optional[str] = None
    district_id: Optional[str] = None

# Metadata-only patch surface for backfill: scalar identity/freshness fields that are
# safe to update without re-parsing, re-chunking or re-embedding the document.
PATCH_METADATA_ALLOWED_KEYS = {
    "collection_id",
    "content_hash",
    "authority",
    "source_status",
    "last_checked",
    "checked_at",
    "retrieved_at",
    "valid_from",
    "valid_to",
    "url_canonical",
    "url",
    "source_url",
    "is_current_version",
    "historical",
    "supersedes_doc_id",
    "jurisdiction_level",
    "country",
    "year",
}

class PatchMetadata(BaseModel):
    metadata: Dict[str, Optional[str | int | float | bool]]

ALLOWED_INCLUDE = {"documents", "embeddings", "metadatas", "distances", "uris", "data"}

def clean_include(include):
    if not isinstance(include, list):
        return []
    cleaned = []
    for item in include:
        s = str(item).strip()
        if not s or s == "ids":
            continue
        if s in ALLOWED_INCLUDE:
            cleaned.append(s)
    return cleaned

class SearchIn(BaseModel):
    query: str = Field(min_length=1, max_length=MAX_QUERY_CHARS)
    top_k: int = 5
    # Tagasiühilduva nimega sügavuspiir kehtib kõigile dokumentidele. Lai otsing
    # hoiab vaikimisi ühe allika mahu väikese; konkreetne faktiküsimus saab sama
    # dokumendi seest küsida sügavama, kuid endiselt piiratud tõendikomplekti.
    # See ei suurenda kogu vektorindeksi kandidaadibaasi.
    journal_chunks_per_document: int = Field(default=3, ge=1, le=12)
    filterDocId: Optional[str] = None
    where: Optional[dict] = None
    include: Optional[List[str]] = None
    retrievers: Optional[List[str]] = None
    # B0b: valikuline korrelatsiooni-ID. Vanad kliendid ei saada seda ja
    # käitumine jääb muutumatuks.
    request_id: Optional[str] = None

    @field_validator("include")
    @classmethod
    def validate_include(cls, value):
        if not value:
            return []
        out = []
        for v in value:
            s = str(v).strip()
            if s and s != "ids" and s in ALLOWED_INCLUDE:
                out.append(s)
        return out


class AgentDocumentSearchIn(BaseModel):
    model_config = {"extra": "forbid"}

    query: str = Field(min_length=1, max_length=MAX_QUERY_CHARS)
    doc_ids: List[str] = Field(min_length=1, max_length=50)
    top_k: int = 5
    include: Optional[List[str]] = None
    retrievers: Optional[List[str]] = None
    request_id: Optional[str] = None

    @field_validator("doc_ids")
    @classmethod
    def validate_doc_ids(cls, value):
        cleaned = []
        seen = set()
        for item in list(value or []):
            doc_id = str(item or "").strip()
            if not doc_id or doc_id in seen:
                continue
            seen.add(doc_id)
            cleaned.append(doc_id)
        if not cleaned:
            raise ValueError("at least one agent document id is required")
        return cleaned

# --------------------
# Core ingest (shared)
# --------------------
def _split_chunks_with_pages(pages: List[Tuple[Optional[int], str]]) -> Tuple[List[str], List[Optional[int]]]:
    docs: List[str] = []
    pnums: List[Optional[int]] = []
    for page_no, txt in pages:
        for ch in _split_chunks(txt):
            docs.append(ch)
            pnums.append(page_no)
    return docs, pnums

def _coerce_int(value) -> Optional[int]:
    try:
        if value is None or value == "":
            return None
        number = int(value)
        return number if number >= 1 else None
    except Exception:
        return None

def _metadata_list(value) -> List[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item or "").strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []

def _normalize_section_index(meta_common: Dict) -> List[Dict[str, object]]:
    raw = meta_common.get("sectionIndex") or meta_common.get("section_index")
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            raw = []
    if not isinstance(raw, list):
        return []
    out: List[Dict[str, object]] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        page_start = _coerce_int(entry.get("page_start") or entry.get("pageStart"))
        page_end = _coerce_int(entry.get("page_end") or entry.get("pageEnd")) or page_start
        title = str(entry.get("title") or entry.get("section_title") or "").strip()
        if not page_start or not page_end or page_end < page_start or not title:
            continue
        out.append({
            "section_id": str(entry.get("section_id") or entry.get("sectionId") or "").strip() or None,
            "title": title,
            "page_start": page_start,
            "page_end": page_end,
            "section_type": str(entry.get("section_type") or entry.get("sectionType") or "").strip() or None,
            "evidence_role": str(entry.get("evidence_role") or entry.get("evidenceRole") or "").strip() or None,
            "allowed_claim_types": _metadata_list(entry.get("allowed_claim_types") or entry.get("allowedClaimTypes")),
            "disallowed_claim_types": _metadata_list(entry.get("disallowed_claim_types") or entry.get("disallowedClaimTypes")),
            "heading_path": _metadata_list(entry.get("heading_path") or entry.get("headingPath")) or [title],
        })
    return sorted(out, key=lambda item: (item["page_start"], item["page_end"], item["title"]))

def _section_for_page(section_index: List[Dict[str, object]], page_num: Optional[int]) -> Optional[Dict[str, object]]:
    page = _coerce_int(page_num)
    if not page or not section_index:
        return None
    for section in section_index:
        start = _coerce_int(section.get("page_start"))
        end = _coerce_int(section.get("page_end")) or start
        if start and end and start <= page <= end:
            return section
    return None

def _build_ingest_payload(doc_id: str, text_or_pages, meta_common: Dict) -> Dict[str, object]:
    meta = build_rag_metadata(meta_common, doc_id=doc_id)
    title = (meta.title or "").strip()
    description = (meta.description or "").strip()
    authors = meta.authors
    tags = meta.tags
    tag_meta = build_tag_token_metadata(tags)
    author_meta = build_author_token_metadata(authors)
    issue_id = normalize_issue_id(meta.issueId or "")
    issue_label = normalize_issue_label(meta.issueLabel or "")
    article_id = normalize_article_id(meta.articleId or "")
    section = normalize_section(meta.section)
    year = meta.year
    page_range = (meta.pageRange or "").strip() or None
    pages_list = meta.pages or []
    journal_title = (meta.journalTitle or "").strip() or None
    language = (meta.language or "et").strip() or "et"
    audience = normalize_audience(meta.audience)
    audiences = normalize_audience_list(meta.audiences or meta.audience)
    metadata_schema_version = (meta.metadata_schema_version or "").strip() or RAG_METADATA_SCHEMA_VERSION
    source_id = (meta.source_id or "").strip() or None
    document_id = (meta.document_id or "").strip() or None
    legacy_source_type = (meta.legacy_source_type or "").strip() or None
    authority = (meta.authority or "").strip() or None
    url_canonical = (meta.url_canonical or "").strip() or None
    retrieved_at = (meta.retrieved_at or "").strip() or None
    last_checked = (meta.last_checked or "").strip() or None
    valid_from = (meta.valid_from or "").strip() or None
    valid_to = (meta.valid_to or "").strip() or None
    historical = meta.historical
    source_status = (meta.source_status or "").strip() or None
    canonical_item_id = (meta.canonical_item_id or "").strip() or None
    content_hash = (meta.content_hash or "").strip() or None
    collection_id = (meta.collection_id or "").strip() or None
    country = normalize_country(meta.country)
    county = (meta.county or "").strip() or None
    jurisdiction_level = normalize_jurisdiction(meta.jurisdiction_level)
    municipality_name = (meta.municipality_name or "").strip() or None
    municipality_id = (meta.municipality_id or "").strip() or None
    district_name = (meta.district_name or "").strip() or None
    district_id = (meta.district_id or "").strip() or None
    checked_at = (meta.checked_at or "").strip() or None
    item_type = (meta.item_type or "").strip() or None
    content_status = (meta.content_status or "").strip() or None
    status_label = source_status or content_status
    resource_type = (meta.resource_type or "").strip() or None
    source_keys = meta.source_keys or []
    source_urls = meta.source_urls or []
    source_register_file = (meta.source_register_file or "").strip() or None
    source_count = meta.source_count
    administering_body = (meta.administering_body or "").strip() or None
    geo_detection_method = (meta.geo_detection_method or "").strip() or None
    geo_detection_confidence = (meta.geo_detection_confidence or "").strip() or None

    section_index = _normalize_section_index(meta_common)

    # Embedding võib kasutada lühikesi dokumendiankruid, kuid Chroma `document`
    # peab jääma päris lõigu tekstiks. Varem lisati iga lõigu ette ka pikk
    # `[DESC]`-kokkuvõte ning sama prefiks salvestati dokumendina. See muutis ühe
    # artikli kõik lõigud otsingule peaaegu ühesuguseks: retriever skooris
    # kokkuvõtet, vastuse koostaja eemaldas selle hiljem ja päris tõend jäi sageli
    # teise, välja langenud lõiku. Kirjeldus jääb metaandmetesse, kuid seda ei
    # korrata enam igas embeddingus.
    embedding_prefix_lines: List[str] = []
    if title:         embedding_prefix_lines.append(f"[TITLE] {title}")
    if authors:       embedding_prefix_lines.append(f"[AUTHORS] {', '.join(authors)}")
    if journal_title: embedding_prefix_lines.append(f"[JOURNAL] {journal_title}")
    if issue_label:   embedding_prefix_lines.append(f"[ISSUE] {issue_label}")
    elif issue_id:    embedding_prefix_lines.append(f"[ISSUE] {issue_id}")
    if section:       embedding_prefix_lines.append(f"[SECTION] {section}")
    if year:          embedding_prefix_lines.append(f"[YEAR] {year}")
    if item_type:     embedding_prefix_lines.append(f"[ITEM_TYPE] {item_type}")
    if status_label:  embedding_prefix_lines.append(f"[STATUS] {status_label}")
    if resource_type: embedding_prefix_lines.append(f"[RESOURCE_TYPE] {resource_type}")
    if administering_body: embedding_prefix_lines.append(f"[ADMIN_BODY] {administering_body}")
    if county:        embedding_prefix_lines.append(f"[COUNTY] {county}")
    if municipality_name: embedding_prefix_lines.append(f"[MUNICIPALITY] {municipality_name}")
    embedding_prefix = ("\n".join(embedding_prefix_lines) + "\n") if embedding_prefix_lines else ""

    # Teksti tükeldamine
    def _token_len(s: str) -> int:
        if not s:
            return 0
        if CHUNK_MODE == "tokens" and _TIKTOKEN_OK:
            enc = _get_token_encoder()
            if enc is not None:
                try:
                    return len(enc.encode(s))
                except Exception:
                    pass
        # rough approximation when not using tokens
        return max(1, len(s) // 4)
    if isinstance(text_or_pages, list) and text_or_pages and isinstance(text_or_pages[0], tuple):
        full_text = _clean_text(" ".join(t or "" for _, t in text_or_pages))
        # Decide based on mode+limit unless ALWAYS_CHUNK is set
        should_single = False
        if section_index:
            should_single = False
        elif not ALWAYS_CHUNK:
            if CHUNK_MODE == "tokens" and _TIKTOKEN_OK:
                should_single = _token_len(full_text) <= SINGLE_CHUNK_TOKEN_LIMIT
            else:
                should_single = len(full_text) <= SINGLE_CHUNK_CHAR_LIMIT
        if should_single:
            chunks = [full_text]
            all_pages = [p for p, _ in text_or_pages if isinstance(p, int)]
            first_page = all_pages[0] if all_pages else None
            page_nums = [first_page]
            chunk_page_lists = [sorted(set(all_pages))]
        else:
            chunks, page_nums = _split_chunks_with_pages(text_or_pages)
            chunk_page_lists = [[page] if isinstance(page, int) else [] for page in page_nums]
    else:
        text = _clean_text(str(text_or_pages or ""))
        should_single = False
        if not ALWAYS_CHUNK:
            if CHUNK_MODE == "tokens" and _TIKTOKEN_OK:
                should_single = _token_len(text) <= SINGLE_CHUNK_TOKEN_LIMIT
            else:
                should_single = len(text) <= SINGLE_CHUNK_CHAR_LIMIT
        if should_single:
            chunks = [text]
            page_nums = [None]
            chunk_page_lists = [[]]
        else:
            chunks = _split_chunks(text)
            page_nums = [None] * len(chunks)
            chunk_page_lists = [[] for _ in chunks]

    if not chunks:
        return {
            "count": 0,
            "documents": [],
            "metadatas": [],
            "ids": [],
            "embeddings": [],
        }

    stored_texts = []
    embedding_texts = []
    for i, ch in enumerate(chunks):
        section_meta = _section_for_page(section_index, page_nums[i] if i < len(page_nums) else None)
        section_title = str(section_meta.get("title") or "").strip() if section_meta else ""
        section_prefix = embedding_prefix
        if section_title and section_title != section:
            section_prefix = f"{section_prefix}[PDF_SECTION] {section_title}\n"
        stored_texts.append(ch)
        embedding_texts.append((section_prefix + ch).strip() if section_prefix else ch)

    # STABIILNE ID: doc_id + jrk + 8-kohaline hash chunkist
    ids = []
    for i, txt in enumerate(stored_texts):
        h = hashlib.sha1(txt.encode("utf-8")).hexdigest()[:8]
        ids.append(f"{doc_id}:{i}:{h}")

    metadatas = []
    for i, _ in enumerate(stored_texts):
        chunk_id = f"{doc_id}:{i}"
        section_meta = _section_for_page(section_index, page_nums[i] if i < len(page_nums) else None)
        m = {
            "doc_id": meta.docId or doc_id,
            "docId": meta.docId or doc_id,
            "document_version": meta_common.get("document_version"),
            "chunk_id": chunk_id,
            "chunkId": chunk_id,
            "chunk_index": i,
            "chunkIndex": i,
            "original_doc_id": meta_common.get("original_doc_id") or meta_common.get("originalDocId"),
            "originalDocId": meta_common.get("originalDocId") or meta_common.get("original_doc_id"),
            "title": title or None,
            "description": description or None,
            "authors": authors,
            "authors_list": authors or [],
            **author_meta,
            "tags": tags,
            "tags_list": tags or [],
            **tag_meta,
            "issue_id": issue_id or None,
            "issueId": issue_id or None,
            "issue_label": issue_label or None,
            "issueLabel": issue_label or None,
            "article_id": article_id or None,
            "articleId": article_id or None,
            "section": section or None,
            "year": year,
            "pageRange": _collapse_pages(chunk_page_lists[i]) or page_range,
            "pages": chunk_page_lists[i] or pages_list or None,
            "journal_title": journal_title,
            "journalTitle": journal_title,
            "metadata_schema_version": metadata_schema_version,
            "source_id": source_id,
            "sourceId": source_id,
            "document_id": document_id,
            "documentId": document_id,
            "source_type": meta.source_type or meta_common.get("source_type"),
            "legacy_source_type": legacy_source_type,
            "authority": authority,
            "source_path": meta.source_path or meta_common.get("source_path"),
            "source_url": meta.source_url or meta_common.get("source_url"),
            "url_canonical": url_canonical,
            "retrieved_at": retrieved_at,
            "last_checked": last_checked,
            "valid_from": valid_from,
            "valid_to": valid_to,
            "historical": historical,
            "source_status": source_status,
            "canonical_item_id": canonical_item_id,
            "content_hash": content_hash,
            "url": meta.url or meta_common.get("source_url"),
            "mimeType": meta_common.get("mimeType") or meta_common.get("mime_type") or meta_common.get("mime"),
            "audience": audience,
            "audiences": audiences,
            "language": language,
            "pdf_start_page": meta.pdf_start_page,
            "pdf_end_page": meta.pdf_end_page,
            "page": page_nums[i],
            "section_id": section_meta.get("section_id") if section_meta else None,
            "section_title": section_meta.get("title") if section_meta else None,
            "section_type": section_meta.get("section_type") if section_meta else None,
            "section_page_start": section_meta.get("page_start") if section_meta else None,
            "section_page_end": section_meta.get("page_end") if section_meta else None,
            "section_evidence_role": section_meta.get("evidence_role") if section_meta else None,
            "heading_path": section_meta.get("heading_path") if section_meta else None,
            "allowed_claim_types": section_meta.get("allowed_claim_types") if section_meta else None,
            "disallowed_claim_types": section_meta.get("disallowed_claim_types") if section_meta else None,
            "collection_id": collection_id,
            "country": country,
            "county": county,
            "jurisdiction_level": jurisdiction_level,
            "municipality_name": municipality_name,
            "municipality_id": municipality_id,
            "district_name": district_name,
            "district_id": district_id,
            "checked_at": checked_at,
            "item_type": item_type,
            "content_status": content_status,
            "resource_type": resource_type,
            "source_keys": source_keys,
            "source_urls": source_urls,
            "source_register_file": source_register_file,
            "source_count": source_count,
            "administering_body": administering_body,
            "geo_detection_method": geo_detection_method,
            "geo_detection_confidence": geo_detection_confidence,
            "createdAt": now_iso(),
        }
        cleaned = {}
        for k, v in m.items():
            v2 = _stringify_meta(v)
            if v2 is not None:
                cleaned[k] = v2
        metadatas.append(cleaned)

    embed_result = _embed_batch_with_usage(embedding_texts)
    embeddings = list(embed_result.get("embeddings") or [])
    return {
        "count": len(stored_texts),
        "documents": stored_texts,
        "metadatas": metadatas,
        "ids": ids,
        "embeddings": embeddings,
        "embedding_model": embed_result.get("model"),
        "prompt_tokens": embed_result.get("prompt_tokens"),
        "total_tokens": embed_result.get("total_tokens"),
        "embedding_latency_ms": embed_result.get("latency_ms"),
        "embedding_input_count": embed_result.get("embedding_input_count"),
        "text_chars": embed_result.get("text_chars"),
        "cost_read_directly": embed_result.get("cost_read_directly"),
    }

def _safe_chunk_id_segment(value: object) -> str:
    raw = str(value or "").strip().lower()
    cleaned = re.sub(r"[^a-z0-9]+", "-", raw).strip("-")
    return cleaned or hashlib.sha1(str(value or "").encode("utf-8")).hexdigest()[:12]

def _build_chunk_metadata_entry(
    doc_id: str,
    chunk_id: str,
    chunk_index: int,
    meta: RagMetadata,
    page_num: Optional[int] = None,
    extra_meta: Optional[Dict[str, object]] = None,
) -> Dict[str, object]:
    metadata_schema_version = (meta.metadata_schema_version or "").strip() or RAG_METADATA_SCHEMA_VERSION
    title = (meta.title or "").strip()
    description = (meta.description or "").strip()
    authors = meta.authors
    tags = meta.tags
    tag_meta = build_tag_token_metadata(tags)
    author_meta = build_author_token_metadata(authors)
    issue_id = normalize_issue_id(meta.issueId or "")
    issue_label = normalize_issue_label(meta.issueLabel or "")
    article_id = normalize_article_id(meta.articleId or "")
    section = normalize_section(meta.section)
    year = meta.year
    page_range = (meta.pageRange or "").strip() or None
    pages_list = meta.pages or []
    journal_title = (meta.journalTitle or "").strip() or None
    language = (meta.language or "et").strip() or "et"
    audience = normalize_audience(meta.audience)
    audiences = normalize_audience_list(meta.audiences or meta.audience)
    source_id = (meta.source_id or "").strip() or None
    document_id = (meta.document_id or "").strip() or None
    legacy_source_type = (meta.legacy_source_type or "").strip() or None
    authority = (meta.authority or "").strip() or None
    url_canonical = (meta.url_canonical or "").strip() or None
    retrieved_at = (meta.retrieved_at or "").strip() or None
    last_checked = (meta.last_checked or "").strip() or None
    valid_from = (meta.valid_from or "").strip() or None
    valid_to = (meta.valid_to or "").strip() or None
    historical = meta.historical
    source_status = (meta.source_status or "").strip() or None
    canonical_item_id = (meta.canonical_item_id or "").strip() or None
    content_hash = (meta.content_hash or "").strip() or None
    collection_id = (meta.collection_id or "").strip() or None
    country = normalize_country(meta.country)
    county = (meta.county or "").strip() or None
    jurisdiction_level = normalize_jurisdiction(meta.jurisdiction_level)
    municipality_name = (meta.municipality_name or "").strip() or None
    municipality_id = (meta.municipality_id or "").strip() or None
    district_name = (meta.district_name or "").strip() or None
    district_id = (meta.district_id or "").strip() or None
    checked_at = (meta.checked_at or "").strip() or None
    item_type = (meta.item_type or "").strip() or None
    content_status = (meta.content_status or "").strip() or None
    status_label = source_status or content_status
    resource_type = (meta.resource_type or "").strip() or None
    source_keys = meta.source_keys or []
    source_urls = meta.source_urls or []
    source_register_file = (meta.source_register_file or "").strip() or None
    source_count = meta.source_count
    administering_body = (meta.administering_body or "").strip() or None
    geo_detection_method = (meta.geo_detection_method or "").strip() or None
    geo_detection_confidence = (meta.geo_detection_confidence or "").strip() or None

    base = {
        "doc_id": meta.docId or doc_id,
        "docId": meta.docId or doc_id,
        "chunk_id": chunk_id,
        "chunkId": chunk_id,
        "chunk_index": chunk_index,
        "chunkIndex": chunk_index,
        "title": title or None,
        "description": description or None,
        "authors": authors,
        "authors_list": authors or [],
        **author_meta,
        "tags": tags,
        "tags_list": tags or [],
        **tag_meta,
        "issue_id": issue_id or None,
        "issueId": issue_id or None,
        "issue_label": issue_label or None,
        "issueLabel": issue_label or None,
        "article_id": article_id or None,
        "articleId": article_id or None,
        "section": section or None,
        "year": year,
        "pageRange": page_range,
        "pages": pages_list or None,
        "journal_title": journal_title,
        "journalTitle": journal_title,
        "metadata_schema_version": metadata_schema_version,
        "source_id": source_id,
        "sourceId": source_id,
        "document_id": document_id,
        "documentId": document_id,
        "source_type": meta.source_type,
        "legacy_source_type": legacy_source_type,
        "authority": authority,
        "source_path": meta.source_path,
        "source_url": meta.source_url or meta.url,
        "url_canonical": url_canonical,
        "retrieved_at": retrieved_at,
        "last_checked": last_checked,
        "valid_from": valid_from,
        "valid_to": valid_to,
        "historical": historical,
        "source_status": source_status,
        "canonical_item_id": canonical_item_id,
        "content_hash": content_hash,
        "url": meta.url or meta.source_url,
        "audience": audience,
        "audiences": audiences,
        "language": language,
        "pdf_start_page": meta.pdf_start_page,
        "pdf_end_page": meta.pdf_end_page,
        "page": page_num,
        "collection_id": collection_id,
        "country": country,
        "county": county,
        "jurisdiction_level": jurisdiction_level,
        "municipality_name": municipality_name,
        "municipality_id": municipality_id,
        "district_name": district_name,
        "district_id": district_id,
        "checked_at": checked_at,
        "item_type": item_type,
        "content_status": content_status,
        "resource_type": resource_type,
        "source_keys": source_keys,
        "source_urls": source_urls,
        "source_register_file": source_register_file,
        "source_count": source_count,
        "administering_body": administering_body,
        "geo_detection_method": geo_detection_method,
        "geo_detection_confidence": geo_detection_confidence,
        "createdAt": now_iso(),
    }

    merged = {}
    for k, v in base.items():
        v2 = _stringify_meta(v)
        if v2 is not None:
            merged[k] = v2

    extra = extra_meta if isinstance(extra_meta, dict) else {}
    for k, v in extra.items():
        if k in {"text", "metadata", "chunks"}:
            continue
        if k in merged:
            continue
        v2 = _stringify_meta(v)
        if v2 is not None:
            merged[k] = v2

    return merged

def _build_explicit_chunk_payload(doc_id: str, chunks: List["IngestTextChunk"], meta_common: Dict) -> Dict[str, object]:
    final_texts: List[str] = []
    metadatas: List[Dict[str, object]] = []
    ids: List[str] = []

    for index, chunk in enumerate(chunks):
        text = _clean_text(str(chunk.text or ""))
        if not text:
            continue

        extra_meta = dict(chunk.metadata or {})
        combined_meta = {**(meta_common or {}), **extra_meta}
        meta = build_rag_metadata(combined_meta, doc_id=doc_id)
        client_chunk_id = str(
            extra_meta.get("canonical_chunk_id") or extra_meta.get("chunk_id") or extra_meta.get("chunkId") or ""
        ).strip() or None
        raw_chunk_key = extra_meta.get("chunk_key") or client_chunk_id or index
        chunk_key = _safe_chunk_id_segment(raw_chunk_key)
        text_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]
        chunk_id = f"{_safe_chunk_id_segment(doc_id)}:chunk:{chunk_key}:{index}:{text_hash}"
        combined_meta["client_chunk_id"] = client_chunk_id

        final_texts.append(text)
        ids.append(chunk_id)
        metadatas.append(
            _build_chunk_metadata_entry(
                doc_id=doc_id,
                chunk_id=chunk_id,
                chunk_index=index,
                meta=meta,
                page_num=None,
                extra_meta=combined_meta,
            )
        )

    if not final_texts:
        return {
            "count": 0,
            "documents": [],
            "metadatas": [],
            "ids": [],
            "embeddings": [],
        }

    embed_result = _embed_batch_with_usage(final_texts)
    embeddings = list(embed_result.get("embeddings") or [])
    return {
        "count": len(final_texts),
        "documents": final_texts,
        "metadatas": metadatas,
        "ids": ids,
        "embeddings": embeddings,
        "embedding_model": embed_result.get("model"),
        "prompt_tokens": embed_result.get("prompt_tokens"),
        "total_tokens": embed_result.get("total_tokens"),
        "embedding_latency_ms": embed_result.get("latency_ms"),
        "embedding_input_count": embed_result.get("embedding_input_count"),
        "text_chars": embed_result.get("text_chars"),
        "cost_read_directly": embed_result.get("cost_read_directly"),
    }

def _replace_document_vectors_payload(
    doc_id: str,
    payload: Dict[str, object],
    observability: Optional[Dict[str, object]] = None,
    version_id: Optional[str] = None,
):
    if not int(payload.get("count") or 0):
        raise HTTPException(422, {"code": "EXTRACTION_EMPTY"})
    if payload["count"]:
        _log_rag_cost_usage(
            model=payload.get("embedding_model"),
            latency_ms=payload.get("embedding_latency_ms"),
            prompt_tokens=payload.get("prompt_tokens"),
            total_tokens=payload.get("total_tokens"),
            embedding_input_count=int(payload.get("embedding_input_count") or 0),
            text_chars=_to_int(payload.get("text_chars")),
            chunk_count=int(payload.get("count") or 0),
            cost_read_directly=bool(payload.get("cost_read_directly")),
            **(observability or {}),
        )
    return stage_document_version(
        collection,
        REGISTRY_STORE,
        STORAGE_DIR / ".document-locks",
        doc_id,
        payload,
        version_id or uuid.uuid4().hex,
    )

def _ingest_text(doc_id: str, text_or_pages, meta_common: Dict, observability: Optional[Dict[str, object]] = None) -> int:
    active_version = (_load_registry().get(doc_id) or {}).get("activeVersion")
    payload = _build_ingest_payload(
        doc_id,
        text_or_pages,
        {**meta_common, **({"document_version": active_version} if active_version else {})},
    )
    if not payload["count"]:
        return 0
    _log_rag_cost_usage(
        model=payload.get("embedding_model"),
        latency_ms=payload.get("embedding_latency_ms"),
        prompt_tokens=payload.get("prompt_tokens"),
        total_tokens=payload.get("total_tokens"),
        embedding_input_count=int(payload.get("embedding_input_count") or 0),
        text_chars=_to_int(payload.get("text_chars")),
        chunk_count=int(payload.get("count") or 0),
        cost_read_directly=bool(payload.get("cost_read_directly")),
        **(observability or {}),
    )
    collection.upsert(
        documents=payload["documents"],
        metadatas=payload["metadatas"],
        ids=payload["ids"],
        embeddings=payload["embeddings"],
    )
    return int(payload["count"])

def _replace_document_vectors(
    doc_id: str,
    text_or_pages,
    meta_common: Dict,
    observability: Optional[Dict[str, object]] = None,
    version_id: Optional[str] = None,
):
    payload = _build_ingest_payload(doc_id, text_or_pages, meta_common)
    return _replace_document_vectors_payload(
        doc_id,
        payload,
        observability=observability,
        version_id=version_id,
    )

def _register(doc_id: str, entry: Dict) -> None:
    REGISTRY_STORE.upsert(doc_id, entry, updated_at=now_iso())

def _version_source_dir(doc_id: str, version_id: str) -> Path:
    return resolve_within(STORAGE_DIR, _doc_dir(doc_id) / "versions" / version_id)

def _remove_staged_source(path: Optional[Path]) -> None:
    if path is None:
        return
    try:
        safe_path = resolve_within(STORAGE_DIR, path)
        safe_path.unlink(missing_ok=True)
        parent = safe_path.parent
        if parent.name and parent.parent.name == "versions":
            parent.rmdir()
    except Exception:
        pass


def _rebuild_persistent_lexical_index(reason: str) -> Dict[str, object]:
    if not RAG_PERSISTENT_LEXICAL_INDEX_ENABLED:
        return {"ready": False, "reason": "LEXICAL_INDEX_DISABLED"}
    started_at = time.perf_counter()
    registry = _load_registry()
    status = LEXICAL_INDEX.rebuild(
        collection,
        registry,
        is_active_document_version=is_active_document_version,
        normalize_search_text=_normalize_search_text,
        load_registry=_load_registry,
    )
    stage_logger.info(
        "rag.lexical_index.rebuild %s",
        json.dumps(
            {
                "reason": str(reason or "unspecified")[:80],
                "outcome": "ok",
                "duration_ms": int((time.perf_counter() - started_at) * 1000),
                "chunk_count": int(status.get("chunk_count") or 0),
                "document_count": int(status.get("document_count") or 0),
                "size_bytes": int(status.get("size_bytes") or 0),
            },
            ensure_ascii=False,
        ),
    )
    return status


def _mark_persistent_lexical_index_stale(reason: str) -> None:
    if RAG_PERSISTENT_LEXICAL_INDEX_ENABLED:
        LEXICAL_INDEX.mark_stale(reason)


def _refresh_persistent_lexical_index(reason: str) -> None:
    if not RAG_PERSISTENT_LEXICAL_INDEX_ENABLED:
        return
    try:
        _rebuild_persistent_lexical_index(reason)
    except Exception as exc:
        logger.error(
            "Persistent lexical index refresh failed reason=%s error=%s",
            str(reason or "unspecified")[:80],
            exc.__class__.__name__,
        )


def _commit_vector_stage(stage, entry: Dict):
    _mark_persistent_lexical_index_stale("corpus_version_commit")
    try:
        result = stage.commit(entry, updated_at=now_iso())
    except Exception:
        _refresh_persistent_lexical_index("corpus_version_rollback")
        raise
    _refresh_persistent_lexical_index("corpus_version_commit")
    old_path_value = result.previous_entry.get("path")
    new_path_value = entry.get("path")
    if old_path_value and old_path_value != new_path_value:
        try:
            old_path = resolve_within(STORAGE_DIR, Path(str(old_path_value)))
            old_path.unlink(missing_ok=True)
            if old_path.parent.parent.name == "versions":
                old_path.parent.rmdir()
        except Exception:
            try:
                REGISTRY_STORE.patch(
                    stage.doc_id,
                    {"fileCleanupState": "PENDING"},
                    updated_at=now_iso(),
                )
            except Exception:
                pass
    return result

DOCUMENT_METADATA_FALLBACK_KEYS = (
    "source_id",
    "sourceId",
    "document_id",
    "documentId",
    "source_type",
    "legacy_source_type",
    "authority",
    "source_format",
    "source_path",
    "source_url",
    "url_canonical",
    "url",
    "retrieved_at",
    "last_checked",
    "valid_from",
    "valid_to",
    "historical",
    "source_status",
    "canonical_item_id",
    "content_hash",
    "mimeType",
    "fileName",
    "collection_id",
    "country",
    "county",
    "jurisdiction_level",
    "municipality_name",
    "municipality_id",
    "municipality",
    "district_name",
    "district_id",
    "issuer",
    "act_title",
    "act_reference",
    "canonical_source_id",
    "act_type",
    "effective_start",
    "effective_end",
    "is_current_version",
    "text_type",
    "checked_at",
    "item_type",
    "content_status",
    "resource_type",
    "source_keys",
    "source_urls",
    "source_register_file",
    "source_count",
    "administering_body",
    "geo_detection_method",
    "geo_detection_confidence",
    "language",
    "audience",
    "audiences",
    "authors",
    "tags",
    "tag_tokens",
    "journalTitle",
    "journal_title",
    "title",
    "description",
)

def _has_metadata_value(value) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, tuple, set, dict)):
        return len(value) > 0
    return True

def _merge_registry_with_chunk_metadatas(meta: Optional[Dict], metadatas: Optional[List[Dict]]) -> Dict:
    merged = dict(meta or {})
    metadata_rows = [row for row in list(metadatas or []) if isinstance(row, dict)]
    if not metadata_rows:
        return merged

    for key in DOCUMENT_METADATA_FALLBACK_KEYS:
        if _has_metadata_value(merged.get(key)):
            continue
        for row in metadata_rows:
            value = row.get(key)
            if _has_metadata_value(value):
                merged[key] = value
                break

    if not _has_metadata_value(merged.get("url")) and _has_metadata_value(merged.get("source_url")):
        merged["url"] = merged.get("source_url")
    if not _has_metadata_value(merged.get("sourceUrl")) and _has_metadata_value(merged.get("source_url")):
        merged["sourceUrl"] = merged.get("source_url")
    if not _has_metadata_value(merged.get("fileName")) and _has_metadata_value(merged.get("source_file")):
        merged["fileName"] = merged.get("source_file")
    if not _has_metadata_value(merged.get("mimeType")) and _has_metadata_value(merged.get("source_format")):
        source_format = str(merged.get("source_format") or "").strip().lower()
        if source_format == "xml":
            merged["mimeType"] = "application/xml"

    return merged

def _metadata_summary(metadatas: Optional[List[Dict]]) -> Dict[str, object]:
    rows = [row for row in list(metadatas or []) if isinstance(row, dict)]

    def _collect(key: str, limit: int = 12) -> List[object]:
        seen = []
        for row in rows:
            value = row.get(key)
            if not _has_metadata_value(value):
                continue
            if value in seen:
                continue
            seen.append(value)
            if len(seen) >= limit:
                break
        return seen

    return {
        "chunk_count": len(rows),
        "jurisdiction_levels": _collect("jurisdiction_level"),
        "audiences": _collect("audience"),
        "collection_ids": _collect("collection_id"),
        "source_types": _collect("source_type"),
        "source_formats": _collect("source_format"),
        "municipality_names": _collect("municipality_name"),
        "issuers": _collect("issuer"),
        "act_titles": _collect("act_title"),
    }

def _compose_chroma_where(filters: Dict[str, object]) -> Optional[Dict[str, object]]:
    cleaned: List[Dict[str, object]] = []
    for key, value in (filters or {}).items():
        if value is None:
            continue
        if key == "$and" and isinstance(value, list):
            cleaned.extend(
                clause for clause in value
                if isinstance(clause, dict) and clause
            )
            continue
        cleaned.append({key: value})
    if not cleaned:
        return None
    if len(cleaned) == 1:
        return cleaned[0]
    return {"$and": cleaned}


def _add_search_or_group(filters: Dict[str, object], clauses: List[Dict[str, object]]) -> None:
    cleaned = [clause for clause in clauses if isinstance(clause, dict) and clause]
    if not cleaned:
        return
    groups = list(filters.pop("$and", []) or [])
    previous_or = filters.pop("$or", None)
    if previous_or:
        groups.append({"$or": previous_or})
    groups.append({"$or": cleaned})
    filters["$and"] = groups

def _normalize_metadata_scalar(value: object) -> object:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value
    if value is None:
        return None
    text = str(value).strip()
    lowered = text.lower()
    if lowered in {"true", "false"}:
        return lowered == "true"
    return text

def _metadata_matches_filter(metadata: Dict[str, object], where: Optional[Dict[str, object]]) -> bool:
    if not where:
        return True
    if not isinstance(metadata, dict):
        return False
    if "$and" in where:
        clauses = where.get("$and") or []
        return all(_metadata_matches_filter(metadata, clause) for clause in clauses if isinstance(clause, dict))
    if "$or" in where:
        clauses = where.get("$or") or []
        return any(_metadata_matches_filter(metadata, clause) for clause in clauses if isinstance(clause, dict))

    for key, expected in where.items():
        if key in {"$and", "$or"}:
            continue
        actual = _normalize_metadata_scalar(metadata.get(key))
        if isinstance(expected, dict):
            if "$in" in expected:
                normalized_expected = [_normalize_metadata_scalar(item) for item in list(expected.get("$in") or [])]
                if isinstance(actual, list):
                    normalized_actual = [_normalize_metadata_scalar(item) for item in actual]
                    if not any(item in normalized_expected for item in normalized_actual):
                        return False
                elif actual not in normalized_expected:
                    return False
                continue
            if "$ne" in expected:
                normalized_expected = _normalize_metadata_scalar(expected.get("$ne"))
                if isinstance(actual, list):
                    normalized_actual = [_normalize_metadata_scalar(item) for item in actual]
                    if normalized_expected in normalized_actual:
                        return False
                elif actual == normalized_expected:
                    return False
                continue
            if "$nin" in expected:
                normalized_expected = [_normalize_metadata_scalar(item) for item in list(expected.get("$nin") or [])]
                if isinstance(actual, list):
                    normalized_actual = [_normalize_metadata_scalar(item) for item in actual]
                    if any(item in normalized_expected for item in normalized_actual):
                        return False
                elif actual in normalized_expected:
                    return False
                continue
            return False
        normalized_expected = _normalize_metadata_scalar(expected)
        if isinstance(actual, list):
            normalized_actual = [_normalize_metadata_scalar(item) for item in actual]
            if normalized_expected not in normalized_actual:
                return False
        elif actual != normalized_expected:
            return False
    return True

def _copy_string_metadata_filter(source: Dict[str, object], target: Dict[str, object], input_key: str, metadata_key: str) -> None:
    if input_key not in source:
        return
    value = source.get(input_key)
    if isinstance(value, dict) and "$in" in value:
        cleaned = [str(v).strip() for v in list(value.get("$in") or []) if str(v).strip()]
        if cleaned:
            target[metadata_key] = {"$in": cleaned}
        return
    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned:
            target[metadata_key] = cleaned

def _copy_bool_metadata_filter(source: Dict[str, object], target: Dict[str, object], input_key: str, metadata_key: str) -> None:
    if input_key not in source:
        return
    value = source.get(input_key)
    if isinstance(value, bool):
        target[metadata_key] = value
        return
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"1", "true", "yes", "on"}:
            target[metadata_key] = True
        elif normalized in {"0", "false", "no", "off"}:
            target[metadata_key] = False

def _normalize_search_filter_clause(source: Dict[str, object]) -> Dict[str, object]:
    target: Dict[str, object] = {}
    if not isinstance(source, dict):
        return target
    for input_key, metadata_key in SEARCH_METADATA_STRING_FILTERS:
        _copy_string_metadata_filter(source, target, input_key, metadata_key)
    _copy_bool_metadata_filter(source, target, "historical", "historical")
    return target

def _requires_current_version(where: Optional[Dict[str, object]]) -> bool:
    if not isinstance(where, dict) or "is_current_version" not in where:
        return False
    value = where.get("is_current_version")
    if value is True:
        return True
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    if isinstance(value, dict) and "$ne" in value:
        excluded = value.get("$ne")
        if excluded is False:
            return True
        if isinstance(excluded, str):
            return excluded.strip().lower() in {"0", "false", "no", "off"}
    return False

def _metadata_matches_current_version_requirement(
    metadata: Dict[str, object],
    require_current: bool,
) -> bool:
    if not require_current:
        return True
    # Legacy rows have no explicit marker and are still current. Forwarding
    # ``{$ne: false}`` to Chroma would silently exclude every missing field, so
    # enforce this predicate after retrieval and reject only explicit false.
    current = (
        metadata.get("is_current_version")
        if metadata.get("is_current_version") is not None
        else metadata.get("isCurrentVersion")
    )
    if isinstance(current, str):
        normalized = current.strip().lower()
        if normalized in {"1", "true", "yes", "on"}:
            current = True
        elif normalized in {"0", "false", "no", "off"}:
            current = False
        else:
            current = None
    return current is not False

SEARCH_METADATA_STRING_FILTERS: List[Tuple[str, str]] = [
    ("document_id", "document_id"),
    ("documentId", "document_id"),
    ("source_id", "source_id"),
    ("sourceId", "source_id"),
    ("chunk_id", "chunk_id"),
    ("chunkId", "chunk_id"),
    ("source_type", "source_type"),
    ("sourceType", "source_type"),
    ("source_status", "source_status"),
    ("sourceStatus", "source_status"),
    ("collection_id", "collection_id"),
    ("collectionId", "collection_id"),
    ("canonical_item_id", "canonical_item_id"),
    ("canonicalItemId", "canonical_item_id"),
    ("authority", "authority"),
    ("language", "language"),
    ("last_checked", "last_checked"),
    ("lastChecked", "last_checked"),
    ("valid_from", "valid_from"),
    ("validFrom", "valid_from"),
    ("valid_to", "valid_to"),
    ("validTo", "valid_to"),
    ("act_title", "act_title"),
    ("actTitle", "act_title"),
    ("act_reference", "act_reference"),
    ("actReference", "act_reference"),
    ("act_type", "act_type"),
    ("actType", "act_type"),
    ("issuer", "issuer"),
    ("chapter_number", "chapter_number"),
    ("chapterNumber", "chapter_number"),
    ("chapter_title", "chapter_title"),
    ("chapterTitle", "chapter_title"),
    ("section_title", "section_title"),
    ("sectionTitle", "section_title"),
    ("paragraph_number", "paragraph_number"),
    ("paragraphNumber", "paragraph_number"),
    ("paragraph_title", "paragraph_title"),
    ("paragraphTitle", "paragraph_title"),
    ("subsection_number", "subsection_number"),
    ("subsectionNumber", "subsection_number"),
    ("point_number", "point_number"),
    ("pointNumber", "point_number"),
    ("jurisdiction_level", "jurisdiction_level"),
    ("jurisdictionLevel", "jurisdiction_level"),
    ("municipality_id", "municipality_id"),
    ("municipalityId", "municipality_id"),
    ("municipality_name", "municipality_name"),
    ("municipalityName", "municipality_name"),
    ("item_type", "item_type"),
    ("itemType", "item_type"),
    ("resource_type", "resource_type"),
    ("resourceType", "resource_type"),
    ("checked_at", "checked_at"),
    ("checkedAt", "checked_at"),
    ("content_status", "content_status"),
    ("contentStatus", "content_status"),
    ("country", "country"),
    ("county", "county"),
    ("district_name", "district_name"),
    ("districtName", "district_name"),
    ("district_id", "district_id"),
    ("districtId", "district_id"),
    ("journal_title", "journal_title"),
    ("journalTitle", "journal_title"),
    ("issue_id", "issue_id"),
    ("issueId", "issue_id"),
    ("issue_label", "issue_label"),
    ("issueLabel", "issue_label"),
    ("article_id", "article_id"),
    ("articleId", "article_id"),
]

LEXICAL_STOPWORDS = {
    "aga",
    "and",
    "are",
    "can",
    "for",
    "how",
    "kas",
    "kes",
    "kelle",
    "kellele",
    "kohta",
    "kuidas",
    "kus",
    "kuhu",
    "mis",
    "mida",
    "milline",
    "millised",
    "ning",
    "on",
    "saab",
    "see",
    "seda",
    "the",
    "või",
    "voi",
}

def _normalize_search_text(value: object) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return ""
    text = re.sub(r"\bshs\b", "shs sotsiaalhoolekande seadus", text, flags=re.I)
    text = re.sub(
        r"\btoimetulekutoetus(?:e|t|ele|el|elt|eks|ega|es|i)?\b",
        "toimetulekutoetus",
        text,
        flags=re.I,
    )
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()

def _extract_query_paragraph_refs(query: object) -> List[str]:
    source = str(query or "")
    refs: List[str] = []
    for pattern in [
        r"(?:§+\s*|paragrahv(?:i|is|ist|ile|il|iga|iks)?\s+|paragraph\s+)(\d+[a-z]?)",
        r"\bshs\s+(\d{1,3}[a-z]?)\b",
    ]:
        for match in re.finditer(pattern, source, flags=re.I):
            ref = str(match.group(1) or "").strip().lower()
            if ref and ref not in refs:
                refs.append(ref)
    return refs[:8]

def _search_tokens(value: object, limit: int = 24) -> List[str]:
    normalized = _normalize_search_text(value)
    if not normalized:
        return []
    out: List[str] = []
    seen = set()
    for token in normalized.split(" "):
        if (len(token) < 3 and not token.isdigit()) or token in LEXICAL_STOPWORDS or token in seen:
            continue
        seen.add(token)
        out.append(token)
        if len(out) >= limit:
            break
    return out


_SYNTHESIS_SHELL_EXACT_TOKENS = {
    "eri",
    "ja",
    "mitme",
    "mitmest",
    "sotsiaaltoo",
    "tee",
}
_SYNTHESIS_SHELL_PREFIXES = (
    "ajakirj",
    "allik",
    "artikl",
    "kasitle",
    "kirjut",
    "lahendus",
    "lugu",
    "millis",
    "pohjal",
    "probleem",
    "tekst",
    "vordl",
    "ulevaad",
)


def _synthesis_focus_query(query: object) -> str:
    """Strip broad question scaffolding from journal synthesis lexical search.

    Dense retrieval still receives the complete natural-language question. The
    lexical channel should instead rank on its subject: otherwise ubiquitous
    words such as ``artiklid``, ``probleemid`` and ``Sotsiaaltöö`` promote many
    formally matching but topically unrelated journal chunks.
    """
    tokens = _search_tokens(query, limit=32)
    if not tokens:
        return str(query or "").strip()
    source_signal = any(
        token.startswith(("allik", "artikl", "kasitlus", "kirjutis", "lugu", "tekst"))
        for token in tokens
    )
    cross_source_signal = any(
        token == "eri" or token.startswith("mitm")
        or token.startswith(("ulevaad", "vordl"))
        for token in tokens
    )
    journal_signal = "sotsiaaltoo" in tokens
    if not journal_signal or not source_signal or not cross_source_signal:
        return str(query or "").strip()
    focused = [
        token
        for token in tokens
        if token not in _SYNTHESIS_SHELL_EXACT_TOKENS
        and not any(token.startswith(prefix) for prefix in _SYNTHESIS_SHELL_PREFIXES)
    ]
    return " ".join(focused) if len(focused) >= 2 else str(query or "").strip()

def _split_fact_query_segments(
    query: object,
    max_segments: int = 6,
    anchor_short: bool = True,
) -> List[str]:
    """Return bounded semantic subqueries for a compound, narrow fact question.

    The caller still searches with the complete question first. These fragments
    are only used inside the journal articles that the complete question has
    already identified, so a short coordinated item such as ``ööune kohta`` is
    useful without being allowed to steer the whole-corpus search.
    """
    source = re.sub(r"\s+", " ", str(query or "")).strip()
    if not source or max_segments <= 0:
        return []

    raw_parts = re.split(
        r"\s*(?:[?;]+|,(?=\s)|\bning\b|\bja\b)\s*",
        source,
        flags=re.I,
    )
    first_words = str(raw_parts[0] if raw_parts else "").strip().split()
    if len(first_words) >= 5:
        context_lead = " ".join(first_words[:-2])
    else:
        context_lead = " ".join(first_words)
    full_normalized = _normalize_search_text(source)
    segments: List[str] = []
    seen = set()
    for part_index, raw_part in enumerate(raw_parts):
        part = re.sub(r"^[,.:!?;\-–—\s]+|[,.:!?;\-–—\s]+$", "", raw_part).strip()
        if not part:
            continue
        initial_content_tokens = _search_tokens(part, limit=12)
        # Üks või kaks sisusõna (nt „ööune kohta“) vajavad dokumendiankrut.
        # Kolm sisusõna moodustavad juba piisavalt täpse alamküsimuse; kogu
        # küsimuse üldise alguse lisamine mataks siis täpse lõigu sagedaste
        # üldsõnade alla (nt „hooldekodude nõuete täitmise“).
        if anchor_short and part_index > 0 and context_lead and len(initial_content_tokens) <= 2:
            part = f"{context_lead} {part}".strip()
        normalized = _normalize_search_text(part)
        if not normalized or normalized == full_normalized or normalized in seen:
            continue
        content_tokens = _search_tokens(part, limit=12)
        if not content_tokens or not any(len(token) >= 5 for token in content_tokens):
            continue
        seen.add(normalized)
        segments.append(part)
        if len(segments) >= max_segments:
            break
    return segments if len(segments) >= 2 else []

_PERCENTAGE_COUNT_WORDS = {
    "uks": 1,
    "uhe": 1,
    "one": 1,
    "kaks": 2,
    "two": 2,
    "kolm": 3,
    "three": 3,
    "neli": 4,
    "four": 4,
    "viis": 5,
    "five": 5,
    "kuus": 6,
    "six": 6,
}

def _expected_percentage_fact_count(query: object) -> int:
    normalized = _normalize_search_text(query)
    if not normalized or not re.search(
        r"(?:\bosakaal\w*\b|\bprotsent\w*\b|%|\bkui\s+suur\s+osa\b)",
        normalized,
    ):
        return 0
    count_match = re.search(
        r"\b(\d{1,2}|uks|uhe|one|kaks|two|kolm|three|neli|four|viis|five|kuus|six)\s+"
        r"(?:\S+\s+){0,2}?(?:osakaal\w*|protsent\w*|naitaja\w*)\b",
        normalized,
    )
    if not count_match:
        return 1
    token = count_match.group(1)
    if token.isdigit():
        return max(1, min(12, int(token)))
    return _PERCENTAGE_COUNT_WORDS.get(token, 1)

def _percentage_evidence_count(document: object) -> int:
    body = _strip_synthetic_rag_prefix(str(document or ""))
    values = {
        match.group(1).replace(",", ".")
        for match in re.finditer(
            r"\b(\d{1,3}(?:[.,]\d+)?)\s*(?:%|protsent\w*)",
            body,
            flags=re.I,
        )
    }
    return len(values)

def _query_phrases(query: str) -> List[str]:
    phrases: List[str] = []
    seen = set()
    for raw in re.split(r"[\n\r]+", str(query or "")):
        normalized = _normalize_search_text(raw)
        if len(normalized) >= 8 and normalized not in seen:
            seen.add(normalized)
            phrases.append(normalized)
    full = _normalize_search_text(query)
    if len(full) >= 8 and full not in seen:
        phrases.insert(0, full)
    return phrases[:8]

def _lexical_token_counts(text: str, limit: int = 1000) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    if not text:
        return counts
    seen = 0
    for token in str(text or "").split(" "):
        cleaned = token.strip()
        if (len(cleaned) < 3 and not cleaned.isdigit()) or cleaned in LEXICAL_STOPWORDS:
            continue
        counts[cleaned] = counts.get(cleaned, 0) + 1
        seen += 1
        if seen >= limit:
            break
    return counts

def _lexical_token_frequency(query_token: str, counts: Dict[str, int]) -> int:
    exact = int(counts.get(query_token, 0) or 0)
    if exact:
        return exact
    prefix_matches = sum(
        int(frequency or 0)
        for token, frequency in counts.items()
        if min(len(query_token), len(token)) >= 5
        and abs(len(query_token) - len(token)) <= 4
        and (query_token.startswith(token) or token.startswith(query_token))
    )
    if prefix_matches or len(query_token) < 9:
        return prefix_matches
    # Estonian case endings often change only the tail of a long compound
    # (isikuandmeid/isikuandmete, andmekorralduse/andmekorraldust). Treat a
    # shared eight-character stem as the same lexical clue after the bounded
    # prefix comparison above has handled shorter inflected forms.
    stem = query_token[:8]
    stem_matches = sum(
        int(frequency or 0)
        for token, frequency in counts.items()
        if len(token) >= 9 and token[:8] == stem
    )
    if stem_matches:
        return stem_matches
    # Estonian compounds can add a qualifier before the queried noun
    # (supervisioon -> rühmasupervisioon). An eight-character internal stem is
    # specific enough for lexical recall without treating short substrings as
    # evidence.
    return sum(
        int(frequency or 0)
        for token, frequency in counts.items()
        if len(token) >= 11 and stem in token
    )

def _query_named_entity_tokens(query: str) -> set:
    tokens = set()
    for index, raw_word in enumerate(re.findall(r"[^\W_]+", str(query or ""), flags=re.UNICODE)):
        normalized = _normalize_search_text(raw_word)
        if index == 0 or len(normalized) < 5 or normalized in LEXICAL_STOPWORDS:
            continue
        if raw_word[:1].isupper():
            tokens.add(normalized)
    return tokens

def _prepare_lexical_query(query: str) -> Dict[str, object]:
    phrases = _query_phrases(query)
    return {
        "phrases": phrases,
        "query_tokens": _search_tokens(query),
        "named_entity_tokens": _query_named_entity_tokens(query),
        "paragraph_refs": _extract_query_paragraph_refs(query),
        "full_query": phrases[0] if phrases else _normalize_search_text(query),
    }


def _prepare_lexical_row(md: Dict, document: str) -> Dict[str, object]:
    author_norms: List[str] = []
    for author in normalize_authors(md.get("authors") or md.get("authors_list")):
        normalized = _normalize_search_text(author)
        if normalized:
            author_norms.append(normalized)
    return {
        "title_norm": _normalize_search_text(md.get("title") or md.get("fileName") or md.get("source_url") or ""),
        "paragraph_title_norm": _normalize_search_text(md.get("paragraph_title") or ""),
        "section_norm": _normalize_search_text(md.get("section") or ""),
        "act_title_norm": _normalize_search_text(md.get("act_title") or ""),
        "body_norm": _normalize_search_text(document[:12000]),
        "author_norms": author_norms,
        "paragraph_number": _normalize_search_text(md.get("paragraph_number") or ""),
    }


def _lexical_match(
    query: str,
    md: Dict,
    document: str,
    min_score: float = 3.0,
    *,
    prepared_query: Optional[Dict[str, object]] = None,
    prepared_row: Optional[Dict[str, object]] = None,
) -> Optional[Dict[str, object]]:
    query_data = prepared_query or _prepare_lexical_query(query)
    row_data = prepared_row or _prepare_lexical_row(md, document)
    title_norm = str(row_data.get("title_norm") or "")
    paragraph_title_norm = str(row_data.get("paragraph_title_norm") or "")
    section_norm = str(row_data.get("section_norm") or "")
    act_title_norm = str(row_data.get("act_title_norm") or "")
    body_norm = str(row_data.get("body_norm") or "")
    author_norms = list(row_data.get("author_norms") or [])
    if not title_norm and not body_norm:
        return None

    phrases = list(query_data.get("phrases") or [])
    query_tokens = list(query_data.get("query_tokens") or [])
    named_entity_tokens = set(query_data.get("named_entity_tokens") or set())
    paragraph_refs = set(query_data.get("paragraph_refs") or set())
    paragraph_number = str(row_data.get("paragraph_number") or "")
    title_counts = _lexical_token_counts(title_norm, limit=80)
    body_counts = _lexical_token_counts(body_norm, limit=900)
    title_tokens = set(title_counts.keys())
    body_tokens = set(body_counts.keys())
    channels: List[str] = []
    score = 0.0
    bm25_score = 0.0
    bm25_matches = 0
    bm25_title_matches = 0
    bm25_body_matches = 0
    bm25_named_entity_matches = 0
    bm25_coverage = 0.0

    full_query = str(query_data.get("full_query") or "")
    exact_author_match = next(
        (
            author
            for author in author_norms
            if len(author.split()) >= 2 and re.search(rf"(?:^|\s){re.escape(author)}(?:$|\s)", full_query)
        ),
        None,
    )
    if exact_author_match:
        score += 18.0
        channels.append("author_match")
    if paragraph_number and paragraph_number in paragraph_refs:
        score += 16.0
        channels.append("title_match")
        if paragraph_title_norm and paragraph_title_norm in full_query:
            score += 6.0
        elif paragraph_title_norm:
            paragraph_title_tokens = set(_search_tokens(paragraph_title_norm, limit=12))
            if paragraph_title_tokens and paragraph_title_tokens.intersection(set(query_tokens)):
                score += 3.5
        if act_title_norm and any(token in set(query_tokens) for token in _search_tokens(act_title_norm, limit=8)):
            score += 2.0
    elif paragraph_title_norm and full_query:
        if paragraph_title_norm in full_query:
            score += 8.0
            channels.append("title_match")
        elif paragraph_title_norm and paragraph_title_norm in title_norm:
            paragraph_title_tokens = set(_search_tokens(paragraph_title_norm, limit=12))
            overlap = len(paragraph_title_tokens.intersection(set(query_tokens)))
            if overlap >= max(1, min(2, len(paragraph_title_tokens))):
                score += min(6.0, 2.5 * overlap)
                channels.append("title_match")
    if section_norm and section_norm in full_query:
        score += 3.0
        if "title_match" not in channels:
            channels.append("title_match")

    if full_query and title_norm:
        if title_norm == full_query:
            score += 10.0
            channels.append("title_match")
        elif full_query in title_norm or title_norm in full_query:
            score += 6.0
            channels.append("title_match")

    for phrase in phrases:
        if title_norm and phrase in title_norm:
            score += 4.0
            if "title_match" not in channels:
                channels.append("title_match")
        elif body_norm and len(phrase) >= 12 and phrase in body_norm:
            score += 3.0
            if "exact_phrase" not in channels:
                channels.append("exact_phrase")

    if query_tokens:
        title_overlap = sum(1 for token in query_tokens if _lexical_token_frequency(token, title_counts))
        body_overlap = sum(1 for token in query_tokens if _lexical_token_frequency(token, body_counts))
        if title_overlap:
            score += min(4.0, title_overlap * 1.2)
        if body_overlap >= 2:
            score += min(2.5, body_overlap * 0.35)
        long_title_anchor = any(
            len(token) >= 8 and _lexical_token_frequency(token, title_counts)
            for token in query_tokens
        )
        if title_overlap >= max(1, min(3, len(query_tokens))) or long_title_anchor:
            if "title_match" not in channels:
                channels.append("title_match")
        for token in query_tokens:
            title_freq = _lexical_token_frequency(token, title_counts)
            body_freq = _lexical_token_frequency(token, body_counts)
            if not title_freq and not body_freq:
                continue
            bm25_matches += 1
            if title_freq:
                bm25_title_matches += 1
                bm25_score += RAG_BM25_TITLE_WEIGHT * (title_freq / (title_freq + RAG_BM25_TITLE_K))
            if body_freq:
                bm25_body_matches += 1
                bm25_score += RAG_BM25_BODY_WEIGHT * (body_freq / (body_freq + RAG_BM25_BODY_K))
            if token in named_entity_tokens and (title_freq or body_freq):
                bm25_named_entity_matches += 1
        bm25_coverage = bm25_matches / max(1, len(query_tokens))
        if bm25_matches and (
            bm25_coverage >= RAG_BM25_MIN_COVERAGE
            or bm25_matches >= min(3, len(query_tokens))
            or bm25_named_entity_matches >= 1
            or (min_score < 1.0 and bm25_body_matches >= 1)
        ):
            score += min(5.0, bm25_score)
            if bm25_named_entity_matches:
                score += min(3.5, 2.5 + 0.5 * bm25_named_entity_matches)
            if bm25_matches >= 3 and bm25_coverage >= 0.75:
                # A body passage covering nearly the whole question is more
                # useful than a directory/contact title that matches only one
                # named entity (for example "Töötukassa").
                score += min(4.0, 4.0 * bm25_coverage)
            if "bm25" not in channels:
                channels.append("bm25")

    if score < max(0.0, float(min_score or 0)) or not channels:
        return None
    return {
        "score": round(score, 4),
        "channels": channels,
        "bm25_score": round(bm25_score, 4) if query_tokens else None,
        "bm25_matches": bm25_matches if query_tokens else None,
        "bm25_title_matches": bm25_title_matches if query_tokens else None,
        "bm25_body_matches": bm25_body_matches if query_tokens else None,
        "bm25_named_entity_matches": bm25_named_entity_matches if query_tokens else None,
        "bm25_coverage": round(bm25_coverage, 6) if query_tokens else None,
        "bm25_query_tokens": len(query_tokens) if query_tokens else None,
    }

def _append_channels(result: Dict, channels: List[str]) -> None:
    existing = result.get("retrieval_channels")
    merged: List[str] = []
    for channel in (existing if isinstance(existing, list) else []) + channels:
        cleaned = str(channel or "").strip()
        if cleaned and cleaned not in merged:
            merged.append(cleaned)
    result["retrieval_channels"] = merged or ["dense"]
    result["retrievalChannel"] = result["retrieval_channels"][0]
    result["retrieval_channel"] = result["retrieval_channels"][0]
    result["retriever"] = result["retrieval_channels"][0]

def _normalize_requested_retrievers(value) -> List[str]:
    raw = value if isinstance(value, list) else []
    out: List[str] = []
    for item in raw:
        cleaned = re.sub(r"[^a-z0-9]+", "_", str(item or "").strip().lower()).strip("_")
        if cleaned and cleaned not in out:
            out.append(cleaned)
    return out or ["dense", "author_match", "title_match", "exact_phrase", "bm25"]

def _search_result_from_metadata(
    *,
    item_id: str,
    document: str,
    md: Dict,
    distance=None,
    channels: Optional[List[str]] = None,
    rank: Optional[int] = None,
    lexical_score: Optional[float] = None,
    lexical_details: Optional[Dict[str, object]] = None,
) -> Dict[str, object]:
    source_path = md.get("source_path")
    file_name = None
    if source_path:
        try:
            file_name = Path(source_path).name
        except Exception:
            file_name = source_path
    authors_val = normalize_authors(md.get("authors") or md.get("authors_list"))
    tags_val = normalize_tags(md.get("tags") or md.get("tags_list"))
    tag_tokens_val = normalize_tag_tokens(md.get("tag_tokens") or md.get("tagTokens") or tags_val)
    retrieval_channels = channels or ["dense"]
    primary_channel = retrieval_channels[0] if retrieval_channels else "dense"
    return {
        "id": item_id,
        "retriever": primary_channel,
        "retrieval_channel": primary_channel,
        "retrievalChannel": primary_channel,
        "retrieval_channels": retrieval_channels,
        "retrieval_rank": rank,
        "lexical_score": lexical_score,
        "bm25_score": lexical_details.get("bm25_score") if isinstance(lexical_details, dict) else None,
        "bm25_coverage": lexical_details.get("bm25_coverage") if isinstance(lexical_details, dict) else None,
        "bm25_matches": lexical_details.get("bm25_matches") if isinstance(lexical_details, dict) else None,
        "bm25_title_matches": lexical_details.get("bm25_title_matches") if isinstance(lexical_details, dict) else None,
        "bm25_body_matches": lexical_details.get("bm25_body_matches") if isinstance(lexical_details, dict) else None,
        "bm25_named_entity_matches": lexical_details.get("bm25_named_entity_matches") if isinstance(lexical_details, dict) else None,
        "bm25_query_tokens": lexical_details.get("bm25_query_tokens") if isinstance(lexical_details, dict) else None,
        "doc_id": md.get("doc_id") or md.get("docId"),
        "docId": md.get("docId") or md.get("doc_id"),
        "chunk_id": md.get("chunk_id") or md.get("chunkId"),
        "chunkId": md.get("chunkId") or md.get("chunk_id"),
        "chunk_index": md.get("chunk_index") or md.get("chunkIndex"),
        "chunkIndex": md.get("chunkIndex") or md.get("chunk_index"),
        "original_doc_id": md.get("original_doc_id") or md.get("originalDocId"),
        "originalDocId": md.get("originalDocId") or md.get("original_doc_id"),
        "title": md.get("title"),
        "description": md.get("description"),
        "audience": md.get("audience"),
        "audiences": md.get("audiences"),
        "authors": authors_val,
        "tag_tokens": tag_tokens_val,
        "tagTokens": tag_tokens_val,
        "issue": md.get("issue_label") or md.get("issueLabel") or md.get("issue_id") or md.get("issueId") or None,
        "issueLabel": md.get("issue_label") or md.get("issueLabel"),
        "issueId": md.get("issue_id") or md.get("issueId"),
        "year": md.get("year"),
        "articleId": md.get("article_id") or md.get("articleId"),
        "section": md.get("section"),
        "item_type": md.get("item_type"),
        "content_status": md.get("content_status"),
        "resource_type": md.get("resource_type"),
        "checked_at": md.get("checked_at"),
        "pages": md.get("pages"),
        "pageRange": md.get("pageRange"),
        "journalTitle": md.get("journal_title") or md.get("journalTitle"),
        "source_id": md.get("source_id"),
        "sourceId": md.get("sourceId") or md.get("source_id"),
        "document_id": md.get("document_id"),
        "documentId": md.get("documentId") or md.get("document_id"),
        "legacy_source_type": md.get("legacy_source_type"),
        "authority": md.get("authority"),
        "url_canonical": md.get("url_canonical"),
        "retrieved_at": md.get("retrieved_at"),
        "last_checked": md.get("last_checked"),
        "valid_from": md.get("valid_from"),
        "valid_to": md.get("valid_to"),
        "historical": md.get("historical"),
        "source_status": md.get("source_status"),
        "canonical_item_id": md.get("canonical_item_id"),
        "content_hash": md.get("content_hash"),
        "collection_id": md.get("collection_id"),
        "country": md.get("country"),
        "county": md.get("county"),
        "jurisdiction_level": md.get("jurisdiction_level"),
        "municipality_name": md.get("municipality_name"),
        "municipality": md.get("municipality"),
        "issuer": md.get("issuer"),
        "act_title": md.get("act_title"),
        "act_reference": md.get("act_reference"),
        "chapter_number": md.get("chapter_number"),
        "chapter_title": md.get("chapter_title"),
        "paragraph_number": md.get("paragraph_number"),
        "paragraph_title": md.get("paragraph_title"),
        "subsection_number": md.get("subsection_number"),
        "point_number": md.get("point_number"),
        "chunk_level": md.get("chunk_level"),
        "canonical_source_id": md.get("canonical_source_id"),
        "canonical_chunk_id": md.get("canonical_chunk_id"),
        "source_format": md.get("source_format"),
        "municipality_id": md.get("municipality_id"),
        "district_name": md.get("district_name"),
        "district_id": md.get("district_id"),
        "source_keys": md.get("source_keys"),
        "source_urls": md.get("source_urls"),
        "source_register_file": md.get("source_register_file"),
        "source_count": md.get("source_count"),
        "administering_body": md.get("administering_body"),
        "tags": tags_val,
        "language": md.get("language"),
        "chunk": document,
        "url": md.get("source_url"),
        "fileName": file_name,
        "source_type": md.get("source_type"),
        "page": md.get("page"),
        "distance": distance,
    }

def _hybrid_dense_score(distance) -> float:
    try:
        value = float(distance)
    except Exception:
        return 0.0
    if value < 0:
        value = 0.0
    return 1.0 / (1.0 + value)

def _hybrid_lexical_score(value) -> float:
    try:
        score = float(value)
    except Exception:
        return 0.0
    if score <= 0:
        return 0.0
    return score / (score + 8.0)

def _apply_hybrid_ranking(results: List[Dict[str, object]]) -> None:
    if not results:
        return
    rrf_k = max(1, RAG_RRF_K)
    for original_index, item in enumerate(results):
        channels = item.get("retrieval_channels") if isinstance(item.get("retrieval_channels"), list) else []
        global_dense_rank = _to_int(item.get("global_dense_rank"))
        fact_segment_dense_rank = _to_int(item.get("fact_segment_dense_rank"))
        # ``dense_rank`` stays as a backwards-compatible ranking input. The
        # explicit fields preserve whether that rank came from the corpus-wide
        # query or from a bounded query inside already selected documents.
        dense_rank = (
            global_dense_rank
            or fact_segment_dense_rank
            or _to_int(item.get("dense_rank") or item.get("retrieval_rank"))
        )
        lexical_rank = _to_int(item.get("lexical_rank"))
        dense_score = _hybrid_dense_score(item.get("distance")) if "dense" in channels else 0.0
        lexical_score = _hybrid_lexical_score(item.get("lexical_score")) if any(
            channel in channels for channel in ["author_match", "title_match", "exact_phrase", "bm25", "registry_fact"]
        ) else 0.0
        rrf_score = 0.0
        rrf_contributions: Dict[str, float] = {}
        if dense_rank and "dense" in channels:
            contribution = HYBRID_CHANNEL_WEIGHTS["dense"] / (rrf_k + dense_rank)
            rrf_score += contribution
            rrf_contributions["dense"] = round(contribution, 6)
        if lexical_rank:
            for channel in channels:
                if channel == "dense":
                    continue
                contribution = HYBRID_CHANNEL_WEIGHTS.get(str(channel), 0.75) / (rrf_k + lexical_rank)
                rrf_score += contribution
                rrf_contributions[str(channel)] = round(contribution, 6)
        channel_boosts = {
            str(channel): round(HYBRID_CHANNEL_BOOSTS.get(str(channel), 0.0), 6)
            for channel in channels
            if HYBRID_CHANNEL_BOOSTS.get(str(channel), 0.0)
        }
        channel_boost = sum(channel_boosts.values())
        bm25_coverage = 0.0
        try:
            bm25_coverage = max(0.0, min(1.0, float(item.get("bm25_coverage") or 0)))
        except Exception:
            bm25_coverage = 0.0
        bm25_matches = _to_int(item.get("bm25_matches")) or 0
        named_entity_matches = _to_int(item.get("bm25_named_entity_matches")) or 0
        bm25_coverage_boost = (
            min(0.24, (bm25_coverage - 0.5) * 0.6)
            if "bm25" in channels and bm25_matches >= 3 and bm25_coverage > 0.5
            else 0.0
        )
        named_entity_boost = min(0.42, 0.26 + 0.08 * named_entity_matches) if named_entity_matches else 0.0
        fact_segment_hits = _to_int(item.get("fact_segment_hits")) or 0
        fact_segment_best_rank = _to_int(item.get("fact_segment_best_rank")) or 0
        fact_segment_boost = (
            min(
                0.55,
                0.20
                + (0.08 * fact_segment_hits)
                + max(0.0, 0.18 - (0.02 * max(0, fact_segment_best_rank - 1))),
            )
            if fact_segment_hits and fact_segment_best_rank
            else 0.0
        )
        hybrid_score = (
            (dense_score * 0.58)
            + (lexical_score * 0.34)
            + (rrf_score * 8.0)
            + channel_boost
            + bm25_coverage_boost
            + named_entity_boost
            + fact_segment_boost
        )
        item["dense_score"] = round(dense_score, 6) if dense_score else None
        item["lexical_score_normalized"] = round(lexical_score, 6) if lexical_score else None
        item["rrf_score"] = round(rrf_score, 6)
        item["channel_boost"] = round(channel_boost, 6)
        item["bm25_coverage_boost"] = round(bm25_coverage_boost, 6)
        item["named_entity_boost"] = round(named_entity_boost, 6)
        item["fact_segment_boost"] = round(fact_segment_boost, 6)
        item["hybrid_score"] = round(hybrid_score, 6)
        item["hybridScore"] = item["hybrid_score"]
        item["retrieval_scores"] = {
            "dense_score": item.get("dense_score"),
            "lexical_score_raw": item.get("lexical_score"),
            "lexical_score_normalized": item.get("lexical_score_normalized"),
            "bm25_score": item.get("bm25_score"),
            "bm25_coverage": item.get("bm25_coverage"),
            "bm25_matches": item.get("bm25_matches"),
            "bm25_named_entity_matches": item.get("bm25_named_entity_matches"),
            "bm25_query_tokens": item.get("bm25_query_tokens"),
            "rrf_score": item.get("rrf_score"),
            "channel_boost": item.get("channel_boost"),
            "bm25_coverage_boost": item.get("bm25_coverage_boost"),
            "named_entity_boost": item.get("named_entity_boost"),
            "fact_segment_hits": fact_segment_hits,
            "fact_segment_best_rank": fact_segment_best_rank or None,
            "fact_segment_boost": item.get("fact_segment_boost"),
            "hybrid_score": item.get("hybrid_score"),
            "dense_rank": dense_rank,
            "global_dense_rank": global_dense_rank,
            "fact_segment_dense_rank": fact_segment_dense_rank,
            "dense_rank_scope": (
                "global"
                if global_dense_rank
                else "fact_segment"
                if fact_segment_dense_rank
                else None
            ),
            "lexical_rank": lexical_rank,
            "rrf_contributions": rrf_contributions,
            "channel_boosts": channel_boosts,
        }
        item["_hybrid_original_index"] = original_index

    results.sort(
        key=lambda item: (
            -float(item.get("hybrid_score") or 0),
            int(item.get("lexical_rank") or item.get("dense_rank") or item.get("retrieval_rank") or 999999),
            int(item.get("_hybrid_original_index") or 0),
        )
    )
    for rank, item in enumerate(results, start=1):
        item["hybrid_rank"] = rank
        item["hybridRank"] = rank
        if isinstance(item.get("retrieval_scores"), dict):
            item["retrieval_scores"]["hybrid_rank"] = rank
        item.pop("_hybrid_original_index", None)

def _select_diverse_search_results(
    results: List[Dict[str, object]],
    limit: int,
    journal_chunks_per_document: int = 3,
) -> List[Dict[str, object]]:
    selected: List[Dict[str, object]] = []
    document_counts: Dict[str, int] = {}
    target = max(1, int(limit or 1))
    per_document = max(1, int(journal_chunks_per_document or 1))

    for item in results:
        document_key = _result_document_key(item)
        if document_key:
            current = document_counts.get(document_key, 0)
            if current >= per_document:
                continue
            document_counts[document_key] = current + 1
        selected.append(item)
        if len(selected) >= target:
            break

    return selected

def _result_document_key(item: Dict[str, object]) -> str:
    return str(
        item.get("doc_id")
        or item.get("docId")
        or item.get("document_id")
        or item.get("documentId")
        or item.get("articleId")
        or item.get("id")
        or ""
    ).strip()

def _select_fact_covered_search_results(
    results: List[Dict[str, object]],
    baseline_results: List[Dict[str, object]],
    limit: int,
    journal_chunks_per_document: int,
) -> List[Dict[str, object]]:
    """Add subquery evidence without deleting a source found by the full query."""
    target = max(1, int(limit or 1))
    per_document = max(1, int(journal_chunks_per_document or 1))
    if per_document <= 3 or not baseline_results:
        return _select_diverse_search_results(results, target, per_document)

    result_by_id = {
        str(item.get("id") or "").strip(): item
        for item in results
        if str(item.get("id") or "").strip()
    }
    result_order = {
        item_id: index
        for index, item_id in enumerate(result_by_id.keys())
    }
    protected_ids: List[str] = []
    protected_documents = set()
    for baseline in baseline_results:
        item_id = str(baseline.get("id") or "").strip()
        item = result_by_id.get(item_id)
        if item is None:
            continue
        document_key = _result_document_key(item)
        # Kitsas faktiküsimus peab säilitama mitme allika sünteesi, kuid iga
        # juhuslikku ühe lõiguga allikat ei saa kaitsta täpse tõendi arvelt.
        # Hoia alles kolm parimat täispäringu allikat; ülejäänud kohad võivad
        # alamküsimuste otsesed lõigud välja vahetada.
        if document_key not in protected_documents and len(protected_documents) < 3:
            protected_documents.add(document_key)
            protected_ids.append(item_id)

    by_segment: Dict[str, List[Tuple[int, int, int, str]]] = {}
    for result_index, item in enumerate(results):
        item_id = str(item.get("id") or "").strip()
        segment_ranks = item.get("fact_segment_ranks")
        if not item_id or not isinstance(segment_ranks, dict):
            continue
        lexical_segment_ranks = item.get("fact_segment_lexical_ranks")
        if not isinstance(lexical_segment_ranks, dict):
            lexical_segment_ranks = {}
        for segment_index, rank_value in segment_ranks.items():
            lexical_rank = _to_int(lexical_segment_ranks.get(str(segment_index)))
            rank = lexical_rank or _to_int(rank_value)
            if rank:
                adjacent_best_segments = item.get("fact_adjacent_to_best_segments")
                is_adjacent_to_best = isinstance(adjacent_best_segments, list) and (
                    str(segment_index) in {str(value) for value in adjacent_best_segments}
                )
                if lexical_rank and item.get("fact_neighbor") is not True:
                    evidence_priority = 0
                elif rank == 1 and item.get("fact_neighbor") is not True:
                    evidence_priority = 1
                elif is_adjacent_to_best or item.get("fact_neighbor") is True:
                    evidence_priority = 2
                else:
                    # Kui täpne sõnatabamus puudub, on parima semantilise
                    # lõigu vahetu jätk PDF-i tükelduspiiril sageli kasulikum
                    # kui teine, sisult sarnane, kuid kaugem lõik.
                    evidence_priority = 3
                by_segment.setdefault(str(segment_index), []).append((evidence_priority, rank, result_index, item_id))
    primary_fact_ids: List[str] = []
    secondary_fact_ids: List[str] = []
    tertiary_fact_ids: List[str] = []
    for segment_index in sorted(
        by_segment,
        key=lambda value: (0, int(value)) if str(value).isdigit() else (1, str(value)),
    ):
        candidates = by_segment[segment_index]
        candidates.sort()
        if candidates:
            primary_fact_ids.append(candidates[0][3])
        if len(candidates) > 1:
            secondary_fact_ids.append(candidates[1][3])
        if len(candidates) > 2:
            tertiary_fact_ids.append(candidates[2][3])

    baseline_ids = [
        str(item.get("id") or "").strip()
        for item in baseline_results
        if str(item.get("id") or "").strip()
    ]
    desired_order = [
        *protected_ids,
        *primary_fact_ids,
        *secondary_fact_ids,
        *tertiary_fact_ids,
        *baseline_ids,
        *result_by_id.keys(),
    ]
    selected: List[Dict[str, object]] = []
    selected_ids = set()
    document_counts: Dict[str, int] = {}
    for item_id in desired_order:
        if len(selected) >= target:
            break
        if not item_id or item_id in selected_ids:
            continue
        item = result_by_id.get(item_id)
        if item is None:
            continue
        document_key = _result_document_key(item)
        if document_counts.get(document_key, 0) >= per_document:
            continue
        selected.append(item)
        selected_ids.add(item_id)
        document_counts[document_key] = document_counts.get(document_key, 0) + 1

    selected.sort(key=lambda item: result_order.get(str(item.get("id") or "").strip(), len(results)))
    return selected[:target]

def _dense_candidate_limit(top_k: int) -> int:
    return max(1, min(200, max(64, int(top_k or 1) * 6)))

def _build_hybrid_merge_strategy(requested_retrievers: List[str]) -> Dict[str, object]:
    return {
        "strategy": "weighted_hybrid_rrf",
        "rrf_k": max(1, RAG_RRF_K),
        "requested_retrievers": requested_retrievers,
        "channel_weights": HYBRID_CHANNEL_WEIGHTS,
        "channel_boosts": HYBRID_CHANNEL_BOOSTS,
        "bm25_config": {
            "min_coverage": RAG_BM25_MIN_COVERAGE,
            "title_weight": RAG_BM25_TITLE_WEIGHT,
            "body_weight": RAG_BM25_BODY_WEIGHT,
            "title_k": RAG_BM25_TITLE_K,
            "body_k": RAG_BM25_BODY_K,
        },
        "score_formula": "dense_score*0.58 + lexical_score*0.34 + rrf_score*8.0 + channel_boost + bm25_coverage_boost",
    }

def _build_channel_stats(results: List[Dict[str, object]]) -> Dict[str, object]:
    channel_counts: Dict[str, int] = {}
    top_channels: List[str] = []
    bm25_scores: List[float] = []
    bm25_coverages: List[float] = []
    bm25_only_count = 0
    lexical_only_count = 0
    dense_only_count = 0
    dense_and_lexical_count = 0
    for item in results:
        channels = item.get("retrieval_channels") if isinstance(item.get("retrieval_channels"), list) else []
        channel_set = {str(channel or "").strip() for channel in channels if str(channel or "").strip()}
        has_dense = "dense" in channel_set
        has_lexical = any(channel in channel_set for channel in ["author_match", "title_match", "exact_phrase", "bm25"])
        if has_dense and not has_lexical:
            dense_only_count += 1
        elif has_lexical and not has_dense:
            lexical_only_count += 1
        elif has_dense and has_lexical:
            dense_and_lexical_count += 1
        if channel_set == {"bm25"}:
            bm25_only_count += 1
        if "bm25" in channel_set:
            try:
                bm25_score = float(item.get("bm25_score"))
                if math.isfinite(bm25_score):
                    bm25_scores.append(bm25_score)
            except Exception:
                pass
            try:
                bm25_coverage = float(item.get("bm25_coverage"))
                if math.isfinite(bm25_coverage):
                    bm25_coverages.append(bm25_coverage)
            except Exception:
                pass
        for channel in channels:
            cleaned = str(channel or "").strip()
            if not cleaned:
                continue
            channel_counts[cleaned] = channel_counts.get(cleaned, 0) + 1
            if cleaned not in top_channels and len(top_channels) < 8:
                top_channels.append(cleaned)
    bm25_summary = {
        "result_count": channel_counts.get("bm25", 0),
        "only_count": bm25_only_count,
        "average_score": round(sum(bm25_scores) / len(bm25_scores), 6) if bm25_scores else None,
        "top_score": round(max(bm25_scores), 6) if bm25_scores else None,
        "average_coverage": round(sum(bm25_coverages) / len(bm25_coverages), 6) if bm25_coverages else None,
        "min_coverage": round(min(bm25_coverages), 6) if bm25_coverages else None,
        "low_coverage_count": sum(1 for value in bm25_coverages if value < max(0.0, RAG_BM25_MIN_COVERAGE)),
    }
    return {
        "result_count": len(results),
        "channel_counts": channel_counts,
        "top_channels": top_channels,
        "hybrid_ranked_count": sum(1 for item in results if _to_int(item.get("hybrid_rank"))),
        "dense_only_count": dense_only_count,
        "lexical_only_count": lexical_only_count,
        "dense_and_lexical_count": dense_and_lexical_count,
        "bm25": bm25_summary,
    }

def _strip_synthetic_rag_prefix(document: str) -> str:
    """Return the real chunk body from legacy prefixed Chroma documents."""
    raw = str(document or "").strip()
    if not raw.startswith("[TITLE]"):
        return raw

    # Legacy chunks normally contain STATUS (and sometimes PAGES) as the final
    # synthetic fields. This also handles old single-line fixtures.
    known_markers = {
        "TITLE", "DESC", "AUTHORS", "JOURNAL", "ISSUE", "SECTION", "YEAR",
        "ITEM_TYPE", "STATUS", "RESOURCE_TYPE", "ADMIN_BODY", "COUNTY",
        "MUNICIPALITY", "PAGES", "PDF_SECTION",
    }

    def strip_leading_marker_lines(value: str) -> str:
        lines = str(value or "").splitlines()
        first_body = 0
        for index, line in enumerate(lines):
            marker = re.match(r"^\s*\[([A-Z_]+)\]", line)
            if not marker or marker.group(1) not in known_markers:
                first_body = index
                break
        else:
            return ""
        return "\n".join(lines[first_body:]).strip()

    body = re.sub(
        r"^\[TITLE\][\s\S]*?\[STATUS\]\s*(?:active|inactive|archived|stale|unknown|historical)\s*",
        "",
        raw,
        flags=re.IGNORECASE,
    )
    body = strip_leading_marker_lines(body)
    if body and body != raw:
        return body

    # Fallback for older records without STATUS: strip consecutive marker lines
    # only. If no unambiguous boundary exists, keep the original text.
    candidate = strip_leading_marker_lines(raw)
    return candidate or raw


def _new_lexical_metrics() -> Dict[str, object]:
    return {
        "lexical_registry_shortlist_ms": 0.0,
        "lexical_chroma_fetch_ms": 0.0,
        "lexical_chroma_materialize_ms": 0.0,
        "lexical_chroma_page_count": 0,
        "lexical_rows_loaded": 0,
        "lexical_index_validation_ms": 0.0,
        "lexical_index_query_ms": 0.0,
        "lexical_index_materialize_ms": 0.0,
        "lexical_normalization_ms": 0.0,
        "lexical_scoring_ms": 0.0,
        "lexical_ranking_ms": 0.0,
        "lexical_overhead_ms": 0.0,
        "lexical_total_ms": 0.0,
    }


def _add_lexical_elapsed(metrics: Optional[Dict[str, object]], key: str, started_at: float) -> None:
    if metrics is None:
        return
    metrics[key] = float(metrics.get(key) or 0.0) + ((time.perf_counter() - started_at) * 1000.0)


def _finalize_lexical_metrics(metrics: Dict[str, object], started_at: float) -> Dict[str, object]:
    total_ms = (time.perf_counter() - started_at) * 1000.0
    measured_keys = (
        "lexical_registry_shortlist_ms",
        "lexical_chroma_fetch_ms",
        "lexical_chroma_materialize_ms",
        "lexical_index_validation_ms",
        "lexical_index_query_ms",
        "lexical_index_materialize_ms",
        "lexical_normalization_ms",
        "lexical_scoring_ms",
        "lexical_ranking_ms",
    )
    measured_ms = sum(float(metrics.get(key) or 0.0) for key in measured_keys)
    metrics["lexical_overhead_ms"] = max(0.0, total_ms - measured_ms)
    metrics["lexical_total_ms"] = total_ms
    for key, value in list(metrics.items()):
        if key.endswith("_ms"):
            metrics[key] = int(round(float(value or 0.0)))
    return metrics


def _score_lexical_rows(
    query: str,
    allowed_channels: set,
    ids: List[object],
    documents: List[object],
    metadatas: List[object],
    body_only: bool = False,
    include_title: bool = True,
    min_score: float = 3.0,
    metrics: Optional[Dict[str, object]] = None,
) -> List[Dict[str, object]]:
    normalization_t0 = time.perf_counter()
    prepared_query = _prepare_lexical_query(query)
    prepared_rows: List[Dict[str, object]] = []
    row_values: List[Tuple[object, str, Dict[str, object], Dict[str, object]]] = []
    for i, item_id in enumerate(ids):
        document = documents[i] if i < len(documents) and isinstance(documents[i], str) else ""
        md = metadatas[i] if i < len(metadatas) and isinstance(metadatas[i], dict) else {}
        scoring_document = _strip_synthetic_rag_prefix(document) if body_only else document
        scoring_metadata = md if include_title else {
            **md,
            "title": None,
            "fileName": None,
            "source_url": None,
        }
        prepared_rows.append(_prepare_lexical_row(scoring_metadata, scoring_document))
        row_values.append((item_id, document, md, scoring_metadata))
    _add_lexical_elapsed(metrics, "lexical_normalization_ms", normalization_t0)

    scoring_t0 = time.perf_counter()
    scored: List[Dict[str, object]] = []
    for i, (item_id, document, md, scoring_metadata) in enumerate(row_values):
        match = _lexical_match(
            query,
            scoring_metadata,
            document,
            min_score=min_score,
            prepared_query=prepared_query,
            prepared_row=prepared_rows[i],
        )
        if not match:
            continue
        channels = [item for item in list(match["channels"]) if item in allowed_channels]
        if not channels:
            continue
        scored.append({
            "id": item_id,
            "document": document,
            "metadata": md,
            "score": float(match["score"]),
            "channels": channels,
            "bm25_score": match.get("bm25_score"),
            "bm25_coverage": match.get("bm25_coverage"),
            "bm25_matches": match.get("bm25_matches"),
            "bm25_title_matches": match.get("bm25_title_matches"),
            "bm25_body_matches": match.get("bm25_body_matches"),
            "bm25_named_entity_matches": match.get("bm25_named_entity_matches"),
            "bm25_query_tokens": match.get("bm25_query_tokens"),
        })
    _add_lexical_elapsed(metrics, "lexical_scoring_ms", scoring_t0)
    ranking_t0 = time.perf_counter()
    scored.sort(key=lambda item: float(item.get("score") or 0), reverse=True)
    _add_lexical_elapsed(metrics, "lexical_ranking_ms", ranking_t0)
    return scored

def _select_lexical_candidates(
    candidates: List[Dict[str, object]],
    limit: int,
    per_document: int = 4,
) -> List[Dict[str, object]]:
    selected: List[Dict[str, object]] = []
    document_counts: Dict[str, int] = {}
    target = max(1, int(limit or 1))
    document_cap = max(1, int(per_document or 1))
    for candidate in candidates:
        metadata = candidate.get("metadata") if isinstance(candidate.get("metadata"), dict) else {}
        document_key = str(
            metadata.get("doc_id")
            or metadata.get("docId")
            or metadata.get("document_id")
            or metadata.get("documentId")
            or metadata.get("article_id")
            or metadata.get("articleId")
            or candidate.get("id")
            or ""
        ).strip()
        if document_key:
            count = document_counts.get(document_key, 0)
            if count >= document_cap:
                continue
            document_counts[document_key] = count + 1
        selected.append(candidate)
        if len(selected) >= target:
            break
    return selected

def _compound_document_shortlist_candidates(
    query: str,
    allowed_channels: set,
    ids: List[object],
    documents: List[object],
    metadatas: List[object],
    limit: int,
    metrics: Optional[Dict[str, object]] = None,
) -> List[Dict[str, object]]:
    """Return bounded evidence when every query segment matches one document."""
    segments = _split_fact_query_segments(query, anchor_short=False)
    if len(segments) < 2 or not ids:
        return []
    candidates_by_id: Dict[str, Dict[str, object]] = {}
    common_doc_ids: Optional[set] = None
    for segment in segments:
        scored = _score_lexical_rows(
            segment,
            allowed_channels,
            ids,
            documents,
            metadatas,
            body_only=True,
            include_title=False,
            min_score=0.2,
            metrics=metrics,
        )
        segment_candidates = _select_lexical_candidates(
            scored,
            max(12, min(50, int(limit or 1) * 3)),
            per_document=4,
        )
        segment_doc_ids = {
            str((candidate.get("metadata") or {}).get("doc_id") or (candidate.get("metadata") or {}).get("docId") or "").strip()
            for candidate in segment_candidates
            if isinstance(candidate.get("metadata"), dict)
        }
        segment_doc_ids.discard("")
        common_doc_ids = segment_doc_ids if common_doc_ids is None else common_doc_ids.intersection(segment_doc_ids)
        if not common_doc_ids:
            return []
        for candidate in segment_candidates:
            item_id = str(candidate.get("id") or "").strip()
            if not item_id:
                continue
            existing = candidates_by_id.get(item_id)
            if existing is None or float(candidate.get("score") or 0) > float(existing.get("score") or 0):
                candidates_by_id[item_id] = candidate
    if not common_doc_ids:
        return []
    candidates = [
        candidate
        for candidate in candidates_by_id.values()
        if str((candidate.get("metadata") or {}).get("doc_id") or (candidate.get("metadata") or {}).get("docId") or "").strip()
        in common_doc_ids
    ]
    candidates.sort(key=lambda item: float(item.get("score") or 0), reverse=True)
    return _select_lexical_candidates(
        candidates,
        max(1, min(50, int(limit or 1))),
        per_document=max(4, min(12, int(limit or 1))),
    )

def _registry_title_shortlist_doc_ids(
    query: str,
    chroma_where: Optional[Dict[str, object]],
    limit: int = 20,
) -> List[str]:
    # Fact-shape words describe the requested answer, not the document's
    # subject. Counting them in title coverage made concise questions such as
    # “Inimarengu aruanne: leheküljed, autorite arv ja stsenaariumid?” miss a
    # title that contains the complete subject phrase. The same happened with
    # inflected one-subject questions (“erihooldekodude ... protsenti”).
    intent_prefixes = (
        "aast",
        "arv",
        "autor",
        "kaardist",
        "kohtum",
        "kolm",
        "lehek",
        "maakond",
        "millal",
        "naitaj",
        "osakaal",
        "otsus",
        "palju",
        "protsent",
        "sagedus",
        "stsena",
        "tehti",
    )
    query_tokens = [
        token
        for token in _search_tokens(query)
        if not any(token.startswith(prefix) for prefix in intent_prefixes)
    ]
    if not query_tokens:
        return []
    matches: List[tuple] = []
    for doc_id, metadata in _load_registry().items():
        if not isinstance(metadata, dict) or not _metadata_matches_filter(metadata, chroma_where):
            continue
        title_counts = _lexical_token_counts(
            _normalize_search_text(metadata.get("title") or metadata.get("fileName")),
            limit=80,
        )
        matched_tokens = [
            token for token in query_tokens if _lexical_token_frequency(token, title_counts)
        ]
        overlap = len(matched_tokens)
        coverage = overlap / max(1, len(query_tokens))
        distinctive_single = (
            overlap == 1
            and len(query_tokens) <= 2
            and len(matched_tokens[0]) >= 9
            and coverage >= 0.5
        )
        if not distinctive_single and (overlap < 2 or coverage < 0.6):
            continue
        matches.append((coverage, overlap, str(doc_id)))
    matches.sort(key=lambda item: (-item[0], -item[1], item[2]))
    return [doc_id for _coverage, _overlap, doc_id in matches[:max(1, limit)]]


_REGISTRY_FACT_ANSWER_SHAPE_PREFIXES = (
    "arv",
    "kokku",
    "kui",
    "kuju",
    "millal",
    "millise",
    "mitu",
    "need",
    "neid",
    "nende",
    "oli",
    "olid",
    "palju",
    "saadi",
    "selle",
    "tehti",
)

_REGISTRY_RESEARCH_METHOD_PREFIXES = (
    "analuus",
    "andm",
    "intervju",
    "uurim",
    "uuring",
)


def _is_research_method_fact_query(query: object) -> bool:
    normalized = _normalize_search_text(query)
    singular_research_source = re.search(
        r"\b(?:uuring|uuringu|uuringus|uuringust|uurimus|uurimuse|uurimuses|uurimusest|artikkel|artikli|artiklis|artiklist|aruanne|aruande|aruandes|aruandest|raport|raporti|raportis|raportist|analuus|analuusi|analuusis|analuusist)\b",
        normalized,
    )
    method_or_sample_fact = re.search(
        r"\b(?:intervju\w*|analuusimeetod\w*|meetod\w*|valim\w*|osalej\w*|vastaj\w*)\b",
        normalized,
    )
    return bool(singular_research_source and method_or_sample_fact)


def _estonian_derivational_roots(token: object) -> List[str]:
    """Return conservative long roots for registry-description recall.

    The registry stores natural Estonian summaries, so a query noun such as
    ``toetamise`` can refer to title text using ``toetuse``. These roots are
    deliberately used only by the bounded registry fact shortlist, not by the
    global lexical ranker.
    """
    normalized = _normalize_search_text(token)
    if not normalized:
        return []
    roots = {normalized}
    suffixes = (
        "jatega",
        "jatele",
        "jatest",
        "misega",
        "misest",
        "mises",
        "mised",
        "mist",
        "mise",
        "mine",
        "usega",
        "usest",
        "uses",
        "used",
        "ust",
        "use",
        "sid",
        "ti",
        "s",
    )
    for suffix in suffixes:
        if normalized.endswith(suffix) and len(normalized) - len(suffix) >= 4:
            roots.add(normalized[:-len(suffix)])
    return sorted(roots, key=lambda value: (-len(value), value))


def _registry_derivational_token_frequency(query_token: str, counts: Dict[str, int]) -> int:
    query_roots = _estonian_derivational_roots(query_token)
    if not query_roots:
        return 0
    total = 0
    for token, frequency in counts.items():
        token_roots = _estonian_derivational_roots(token)
        matched = False
        for query_root in query_roots:
            for token_root in token_roots:
                shorter, longer = sorted((query_root, token_root), key=len)
                if len(shorter) >= 4 and longer.startswith(shorter):
                    matched = True
                    break
                if len(query_root) >= 5 and len(token_root) >= 9 and query_root in token_root:
                    matched = True
                    break
            if matched:
                break
        if matched:
            total += int(frequency or 0)
    return total


def _registry_fact_description_query_tokens(query: object) -> List[str]:
    research_method_query = _is_research_method_fact_query(query)
    return [
        token
        for token in _search_tokens(query, limit=24)
        if not any(token.startswith(prefix) for prefix in _REGISTRY_FACT_ANSWER_SHAPE_PREFIXES)
        and not (
            research_method_query
            and any(token.startswith(prefix) for prefix in _REGISTRY_RESEARCH_METHOD_PREFIXES)
        )
    ]


def _registry_fact_description_shortlist_doc_ids(
    query: str,
    chroma_where: Optional[Dict[str, object]],
    limit: int = 12,
) -> List[str]:
    """Use registry descriptions to anchor concise quantitative fact questions.

    Some journal entries intentionally have generic titles (for example a
    ministry news roundup), while their registry description and article body
    contain the exact fact. This bounded shortlist is used only when the query
    asks for a quantity/time fact and at least two meaningful query tokens
    match the description. A single topical word such as ``supervisioon`` is
    not enough to lock retrieval to a document.
    """
    normalized_query = _normalize_search_text(query)
    if not normalized_query or not re.search(
        r"\b(?:arv\w*|kui\s+palju|millal|mitu|palju|protsent\w*|osakaal\w*|sagedus\w*)\b",
        normalized_query,
    ):
        return []
    query_tokens = _registry_fact_description_query_tokens(query)
    if len(query_tokens) < 2:
        return []
    matches: List[tuple] = []
    for doc_id, metadata in _load_registry().items():
        if not isinstance(metadata, dict) or not _metadata_matches_filter(metadata, chroma_where):
            continue
        description = _normalize_search_text(
            metadata.get("description")
            or metadata.get("summary")
            or metadata.get("description_et")
        )
        if not description:
            continue
        research_method_query = _is_research_method_fact_query(query)
        if research_method_query and not (
            re.search(r"\bintervju\w*\b", description)
            and re.search(r"\banaluus\w*\b", description)
        ):
            continue
        registry_fact_text = " ".join(
            str(value or "")
            for value in [
                metadata.get("title"),
                description,
                metadata.get("tags"),
            ]
        )
        description_counts = _lexical_token_counts(
            _normalize_search_text(registry_fact_text),
            limit=500,
        )
        identity_counts = _lexical_token_counts(
            _normalize_search_text(" ".join(
                str(value or "")
                for value in [metadata.get("title"), metadata.get("tags")]
            )),
            limit=200,
        )
        matched_tokens = [
            token
            for token in query_tokens
            if _lexical_token_frequency(token, description_counts)
            or _registry_derivational_token_frequency(token, description_counts)
            or (
                len(token) >= 8
                and any(token[:8] in description_token for description_token in description_counts)
            )
        ]
        overlap = len(matched_tokens)
        coverage = overlap / max(1, len(query_tokens))
        if overlap < 2 or coverage < 0.66:
            continue
        if research_method_query:
            identity_overlap = sum(
                1
                for token in query_tokens
                if _lexical_token_frequency(token, identity_counts)
                or _registry_derivational_token_frequency(token, identity_counts)
            )
            # Interview and analysis terms describe the requested answer shape,
            # not the study subject. Require the remaining subject words to
            # identify the title/tags before a methods-heavy description may
            # anchor retrieval to one document.
            if identity_overlap < min(2, len(query_tokens)):
                continue
        distinctive_matches = sum(1 for token in matched_tokens if len(token) >= 8)
        if distinctive_matches < 1:
            continue
        numeric_cue = bool(re.search(
            r"\b(?:\d+(?:[.,]\d+)?|uks|uhe|kaks|kolm|neli|viis|kuus|seitse|kaheksa|uheksa|kumme)\b|%",
            description,
        ))
        resolved_doc_id = str(metadata.get("doc_id") or metadata.get("docId") or doc_id).strip()
        if not resolved_doc_id:
            continue
        matches.append((coverage, overlap, distinctive_matches, numeric_cue, resolved_doc_id))
    matches.sort(key=lambda item: (-item[0], -item[1], -item[2], -int(item[3]), item[4]))
    return [doc_id for _coverage, _overlap, _distinctive, _numeric, doc_id in matches[:max(1, limit)]]


def _registry_author_shortlist_doc_ids(
    query: str,
    chroma_where: Optional[Dict[str, object]],
    limit: int = 50,
) -> List[str]:
    normalized_query = _normalize_search_text(query)
    if not normalized_query:
        return []
    matches: List[str] = []
    for doc_id, metadata in _load_registry().items():
        if not isinstance(metadata, dict) or not _metadata_matches_filter(metadata, chroma_where):
            continue
        author_tokens = []
        for index in range(MAX_AUTHOR_TOKEN_SLOTS):
            token = _normalize_search_text(metadata.get(f"author_token_{index + 1}"))
            if token and token not in author_tokens:
                author_tokens.append(token)
        if not author_tokens:
            author_tokens = normalize_author_tokens(metadata.get("authors") or metadata.get("authors_list"))
        query_words = _search_tokens(normalized_query, limit=40)

        def author_matches(author: str) -> bool:
            parts = [part for part in author.split() if part]
            if len(parts) < 2:
                return False
            if re.search(rf"(?:^|\s){re.escape(author)}(?:$|\s)", normalized_query):
                return True
            # Estonian questions inflect names (for example Kütt -> Küti).
            # Require the first name exactly and only allow a conservative
            # one-stem difference in the final name token. This is a bounded
            # registry identity check, not a global fuzzy person search.
            first_name = parts[0]
            surname = parts[-1]
            for index, word in enumerate(query_words[:-1]):
                if word != first_name:
                    continue
                query_surname = query_words[index + 1]
                if len(query_surname) < 3:
                    continue
                common = 0
                for left, right in zip(surname, query_surname):
                    if left != right:
                        break
                    common += 1
                required = max(3, min(len(surname), len(query_surname)) - 1)
                if common >= required and abs(len(surname) - len(query_surname)) <= 2:
                    return True
            return False

        exact = any(author_matches(author) for author in author_tokens)
        if not exact:
            continue
        resolved_doc_id = str(metadata.get("doc_id") or metadata.get("docId") or doc_id).strip()
        if resolved_doc_id and resolved_doc_id not in matches:
            matches.append(resolved_doc_id)
        if len(matches) >= max(1, int(limit or 1)):
            break
    return matches

def _dense_article_anchor_doc_ids(
    query: str,
    dense_results: List[Dict[str, object]],
    limit: int = 3,
) -> List[str]:
    """Return dense article matches whose titles strongly anchor a fact query."""
    query_tokens = _search_tokens(query, limit=32)
    if not query_tokens:
        return []
    acronym_tokens = {
        _normalize_search_text(word)
        for word in re.findall(r"[^\W_]+", str(query or ""), flags=re.UNICODE)
        if len(word) >= 3 and word.isupper()
    }
    top_doc_counts: Dict[str, int] = {}
    for result in dense_results[:8]:
        source_type = str(result.get("source_type") or result.get("legacy_source_type") or "").strip().lower()
        doc_id = str(result.get("doc_id") or result.get("docId") or "").strip()
        if source_type in {"journal_article", "article"} and doc_id:
            top_doc_counts[doc_id] = top_doc_counts.get(doc_id, 0) + 1
    dominant_doc_ids = {
        doc_id for doc_id, count in top_doc_counts.items() if count >= 5
    }
    doc_ids: List[str] = []
    for result in dense_results[:24]:
        source_type = str(result.get("source_type") or result.get("legacy_source_type") or "").strip().lower()
        doc_id = str(result.get("doc_id") or result.get("docId") or "").strip()
        title = str(result.get("title") or "").strip()
        if source_type not in {"journal_article", "article"} or not doc_id or not title:
            continue
        title_counts = _lexical_token_counts(_normalize_search_text(title), limit=80)
        matched_tokens = [
            token
            for token in query_tokens
            if _lexical_token_frequency(token, title_counts)
        ]
        acronym_anchor = any(
            token in acronym_tokens and _lexical_token_frequency(token, title_counts)
            for token in query_tokens
        )
        # Üks pikk ühine valdkonnasõna (nt „erihoolekande”) ei kinnita veel
        # konkreetset artiklit. Vastasel korral võib uuem üldartikkel lukustada
        # kogu õdelõikude otsingu vale doc_id külge. Akronüüm on ise piisavalt
        # eristav; tavatekstis nõuame vähemalt kaht pealkirjatunnust.
        strong_anchor = acronym_anchor or len(matched_tokens) >= 2 or doc_id in dominant_doc_ids
        if not strong_anchor:
            continue
        if doc_id not in doc_ids:
            doc_ids.append(doc_id)
        if len(doc_ids) >= max(1, min(5, int(limit or 1))):
            break
    return doc_ids

def _targeted_document_terms(query: str, limit: int = 8) -> List[str]:
    words = re.findall(r"[^\W_]+", str(query or ""), flags=re.UNICODE)
    ranked: List[tuple] = []
    seen = set()
    for index, raw_word in enumerate(words):
        normalized = _normalize_search_text(raw_word)
        is_acronym = len(normalized) >= 3 and raw_word.isupper()
        is_numeric_marker = len(normalized) >= 2 and normalized.isdigit()
        if (
            normalized in LEXICAL_STOPWORDS
            or (len(normalized) < 6 and not is_acronym and not is_numeric_marker)
        ):
            continue
        is_named = index > 0 and raw_word[:1].isupper()
        if len(normalized) < 7 and not is_named and not is_acronym and not is_numeric_marker:
            continue
        term = raw_word[:8] if len(normalized) >= 9 else raw_word
        variants = [term]
        if term[:1].islower() and len(normalized) <= 8:
            variants.append(term[:1].upper() + term[1:])
        for variant in variants:
            key = variant
            if not variant or key in seen:
                continue
            seen.add(key)
            priority = (
                5 if is_acronym or is_numeric_marker
                else 4 if is_named
                else 3 if len(normalized) >= 12
                else 2 if len(normalized) >= 9
                else 1
            )
            ranked.append((priority, len(normalized), -index, variant))
    ranked.sort(key=lambda item: (-item[0], -item[1], -item[2], item[3].casefold()))
    return [item[3] for item in ranked[:max(1, limit)]]


def _needs_specialized_lexical_shortlist(query: str) -> bool:
    source = str(query or "")
    normalized = _normalize_search_text(source)
    if not normalized:
        return False
    proper_words = [
        word
        for word in re.findall(r"[^\W_]+", source, flags=re.UNICODE)
        if len(word) >= 3 and word[:1].isupper()
    ]
    if len(proper_words) >= 2:
        return True
    if re.search(r"[\"“”„«»]|(?:^|\s)§\s*\d", source):
        return True
    return bool(re.search(
        r"\b(?:artikl\w*|aruand\w*|autor\w*|dokumend\w*|juhend\w*|lehek\w*|"
        r"mitu|palju|protsent\w*|osakaal\w*|raport\w*|uuring\w*)\b|%|\d",
        normalized,
    ))


def _targeted_document_shortlist(
    query: str,
    chroma_where: Optional[Dict[str, object]],
    top_k: int,
    allowed_channels: Optional[set] = None,
    metrics: Optional[Dict[str, object]] = None,
) -> Dict[str, object]:
    ids: List[object] = []
    documents: List[object] = []
    metadatas: List[object] = []
    seen = set()
    scanned = 0
    # Candidate collection is not the response size. At top_k=12 the old
    # 72-row term window missed a measured journal title that the same search
    # found quickly at top_k=36 with a 216-row window, forcing either a wrong
    # answer or a 50k-row corpus scan. Keep this shortlist bounded but deep
    # enough independently of how many results the caller wants back.
    per_term_limit = max(216, min(240, max(1, top_k) * 6))
    terms = _targeted_document_terms(query)
    compound_query = len(_split_fact_query_segments(query, anchor_short=False)) >= 2
    scoring_channels = set(allowed_channels or {"author_match", "title_match", "exact_phrase", "bm25"})
    for term in terms:
        kwargs = {
            "include": ["documents", "metadatas"],
            "limit": per_term_limit,
            "where_document": {"$contains": term},
        }
        if chroma_where:
            kwargs["where"] = chroma_where
        fetch_t0 = time.perf_counter()
        got = collection.get(**kwargs)
        _add_lexical_elapsed(metrics, "lexical_chroma_fetch_ms", fetch_t0)
        if metrics is not None:
            metrics["lexical_chroma_page_count"] = int(metrics.get("lexical_chroma_page_count") or 0) + 1
        materialize_t0 = time.perf_counter()
        got_ids = list(got.get("ids") or [])
        got_documents = list(got.get("documents") or [])
        got_metadatas = list(got.get("metadatas") or [])
        _add_lexical_elapsed(metrics, "lexical_chroma_materialize_ms", materialize_t0)
        if metrics is not None:
            metrics["lexical_rows_loaded"] = int(metrics.get("lexical_rows_loaded") or 0) + len(got_ids)
        scanned += len(got_ids)
        for index, item_id in enumerate(got_ids):
            key = str(item_id or "")
            if not key or key in seen:
                continue
            seen.add(key)
            ids.append(item_id)
            documents.append(got_documents[index] if index < len(got_documents) else "")
            metadatas.append(got_metadatas[index] if index < len(got_metadatas) else {})
        # Chroma's where_document call is the expensive part of the shortlist.
        # A rare first term (for example OTT or Hester) can already return a
        # passage that covers the factual question, so do not query every
        # remaining term before making the same bounded sufficiency decision.
        if not compound_query and ids and _lexical_shortlist_is_conclusive(
            _score_lexical_rows(
                query,
                scoring_channels,
                ids,
                documents,
                metadatas,
                body_only=True,
                metrics=metrics,
            )
        ):
            break
    return {
        "ids": ids,
        "documents": documents,
        "metadatas": metadatas,
        "scanned": scanned,
        "terms": terms,
    }

def _lexical_shortlist_is_conclusive(candidates: List[Dict[str, object]]) -> bool:
    """Only let a shortlist replace the corpus scan when it covers the query."""
    if not candidates:
        return False
    for candidate in candidates[:max(1, min(50, RAG_LEXICAL_TOP_K))]:
        try:
            coverage = float(candidate.get("bm25_coverage") or 0)
        except (TypeError, ValueError):
            coverage = 0.0
        matches = _to_int(candidate.get("bm25_matches")) or 0
        query_tokens = _to_int(candidate.get("bm25_query_tokens")) or 0
        body_matches = _to_int(candidate.get("bm25_body_matches")) or 0
        named_entity_matches = _to_int(candidate.get("bm25_named_entity_matches")) or 0
        channels = {str(channel) for channel in candidate.get("channels") or []}
        strong_body_match = (
            "bm25" in channels
            and coverage >= 0.9
            and matches >= max(3, math.ceil(query_tokens * 0.9))
            and body_matches >= max(3, math.ceil(query_tokens * 0.9))
        )
        strong_named_body_match = (
            "bm25" in channels
            and named_entity_matches >= 2
            and coverage >= 0.5
            and matches >= max(4, math.ceil(query_tokens * 0.5))
            and body_matches >= max(4, math.ceil(query_tokens * 0.5))
        )
        anchored_title_or_phrase_match = (
            coverage >= 0.4
            and matches >= min(query_tokens, max(2, math.ceil(query_tokens * 0.4)))
            and bool(channels.intersection({"title_match", "exact_phrase"}))
        )
        if anchored_title_or_phrase_match or strong_body_match or strong_named_body_match:
            return True
    return False

def _fetch_lexical_candidates(
    query: str,
    chroma_where: Optional[Dict[str, object]],
    top_k: int,
    requested_retrievers: Optional[List[str]] = None,
    dense_article_doc_ids: Optional[List[str]] = None,
    version_registry: Optional[Dict[str, Dict]] = None,
) -> Dict[str, object]:
    lexical_started_at = time.perf_counter()
    metrics = _new_lexical_metrics()

    def finish(result: Dict[str, object]) -> Dict[str, object]:
        result["timings"] = _finalize_lexical_metrics(metrics, lexical_started_at)
        return result

    def registry_lookup(callback):
        started_at = time.perf_counter()
        try:
            return callback()
        finally:
            _add_lexical_elapsed(metrics, "lexical_registry_shortlist_ms", started_at)

    def chroma_get(**kwargs):
        started_at = time.perf_counter()
        try:
            return collection.get(**kwargs)
        finally:
            _add_lexical_elapsed(metrics, "lexical_chroma_fetch_ms", started_at)
            metrics["lexical_chroma_page_count"] = int(metrics.get("lexical_chroma_page_count") or 0) + 1

    def materialize(result: Dict[str, object]) -> Tuple[List[object], List[object], List[object]]:
        started_at = time.perf_counter()
        ids = list(result.get("ids") or [])
        documents = list(result.get("documents") or [])
        metadatas = list(result.get("metadatas") or [])
        _add_lexical_elapsed(metrics, "lexical_chroma_materialize_ms", started_at)
        metrics["lexical_rows_loaded"] = int(metrics.get("lexical_rows_loaded") or 0) + len(ids)
        return ids, documents, metadatas

    if not RAG_LEXICAL_SEARCH_ENABLED or not str(query or "").strip():
        return finish({"candidates": [], "scanned": 0, "complete": True, "error": None})
    allowed_channels = set(requested_retrievers or ["author_match", "title_match", "exact_phrase", "bm25"])
    use_specialized_shortlists = _needs_specialized_lexical_shortlist(query)
    author_doc_ids: List[str] = []
    if use_specialized_shortlists:
        try:
            author_doc_ids = registry_lookup(lambda: _registry_author_shortlist_doc_ids(query, chroma_where))
        except Exception:
            logger.exception("registry author shortlist lookup failed")
    if author_doc_ids and "author_match" in allowed_channels:
        author_where: Dict[str, object] = {"doc_id": {"$in": author_doc_ids}}
        if chroma_where:
            author_where = {"$and": [chroma_where, author_where]}
        try:
            authored = chroma_get(
                include=["documents", "metadatas"],
                limit=min(5000, max(200, len(author_doc_ids) * 120)),
                where=author_where,
            )
            authored_ids, authored_docs, authored_metas = materialize(authored)
            authored_scored = _score_lexical_rows(
                query,
                allowed_channels,
                authored_ids,
                authored_docs,
                authored_metas,
                body_only=True,
                metrics=metrics,
            )
            if authored_scored:
                for candidate in authored_scored:
                    channels = [
                        str(channel)
                        for channel in candidate.get("channels") or []
                        if str(channel or "").strip()
                    ]
                    if "author_match" not in channels:
                        channels.append("author_match")
                    candidate["channels"] = channels
                authored_limit = max(0, min(max(1, top_k), RAG_LEXICAL_TOP_K))
                return finish({
                    "candidates": _select_lexical_candidates(
                        authored_scored,
                        authored_limit,
                        per_document=max(1, min(3, int(top_k or 1))),
                    ),
                    "scanned": len(authored_ids),
                    "complete": True,
                    "exhaustive": False,
                    "error": None,
                    "strategy": "registry_author_shortlist",
                })
        except Exception:
            logger.exception("registry author shortlist retrieval failed")
    fact_description_doc_ids: List[str] = []
    if use_specialized_shortlists:
        try:
            fact_description_doc_ids = registry_lookup(
                lambda: _registry_fact_description_shortlist_doc_ids(query, chroma_where)
            )
        except Exception:
            logger.exception("registry fact description shortlist lookup failed")
    if len(fact_description_doc_ids) == 1 and "bm25" in allowed_channels:
        fact_doc_id = fact_description_doc_ids[0]
        fact_where: Dict[str, object] = {"doc_id": fact_doc_id}
        if chroma_where:
            fact_where = {"$and": [chroma_where, fact_where]}
        try:
            fact_rows = chroma_get(
                include=["documents", "metadatas"],
                limit=min(5000, max(100, top_k * 12)),
                where=fact_where,
            )
            fact_ids, fact_documents, fact_metadatas = materialize(fact_rows)
            fact_scoring_query = " ".join(_registry_fact_description_query_tokens(query))
            fact_scored = _score_lexical_rows(
                fact_scoring_query or query,
                allowed_channels,
                fact_ids,
                fact_documents,
                fact_metadatas,
                body_only=True,
                min_score=0.2,
                metrics=metrics,
            )
            if fact_scored:
                for candidate in fact_scored:
                    candidate["score"] = float(candidate.get("score") or 0) + 18.0
                    channels = candidate.get("channels") if isinstance(candidate.get("channels"), list) else []
                    for channel in ["bm25", "registry_fact"]:
                        if channel not in channels:
                            channels.append(channel)
                    candidate["channels"] = channels
                fact_limit = max(0, min(max(1, top_k), RAG_LEXICAL_TOP_K))
                return finish({
                    "candidates": _select_lexical_candidates(
                        fact_scored,
                        fact_limit,
                        per_document=max(4, min(12, int(top_k or 1))),
                    ),
                    "scanned": len(fact_ids),
                    "complete": True,
                    "exhaustive": False,
                    "error": None,
                    "strategy": "registry_fact_description_shortlist",
                })
        except Exception:
            logger.exception("registry fact description shortlist retrieval failed")
    lexical_query = _synthesis_focus_query(query)
    if lexical_query != str(query or "").strip():
        return finish({
            "candidates": [],
            "scanned": 0,
            "complete": True,
            "exhaustive": False,
            "error": None,
            "strategy": "synthesis_dense_only",
        })
    anchored_doc_ids = [str(value).strip() for value in dense_article_doc_ids or [] if str(value).strip()]
    if anchored_doc_ids:
        anchor_where: Dict[str, object] = {"doc_id": {"$in": anchored_doc_ids[:5]}}
        if chroma_where:
            anchor_where = {"$and": [chroma_where, anchor_where]}
        try:
            anchored = chroma_get(
                include=["documents", "metadatas"],
                limit=min(5000, max(100, len(anchored_doc_ids) * 100)),
                where=anchor_where,
            )
            anchored_ids, anchored_docs, anchored_metas = materialize(anchored)
            anchored_scored = _score_lexical_rows(
                lexical_query,
                allowed_channels,
                anchored_ids,
                anchored_docs,
                anchored_metas,
                body_only=True,
                metrics=metrics,
            )
            if anchored_scored:
                anchored_limit = max(0, min(max(1, top_k), RAG_LEXICAL_TOP_K))
                return finish({
                    "candidates": _select_lexical_candidates(
                        anchored_scored,
                        anchored_limit,
                        per_document=max(4, min(12, int(top_k or 1))),
                    ),
                    "scanned": len(anchored_ids),
                    "complete": True,
                    "exhaustive": False,
                    "error": None,
                    "strategy": "dense_article_shortlist",
                })
        except Exception:
            logger.exception("dense article shortlist retrieval failed")
    page_size = max(1, min(5000, RAG_LEXICAL_SCAN_LIMIT))
    max_scan = max(page_size, RAG_LEXICAL_MAX_SCAN)
    shortlist_ids: List[object] = []
    shortlist_docs: List[object] = []
    shortlist_metas: List[object] = []
    shortlist_seen = set()
    shortlist_scanned = 0
    targeted_used = False
    shortlist_scored_candidates: List[Dict[str, object]] = []

    title_doc_ids: List[str] = []
    if use_specialized_shortlists:
        try:
            title_doc_ids = registry_lookup(lambda: _registry_title_shortlist_doc_ids(lexical_query, chroma_where))
        except Exception:
            title_doc_ids = []
        try:
            targeted = _targeted_document_shortlist(
                lexical_query,
                chroma_where,
                top_k,
                allowed_channels,
                metrics=metrics,
            )
            targeted_used = bool(targeted.get("ids"))
            shortlist_scanned += int(targeted.get("scanned") or 0)
            for index, item_id in enumerate(targeted.get("ids") or []):
                key = str(item_id or "")
                if not key or key in shortlist_seen:
                    continue
                shortlist_seen.add(key)
                shortlist_ids.append(item_id)
                shortlist_docs.append((targeted.get("documents") or [])[index])
                shortlist_metas.append((targeted.get("metadatas") or [])[index])
        except Exception:
            logger.exception("targeted document shortlist retrieval failed")
    if title_doc_ids and "title_match" in allowed_channels:
        shortlist_where: Dict[str, object] = {"doc_id": {"$in": title_doc_ids}}
        if chroma_where:
            shortlist_where = {"$and": [chroma_where, shortlist_where]}
        try:
            shortlist = chroma_get(
                include=["documents", "metadatas"],
                limit=min(5000, max(100, top_k * 8)),
                where=shortlist_where,
            )
            title_ids, title_docs, title_metas = materialize(shortlist)
            shortlist_scanned += len(title_ids)
            for index, item_id in enumerate(title_ids):
                key = str(item_id or "")
                if not key or key in shortlist_seen:
                    continue
                shortlist_seen.add(key)
                shortlist_ids.append(item_id)
                shortlist_docs.append(title_docs[index] if index < len(title_docs) else "")
                shortlist_metas.append(title_metas[index] if index < len(title_metas) else {})
            shortlist_scored = _score_lexical_rows(
                lexical_query,
                allowed_channels,
                shortlist_ids,
                shortlist_docs,
                shortlist_metas,
                body_only=True,
                metrics=metrics,
            )
            shortlist_scored_candidates = shortlist_scored
            title_fact_cue = re.search(
                r"\b(?:arv\w*|aast\w*|lehek\w*|mitu|millal|palju|protsent\w*|"
                r"osakaal\w*|naitaj\w*|näitaj\w*|sagedus\w*|stsenaarium\w*)\b",
                str(query or ""),
                flags=re.I,
            )
            if len(title_doc_ids) == 1 and title_fact_cue:
                anchored_doc_id = str(title_doc_ids[0])
                title_version_registry = _load_registry()
                title_anchored = [
                    candidate
                    for candidate in shortlist_scored
                    if str(
                        (candidate.get("metadata") or {}).get("doc_id")
                        or (candidate.get("metadata") or {}).get("docId")
                        or ""
                    ).strip() == anchored_doc_id
                    and is_active_document_version(
                        candidate.get("metadata") if isinstance(candidate.get("metadata"), dict) else {},
                        title_version_registry,
                    )
                ]
                title_anchored_ids = {str(candidate.get("id") or "") for candidate in title_anchored}
                for item_id, document, metadata in zip(
                    shortlist_ids,
                    shortlist_docs,
                    shortlist_metas,
                ):
                    candidate_id = str(item_id or "")
                    candidate_doc_id = str(
                        (metadata or {}).get("doc_id")
                        or (metadata or {}).get("docId")
                        or ""
                    ).strip()
                    if (
                        not candidate_id
                        or candidate_id in title_anchored_ids
                        or candidate_doc_id != anchored_doc_id
                        or not is_active_document_version(metadata or {}, title_version_registry)
                    ):
                        continue
                    title_anchored.append({
                        "id": item_id,
                        "document": document,
                        "metadata": metadata,
                        "score": 8.0,
                        "channels": ["title_match", "exact_phrase"],
                    })
                    title_anchored_ids.add(candidate_id)
                for candidate in title_anchored:
                    candidate["score"] = max(16.0, float(candidate.get("score") or 0) + 12.0)
                    channels = candidate.get("channels") if isinstance(candidate.get("channels"), list) else []
                    for channel in ["title_match", "exact_phrase"]:
                        if channel not in channels:
                            channels.append(channel)
                    candidate["channels"] = channels
                expected_percentage_count = _expected_percentage_fact_count(query)
                if expected_percentage_count:
                    existing_ids = {str(candidate.get("id") or "") for candidate in title_anchored}
                    for item_id, document, metadata in zip(
                        shortlist_ids,
                        shortlist_docs,
                        shortlist_metas,
                    ):
                        candidate_doc_id = str(
                            (metadata or {}).get("doc_id")
                            or (metadata or {}).get("docId")
                            or ""
                        ).strip()
                        evidence_count = _percentage_evidence_count(document)
                        if (
                            candidate_doc_id != anchored_doc_id
                            or not is_active_document_version(metadata or {}, title_version_registry)
                            or evidence_count < expected_percentage_count
                        ):
                            continue
                        if str(item_id or "") in existing_ids:
                            for candidate in title_anchored:
                                if str(candidate.get("id") or "") != str(item_id or ""):
                                    continue
                                channels = candidate.get("channels") if isinstance(candidate.get("channels"), list) else []
                                if "numeric_fact_shape" not in channels:
                                    channels.append("numeric_fact_shape")
                                candidate["channels"] = channels
                                candidate["score"] = max(float(candidate.get("score") or 0), 40.0 + min(3, evidence_count))
                                candidate["fact_numeric_evidence_count"] = evidence_count
                                break
                            continue
                        title_anchored.append({
                            "id": item_id,
                            "document": document,
                            "metadata": metadata,
                            "score": 40.0 + min(3, evidence_count),
                            "channels": ["title_match", "numeric_fact_shape"],
                            "fact_numeric_evidence_count": evidence_count,
                        })
                    numeric_anchor_score = max(
                        (float(candidate.get("score") or 0) for candidate in title_anchored),
                        default=0.0,
                    ) + 10.0
                    for candidate in title_anchored:
                        evidence_count = int(candidate.get("fact_numeric_evidence_count") or 0)
                        if evidence_count >= expected_percentage_count:
                            candidate["score"] = numeric_anchor_score + min(3, evidence_count)
                if title_anchored:
                    title_anchored.sort(
                        key=lambda item: float(item.get("score") or 0),
                        reverse=True,
                    )
                    shortlist_limit = max(0, min(max(1, top_k), RAG_LEXICAL_TOP_K))
                    return finish({
                        "candidates": _select_lexical_candidates(
                            title_anchored,
                            shortlist_limit,
                            per_document=max(4, min(12, int(top_k or 1))),
                        ),
                        "scanned": shortlist_scanned,
                        "complete": True,
                        "exhaustive": False,
                        "error": None,
                        "strategy": "registry_title_fact_anchor",
                    })
            if _lexical_shortlist_is_conclusive(shortlist_scored):
                shortlist_limit = max(0, min(max(1, top_k), RAG_LEXICAL_TOP_K))
                return finish({
                    "candidates": _select_lexical_candidates(shortlist_scored, shortlist_limit),
                    "scanned": shortlist_scanned,
                    "complete": True,
                    "exhaustive": False,
                    "error": None,
                    "strategy": "targeted_document_shortlist" if targeted_used else "registry_title_shortlist",
                })
        except Exception:
            logger.exception("registry title shortlist retrieval failed")
    elif shortlist_ids:
        shortlist_scored = _score_lexical_rows(
            lexical_query,
            allowed_channels,
            shortlist_ids,
            shortlist_docs,
            shortlist_metas,
            body_only=True,
            metrics=metrics,
        )
        shortlist_scored_candidates = shortlist_scored
        if _lexical_shortlist_is_conclusive(shortlist_scored):
            shortlist_limit = max(0, min(max(1, top_k), RAG_LEXICAL_TOP_K))
            return finish({
                "candidates": _select_lexical_candidates(shortlist_scored, shortlist_limit),
                "scanned": shortlist_scanned,
                "complete": True,
                "exhaustive": False,
                "error": None,
                "strategy": "targeted_document_shortlist",
            })
    compound_candidates = _compound_document_shortlist_candidates(
        lexical_query,
        allowed_channels,
        shortlist_ids,
        shortlist_docs,
        shortlist_metas,
        max(1, min(50, top_k)),
        metrics=metrics,
    )
    if compound_candidates:
        return finish({
            "candidates": compound_candidates,
            "scanned": shortlist_scanned,
            "complete": True,
            "exhaustive": False,
            "error": None,
            "strategy": "targeted_compound_document_shortlist",
        })
    if RAG_PERSISTENT_LEXICAL_INDEX_ENABLED:
        try:
            registry_t0 = time.perf_counter()
            index_registry = version_registry if version_registry is not None else _load_registry()
            _add_lexical_elapsed(metrics, "lexical_registry_shortlist_ms", registry_t0)
            index_t0 = time.perf_counter()
            indexed = LEXICAL_INDEX.search(
                query_tokens=_search_tokens(lexical_query),
                where=chroma_where,
                registry=index_registry,
                limit=RAG_PERSISTENT_LEXICAL_INDEX_CANDIDATES,
            )
            index_total_ms = (time.perf_counter() - index_t0) * 1000.0
            index_sql_ms = float(indexed.get("sql_ms") or 0.0)
            index_materialize_ms = float(indexed.get("materialize_ms") or 0.0)
            metrics["lexical_index_query_ms"] = float(metrics.get("lexical_index_query_ms") or 0.0) + index_sql_ms
            metrics["lexical_index_materialize_ms"] = (
                float(metrics.get("lexical_index_materialize_ms") or 0.0) + index_materialize_ms
            )
            metrics["lexical_index_validation_ms"] = (
                float(metrics.get("lexical_index_validation_ms") or 0.0)
                + max(0.0, index_total_ms - index_sql_ms - index_materialize_ms)
            )
            indexed_ids = list(indexed.get("ids") or [])
            indexed_documents = list(indexed.get("documents") or [])
            indexed_metadatas = list(indexed.get("metadatas") or [])
            filtered_ids: List[object] = []
            filtered_documents: List[object] = []
            filtered_metadatas: List[object] = []
            for item_id, document, metadata in zip(indexed_ids, indexed_documents, indexed_metadatas):
                if not isinstance(metadata, dict):
                    continue
                if not is_active_document_version(metadata, index_registry):
                    continue
                if not _metadata_matches_filter(metadata, chroma_where):
                    continue
                filtered_ids.append(item_id)
                filtered_documents.append(document)
                filtered_metadatas.append(metadata)
            metrics["lexical_rows_loaded"] = int(metrics.get("lexical_rows_loaded") or 0) + len(filtered_ids)
            indexed_scored = _score_lexical_rows(
                lexical_query,
                allowed_channels,
                filtered_ids,
                filtered_documents,
                filtered_metadatas,
                body_only=True,
                metrics=metrics,
            )
            scored_by_id: Dict[str, Dict[str, object]] = {}
            for candidate in [*shortlist_scored_candidates, *indexed_scored]:
                candidate_id = str(candidate.get("id") or "").strip()
                if not candidate_id:
                    continue
                existing = scored_by_id.get(candidate_id)
                if existing is None or float(candidate.get("score") or 0) > float(existing.get("score") or 0):
                    scored_by_id[candidate_id] = candidate
            ranking_t0 = time.perf_counter()
            scored = sorted(
                scored_by_id.values(),
                key=lambda item: float(item.get("score") or 0),
                reverse=True,
            )
            _add_lexical_elapsed(metrics, "lexical_ranking_ms", ranking_t0)
            limit = max(0, min(max(1, top_k), RAG_LEXICAL_TOP_K))
            index_status = indexed.get("status") if isinstance(indexed.get("status"), dict) else {}
            return finish({
                "candidates": _select_lexical_candidates(scored, limit),
                "scanned": int(index_status.get("chunk_count") or 0),
                "complete": True,
                "exhaustive": True,
                "error": None,
                "strategy": "persistent_fts5",
                "index": {
                    "ready": True,
                    "generation": index_status.get("generation"),
                    "chunk_count": int(index_status.get("chunk_count") or 0),
                    "document_count": int(index_status.get("document_count") or 0),
                    "size_bytes": int(index_status.get("size_bytes") or 0),
                },
            })
        except LexicalIndexError as exc:
            return finish({
                "candidates": [],
                "scanned": 0,
                "complete": False,
                "exhaustive": False,
                "error": exc.code,
                "strategy": "persistent_fts5_unavailable",
                "index": {"ready": False, "reason": exc.code},
            })
    all_ids: List[object] = []
    all_docs: List[object] = []
    all_metas: List[object] = []
    try:
        offset = 0
        complete = False
        while offset < max_scan:
            limit = min(page_size, max_scan - offset)
            kwargs = {"include": ["documents", "metadatas"], "limit": limit, "offset": offset}
            if chroma_where:
                kwargs["where"] = chroma_where
            got = chroma_get(**kwargs)
            page_ids, page_docs, page_metas = materialize(got)
            all_ids.extend(page_ids)
            all_docs.extend(page_docs)
            all_metas.extend(page_metas)
            offset += len(page_ids)
            if len(page_ids) < limit:
                complete = True
                break
            if not page_ids:
                complete = True
                break
    except Exception as exc:
        logger.exception("lexical retrieval failed")
        return finish({
            "candidates": [],
            "scanned": len(all_ids),
            "complete": False,
            "error": f"{type(exc).__name__}",
        })

    scanned_scored = _score_lexical_rows(
        lexical_query,
        allowed_channels,
        all_ids,
        all_docs,
        all_metas,
        body_only=True,
        metrics=metrics,
    )
    scored_by_id: Dict[str, Dict[str, object]] = {}
    for candidate in [*shortlist_scored_candidates, *scanned_scored]:
        candidate_id = str(candidate.get("id") or "").strip()
        if not candidate_id:
            continue
        existing = scored_by_id.get(candidate_id)
        if existing is None or float(candidate.get("score") or 0) > float(existing.get("score") or 0):
            scored_by_id[candidate_id] = candidate
    ranking_t0 = time.perf_counter()
    scored = sorted(
        scored_by_id.values(),
        key=lambda item: float(item.get("score") or 0),
        reverse=True,
    )
    _add_lexical_elapsed(metrics, "lexical_ranking_ms", ranking_t0)
    limit = max(0, min(max(1, top_k), RAG_LEXICAL_TOP_K))
    return finish({
        "candidates": _select_lexical_candidates(scored, limit),
        "scanned": len(all_ids),
        "complete": complete,
        "exhaustive": complete,
        "error": None,
        "strategy": "corpus_scan",
    })

def _fetch_document_sibling_candidates(
    query: str,
    chroma_where: Optional[Dict[str, object]],
    dense_results: List[Dict[str, object]],
    top_k: int,
    requested_retrievers: Optional[List[str]] = None,
    max_documents: int = 1,
    per_document: int = 4,
) -> List[Dict[str, object]]:
    if not RAG_LEXICAL_SEARCH_ENABLED:
        return []
    allowed_channels = set(requested_retrievers or ["author_match", "title_match", "exact_phrase", "bm25"])
    if not allowed_channels.intersection({"author_match", "title_match", "exact_phrase", "bm25"}):
        return []
    doc_ids: List[str] = []
    for result in dense_results:
        doc_id = str(result.get("doc_id") or result.get("docId") or "").strip()
        if not doc_id:
            continue
        if doc_id not in doc_ids:
            doc_ids.append(doc_id)
        if len(doc_ids) >= max(1, min(8, int(max_documents or 1))):
            break
    if not doc_ids:
        return []

    sibling_where: Dict[str, object] = {"doc_id": {"$in": doc_ids}}
    if chroma_where:
        sibling_where = {"$and": [chroma_where, sibling_where]}
    got = collection.get(
        include=["documents", "metadatas"],
        limit=min(240, max(80, len(doc_ids) * 80)),
        where=sibling_where,
    )
    scored = _score_lexical_rows(
        query,
        allowed_channels,
        list(got.get("ids") or []),
        list(got.get("documents") or []),
        list(got.get("metadatas") or []),
        body_only=True,
        include_title=False,
    )
    limit = max(0, min(max(1, top_k), RAG_LEXICAL_TOP_K))
    return _select_lexical_candidates(
        scored,
        limit,
        per_document=max(1, min(12, int(per_document or 1))),
    )

def _select_fact_document_shortlist(
    query: str,
    chroma_where: Optional[Dict[str, object]],
    initial_results: List[Dict[str, object]],
    max_documents: int = 12,
) -> Dict[str, object]:
    """Select document identities before searching for evidence inside them.

    A document may enter the expanded shortlist only through a checkable
    identity anchor. Dense rank alone is deliberately not such an anchor: if
    no document reaches the threshold, the old bounded five-document fallback
    remains in use instead of widening a weak semantic guess.
    """
    limit = max(1, min(20, int(max_documents or 1)))
    query_tokens = _search_tokens(query, limit=32)
    acronym_tokens = {
        _normalize_search_text(word)
        for word in re.findall(r"[^\W_]+", str(query or ""), flags=re.UNICODE)
        if len(word) >= 3 and word.isupper()
    }
    candidates: Dict[str, Dict[str, object]] = {}

    def ensure_candidate(doc_id: object) -> Optional[Dict[str, object]]:
        key = str(doc_id or "").strip()
        if not key:
            return None
        existing = candidates.get(key)
        if existing is None:
            existing = {
                "doc_id": key,
                "best_rank": None,
                "result_hits": 0,
                "channels": set(),
                "reasons": set(),
                "identity_score": 0.0,
            }
            candidates[key] = existing
        return existing

    for rank, result in enumerate(initial_results, start=1):
        doc_id = str(result.get("doc_id") or result.get("docId") or "").strip()
        candidate = ensure_candidate(doc_id)
        if candidate is None:
            continue
        candidate["result_hits"] = int(candidate.get("result_hits") or 0) + 1
        previous_rank = _to_int(candidate.get("best_rank"))
        candidate["best_rank"] = min(previous_rank or rank, rank)
        channels = {
            str(value).strip()
            for value in result.get("retrieval_channels") or []
            if str(value or "").strip()
        }
        candidate["channels"].update(channels)
        title = str(result.get("title") or "").strip()
        if title:
            title_counts = _lexical_token_counts(_normalize_search_text(title), limit=100)
            matched_title_tokens = [
                token for token in query_tokens
                if _lexical_token_frequency(token, title_counts)
            ]
            acronym_match = any(
                token in acronym_tokens and _lexical_token_frequency(token, title_counts)
                for token in query_tokens
            )
            if acronym_match:
                candidate["reasons"].add("title_acronym")
            if len(matched_title_tokens) >= 2:
                candidate["reasons"].add("title_terms")
            elif any(len(token) >= 9 for token in matched_title_tokens):
                candidate["reasons"].add("title_distinctive_term")

    try:
        registry_fact_ids = set(_registry_fact_description_shortlist_doc_ids(query, chroma_where, limit=limit))
    except Exception:
        logger.exception("fact document registry shortlist lookup failed")
        registry_fact_ids = set()
    try:
        registry_author_ids = set(_registry_author_shortlist_doc_ids(query, chroma_where, limit=limit))
    except Exception:
        logger.exception("fact document author shortlist lookup failed")
        registry_author_ids = set()
    dense_title_ids = set(_dense_article_anchor_doc_ids(query, initial_results, limit=5))

    for doc_id in registry_fact_ids:
        candidate = ensure_candidate(doc_id)
        if candidate is not None:
            candidate["reasons"].add("registry_fact")
    for doc_id in registry_author_ids:
        candidate = ensure_candidate(doc_id)
        if candidate is not None:
            candidate["reasons"].add("author_exact")
    for doc_id in dense_title_ids:
        candidate = ensure_candidate(doc_id)
        if candidate is not None:
            candidate["reasons"].add("dense_title_anchor")

    channel_weights = {
        "registry_fact": 4.5,
        "exact_phrase": 4.0,
        "author_match": 3.5,
        "title_match": 3.0,
    }
    reason_weights = {
        "registry_fact": 4.5,
        "author_exact": 3.5,
        "dense_title_anchor": 3.0,
        "title_acronym": 3.0,
        "title_terms": 3.0,
        "title_distinctive_term": 1.5,
    }
    for candidate in candidates.values():
        score = sum(channel_weights.get(channel, 0.0) for channel in candidate["channels"])
        score += sum(reason_weights.get(reason, 0.0) for reason in candidate["reasons"])
        hit_count = int(candidate.get("result_hits") or 0)
        if hit_count >= 2:
            score += min(1.5, 0.5 + ((hit_count - 2) * 0.25))
            candidate["reasons"].add("repeated_result_hits")
        candidate["identity_score"] = round(score, 4)

    anchored = [
        candidate for candidate in candidates.values()
        if float(candidate.get("identity_score") or 0) >= 3.0
    ]
    anchored.sort(key=lambda item: (
        -float(item.get("identity_score") or 0),
        _to_int(item.get("best_rank")) or 10**9,
        str(item.get("doc_id") or ""),
    ))
    if anchored:
        selected = anchored[:limit]
        strategy = "anchored_document_identity_v1"
    else:
        fallback: List[Dict[str, object]] = []
        seen = set()
        for result in initial_results:
            doc_id = str(result.get("doc_id") or result.get("docId") or "").strip()
            if not doc_id or doc_id in seen:
                continue
            seen.add(doc_id)
            candidate = candidates.get(doc_id) or {
                "doc_id": doc_id,
                "best_rank": len(fallback) + 1,
                "result_hits": 1,
                "channels": set(),
                "reasons": set(),
                "identity_score": 0.0,
            }
            fallback.append(candidate)
            if len(fallback) >= 5:
                break
        selected = fallback
        strategy = "ranked_fallback_v1"

    return {
        "strategy": strategy,
        "threshold": 3.0,
        "doc_ids": [str(item.get("doc_id") or "") for item in selected],
        "candidates": [
            {
                "doc_id": str(item.get("doc_id") or ""),
                "identity_score": float(item.get("identity_score") or 0),
                "best_rank": _to_int(item.get("best_rank")),
                "result_hits": int(item.get("result_hits") or 0),
                "channels": sorted(str(value) for value in item.get("channels") or []),
                "reasons": sorted(str(value) for value in item.get("reasons") or []),
            }
            for item in selected
        ],
    }

def _fetch_fact_segment_candidates(
    segment_embeddings: List[List[float]],
    segment_queries: List[str],
    chroma_where: Optional[Dict[str, object]],
    initial_results: List[Dict[str, object]],
    version_registry: Dict[str, object],
    *,
    is_general_search: bool,
    per_document: int,
    document_ids: Optional[List[str]] = None,
    max_documents: int = 3,
) -> List[Dict[str, object]]:
    """Search each question segment inside already identified documents."""
    if not segment_embeddings and not segment_queries:
        return []

    document_limit = max(1, min(20, int(max_documents or 1)))
    doc_ids: List[str] = []
    for value in document_ids or []:
        doc_id = str(value or "").strip()
        if doc_id and doc_id not in doc_ids:
            doc_ids.append(doc_id)
        if len(doc_ids) >= document_limit:
            break
    if not doc_ids:
        for result in initial_results:
            doc_id = str(result.get("doc_id") or result.get("docId") or "").strip()
            if not doc_id:
                continue
            if doc_id not in doc_ids:
                doc_ids.append(doc_id)
            if len(doc_ids) >= min(5, document_limit):
                break
    if not doc_ids:
        return []

    segment_where: Dict[str, object] = {"doc_id": {"$in": doc_ids}}
    if chroma_where:
        segment_where = {"$and": [chroma_where, segment_where]}
    n_results = min(40, max(8, len(doc_ids) * max(1, min(12, int(per_document or 1)))))
    res = (
        collection.query(
            query_embeddings=segment_embeddings,
            n_results=n_results,
            where=segment_where,
            include=["documents", "metadatas", "distances"],
        )
        if segment_embeddings
        else {"ids": [], "documents": [], "metadatas": [], "distances": []}
    )

    id_rows = list(res.get("ids") or [])
    doc_rows = list(res.get("documents") or [])
    metadata_rows = list(res.get("metadatas") or [])
    distance_rows = list(res.get("distances") or [])
    by_id: Dict[str, Dict[str, object]] = {}
    per_segment_document_limit = max(2, min(4, math.ceil(max(1, int(per_document or 1)) / 3)))
    for segment_index, row_ids in enumerate(id_rows):
        row_docs = doc_rows[segment_index] if segment_index < len(doc_rows) else []
        row_metadatas = metadata_rows[segment_index] if segment_index < len(metadata_rows) else []
        row_distances = distance_rows[segment_index] if segment_index < len(distance_rows) else []
        segment_doc_counts: Dict[str, int] = {}
        for rank, item_id_value in enumerate(list(row_ids or []), start=1):
            item_id = str(item_id_value or "").strip()
            if not item_id:
                continue
            document = row_docs[rank - 1] if rank - 1 < len(row_docs) and isinstance(row_docs[rank - 1], str) else ""
            md = row_metadatas[rank - 1] if rank - 1 < len(row_metadatas) and isinstance(row_metadatas[rank - 1], dict) else {}
            distance = row_distances[rank - 1] if rank - 1 < len(row_distances) else None
            if not is_active_document_version(md, version_registry):
                continue
            if is_general_search and not is_general_search_metadata_allowed(md):
                continue
            if not _metadata_matches_filter(md, segment_where):
                continue
            candidate_doc_id = str(md.get("doc_id") or md.get("docId") or "").strip()
            current_doc_count = segment_doc_counts.get(candidate_doc_id, 0)
            if current_doc_count >= per_segment_document_limit:
                continue
            segment_doc_counts[candidate_doc_id] = current_doc_count + 1

            existing = by_id.get(item_id)
            if existing is None:
                existing = _search_result_from_metadata(
                    item_id=item_id,
                    document=document,
                    md=md,
                    distance=distance,
                    channels=["dense"],
                    rank=rank,
                )
                existing["dense_rank"] = rank
                existing["fact_segment_dense_rank"] = rank
                existing["fact_segment_indexes"] = []
                existing["fact_segment_ranks"] = {}
                by_id[item_id] = existing
            indexes = existing.get("fact_segment_indexes")
            if not isinstance(indexes, list):
                indexes = []
                existing["fact_segment_indexes"] = indexes
            if segment_index not in indexes:
                indexes.append(segment_index)
            segment_ranks = existing.get("fact_segment_ranks")
            if not isinstance(segment_ranks, dict):
                segment_ranks = {}
                existing["fact_segment_ranks"] = segment_ranks
            segment_key = str(segment_index)
            previous_segment_rank = _to_int(segment_ranks.get(segment_key))
            segment_ranks[segment_key] = min(previous_segment_rank or rank, rank)
            existing["fact_segment_hits"] = len(indexes)
            previous_rank = _to_int(existing.get("fact_segment_best_rank"))
            existing["fact_segment_best_rank"] = min(previous_rank or rank, rank)
            previous_distance = existing.get("distance")
            try:
                if previous_distance is None or (distance is not None and float(distance) < float(previous_distance)):
                    existing["distance"] = distance
            except Exception:
                pass
            existing["dense_rank"] = min(_to_int(existing.get("dense_rank")) or rank, rank)
            existing["fact_segment_dense_rank"] = min(
                _to_int(existing.get("fact_segment_dense_rank")) or rank,
                rank,
            )

    # Semantiline alamotsing võib eesti käändelise või väga lühikese küsimuse
    # puhul valida küll õige dokumendi, kuid vale lõigu. Hinda samade, juba
    # tuvastatud dokumentide lõike ka iga küsimuse osa sõnade järgi. See on
    # piiratud dokumendisisene läbivaatus, mitte uus kogu korpuse täisskann.
    if segment_queries:
        got = collection.get(
            include=["documents", "metadatas"],
            limit=min(5000, max(200, len(doc_ids) * 600)),
            where=segment_where,
        )
        lexical_ids = list(got.get("ids") or [])
        lexical_documents = list(got.get("documents") or [])
        lexical_metadatas = list(got.get("metadatas") or [])
        for segment_index, segment_query in enumerate(segment_queries):
            scored = _score_lexical_rows(
                segment_query,
                {"title_match", "exact_phrase", "bm25"},
                lexical_ids,
                lexical_documents,
                lexical_metadatas,
                body_only=True,
                include_title=False,
                min_score=0.2,
            )
            candidates = _select_lexical_candidates(
                scored,
                max(2, min(12, int(per_document or 1))),
                per_document=max(2, min(4, math.ceil(max(1, int(per_document or 1)) / 3))),
            )
            expected_percentage_count = _expected_percentage_fact_count(segment_query)
            if expected_percentage_count:
                numeric_by_doc: Dict[str, tuple] = {}
                for row_index, item_id_value in enumerate(lexical_ids):
                    item_id = str(item_id_value or "").strip()
                    md = (
                        lexical_metadatas[row_index]
                        if row_index < len(lexical_metadatas) and isinstance(lexical_metadatas[row_index], dict)
                        else {}
                    )
                    document = (
                        lexical_documents[row_index]
                        if row_index < len(lexical_documents) and isinstance(lexical_documents[row_index], str)
                        else ""
                    )
                    candidate_doc_id = str(md.get("doc_id") or md.get("docId") or "").strip()
                    evidence_count = _percentage_evidence_count(document)
                    if not item_id or not candidate_doc_id or evidence_count < expected_percentage_count:
                        continue
                    chunk_index = _to_int(md.get("chunk_index") or md.get("chunkIndex"))
                    sort_key = (
                        abs(evidence_count - expected_percentage_count),
                        -evidence_count,
                        chunk_index if chunk_index is not None else 10**9,
                    )
                    previous = numeric_by_doc.get(candidate_doc_id)
                    if previous is None or sort_key < previous[0]:
                        numeric_by_doc[candidate_doc_id] = (sort_key, {
                            "id": item_id,
                            "document": document,
                            "metadata": md,
                            "score": 0.0,
                            "channels": ["numeric_fact_shape"],
                            "fact_numeric_evidence_count": evidence_count,
                        })
                candidate_ids = {str(candidate.get("id") or "") for candidate in candidates}
                for _sort_key, numeric_candidate in sorted(numeric_by_doc.values(), key=lambda item: item[0]):
                    if str(numeric_candidate.get("id") or "") not in candidate_ids:
                        candidates.append(numeric_candidate)
                    else:
                        for candidate in candidates:
                            if str(candidate.get("id") or "") == str(numeric_candidate.get("id") or ""):
                                channels = candidate.get("channels") if isinstance(candidate.get("channels"), list) else []
                                if "numeric_fact_shape" not in channels:
                                    channels.append("numeric_fact_shape")
                                candidate["channels"] = channels
                                candidate["fact_numeric_evidence_count"] = numeric_candidate["fact_numeric_evidence_count"]
                                break
            for rank, candidate in enumerate(candidates, start=1):
                item_id = str(candidate.get("id") or "").strip()
                md = candidate.get("metadata") if isinstance(candidate.get("metadata"), dict) else {}
                if not item_id or not is_active_document_version(md, version_registry):
                    continue
                if is_general_search and not is_general_search_metadata_allowed(md):
                    continue
                if not _metadata_matches_filter(md, segment_where):
                    continue
                existing = by_id.get(item_id)
                if existing is None:
                    channels = [str(value) for value in candidate.get("channels") or [] if str(value or "").strip()]
                    lexical_channels = set(channels).intersection({"title_match", "exact_phrase", "bm25"})
                    existing = _search_result_from_metadata(
                        item_id=item_id,
                        document=str(candidate.get("document") or ""),
                        md=md,
                        distance=None,
                        channels=channels or ["bm25"],
                        rank=rank,
                        lexical_score=float(candidate.get("score") or 0) if lexical_channels else None,
                        lexical_details=candidate if lexical_channels else None,
                    )
                    if lexical_channels:
                        existing["lexical_rank"] = rank
                    existing["fact_segment_indexes"] = []
                    existing["fact_segment_ranks"] = {}
                    by_id[item_id] = existing
                else:
                    _append_channels(existing, candidate.get("channels") or ["bm25"])
                    candidate_channels = set(candidate.get("channels") or [])
                    if candidate_channels.intersection({"title_match", "exact_phrase", "bm25"}):
                        existing["lexical_score"] = max(
                            float(existing.get("lexical_score") or 0),
                            float(candidate.get("score") or 0),
                        )
                        existing["lexical_rank"] = min(_to_int(existing.get("lexical_rank")) or rank, rank)
                numeric_evidence_count = _to_int(candidate.get("fact_numeric_evidence_count"))
                if numeric_evidence_count:
                    existing["fact_numeric_evidence_count"] = max(
                        _to_int(existing.get("fact_numeric_evidence_count")) or 0,
                        numeric_evidence_count,
                    )
                indexes = existing.get("fact_segment_indexes")
                if not isinstance(indexes, list):
                    indexes = []
                    existing["fact_segment_indexes"] = indexes
                if segment_index not in indexes:
                    indexes.append(segment_index)
                ranks = existing.get("fact_segment_ranks")
                if not isinstance(ranks, dict):
                    ranks = {}
                    existing["fact_segment_ranks"] = ranks
                key = str(segment_index)
                previous_rank = _to_int(ranks.get(key))
                ranks[key] = min(previous_rank or rank, rank)
                lexical_ranks = existing.get("fact_segment_lexical_ranks")
                if not isinstance(lexical_ranks, dict):
                    lexical_ranks = {}
                    existing["fact_segment_lexical_ranks"] = lexical_ranks
                previous_lexical_rank = _to_int(lexical_ranks.get(key))
                lexical_ranks[key] = min(previous_lexical_rank or rank, rank)
                existing["fact_segment_hits"] = len(indexes)
                best_rank = _to_int(existing.get("fact_segment_best_rank"))
                existing["fact_segment_best_rank"] = min(best_rank or rank, rank)

        # PDF-i lehekülje- või lõigupiir võib jätta vastuse järgmise lõigu
        # algusse. Lisa iga faktitabamuse vahetud naabrid kandidaatidena; lõplik
        # top-k ja dokumendisügavuse piir otsustavad endiselt, kas need jõuavad
        # vastusesse. Nii ei kao näiteks lause teine pool tükelduspiiri taha.
        rows_by_position: Dict[Tuple[str, int], Tuple[str, str, Dict[str, object]]] = {}
        for index, item_id_value in enumerate(lexical_ids):
            md = lexical_metadatas[index] if index < len(lexical_metadatas) and isinstance(lexical_metadatas[index], dict) else {}
            doc_id = str(md.get("doc_id") or md.get("docId") or "").strip()
            chunk_index = _to_int(md.get("chunk_index") or md.get("chunkIndex"))
            if not doc_id or chunk_index is None:
                continue
            document = lexical_documents[index] if index < len(lexical_documents) and isinstance(lexical_documents[index], str) else ""
            rows_by_position[(doc_id, chunk_index)] = (str(item_id_value or ""), document, md)
        for seed in list(by_id.values()):
            doc_id = str(seed.get("doc_id") or seed.get("docId") or "").strip()
            chunk_index = _to_int(seed.get("chunk_index") or seed.get("chunkIndex"))
            segment_indexes = list(seed.get("fact_segment_indexes") or [])
            segment_ranks = seed.get("fact_segment_ranks") if isinstance(seed.get("fact_segment_ranks"), dict) else {}
            if not doc_id or chunk_index is None or not segment_indexes:
                continue
            for neighbor_index in [chunk_index - 1, chunk_index + 1]:
                row = rows_by_position.get((doc_id, neighbor_index))
                if row is None:
                    continue
                item_id, document, md = row
                if not item_id:
                    continue
                neighbor = by_id.get(item_id)
                created_as_neighbor = neighbor is None
                if neighbor is None:
                    neighbor = _search_result_from_metadata(
                        item_id=item_id,
                        document=document,
                        md=md,
                        distance=seed.get("distance"),
                        channels=list(seed.get("retrieval_channels") or ["bm25"]),
                        rank=_to_int(seed.get("retrieval_rank")),
                        lexical_score=max(0.0, float(seed.get("lexical_score") or 0) * 0.8),
                    )
                    neighbor["dense_rank"] = _to_int(seed.get("dense_rank"))
                    neighbor["lexical_rank"] = _to_int(seed.get("lexical_rank"))
                    neighbor["fact_segment_indexes"] = []
                    neighbor["fact_segment_ranks"] = {}
                    by_id[item_id] = neighbor
                neighbor_indexes = neighbor.get("fact_segment_indexes")
                if not isinstance(neighbor_indexes, list):
                    neighbor_indexes = []
                    neighbor["fact_segment_indexes"] = neighbor_indexes
                neighbor_ranks = neighbor.get("fact_segment_ranks")
                if not isinstance(neighbor_ranks, dict):
                    neighbor_ranks = {}
                    neighbor["fact_segment_ranks"] = neighbor_ranks
                neighbor_lexical_ranks = neighbor.get("fact_segment_lexical_ranks")
                if not isinstance(neighbor_lexical_ranks, dict):
                    neighbor_lexical_ranks = {}
                    neighbor["fact_segment_lexical_ranks"] = neighbor_lexical_ranks
                seed_lexical_ranks = seed.get("fact_segment_lexical_ranks") if isinstance(seed.get("fact_segment_lexical_ranks"), dict) else {}
                adjacent_best_segments = neighbor.get("fact_adjacent_to_best_segments")
                if not isinstance(adjacent_best_segments, list):
                    adjacent_best_segments = []
                    neighbor["fact_adjacent_to_best_segments"] = adjacent_best_segments
                for segment_index in segment_indexes:
                    if segment_index not in neighbor_indexes:
                        neighbor_indexes.append(segment_index)
                    key = str(segment_index)
                    rank = (_to_int(segment_ranks.get(key)) or 1) + 1
                    previous_rank = _to_int(neighbor_ranks.get(key))
                    neighbor_ranks[key] = min(previous_rank or rank, rank)
                    if (_to_int(segment_ranks.get(key)) or 0) == 1 and key not in adjacent_best_segments:
                        adjacent_best_segments.append(key)
                    seed_lexical_rank = _to_int(seed_lexical_ranks.get(key))
                    if seed_lexical_rank:
                        lexical_rank = seed_lexical_rank + 1
                        previous_lexical_rank = _to_int(neighbor_lexical_ranks.get(key))
                        neighbor_lexical_ranks[key] = min(previous_lexical_rank or lexical_rank, lexical_rank)
                neighbor["fact_segment_hits"] = len(neighbor_indexes)
                neighbor["fact_segment_best_rank"] = min(neighbor_ranks.values())
                if created_as_neighbor:
                    neighbor["fact_neighbor"] = True
                    neighbor.setdefault("fact_neighbor_of", str(seed.get("id") or "").strip())

    return list(by_id.values())

def _merge_fact_segment_candidates(
    results: List[Dict[str, object]],
    candidates: List[Dict[str, object]],
) -> None:
    by_id = {str(item.get("id") or ""): item for item in results if item.get("id")}
    for candidate in candidates:
        item_id = str(candidate.get("id") or "").strip()
        if not item_id:
            continue
        if item_id not in by_id:
            by_id[item_id] = candidate
            results.append(candidate)
            continue
        existing = by_id[item_id]
        candidate_fact_dense_rank = _to_int(candidate.get("fact_segment_dense_rank"))
        existing_fact_dense_rank = _to_int(existing.get("fact_segment_dense_rank"))
        if candidate_fact_dense_rank:
            existing["fact_segment_dense_rank"] = min(
                existing_fact_dense_rank or candidate_fact_dense_rank,
                candidate_fact_dense_rank,
            )
        existing_indexes = existing.get("fact_segment_indexes")
        if not isinstance(existing_indexes, list):
            existing_indexes = []
        for segment_index in candidate.get("fact_segment_indexes") or []:
            if segment_index not in existing_indexes:
                existing_indexes.append(segment_index)
        existing["fact_segment_indexes"] = existing_indexes
        existing["fact_segment_hits"] = len(existing_indexes)
        existing_segment_ranks = existing.get("fact_segment_ranks")
        if not isinstance(existing_segment_ranks, dict):
            existing_segment_ranks = {}
        for segment_index, segment_rank in (candidate.get("fact_segment_ranks") or {}).items():
            previous_segment_rank = _to_int(existing_segment_ranks.get(str(segment_index)))
            candidate_segment_rank = _to_int(segment_rank)
            if candidate_segment_rank:
                existing_segment_ranks[str(segment_index)] = min(
                    previous_segment_rank or candidate_segment_rank,
                    candidate_segment_rank,
                )
        existing["fact_segment_ranks"] = existing_segment_ranks
        existing_lexical_ranks = existing.get("fact_segment_lexical_ranks")
        if not isinstance(existing_lexical_ranks, dict):
            existing_lexical_ranks = {}
        for segment_index, segment_rank in (candidate.get("fact_segment_lexical_ranks") or {}).items():
            previous_segment_rank = _to_int(existing_lexical_ranks.get(str(segment_index)))
            candidate_segment_rank = _to_int(segment_rank)
            if candidate_segment_rank:
                existing_lexical_ranks[str(segment_index)] = min(
                    previous_segment_rank or candidate_segment_rank,
                    candidate_segment_rank,
                )
        if existing_lexical_ranks:
            existing["fact_segment_lexical_ranks"] = existing_lexical_ranks
        if candidate.get("fact_neighbor") is True:
            existing["fact_neighbor"] = True
            existing.setdefault("fact_neighbor_of", candidate.get("fact_neighbor_of"))
        existing_adjacent = existing.get("fact_adjacent_to_best_segments")
        if not isinstance(existing_adjacent, list):
            existing_adjacent = []
        for segment_index in candidate.get("fact_adjacent_to_best_segments") or []:
            key = str(segment_index)
            if key not in existing_adjacent:
                existing_adjacent.append(key)
        if existing_adjacent:
            existing["fact_adjacent_to_best_segments"] = existing_adjacent
        candidate_rank = _to_int(candidate.get("fact_segment_best_rank"))
        existing_rank = _to_int(existing.get("fact_segment_best_rank"))
        if candidate_rank:
            existing["fact_segment_best_rank"] = min(existing_rank or candidate_rank, candidate_rank)
        try:
            candidate_distance = candidate.get("distance")
            existing_distance = existing.get("distance")
            if candidate_distance is not None and (
                existing_distance is None or float(candidate_distance) < float(existing_distance)
            ):
                existing["distance"] = candidate_distance
        except Exception:
            pass

# --------------------
# Routes
# --------------------
def _initialize_persistent_lexical_index() -> None:
    if not RAG_PERSISTENT_LEXICAL_INDEX_ENABLED:
        return
    try:
        registry = _load_registry()
        status = LEXICAL_INDEX.status(registry, verify=True)
        if not status.get("ready"):
            status = _rebuild_persistent_lexical_index("startup")
        stage_logger.info(
            "rag.lexical_index.ready %s",
            json.dumps(
                {
                    "outcome": "ok",
                    "chunk_count": int(status.get("chunk_count") or 0),
                    "document_count": int(status.get("document_count") or 0),
                    "size_bytes": int(status.get("size_bytes") or 0),
                },
                ensure_ascii=False,
            ),
        )
    except Exception as exc:
        logger.error("Persistent lexical index startup failed error=%s", exc.__class__.__name__)


app.router.add_event_handler("startup", _initialize_persistent_lexical_index)


@app.get("/health")
def health():
    try:
        reg = _load_registry()
    except RegistryError as exc:
        return JSONResponse(
            status_code=503,
            content={"ok": False, "status": "degraded", "error": {"code": exc.code}},
            headers={"Cache-Control": "no-store"},
        )
    try:
        n = collection.count()
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"ok": False, "status": "degraded", "error": {"code": "VECTOR_STORE_UNAVAILABLE"}},
            headers={"Cache-Control": "no-store"},
        )
    return {
        "ok": True,
        "status": "ok",
        "vectors": n,
        "documents": len(reg),
        "lexical_index": (
            LEXICAL_INDEX.status(reg)
            if RAG_PERSISTENT_LEXICAL_INDEX_ENABLED
            else {"ready": False, "reason": "LEXICAL_INDEX_DISABLED"}
        ),
    }


@app.get("/lexical-index/status", dependencies=[Depends(_require_key)])
def lexical_index_status():
    registry = _load_registry()
    return {
        "ok": True,
        "enabled": RAG_PERSISTENT_LEXICAL_INDEX_ENABLED,
        "lexical_index": (
            LEXICAL_INDEX.status(registry, verify=True)
            if RAG_PERSISTENT_LEXICAL_INDEX_ENABLED
            else {"ready": False, "reason": "LEXICAL_INDEX_DISABLED"}
        ),
    }


@app.post("/lexical-index/rebuild", dependencies=[Depends(_require_key), Depends(_require_registry_available)])
def rebuild_lexical_index():
    if not RAG_PERSISTENT_LEXICAL_INDEX_ENABLED:
        raise HTTPException(409, {"code": "LEXICAL_INDEX_DISABLED"})
    _mark_persistent_lexical_index_stale("admin_rebuild")
    try:
        status = _rebuild_persistent_lexical_index("admin_rebuild")
    except LexicalIndexError as exc:
        raise HTTPException(503, {"code": exc.code}) from exc
    return {"ok": True, "lexical_index": status}

# --- Ephemeral analyze (no persistence) ---
@app.post("/analyze", dependencies=[Depends(_require_key)])
async def analyze(
    file: UploadFile = File(...),
    mimeType: Optional[str] = Form(None),
    maxChunks: Optional[int] = Form(None),
):
    try:
        raw = await read_upload_bytes_bounded(file, MAX_FILE_BYTES)
    except RequestBodyTooLarge as exc:
        raise HTTPException(413, {"code": exc.code}) from exc
    if not raw:
        raise HTTPException(400, "Empty file")
    size_mb = _bytes_mb(raw)
    if size_mb > MAX_MB:
        raise HTTPException(413, f"File too large ({size_mb:.1f}MB > {MAX_MB}MB)")

    declared_mime = mimeType or file.content_type
    mime = _detect_mime(file.filename or "file", raw, declared_mime)
    if ALLOWED_MIME and mime not in ALLOWED_MIME:
        raise HTTPException(415, f"MIME not allowed: {mime}")

    # SOL-CHAT-09: DEKLARATSIOON EI VALI PARSERIT. Enne oli `_detect_mime()` deklaratsiooni
    # kummitempel, seega kasutaja sai ise otsustada, milline parser tema baite näeb —
    # „ütlen text/plain, saadan ZIP-pommi" oli täiesti lubatud rada. Fail-closed: tundmatu
    # sisu ei kinnita ühtegi deklaratsiooni.
    conflict = mime_conflict(mime, raw, file.filename or "")
    if conflict:
        raise HTTPException(415, f"Declared MIME does not match content: {conflict}")

    # extract text (without saving to storage or indexing)
    # NOTE: keep raw_text with lõigud/pealkirjad kasutajale kuvamiseks.
    truncated_reasons: List[str] = []
    if mime == "application/pdf":
        pages = _extract_text_from_pdf(raw)
        pages, pages_truncated = clamp_pages(pages)
        if pages_truncated:
            truncated_reasons.append("pdf_page_limit")
        texts = [t for (_, t) in pages if t]
        raw_text = "\n\n".join(texts)
    elif mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        # Kataloogi kontroll ENNE lahtipakkimist: väike fail ei tohi anda tohutut tööd.
        zip_ok, zip_reason, _zip_total = zip_expansion_guard(raw)
        if not zip_ok:
            raise HTTPException(413, f"DOCX rejected: {zip_reason}")
        raw_text = _extract_text_from_docx(raw)
    elif mime == "text/html":
        raw_text = _extract_text_from_html(raw.decode("utf-8", errors="ignore"))
    else:
        raw_text = raw.decode("utf-8", errors="ignore")

    raw_text, text_truncated = clamp_text(raw_text)
    if text_truncated:
        truncated_reasons.append("extracted_char_limit")

    # clean up only for chunking (embeddings), mitte kasutaja eelvaadet
    cleaned_text = _clean_text(raw_text)
    chunks = _split_chunks(cleaned_text)
    if maxChunks is not None:
        try:
            k = int(maxChunks)
            if k > 0:
                chunks = chunks[:k]
        except Exception:
            pass

    # SOL-CHAT-09: `fullText` oli varem KÄRPIMATA — 25 MB sisendist võis saada kümnetesse
    # megabaitidesse paisuv vastus, mille Node loeb esmalt üheks stringiks ja klient hoiab
    # React-i olekus. Nüüd on ta versioonitud ja piiratud leping: sisu kannavad chunk'id,
    # `fullText` on kuvamiseks ja tema kärbe on kliendile NÄHTAV, mitte vaikne.
    preview = raw_text[:8000]
    full_text, response_truncated = clamp_text(raw_text, RESPONSE_MAX_FULL_TEXT_CHARS)
    if response_truncated:
        truncated_reasons.append("response_char_limit")
    return {
        "ok": True,
        "analyzeContract": "v2",
        "fileName": file.filename,
        "mimeType": mime,
        "sizeMB": round(size_mb, 2),
        "chunks": chunks,
        "preview": preview,
        "fullText": full_text,
        "fullTextChars": len(full_text),
        "extractedChars": len(raw_text),
        "truncated": bool(truncated_reasons),
        "truncatedReasons": truncated_reasons,
    }

# --- shared worker for file ingestion (used by JSON + multipart) ---
def _process_ingest_file(
    doc_id: str,
    file_name: str,
    raw: bytes,
    mime_declared: Optional[str],
    meta: Dict,
    page_start: Optional[int] = None,
    page_end: Optional[int] = None,
    observability: Optional[Dict[str, object]] = None,
) -> Dict:
    size_mb = _bytes_mb(raw)
    if size_mb > MAX_MB:
        raise HTTPException(413, f"File too large ({size_mb:.1f}MB > {MAX_MB}MB)")

    mime = _detect_mime(file_name, raw, mime_declared)
    if ALLOWED_MIME and mime not in ALLOWED_MIME:
        raise HTTPException(415, f"MIME not allowed: {mime}")
    conflict = mime_conflict(mime, raw, file_name)
    if conflict:
        raise HTTPException(415, {"code": "MIME_CONTENT_MISMATCH", "reason": conflict})
    if mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        zip_ok, zip_reason, _zip_total = zip_expansion_guard(raw)
        if not zip_ok:
            raise HTTPException(413, {"code": "DOCUMENT_CONTAINER_LIMIT", "reason": zip_reason})

    # save raw
    #
    # SOL-RAGSVC-01 (P0). Siin oli `raw_path = d / file_name` ja `file_name`
    # tuli muutmata kliendilt — nii `/ingest/file` JSON-ist kui `/upload`
    # vormiväljast. Pythoni `/` ei ole liitmine: absoluutne parem pool viskab
    # vasaku ära, seega `fileName: "/etc/cron.d/x"` kirjutas sinna, kuhu ta
    # ütles. Nüüd võetakse nimest basename JA tõendatakse, et tulemus jääb
    # hoidlasse — kaks eri väravat, vt `storage_paths.py`.
    version_id = uuid.uuid4().hex
    d = _version_source_dir(doc_id, version_id)
    d.mkdir(parents=True, exist_ok=True)
    try:
        raw_path = doc_file_path(d, file_name, fallback="document.bin", storage_root=STORAGE_DIR)
    except PathOutsideStorage:
        raise HTTPException(400, "Invalid fileName")
    # extract text
    if mime == "application/pdf":
        text_or_pages_full = _extract_text_from_pdf(raw)
        start_page = _coerce_page_number(page_start)
        end_page = _coerce_page_number(page_end)
        if start_page is not None or end_page is not None:
            if start_page is None:
                start_page = end_page
            if end_page is None:
                end_page = start_page
            if start_page is not None and end_page is not None and end_page < start_page:
                start_page, end_page = end_page, start_page
            subset = _subset_pages(text_or_pages_full, start_page, end_page)
            if not subset:
                raise HTTPException(400, f"No PDF text found for pages {start_page}�?�{end_page}.")
            text_or_pages = subset
        else:
            text_or_pages = text_or_pages_full
    elif mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        text_or_pages = _extract_text_from_docx(raw)
    elif mime == "text/html":
        text_or_pages = _extract_text_from_html(raw.decode("utf-8", errors="ignore"))
    else:
        text_or_pages = raw.decode("utf-8", errors="ignore")

    pages_compact = None
    if isinstance(text_or_pages, list):
        pages_compact = _collapse_pages([p for p, _ in text_or_pages if isinstance(p, int)])

    raw_path.write_bytes(raw)
    logger.info("Staged ingest file '%s' (%0.2f MB) for doc_id=%s", raw_path, size_mb, doc_id)

    try:
        stage = _replace_document_vectors(
            doc_id,
            text_or_pages,
            meta_common={
                **meta,
                "source_type": meta.get("source_type") or "file",
                "source_path": meta.get("source_path") or str(raw_path),
                "mimeType": mime,
                "audience": normalize_audience(meta.get("audience")),
            },
            observability=observability,
            version_id=version_id,
        )
    except Exception:
        _remove_staged_source(raw_path)
        raise

    reg_entry = {
        "type": "FILE",
        # Registrisse läheb see nimi, mis PÄRISELT kettal on — mitte see, mille
        # klient saatis. Muidu näitaks allalaadimine nime, mida ei eksisteeri.
        "fileName": raw_path.name,
        "mimeType": mime,
        "lastIngested": now_iso(),
        "path": str(raw_path),
        "title": meta.get("title"),
        "description": meta.get("description"),
        "original_doc_id": meta.get("original_doc_id") or meta.get("originalDocId"),
        "originalDocId": meta.get("originalDocId") or meta.get("original_doc_id"),
        "audience": normalize_audience(meta.get("audience")),
        "authors": normalize_authors(meta.get("authors")),
        "issueId": normalize_issue_id(meta.get("issue_id") or meta.get("issueId")),
        "issueLabel": normalize_issue_label(meta.get("issue_label") or meta.get("issueLabel")),
        "year": normalize_year(meta.get("year")),
        "articleId": normalize_article_id(meta.get("article_id") or meta.get("articleId")),
        "section": normalize_section(meta.get("section")),
        "pages": normalize_pages(meta.get("pages")),
        "pageRange": (meta.get("pageRange") or pages_compact or "").strip() or None,
        "journalTitle": (meta.get("journal_title") or meta.get("journalTitle") or None),
        "tags": normalize_tags(meta.get("tags")),
        "language": (meta.get("language") or "et"),
        "collection_id": (meta.get("collection_id") or meta.get("collectionId") or None),
        "source_id": meta.get("source_id") or meta.get("sourceId"),
        "document_id": meta.get("document_id") or meta.get("documentId"),
        "source_type": meta.get("source_type") or "file",
        "legacy_source_type": meta.get("legacy_source_type") or meta.get("legacySourceType"),
        "authority": meta.get("authority"),
        "source_status": meta.get("source_status") or meta.get("sourceStatus"),
        "last_checked": meta.get("last_checked") or meta.get("lastChecked"),
        "retrieved_at": meta.get("retrieved_at") or meta.get("retrievedAt"),
        "valid_from": meta.get("valid_from") or meta.get("validFrom"),
        "valid_to": meta.get("valid_to") or meta.get("validTo"),
        "historical": meta.get("historical"),
        "canonical_item_id": meta.get("canonical_item_id") or meta.get("canonicalItemId"),
        "content_hash": meta.get("content_hash") or meta.get("contentHash"),
        "url": meta.get("url") or meta.get("source_url") or meta.get("sourceUrl") or meta.get("url_canonical") or meta.get("urlCanonical"),
        "url_canonical": meta.get("url_canonical") or meta.get("urlCanonical"),
        "country": normalize_country(meta.get("country")),
        "jurisdiction_level": normalize_jurisdiction(meta.get("jurisdiction_level") or meta.get("jurisdictionLevel")),
        "municipality_name": (meta.get("municipality_name") or meta.get("municipalityName") or None),
        "municipality_id": (meta.get("municipality_id") or meta.get("municipalityId") or None),
        "district_name": (meta.get("district_name") or meta.get("districtName") or None),
        "district_id": (meta.get("district_id") or meta.get("districtId") or None),
        "geo_detection_method": (meta.get("geo_detection_method") or meta.get("geoDetectionMethod") or None),
        "geo_detection_confidence": (meta.get("geo_detection_confidence") or meta.get("geoDetectionConfidence") or None),
    }
    try:
        version_result = _commit_vector_stage(stage, reg_entry)
    except Exception:
        _remove_staged_source(raw_path)
        raise
    inserted = version_result.count

    summary_ref = _make_short_ref(
        {
            "authors": meta.get("authors"),
            "title": meta.get("title"),
            "year": meta.get("year"),
            "issue": meta.get("issue_label") or meta.get("issueLabel") or meta.get("issue_id"),
            "issue_id": meta.get("issue_id") or meta.get("issueId"),
            "journal_title": meta.get("journal_title") or meta.get("journalTitle"),
        },
        pages_compact,
    )

    return {
        "ok": True,
        "inserted": inserted,
        "docId": doc_id,
        "pageRange": pages_compact,
        "shortRef": summary_ref,
    }

# --- JSON ingest (existing) ---
class _IngestFileModel(IngestFile): pass

@app.post("/ingest/file", dependencies=[Depends(_require_key), Depends(_require_registry_available)])
def ingest_file(payload: _IngestFileModel, request: Request):
    try:
        raw = base64.b64decode(payload.data, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(400, {"code": "BASE64_INVALID"}) from exc
    if not raw or not raw.strip(b"\x00"):
        raise HTTPException(400, {"code": "FILE_EMPTY"})
    observability = _build_observability_context(
        request,
        "rag_ingest",
        doc_id=payload.docId,
        file_size_bytes=len(raw),
    )
    return _process_ingest_file(
        doc_id=payload.docId,
        file_name=payload.fileName,
        raw=raw,
        mime_declared=payload.mimeType,
        meta={
            "title": payload.title,
            "description": payload.description,
            "authors": payload.authors,
            "tags": payload.tags,
            "issueId": payload.issueId,
            "issue_id": payload.issueId,
            "issueLabel": payload.issueLabel,
            "issue_label": payload.issueLabel,
            "year": payload.year,
            "article_id": payload.articleId,
            "articleId": payload.articleId,
            "section": payload.section,
            "pages": payload.pages,
            "pageRange": payload.pageRange,
            "audience": payload.audience,
            "journal_title": payload.journalTitle,
            "journalTitle": payload.journalTitle,
            "language": payload.language,
            "collection_id": payload.collection_id,
            "country": payload.country,
            "jurisdiction_level": payload.jurisdiction_level,
            "municipality_name": payload.municipality_name,
            "municipality_id": payload.municipality_id,
            "district_name": payload.district_name,
            "district_id": payload.district_id,
        },
        observability=observability,
    )

@app.post("/ingest/text", dependencies=[Depends(_require_key), Depends(_require_registry_available)])
def ingest_text(payload: IngestText, request: Request):
    doc_id = str(payload.doc_id or "").strip()
    if not doc_id:
        raise HTTPException(400, "doc_id is required")

    meta = dict(payload.metadata or {})
    meta_common = {
        **meta,
        "source_type": meta.get("source_type") or "agent_document",
        "source_path": meta.get("source_path"),
        "source_url": meta.get("source_url"),
        "audience": normalize_audience(meta.get("audience")),
    }
    chunks = list(payload.chunks or [])
    try:
        validate_ingest_budget(
            text=str(payload.text or ""),
            chunks=[str(chunk.text or "") for chunk in chunks],
            max_text_chars=MAX_TEXT_CHARS,
            max_chunks=MAX_EXPLICIT_CHUNKS,
            max_chunk_chars=MAX_EXPLICIT_CHUNK_CHARS,
        )
    except RequestBodyTooLarge as exc:
        raise HTTPException(413, {"code": exc.code, "reason": str(exc)}) from exc
    observability = _build_observability_context(
        request,
        "rag_ingest",
        doc_id=doc_id,
    )
    version_id = uuid.uuid4().hex

    if chunks:
        chunk_payload = _build_explicit_chunk_payload(doc_id, chunks, meta_common)
        if not chunk_payload["count"]:
            raise HTTPException(400, "chunks must contain readable text")
        stage = _replace_document_vectors_payload(
            doc_id,
            chunk_payload,
            observability=observability,
            version_id=version_id,
        )
    else:
        text = str(payload.text or "")
        if not text.strip():
            raise HTTPException(400, "text is required")
        stage = _replace_document_vectors(
            doc_id,
            text,
            meta_common=meta_common,
            observability=observability,
            version_id=version_id,
        )

    # SOL-RAGSVC-02 (P0). ALLIKAS SALVESTATAKSE MEIE ENDA HOIDLASSE.
    #
    # Varem läks registri `path` välja kliendi `metadata.source_path` — suvaline
    # string, mille `GET /documents/{id}/source` avas `FileResponse`-ina. See ei
    # olnud teadmisteallika eelvaade, vaid serverifaili lugemise primitiiv:
    # tee ei pidanud osutama ühelegi ingestitud failile.
    #
    # Kirjutame nüüd selle teksti, mille me ise indekseerisime. Nii on
    # allikavaade tõesti SEE, mis vektoritesse läks (varem võis fail kettal
    # olla vahepeal muutunud või üldse muu asi), ja `path` on definitsiooni
    # järgi hoidla sees.
    stored_source: Optional[Path] = None
    try:
        # Tükkidel on `text` väli — `str(chunk)` kirjutaks failina pydantic'u
        # repr'i ja allikavaade näitaks objekti, mitte teksti.
        parts = [str(chunk.text or "") for chunk in (payload.chunks or [])] or [str(payload.text or "")]
        source_text = "\n\n".join(part for part in parts if part.strip())
        if source_text.strip():
            version_dir = _version_source_dir(doc_id, version_id)
            version_dir.mkdir(parents=True, exist_ok=True)
            stored_source = doc_file_path(
                version_dir, "source.md", fallback="source.md", storage_root=STORAGE_DIR
            )
            stored_source.write_text(source_text, encoding="utf-8")
    except (OSError, PathOutsideStorage) as error:
        stage.abort()
        _remove_staged_source(stored_source)
        raise HTTPException(503, "Document source staging failed") from error

    reg_entry = {
        "type": "TEXT",
        "lastIngested": now_iso(),
        "title": meta.get("title"),
        "description": meta.get("description"),
        "audience": normalize_audience(meta.get("audience")),
        "audiences": normalize_audience_list(meta.get("audiences") or meta.get("audience")),
        "authors": normalize_authors(meta.get("authors")),
        "tags": normalize_tags(meta.get("tags")),
        "language": (meta.get("language") or "et"),
        "collection_id": (meta.get("collection_id") or meta.get("collectionId") or None),
        "country": normalize_country(meta.get("country")),
        "county": (meta.get("county") or None),
        "jurisdiction_level": normalize_jurisdiction(meta.get("jurisdiction_level") or meta.get("jurisdictionLevel")),
        "municipality_name": (meta.get("municipality_name") or meta.get("municipalityName") or meta.get("municipality") or None),
        "municipality_id": (meta.get("municipality_id") or meta.get("municipalityId") or None),
        "district_name": (meta.get("district_name") or meta.get("districtName") or None),
        "district_id": (meta.get("district_id") or meta.get("districtId") or None),
        "source_format": (meta.get("source_format") or meta.get("sourceFormat") or None),
        "checked_at": (meta.get("checked_at") or meta.get("checkedAt") or None),
        "item_type": (meta.get("item_type") or meta.get("itemType") or None),
        "content_status": (meta.get("content_status") or meta.get("contentStatus") or meta.get("status") or None),
        "resource_type": (meta.get("resource_type") or meta.get("resourceType") or None),
        "source_keys": normalize_string_list(meta.get("source_keys") or meta.get("sourceKeys")),
        "source_urls": normalize_string_list(meta.get("source_urls") or meta.get("sourceUrls")),
        "source_register_file": (meta.get("source_register_file") or meta.get("sourceRegisterFile") or None),
        "source_count": meta.get("source_count") or meta.get("sourceCount"),
        "administering_body": (meta.get("administering_body") or meta.get("administeringBody") or None),
        "issuer": (meta.get("issuer") or None),
        "act_title": (meta.get("act_title") or meta.get("actTitle") or None),
        "act_reference": (meta.get("act_reference") or meta.get("actReference") or None),
        "canonical_source_id": (meta.get("canonical_source_id") or meta.get("canonicalSourceId") or None),
        "act_type": (meta.get("act_type") or meta.get("actType") or None),
        "effective_start": (meta.get("effective_start") or meta.get("effectiveStart") or None),
        "effective_end": (meta.get("effective_end") or meta.get("effectiveEnd") or None),
        "is_current_version": meta.get("is_current_version") if meta.get("is_current_version") is not None else meta.get("isCurrentVersion"),
        "text_type": (meta.get("text_type") or meta.get("textType") or None),
        "source_type": meta.get("source_type") or "agent_document",
        # `path` on MEIE hoidla tee, mitte kliendi väide (SOL-RAGSVC-02).
        # Kliendi `source_path` jääb alles päritolusildina (`source_path`
        # metaandmetes), aga teda ei avata kunagi failina.
        "path": str(stored_source) if stored_source else None,
        "source_path": meta.get("source_path"),
        "url": meta.get("source_url") or meta.get("url"),
        "source_sha256": meta.get("source_sha256"),
        "source_updated_at": meta.get("source_updated_at"),
        "original_doc_id": meta.get("original_doc_id"),
        "fileName": meta.get("fileName"),
        "mimeType": meta.get("mimeType"),
        "geo_detection_method": (meta.get("geo_detection_method") or meta.get("geoDetectionMethod") or None),
        "geo_detection_confidence": (meta.get("geo_detection_confidence") or meta.get("geoDetectionConfidence") or None),
    }
    try:
        version_result = _commit_vector_stage(stage, reg_entry)
    except Exception:
        _remove_staged_source(stored_source)
        raise

    return {"ok": True, "inserted": version_result.count, "docId": doc_id}

# --- Multipart ingest (compat with older UI / direct browser forms) ---
@app.post("/upload", dependencies=[Depends(_require_key), Depends(_require_registry_available)])
async def upload(
    request: Request,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    audience: Optional[str] = Form(None),
    authors: Optional[str] = Form(None),
    issueId: Optional[str] = Form(None),
    issueLabel: Optional[str] = Form(None),
    year: Optional[str] = Form(None),
    articleId: Optional[str] = Form(None),
    section: Optional[str] = Form(None),
    pages: Optional[str] = Form(None),
    pageRange: Optional[str] = Form(None),
    journalTitle: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    language: Optional[str] = Form(None),
    collection_id: Optional[str] = Form(None),
    country: Optional[str] = Form(None),
    jurisdiction_level: Optional[str] = Form(None),
    municipality_name: Optional[str] = Form(None),
    municipality_id: Optional[str] = Form(None),
    district_name: Optional[str] = Form(None),
    district_id: Optional[str] = Form(None),
    docId: Optional[str] = Form(None),
    fileName: Optional[str] = Form(None),
    mimeType: Optional[str] = Form(None),
):
    try:
        raw = await read_upload_bytes_bounded(file, MAX_FILE_BYTES)
    except RequestBodyTooLarge as exc:
        raise HTTPException(413, {"code": exc.code}) from exc
    if not raw:
        raise HTTPException(400, "Empty file")

    _doc_id = (docId or str(uuid.uuid4())).strip()
    _name = (fileName or file.filename or "file").strip()
    if not _name:
        _name = "file"

    # kui aasta tuli stringina, proovi intiks
    year_val = normalize_year(year)

    return _process_ingest_file(
        doc_id=_doc_id,
        file_name=_name,
        raw=raw,
        mime_declared=(mimeType or file.content_type),
        meta={
            "title": (title or "").strip() or None,
            "description": (description or "").strip() or None,
            "authors": normalize_authors(authors),
            "tags": normalize_tags(tags),
            "issueId": issueId,
            "issue_id": issueId,
            "issueLabel": issueLabel,
            "issue_label": issueLabel,
            "year": year_val,
            "article_id": articleId,
            "articleId": articleId,
            "section": section,
            "pages": normalize_pages(pages),
            "pageRange": pageRange,
            "audience": audience,
            "journal_title": journalTitle,
            "journalTitle": journalTitle,
            "language": language,
            "collection_id": collection_id,
            "country": country,
            "jurisdiction_level": jurisdiction_level,
            "municipality_name": municipality_name,
            "municipality_id": municipality_id,
            "district_name": district_name,
            "district_id": district_id,
        },
        observability=_build_observability_context(
            request,
            "rag_ingest",
            doc_id=_doc_id,
            file_size_bytes=len(raw),
        ),
    )

@app.post("/ingest/pdf-with-metadata", dependencies=[Depends(_require_key), Depends(_require_registry_available)])
async def ingest_pdf_with_metadata(
    request: Request,
    file: UploadFile = File(...),
    metadata: Optional[UploadFile] = File(None),
    metadata_text: Optional[str] = Form(None),
    audience: Optional[str] = Form(None),
):
    try:
        raw = await read_upload_bytes_bounded(file, MAX_FILE_BYTES)
    except RequestBodyTooLarge as exc:
        raise HTTPException(413, {"code": exc.code}) from exc
    if not raw:
        raise HTTPException(400, "Empty PDF file")

    meta_raw: Optional[str] = None
    if metadata is not None:
        try:
            meta_bytes = await read_upload_bytes_bounded(metadata, MAX_METADATA_BYTES)
        except RequestBodyTooLarge as exc:
            raise HTTPException(413, {"code": exc.code, "reason": "metadata_byte_limit"}) from exc
        if not meta_bytes:
            raise HTTPException(400, "Metadata file is empty")
        meta_raw = meta_bytes.decode("utf-8", errors="ignore")
    elif metadata_text and str(metadata_text).strip():
        meta_raw = str(metadata_text).strip()
    else:
        try:
            form_data = await request.form()
            cand_text = form_data.get("metadata_text")
            cand_file = form_data.get("metadata")
            if isinstance(cand_text, str) and cand_text.strip():
                meta_raw = cand_text.strip()
            elif isinstance(cand_file, str) and cand_file.strip():
                meta_raw = cand_file
        except Exception:
            meta_raw = None
    if meta_raw is None:
        raise HTTPException(400, "Metaandmed puuduvad – anna JSON failina või tekstina.")

    try:
        meta_dict = json.loads(meta_raw)
    except Exception as e:
        raise HTTPException(400, f"Metaandmete JSON ei ole kehtiv: {e}")
    if not isinstance(meta_dict, dict):
        raise HTTPException(400, "Metadata must be a JSON object.")

    doc_id, original_doc_id = resolve_pdf_metadata_doc_id(meta_dict)
    file_name = _sanitize_filename(file.filename or meta_dict.get("source_path") or "document.pdf")
    # override/meta additions
    meta_dict["source_type"] = meta_dict.get("source_type") or "file"
    meta_dict["source_path"] = file_name
    if audience:
        meta_dict["audience"] = audience
    start_page = _coerce_page_number(meta_dict.get("pdf_start_page") or meta_dict.get("pdfStartPage"))
    end_page = _coerce_page_number(meta_dict.get("pdf_end_page") or meta_dict.get("pdfEndPage"))

    logger.info(
        "Ingest PDF with metadata: doc_id=%s, original_doc_id=%s, file=%s, pages=%s-%s, collection=%s",
        doc_id,
        original_doc_id,
        file_name,
        start_page,
        end_page,
        COLLECTION_NAME,
    )
    logger.debug("Metadata for ingest: %s", meta_dict)

    try:
        result = _process_ingest_file(
            doc_id=doc_id,
            file_name=file_name,
            raw=raw,
            mime_declared=file.content_type,
            meta=meta_dict,
            page_start=start_page,
            page_end=end_page,
            observability=_build_observability_context(
                request,
                "rag_ingest",
                doc_id=doc_id,
                file_size_bytes=len(raw),
            ),
        )
    except ValidationError as e:
        raise HTTPException(400, f"Invalid metadata: {e}") from e
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            "PDF metadata ingest failed: doc_id=%s, original_doc_id=%s, file=%s, source_type=%s, collection=%s",
            doc_id,
            original_doc_id,
            file_name,
            meta_dict.get("source_type"),
            COLLECTION_NAME,
        )
        raise HTTPException(
            500,
            f"RAG ingest failed for doc_id={doc_id}; check rag-service logs.",
        ) from e

    return {
        **result,
        "docId": doc_id,
        "originalDocId": original_doc_id,
        "fileName": file_name,
        "collection": COLLECTION_NAME,
        "pageStart": start_page,
        "pageEnd": end_page,
    }

@app.post("/ingest/url", dependencies=[Depends(_require_key), Depends(_require_registry_available)])
def ingest_url(payload: IngestURL, request: Request):
    try:
        html = _fetch_remote_html(payload.url)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(422, f"Fetch failed: {e}")
    text = _extract_text_from_html(html)
    doc_id = (payload.docId or str(uuid.uuid4())).strip()
    if not doc_id:
        doc_id = str(uuid.uuid4())
    detected_geo = infer_url_geo_metadata(payload.url, payload.title, text)

    country = normalize_country(payload.country) or detected_geo.get("country")
    jurisdiction_level = normalize_jurisdiction(payload.jurisdiction_level or detected_geo.get("jurisdiction_level"))
    municipality_name = (payload.municipality_name or detected_geo.get("municipality_name") or "").strip() or None
    municipality_id = (payload.municipality_id or "").strip() or None
    district_name = (payload.district_name or "").strip() or None
    district_id = (payload.district_id or "").strip() or None

    version_id = uuid.uuid4().hex
    d = _version_source_dir(doc_id, version_id)
    d.mkdir(parents=True, exist_ok=True)
    html_path = d / "source.html"
    html_path.write_text(html, encoding="utf-8")

    try:
        stage = _replace_document_vectors(
            doc_id,
            text,
            meta_common={
            "title": payload.title,
            "description": payload.description,
            "authors": payload.authors,
            "tags": payload.tags,
            "issue_id": payload.issueId,
            "issue_label": payload.issueLabel,
            "year": payload.year,
            "article_id": payload.articleId,
            "section": payload.section,
            "pages": payload.pages,
            "pageRange": payload.pageRange,
            "journal_title": payload.journalTitle,
            "journalTitle": payload.journalTitle,
            "source_type": "url",
            "source_url": payload.url,
            "source_path": str(html_path),
            "mimeType": "text/html",
            "audience": normalize_audience(payload.audience),
            "language": payload.language or "et",
            "collection_id": payload.collection_id,
            "country": country,
            "jurisdiction_level": jurisdiction_level,
            "municipality_name": municipality_name,
            "municipality_id": municipality_id,
            "district_name": district_name,
            "district_id": district_id,
            "geo_detection_method": detected_geo.get("geo_detection_method"),
            "geo_detection_confidence": detected_geo.get("geo_detection_confidence"),
        },
            observability=_build_observability_context(
                request,
                "rag_ingest",
                doc_id=doc_id,
            ),
            version_id=version_id,
        )
    except Exception:
        _remove_staged_source(html_path)
        raise

    reg_entry = {
        "type": "URL",
        "url": payload.url,
        "lastIngested": now_iso(),
        "path": str(html_path),
        "title": payload.title,
        "description": payload.description,
        "audience": normalize_audience(payload.audience),
        "authors": normalize_authors(payload.authors),
        "issueId": normalize_issue_id(payload.issueId),
        "issueLabel": normalize_issue_label(payload.issueLabel),
        "year": normalize_year(payload.year),
        "articleId": normalize_article_id(payload.articleId),
        "section": normalize_section(payload.section),
        "pages": normalize_pages(payload.pages),
        "pageRange": (payload.pageRange or "").strip() or None,
        "journalTitle": payload.journalTitle,
        "tags": normalize_tags(payload.tags),
        "language": payload.language or "et",
        "collection_id": (payload.collection_id or "").strip() or None,
        "country": country,
        "jurisdiction_level": jurisdiction_level,
        "municipality_name": municipality_name,
        "municipality_id": municipality_id,
        "district_name": district_name,
        "district_id": district_id,
        "geo_detection_method": detected_geo.get("geo_detection_method"),
        "geo_detection_confidence": detected_geo.get("geo_detection_confidence"),
    }
    try:
        version_result = _commit_vector_stage(stage, reg_entry)
    except Exception:
        _remove_staged_source(html_path)
        raise

    return {"ok": True, "inserted": version_result.count, "docId": doc_id}

# ------------- Ingest ARTICLES (magazine workflow) ----------------
def _parse_range(range_str: str) -> Optional[Tuple[int, int]]:
    if not range_str:
        return None
    s = str(range_str).strip()
    # accept hyphen, en dash, em dash
    s = s.replace("—", "-").replace("–", "-")
    m = re.match(r"^\s*(\d+)\s*-\s*(\d+)\s*$", s)
    if not m:
        # single page like "7"
        m1 = re.match(r"^\s*(\d+)\s*$", s)
        if m1:
            n = int(m1.group(1))
            return (n, n)
        return None
    a, b = int(m.group(1)), int(m.group(2))
    if a <= 0 or b <= 0:
        return None
    if b < a:
        a, b = b, a
    return (a, b)

def _subset_pages(pdf_pages: List[Tuple[int, str]], start: int, end: int) -> List[Tuple[int, str]]:
    return [(pno, txt) for (pno, txt) in pdf_pages if isinstance(pno, int) and start <= pno <= end]

def _require_pdf_registry(entry: Dict):
    if not entry:
        raise HTTPException(404, "Document not in registry")
    if entry.get("type") != "FILE":
        raise HTTPException(400, "Articles ingest requires a FILE (PDF) document.")
    if (entry.get("mimeType") or "").lower() != "application/pdf":
        raise HTTPException(400, "Articles ingest requires a PDF source.")

def _load_pdf_pages(entry: Dict) -> List[Tuple[int, str]]:
    p = _storage_path_or_404(entry.get("path"), "file")
    raw = p.read_bytes()
    return _extract_text_from_pdf(raw)

def _article_meta_common(entry: Dict, a: IngestArticle) -> Dict:
    return {
        "title": a.title,
        "description": (a.description or "").strip() or None,
        "authors": normalize_authors(a.authors),
        "section": normalize_section(a.section),
        "year": normalize_year(a.year) or normalize_year(entry.get("year")),
        "issue_label": normalize_issue_label(a.issueLabel) or normalize_issue_label(entry.get("issueLabel")),
        "issueId": entry.get("issueId"),
        "issue_id": entry.get("issueId"),
        "journal_title": a.journalTitle or entry.get("journalTitle"),
        "journalTitle": a.journalTitle or entry.get("journalTitle"),
        "article_id": normalize_article_id(a.articleId),
        "articleId": normalize_article_id(a.articleId),
        "pages": None,  # we set pageRange instead
        "pageRange": (a.pageRange or "").strip() or None,
        "source_type": "file",
        "source_path": entry.get("path"),
        "mimeType": entry.get("mimeType"),
        "audience": normalize_audience(a.audience or entry.get("audience")),
        "tags": normalize_tags(a.tags or entry.get("tags")),
        "language": entry.get("language") or "et",
        "collection_id": (a.collection_id or entry.get("collection_id") or None),
        "country": normalize_country(a.country or entry.get("country")),
        "jurisdiction_level": normalize_jurisdiction(a.jurisdiction_level or entry.get("jurisdiction_level")),
        "municipality_name": (a.municipality_name or entry.get("municipality_name") or None),
        "municipality_id": (a.municipality_id or entry.get("municipality_id") or None),
        "district_name": (a.district_name or entry.get("district_name") or None),
        "district_id": (a.district_id or entry.get("district_id") or None),
    }


def _article_identity(article: IngestArticle, start_page: int, end_page: int) -> str:
    explicit = normalize_article_id(article.articleId)
    if explicit:
        return _safe_chunk_id_segment(explicit)
    seed = f"{article.title}|{start_page}|{end_page}".encode("utf-8")
    return f"derived-{hashlib.sha256(seed).hexdigest()[:16]}"


def _build_articles_batch_payload(
    doc_id: str,
    entry: Dict,
    pdf_pages: List[Tuple[int, str]],
    articles: List[IngestArticle],
) -> Tuple[Dict[str, object], List[Dict]]:
    combined = {"count": 0, "documents": [], "metadatas": [], "ids": [], "embeddings": []}
    summaries: List[Dict] = []
    seen_articles = set()
    for article in articles:
        start_page = article.startPage if isinstance(article.startPage, int) else None
        end_page = article.endPage if isinstance(article.endPage, int) else None
        if start_page is None or end_page is None:
            parsed = _parse_range(article.pageRange or "")
            if parsed:
                offset = int(article.offset) if article.offset is not None else None
                start_page, end_page = (
                    (parsed[0] + offset, parsed[1] + offset) if offset is not None else parsed
                )
        if start_page is None or end_page is None:
            raise HTTPException(400, f"Article '{article.title}': provide pageRange(+offset) or startPage/endPage.")
        if start_page <= 0 or end_page <= 0:
            raise HTTPException(400, f"Article '{article.title}': invalid page numbers.")
        subset = _subset_pages(pdf_pages, start_page, end_page)
        if not subset:
            raise HTTPException(400, f"Article '{article.title}': no PDF text found for pages {start_page}–{end_page}.")
        identity = _article_identity(article, start_page, end_page)
        if identity in seen_articles:
            raise HTTPException(409, {"code": "DUPLICATE_ARTICLE_ID", "article_id": identity})
        seen_articles.add(identity)
        meta = _article_meta_common(entry, article)
        meta["article_id"] = identity
        meta["articleId"] = identity
        if not meta.get("pageRange"):
            meta["pageRange"] = f"{start_page}–{end_page}"
        payload = _build_ingest_payload(doc_id, subset, meta)
        if not payload.get("count"):
            raise HTTPException(422, {"code": "ARTICLE_HAS_NO_TEXT", "article_id": identity})
        for index, text in enumerate(payload["documents"]):
            text_hash = hashlib.sha256(str(text).encode("utf-8")).hexdigest()[:16]
            logical_id = f"{_safe_chunk_id_segment(doc_id)}:article:{identity}:{index}:{text_hash}"
            payload["ids"][index] = logical_id
            payload["metadatas"][index]["chunk_id"] = logical_id
            payload["metadatas"][index]["chunkId"] = logical_id
        for key in ("documents", "metadatas", "ids", "embeddings"):
            combined[key].extend(payload[key])
        combined["count"] += int(payload["count"])
        summaries.append({
            "title": article.title,
            "articleId": identity,
            "inserted": int(payload["count"]),
            "startPage": start_page,
            "endPage": end_page,
        })
    return combined, summaries

@app.post("/ingest/articles", dependencies=[Depends(_require_key), Depends(_require_registry_available)])
def ingest_articles(payload: IngestArticlesIn, request: Request):
    if not payload.docId:
        raise HTTPException(400, "docId is required.")
    if not payload.articles:
        raise HTTPException(400, "articles array is required.")

    reg = _load_registry()
    entry = reg.get(payload.docId)
    _require_pdf_registry(entry)

    pdf_pages = _load_pdf_pages(entry)
    file_size_bytes = None
    try:
        file_size_bytes = _storage_path_or_404(entry.get("path"), "file").stat().st_size
    except Exception:
        file_size_bytes = None
    batch_payload, inserted_per_article = _build_articles_batch_payload(
        payload.docId, entry, pdf_pages, list(payload.articles)
    )
    version_id = uuid.uuid4().hex
    stage = _replace_document_vectors_payload(
        payload.docId,
        batch_payload,
        observability=_build_observability_context(
            request,
            "rag_ingest_articles",
            doc_id=payload.docId,
            article_count=len(payload.articles or []),
            file_size_bytes=file_size_bytes,
        ),
        version_id=version_id,
    )
    updated_entry = {
        **entry,
        "lastIngested": now_iso(),
        "articleManifest": inserted_per_article,
    }
    version_result = _commit_vector_stage(stage, updated_entry)
    return {
        "ok": True,
        "count": version_result.count,
        "inserted": inserted_per_article,
        "docId": payload.docId,
        "versionId": version_result.version_id,
    }

@app.post("/ingest/articles/{doc_id}", dependencies=[Depends(_require_key), Depends(_require_registry_available)])
def ingest_articles_path(request: Request, doc_id: str = FastPath(...), payload: IngestArticlesIn = None):
    # support :docId in path (Next.js config)
    if payload is None:
        raise HTTPException(400, "Body is required.")
    payload.docId = payload.docId or doc_id
    return ingest_articles(payload, request)

# ---------------- Documents -----------------
PUBLIC_DOCUMENT_METADATA_FIELDS = {
    "title", "description", "type", "fileName", "url", "sourceUrl", "mimeType",
    "audience", "audiences", "authors", "journalTitle", "journal_title", "tags",
    "language", "createdAt", "updatedAt", "lastIngested", "year", "issueId",
    "issueLabel", "articleId", "section", "pages", "pageRange", "collection_id",
    "country", "county", "jurisdiction_level", "municipality_name", "municipality_id",
    "district_name", "district_id", "item_type", "content_status", "resource_type",
    "checked_at", "source_keys", "source_urls", "source_register_file", "source_count",
    "administering_body", "lifecycleState", "cleanupState", "metadataState",
    "fileCleanupState", "activeVersion", "articleManifest", "profile_revision",
}


def _public_document_metadata(meta: Dict) -> Dict:
    return {key: value for key, value in dict(meta or {}).items() if key in PUBLIC_DOCUMENT_METADATA_FIELDS}


@app.get("/documents", dependencies=[Depends(_require_key)])
def documents(limit: Optional[int] = None, offset: int = 0):
    reg = _load_registry()
    out = []

    def _key(item):
        _meta = item[1]
        return (_meta.get("updatedAt") or _meta.get("createdAt") or "", item[0])

    items = sorted(reg.items(), key=_key, reverse=True)
    page_size = 100
    if isinstance(limit, int) and limit > 0:
        page_size = min(limit, 100)
    start = max(0, int(offset or 0))
    items = items[start : start + page_size]

    for doc_id, meta in items:
        try:
            got = collection.get(where={"doc_id": doc_id}, include=["metadatas"], limit=100000)
            ids = got.get("ids", []) or []
            count = len(ids)
            resolved_meta = _merge_registry_with_chunk_metadatas(meta, got.get("metadatas"))
            vector_error = None
        except Exception:
            count = None
            resolved_meta = dict(meta or {})
            vector_error = {"code": "VECTOR_STORE_UNAVAILABLE"}
        lifecycle_status = "COMPLETED" if meta.get("lifecycleState") in (None, "ACTIVE") else meta.get("lifecycleState")
        out.append({
            "id": doc_id,
            "docId": doc_id,
            "status": "DEGRADED" if vector_error else lifecycle_status,
            "chunks": count,
            "error": vector_error,
            "title": resolved_meta.get("title"),
            "description": resolved_meta.get("description"),
            "type": resolved_meta.get("type") or "FILE",
            "fileName": resolved_meta.get("fileName"),
            "sourceUrl": resolved_meta.get("url") or resolved_meta.get("sourceUrl"),
            "mimeType": resolved_meta.get("mimeType"),
            "audience": resolved_meta.get("audience"),
            "authors": resolved_meta.get("authors"),
            "journalTitle": resolved_meta.get("journalTitle") or resolved_meta.get("journal_title"),
            "tags": resolved_meta.get("tags"),
            "language": resolved_meta.get("language"),
            "createdAt": resolved_meta.get("createdAt"),
            "updatedAt": resolved_meta.get("updatedAt"),
            "lastIngested": resolved_meta.get("lastIngested"),
            **{k: v for k, v in _public_document_metadata(resolved_meta).items() if k not in {
                "title","description","type","fileName","url","mimeType",
                "audience","createdAt","updatedAt","lastIngested","journalTitle","tags","language"
            }},
        })
    return out

@app.get("/documents/{doc_id}", dependencies=[Depends(_require_key)])
def get_document(doc_id: str):
    reg = _load_registry()
    meta = reg.get(doc_id)
    if not meta:
        raise HTTPException(404, "Document not in registry")
    try:
        got = collection.get(where={"doc_id": doc_id}, include=["metadatas"], limit=100000)
        count = len(got.get("ids", []) or [])
        chunk_metadatas = got.get("metadatas")
        resolved_meta = _merge_registry_with_chunk_metadatas(meta, chunk_metadatas)
        metadata_summary = _metadata_summary(chunk_metadatas)
        vector_error = None
    except Exception:
        count = None
        resolved_meta = dict(meta or {})
        metadata_summary = _metadata_summary([])
        vector_error = {"code": "VECTOR_STORE_UNAVAILABLE"}
    lifecycle_status = "COMPLETED" if meta.get("lifecycleState") in (None, "ACTIVE") else meta.get("lifecycleState")
    return {
        "id": doc_id,
        "docId": doc_id,
        "status": "DEGRADED" if vector_error else lifecycle_status,
        "chunks": count,
        "error": vector_error,
        "metadataSummary": metadata_summary,
        **_public_document_metadata(resolved_meta),
    }

@app.get("/documents/{doc_id}/chunks", dependencies=[Depends(_require_key)])
def get_document_chunks(
    doc_id: str,
    item_type: Optional[str] = None,
    source_type: Optional[str] = None,
    limit: int = 10000,
):
    reg = _load_registry()
    if doc_id not in reg:
        raise HTTPException(404, "Document not in registry")

    safe_limit = max(1, min(int(limit or 10000), 100000))
    try:
        got = collection.get(where={"doc_id": doc_id}, include=["documents", "metadatas"], limit=safe_limit)
    except Exception as exc:
        logger.exception("Document chunks read failed for doc_id=%s", doc_id)
        raise HTTPException(500, "Document chunks read failed") from exc

    ids = got.get("ids", []) or []
    documents = got.get("documents") or []
    metadatas = got.get("metadatas") or []
    where: Dict[str, object] = {}
    if item_type:
        where["item_type"] = str(item_type).strip()
    if source_type:
        where["source_type"] = str(source_type).strip()

    chunks = []
    for index, item_id in enumerate(ids):
        metadata = metadatas[index] if index < len(metadatas) and isinstance(metadatas[index], dict) else {}
        if where and not _metadata_matches_filter(metadata, where):
            continue
        chunks.append({
            "id": item_id,
            "docId": doc_id,
            "text": documents[index] if index < len(documents) and isinstance(documents[index], str) else "",
            "metadata": metadata,
        })

    return {
        "docId": doc_id,
        "count": len(chunks),
        "chunks": chunks,
    }

@app.get("/documents/{doc_id}/source", dependencies=[Depends(_require_key)])
def get_document_source(doc_id: str):
    reg = _load_registry()
    entry = reg.get(doc_id)
    if not entry:
        raise HTTPException(404, "Document not in registry")

    entry_type = (entry.get("type") or "").upper()
    if entry_type == "TEXT":
        target_url = str(entry.get("url") or "").strip()
        if target_url:
            return RedirectResponse(target_url, status_code=307)

        # SOL-RAGSVC-02: registri tee TÕENDATAKSE hoidla sisse enne avamist.
        # Vana register sisaldab ridu, mille `path` osutab hoidlast välja —
        # nemad annavad nüüd 404, mitte baite.
        text_path = _storage_path_or_404(entry.get("path"), "text source")
        if not text_path.exists():
            raise HTTPException(404, "Stored text source is missing")
        media_type = entry.get("mimeType") or "text/markdown; charset=utf-8"
        filename = _sanitize_filename(entry.get("fileName") or text_path.name or f"{doc_id}.md", text_path.name or "source.md")
        return FileResponse(text_path, media_type=media_type, filename=filename)

    if entry_type == "URL":
        target_url = str(entry.get("url") or "").strip()
        if target_url:
            return RedirectResponse(target_url, status_code=307)

        html_path = _storage_path_or_404(entry.get("path"), "URL snapshot")
        if not html_path.exists():
            raise HTTPException(404, "Stored URL snapshot is missing")
        return FileResponse(
            html_path,
            media_type="text/html; charset=utf-8",
            filename=_sanitize_filename(html_path.name or "source.html", "source.html"),
        )

    if entry_type != "FILE":
        raise HTTPException(400, "Source download is supported only for FILE and URL documents.")

    # FILE-rida kirjutab server ise, aga kontroll on siin sellepärast, et
    # register on FAIL — kes ta kätte saab, kirjutab ka `path` välja.
    path = _storage_path_or_404(entry.get("path"), "file")
    if not path.exists():
        raise HTTPException(404, "Stored file is missing")

    filename = _sanitize_filename(entry.get("fileName") or path.name or f"{doc_id}.bin", path.name or "document.bin")
    media_type = entry.get("mimeType") or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    return FileResponse(path, media_type=media_type, filename=filename)

def _build_reindex_metadata(doc_id: str, entry: Dict, chunk_metadatas: Optional[List[Dict]]) -> Dict:
    merged = _merge_registry_with_chunk_metadatas(entry, chunk_metadatas)
    return {
        **merged,
        "docId": merged.get("docId") or doc_id,
        "document_id": merged.get("document_id") or doc_id,
        "audience": normalize_audience(merged.get("audience")),
        "language": merged.get("language") or "et",
    }


@app.post("/documents/{doc_id}/reindex", dependencies=[Depends(_require_key), Depends(_require_registry_available)])
def reindex(doc_id: str):
    reg = _load_registry()
    entry = reg.get(doc_id)
    if not entry:
        raise HTTPException(404, "Document not in registry")

    try:
        current = collection.get(where={"doc_id": doc_id}, include=["metadatas"], limit=100000)
        reindex_metadata = _build_reindex_metadata(doc_id, entry, current.get("metadatas"))
    except Exception as exc:
        raise HTTPException(503, "Existing document metadata is unavailable; reindex was not started") from exc

    if entry.get("type") == "FILE":
        # Sama piir mis allika allalaadimisel: reindeks LOEB faili ja tema sisu
        # jõuab vektoritesse, kust ta on otsinguga kättesaadav. Kontrollimata
        # tee annaks siin sama lugemisprimitiivi, ainult ühe sammu kaudu.
        p = _storage_path_or_404(entry.get("path"), "file")
        raw = p.read_bytes()
        mime = entry.get("mimeType") or _detect_mime(p.name, raw, None)
        if mime == "application/pdf":
            text_or_pages = _extract_text_from_pdf(raw)
        elif mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            text_or_pages = _extract_text_from_docx(raw)
        elif mime == "text/html":
            text_or_pages = _extract_text_from_html(raw.decode("utf-8", errors="ignore"))
        else:
            text_or_pages = raw.decode("utf-8", errors="ignore")

        stage = _replace_document_vectors(doc_id, text_or_pages, meta_common={
            **reindex_metadata,
            "source_type": reindex_metadata.get("source_type") or "file",
            "source_path": entry.get("path"),
            "mimeType": mime,
        })
        entry["lastIngested"] = now_iso()
        result = _commit_vector_stage(stage, entry)
        return {"ok": True, "inserted": result.count, "doc": entry}

    if entry.get("type") == "URL":
        html_path = _storage_path_or_404(entry.get("path"), "URL snapshot")
        html = html_path.read_text(encoding="utf-8")
        text = _extract_text_from_html(html)
        stage = _replace_document_vectors(doc_id, text, meta_common={
            **reindex_metadata,
            "source_type": reindex_metadata.get("source_type") or "url",
            "source_url": entry.get("url"),
            "source_path": entry.get("path"),
            "mimeType": "text/html",
        })
        entry["lastIngested"] = now_iso()
        result = _commit_vector_stage(stage, entry)
        return {"ok": True, "inserted": result.count, "doc": entry}

    if entry.get("type") == "TEXT":
        text_path = _storage_path_or_404(entry.get("path"), "text source")
        if not text_path.exists():
            raise HTTPException(404, "Stored text source is missing")
        text = text_path.read_text(encoding="utf-8")
        stage = _replace_document_vectors(doc_id, text, meta_common=reindex_metadata)
        entry["lastIngested"] = now_iso()
        result = _commit_vector_stage(stage, entry)
        return {"ok": True, "inserted": result.count, "doc": entry}

    raise HTTPException(400, "Unsupported registry entry type")

@app.post("/documents/{doc_id}/update-meta", dependencies=[Depends(_require_key), Depends(_require_registry_available)])
def update_document_metadata(doc_id: str, payload: UpdateMetadata):
    reg = _load_registry()
    entry = reg.get(doc_id)
    if not entry:
        raise HTTPException(404, "Document not in registry")
    if entry.get("type") != "FILE":
        raise HTTPException(400, "Metadata update is currently supported only for FILE documents.")

    path = _storage_path_or_404(entry.get("path"), "file")
    if not path.exists():
        raise HTTPException(404, "Stored file is missing; cannot update.")

    raw = path.read_bytes()
    mime = entry.get("mimeType") or _detect_mime(path.name, raw, None)

    def _pick(val, fallback):
        return fallback if val is None else val

    meta = {
        "title": _pick(payload.title, entry.get("title")),
        "description": _pick(payload.description, entry.get("description")),
        "authors": normalize_authors(payload.authors if payload.authors is not None else entry.get("authors")),
        "tags": normalize_tags(payload.tags if payload.tags is not None else entry.get("tags")),
        "issueId": _pick(payload.issueId, entry.get("issueId")),
        "issue_id": _pick(payload.issueId, entry.get("issueId")),
        "issueLabel": _pick(payload.issueLabel, entry.get("issueLabel")),
        "issue_label": _pick(payload.issueLabel, entry.get("issueLabel")),
        "year": normalize_year(_pick(payload.year, entry.get("year"))),
        "article_id": _pick(payload.articleId, entry.get("articleId")),
        "articleId": _pick(payload.articleId, entry.get("articleId")),
        "section": _pick(payload.section, entry.get("section")),
        "pages": normalize_pages(payload.pages if payload.pages is not None else entry.get("pages")),
        "pageRange": (_pick(payload.pageRange, entry.get("pageRange")) or "").strip() or None,
        "audience": normalize_audience(_pick(payload.audience, entry.get("audience"))),
        "journal_title": _pick(payload.journalTitle, entry.get("journalTitle")),
        "journalTitle": _pick(payload.journalTitle, entry.get("journalTitle")),
        "collection_id": _pick(payload.collection_id, entry.get("collection_id")),
        "country": _pick(payload.country, entry.get("country")),
        "jurisdiction_level": _pick(payload.jurisdiction_level, entry.get("jurisdiction_level")),
        "municipality_name": _pick(payload.municipality_name, entry.get("municipality_name")),
        "municipality_id": _pick(payload.municipality_id, entry.get("municipality_id")),
        "district_name": _pick(payload.district_name, entry.get("district_name")),
        "district_id": _pick(payload.district_id, entry.get("district_id")),
        "source_type": "file",
        "source_path": entry.get("path"),
        "mimeType": mime,
        "language": entry.get("language") or "et",
    }

    start_page = _coerce_page_number(payload.pdf_start_page)
    end_page = _coerce_page_number(payload.pdf_end_page)

    result = _process_ingest_file(
        doc_id=doc_id,
        file_name=path.name,
        raw=raw,
        mime_declared=mime,
        meta=meta,
        page_start=start_page,
        page_end=end_page,
    )
    return {
        **result,
        "docId": doc_id,
        "fileName": path.name,
        "collection": COLLECTION_NAME,
        "pageStart": start_page,
        "pageEnd": end_page,
    }

@app.post("/documents/{doc_id}/patch-meta", dependencies=[Depends(_require_key), Depends(_require_registry_available)])
def patch_document_metadata(doc_id: str, payload: PatchMetadata):
    raw_updates = payload.metadata or {}
    unknown = sorted(set(raw_updates) - PATCH_METADATA_ALLOWED_KEYS)
    if unknown:
        raise HTTPException(400, f"Unsupported patch-meta fields: {', '.join(unknown)}")

    updates = {}
    clear_fields = set()
    for key, value in raw_updates.items():
        if value is None:
            clear_fields.add(key)
            continue
        if key == "year":
            value = normalize_year(value)
            if value is None:
                continue
        if not isinstance(value, (str, int, float, bool)):
            raise HTTPException(400, f"patch-meta field {key} must be a scalar value")
        updates[key] = value
    if not updates and not clear_fields:
        raise HTTPException(400, "No patchable metadata values provided")

    if doc_id not in _load_registry():
        raise HTTPException(404, "Document not in registry")
    _mark_persistent_lexical_index_stale("metadata_patch")
    try:
        chunks_updated = patch_document_metadata_consistently(
            collection,
            REGISTRY_STORE,
            STORAGE_DIR / ".document-locks",
            doc_id,
            updates,
            updated_at=now_iso(),
            clear_fields=clear_fields,
        )
    except Exception:
        # If the shared metadata transaction could not prove its rollback, the
        # old FTS file remains present but deliberately unusable until rebuild.
        raise
    _refresh_persistent_lexical_index("metadata_patch")

    return {
        "ok": True,
        "docId": doc_id,
        "updated_fields": sorted(updates.keys()),
        "cleared_fields": sorted(clear_fields),
        "chunks_updated": chunks_updated,
    }

@app.delete("/documents/{doc_id}", dependencies=[Depends(_require_key), Depends(_require_registry_available)])
def delete_doc(doc_id: str):
    def delete_source(_entry):
        sub = resolve_within(STORAGE_DIR, _doc_dir_hashed(doc_id))
        if sub.exists():
            shutil.rmtree(sub)
        if sub.exists():
            raise OSError("document source directory still exists")

    _mark_persistent_lexical_index_stale("document_delete")
    try:
        result = delete_document_versioned(
            collection,
            REGISTRY_STORE,
            STORAGE_DIR / ".document-locks",
            doc_id,
            updated_at=now_iso(),
            delete_source=delete_source,
        )
    finally:
        # A failed delete can still leave a durable tombstone. Rebuild from the
        # resulting registry/Chroma state; a failed rebuild keeps the stale gate.
        _refresh_persistent_lexical_index("document_delete")
    return {"ok": True, "deleted": doc_id, "hadEntry": result.had_entry}

def _execute_search(
    payload: SearchIn,
    request: Request,
    *,
    agent_document_ids: Optional[List[str]] = None,
):
    is_general_search = agent_document_ids is None
    require_current_version = _requires_current_version(payload.where)
    md_where: Dict[str, object] = {}
    requested_retrievers = _normalize_requested_retrievers(payload.retrievers)

    if payload.filterDocId:
        md_where["doc_id"] = payload.filterDocId

    if isinstance(payload.where, dict):
        aud = payload.where.get("audience")
        if isinstance(aud, dict) and "$in" in aud:
            expanded = []
            for a in list(aud["$in"]):
                expanded.extend(audience_filter_values(a))
            md_where["audience"] = {"$in": sorted(set(expanded))}
        elif isinstance(aud, str):
            md_where["audience"] = {"$in": audience_filter_values(aud)}
        if "doc_id" in payload.where:
            doc_id_filter = payload.where["doc_id"]
            if isinstance(doc_id_filter, dict) and "$in" in doc_id_filter:
                cleaned_doc_ids = [str(v).strip() for v in list(doc_id_filter["$in"]) if str(v).strip()]
                if cleaned_doc_ids:
                    md_where["doc_id"] = {"$in": cleaned_doc_ids}
            elif isinstance(doc_id_filter, str):
                md_where["doc_id"] = doc_id_filter
        for input_key, metadata_key in SEARCH_METADATA_STRING_FILTERS:
            _copy_string_metadata_filter(payload.where, md_where, input_key, metadata_key)
        _copy_bool_metadata_filter(payload.where, md_where, "historical", "historical")
        if "$or" in payload.where:
            or_clauses = [
                _normalize_search_filter_clause(clause)
                for clause in list(payload.where.get("$or") or [])
                if isinstance(clause, dict)
            ]
            or_clauses = [clause for clause in or_clauses if clause]
            if or_clauses:
                _add_search_or_group(md_where, or_clauses)
        if "authors" in payload.where:
            author_filter = payload.where["authors"]
            author_values = list(author_filter.get("$in") or []) if isinstance(author_filter, dict) else author_filter
            normalized_authors = normalize_author_tokens(author_values)
            _add_search_or_group(md_where, [
                {f"author_token_{idx + 1}": token}
                for token in normalized_authors
                for idx in range(MAX_AUTHOR_TOKEN_SLOTS)
            ])
        if "tags" in payload.where or "tag_tokens" in payload.where or "tagTokens" in payload.where:
            tag_token_filter = payload.where.get(
                "tags", payload.where.get("tag_tokens", payload.where.get("tagTokens"))
            )
            if isinstance(tag_token_filter, dict) and "$in" in tag_token_filter:
                normalized_tag_tokens = normalize_tag_tokens(list(tag_token_filter["$in"]))
            else:
                normalized_tag_tokens = normalize_tag_tokens(tag_token_filter)
            if normalized_tag_tokens:
                or_clauses = []
                for token in normalized_tag_tokens:
                    for idx in range(MAX_TAG_TOKEN_SLOTS):
                        or_clauses.append({f"tag_token_{idx + 1}": token})
                _add_search_or_group(md_where, or_clauses)
        if "year" in payload.where:
            year_filter = payload.where["year"]
            if isinstance(year_filter, dict) and "$in" in year_filter:
                normalized_years = [
                    yr for yr in (normalize_year(v) for v in list(year_filter["$in"]))
                    if yr is not None
                ]
                if normalized_years:
                    md_where["year"] = {"$in": sorted(set(normalized_years))}
            else:
                normalized_year = normalize_year(year_filter)
                if normalized_year is not None:
                    md_where["year"] = normalized_year
        country_filter = payload.where.get("country")
        if isinstance(country_filter, str):
            normalized_country = normalize_country(country_filter)
            if normalized_country:
                md_where["country"] = normalized_country
        jurisdiction = payload.where.get("jurisdiction_level", payload.where.get("jurisdictionLevel"))
        if isinstance(jurisdiction, dict) and "$in" in jurisdiction:
            md_where["jurisdiction_level"] = {"$in": [normalize_jurisdiction(v) for v in list(jurisdiction["$in"])]}
        elif isinstance(jurisdiction, str):
            md_where["jurisdiction_level"] = normalize_jurisdiction(jurisdiction)

    # B0b: etapipõhine ajamõõtmine. Sisu ei logita — ainult kestused, outcome
    # ja korrelatsiooni-ID. `upstream_stage` eristab natiivotsingu
    # graph-channeli päringutest (klient saadab X-Observability-Stage).
    stage_request_id = (
        _clean_observability_value(payload.request_id)
        or _clean_observability_value(
            request.headers.get(REQUEST_ID_HEADER) if request is not None else None
        )
        or f"rag-{uuid.uuid4().hex[:16]}"
    )
    stage_upstream = _safe_search_observability_stage(
        request.headers.get(OBSERVABILITY_STAGE_HEADER) if request is not None else None
    )
    stage_t0 = time.perf_counter()

    def _ms_since(start: float) -> int:
        return int((time.perf_counter() - start) * 1000)

    def _log_stage(name: str, started_at: float, outcome: str, **extra) -> None:
        # Logitakse ka siis, kui klient on juba timeout'i tõttu lahkunud.
        try:
            stage_logger.info(
                "rag.search.stage %s",
                json.dumps(
                    {
                        "request_id": stage_request_id,
                        "upstream_stage": stage_upstream,
                        "stage": name,
                        "duration_ms": _ms_since(started_at),
                        "elapsed_ms": _ms_since(stage_t0),
                        "outcome": outcome,
                        "top_k": int(payload.top_k or 0),
                        **extra,
                    },
                    ensure_ascii=False,
                ),
            )
        except Exception:
            pass

    lexical_requested = any(
        channel in requested_retrievers
        for channel in ["author_match", "title_match", "exact_phrase", "bm25"]
    )
    deep_document_fact_search = payload.journal_chunks_per_document > 3
    split_fact_query_segments = (
        _split_fact_query_segments(payload.query, anchor_short=False)
        if deep_document_fact_search
        else []
    )
    reuse_primary_fact_embedding = deep_document_fact_search and not split_fact_query_segments
    fact_query_segments = (
        split_fact_query_segments
        if split_fact_query_segments
        else [payload.query]
        if reuse_primary_fact_embedding
        else []
    )
    fact_embedding_segments = (
        _split_fact_query_segments(payload.query, anchor_short=True)
        if split_fact_query_segments
        else []
    )
    # A short single-part fact question already has the exact embedding needed
    # for the document-internal pass. Reuse it instead of billing and waiting
    # for an identical second embedding input.
    embedding_inputs = [payload.query, *fact_embedding_segments]
    embed_t0 = time.perf_counter()
    embedding_degraded = False
    embedding_error_code: Optional[str] = None
    try:
        embed_result = _embed_batch_with_usage(embedding_inputs)
    except HTTPException as e:
        if e.status_code not in {502, 503} or not lexical_requested:
            _log_stage("embedding", embed_t0, "error", error_class=e.__class__.__name__)
            _log_stage("search_total", stage_t0, "error")
            raise
        # Dense retrieval depends on the external embedding provider, but the
        # lexical index is local and remains usable. A provider outage or
        # exhausted quota must not turn every hybrid search into HTTP 503.
        embedding_degraded = True
        embedding_error_code = "EMBEDDING_UNAVAILABLE"
        embed_result = {}
        logger.warning(
            "RAG dense retrieval unavailable; continuing with lexical fallback request_id=%s status=%s",
            stage_request_id,
            e.status_code,
        )
        _log_stage(
            "embedding",
            embed_t0,
            "lexical_fallback",
            error_class=e.__class__.__name__,
            status_code=e.status_code,
        )
    except Exception as e:
        _log_stage("embedding", embed_t0, "error", error_class=e.__class__.__name__)
        _log_stage("search_total", stage_t0, "error")
        raise
    embedding_ms = _ms_since(embed_t0)
    q_embeds = list(embed_result.get("embeddings") or [])
    segment_embeddings = (
        [q_embeds[0]]
        if q_embeds and reuse_primary_fact_embedding
        else q_embeds[1:1 + len(fact_query_segments)]
        if q_embeds
        else []
    )
    if not embedding_degraded:
        _log_stage(
            "embedding",
            embed_t0,
            "ok" if q_embeds else "empty",
            provider_latency_ms=_to_int(embed_result.get("latency_ms")),
        )
    if not q_embeds and not embedding_degraded:
        _log_stage("search_total", stage_t0, "no_embedding")
        return {
            "results": [],
            "groups": [],
            "retrievers_used": ["dense"],
            "search_strategy": "dense",
            "request_id": stage_request_id,
            "timings": {
                "embedding_ms": embedding_ms,
                "retrieval_ms": None,
                "total_ms": _ms_since(stage_t0),
                "outcome": "no_embedding",
            },
        }
    retrieval_t0 = time.perf_counter()
    observability = _build_observability_context(
        request,
        "rag_search",
        top_k=max(1, min(50, payload.top_k or 5)),
    )
    result_count = 0

    client_where = _compose_chroma_where(md_where)
    chroma_where = (
        build_general_search_where(client_where)
        if is_general_search
        else build_agent_document_search_where(agent_document_ids or [])
    )

    res = {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]}
    dense_t0 = time.perf_counter()
    dense_ms = 0
    try:
        include_items = list(payload.include or ["documents", "metadatas", "distances"])
        if "metadatas" not in include_items:
            include_items.append("metadatas")
        if q_embeds:
            res = collection.query(
                query_embeddings=[q_embeds[0]],
                n_results=_dense_candidate_limit(payload.top_k or 5),
                where=chroma_where,
                include=include_items,
            )
        dense_ms = _ms_since(dense_t0)
    except Exception as e:
        dense_ms = _ms_since(dense_t0)
        _log_rag_cost_usage(
            model=embed_result.get("model"),
            latency_ms=embed_result.get("latency_ms"),
            prompt_tokens=_to_int(embed_result.get("prompt_tokens")),
            total_tokens=_to_int(embed_result.get("total_tokens")),
            embedding_input_count=int(embed_result.get("embedding_input_count") or 0),
            text_chars=_to_int(embed_result.get("text_chars")),
            chunk_count=1,
            result_count=result_count,
            cost_read_directly=bool(embed_result.get("cost_read_directly")),
            **observability,
        )
        _log_stage("retrieval", retrieval_t0, "query_failed", error_class=e.__class__.__name__)
        _log_stage("search_total", stage_t0, "query_failed")
        raise HTTPException(
            status_code=503,
            detail={
                "code": "RAG_RETRIEVAL_UNAVAILABLE",
                "request_id": stage_request_id,
                "timings": {
                    "embedding_ms": embedding_ms,
                    "dense_ms": dense_ms,
                    "lexical_ms": None,
                    "retrieval_ms": _ms_since(retrieval_t0),
                    "total_ms": _ms_since(stage_t0),
                    "outcome": "query_failed",
                },
            },
        ) from e

    ids = (res.get("ids") or [[]])[0] if res.get("ids") else []
    docs = (res.get("documents") or [[]])[0] if res.get("documents") else []
    metas = (res.get("metadatas") or [[]])[0] if res.get("metadatas") else []
    dists = (res.get("distances") or [[]])[0] if res.get("distances") else []
    registry_t0 = time.perf_counter()
    version_registry = _load_registry()
    registry_ms = _ms_since(registry_t0)

    flat = []
    for i, _id in enumerate(ids):
        ch = docs[i] if i < len(docs) and isinstance(docs[i], str) else ""
        md = metas[i] if i < len(metas) and isinstance(metas[i], dict) else {}
        if not is_active_document_version(md, version_registry):
            continue
        if is_general_search and not is_general_search_metadata_allowed(md):
            continue
        if not _metadata_matches_filter(md, chroma_where):
            continue
        if not _metadata_matches_current_version_requirement(md, require_current_version):
            continue
        source_path = md.get("source_path")
        file_name = None
        if source_path:
            try:
                file_name = Path(source_path).name
            except Exception:
                file_name = source_path
        issue_val = md.get("issue_label") or md.get("issueLabel") or md.get("issue_id") or md.get("issueId") or None
        authors_val = normalize_authors(md.get("authors") or md.get("authors_list"))
        tags_val = normalize_tags(md.get("tags") or md.get("tags_list"))
        tag_tokens_val = normalize_tag_tokens(md.get("tag_tokens") or md.get("tagTokens") or tags_val)
        flat.append({
            "id": _id,
            "retriever": "dense",
            "retrieval_channel": "dense",
            "retrievalChannel": "dense",
            "retrieval_channels": ["dense"],
            "retrieval_rank": i + 1,
            "dense_rank": i + 1,
            "global_dense_rank": i + 1,
            "doc_id": md.get("doc_id") or md.get("docId"),
            "docId": md.get("docId") or md.get("doc_id"),
            "chunk_id": md.get("chunk_id") or md.get("chunkId"),
            "chunkId": md.get("chunkId") or md.get("chunk_id"),
            "chunk_index": md.get("chunk_index") or md.get("chunkIndex"),
            "chunkIndex": md.get("chunkIndex") or md.get("chunk_index"),
            "original_doc_id": md.get("original_doc_id") or md.get("originalDocId"),
            "originalDocId": md.get("originalDocId") or md.get("original_doc_id"),
            "title": md.get("title"),
            "description": md.get("description"),
            "audience": md.get("audience"),
            "audiences": md.get("audiences"),
            "authors": authors_val,
            "tag_tokens": tag_tokens_val,
            "tagTokens": tag_tokens_val,
            "issue": issue_val,
            "issueLabel": md.get("issue_label") or md.get("issueLabel"),
            "issueId": md.get("issue_id") or md.get("issueId"),
            "year": md.get("year"),
            "articleId": md.get("article_id") or md.get("articleId"),
            "section": md.get("section"),
            "item_type": md.get("item_type"),
            "content_status": md.get("content_status"),
            "is_current_version": md.get("is_current_version") if md.get("is_current_version") is not None else md.get("isCurrentVersion"),
            "resource_type": md.get("resource_type"),
            "checked_at": md.get("checked_at"),
            "pages": md.get("pages"),
            "pageRange": md.get("pageRange"),
            "journalTitle": md.get("journal_title") or md.get("journalTitle"),
            "source_id": md.get("source_id"),
            "sourceId": md.get("sourceId") or md.get("source_id"),
            "document_id": md.get("document_id"),
            "documentId": md.get("documentId") or md.get("document_id"),
            "legacy_source_type": md.get("legacy_source_type"),
            "authority": md.get("authority"),
            "url_canonical": md.get("url_canonical"),
            "retrieved_at": md.get("retrieved_at"),
            "last_checked": md.get("last_checked"),
            "valid_from": md.get("valid_from"),
            "valid_to": md.get("valid_to"),
            "historical": md.get("historical"),
            "source_status": md.get("source_status"),
            "canonical_item_id": md.get("canonical_item_id"),
            "content_hash": md.get("content_hash"),
            "collection_id": md.get("collection_id"),
            "country": md.get("country"),
            "county": md.get("county"),
            "jurisdiction_level": md.get("jurisdiction_level"),
            "municipality_name": md.get("municipality_name"),
            "municipality": md.get("municipality"),
            "issuer": md.get("issuer"),
            "act_title": md.get("act_title"),
            "act_reference": md.get("act_reference"),
            "chapter_number": md.get("chapter_number"),
            "chapter_title": md.get("chapter_title"),
            "paragraph_number": md.get("paragraph_number"),
            "paragraph_title": md.get("paragraph_title"),
            "subsection_number": md.get("subsection_number"),
            "point_number": md.get("point_number"),
            "chunk_level": md.get("chunk_level"),
            "canonical_source_id": md.get("canonical_source_id"),
            "canonical_chunk_id": md.get("canonical_chunk_id"),
            "source_format": md.get("source_format"),
            "municipality_id": md.get("municipality_id"),
            "district_name": md.get("district_name"),
            "district_id": md.get("district_id"),
            "source_keys": md.get("source_keys"),
            "source_urls": md.get("source_urls"),
            "source_register_file": md.get("source_register_file"),
            "source_count": md.get("source_count"),
            "administering_body": md.get("administering_body"),
            "tags": tags_val,
            "language": md.get("language"),
            "chunk": ch,
            "url": md.get("source_url"),
            "fileName": file_name,
            "source_type": md.get("source_type"),
            "page": md.get("page"),
            "distance": dists[i] if i < len(dists) else None,
        })

    dense_article_doc_ids = (
        _dense_article_anchor_doc_ids(payload.query, flat)
        if payload.journal_chunks_per_document > 3
        else []
    )
    lexical_t0 = time.perf_counter()
    lexical_fetch = (
        _fetch_lexical_candidates(
            payload.query,
            chroma_where,
            max(1, min(50, payload.top_k or 5)),
            requested_retrievers,
            dense_article_doc_ids=dense_article_doc_ids,
            version_registry=version_registry,
        )
        if lexical_requested
        else {"candidates": [], "scanned": 0, "complete": True, "error": None}
    )
    lexical_timings = dict(lexical_fetch.get("timings") or {})
    lexical_ms = int(lexical_timings.get("lexical_total_ms") or _ms_since(lexical_t0))
    _log_stage(
        "lexical",
        lexical_t0,
        "error" if lexical_fetch.get("error") else "partial" if not lexical_fetch.get("complete") else "ok",
        **{
            key: value
            for key, value in lexical_timings.items()
            if key.startswith("lexical_")
        },
        strategy=lexical_fetch.get("strategy") or "corpus_scan",
        complete=bool(lexical_fetch.get("complete")),
    )
    lexical_candidates = list(lexical_fetch.get("candidates") or [])
    sibling_t0 = time.perf_counter()
    try:
        sibling_candidates = _fetch_document_sibling_candidates(
            payload.query,
            chroma_where,
            flat,
            max(1, min(50, payload.top_k or 5)),
            requested_retrievers,
            max_documents=3 if payload.journal_chunks_per_document > 3 else 1,
            per_document=payload.journal_chunks_per_document,
        )
    except Exception:
        logger.exception("document sibling retrieval failed")
        sibling_candidates = []
    document_sibling_ms = _ms_since(sibling_t0)
    lexical_by_id: Dict[str, Dict[str, object]] = {}
    for candidate in [*lexical_candidates, *sibling_candidates]:
        item_id = str(candidate.get("id") or "").strip()
        if not item_id:
            continue
        existing = lexical_by_id.get(item_id)
        if existing is None or float(candidate.get("score") or 0) > float(existing.get("score") or 0):
            lexical_by_id[item_id] = candidate
    # The general lexical pass and document-sibling expansion each already have
    # their own bounded candidate pool. Do not collapse the merged pool back to
    # RAG_LEXICAL_TOP_K: that used to discard the question-relevant next chunk
    # of a document after the sibling pass had successfully found it.
    lexical_candidates = sorted(
        lexical_by_id.values(),
        key=lambda item: float(item.get("score") or 0),
        reverse=True,
    )[:50]
    flat_by_id = {str(item.get("id") or ""): item for item in flat if item.get("id")}
    for rank, candidate in enumerate(lexical_candidates, start=1):
        item_id = str(candidate.get("id") or "").strip()
        if not item_id:
            continue
        candidate_md = candidate.get("metadata") if isinstance(candidate.get("metadata"), dict) else {}
        if not is_active_document_version(candidate_md, version_registry):
            continue
        if is_general_search and not is_general_search_metadata_allowed(candidate_md):
            continue
        if not _metadata_matches_filter(candidate_md, chroma_where):
            continue
        if not _metadata_matches_current_version_requirement(candidate_md, require_current_version):
            continue
        channels = [str(item) for item in candidate.get("channels") or [] if str(item or "").strip()]
        if not channels:
            continue
        if item_id in flat_by_id:
            existing = flat_by_id[item_id]
            _append_channels(existing, channels)
            existing["lexical_score"] = candidate.get("score")
            existing["lexical_rank"] = rank
            for detail_key in [
                "bm25_score",
                "bm25_coverage",
                "bm25_matches",
                "bm25_title_matches",
                "bm25_body_matches",
                "bm25_named_entity_matches",
                "bm25_query_tokens",
            ]:
                if candidate.get(detail_key) is not None:
                    existing[detail_key] = candidate.get(detail_key)
            continue
        lexical_result = _search_result_from_metadata(
            item_id=item_id,
            document=str(candidate.get("document") or ""),
            md=candidate_md,
            distance=None,
            channels=channels,
            rank=rank,
            lexical_score=float(candidate.get("score") or 0),
            lexical_details=candidate,
        )
        lexical_result["lexical_rank"] = rank
        flat_by_id[item_id] = lexical_result
        flat.append(lexical_result)
    _apply_hybrid_ranking(flat)
    requested_top_k = max(1, min(50, int(payload.top_k or 5)))
    baseline_results = _select_diverse_search_results(
        flat,
        requested_top_k,
        journal_chunks_per_document=payload.journal_chunks_per_document,
    )
    fact_document_shortlist = (
        _select_fact_document_shortlist(
            payload.query,
            chroma_where,
            flat,
            max_documents=12,
        )
        if deep_document_fact_search
        else {
            "strategy": "disabled",
            "threshold": None,
            "doc_ids": [],
            "candidates": [],
        }
    )
    fact_segment_t0 = time.perf_counter()
    try:
        fact_segment_candidates = _fetch_fact_segment_candidates(
            segment_embeddings,
            fact_query_segments,
            chroma_where,
            flat,
            version_registry,
            is_general_search=is_general_search,
            per_document=payload.journal_chunks_per_document,
            document_ids=fact_document_shortlist.get("doc_ids") or [],
            max_documents=12,
        )
    except Exception:
        logger.exception("fact segment retrieval failed")
        fact_segment_candidates = []
    fact_segment_ms = _ms_since(fact_segment_t0)
    if fact_segment_candidates:
        _merge_fact_segment_candidates(flat, fact_segment_candidates)
        _apply_hybrid_ranking(flat)
    if require_current_version:
        flat = [
            item for item in flat
            if _metadata_matches_current_version_requirement(item, True)
        ]
    flat = _select_fact_covered_search_results(
        flat,
        baseline_results,
        requested_top_k,
        journal_chunks_per_document=payload.journal_chunks_per_document,
    )
    result_count = len(flat)
    retrievers_used: List[str] = []
    for item in flat:
        for channel in item.get("retrieval_channels") if isinstance(item.get("retrieval_channels"), list) else []:
            if channel and channel not in retrievers_used:
                retrievers_used.append(channel)
    if not retrievers_used:
        retrievers_used = (
            [channel for channel in requested_retrievers if channel != "dense"]
            if embedding_degraded
            else ["dense"]
        )
    _log_rag_cost_usage(
        model=embed_result.get("model"),
        latency_ms=embed_result.get("latency_ms"),
        prompt_tokens=_to_int(embed_result.get("prompt_tokens")),
        total_tokens=_to_int(embed_result.get("total_tokens")),
        embedding_input_count=int(embed_result.get("embedding_input_count") or 0),
        text_chars=_to_int(embed_result.get("text_chars")),
        chunk_count=1,
        result_count=result_count,
        cost_read_directly=bool(embed_result.get("cost_read_directly")),
        **observability,
    )

    groups_map: Dict[Tuple[str, str, str], Dict] = {}
    for r in flat:
        article_id = r.get("articleId") or ""
        doc_id = r.get("doc_id") or ""
        title_key = (r.get("title") or "").strip()
        key = (article_id, doc_id, title_key)
        g = groups_map.get(key)
        if not g:
            g = {
                "doc_id": doc_id or None,
                "docId": r.get("docId") or doc_id or None,
                "title": r.get("title"),
                "authors": r.get("authors"),
                "year": r.get("year"),
                "issue": r.get("issue"),
                "audience": r.get("audience"),
                "audiences": r.get("audiences"),
                "url": r.get("url"),
                "source_type": r.get("source_type"),
                "fileName": r.get("fileName"),
                "section": r.get("section"),
                "articleId": r.get("articleId"),
                "journalTitle": r.get("journalTitle"),
                "collection_id": r.get("collection_id"),
                "country": r.get("country"),
                "county": r.get("county"),
                "jurisdiction_level": r.get("jurisdiction_level"),
                "municipality_name": r.get("municipality_name"),
                "municipality_id": r.get("municipality_id"),
                "district_name": r.get("district_name"),
                "district_id": r.get("district_id"),
                "item_type": r.get("item_type"),
                "content_status": r.get("content_status"),
                "resource_type": r.get("resource_type"),
                "checked_at": r.get("checked_at"),
                "source_keys": r.get("source_keys"),
                "source_urls": r.get("source_urls"),
                "source_register_file": r.get("source_register_file"),
                "source_count": r.get("source_count"),
                "administering_body": r.get("administering_body"),
                "tags": r.get("tags"),
                "language": r.get("language"),
                "retrieval_channels": set(),
                "pages_all": [],
                "page_ranges": [],
                "items": [],
            }
            groups_map[key] = g
        if isinstance(r.get("page"), int):
            g["pages_all"].append(r["page"])
        if isinstance(r.get("pages"), list):
            for p in r["pages"]:
                if isinstance(p, int):
                    g["pages_all"].append(p)
        if isinstance(r.get("pageRange"), str) and r["pageRange"]:
            g["page_ranges"].append(r["pageRange"])
        if isinstance(r.get("tags"), list):
            if not isinstance(g.get("tags"), list):
                g["tags"] = []
            for t in r["tags"]:
                if t and t not in g["tags"]:
                    g["tags"].append(t)
        g["items"].append(r)
        if isinstance(r.get("retrieval_channels"), list):
            for channel in r["retrieval_channels"]:
                if channel:
                    g["retrieval_channels"].add(channel)

    def _collapse_pages_local(pages):
        s = sorted({p for p in pages if isinstance(p, int)})
        if not s:
            return ""
        out = []
        start = prev = None
        for p in s:
            if start is None:
                start = prev = p
                continue
            if p == prev + 1:
                prev = p
                continue
            out.append(f"{start}" if start == prev else f"{start}–{prev}")
            start = prev = p
        out.append(f"{start}" if start == prev else f"{start}–{prev}")
        return ", ".join(out)

    groups = []
    for g in groups_map.values():
        pages_compact = _collapse_pages_local(g["pages_all"]) or (", ".join(sorted(set(g["page_ranges"]))) if g["page_ranges"] else "")
        meta_for_ref = {
            "authors": g["authors"],
            "title": g["title"],
            "year": g["year"],
            "issue": g["issue"],
            "issue_id": g["issue"],
            "journal_title": g.get("journalTitle"),
        }
        short_ref = _make_short_ref(meta_for_ref, pages_compact)
        groups.append({
            "doc_id": g["doc_id"],
            "docId": g.get("docId"),
            "title": g["title"],
            "authors": g["authors"],
            "year": g["year"],
            "issue": g["issue"],
            "audience": g["audience"],
            "audiences": g.get("audiences"),
            "url": g["url"],
            "source_type": g["source_type"],
            "fileName": g["fileName"],
            "section": g["section"],
            "articleId": g["articleId"],
            "journalTitle": g["journalTitle"],
            "collection_id": g.get("collection_id"),
            "country": g.get("country"),
            "county": g.get("county"),
            "jurisdiction_level": g.get("jurisdiction_level"),
            "municipality_name": g.get("municipality_name"),
            "municipality_id": g.get("municipality_id"),
            "district_name": g.get("district_name"),
            "district_id": g.get("district_id"),
            "item_type": g.get("item_type"),
            "content_status": g.get("content_status"),
            "resource_type": g.get("resource_type"),
            "checked_at": g.get("checked_at"),
            "source_keys": g.get("source_keys"),
            "source_urls": g.get("source_urls"),
            "source_register_file": g.get("source_register_file"),
            "source_count": g.get("source_count"),
            "administering_body": g.get("administering_body"),
            "retrieval_channels": sorted(list(g.get("retrieval_channels") or [])),
            "tags": g.get("tags"),
            "language": g.get("language"),
            "pages": pages_compact,
            "short_ref": short_ref,
            "count": len(g["items"]),
            "items": g["items"],
        })

    groups.sort(key=lambda x: (-x["count"], x["title"] or ""))
    retrieval_ms = _ms_since(retrieval_t0)
    total_ms = _ms_since(stage_t0)
    final_outcome = "degraded_embedding" if embedding_degraded else "ok"
    _log_stage("retrieval", retrieval_t0, "ok")
    _log_stage("search_total", stage_t0, final_outcome)
    return {
        "results": flat,
        "groups": groups,
        "retrievers_used": retrievers_used,
        "search_strategy": (
            "lexical_fallback"
            if embedding_degraded
            else ("hybrid" if any(channel != "dense" for channel in retrievers_used) else "dense")
        ),
        "merge_strategy": _build_hybrid_merge_strategy(requested_retrievers),
        "channel_stats": _build_channel_stats(flat),
        "partial": (
            embedding_degraded
            or not bool(lexical_fetch.get("complete"))
            or bool(lexical_fetch.get("error"))
        ),
        "degraded": embedding_degraded or bool(lexical_fetch.get("error")),
        "dense_retrieval": {
            "available": not embedding_degraded,
            "error": embedding_error_code,
        },
        "lexical_scan": {
            "scanned": int(lexical_fetch.get("scanned") or 0),
            "complete": bool(lexical_fetch.get("complete")),
            "exhaustive": bool(lexical_fetch.get("exhaustive")),
            "strategy": lexical_fetch.get("strategy") or "corpus_scan",
            "error": lexical_fetch.get("error"),
            "index": lexical_fetch.get("index"),
        },
        "strategy_decisions": {
            "requested_top_k": requested_top_k,
            "dense_candidate_limit": _dense_candidate_limit(payload.top_k or 5),
            "dense_candidate_count": len(ids),
            "journal_chunks_per_document": payload.journal_chunks_per_document,
            "deep_document_fact_search": deep_document_fact_search,
            "fact_query_mode": (
                "split_segments"
                if split_fact_query_segments
                else "full_query_fallback"
                if reuse_primary_fact_embedding
                else "disabled"
            ),
            "fact_query_segment_count": len(fact_query_segments),
            "dense_article_anchor_document_count": len(dense_article_doc_ids),
            "sibling_max_documents": 3 if deep_document_fact_search else 1,
            "sibling_candidate_count": len(sibling_candidates),
            "fact_segment_max_documents": 12 if deep_document_fact_search else 0,
            "fact_document_shortlist": fact_document_shortlist,
            "fact_segment_candidate_count": len(fact_segment_candidates),
            "current_version_post_filter": require_current_version,
            "lexical_strategy": lexical_fetch.get("strategy") or "corpus_scan",
        },
        "request_id": stage_request_id,
        "timings": {
            "embedding_ms": embedding_ms,
            "dense_ms": dense_ms,
            "registry_ms": registry_ms,
            "lexical_ms": lexical_ms,
            **lexical_timings,
            "document_sibling_ms": document_sibling_ms,
            "fact_segment_ms": fact_segment_ms,
            "retrieval_ms": retrieval_ms,
            "total_ms": total_ms,
            "outcome": final_outcome,
        },
    }


@app.post("/search", dependencies=[Depends(_require_key)])
def search(payload: SearchIn, request: Request):
    return _execute_search(payload, request, agent_document_ids=None)


@app.post("/search/agent-documents", dependencies=[Depends(_require_key)])
def search_agent_documents(payload: AgentDocumentSearchIn, request: Request):
    exact_payload = SearchIn(
        query=payload.query,
        top_k=payload.top_k,
        include=payload.include,
        retrievers=payload.retrievers,
        request_id=payload.request_id,
    )
    return _execute_search(exact_payload, request, agent_document_ids=payload.doc_ids)
