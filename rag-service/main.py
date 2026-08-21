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
RAG_BM25_MIN_COVERAGE = float(os.getenv("RAG_BM25_MIN_COVERAGE", "0.35"))
RAG_BM25_TITLE_WEIGHT = float(os.getenv("RAG_BM25_TITLE_WEIGHT", "1.8"))
RAG_BM25_BODY_WEIGHT = float(os.getenv("RAG_BM25_BODY_WEIGHT", "1.0"))
RAG_BM25_TITLE_K = float(os.getenv("RAG_BM25_TITLE_K", "0.8"))
RAG_BM25_BODY_K = float(os.getenv("RAG_BM25_BODY_K", "1.5"))
RAG_RRF_K = int(os.getenv("RAG_RRF_K", "60"))
HYBRID_CHANNEL_WEIGHTS = {
    "dense": 1.0,
    "title_match": 1.35,
    "exact_phrase": 1.15,
    "bm25": 1.0,
}
HYBRID_CHANNEL_BOOSTS = {
    "title_match": 0.09,
    "exact_phrase": 0.06,
    "bm25": 0.05,
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

# OpenAI client
oa = OpenAI(api_key=OPENAI_API_KEY)
logger = logging.getLogger("rag-service")
# B0b: stage events use Uvicorn's existing error logger tree so its handler
# and INFO level carry the records to stderr/journald without touching root
# logging or the application logger used by warnings and errors.
stage_logger = logging.getLogger("uvicorn.error.rag_stage")
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
        candidates = [window.rfind(". "), window.rfind("! "), window.rfind("? "), window.rfind("\n\n")]
        best = max(candidates)
        if best != -1 and best > len(window) * 0.5:
            cut = best + 1
        chunk = _clean_text(window[:cut])
        if chunk:
            chunks.append(chunk)
        if end >= n:
            break
        # Advance from the actual sentence cut, not the nominal window end.
        next_start = start + cut - max(0, overlap)
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
    toks = enc.encode(cleaned)
    if not toks:
        return []
    chunks: List[str] = []
    step = max(1, max_tokens - max(0, overlap_tokens))
    for start in range(0, len(toks), step):
        end = min(len(toks), start + max_tokens)
        piece = toks[start:end]
        if not piece:
            continue
        chunk = enc.decode(piece)
        chunk = _clean_text(chunk)
        if chunk:
            chunks.append(chunk)
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

    # PREFIKS – lisame chunk’i teksti ette (autor/pealkiri/jne saavad embeddingusse)
    prefix_lines: List[str] = []
    if title:         prefix_lines.append(f"[TITLE] {title}")
    if description:   prefix_lines.append(f"[DESC] {description}")
    if authors:       prefix_lines.append(f"[AUTHORS] {', '.join(authors)}")
    if journal_title: prefix_lines.append(f"[JOURNAL] {journal_title}")
    if issue_label:   prefix_lines.append(f"[ISSUE] {issue_label}")
    elif issue_id:    prefix_lines.append(f"[ISSUE] {issue_id}")
    if section:       prefix_lines.append(f"[SECTION] {section}")
    if year:          prefix_lines.append(f"[YEAR] {year}")
    if item_type:     prefix_lines.append(f"[ITEM_TYPE] {item_type}")
    if status_label:   prefix_lines.append(f"[STATUS] {status_label}")
    if resource_type: prefix_lines.append(f"[RESOURCE_TYPE] {resource_type}")
    if administering_body: prefix_lines.append(f"[ADMIN_BODY] {administering_body}")
    if county:        prefix_lines.append(f"[COUNTY] {county}")
    if municipality_name: prefix_lines.append(f"[MUNICIPALITY] {municipality_name}")
    if page_range:    prefix_lines.append(f"[PAGES] {page_range}")
    prefix = ("\n".join(prefix_lines) + "\n") if prefix_lines else ""

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

    final_texts = []
    for i, ch in enumerate(chunks):
        section_meta = _section_for_page(section_index, page_nums[i] if i < len(page_nums) else None)
        section_title = str(section_meta.get("title") or "").strip() if section_meta else ""
        section_prefix = prefix
        if section_title and section_title != section:
            section_prefix = f"{section_prefix}[PDF_SECTION] {section_title}\n"
        final_texts.append((section_prefix + ch).strip() if section_prefix else ch)

    # STABIILNE ID: doc_id + jrk + 8-kohaline hash chunkist
    ids = []
    for i, txt in enumerate(final_texts):
        h = hashlib.sha1(txt.encode("utf-8")).hexdigest()[:8]
        ids.append(f"{doc_id}:{i}:{h}")

    metadatas = []
    for i, _ in enumerate(final_texts):
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

def _commit_vector_stage(stage, entry: Dict):
    result = stage.commit(entry, updated_at=now_iso())
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
        if len(token) < 3 or token in LEXICAL_STOPWORDS or token in seen:
            continue
        seen.add(token)
        out.append(token)
        if len(out) >= limit:
            break
    return out

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
        if len(cleaned) < 3 or cleaned in LEXICAL_STOPWORDS:
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
    return sum(
        int(frequency or 0)
        for token, frequency in counts.items()
        if len(token) >= 9 and token[:8] == stem
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

def _lexical_match(query: str, md: Dict, document: str) -> Optional[Dict[str, object]]:
    title_norm = _normalize_search_text(md.get("title") or md.get("fileName") or md.get("source_url") or "")
    paragraph_title_norm = _normalize_search_text(md.get("paragraph_title") or "")
    section_norm = _normalize_search_text(md.get("section") or "")
    act_title_norm = _normalize_search_text(md.get("act_title") or "")
    body_norm = _normalize_search_text(document[:12000])
    if not title_norm and not body_norm:
        return None

    phrases = _query_phrases(query)
    query_tokens = _search_tokens(query)
    named_entity_tokens = _query_named_entity_tokens(query)
    paragraph_refs = _extract_query_paragraph_refs(query)
    paragraph_number = _normalize_search_text(md.get("paragraph_number") or "")
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

    full_query = phrases[0] if phrases else _normalize_search_text(query)
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
        if title_overlap >= max(1, min(3, len(query_tokens))):
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
        ):
            score += min(5.0, bm25_score)
            if bm25_named_entity_matches:
                score += min(3.5, 2.5 + 0.5 * bm25_named_entity_matches)
            if "bm25" not in channels:
                channels.append("bm25")

    if score < 3.0 or not channels:
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
    return out or ["dense", "title_match", "exact_phrase", "bm25"]

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
        dense_rank = _to_int(item.get("dense_rank") or item.get("retrieval_rank"))
        lexical_rank = _to_int(item.get("lexical_rank"))
        dense_score = _hybrid_dense_score(item.get("distance")) if "dense" in channels else 0.0
        lexical_score = _hybrid_lexical_score(item.get("lexical_score")) if any(
            channel in channels for channel in ["title_match", "exact_phrase", "bm25"]
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
        hybrid_score = (
            (dense_score * 0.58)
            + (lexical_score * 0.34)
            + (rrf_score * 8.0)
            + channel_boost
            + bm25_coverage_boost
            + named_entity_boost
        )
        item["dense_score"] = round(dense_score, 6) if dense_score else None
        item["lexical_score_normalized"] = round(lexical_score, 6) if lexical_score else None
        item["rrf_score"] = round(rrf_score, 6)
        item["channel_boost"] = round(channel_boost, 6)
        item["bm25_coverage_boost"] = round(bm25_coverage_boost, 6)
        item["named_entity_boost"] = round(named_entity_boost, 6)
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
            "hybrid_score": item.get("hybrid_score"),
            "dense_rank": dense_rank,
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
    journal_counts: Dict[str, int] = {}
    target = max(1, int(limit or 1))
    per_document = max(1, int(journal_chunks_per_document or 1))

    for item in results:
        source_type = str(item.get("source_type") or item.get("legacy_source_type") or "").strip().lower()
        if source_type in {"journal_article", "article"}:
            document_key = str(
                item.get("doc_id")
                or item.get("docId")
                or item.get("document_id")
                or item.get("documentId")
                or item.get("articleId")
                or ""
            ).strip()
            if document_key:
                current = journal_counts.get(document_key, 0)
                if current >= per_document:
                    continue
                journal_counts[document_key] = current + 1
        selected.append(item)
        if len(selected) >= target:
            break

    return selected

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
        has_lexical = any(channel in channel_set for channel in ["title_match", "exact_phrase", "bm25"])
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

def _score_lexical_rows(
    query: str,
    allowed_channels: set,
    ids: List[object],
    documents: List[object],
    metadatas: List[object],
) -> List[Dict[str, object]]:
    scored: List[Dict[str, object]] = []
    for i, item_id in enumerate(ids):
        document = documents[i] if i < len(documents) and isinstance(documents[i], str) else ""
        md = metadatas[i] if i < len(metadatas) and isinstance(metadatas[i], dict) else {}
        match = _lexical_match(query, md, document)
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
    scored.sort(key=lambda item: float(item.get("score") or 0), reverse=True)
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

def _registry_title_shortlist_doc_ids(
    query: str,
    chroma_where: Optional[Dict[str, object]],
    limit: int = 20,
) -> List[str]:
    query_tokens = set(_search_tokens(query))
    if len(query_tokens) < 2:
        return []
    matches: List[tuple] = []
    for doc_id, metadata in _load_registry().items():
        if not isinstance(metadata, dict) or not _metadata_matches_filter(metadata, chroma_where):
            continue
        title_tokens = set(_search_tokens(metadata.get("title") or metadata.get("fileName"), limit=80))
        overlap = len(query_tokens.intersection(title_tokens))
        coverage = overlap / max(1, len(query_tokens))
        if overlap < 2 or coverage < 0.6:
            continue
        matches.append((coverage, overlap, str(doc_id)))
    matches.sort(key=lambda item: (-item[0], -item[1], item[2]))
    return [doc_id for _coverage, _overlap, doc_id in matches[:max(1, limit)]]

def _targeted_document_terms(query: str, limit: int = 8) -> List[str]:
    words = re.findall(r"[^\W_]+", str(query or ""), flags=re.UNICODE)
    ranked: List[tuple] = []
    seen = set()
    for index, raw_word in enumerate(words):
        normalized = _normalize_search_text(raw_word)
        if len(normalized) < 6 or normalized in LEXICAL_STOPWORDS:
            continue
        is_named = index > 0 and raw_word[:1].isupper()
        if len(normalized) < 9 and not is_named:
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
            priority = 4 if is_named else 3 if len(normalized) >= 12 else 2 if len(normalized) >= 9 else 1
            ranked.append((priority, len(normalized), -index, variant))
    ranked.sort(key=lambda item: (-item[0], -item[1], -item[2], item[3].casefold()))
    return [item[3] for item in ranked[:max(1, limit)]]

def _targeted_document_shortlist(
    query: str,
    chroma_where: Optional[Dict[str, object]],
    top_k: int,
) -> Dict[str, object]:
    ids: List[object] = []
    documents: List[object] = []
    metadatas: List[object] = []
    seen = set()
    scanned = 0
    per_term_limit = max(40, min(240, max(1, top_k) * 6))
    terms = _targeted_document_terms(query)
    for term in terms:
        kwargs = {
            "include": ["documents", "metadatas"],
            "limit": per_term_limit,
            "where_document": {"$contains": term},
        }
        if chroma_where:
            kwargs["where"] = chroma_where
        got = collection.get(**kwargs)
        got_ids = list(got.get("ids") or [])
        got_documents = list(got.get("documents") or [])
        got_metadatas = list(got.get("metadatas") or [])
        scanned += len(got_ids)
        for index, item_id in enumerate(got_ids):
            key = str(item_id or "")
            if not key or key in seen:
                continue
            seen.add(key)
            ids.append(item_id)
            documents.append(got_documents[index] if index < len(got_documents) else "")
            metadatas.append(got_metadatas[index] if index < len(got_metadatas) else {})
    return {
        "ids": ids,
        "documents": documents,
        "metadatas": metadatas,
        "scanned": scanned,
        "terms": terms,
    }

def _fetch_lexical_candidates(
    query: str,
    chroma_where: Optional[Dict[str, object]],
    top_k: int,
    requested_retrievers: Optional[List[str]] = None,
) -> Dict[str, object]:
    if not RAG_LEXICAL_SEARCH_ENABLED or not str(query or "").strip():
        return {"candidates": [], "scanned": 0, "complete": True, "error": None}
    allowed_channels = set(requested_retrievers or ["title_match", "exact_phrase", "bm25"])
    page_size = max(1, min(5000, RAG_LEXICAL_SCAN_LIMIT))
    max_scan = max(page_size, RAG_LEXICAL_MAX_SCAN)
    shortlist_ids: List[object] = []
    shortlist_docs: List[object] = []
    shortlist_metas: List[object] = []
    shortlist_seen = set()
    shortlist_scanned = 0
    targeted_used = False

    try:
        title_doc_ids = _registry_title_shortlist_doc_ids(query, chroma_where)
    except Exception:
        title_doc_ids = []
    try:
        targeted = _targeted_document_shortlist(query, chroma_where, top_k)
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
            shortlist = collection.get(
                include=["documents", "metadatas"],
                limit=min(5000, max(100, top_k * 8)),
                where=shortlist_where,
            )
            title_ids = list(shortlist.get("ids") or [])
            title_docs = list(shortlist.get("documents") or [])
            title_metas = list(shortlist.get("metadatas") or [])
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
                query,
                allowed_channels,
                shortlist_ids,
                shortlist_docs,
                shortlist_metas,
            )
            if shortlist_scored:
                shortlist_limit = max(0, min(max(1, top_k), RAG_LEXICAL_TOP_K))
                return {
                    "candidates": _select_lexical_candidates(shortlist_scored, shortlist_limit),
                    "scanned": shortlist_scanned,
                    "complete": False,
                    "error": None,
                    "strategy": "targeted_document_shortlist" if targeted_used else "registry_title_shortlist",
                }
        except Exception:
            logger.exception("registry title shortlist retrieval failed")
    elif shortlist_ids:
        shortlist_scored = _score_lexical_rows(
            query,
            allowed_channels,
            shortlist_ids,
            shortlist_docs,
            shortlist_metas,
        )
        if shortlist_scored:
            shortlist_limit = max(0, min(max(1, top_k), RAG_LEXICAL_TOP_K))
            return {
                "candidates": _select_lexical_candidates(shortlist_scored, shortlist_limit),
                "scanned": shortlist_scanned,
                "complete": False,
                "error": None,
                "strategy": "targeted_document_shortlist",
            }
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
            got = collection.get(**kwargs)
            page_ids = list(got.get("ids") or [])
            page_docs = list(got.get("documents") or [])
            page_metas = list(got.get("metadatas") or [])
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
        return {
            "candidates": [],
            "scanned": len(all_ids),
            "complete": False,
            "error": f"{type(exc).__name__}",
        }

    scored = _score_lexical_rows(query, allowed_channels, all_ids, all_docs, all_metas)
    limit = max(0, min(max(1, top_k), RAG_LEXICAL_TOP_K))
    return {
        "candidates": _select_lexical_candidates(scored, limit),
        "scanned": len(all_ids),
        "complete": complete,
        "error": None,
    }

def _fetch_article_sibling_candidates(
    query: str,
    chroma_where: Optional[Dict[str, object]],
    dense_results: List[Dict[str, object]],
    top_k: int,
    requested_retrievers: Optional[List[str]] = None,
) -> List[Dict[str, object]]:
    if not RAG_LEXICAL_SEARCH_ENABLED:
        return []
    allowed_channels = set(requested_retrievers or ["title_match", "exact_phrase", "bm25"])
    if not allowed_channels.intersection({"title_match", "exact_phrase", "bm25"}):
        return []
    doc_ids: List[str] = []
    for result in dense_results:
        doc_id = str(result.get("doc_id") or result.get("docId") or "").strip()
        article_id = str(result.get("articleId") or result.get("article_id") or "").strip()
        source_type = str(result.get("source_type") or "").strip().lower()
        if not doc_id or (not article_id and source_type not in {"journal_article", "article"}):
            continue
        if doc_id not in doc_ids:
            doc_ids.append(doc_id)
        if len(doc_ids) >= 1:
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
    )
    limit = max(0, min(max(1, top_k), RAG_LEXICAL_TOP_K))
    return scored[:limit]

# --------------------
# Routes
# --------------------
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
    }

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

@app.post("/documents/{doc_id}/reindex", dependencies=[Depends(_require_key), Depends(_require_registry_available)])
def reindex(doc_id: str):
    reg = _load_registry()
    entry = reg.get(doc_id)
    if not entry:
        raise HTTPException(404, "Document not in registry")

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
            "title": entry.get("title"),
            "description": entry.get("description"),
            "authors": entry.get("authors"),
            "issue_id": entry.get("issueId") or entry.get("issue_id"),
            "issue_label": entry.get("issueLabel") or entry.get("issue_label"),
            "year": entry.get("year"),
            "article_id": entry.get("articleId") or entry.get("article_id"),
            "section": entry.get("section"),
            "pages": entry.get("pages"),
            "pageRange": entry.get("pageRange"),
            "journal_title": entry.get("journalTitle"),
            "journalTitle": entry.get("journalTitle"),
            "tags": entry.get("tags"),
            "language": entry.get("language") or "et",
            "source_type": "file",
            "source_path": entry.get("path"),
            "mimeType": mime,
            "audience": normalize_audience(entry.get("audience")),
            "collection_id": entry.get("collection_id"),
            "country": entry.get("country"),
            "jurisdiction_level": entry.get("jurisdiction_level"),
            "municipality_name": entry.get("municipality_name"),
            "municipality_id": entry.get("municipality_id"),
            "district_name": entry.get("district_name"),
            "district_id": entry.get("district_id"),
            "geo_detection_method": entry.get("geo_detection_method"),
            "geo_detection_confidence": entry.get("geo_detection_confidence"),
        })
        entry["lastIngested"] = now_iso()
        result = _commit_vector_stage(stage, entry)
        return {"ok": True, "inserted": result.count, "doc": entry}

    if entry.get("type") == "URL":
        html_path = _storage_path_or_404(entry.get("path"), "URL snapshot")
        html = html_path.read_text(encoding="utf-8")
        text = _extract_text_from_html(html)
        stage = _replace_document_vectors(doc_id, text, meta_common={
            "title": entry.get("title"),
            "description": entry.get("description"),
            "authors": entry.get("authors"),
            "issue_id": entry.get("issueId") or entry.get("issue_id"),
            "issue_label": entry.get("issueLabel") or entry.get("issue_label"),
            "year": entry.get("year"),
            "article_id": entry.get("articleId") or entry.get("article_id"),
            "section": entry.get("section"),
            "pages": entry.get("pages"),
            "pageRange": entry.get("pageRange"),
            "journal_title": entry.get("journalTitle"),
            "journalTitle": entry.get("journalTitle"),
            "tags": entry.get("tags"),
            "language": entry.get("language") or "et",
            "source_type": "url",
            "source_url": entry.get("url"),
            "source_path": entry.get("path"),
            "mimeType": "text/html",
            "audience": normalize_audience(entry.get("audience")),
            "collection_id": entry.get("collection_id"),
            "country": entry.get("country"),
            "jurisdiction_level": entry.get("jurisdiction_level"),
            "municipality_name": entry.get("municipality_name"),
            "municipality_id": entry.get("municipality_id"),
            "district_name": entry.get("district_name"),
            "district_id": entry.get("district_id"),
            "geo_detection_method": entry.get("geo_detection_method"),
            "geo_detection_confidence": entry.get("geo_detection_confidence"),
        })
        entry["lastIngested"] = now_iso()
        result = _commit_vector_stage(stage, entry)
        return {"ok": True, "inserted": result.count, "doc": entry}

    if entry.get("type") == "TEXT":
        text_path = _storage_path_or_404(entry.get("path"), "text source")
        if not text_path.exists():
            raise HTTPException(404, "Stored text source is missing")
        text = text_path.read_text(encoding="utf-8")
        stage = _replace_document_vectors(doc_id, text, meta_common=dict(entry))
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
    chunks_updated = patch_document_metadata_consistently(
        collection,
        REGISTRY_STORE,
        STORAGE_DIR / ".document-locks",
        doc_id,
        updates,
        updated_at=now_iso(),
        clear_fields=clear_fields,
    )

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

    result = delete_document_versioned(
        collection,
        REGISTRY_STORE,
        STORAGE_DIR / ".document-locks",
        doc_id,
        updated_at=now_iso(),
        delete_source=delete_source,
    )
    return {"ok": True, "deleted": doc_id, "hadEntry": result.had_entry}

def _execute_search(
    payload: SearchIn,
    request: Request,
    *,
    agent_document_ids: Optional[List[str]] = None,
):
    is_general_search = agent_document_ids is None
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

    embed_t0 = time.perf_counter()
    try:
        embed_result = _embed_batch_with_usage([payload.query])
    except Exception as e:
        _log_stage("embedding", embed_t0, "error", error_class=e.__class__.__name__)
        _log_stage("search_total", stage_t0, "error")
        raise
    embedding_ms = _ms_since(embed_t0)
    q_embeds = list(embed_result.get("embeddings") or [])
    _log_stage(
        "embedding",
        embed_t0,
        "ok" if q_embeds else "empty",
        provider_latency_ms=_to_int(embed_result.get("latency_ms")),
    )
    if not q_embeds:
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
    q_emb = q_embeds[0]
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

    try:
        include_items = list(payload.include or ["documents", "metadatas", "distances"])
        if "metadatas" not in include_items:
            include_items.append("metadatas")

        res = collection.query(
            query_embeddings=[q_emb],
            n_results=_dense_candidate_limit(payload.top_k or 5),
            where=chroma_where,
            include=include_items,
        )
    except Exception as e:
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
    version_registry = _load_registry()

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

    lexical_fetch = (
        _fetch_lexical_candidates(
            payload.query,
            chroma_where,
            max(1, min(50, payload.top_k or 5)),
            requested_retrievers,
        )
        if any(channel in requested_retrievers for channel in ["title_match", "exact_phrase", "bm25"])
        else {"candidates": [], "scanned": 0, "complete": True, "error": None}
    )
    lexical_candidates = list(lexical_fetch.get("candidates") or [])
    try:
        sibling_candidates = _fetch_article_sibling_candidates(
            payload.query,
            chroma_where,
            flat,
            max(1, min(50, payload.top_k or 5)),
            requested_retrievers,
        )
    except Exception:
        logger.exception("article sibling retrieval failed")
        sibling_candidates = []
    lexical_by_id: Dict[str, Dict[str, object]] = {}
    for candidate in [*lexical_candidates, *sibling_candidates]:
        item_id = str(candidate.get("id") or "").strip()
        if not item_id:
            continue
        existing = lexical_by_id.get(item_id)
        if existing is None or float(candidate.get("score") or 0) > float(existing.get("score") or 0):
            lexical_by_id[item_id] = candidate
    lexical_candidates = sorted(
        lexical_by_id.values(),
        key=lambda item: float(item.get("score") or 0),
        reverse=True,
    )[:max(1, min(50, RAG_LEXICAL_TOP_K))]
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
    flat = _select_diverse_search_results(flat, requested_top_k)
    result_count = len(flat)
    retrievers_used: List[str] = []
    for item in flat:
        for channel in item.get("retrieval_channels") if isinstance(item.get("retrieval_channels"), list) else []:
            if channel and channel not in retrievers_used:
                retrievers_used.append(channel)
    if not retrievers_used:
        retrievers_used = ["dense"]
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
    _log_stage("retrieval", retrieval_t0, "ok")
    _log_stage("search_total", stage_t0, "ok")
    return {
        "results": flat,
        "groups": groups,
        "retrievers_used": retrievers_used,
        "search_strategy": "hybrid" if any(channel != "dense" for channel in retrievers_used) else "dense",
        "merge_strategy": _build_hybrid_merge_strategy(requested_retrievers),
        "channel_stats": _build_channel_stats(flat),
        "partial": not bool(lexical_fetch.get("complete")) or bool(lexical_fetch.get("error")),
        "degraded": bool(lexical_fetch.get("error")),
        "lexical_scan": {
            "scanned": int(lexical_fetch.get("scanned") or 0),
            "complete": bool(lexical_fetch.get("complete")),
            "error": lexical_fetch.get("error"),
        },
        "request_id": stage_request_id,
        "timings": {
            "embedding_ms": embedding_ms,
            "retrieval_ms": retrieval_ms,
            "total_ms": total_ms,
            "outcome": "ok",
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
