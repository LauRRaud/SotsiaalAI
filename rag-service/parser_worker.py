"""Document parsers isolated in a killable, resource-limited child process."""

from __future__ import annotations

import multiprocessing
import os
import tempfile
import time
from dataclasses import dataclass
from io import BytesIO


class ParserRejected(ValueError):
    pass


@dataclass(frozen=True)
class ParserLimits:
    max_pdf_pages: int = 1500
    max_pdf_objects: int = 250_000
    timeout_seconds: float = 30.0
    max_memory_bytes: int = 512 * 1024 * 1024
    max_cpu_seconds: int = 20


def ensure_pdf_limits(page_count: int, object_count: int, limits: ParserLimits) -> None:
    if page_count > limits.max_pdf_pages:
        raise ParserRejected("pdf_page_limit")
    if object_count > limits.max_pdf_objects:
        raise ParserRejected("pdf_object_limit")


def _apply_process_limits(limits: ParserLimits) -> None:
    if os.name == "nt":
        return
    try:
        import resource

        resource.setrlimit(resource.RLIMIT_AS, (limits.max_memory_bytes, limits.max_memory_bytes))
        resource.setrlimit(resource.RLIMIT_CPU, (limits.max_cpu_seconds, limits.max_cpu_seconds))
    except (ImportError, OSError, ValueError):
        # The parent timeout remains mandatory on platforms/containers that deny rlimits.
        pass


def _pdf_object_count(reader) -> int:
    xref = getattr(reader, "xref", {}) or {}
    return sum(len(section) for section in xref.values() if isinstance(section, dict))


def _parse(kind: str, raw: bytes, limits: ParserLimits):
    if kind == "pdf":
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(raw))
        ensure_pdf_limits(len(reader.pages), _pdf_object_count(reader), limits)
        return [(index, page.extract_text() or "") for index, page in enumerate(reader.pages, start=1)]
    if kind == "docx":
        import docx2txt

        path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as handle:
                path = handle.name
                handle.write(raw)
            return docx2txt.process(path) or ""
        finally:
            if path:
                try:
                    os.unlink(path)
                except FileNotFoundError:
                    pass
    if kind == "html":
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(raw.decode("utf-8", errors="ignore"), "html.parser")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        return " ".join(soup.get_text(separator=" ").split())
    if kind == "test_sleep":
        time.sleep(float(raw.decode("ascii")))
        return "ok"
    raise ParserRejected("unsupported_parser")


def _worker(connection, kind: str, raw: bytes, limits: ParserLimits) -> None:
    try:
        _apply_process_limits(limits)
        connection.send((True, _parse(kind, raw, limits)))
    except BaseException as exc:
        connection.send((False, f"{type(exc).__name__}:{exc}"))
    finally:
        connection.close()


def _run(kind: str, raw: bytes, limits: ParserLimits):
    context = multiprocessing.get_context("spawn")
    parent, child = context.Pipe(duplex=False)
    process = context.Process(target=_worker, args=(child, kind, raw, limits), daemon=True)
    process.start()
    child.close()
    try:
        if not parent.poll(limits.timeout_seconds):
            process.terminate()
            process.join(timeout=1)
            raise ParserRejected("parser_timeout")
        ok, result = parent.recv()
        process.join(timeout=1)
        if not ok:
            raise ParserRejected(f"parser_rejected:{result}")
        return result
    finally:
        parent.close()
        if process.is_alive():
            process.terminate()
            process.join(timeout=1)


def parse_document(kind: str, raw: bytes, limits: ParserLimits | None = None):
    return _run(kind, raw, limits or ParserLimits())


def run_test_sleep(seconds: float, *, timeout_seconds: float):
    return _run("test_sleep", str(seconds).encode("ascii"), ParserLimits(timeout_seconds=timeout_seconds))
