"""RAG-hoidla teede piir (SOL-RAGSVC-01 ja -02, mõlemad P0).

Kaks leidu, üks viga: kliendi tekst kasutati failiteena ilma tõendamata, et ta
jääb hoidlasse. Testid on siin peaaegu kõik NEGATIIVSED — nad küsivad, mis EI
tohi õnnestuda. Positiivne rada on kõrval, sest muidu läheks „keela kõik" ka
testist läbi ja teenus ei salvestaks enam ühtegi faili.
"""

import os
import tempfile
import unittest
from pathlib import Path

from storage_paths import (
    PathOutsideStorage,
    doc_file_path,
    is_within,
    resolve_within,
    safe_basename,
)


class SafeBasenameTests(unittest.TestCase):
    def test_absolute_and_traversal_paths_lose_everything_but_the_name(self):
        # `/ingest/file` andis just neid väärtusi muutmata `d / file_name`-le.
        self.assertEqual(safe_basename("/etc/cron.d/evil"), "evil.pdf")
        self.assertEqual(safe_basename("../../../../etc/passwd"), "passwd.pdf")
        self.assertEqual(safe_basename("dir/sub/report.pdf"), "report.pdf")

    def test_windows_separators_are_stripped_too(self):
        # POSIX-il EI OLE `\` kataloogieraldaja, seega `Path(...).name` jätab ta
        # alles — ja Windowsi peal oleks see päris väljapääs kataloogist.
        self.assertEqual(safe_basename(r"..\..\windows\system32\evil.dll"), "evil.dll")
        self.assertEqual(safe_basename(r"C:\Users\x\report.pdf"), "report.pdf")

    def test_pure_dot_names_and_empties_fall_back(self):
        for value in ["", "   ", ".", "..", "...", "/", "\\", None]:
            self.assertEqual(safe_basename(value, "fallback.md"), "fallback.md", repr(value))

    def test_ntfs_stream_and_drive_colon_are_neutralised(self):
        self.assertEqual(safe_basename("report.pdf:hidden"), "report.pdf_hidden")

    def test_ordinary_names_survive_unchanged(self):
        self.assertEqual(safe_basename("Sotsiaaltöö 2026-01.pdf"), "Sotsiaaltöö 2026-01.pdf")
        self.assertEqual(safe_basename(".env", "source.md"), ".env")


class ContainmentTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name).resolve() / "storage"
        (self.root / "docs" / "abc").mkdir(parents=True)
        self.addCleanup(self._tmp.cleanup)

    def test_inside_paths_pass(self):
        inside = self.root / "docs" / "abc" / "report.pdf"
        self.assertTrue(is_within(self.root, inside))
        self.assertEqual(resolve_within(self.root, inside), inside.resolve())

    def test_traversal_out_of_the_root_is_refused(self):
        outside = self.root / "docs" / ".." / ".." / "secret.env"
        self.assertFalse(is_within(self.root, outside))
        with self.assertRaises(PathOutsideStorage):
            resolve_within(self.root, outside)

    def test_sibling_directory_with_shared_prefix_is_not_inside(self):
        # Stringi-prefiksiga võrdlus („startswith") ütleks siin JAH ja see
        # oleks auk: `/…/storage-evil` ei ole `/…/storage` sees.
        sibling = self.root.parent / (self.root.name + "-evil") / "x.txt"
        self.assertFalse(is_within(self.root, sibling))

    def test_absolute_outside_path_is_refused(self):
        with self.assertRaises(PathOutsideStorage):
            resolve_within(self.root, Path(tempfile.gettempdir()).resolve() / "passwd")

    def test_empty_path_is_refused_not_silently_root(self):
        # Tühi string annaks `Path("")` == `Path(".")` ehk töökausta — vaikne
        # ja vale JAH.
        for value in ["", "   ", None]:
            with self.assertRaises(PathOutsideStorage):
                resolve_within(self.root, value)

    @unittest.skipUnless(hasattr(os, "symlink"), "symlinks not supported")
    def test_symlink_escaping_the_root_is_refused(self):
        outside_dir = Path(self._tmp.name).resolve() / "outside"
        outside_dir.mkdir()
        (outside_dir / "secret.env").write_text("KEY=1", encoding="utf-8")
        link = self.root / "docs" / "escape"
        try:
            os.symlink(outside_dir, link, target_is_directory=True)
        except (OSError, NotImplementedError) as exc:  # Windows ilma arendajarežiimita
            self.skipTest(f"symlink not permitted: {exc}")
        self.assertFalse(is_within(self.root, link / "secret.env"))
        with self.assertRaises(PathOutsideStorage):
            resolve_within(self.root, link / "secret.env")


class DocFilePathTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name).resolve() / "storage"
        self.doc_dir = self.root / "docs" / "abc"
        self.doc_dir.mkdir(parents=True)
        self.addCleanup(self._tmp.cleanup)

    def test_ordinary_upload_lands_in_the_document_directory(self):
        target = doc_file_path(self.doc_dir, "report.pdf", storage_root=self.root)
        self.assertEqual(target, (self.doc_dir / "report.pdf").resolve())

    def test_absolute_file_name_cannot_escape_the_document_directory(self):
        # SEE ON LEID ISE: `Path("/srv/storage/docs/abc") / "/etc/cron.d/x"`
        # annab Pythonis `/etc/cron.d/x` — vasak pool visatakse ära.
        target = doc_file_path(self.doc_dir, "/etc/cron.d/evil", storage_root=self.root)
        self.assertEqual(target.parent, self.doc_dir.resolve())
        self.assertTrue(is_within(self.root, target))

    def test_traversal_file_name_cannot_escape_the_document_directory(self):
        target = doc_file_path(self.doc_dir, "../../../../etc/passwd", storage_root=self.root)
        self.assertEqual(target.parent, self.doc_dir.resolve())

    def test_document_directory_outside_the_root_is_refused(self):
        with self.assertRaises(PathOutsideStorage):
            doc_file_path(Path(self._tmp.name) / "mujal", "report.pdf", storage_root=self.root)


if __name__ == "__main__":
    unittest.main()
