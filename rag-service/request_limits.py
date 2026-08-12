"""Hard request and ingest budgets for the RAG service."""

from __future__ import annotations

import json
import os
import tempfile
from typing import Iterable


class RequestBodyTooLarge(ValueError):
    code = "RAG_REQUEST_TOO_LARGE"


async def read_upload_bytes_bounded(upload, max_bytes: int, *, chunk_size: int = 64 * 1024) -> bytes:
    """Spool an upload to disk with a counter before exposing bounded bytes to parsers."""
    limit = max(1, int(max_bytes))
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(prefix="rag-upload-", suffix=".tmp", delete=False) as handle:
            temp_path = handle.name
            total = 0
            while True:
                part = await upload.read(chunk_size)
                if not part:
                    break
                total += len(part)
                if total > limit:
                    raise RequestBodyTooLarge("file_byte_limit")
                handle.write(part)
            handle.flush()
            os.fsync(handle.fileno())
        with open(temp_path, "rb") as handle:
            return handle.read()
    finally:
        if temp_path:
            try:
                os.unlink(temp_path)
            except FileNotFoundError:
                pass


def _headers(scope) -> dict[bytes, bytes]:
    return {bytes(key).lower(): bytes(value) for key, value in scope.get("headers", [])}


class BodySizeLimitMiddleware:
    """Count ASGI body bytes; Content-Length is only an early rejection hint."""

    def __init__(self, app, max_bytes: int):
        self.app = app
        self.max_bytes = max(1, int(max_bytes))

    async def _reject(self, send):
        payload = json.dumps({"detail": {"code": RequestBodyTooLarge.code}}).encode("utf-8")
        await send({
            "type": "http.response.start",
            "status": 413,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(payload)).encode("ascii")),
                (b"cache-control", b"no-store"),
            ],
        })
        await send({"type": "http.response.body", "body": payload})

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            return await self.app(scope, receive, send)

        raw_length = _headers(scope).get(b"content-length")
        if raw_length:
            try:
                if int(raw_length) > self.max_bytes:
                    return await self._reject(send)
            except (TypeError, ValueError):
                pass

        consumed = 0
        response_started = False

        async def limited_receive():
            nonlocal consumed
            message = await receive()
            if message.get("type") == "http.request":
                consumed += len(message.get("body") or b"")
                if consumed > self.max_bytes:
                    raise RequestBodyTooLarge()
            return message

        async def tracked_send(message):
            nonlocal response_started
            if message.get("type") == "http.response.start":
                response_started = True
            await send(message)

        try:
            return await self.app(scope, limited_receive, tracked_send)
        except RequestBodyTooLarge:
            if response_started:
                raise
            return await self._reject(send)


def validate_ingest_budget(
    *,
    text: str,
    chunks: Iterable[str],
    max_text_chars: int,
    max_chunks: int,
    max_chunk_chars: int,
) -> None:
    chunk_values = list(chunks or [])
    text_length = len(str(text or ""))
    chunk_length = sum(len(str(chunk or "")) for chunk in chunk_values)
    if text_length > max_text_chars or chunk_length > max_text_chars:
        raise RequestBodyTooLarge("text_char_limit")
    if len(chunk_values) > max_chunks:
        raise RequestBodyTooLarge("chunk_count_limit")
    if any(len(str(chunk or "")) > max_chunk_chars for chunk in chunk_values):
        raise RequestBodyTooLarge("chunk_char_limit")
