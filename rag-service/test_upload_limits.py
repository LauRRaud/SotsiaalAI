"""SOL-CHAT-09 — sisendipiiride ühiktestid (puhtad, ilma fastapi/chroma sõltuvusteta).

    python -m unittest rag-service/test_upload_limits.py  (või otse: python test_upload_limits.py)

Iga test mõõdab ÜHT rada, mille kaudu vana kood lasi kasutajal parserit valida või vastust
paisutada. Negatiivkontrollid on kirjas nimeliselt: lubatud sisend PEAB läbi minema, muidu
tõendaks „kõik lükatakse tagasi" sama hästi.
"""

import io
import unittest
import zipfile

from upload_limits import (
    DOCX_MIME,
    PDF_MIME,
    clamp_pages,
    clamp_text,
    is_docx_container,
    mime_conflict,
    sniff_mime,
    zip_expansion_guard,
)


def make_zip(entries, compresslevel=9):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED, compresslevel=compresslevel) as archive:
        for name, data in entries:
            archive.writestr(name, data)
    return buf.getvalue()


# --- sniff_mime: sisu, mitte deklaratsioon --------------------------------------

def test_sniff_recognises_pdf_zip_html_and_text():
    assert sniff_mime(b"%PDF-1.7\n...") == PDF_MIME
    assert sniff_mime(make_zip([("a.txt", "x")])) == "application/zip"
    assert sniff_mime(b"<!DOCTYPE html><html><body>tere") == "text/html"
    assert sniff_mime("Tavaline tekst õäöü".encode("utf-8")) == "text/plain"


def test_sniff_returns_none_for_unknown_binary():
    # NUL-baidid = binaarne; tundmatu sisu ei tohi ühtegi deklaratsiooni kinnitada.
    assert sniff_mime(b"\x89PNG\r\n\x1a\n\x00\x00\x00") is None
    assert sniff_mime(b"") is None


# --- mime_conflict: fail-closed ------------------------------------------------

def test_declared_text_but_content_is_a_container_is_rejected():
    """SEE OLI RÜNNAK: „ütlen text/plain, saadan ZIP-pommi"."""
    zip_bytes = make_zip([("bomb.txt", "0" * 100_000)])
    assert mime_conflict("text/plain", zip_bytes) == "declared_text_but_content_is_a_container"
    assert mime_conflict("text/markdown", b"%PDF-1.7 ...") == "declared_text_but_content_is_a_container"


def test_declared_pdf_must_actually_be_pdf():
    assert mime_conflict(PDF_MIME, b"%PDF-1.4 x") is None
    assert mime_conflict(PDF_MIME, b"lihtne tekst") == "declared_pdf_but_content_is_not_pdf"


def test_declared_docx_must_be_a_word_container():
    docx = make_zip([("[Content_Types].xml", "<x/>"), ("word/document.xml", "<w/>")])
    assert is_docx_container(docx) is True
    assert mime_conflict(DOCX_MIME, docx) is None

    plain_zip = make_zip([("a.txt", "x")])
    assert mime_conflict(DOCX_MIME, plain_zip) == "zip_is_not_a_word_document"
    assert mime_conflict(DOCX_MIME, b"tekst") == "declared_docx_but_content_is_not_zip"


def test_unknown_content_does_not_confirm_a_text_declaration():
    assert mime_conflict("text/plain", b"\x00\x01\x02binaar") == "declared_text_but_content_is_binary"


def test_negative_control_allowed_inputs_still_pass():
    """Ilma selleta tõendaks „lükka kõik tagasi" sama hästi kui õige kontroll."""
    assert mime_conflict("text/plain", "Tere, see on tekst.".encode("utf-8")) is None
    assert mime_conflict("text/html", b"<html><body>tere</body></html>") is None
    assert mime_conflict(PDF_MIME, b"%PDF-1.7\ntrailer") is None


# --- zip_expansion_guard: ZIP-pomm --------------------------------------------

def test_zip_bomb_is_rejected_by_ratio_before_extraction():
    # Väga hästi tihenev sisu: väike arhiiv, tohutu lahtipakitud maht.
    bomb = make_zip([("bomb.txt", "0" * (50 * 1024 * 1024))])
    ok, reason, total = zip_expansion_guard(bomb)
    assert ok is False
    assert reason in ("zip_compression_ratio_exceeded", "zip_uncompressed_size_exceeded")
    assert total > 0


def test_ordinary_docx_passes_the_guard():
    docx = make_zip([("[Content_Types].xml", "<x/>"), ("word/document.xml", "<w/>" + "tekst " * 1000)])
    ok, reason, _total = zip_expansion_guard(docx)
    assert ok is True, reason


def test_unreadable_zip_is_rejected_not_ignored():
    ok, reason, _total = zip_expansion_guard(b"PK\x03\x04 aga mitte zip")
    assert ok is False
    assert reason == "unreadable_zip"


# --- kärped --------------------------------------------------------------------

def test_clamp_text_reports_truncation():
    text, truncated = clamp_text("x" * 100, limit=10)
    assert (len(text), truncated) == (10, True)
    text, truncated = clamp_text("lühike", limit=10)
    assert (text, truncated) == ("lühike", False)


def test_clamp_pages_reports_truncation():
    pages = [(i, f"lk {i}") for i in range(1, 11)]
    kept, truncated = clamp_pages(pages, limit=3)
    assert (len(kept), truncated) == (3, True)
    kept, truncated = clamp_pages(pages, limit=50)
    assert (len(kept), truncated) == (10, False)


class UploadLimitsTest(unittest.TestCase):
    """Kõik ülalolevad `test_*` funktsioonid ühe unittest-katuse all, et sviit jookseks
    ilma pytest-i sõltuvuseta (nagu `test_storage_paths.py`)."""


def _attach_function_tests():
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            setattr(UploadLimitsTest, name, (lambda f: lambda self: f())(fn))


_attach_function_tests()


if __name__ == "__main__":
    unittest.main()
