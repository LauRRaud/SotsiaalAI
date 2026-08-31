// Bounded municipal intervention/control grammar. Values and names are always
// extracted from the source; unknown syntax is not admitted by keyword overlap.
const fold = value => String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const cardinalForms = [
  ["uks", "uhe", "uhes"], ["kaks", "kahe", "kahes"], ["kolm", "kolme", "kolmes"],
  ["neli", "nelja", "neljas"], ["viis", "viie", "viies"], ["kuus", "kuue", "kuues"],
  ["seitse", "seitsme", "seitsmes"], ["kaheksa", "kaheksas"], ["uheksa", "uheksas"],
  ["kumme", "kumne", "kumnes"]
];
const countValue = value => /^\d{1,3}$/u.test(value) ? Number(value)
  : cardinalForms.findIndex(forms => forms.includes(fold(value))) + 1;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const GROUP_PAYLOAD_KINDS = ["group_distribution", "group_membership"];
export const isGroupFactSlot = slot => GROUP_PAYLOAD_KINDS.includes(slot?.payload_kind);

export function groupRequirementForClause(value = "", valueType = "") {
  const text = fold(value);
  if (!/\bomavalits\p{L}*/u.test(text)) return null;
  const unsupported = /\b(?:ei|mitte|kui|kavatse\p{L}*|kavanda\p{L}*)\b/u.test(text);
  const project = text.match(/\b([\p{L}-]*projekt)(?:is|i|ile|ist|iga)?\b/u)?.[1];
  const scope = project ? { group_population: project } : {};
  if (valueType === "distribution" && /\b(?:jaota\p{L}*|jagun\p{L}*|jaotus)\b/u.test(text)) {
    return { payload_kind: "group_distribution", group_unit: "municipality", ...scope, ...(unsupported ? { group_role: "unsupported" } : {}) };
  }
  if (valueType !== "entity_list") return null;
  const intervention = /\b(?:sekkumiskava|sekkumisruhm)\p{L}*/u.test(text);
  const control = /\bkontroll(?:ruhm|omavalits)\p{L}*/u.test(text);
  if (intervention === control) return null;
  return { payload_kind: "group_membership", group_unit: "municipality", ...scope,
    group_role: unsupported ? "unsupported" : intervention ? "intervention" : "control", completeness_required: true };
}

function parseMembers(value = "", origin = 0) {
  if (!value.trim()) return { status: "MISSING", reason: "membership_not_in_passage", members: [] };
  if (/\b(?:näiteks|muu hulgas|sealhulgas|jt|teiste seas)\b/iu.test(value)) {
    return { status: "MISSING", reason: "membership_not_exhaustive", members: [] };
  }
  const pieces = [];
  let start = 0;
  for (const match of value.matchAll(/\s*(?:,\s*|\s+(?:ja|ning)\s+)/gu)) {
    pieces.push({ text: value.slice(start, match.index), start });
    start = match.index + match[0].length;
  }
  pieces.push({ text: value.slice(start), start });
  let inheritedType = null;
  let inheritedTypeSpan = null;
  const members = [];
  for (const piece of pieces.reverse()) {
    const match = piece.text.match(/^\s*(\p{Lu}[\p{L}-]*(?:\s+\p{Lu}[\p{L}-]*){0,3})(?:\s+(linn|linnad|vald|vallad))?\s*$/u);
    if (!match) return { status: "UNCHECKABLE", reason: "membership_grammar_unknown", members: [] };
    const sourceName = match[1];
    if (match[2]) {
      inheritedType = match[2].startsWith("linn") ? "city" : "rural_municipality";
      const at = origin + piece.start + piece.text.lastIndexOf(match[2]);
      inheritedTypeSpan = { start: at, end: at + match[2].length };
    }
    if (!inheritedType) return { status: "UNCHECKABLE", reason: "member_type_missing", members: [] };
    const at = origin + piece.start + piece.text.indexOf(sourceName);
    members.push({ source_name: sourceName, identity: fold(sourceName), entity_type: inheritedType,
      origin_span: { start: at, end: at + sourceName.length }, type_span: inheritedTypeSpan });
  }
  if (new Set(members.map(member => member.identity)).size !== members.length) {
    return { status: "CONFLICT", reason: "duplicate_group_member", members: [] };
  }
  return { status: "ADMITTED", members: members.sort((a, b) => a.identity.localeCompare(b.identity, "et")) };
}

// Offsets refer to the exact input string, in UTF-16 code units. Never concatenate
// unrelated chunks before resolving "nendest": the antecedent must be adjacent.
export function extractGroupFacts(value = "") {
  const text = String(value || "");
  const candidates = [];
  const failures = [];
  const totalPattern = /\b((?:[\p{L}-]*projektis|uuringus))\s+(?:osaleb|osalevad|osales|osalesid)\s+([\p{L}\d]+)\s+omavalitsust\s*\./giu;
  const groupPattern = /^\s*([\p{L}\d]+)\s+nendest\s+(?:[–—-]\s*([^.!?]+?)\s*[–—-]\s*)?(?:viivad|viisid)\s+ellu\s+(?:spetsiaalse\s+)?sekkumiskava,\s*ülejäänud\s+([\p{L}\d]+)\s+(?:\(kontrollomavalitsusi\s+ei\s+avalikustata\)|kontrollrühmas)\s+sekkumistegevusi\s+ei\s+(?:toimu|toimunud)\s*\./iu;
  for (const match of text.matchAll(totalPattern)) {
    const prefix = text.slice(0, match.index).split(/[.!?\n]/u).at(-1);
    const lead = fold(text.slice(Math.max(0, match.index - 400), match.index));
    if (prefix.trim() || /\b(?:vaar|vale|naide|hupoteetiline)\b[^.!?]*$/u.test(lead) ||
      /\bkui\b[^.!?]*\bsiis\s*:\s*$/u.test(lead) ||
      /\b(?:teist|teine|muud|muu)\s+[\p{L}-]*projekt\p{L}*/u.test(lead)) {
      failures.push("group_assertion_scope_uncheckable");
      continue;
    }
    const tailStart = match.index + match[0].length;
    const tail = text.slice(tailStart, tailStart + 1800);
    const group = tail.match(groupPattern);
    if (!group) {
      if (/^\s*[\p{L}\d]+\s+nendest\b/iu.test(tail)) failures.push("group_relation_uncheckable");
      continue;
    }
    const total = countValue(match[2]);
    const intervention = countValue(group[1]);
    const control = countValue(group[3]);
    if (![total, intervention, control].every(n => Number.isInteger(n) && n > 0 && n <= 999)) {
      failures.push("group_count_uncheckable");
      continue;
    }
    if (intervention + control !== total) {
      failures.push("group_count_conflict");
      continue;
    }
    const names = group[2] || "";
    const memberOrigin = names ? tailStart + group[0].indexOf(names) : 0;
    const membership = parseMembers(names, memberOrigin);
    if (membership.status === "CONFLICT" ||
      (membership.status === "ADMITTED" && membership.members.length !== intervention)) {
      failures.push(membership.reason || "group_member_count_conflict");
      continue;
    }
    const partition = {
      kind: "group_distribution", population: fold(match[1]), unit: "municipality", total,
      groups: [
        { role: "intervention", count: intervention, action: "intervention_plan", polarity: "positive" },
        { role: "control", count: control, action: "intervention_activities", polarity: "negative" }
      ],
      exhaustive: true, disjoint: true
    };
    const memberPayload = membership.status === "ADMITTED" ? {
      kind: "group_membership", population: partition.population, unit: partition.unit,
      group_role: "intervention", declared_count: intervention, completeness: "complete",
      members: membership.members.map(({ source_name, identity, entity_type }) => ({ source_name, identity, entity_type }))
    } : null;
    candidates.push({
      partition, membership: memberPayload,
      membership_status: membership.status, membership_reason: membership.reason || null,
      member_spans: membership.members,
      start: match.index, end: tailStart + group[0].length,
      total_span: { start: match.index, end: tailStart },
      group_span: { start: tailStart + group[0].search(/\S/u), end: tailStart + group[0].length }
    });
  }
  // A correct passage must not hide a directly contrary control-group action.
  const remaining = candidates.reduce((body, candidate) =>
    body.slice(0, candidate.start) + " ".repeat(candidate.end - candidate.start) + body.slice(candidate.end), text);
  if (/\bkontroll(?:rühm|omavalits)\p{L}*[^.!?\n]{0,70}\b(?:viidi|viivad|viisid)\s+(?:samuti\s+|ka\s+)?ellu\s+(?:spetsiaalset?\s+)?sekkumiskava/iu.test(remaining) ||
    /\b(?:jaotus|nimekiri|loetelu)\b[^.!?]{0,40}\bei\s+vasta\s+tegelikkusele/iu.test(remaining) ||
    /\bkontroll(?:rühm|omavalits)\p{L}*\s+(?:toimuvad|toimusid|rakendasid)\s+sekkumistegevus\p{L}*/iu.test(remaining) ||
    /\b(?:linn|vald)\s+ei\s+(?:rakendanud|rakenda|viinud)\b[^.!?\n]{0,60}\bsekkumiskava/iu.test(remaining) ||
    /(?<!\p{L})(?:üks|mõni|mitu|\d+)\s+(?:omavalitsus\p{L}*\s+)?kuulu\p{L}*\s+mõlemasse\b/iu.test(remaining)) {
    failures.push("group_relation_conflict");
  }
  if (failures.length) return { status: failures.some(reason => /conflict|duplicate/u.test(reason)) ? "CONFLICT" : "UNCHECKABLE",
    reason: failures[0], candidates: [] };
  if (!candidates.length) return { status: "NO_MATCH", reason: "group_passage_missing", candidates: [] };
  if (candidates.some(candidate => !same(candidate.partition, candidates[0].partition)) ||
    candidates.filter(candidate => candidate.membership).some(candidate =>
      !same(candidate.membership, candidates.find(item => item.membership)?.membership))) {
    return { status: "CONFLICT", reason: "group_evidence_conflict", candidates: [] };
  }
  return { status: "ADMITTED", reason: "group_passage_bound", candidates };
}

export function groupPayloadForSlot(result, slot) {
  if (result?.status !== "ADMITTED") return null;
  if (slot?.payload_kind === "group_distribution") return result.candidates[0]?.partition || null;
  if (slot?.payload_kind === "group_membership" && slot.group_role === "intervention") {
    return result.candidates.find(candidate => candidate.membership)?.membership || null;
  }
  return null;
}
