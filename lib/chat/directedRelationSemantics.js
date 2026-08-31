const fold = value => String(value || "").normalize("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase();
const clean = value => String(value || "").replace(/^[\s,;:()]+|[\s,;:().!?]+$/gu, "").replace(/\s+/gu, " ").trim();

export const DIRECTED_RELATION_PAYLOAD_KIND = "directed_event_relation_set";
export const DIRECTED_RELATIONS = Object.freeze(["BEFORE", "AFTER", "OVERLAPS"]);

const approachKey = value => fold(clean(value))
  .replace(/\b(?:arenenud\s+riikides|otsustavalt)\b/gu, " ")
  .replace(/\b(kasitlus|lahenemine|menetlus)(?:est|es|se|s)?\b/gu, "$1")
  .replace(/\s+/gu, " ").trim();

const eventWordKey = value => {
  let word = fold(value).replace(/[^\p{L}\p{N}-]+/gu, "");
  if (/tsiooni$/u.test(word)) word = word.slice(0, -1);
  else if (/aset$/u.test(word)) word = word.slice(0, -1);
  else if (/aseme$/u.test(word)) word = word.replace(/aseme$/u, "ase");
  else if (/use$/u.test(word)) word = word.replace(/use$/u, "us");
  else if (/mi(?:se(?:ga|le|lt|st|s|t)?|st)$/u.test(word)) word = word.replace(/mi(?:se(?:ga|le|lt|st|s|t)?|st)$/u, "mine");
  else word = word.replace(/(?:ga|le|lt|st|ssa|sse|ni|na|ta)$/u, "");
  return word;
};

export const directedEventKey = value => clean(value).split(/\s+/u)
  .map(eventWordKey)
  .filter(word => word.length >= 4 && !new Set(["omaette", "tegelikult", "loppu"]).has(word))
  .join(" ");

const eventDisplay = value => clean(value)
  .replace(/^omaette\s+/iu, "")
  .replace(/\brehabilitatsiooni\b/iu, "rehabilitatsioon")
  .replace(/\beluaset\b/iu, "eluase");

const approachDisplay = value => clean(value)
  .replace(/\bkäsitlusest\b/iu, "käsitlus")
  .replace(/\blähenemisest\b/iu, "lähenemine")
  .replace(/\bmenetluses\b/iu, "menetlus")
  .replace(/\blähenemises\b/iu, "lähenemine")
  .replace(/^./u, character => character.toUpperCase());

const invert = relation => relation === "BEFORE" ? "AFTER" : relation === "AFTER" ? "BEFORE" : relation;
const relationOrder = relation => DIRECTED_RELATIONS.indexOf(relation);

function normalizedAtom(payload = {}) {
  const left = directedEventKey(payload.event_a);
  const right = directedEventKey(payload.event_b);
  if (!left || !right || left === right) return null;
  const swap = left.localeCompare(right) > 0;
  return {
    approach_key: approachKey(payload.approach),
    event_left: swap ? right : left,
    event_right: swap ? left : right,
    relations: [...new Set((Array.isArray(payload.relations) ? payload.relations : [])
      .filter(relation => DIRECTED_RELATIONS.includes(relation))
      .map(relation => swap ? invert(relation) : relation))].sort((a, b) => relationOrder(a) - relationOrder(b)),
    polarity: payload.polarity === "positive" ? "positive" : payload.polarity === "negative" ? "negative" : "unknown",
    qualifiers: [...new Set((Array.isArray(payload.qualifiers) ? payload.qualifiers : [])
      .map(value => String(value || "").trim()).filter(Boolean))].sort()
  };
}

export function directedRelationPayloadMatches(left, right) {
  const a = normalizedAtom(left);
  const b = normalizedAtom(right);
  return !!a && !!b && JSON.stringify(a) === JSON.stringify(b);
}

export function directedRelationSetMatches(left = [], right = []) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const unmatched = [...right];
  for (const item of left) {
    const index = unmatched.findIndex(candidate => directedRelationPayloadMatches(item, candidate));
    if (index < 0) return false;
    unmatched.splice(index, 1);
  }
  return unmatched.length === 0;
}

export function isDirectedRelationSlot(slot = null) {
  return slot?.payload_kind === DIRECTED_RELATION_PAYLOAD_KIND &&
    slot?.value_type === "text_relation" && Number(slot?.expected_cardinality) === 2 &&
    Array.isArray(slot?.requested_event_keys) && slot.requested_event_keys.length === 2 &&
    slot.requested_event_keys.every(value => typeof value === "string" && value.length >= 4) &&
    new Set(slot.requested_event_keys).size === 2;
}

function requestedEventKeys(normalized = "") {
  const patterns = [
    /([\p{L}-]{4,})\s+(?:ja|ning|and|or)\s+([\p{L}-]{4,})\s+(?:jarjekor|jarjestus|order|sequence)\p{L}*/u,
    /(?:kaivad|toimuvad|on|are)\s+([\p{L}-]{4,})\s+(?:ja|ning|and|or)\s+([\p{L}-]{4,})\b/u
  ];
  const match = patterns.map(pattern => normalized.match(pattern)).find(Boolean);
  if (!match) return [];
  const keys = [directedEventKey(match[1]), directedEventKey(match[2])].filter(Boolean).sort();
  return keys.length === 2 && new Set(keys).size === 2 ? keys : [];
}

export function directedRelationRequirementForClause(value = "") {
  const normalized = fold(value);
  const orderCue = /\b(?:jarjekor\p{L}*|jarjestus\p{L}*|order|sequence)\b/u.test(normalized);
  const pairedFrame = /\b(?:kahes|kahe|molemas|kummas|kaks|two)\b/u.test(normalized) &&
    /\b(?:lahenemis|kasitlus|menetlus|approach|model)\p{L}*/u.test(normalized);
  const eventKeys = requestedEventKeys(normalized);
  if (!orderCue || !pairedFrame || eventKeys.length !== 2) return {};
  return {
    value_type: "text_relation",
    payload_kind: DIRECTED_RELATION_PAYLOAD_KIND,
    expected_cardinality: 2,
    requested_event_keys: eventKeys,
    minimum_answer_items: 2
  };
}

function sequentialPayload(body = "") {
  const firstThen = body.match(/(?:k[õo]igepealt|esmalt)\s+([^,.;:()]{2,80}?)(?:,\s*)?(?:ja\s+)?(?:alles\s+)?(?:seej[äa]rel|siis)\s+([^,.;:()]{2,80})/iu);
  if (firstThen) return {
    event_a: clean(firstThen[1]), event_b: clean(firstThen[2]), relations: ["BEFORE"], qualifiers: []
  };
  const beforeThen = body.match(/\benne\s+([^,.;:()]{2,80}?)\s+(?:ja|ning)\s+siis\s+(\([^)]*\)\s*)?([^,.;:()]{2,80})/iu);
  if (beforeThen) {
    const simultaneous = /samal\s+ajal|samaaeg/iu.test(beforeThen[2] || "");
    return { event_a: clean(beforeThen[1]), event_b: clean(beforeThen[3]),
      relations: simultaneous ? ["BEFORE", "OVERLAPS"] : ["BEFORE"],
      qualifiers: simultaneous ? ["corrective_simultaneity"] : [] };
  }
  const explicitBefore = body.match(/([^,.;:()]{2,70}?)\s+enne\s+([^,.;:()]{2,70})(?:,\s*([^.;!?]{2,100}))?/iu);
  if (explicitBefore) {
    const tail = fold(explicitBefore[3] || "");
    const tailKeys = tail.split(/\s+/u).map(eventWordKey).filter(Boolean);
    const comparedEventKeys = directedEventKey(explicitBefore[2]).split(/\s+/u).filter(Boolean);
    const simultaneous = /^tegelikult\s+(?:samal\s+ajal|samaaeg\p{L}*)\b/u.test(tail) ||
      (/\bkattu\p{L}*\b/u.test(tail) && comparedEventKeys.some(key => tailKeys.includes(key)));
    return { event_a: clean(explicitBefore[1]), event_b: clean(explicitBefore[2]),
      relations: simultaneous ? ["BEFORE", "OVERLAPS"] : ["BEFORE"],
      qualifiers: simultaneous ? ["corrective_simultaneity"] : [] };
  }
  const explicitAfter = body.match(/([^,.;:()]{2,70}?)\s+(?:p[äa]rast|j[äa]rel)\s+([^,.;:()]{2,70})/iu);
  if (explicitAfter) return {
    event_a: clean(explicitAfter[1]), event_b: clean(explicitAfter[2]), relations: ["AFTER"], qualifiers: []
  };
  return null;
}

function candidateFrom(sentence, sentenceStart, approach, body) {
  const assertionFrame = fold(sentence);
  if (/\b(?:kui|juhul|tingimusel)\b/u.test(assertionFrame) || /\b(?:ei|mitte)\b/u.test(assertionFrame)) {
    return { status: "UNCHECKABLE", candidate: null };
  }
  const relation = sequentialPayload(body);
  if (!relation || !approachKey(approach) || !directedEventKey(relation.event_a) || !directedEventKey(relation.event_b)) {
    return { status: "UNCHECKABLE", candidate: null };
  }
  return { status: "ADMITTED", candidate: {
    start: sentenceStart,
    end: sentenceStart + sentence.length,
    approach: approachDisplay(approach),
    event_a: eventDisplay(relation.event_a),
    relations: relation.relations,
    event_b: eventDisplay(relation.event_b),
    polarity: "positive",
    qualifiers: relation.qualifiers
  } };
}

function parseSentence(sentence, sentenceStart) {
  const normalized = fold(sentence);
  const relative = normalized.match(/\berineb\b[\s\S]{0,120}?\b((?:varem\s+valitsenud|traditsiooniline|astmeline)[\s\p{L}-]{0,50}?(?:kasitlus|lahenemine|mudel)\p{L}*)\s*,\s*mille\s+kohaselt\s+([\s\S]+)$/u);
  if (relative) {
    const approachStart = normalized.indexOf(relative[1]);
    const bodyStart = normalized.indexOf(relative[2], approachStart + relative[1].length);
    return candidateFrom(sentence, sentenceStart,
      sentence.slice(approachStart, approachStart + relative[1].length), sentence.slice(bodyStart));
  }
  const principle = normalized.match(/^\s*([\p{L}-]+(?:\s+[\p{L}-]+){0,5}?\s+(?:lahenemine|kasitlus|menetlus)\p{L}*)\s+(?:lahtub\s+[^:]{0,80}:|pohineb\s+[^:]{0,80}:)\s*([\s\S]+)$/u);
  if (principle) {
    const approachStart = normalized.indexOf(principle[1]);
    const bodyStart = normalized.indexOf(principle[2], approachStart + principle[1].length);
    return candidateFrom(sentence, sentenceStart,
      sentence.slice(approachStart, approachStart + principle[1].length), sentence.slice(bodyStart));
  }
  const inessive = normalized.match(/^\s*([\p{L}-]*(?:menetluses|lahenemises|kasitluses))\s+(?:tehakse|toimub|pakutakse)\s+([\s\S]+)$/u);
  if (inessive) {
    const approachStart = normalized.indexOf(inessive[1]);
    const bodyStart = normalized.indexOf(inessive[2], approachStart + inessive[1].length);
    return candidateFrom(sentence, sentenceStart,
      sentence.slice(approachStart, approachStart + inessive[1].length), sentence.slice(bodyStart));
  }
  const scopedDirection = /\b(?:lahenem|kasitlus|menetlus)\p{L}*\b/u.test(normalized) &&
    /\b(?:enne|parast|jarel|esmalt|koigepealt|seejarel|siis|samal\s+ajal|samaaeg)\p{L}*/u.test(normalized);
  return { status: scopedDirection ? "UNCHECKABLE" : "NO_MATCH", candidate: null };
}

export function extractDirectedRelations(value = "") {
  const text = String(value || "");
  const candidates = [];
  let uncheckable = false;
  for (const match of text.matchAll(/[^.!?]+[.!?]?/gu)) {
    const rawSentence = String(match[0] || "");
    const leading = rawSentence.match(/^\s*/u)?.[0]?.length || 0;
    const trailing = rawSentence.match(/\s*$/u)?.[0]?.length || 0;
    const sentence = rawSentence.slice(leading, rawSentence.length - trailing);
    if (!sentence) continue;
    const result = parseSentence(sentence, Number(match.index) + leading);
    if (result.status === "UNCHECKABLE") uncheckable = true;
    if (result.candidate) candidates.push(result.candidate);
  }
  if (uncheckable) return { status: "UNCHECKABLE", candidates: [] };
  const byApproach = new Map();
  for (const candidate of candidates) {
    const key = approachKey(candidate.approach);
    const previous = byApproach.get(key);
    if (previous && !directedRelationPayloadMatches(previous, candidate)) return { status: "CONFLICT", candidates: [] };
    if (!previous) byApproach.set(key, candidate);
  }
  const unique = [...byApproach.values()];
  return { status: unique.length ? "ADMITTED" : "NO_MATCH", candidates: unique };
}

export function directedRelationPairKey(payload = {}) {
  const values = [directedEventKey(payload.event_a), directedEventKey(payload.event_b)].filter(Boolean).sort();
  return values.length === 2 ? values.join("::") : "";
}

export function directedRelationPayloadForSlot(result = null, slot = null) {
  if (!isDirectedRelationSlot(slot) || result?.status !== "ADMITTED") return null;
  const candidates = Array.isArray(result.candidates) ? result.candidates : [];
  if (candidates.length !== Number(slot.expected_cardinality) || new Set(candidates.map(item => approachKey(item.approach))).size !== candidates.length) return null;
  return {
    kind: DIRECTED_RELATION_PAYLOAD_KIND,
    relations: candidates.map(candidate => ({
      approach: candidate.approach, event_a: candidate.event_a, relations: [...candidate.relations],
      event_b: candidate.event_b, polarity: candidate.polarity, qualifiers: [...candidate.qualifiers]
    })).sort((left, right) => approachKey(left.approach).localeCompare(approachKey(right.approach)))
  };
}

function renderAtom(atom, lang) {
  const overlap = atom.relations.includes("OVERLAPS");
  if (lang === "en") return `${atom.approach}: first ${atom.event_a}, then ${atom.event_b}${overlap ? "; the source clarifies that they actually overlap" : ""}.`;
  if (lang === "ru") return `${atom.approach}: сначала ${atom.event_a}, затем ${atom.event_b}${overlap ? "; источник уточняет, что фактически они происходят одновременно" : ""}.`;
  return `${atom.approach}: esmalt ${atom.event_a}, seejärel ${atom.event_b}${overlap ? "; allikas täpsustab, et tegelikult toimuvad need samal ajal" : ""}.`;
}

export function renderDirectedRelationPayload(payload = null, lang = "et") {
  if (payload?.kind !== DIRECTED_RELATION_PAYLOAD_KIND || !Array.isArray(payload.relations)) return "";
  return payload.relations.map((atom, index) => `${index + 1}. ${renderAtom(atom, lang)}`).join("\n");
}

const eventPattern = value => {
  const roots = directedEventKey(value).split(/\s+/u).filter(Boolean);
  return roots.length ? roots.map(root => `${root.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\p{L}*`).join("[\\s-]+") : "(?!)";
};

function replyAtom(line, expected) {
  const normalized = fold(line);
  const a = eventPattern(expected.event_a);
  const b = eventPattern(expected.event_b);
  const firstMatch = patterns => patterns.map(pattern => normalized.match(pattern)).find(Boolean) || null;
  const before = firstMatch([
    new RegExp(`(?:${a})[\\s\\S]{0,48}\\b(?:enne|before)\\b[\\s\\S]{0,48}(?:${b})`, "u"),
    new RegExp(`\\b(?:esmalt|first)\\b[\\s\\S]{0,32}(?:${a})[\\s\\S]{0,48}\\b(?:seejarel|siis|then)\\b[\\s\\S]{0,32}(?:${b})`, "u"),
    new RegExp(`(?:${b})[\\s\\S]{0,48}\\b(?:parast|jarel|after)\\b[\\s\\S]{0,48}(?:${a})`, "u")
  ]);
  const after = firstMatch([
    new RegExp(`(?:${a})[\\s\\S]{0,48}\\b(?:parast|jarel|after)\\b[\\s\\S]{0,48}(?:${b})`, "u"),
    new RegExp(`(?:${b})[\\s\\S]{0,48}\\b(?:enne|before)\\b[\\s\\S]{0,48}(?:${a})`, "u")
  ]);
  if (!!before === !!after) return null;
  const relationMatch = before || after;
  const localTail = normalized.slice(Number(relationMatch.index) + relationMatch[0].length,
    Number(relationMatch.index) + relationMatch[0].length + 140);
  const overlap = /^[\s,;:()–—-]*(?:(?:allikas|source|источник)\s+[^,;:.]{0,50}[,;:]?\s*)?(?:tegelikult\s+)?(?:(?:toimuvad\s+need|need\s+toimuvad)\s+)?(?:samal\s+ajal|samaaeg\p{L}*|kattu\p{L}*|overlap\p{L}*|same\s+time|одновременно)\b/u.test(localTail);
  return { ...expected, relations: [before ? "BEFORE" : "AFTER", ...(overlap ? ["OVERLAPS"] : [])] };
}

export function directedReplyMatchesPayload(reply = "", payload = null) {
  if (payload?.kind !== DIRECTED_RELATION_PAYLOAD_KIND || !Array.isArray(payload.relations)) return false;
  const lines = String(reply || "").split(/\r?\n/u).map(clean).filter(Boolean);
  const parsed = [];
  const usedLineIndexes = new Set();
  for (const expected of payload.relations) {
    const keyTerms = approachKey(expected.approach).split(/\s+/u).filter(term => term.length >= 5);
    const otherApproaches = payload.relations.filter(item => item !== expected).map(item =>
      approachKey(item.approach).split(/\s+/u).filter(term => term.length >= 5));
    const lineIndex = lines.findIndex((item, index) => !usedLineIndexes.has(index) &&
      keyTerms.every(term => fold(item).includes(term)) &&
      !otherApproaches.some(terms => terms.length && terms.every(term => fold(item).includes(term))));
    if (lineIndex < 0) return false;
    usedLineIndexes.add(lineIndex);
    const line = lines[lineIndex];
    const atom = replyAtom(line, expected);
    if (!atom) return false;
    parsed.push(atom);
  }
  return directedRelationSetMatches(parsed, payload.relations);
}
