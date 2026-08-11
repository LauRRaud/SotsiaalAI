"""Efemeerse analüüsi sisendipiirid (SOL-CHAT-09).

MIKS SEE FAIL OLEMAS ON. `/analyze` usaldas DEKLAREERITUD MIME-tüüpi: `_detect_mime()`
tagastas `declared` väärtuse kohe ja libmagic'ut kutsuti ainult siis, kui deklaratsioon
puudus. Tellimusega kasutaja sai seega ise valida, MILLINE PARSER tema baite näeb —
ja parseritel ei olnud ühtegi ülempiiri:

  * DOCX läks `docx2txt.process()` kaudu lahtipakkimisele ilma tihendatud suhte,
    lahtipakitud mahu ega kirjete arvu piirita (ZIP-pomm);
  * PDF-il ei olnud lehe- ega tähemärgilage;
  * `/analyze` piiras chunk'ide arvu, aga tagastas `fullText: raw_text` **täiesti
    kärpimata** — 25 MB sisendist võis saada kümnetesse megabaitidesse paisuv vastus,
    mille Node loeb esmalt üheks stringiks ja klient hoiab React-i olekus.

KAKS ERI KÜSIMUST, MIDA SIIN EI SEGATA:

  `sniff_mime()`     — „mis see fail SISU JÄRGI on";
  `mime_conflict()`  — „kas deklaratsioon ja sisu räägivad sama juttu".

Ainult teine üksi ei aita: kui sisu ei tuvastata, ei tohi vaikimisi uskuda deklaratsiooni.

ERALDI MOODUL, MITTE ABIFUNKTSIOON `main.py`-s — samal põhjusel mis `storage_paths.py`
ja `search_security.py`: `main.py` impordib fastapi, chromadb ja openai, seega teda ei saa
ühiktestis laadida. Piir, mida ei saa testida, ei ole piir.

AUS PIIR, mida see moodul EI lahenda: siin ei ole parseri protsessitasemel timeout'i.
Sisendipiirid tõkestavad VÕIMENDUSE (väike fail → tohutu töö), mis on tegelik
ründevektor; päris „tapa parser N sekundi pärast" nõuab eraldi tööprotsessi ja on
omaette töö. Vt SOL-CHAT-09 Seis-lõiku raportis.
"""

from __future__ import annotations

import os
import zipfile
from io import BytesIO
from typing import Optional, Tuple

PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
TEXT_MIMES = frozenset({"text/plain", "text/markdown", "text/html"})


def _read_positive_int(name: str, fallback: int) -> int:
    try:
        value = int(str(os.environ.get(name, "")).strip())
    except (TypeError, ValueError):
        return fallback
    return value if value > 0 else fallback


# Lahtipakitud kogumaht ühe DOCX-i kohta.
ZIP_MAX_TOTAL_UNCOMPRESSED = _read_positive_int("ANALYZE_ZIP_MAX_UNCOMPRESSED_BYTES", 200 * 1024 * 1024)
# Suhe kogu arhiivi peale: 100 korda on juba helde, ZIP-pommid algavad tuhandetest.
ZIP_MAX_RATIO = _read_positive_int("ANALYZE_ZIP_MAX_RATIO", 100)
ZIP_MAX_ENTRIES = _read_positive_int("ANALYZE_ZIP_MAX_ENTRIES", 2000)
PDF_MAX_PAGES = _read_positive_int("ANALYZE_PDF_MAX_PAGES", 1500)
# Absoluutne ekstraktitud tähemärkide lagi — see on see, mis vastuse suuruse lõpuks otsustab.
TEXT_MAX_CHARS = _read_positive_int("ANALYZE_MAX_EXTRACTED_CHARS", 2_000_000)
# Kliendile tagastatava `fullText` lagi. Väiksem kui ekstraktimise lagi: chunk'id kannavad sisu.
RESPONSE_MAX_FULL_TEXT_CHARS = _read_positive_int("ANALYZE_RESPONSE_MAX_CHARS", 400_000)


def sniff_mime(head: bytes, filename: str = "") -> Optional[str]:
    """Tuvasta tüüp SISU järgi. `None` = ei tea (ja siis ei tohi deklaratsiooni uskuda)."""
    if not head:
        return None
    if head.startswith(b"%PDF-"):
        return PDF_MIME
    # OOXML on ZIP; kas ta on DOCX, otsustab kirjete nimekiri, mitte allkiri.
    if head.startswith(b"PK\x03\x04") or head.startswith(b"PK\x05\x06") or head.startswith(b"PK\x07\x08"):
        return "application/zip"
    sample = head[:4096]
    if b"\x00" in sample:
        return None  # binaarne, aga mitte ükski meile lubatud tüüp
    try:
        text = sample.decode("utf-8")
    except UnicodeDecodeError:
        return None
    lowered = text.lstrip().lower()
    if lowered.startswith("<!doctype html") or lowered.startswith("<html") or "<body" in lowered[:2048]:
        return "text/html"
    return "text/plain"


def is_docx_container(data: bytes) -> bool:
    """DOCX = ZIP, milles on Wordi dokumendi osa. Loeb ainult kataloogi, ei paki lahti."""
    try:
        with zipfile.ZipFile(BytesIO(data)) as archive:
            names = set(archive.namelist())
    except (zipfile.BadZipFile, OSError, ValueError):
        return False
    return "word/document.xml" in names


def mime_conflict(declared: str, data: bytes, filename: str = "") -> Optional[str]:
    """
    Tagasta konflikti PÕHJUS või `None`, kui deklaratsioon ja sisu on kooskõlas.

    Reegel on fail-closed: tundmatu sisu EI kinnita ühtegi deklaratsiooni.
    """
    declared = str(declared or "").strip().lower()
    if not declared:
        return "missing_declared_mime"
    sniffed = sniff_mime(data[:8192], filename)

    if declared == PDF_MIME:
        return None if sniffed == PDF_MIME else "declared_pdf_but_content_is_not_pdf"

    if declared == DOCX_MIME:
        if sniffed != "application/zip":
            return "declared_docx_but_content_is_not_zip"
        return None if is_docx_container(data) else "zip_is_not_a_word_document"

    if declared in TEXT_MIMES:
        if sniffed is None:
            return "declared_text_but_content_is_binary"
        if sniffed in ("application/zip", PDF_MIME):
            # Just see rada oli rünnak: „ütlen text/plain, saadan ZIP-pommi".
            return "declared_text_but_content_is_a_container"
        return None

    return "unsupported_declared_mime"


def zip_expansion_guard(data: bytes) -> Tuple[bool, Optional[str], int]:
    """
    Kontrolli ZIP-i KATALOOGI (mitte sisu) enne lahtipakkimist.

    @returns `(ok, reason, total_uncompressed)`
    """
    try:
        with zipfile.ZipFile(BytesIO(data)) as archive:
            infos = archive.infolist()
    except (zipfile.BadZipFile, OSError, ValueError):
        return False, "unreadable_zip", 0

    if len(infos) > ZIP_MAX_ENTRIES:
        return False, "too_many_zip_entries", 0

    total = 0
    for info in infos:
        size = int(getattr(info, "file_size", 0) or 0)
        if size < 0:
            return False, "invalid_zip_entry_size", 0
        total += size
        if total > ZIP_MAX_TOTAL_UNCOMPRESSED:
            return False, "zip_uncompressed_size_exceeded", total

    compressed = max(1, len(data))
    if total > compressed * ZIP_MAX_RATIO:
        return False, "zip_compression_ratio_exceeded", total

    return True, None, total


def clamp_text(text: str, limit: int = TEXT_MAX_CHARS) -> Tuple[str, bool]:
    """Absoluutne tähemärgilagi. `(tekst, kärbitud)`."""
    value = text or ""
    if limit <= 0 or len(value) <= limit:
        return value, False
    return value[:limit], True


def clamp_pages(pages, limit: int = PDF_MAX_PAGES):
    """PDF lehepiir. `(lehed, kärbitud)` — lehtede loend, mitte tekst."""
    items = list(pages or [])
    if limit <= 0 or len(items) <= limit:
        return items, False
    return items[:limit], True
