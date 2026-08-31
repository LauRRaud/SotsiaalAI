const fold = value => String(value || "").normalize("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase();

const SOURCE_CUE_RE = /\b(?:artikl|uuring|aruan|raport|dokument|article|study|report)\p{L}*/u;
const SUBSTANTIVE_REQUEST_CUE_RE = /(?:^|[^\p{L}\p{N}])(?:mida|mis|millis\p{L}*|millin\p{L}*|kuidas|millal|kelle|kes|kus|what|which|how|when|whose|who|where|какой|какая|какие|как|когда|чей|чья|чьи|кто|где)(?![\p{L}\p{N}])/u;

export function bibliographicTitleSpans(value = "") {
  const text = String(value || "");
  return Array.from(text.matchAll(/[„“"][^„“”"\r\n]{3,200}[”"]/gu))
    .filter(match => SOURCE_CUE_RE.test(fold(text.slice(Math.max(0, match.index - 80), match.index))))
    .map(match => ({
      start: Number(match.index),
      end: Number(match.index) + String(match[0] || "").length,
      role: "quoted_source_title"
    }));
}

// A bibliographic relative clause narrows the source; it does not ask a second
// factual question. Keep the rule deliberately narrow so that an explicit
// coordinated question such as "ja mida artiklis võrreldakse?" remains a cue.
export function isBibliographicSourceModifierCue(value = "", match = null) {
  const text = String(value || "");
  const start = Number(match?.index);
  const cue = String(match?.[0] || "");
  if (!Number.isInteger(start) || !/^mida$/iu.test(cue) || !/,\s*$/u.test(text.slice(0, start))) return false;
  if (!SUBSTANTIVE_REQUEST_CUE_RE.test(fold(text.slice(0, start)))) return false;
  const tail = fold(text.slice(start));
  if (!/^mida\s+vorreldakse\b/u.test(tail)) return false;
  const boundary = tail.search(/[?!;]/u);
  const clause = boundary >= 0 ? tail.slice(0, boundary) : tail;
  return SOURCE_CUE_RE.test(clause);
}

export function bibliographicSourceModifierSpans(value = "", matches = []) {
  return (Array.isArray(matches) ? matches : [])
    .filter(match => isBibliographicSourceModifierCue(value, match))
    .map(match => ({
      start: Number(match.index),
      end: Number(match.index) + String(match[0] || "").length,
      role: "bibliographic_source_modifier"
    }));
}
