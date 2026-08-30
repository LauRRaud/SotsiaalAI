// Shared by evidence binding and answer validation. These are relation concepts,
// not replacements for the user's text or unrestricted fuzzy name matching.
function normalize(value = "") {
  return String(value).normalize("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase();
}

function concept(value = "") {
  const token = normalize(value).replace(/[^\p{L}\p{N}-]/gu, "");
  if (/^(?:ruhma|grupi|grupp)(?:intervju|vestlus)/u.test(token)) return "group_interview";
  if (token === "individuaal" || /^individuaal(?:intervju|vestlus)/u.test(token)) return "individual_interview";
  if (/^(?:intervju|vestlus)/u.test(token)) return "interview";
  if (/^(?:lisaabi|lisabi|taiendavabi)$/u.test(token)) return "additional_help";
  if (/^(?:jarelhinda|hinnang|hindami|hinnati|hinnatud)/u.test(token)) return "assessment";
  if (/^rii(?:k|ki|ke|kide|kides|kidest|kidega|kidele|kidel|gi|gis|gist|giga|gile|gil)$/u.test(token)) return "country";
  return "";
}

export function factRelationTermMatchQuality(left = "", right = "") {
  const a = normalize(left).replace(/[^\p{L}\p{N}-]/gu, "");
  const b = normalize(right).replace(/[^\p{L}\p{N}-]/gu, "");
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aConcept = concept(a);
  const bConcept = concept(b);
  if (aConcept && aConcept === bConcept) return 0.94;
  // Distinct interview forms must not become equal through a shared suffix.
  if (aConcept.includes("interview") && bConcept.includes("interview")) return 0;
  if ((aConcept === "individual_interview" && b.startsWith("individuaal")) ||
      (bConcept === "individual_interview" && a.startsWith("individuaal"))) return 0;
  const shorterLength = Math.min(a.length, b.length);
  if (shorterLength >= 5 && (a.includes(b) || b.includes(a))) return 0.86;
  let prefixLength = 0;
  while (prefixLength < shorterLength && a[prefixLength] === b[prefixLength]) prefixLength += 1;
  return shorterLength >= 5 && prefixLength >= 4 ? 0.72 : 0;
}

export function factRelationTokens(value = "") {
  const text = String(value);
  const tokens = Array.from(text.matchAll(/[\p{L}\p{N}-]+/gu), match => ({
    value: normalize(match[0]), start: Number(match.index), end: Number(match.index) + match[0].length
  }));
  // A multiword concept keeps its real evidence span; plain "abi" alone is not
  // enough to establish additional help, and arbitrary compounds are not split.
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const left = tokens[index];
    const right = tokens[index + 1];
    if (/^individuaal(?:ne|se|sed|set|seid|sete|selt)?$/u.test(left.value) &&
      /^(?:intervju|vestlus)\p{L}*$/u.test(right.value) && /^\s+$/u.test(text.slice(left.end, right.start))) {
      tokens.push({ value: `individuaal${right.value}`, start: left.start, end: right.end });
    }
    if (/^(?:taiendav(?:a|at|ad|ate|aid)?|lisa)$/u.test(left.value) && /^abi(?:st|ga|ks|le)?$/u.test(right.value) &&
      /^\s+$/u.test(text.slice(left.end, right.start))) {
      tokens.push({ value: "taiendavabi", start: left.start, end: right.end });
    }
  }
  return tokens.sort((left, right) => left.start - right.start);
}
