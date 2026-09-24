"""Local NDJSON morphology worker. No HTTP, LLM, source storage or query planning.

Reuses the useful part of the retired EstonianLemmaAnalyzer: preserve surface
forms and bounded ambiguous analyses. Both documents and queries use this path.
"""

import contextlib
import importlib.metadata
import json
import re
import sys
import unicodedata

VERSION = "estnltk-vabamorf-1.7.5-rag-v2-1"
MAX_TEXTS = 96
MAX_TEXT_CHARS = 50000
MAX_BATCH_CHARS = 200000
MAX_LINE_BYTES = 1500000
WORD = re.compile(r"[^\W\d_]+(?:-[^\W\d_]+)*", re.UNICODE)
ANALYZER = None


def analyze(texts):
    global ANALYZER
    if not isinstance(texts, list) or not 1 <= len(texts) <= MAX_TEXTS:
        raise ValueError("morphology_input_limit")
    if any(not isinstance(text, str) or len(text) > MAX_TEXT_CHARS for text in texts):
        raise ValueError("morphology_input_limit")
    if sum(len(text) for text in texts) > MAX_BATCH_CHARS:
        raise ValueError("morphology_input_limit")
    if ANALYZER is None:
        try:
            versions = [importlib.metadata.version(name) for name in ("estnltk", "estnltk-core")]
            if versions != ["1.7.5", "1.7.5"]:
                raise ValueError("morphology_version_mismatch")
            from estnltk.vabamorf.morf import Vabamorf
            ANALYZER = Vabamorf.instance()
        except importlib.metadata.PackageNotFoundError:
            raise ValueError("morphology_unavailable") from None
    output = []
    for text in texts:
        # Case is meaningful for names. Normalize case only AFTER analysis.
        words = WORD.findall(unicodedata.normalize("NFC", text))
        terms = set()
        # Bound native calls without truncating any text. No disambiguation
        # across fields or unrelated chunks; ambiguity is retrieval evidence.
        for offset in range(0, len(words), 2048):
            batch = words[offset:offset + 2048]
            rows = ANALYZER.analyze(batch, disambiguate=False, guess=True,
                                    propername=True, compound=True, phonetic=False, stem=False)
            if len(rows) != len(batch):
                raise ValueError("morphology_analysis_failed")
            for surface, row in zip(batch, rows):
                candidates = [surface]
                for alternative in row.get("analysis", [])[:8]:
                    candidates.append(alternative.get("lemma", ""))
                    candidates.extend(alternative.get("root_tokens", [])[:16])
                for candidate in candidates:
                    token = unicodedata.normalize("NFC", str(candidate)).lower()
                    # Python's \w also accepts non-decimal numerals such as "²" in "m²"; the
                    # protocol carries letters, marks and hyphens only. Such a token used to
                    # fail the whole batch, so no previously successful output changes.
                    if WORD.fullmatch(token) and all(char == "-" or unicodedata.category(char)[0] in "LM" for char in token):
                        terms.add("vmet" + token)
        output.append(" ".join(sorted(terms)))
    return output


def main():
    for line in iter(lambda: sys.stdin.buffer.readline(MAX_LINE_BYTES + 1), b""):
        if len(line) > MAX_LINE_BYTES or not line.endswith(b"\n"):
            return 1
        request_id = None
        try:
            request = json.loads(line.decode("utf-8"))
            request_id = request.get("id")
            if not isinstance(request_id, int) or request.get("version") != VERSION:
                raise ValueError("morphology_protocol_error")
            # Imported libraries may print diagnostics. Never mix them into
            # protocol output or expose source/query text in a traceback.
            with contextlib.redirect_stdout(sys.stderr):
                texts = analyze(request.get("texts"))
            result = {"id": request_id, "version": VERSION, "texts": texts}
        except Exception as error:
            allowed = {"morphology_input_limit", "morphology_version_mismatch",
                       "morphology_unavailable", "morphology_protocol_error"}
            code = str(error) if isinstance(error, ValueError) and str(error) in allowed else "morphology_analysis_failed"
            result = {"id": request_id, "version": VERSION, "error": code}
        sys.stdout.buffer.write((json.dumps(result, ensure_ascii=False) + "\n").encode("utf-8"))
        sys.stdout.buffer.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
