function normalizeActionText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
}

const ACTION_FAMILY_PATTERNS = Object.freeze([
  ["recommend", /^(?:soovita|recommend|рекоменд)/u, "enable"],
  ["assign", /^(?:maara|nimeta|assign|appoint|designate|назнач)/u, "enable"],
  ["create", /^(?:luu|create|establish|созда)/u, "enable"],
  ["organize", /^(?:korralda|organis|organiz)/u, "enable"],
  ["change", /^(?:muut(?:a|ma|es|is)|muud(?:a|e)|change)/u, "enable"],
  ["provide", /^(?:pak(?:u|k)|taga(?!tud)|voimalda|provide|offer|ensure|enable|обеспеч|предостав)/u, "enable"],
  ["deliver", /^(?:vii|toimeta|deliver|bring|достав)/u, "enable"],
  ["simplify", /^(?:lihtsusta|holbusta|simplif|streamlin|ease|упрост)/u, "enable"],
  ["use", /^(?:kasuta|rakenda|use|implement|apply|использ|примен)/u, "enable"],
  ["support", /^(?:toeta(?!tud)|support|поддерж)/u, "enable"],
  ["improve", /^(?:paranda|arenda|tugevda|suurenda|improve|develop|strengthen|expand|улучш|развива|усил)/u, "enable"],
  ["continue", /^(?:jatka|continue|продолж)/u, "enable"],
  ["avoid", /^(?:valti|takista|avoid|prevent|discourage|избега|предотвра|препятств)/u, "avoid"],
  ["reduce", /^(?:vahenda|reduce|decrease)/u, "avoid"],
  ["block", /^(?:keela|lopeta|sulge|eemalda|keeldu|piira|ban|prohibit|forbid|stop|close|remove|deny|refus|terminate|запрет|прекрат|закры|удал|отказ|огранич)/u, "block"]
]);

const ACTION_FAMILY_CATEGORY = new Map(ACTION_FAMILY_PATTERNS.map(([family, , category]) => [family, category]));
ACTION_FAMILY_CATEGORY.set("require_state", "enable");
ACTION_FAMILY_CATEGORY.set("positive_state", "enable");
ACTION_FAMILY_CATEGORY.set("reject_state", "block");

function actionTokens(value = "") {
  return Array.from(normalizeActionText(value).matchAll(/[\p{L}\p{N}-]+/gu), match => match[0]);
}

function pushActionEntry(entries, entry) {
  if (!entry?.family || entries.some(item => item.family === entry.family && item.term === entry.term)) return;
  entries.push(entry);
}

export function qualitativeActionSignature(value = "") {
  const normalized = normalizeActionText(value);
  const entries = [];
  for (const token of actionTokens(normalized)) {
    // Deverbal nouns and attributive participles name a service/property;
    // they are not additional predicates (toetamise, pakkumine, pakutavates).
    if (/(?:mi(?:ne|se\p{L}*|st|ste\p{L}*|si\p{L}*)|[dt]ud\p{L}*|tav\p{L}*)$/u.test(token)) continue;
    const matched = ACTION_FAMILY_PATTERNS.find(([, pattern]) => pattern.test(token));
    if (!matched) continue;
    pushActionEntry(entries, { term: token, family: matched[0], category: matched[2] });
  }
  if (/\b(?:(?:peab|tuleb)\s+olema|(?:should|must|needs?\s+to)\s+be|(?:долж\p{L}*|нужно)\s+быть)\b/u.test(normalized)) {
    pushActionEntry(entries, { term: "required_state", family: "require_state", category: "enable" });
  }
  if (/\b(?:vajalik|oluline|necessary|needed|important|необходим\p{L}*|важн\p{L}*)\b/u.test(normalized)) {
    pushActionEntry(entries, { term: "positive_state", family: "positive_state", category: "enable" });
  }
  if (/\b(?:tarbetu|ebavajalik|kahjulik|unnecessary|needless|harmful|ненужн\p{L}*|вредн\p{L}*)\b/u.test(normalized)) {
    pushActionEntry(entries, { term: "rejected_state", family: "reject_state", category: "block" });
  }
  const negated = /\b(?:ei|mitte|ara|pole|polnud|not|never|cannot|can'?t|do\s+not|does\s+not|must\s+not|should\s+not|no|не|нельзя|нет)\b/u.test(normalized);
  return {
    entries,
    terms: Array.from(new Set(entries.map(entry => entry.term))),
    families: Array.from(new Set(entries.map(entry => entry.family))),
    categories: Array.from(new Set(entries.map(entry => entry.category))),
    negated
  };
}

function splitActionClause(value = "") {
  const text = String(value || "").trim();
  if (!text) return [];
  for (const match of text.matchAll(/\s+(?:ning|ja|and|и)\s+/giu)) {
    const index = Number(match.index);
    const left = text.slice(0, index).trim();
    const right = text.slice(index + String(match[0] || "").length).trim();
    if (!left || !right) continue;
    const rightCoordinate = right.split(/,|\s+(?:ning|ja|and|и)\s+/iu)[0];
    if (!qualitativeActionSignature(left).entries.length || !qualitativeActionSignature(rightCoordinate).entries.length) {
      continue;
    }
    return [...splitActionClause(left), ...splitActionClause(right)];
  }
  return [text];
}

function splitActionComma(value = "") {
  for (const match of value.matchAll(/,\s*/gu)) {
    const left = value.slice(0, match.index).trim();
    const right = value.slice(match.index + match[0].length).trim();
    const opening = actionTokens(right).slice(0, 3);
    const signature = qualitativeActionSignature(opening.join(" "));
    const startsPredicate = signature.entries.some(entry => opening[0] === entry.term ||
      (/^(?:mis|mille\p{L}*|which|that|котор\p{L}*)$/u.test(opening[0] || "") && opening.includes(entry.term)));
    if (!startsPredicate && !/^(?:mitte|not|не)\b/iu.test(right)) continue;
    return [...splitActionComma(left), ...splitActionComma(right)];
  }
  return [value];
}

export function qualitativeActionClauses(value = "") {
  return String(value || "")
    .split(/[;\r\n]+|(?<=[.!?])\s+/gu)
    .flatMap(splitActionComma)
    .flatMap(part => part.split(/,\s*(?=(?:(?:aga|but|но)\s+)?(?:mitte|not|не)\b)/giu))
    .flatMap(splitActionClause)
    .filter(Boolean)
    .slice(0, 8);
}

const COMPATIBLE_ACTION_FAMILIES = Object.freeze({
  recommend: new Set(["recommend", "assign", "create", "provide", "deliver", "simplify", "use", "support", "improve", "continue", "require_state", "positive_state"]),
  assign: new Set(["assign", "create"]),
  create: new Set(["assign", "create"]),
  organize: new Set(["organize", "assign", "create", "require_state", "positive_state"]),
  change: new Set(["change", "improve", "provide", "deliver", "require_state", "positive_state"]),
  provide: new Set(["provide", "deliver", "support", "require_state", "positive_state"]),
  deliver: new Set(["provide", "deliver", "support", "require_state", "positive_state"]),
  simplify: new Set(["simplify", "improve"]),
  use: new Set(["use"]),
  support: new Set(["provide", "deliver", "support", "require_state", "positive_state"]),
  improve: new Set(["simplify", "improve", "support"]),
  continue: new Set(["continue"]),
  avoid: new Set(["avoid"]),
  reduce: new Set(["reduce", "avoid"]),
  block: new Set(["block", "reject_state"]),
  require_state: new Set(["require_state", "positive_state", "provide", "deliver", "support"]),
  positive_state: new Set(["require_state", "positive_state", "provide", "deliver", "support"]),
  reject_state: new Set(["reject_state", "block"])
});

export function qualitativeActionFamiliesCompatible(expectedFamily = "", actualFamily = "") {
  const expected = String(expectedFamily || "").trim();
  const actual = String(actualFamily || "").trim();
  return !!expected && !!actual && (COMPATIBLE_ACTION_FAMILIES[expected]?.has(actual) || expected === actual);
}

export function qualitativeActionFamilyCategory(family = "") {
  return ACTION_FAMILY_CATEGORY.get(String(family || "").trim()) || null;
}
