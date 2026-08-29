import { normalizeSemanticText } from "./semanticTurnContract.js";

const ORGANIZATION_ROOT_RE = /(?:amet|haigla|instituut|keskus|koda|kolledz|kolledž|komisjon|ministeerium|osakond|sihtasutus|ulikool|ülikool|valitsus|uhing|ühing)(?:$|\p{Letter}*)/u;
const MUNICIPALITY_ROOT_RE = /(?:^|\s|[-–])(?:linn|linna|vald|valla|omavalitsus|omavalitsuse)(?:$|\s)/u;
const GENERIC_SINGLE_ENTITY_RE = /^(?:kes|mis|mida|millest|kuidas|millal|kus|kust|miks|kas|milline|millised|eesti|eestis)$/u;

function cleanEntityCandidate(value = "") {
  return String(value || "")
    .replace(/^[^\p{Letter}\p{Number}]+|[^\p{Letter}\p{Number}'’ -]+$/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanPersonCandidate(value = "") {
  return cleanEntityCandidate(value);
}

export function isLikelyPersonCandidate(value = "") {
  const candidate = cleanPersonCandidate(value);
  const words = candidate.split(/\s+/u).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  const excluded = new Set([
    "sa", "te", "tema", "mina", "sotsiaalai", "chatgpt", "openai",
    "ta on", "tema on", "minu kontakt", "lapse eestkostja",
    "sotsiaalne tootaja", "sotsiaaltootaja", "teenuse saaja"
  ]);
  const normalized = normalizeSemanticText(candidate);
  if (excluded.has(normalized) || ORGANIZATION_ROOT_RE.test(normalized) || MUNICIPALITY_ROOT_RE.test(normalized)) return false;
  if (/^(kes|mis|mida|millest|kuidas|millal|kus|kust|miks|kas|milline|millised)\b/u.test(normalized)) return false;
  if (/\b(sotsiaaltoo|artikkel|artiklid|artikleid|autorlus)\b/u.test(normalized)) return false;
  return words.every(word => /^[\p{Letter}][\p{Letter}'’-]{1,}$/u.test(word));
}

function morphologySpans(morphology = null) {
  return (Array.isArray(morphology?.proper_name_spans) ? morphology.proper_name_spans : [])
    .map(span => ({
      surface: cleanEntityCandidate(typeof span === "string" ? span : span?.text),
      canonical: cleanEntityCandidate(typeof span === "string" ? span : span?.canonical_text || span?.text),
      start: Number.isInteger(Number(span?.start)) ? Number(span.start) : null,
      end: Number.isInteger(Number(span?.end)) ? Number(span.end) : null,
      provenance: "morphology"
    }))
    .filter(span => span.canonical);
}

function surfaceSpans(message = "") {
  const text = String(message || "");
  const capitalized = Array.from(text.matchAll(
    /(?<![\p{Letter}\p{Number}])(?:\p{Lu}[\p{Letter}'’-]+|[\p{Lu}\d][\p{Lu}\d-]{1,})(?:\s+(?:\p{Lu}[\p{Letter}'’-]+|[\p{Lu}\d][\p{Lu}\d-]{1,})){0,3}(?![\p{Letter}\p{Number}])/gu
  )).map(match => ({
    surface: cleanEntityCandidate(match[0]),
    canonical: cleanEntityCandidate(match[0]),
    start: Number.isInteger(match.index) ? match.index : null,
    end: Number.isInteger(match.index) ? match.index + match[0].length : null,
    provenance: "surface"
  }));
  const quotedTitles = Array.from(text.matchAll(/[„“"]([^„“”"]{3,120})[”"]/gu)).map(match => ({
    surface: cleanEntityCandidate(match[1]),
    canonical: cleanEntityCandidate(match[1]),
    start: Number.isInteger(match.index) ? match.index + 1 : null,
    end: Number.isInteger(match.index) ? match.index + 1 + match[1].length : null,
    provenance: "quoted_title",
    forcedType: "document_title"
  }));
  return [...quotedTitles, ...capitalized];
}

function entityType(value = "", candidate = {}) {
  if (candidate.forcedType) return candidate.forcedType;
  const normalized = normalizeSemanticText(value);
  const words = normalized.split(" ").filter(Boolean);
  const surfaceWords = String(value || "").split(/\s+/u).filter(Boolean);
  if (MUNICIPALITY_ROOT_RE.test(` ${normalized} `)) return "municipality";
  if (ORGANIZATION_ROOT_RE.test(normalized)) return "organization";
  if (/^[A-ZÕÄÖÜŠŽ\d][A-ZÕÄÖÜŠŽ\d-]{1,}$/u.test(String(value || "").trim())) return "acronym";
  if (/(?:maa|saare|jarv|jõgi|linn|vald)(?:le|lt|s|st|l|ga)?$/u.test(words[0] || "")) return "place";
  if (surfaceWords.some(word => /^[A-ZÕÄÖÜŠŽ\d][A-ZÕÄÖÜŠŽ\d-]{1,}$/u.test(word))) return "topic_entity";
  if (words.length >= 2 && isLikelyPersonCandidate(value)) return "person";
  return "topic_entity";
}

export function extractSemanticEntities({ message = "", morphology = null } = {}) {
  const candidates = [...morphologySpans(morphology), ...surfaceSpans(message)];
  const seen = new Set();
  const entities = [];
  for (const candidate of candidates) {
    const canonical = cleanEntityCandidate(candidate.canonical || candidate.surface);
    const normalized = normalizeSemanticText(canonical);
    if (!canonical || seen.has(normalized) || GENERIC_SINGLE_ENTITY_RE.test(normalized)) continue;
    seen.add(normalized);
    const type = entityType(canonical, candidate);
    if (type === "person" && !isLikelyPersonCandidate(canonical)) continue;
    if (normalized.split(" ").length < 2 && !["acronym", "organization", "municipality", "place", "document_title"].includes(type)) continue;
    entities.push({
      type,
      surface: candidate.surface || canonical,
      canonical,
      provenance: candidate.provenance,
      start: candidate.start,
      end: candidate.end
    });
    if (entities.length >= 12) break;
  }
  return {
    version: "semantic_entity_extraction_v2",
    entities,
    people: entities.filter(entity => entity.type === "person"),
    named_entities: entities.map(entity => entity.canonical)
  };
}

export function morphologyPersonCandidates(morphology = null) {
  return extractSemanticEntities({ morphology }).people.map(entity => entity.canonical);
}

export function surfacePersonCandidates(message = "") {
  return extractSemanticEntities({ message }).people.map(entity => entity.canonical);
}

export function canonicalMorphologyPersonCandidate(candidate = "", morphology = null) {
  const normalizedCandidate = normalizeSemanticText(candidate);
  const candidateWords = normalizedCandidate.split(" ").filter(Boolean);
  for (const canonical of morphologyPersonCandidates(morphology)) {
    const canonicalWords = normalizeSemanticText(canonical).split(" ").filter(Boolean);
    if (candidateWords.length !== canonicalWords.length || candidateWords.length < 2) continue;
    const compatible = candidateWords.every((word, index) => {
      const other = canonicalWords[index] || "";
      const minimum = Math.min(word.length, other.length);
      return word === other || (minimum >= 4 && (word.startsWith(other) || other.startsWith(word)));
    });
    if (compatible) return canonical;
  }
  return cleanPersonCandidate(candidate);
}
