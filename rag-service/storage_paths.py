"""RAG-hoidla teede piir (SOL-RAGSVC-01 ja -02, mõlemad P0).

MIKS SEE FAIL OLEMAS ON. Kaks eri leidu, üks ja seesama viga: kliendi antud
tekst kasutati FAILITEENA ilma tõendamata, et ta jääb hoidlasse.

  * `/ingest/file` ja `/upload` moodustasid tee avaldisega `raw_path = d / file_name`.
    Pythoni `/` operaator EI OLE liitmine: absoluutne parem pool VISKAB VASAKU
    ÄRA (`Path("/a") / "/etc/passwd"` == `Path("/etc/passwd")`), ja `..` väljub
    kaustast. See andis suvalise kirjutatava serverifaili ülekirjutamise.
  * `/ingest/text` salvestas kliendi `metadata.source_path` registri `path`
    väljale ja `GET /documents/{id}/source` avas selle `FileResponse`-ina —
    suvalise loetava serverifaili lugemine.

ERALDI MOODUL, MITTE ABIFUNKTSIOON `main.py`-s — samal põhjusel, mis
`search_security.py`: `main.py` impordib fastapi, chromadb ja openai, seega teda
ei saa ühiktestis laadida. Piir, mida ei saa testida, ei ole piir.

KAKS FUNKTSIOONI, KAKS ERI KÜSIMUST:

  `safe_basename()` — „mis on selle faili NIMI" (kirjutamisel);
  `resolve_within()` — „kas see tee on MEIE OMA" (kirjutamisel JA lugemisel).

Ainult esimesest ei piisa. Basename kaitseb selle eest, mida klient just
saatis; containment kaitseb ka selle eest, mis on registrisse juba varem
sattunud — ja registris ON vanu ridu, mille `path` osutab hoidlast välja.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Union

__all__ = ["PathOutsideStorage", "safe_basename", "is_within", "resolve_within", "doc_file_path"]


class PathOutsideStorage(ValueError):
    """Tee jääks hoidlast välja. Kutsuja teeb sellest 400 või 404."""

    def __init__(self, candidate: object, base: object) -> None:
        super().__init__(f"path escapes storage root: {candidate!r} not under {base!r}")
        self.candidate = str(candidate)
        self.base = str(base)


def safe_basename(name: object, fallback: str = "document.pdf") -> str:
    """Kliendi failinimest jääb ainult NIMI.

    `Path(...).name` viskab ära nii kataloogid kui absoluutse juure. Windowsi
    eraldaja `\\` ei ole POSIX-il kataloogieraldaja, seega ta EI kao `.name`-ga
    ja tuleb eraldi maha võtta — muidu jõuab `..\\..\\evil.py` failinimena läbi
    ja Windowsi peal ka päriselt kataloogist välja.
    """
    raw = str(name or "")
    # Kõik eraldajad ühtlustatakse ENNE `.name` võtmist: nii ei sõltu tulemus
    # sellest, millisel platvormil teenus jookseb.
    unified = raw.replace("\\", "/")
    base = Path(unified).name
    if not base or base in {".", ".."}:
        base = fallback
    # Koolon on Windowsil kettatähise eraldaja (`C:evil`) ja NTFS-i
    # alternatiivvoo eraldaja (`file.txt:hidden`).
    base = re.sub(r"[\\/:]+", "_", base).strip()
    # Juhtiv punkt üksi ei ole viga (`.env` on failinimi), aga puhas punktijada
    # on — temast ei jää pärast eraldajate eemaldamist midagi mõistlikku.
    if not base or set(base) == {"."}:
        base = fallback
    if "." not in base and "." in fallback:
        base = f"{base}{Path(fallback).suffix}"
    return base


def is_within(base: Union[str, Path], candidate: Union[str, Path]) -> bool:
    """Kas `candidate` on `base` sees (sümlingid lahendatud)?

    `resolve()` lahendab nii `..` kui sümlingid ka siis, kui faili ei ole veel
    olemas. Võrdlus käib `Path`-i osadega, MITTE stringi prefiksiga:
    `"/srv/storage-evil".startswith("/srv/storage")` on tõene ja see oleks auk.
    """
    try:
        base_resolved = Path(base).resolve()
        candidate_resolved = Path(candidate).resolve()
    except (OSError, RuntimeError):
        # Sümlingi silmus või liiga pikk tee: vastus on „ei", mitte erind.
        return False
    if candidate_resolved == base_resolved:
        return True
    return base_resolved in candidate_resolved.parents


def resolve_within(base: Union[str, Path], candidate: Union[str, Path]) -> Path:
    """Sama kontroll, aga tagastab lahendatud tee või viskab.

    :raises PathOutsideStorage: kui tee jääks hoidlast välja.
    """
    if not str(candidate or "").strip():
        raise PathOutsideStorage(candidate, base)
    if not is_within(base, candidate):
        raise PathOutsideStorage(candidate, base)
    return Path(candidate).resolve()


def doc_file_path(
    doc_dir: Union[str, Path],
    file_name: object,
    fallback: str = "document.pdf",
    storage_root: Union[str, Path, None] = None,
) -> Path:
    """Kuhu see üleslaaditud fail kirjutatakse.

    KAKS VÄRAVAT JÄRJEST, meelega: basename võtab nime kliendi teest välja ja
    containment tõendab tulemuse. Teine ei ole esimese pärast üleliigne —
    `doc_dir` ise võib olla sümling ja tema taga võib olla mis tahes koht.
    """
    safe = safe_basename(file_name, fallback)
    target = Path(doc_dir) / safe
    root = storage_root if storage_root is not None else doc_dir
    return resolve_within(root, target)
