from __future__ import annotations

from copy import deepcopy
import os
from typing import Dict, Iterable, List, Optional


AGENT_DOCUMENT_SOURCE_TYPE = "agent_document"
AGENT_DOCUMENT_COLLECTION_ID = str(os.getenv("AGENT_RAG_COLLECTION_ID", "agent_documents")).strip() or "agent_documents"
PROTECTED_AGENT_DOCUMENT_COLLECTION_IDS = tuple(
    dict.fromkeys(["agent_documents", AGENT_DOCUMENT_COLLECTION_ID])
)
_PROTECTED_AGENT_DOCUMENT_COLLECTION_IDS_NORMALIZED = {
    collection_id.lower() for collection_id in PROTECTED_AGENT_DOCUMENT_COLLECTION_IDS
}


def _clean_doc_ids(values: Iterable[object]) -> List[str]:
    cleaned: List[str] = []
    seen = set()
    for value in values:
        doc_id = str(value or "").strip()
        if not doc_id or doc_id in seen:
            continue
        seen.add(doc_id)
        cleaned.append(doc_id)
    return cleaned


def build_general_search_where(client_where: Optional[Dict[str, object]]) -> Dict[str, object]:
    """Add the immutable private-document deny boundary to a general RAG search."""
    clauses: List[Dict[str, object]] = []
    if isinstance(client_where, dict) and client_where:
        clauses.append(deepcopy(client_where))
    clauses.append({"source_type": {"$ne": AGENT_DOCUMENT_SOURCE_TYPE}})
    clauses.extend(
        {"collection_id": {"$ne": collection_id}}
        for collection_id in PROTECTED_AGENT_DOCUMENT_COLLECTION_IDS
    )
    return {"$and": clauses}


def build_agent_document_search_where(doc_ids: Iterable[object]) -> Dict[str, object]:
    """Build the only allowed private-document search: exact server-owned document ids."""
    cleaned_doc_ids = _clean_doc_ids(doc_ids)
    if not cleaned_doc_ids:
        raise ValueError("at least one agent document id is required")
    return {
        "$and": [
            {"doc_id": {"$in": cleaned_doc_ids}},
            {"source_type": AGENT_DOCUMENT_SOURCE_TYPE},
            {"collection_id": AGENT_DOCUMENT_COLLECTION_ID},
        ]
    }


def is_private_agent_document_metadata(metadata: object) -> bool:
    if not isinstance(metadata, dict):
        return True
    source_type = str(metadata.get("source_type") or "").strip().lower()
    collection_id = str(metadata.get("collection_id") or "").strip().lower()
    return (
        source_type == AGENT_DOCUMENT_SOURCE_TYPE
        or collection_id in _PROTECTED_AGENT_DOCUMENT_COLLECTION_IDS_NORMALIZED
    )


def is_general_search_metadata_allowed(metadata: object) -> bool:
    """Defense in depth for dense, BM25, hybrid and fallback result assembly."""
    return not is_private_agent_document_metadata(metadata)
