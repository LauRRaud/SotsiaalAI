import { contactRoleTextMatches } from "@/lib/chat/contactRoleSemantics";

const YEAR_MIN = 1900;
const YEAR_MAX = 2100;
function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNumber(value = "") {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/%$/, "");
}

function stripStructuralNumbers(value = "") {
  return String(value || "")
    .replace(/^\s*\d{1,3}[.)]\s+/gmu, "")
    .replace(/\[\d{1,3}\]/gu, "");
}

function numericClaims(value = "") {
  const text = stripStructuralNumbers(value);
  const claims = [];
  for (const match of text.matchAll(/(?<![\p{L}\d])(?:\d{1,3}(?:[ .]\d{3})+|\d+)(?:[.,]\d+)?\s*%?/gu)) {
    const raw = String(match[0] || "").trim();
    const normalized = normalizeNumber(raw);
    const numeric = Number(normalized);
    if (!normalized || !Number.isFinite(numeric)) continue;
    claims.push({
      value: normalized,
      numeric,
      percentage: raw.endsWith("%"),
      year: Number.isInteger(numeric) && numeric >= YEAR_MIN && numeric <= YEAR_MAX,
      index: match.index || 0
    });
  }
  return claims;
}

const ESTONIAN_SMALL_NUMBER_FORMS = [
  [0, /^(?:null|nulli(?:l|lt|st|s|ga|ks|ni|ta)?)$/u],
  [1, /^(?:uks|uht|uhe(?:l|lt|st|s|ga|ks|ni|ta)?)$/u],
  [2, /^(?:kaks|kaht|kahe(?:l|lt|st|s|ga|ks|ni|ta)?)$/u],
  [3, /^(?:kolm|kolme(?:l|lt|st|s|ga|ks|ni|ta)?)$/u],
  [4, /^(?:neli|nelja(?:l|lt|st|s|ga|ks|ni|ta)?)$/u],
  [5, /^(?:viis|viit|viie(?:l|lt|st|s|ga|ks|ni|ta)?)$/u],
  [6, /^(?:kuus|kuut|kuue(?:l|lt|st|s|ga|ks|ni|ta)?)$/u],
  [7, /^(?:seitse|seitset|seitsme(?:l|lt|st|s|ga|ks|ni|ta)?)$/u],
  [8, /^(?:kaheksa(?:l|lt|st|s|ga|ks|ni|ta)?)$/u],
  [9, /^(?:uheksa(?:l|lt|st|s|ga|ks|ni|ta)?)$/u],
  [10, /^(?:kumme|kummet|kumne(?:l|lt|st|s|ga|ks|ni|ta)?)$/u]
];

const NON_EST_SMALL_NUMBER_VALUES = new Map([
  ["one", "1"], ["two", "2"], ["three", "3"], ["four", "4"], ["five", "5"],
  ["six", "6"], ["seven", "7"], ["eight", "8"], ["nine", "9"], ["ten", "10"],
  ["один", "1"], ["одна", "1"], ["два", "2"], ["две", "2"], ["три", "3"],
  ["четыре", "4"], ["пять", "5"], ["шесть", "6"], ["семь", "7"],
  ["восемь", "8"], ["девять", "9"], ["десять", "10"]
]);

const RUSSIAN_SMALL_NUMBER_FORMS = [
  [1, /^(?:один|одна|одно|одного|одной|одному|одним|одну)$/u],
  [2, /^(?:два|две|двух|двум|двумя)$/u],
  [3, /^(?:три|трех|трем|тремя)$/u],
  [4, /^(?:четыре|четырех|четырем|четырьмя)$/u],
  [5, /^(?:пять|пяти|пятью)$/u],
  [6, /^(?:шесть|шести|шестью)$/u],
  [7, /^(?:семь|семи|семью)$/u],
  [8, /^(?:восемь|восьми|восемью)$/u],
  [9, /^(?:девять|девяти|девятью)$/u],
  [10, /^(?:десять|десяти|десятью)$/u]
];

function normalizedNumericClaims(value = "") {
  const claims = numericClaims(value);
  const normalized = normalizeText(stripStructuralNumbers(value));
  for (const match of normalized.matchAll(/(?<![\p{L}\d])[\p{L}]+(?![\p{L}\d])/gu)) {
    const word = String(match[0] || "");
    const followingText = normalized.slice((match.index || 0) + word.length).trimStart();
    // „Viis läbi/ellu/edasi” is a verb, not the cardinal number five.
    if (word === "viis" && /^(?:labi|ellu|edasi|sisse|valja)\b/u.test(followingText)) continue;
    const mapped = ESTONIAN_SMALL_NUMBER_FORMS.find(([, pattern]) => pattern.test(word));
    const russianMapped = RUSSIAN_SMALL_NUMBER_FORMS.find(([, pattern]) => pattern.test(word));
    const mappedValue = mapped?.[0] ?? russianMapped?.[0] ?? Number(NON_EST_SMALL_NUMBER_VALUES.get(word));
    if (!Number.isFinite(mappedValue)) continue;
    claims.push({
      value: String(mappedValue),
      numeric: mappedValue,
      percentage: false,
      year: false,
      index: match.index || 0
    });
  }
  return claims.sort((left, right) => left.index - right.index);
}

function evidenceNumericClaims(value = "") {
  const claims = normalizedNumericClaims(value);
  const seenPercentages = new Set(
    claims.filter(claim => claim.percentage).map(claim => claim.value)
  );
  // PDF-i tekstikiht võib sõna ja protsendi kokku liita (nt „lõpuks68%”).
  // Vastuse arvud loetakse endiselt rangelt; siin taastame ainult allikas selgelt
  // protsendimärgiga kirjutatud väärtuse, mitte suvalist sõna sisse sulanud numbrit.
  for (const match of String(value || "").matchAll(/(?<!\d)(\d+(?:[.,]\d+)?)\s*%(?!\d)/gu)) {
    const normalized = normalizeNumber(match?.[1] || "");
    const numeric = Number(normalized);
    if (!normalized || !Number.isFinite(numeric) || seenPercentages.has(normalized)) continue;
    claims.push({
      value: normalized,
      numeric,
      percentage: true,
      year: false,
      index: match.index || 0
    });
    seenPercentages.add(normalized);
  }
  return claims.sort((left, right) => left.index - right.index);
}

function splitEvidence(source = {}, index = 0) {
  const evidenceText = String(source?.evidenceText || "").trim();
  const newline = evidenceText.indexOf("\n");
  const header = newline >= 0 ? evidenceText.slice(0, newline) : "";
  const body = newline >= 0 ? evidenceText.slice(newline + 1) : evidenceText;
  return {
    sourceId: String(source?.id || source?.source_id || source?.sourceId || `source_${index + 1}`),
    sourceType: String(source?.sourceType || source?.source_type || "").trim(),
    documentId: String(source?.documentId || source?.document_id || "").trim() || null,
    title: String(source?.title || "").trim() || null,
    evidenceText,
    header,
    body,
    allNumbers: new Set(evidenceNumericClaims(evidenceText).map(claim => claim.value)),
    bodyYears: new Set(numericClaims(body).filter(claim => claim.year).map(claim => claim.value)),
    wholeScopeNumbers: extractWholeScopeNumbers(body)
  };
}

function extractWholeScopeNumbers(body = "", { includeFallback = true } = {}) {
  const fallbackValues = new Set();
  const explicitWholeValues = new Set();
  const sentences = String(body || "").split(/(?<=[.!?])\s+|[\r\n]+/u);
  for (const sentence of sentences) {
    const normalized = normalizeText(stripStructuralNumbers(sentence));
    const claims = alignedCategoryNumericClaims(normalized).filter(claim => !claim.year);
    if (!claims.length) continue;
    const totalCuePattern = /(?<!\p{L})(?:kokku|kogu\s*valim\w*|koguvalim\w*|koguarv\w*|uldarv\w*|valim\w*\s+(?:moodustas|koosnes)|in\s+total|total|altogether|всего|итого)(?!\p{L})/gu;
    const totalCues = [...normalized.matchAll(totalCuePattern)];
    if (totalCues.length) {
      for (const totalCue of totalCues) {
        const cueStart = totalCue.index || 0;
        const cueEnd = cueStart + String(totalCue[0] || "").length;
        const totalValue = totalValueAroundCue(normalized, totalCue);
        if (!totalValue) continue;
        const numericAfter = claims.find(claim =>
          claim.index >= cueEnd && claim.value === totalValue
        );
        const numericBefore = [...claims].reverse().find(claim =>
          claim.index < cueStart && claim.value === totalValue
        );
        const totalClaim = numericAfter || numericBefore || null;
        const lowerBound = Math.min(cueStart, totalClaim?.index ?? cueStart);
        const upperBound = Math.max(cueEnd, (totalClaim?.index ?? cueEnd) + 1);
        const clauseStart = Math.max(
          normalized.lastIndexOf(";", Math.max(0, lowerBound - 1)),
          normalized.lastIndexOf(",", Math.max(0, lowerBound - 1))
        ) + 1;
        const followingDelimiters = [normalized.indexOf(";", upperBound), normalized.indexOf(",", upperBound)]
          .filter(index => index >= 0);
        const clauseEnd = followingDelimiters.length ? Math.min(...followingDelimiters) : normalized.length;
        const rawClause = normalized.slice(clauseStart, clauseEnd);
        const leadingWhitespace = rawClause.length - rawClause.trimStart().length;
        const clause = rawClause.trim();
        const cueOffset = cueStart - clauseStart - leadingWhitespace;
        const localCue = { 0: String(totalCue[0] || ""), index: Math.max(0, cueOffset) };
        const totalCategory = categoryAroundTotalCue(clause, localCue, totalValue);
        const explicitWholeScope = !totalCategory ||
          totalCategory.wholeSampleScope ||
          isGenericParticipantCategoryLabel(totalCategory.label);
        (explicitWholeScope ? explicitWholeValues : fallbackValues).add(totalValue);
      }
      continue;
    }
    const subgroupCue = normalized.search(/\b(?:neist|nendest|sealhulgas|sh|millest)\b/u);
    if (subgroupCue < 0 || claims.length < 2) continue;
    const firstClaimBeforeSubgroup = [...claims].reverse().find(claim => claim.index < subgroupCue);
    if (firstClaimBeforeSubgroup) fallbackValues.add(firstClaimBeforeSubgroup.value);
  }
  return explicitWholeValues.size
    ? explicitWholeValues
    : includeFallback
      ? fallbackValues
      : new Set();
}

function asksForNumericFact(message = "") {
  const normalized = normalizeText(message);
  return /%|(?:^|[^\p{L}\p{N}])(?:arv(?:u|ud|ust|uga)?|koguarv\p{L}*|uldarv\p{L}*|kokku|kui\s+palju|mitu|nait(?:aja|ude?)\p{L}*|osakaal\p{L}*|protsent\p{L}*|millal|mis\s+aastal|millisel\s+aastal|how\s+many|number\s+of|total|percentage|percent|when|what\s+year|which\s+year|сколько|число|итого|всего|процент\p{L}*|когда|каком\s+году)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function asksForYear(message = "") {
  const normalized = normalizeText(message);
  if (/\b(?:mis\s+aasta(?:l|st)?|millisel\s+aastal|mis\s+ajast)\b/u.test(normalized)) return true;
  if (!/\bmillal\b/u.test(normalized)) return false;
  return !/\b(?:jarelhind\w*|jarelmoj\w*|parast|moodudes|kest\w*|intervall\w*|paev\w*|nadal\w*|kuu|kuud|kuuga|kuul|aasta\s+parast)\b/u.test(normalized);
}

function extractPercentCountRelations(value = "") {
  const text = stripStructuralNumbers(value);
  const relations = [];
  for (const match of text.matchAll(/(?<![\p{L}\d])(\d+(?:[.,]\d+)?)\s*%\s*(?:\(|\[)?\s*n\s*[:=]\s*(\d+(?:[ .]\d{3})*|\d+)(?:\)|\])?/giu)) {
    const percent = normalizeNumber(match[1]);
    const count = normalizeNumber(match[2]);
    if (!percent || !count) continue;
    relations.push({
      percent,
      count,
      index: match.index || 0
    });
  }
  return relations;
}

function sentenceAroundIndex(value = "", index = 0) {
  const text = String(value || "");
  const start = Math.max(
    text.lastIndexOf(".", Math.max(0, index - 1)),
    text.lastIndexOf("!", Math.max(0, index - 1)),
    text.lastIndexOf("?", Math.max(0, index - 1)),
    text.lastIndexOf("\n", Math.max(0, index - 1))
  ) + 1;
  const endings = [".", "!", "?", "\n"]
    .map(separator => text.indexOf(separator, index))
    .filter(position => position >= 0);
  const end = endings.length ? Math.min(...endings) : text.length;
  return text.slice(start, end);
}

function paragraphAroundIndex(value = "", index = 0) {
  const text = String(value || "");
  const startSeparator = text.lastIndexOf("\n\n", Math.max(0, index - 1));
  const start = startSeparator >= 0 ? startSeparator + 2 : 0;
  const endSeparator = text.indexOf("\n\n", index);
  const end = endSeparator >= 0 ? endSeparator : text.length;
  return text.slice(start, end);
}

function contactPhoneClaims(value = "") {
  const claims = [];
  for (const match of String(value || "").matchAll(/(?<!\d)\+?\d(?:[\s()-]*\d){6,11}(?!\d)/gu)) {
    const raw = String(match[0] || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/u.test(raw)) continue;
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("372") && (digits.length === 10 || digits.length === 11)) {
      digits = digits.slice(3);
    }
    if (digits.length < 7 || digits.length > 8) continue;
    claims.push({
      value: digits,
      index: match.index || 0,
      end: (match.index || 0) + raw.length
    });
  }
  return claims;
}

function contactNumericClaims(value = "") {
  const text = String(value || "");
  const claims = [];
  for (const match of text.matchAll(/(?<![\p{L}\d])(?:\d{1,3}(?:[ .]\d{3})+|\d+)(?:[.,]\d+)?\s*%?/gu)) {
    const raw = String(match[0] || "").trim();
    const index = match.index || 0;
    const end = index + raw.length;
    const lineStart = text.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
    const linePrefix = text.slice(lineStart, index);
    const structuralListNumber = /^\s*$/u.test(linePrefix) && /^[.)]\s/u.test(text.slice(end));
    const bracketCitation = text[index - 1] === "[" && text[end] === "]";
    if (structuralListNumber || bracketCitation) continue;
    const normalized = normalizeNumber(raw);
    const numeric = Number(normalized);
    if (!normalized || !Number.isFinite(numeric)) continue;
    claims.push({
      value: normalized,
      numeric,
      percentage: raw.endsWith("%"),
      year: Number.isInteger(numeric) && numeric >= YEAR_MIN && numeric <= YEAR_MAX,
      index
    });
  }
  for (const match of text.matchAll(/\p{L}+/gu)) {
    const rawWord = String(match[0] || "");
    const word = normalizeText(rawWord);
    const followingText = normalizeText(text.slice((match.index || 0) + rawWord.length));
    if (word === "viis" && /^(?:labi|ellu|edasi|sisse|valja)\b/u.test(followingText)) continue;
    const mapped = ESTONIAN_SMALL_NUMBER_FORMS.find(([, pattern]) => pattern.test(word));
    if (!mapped) continue;
    claims.push({
      value: String(mapped[0]),
      numeric: mapped[0],
      percentage: false,
      year: false,
      index: match.index || 0
    });
  }
  return claims.sort((left, right) => left.index - right.index);
}

function contactEmailClaims(value = "") {
  const claims = [];
  for (const match of String(value || "").matchAll(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/giu)) {
    const raw = String(match[0] || "").trim();
    claims.push({
      value: raw.toLocaleLowerCase("et"),
      index: match.index || 0,
      end: (match.index || 0) + raw.length
    });
  }
  return claims;
}

function contactDateClaims(value = "") {
  const claims = [];
  for (const match of String(value || "").matchAll(/(?<!\d)(?:(\d{4})[-./](\d{1,2})[-./](\d{1,2})|(\d{1,2})[-./](\d{1,2})[-./](\d{4}))(?!\d)/gu)) {
    const year = Number(match[1] || match[6]);
    const month = Number(match[2] || match[5]);
    const day = Number(match[3] || match[4]);
    if (year < YEAR_MIN || year > YEAR_MAX || month < 1 || month > 12 || day < 1 || day > 31) continue;
    const raw = String(match[0] || "");
    claims.push({
      value: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      index: match.index || 0,
      end: (match.index || 0) + raw.length
    });
  }
  return claims;
}

function contactItemBoundsAroundIndex(value = "", index = 0, contacts = []) {
  const text = String(value || "");
  const lines = [];
  for (const match of text.matchAll(/^.*$/gmu)) {
    const lineText = String(match[0] || "");
    const bulletMatch = lineText.match(/^(\s*)(?:[-*•]|\d{1,3}[.)])\s+/u);
    lines.push({
      text: lineText,
      start: match.index || 0,
      end: (match.index || 0) + lineText.length,
      bullet: Boolean(bulletMatch),
      indentation: String(bulletMatch?.[1] || "").replace(/\t/gu, "    ").length
    });
  }
  const currentIndex = Math.max(0, lines.findIndex(line => index >= line.start && index <= line.end));
  let startIndex = currentIndex;
  if (!lines[currentIndex]?.bullet) {
    for (let cursor = currentIndex - 1; cursor >= Math.max(0, currentIndex - 3); cursor -= 1) {
      if (!String(lines[cursor]?.text || "").trim()) break;
      startIndex = cursor;
      if (lines[cursor]?.bullet) break;
    }
  }

  const initialIndentation = lines[startIndex]?.indentation || 0;
  if (
    lines[startIndex]?.bullet &&
    contacts.length &&
    !contactKnownNamesInItem(lines[startIndex]?.text, contacts).length
  ) {
    for (let cursor = startIndex - 1; cursor >= Math.max(0, startIndex - 8); cursor -= 1) {
      const line = lines[cursor];
      if (!String(line?.text || "").trim()) continue;
      if (
        line?.bullet &&
        line.indentation < initialIndentation &&
        contactKnownNamesInItem(line.text, contacts).length
      ) {
        startIndex = cursor;
        break;
      }
    }
  }

  const rootIndentation = lines[startIndex]?.indentation || 0;
  let endIndex = Math.max(currentIndex, startIndex);
  for (let cursor = endIndex + 1; cursor < Math.min(lines.length, startIndex + 10); cursor += 1) {
    const line = String(lines[cursor]?.text || "");
    if (!line.trim()) break;
    if (lines[cursor]?.bullet && lines[cursor].indentation <= rootIndentation) break;
    endIndex = cursor;
  }
  const start = lines[startIndex]?.start || 0;
  const end = lines[endIndex]?.end || text.length;
  return { text: text.slice(start, end), start, end };
}

function structuredContactEvidence(retrievalMeta = null) {
  const raw = retrievalMeta?.serviceMapKovContactEvidence;
  if (!raw || typeof raw !== "object" || raw.enabled !== true) return null;
  const contacts = (Array.isArray(raw.contacts) ? raw.contacts : [])
    .map(contact => ({
      sourceId: String(contact?.sourceId || "").trim(),
      name: String(contact?.name || "").trim(),
      role: String(contact?.role || "").trim(),
      roleFamily: String(contact?.roleFamily || "").trim(),
      municipality: String(contact?.municipality || "").trim(),
      phones: contactPhoneClaims(contact?.phone).map(claim => claim.value),
      emails: contactEmailClaims(contact?.email).map(claim => claim.value),
      addressNumbers: new Set(numericClaims(contact?.address).map(claim => claim.value)),
      checkedAt: String(contact?.verifiedAt || contact?.checkedAt || "").trim()
    }))
    .filter(contact => contact.sourceId && contact.name);
  const roleEntry = entry => ({
    municipality: String(entry?.municipality || "").trim(),
    label: String(entry?.label || "").trim(),
    count: Number(entry?.count)
  });
  const activeScopeRaw = raw.activeScope && typeof raw.activeScope === "object" ? raw.activeScope : null;
  const activeScopeSourceIds = new Set(
    (Array.isArray(activeScopeRaw?.sourceIds) ? activeScopeRaw.sourceIds : [])
      .map(value => String(value || "").trim())
      .filter(sourceId => contacts.some(contact => contact.sourceId === sourceId))
  );
  const rawSchedule = retrievalMeta?.serviceMapKovContactCheckSchedule;
  return {
    totalCount: Number.isInteger(Number(raw.totalCount)) ? Number(raw.totalCount) : contacts.length,
    municipalities: (Array.isArray(raw.municipalities) ? raw.municipalities : [])
      .map(entry => ({ name: String(entry?.name || "").trim(), count: Number(entry?.count) }))
      .filter(entry => entry.name && Number.isInteger(entry.count)),
    roles: (Array.isArray(raw.roles) ? raw.roles : [])
      .map(roleEntry)
      .filter(entry => entry.label && Number.isInteger(entry.count)),
    roleFamilies: (Array.isArray(raw.roleFamilies) ? raw.roleFamilies : [])
      .map(roleEntry)
      .filter(entry => entry.label && Number.isInteger(entry.count)),
    activeScope: activeScopeRaw ? {
      kind: String(activeScopeRaw.kind || "").trim() || "all",
      contextual: activeScopeRaw.contextual === true,
      count: Number.isInteger(Number(activeScopeRaw.count)) ? Number(activeScopeRaw.count) : activeScopeSourceIds.size,
      sourceIds: activeScopeSourceIds,
      roles: (Array.isArray(activeScopeRaw.roles) ? activeScopeRaw.roles : [])
        .map(roleEntry)
        .filter(entry => entry.label && Number.isInteger(entry.count)),
      roleFamilies: (Array.isArray(activeScopeRaw.roleFamilies) ? activeScopeRaw.roleFamilies : [])
        .map(roleEntry)
        .filter(entry => entry.label && Number.isInteger(entry.count)),
      requestedRoleFamilies: (Array.isArray(activeScopeRaw.requestedRoleFamilies) ? activeScopeRaw.requestedRoleFamilies : [])
        .map(roleEntry)
        .filter(entry => entry.label && Number.isInteger(entry.count))
    } : null,
    contacts,
    checkSchedule: rawSchedule && typeof rawSchedule === "object" ? {
      cadence: String(rawSchedule.cadence || "").trim().toLowerCase(),
      sourceId: String(rawSchedule.sourceId || "").trim()
    } : null
  };
}

function contactCheckCadenceClaims(value = "") {
  const normalized = normalizeText(value);
  const claims = [];
  if (/(?:^|[^\p{L}\p{N}])(?:kord\s+nadala\p{L}*|iga\s+nadal\p{L}*|once\s+(?:a|per)\s+week|every\s+week|weekly|раз\s+в\s+недел\p{L}*|кажд\p{L}*\s+недел\p{L}*|еженедельн\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized)) claims.push("weekly");
  if (/(?:^|[^\p{L}\p{N}])(?:iga\s+paev\p{L}*|kord\s+paevas|daily|every\s+day|ежедневн\p{L}*|кажд\p{L}*\s+день)(?=$|[^\p{L}\p{N}])/u.test(normalized)) claims.push("daily");
  if (/(?:^|[^\p{L}\p{N}])(?:kord\s+kuus|iga\s+kuu|monthly|every\s+month|ежемесячн\p{L}*|кажд\p{L}*\s+месяц)(?=$|[^\p{L}\p{N}])/u.test(normalized)) claims.push("monthly");
  return [...new Set(claims)];
}

function asksForContactCheckCadence(value = "") {
  const normalized = normalizeText(value);
  return /(?:^|[^\p{L}\p{N}])(?:kui\s+tihti|mis\s+sagedus\p{L}*|how\s+often|what\s+frequency|как\s+часто|с\s+какой\s+частот\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function contactLabelMentioned(value = "", label = "") {
  const expected = significantCategoryLabelTokens(label);
  if (!expected.length) return false;
  const actual = normalizeText(value).match(/[\p{L}]+/gu) || [];
  const required = expected.length === 1 ? 1 : Math.max(2, Math.ceil(expected.length * 0.6));
  return expected.filter(token => actual.some(candidate => categoryTokenMatches(token, candidate))).length >= required;
}

function contactRoleLabelMentioned(value = "", label = "") {
  return contactRoleTextMatches(value, label);
}

function contactTotalScopeMentioned(value = "") {
  const normalized = normalizeText(value);
  return /(?:^|[^\p{L}\p{N}])(?:kontakt\p{L}*|kontaktikirj\p{L}*|nimekirj\p{L}*|teenusekaart\p{L}*|contact\p{L}*|record\p{L}*|public\s+list\p{L}*|контакт\p{L}*|контактн\p{L}*\s+запис\p{L}*|список\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function contactCountWorkforceClaim(value = "") {
  const normalized = normalizeText(value);
  return /(?:^|[^\p{L}\p{N}])(?:tootab\p{L}*|tootaj\p{L}*|inime\p{L}*|personali\p{L}*|headcount|employee\p{L}*|staff|people|work\p{L}*|сотрудник\p{L}*|работа\p{L}*|человек\p{L}*|штат\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function contactCountExplicitlyDistinguished(value = "") {
  const normalized = normalizeText(value);
  return /(?:kontakt\p{L}*|contact\p{L}*|контакт\p{L}*)[\s\S]{0,90}(?:mitte|ei\s+ole|not|isn'?t|не\s+(?:является|означает))[\s\S]{0,90}(?:personali\p{L}*|tootaj\p{L}*|headcount|employee\p{L}*|staff|сотрудник\p{L}*|штат\p{L}*)/u.test(normalized);
}

function contactTotalClaimScopeSupported(value = "") {
  if (!contactTotalScopeMentioned(value)) return false;
  return !contactCountWorkforceClaim(value) || contactCountExplicitlyDistinguished(value);
}

function asksForCombinedContactTotal(message = "") {
  const normalized = normalizeText(message);
  return /(?:^|[^\p{L}\p{N}])(?:kokku|uhtekokku|combined|in\s+total|altogether|итого|всего)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function asksForCompleteContactList(message = "") {
  const normalized = normalizeText(message);
  const asksWhoTheyAre = /(?:^|[^\p{L}\p{N}])(?:kes\s+(?:nad|need)\s+on|mis\s+on\s+(?:(?:nende|kontakt\p{L}*)\s+)?(?:nimed|rollid|ametinimetused)|kontakt\p{L}*\s+nimed|(?:nende|neil)\s+(?:nimed|rollid|ametinimetused)|who\s+(?:are\s+)?they|what\s+are\s+(?:(?:their|contact\p{L}*)\s+)?(?:names|roles|job\s+titles)|contact\p{L}*\s+names|their\s+(?:names|roles|job\s+titles)|кто\s+они|как\s+их\s+зовут|какие\s+у\s+них\s+должности|имена\s+контакт\p{L}*|их\s+(?:имена|должности))(?=$|[^\p{L}\p{N}])/u.test(normalized);
  if (asksWhoTheyAre) return true;
  const contactCue = /(?:^|[^\p{L}\p{N}])(?:kontakt\p{L}*|tootaj\p{L}*|sotsiaaltootaj\p{L}*|spetsialist\p{L}*|ametnik\p{L}*|sotsiaalosakon\p{L}*|contact\p{L}*|employee\p{L}*|staff|specialist\p{L}*|social\s+department\p{L}*|контакт\p{L}*|сотрудник\p{L}*|специалист\p{L}*|социальн\p{L}*\s+отдел\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  const explicitAll = /(?:^|[^\p{L}\p{N}])(?:koik|kogu\s+nimekir\p{L}*|loetle\p{L}*|nimeta\p{L}*|naita\p{L}*|millise\p{L}*|list\s+all|list|name\p{L}*|show\p{L}*|which|all\s+(?:the\s+)?(?:contact\p{L}*|employee\p{L}*|staff|specialist\p{L}*)|перечисл\p{L}*|назов\p{L}*|покаж\p{L}*|какие|все)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  return contactCue && explicitAll;
}

function contactAnswerIntent(message = "") {
  const normalized = normalizeText(message);
  const contactSubject = /(?:^|[^\p{L}\p{N}])(?:kontakt\p{L}*|tootaj\p{L}*|sotsiaaltootaj\p{L}*|spetsialist\p{L}*|ametnik\p{L}*|sotsiaalosakon\p{L}*|contact\p{L}*|employee\p{L}*|staff|social\s+worker\p{L}*|specialist\p{L}*|official\p{L}*|social\s+department\p{L}*|контакт\p{L}*|сотрудник\p{L}*|работник\p{L}*|специалист\p{L}*|социальн\p{L}*\s+отдел\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  const wantsContactCount = contactSubject && /(?:^|[^\p{L}\p{N}])(?:mitu|kui\s+palju|arv\p{L}*|koguarv\p{L}*|uldarv\p{L}*|how\s+many|number\s+of|contact\s+count|staff\s+count|сколько|число|количество)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  const wantsPresence = contactSubject && /(?:^|[^\p{L}\p{N}])(?:kas|on|olemas|leidub|tootab\p{L}*|do|does|has|have|is|are|exists?|available|works?|working|есть|имеется|работает|работают)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  return {
    wantsPhone: /(?:^|[^\p{L}\p{N}])(?:telefon\p{L}*|phone\p{L}*|телефон\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized),
    wantsEmail: /(?:^|[^\p{L}\p{N}])(?:e-post\p{L}*|epost\p{L}*|e-mail\p{L}*|email\p{L}*|meiliaadress\p{L}*|mail\s+address\p{L}*|почт\p{L}*|электронн\p{L}*\s+почт\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized),
    wantsContactDetails: /(?:^|[^\p{L}\p{N}])(?:kontaktandm\p{L}*|kontaktinfo\p{L}*|contact\s+(?:details?|information)|контактн\p{L}*\s+(?:данн\p{L}*|информац\p{L}*))(?=$|[^\p{L}\p{N}])/u.test(normalized),
    wantsIdentity: /(?:^|[^\p{L}\p{N}])(?:kes|kelle\s+poole|millise\p{L}*|nimeta\p{L}*|loetle\p{L}*|naita\p{L}*|kontakt\p{L}*\s+nimed|(?:nende|neil)\s+(?:nimed|rollid|ametinimetused)|mis\s+on\s+nende\s+(?:nimed|rollid|ametinimetused)|who|which|name\p{L}*|list\p{L}*|show\p{L}*|contact\p{L}*\s+names|their\s+(?:names|roles|job\s+titles)|what\s+are\s+their\s+(?:names|roles|job\s+titles)|кто|какие|назов\p{L}*|перечисл\p{L}*|покаж\p{L}*|имена\s+контакт\p{L}*|как\s+их\s+зовут|какие\s+у\s+них\s+должности|их\s+(?:имена|должности))(?=$|[^\p{L}\p{N}])/u.test(normalized),
    wantsFreshness: /(?:^|[^\p{L}\p{N}])(?:varsk\p{L}*|ajakohas\p{L}*|kontrolli\p{L}*|kontrollit\p{L}*|kontrollkuupaev\p{L}*|millal\s+kontroll|kui\s+tihti|fresh\p{L}*|up\s+to\s+date|verif(?:y|ied|ication)\p{L}*|check\p{L}*|last\s+check\p{L}*|how\s+often|актуальн\p{L}*|свеж\p{L}*|провер\p{L}*|как\s+часто)(?=$|[^\p{L}\p{N}])/u.test(normalized),
    wantsContactCount,
    wantsPresence
  };
}

function contactAnswerIntentRequested(message = "") {
  return Object.values(contactAnswerIntent(message)).some(Boolean);
}

function asksForPluralContactValues(message = "", answerIntent = {}) {
  if (!answerIntent.wantsPhone && !answerIntent.wantsEmail && !answerIntent.wantsContactDetails) return false;
  const normalized = normalizeText(message);
  return /(?:^|[^\p{L}\p{N}])(?:(?:nende|neil|need|neid)\p{L}*[^.!?]{0,50}(?:telefonid|telefoninumbrid|e-postid|epostid|kontaktandmed)|(?:telefonid|telefoninumbrid|e-postid|epostid|kontaktandmed)[^.!?]{0,50}(?:nende|neil|need|neid)\p{L}*|their\s+(?:phones|phone\s+numbers|emails|e-mail\s+addresses|contact\s+details)|(?:these|those)\s+contacts?[^.!?]{0,40}(?:phones|emails|details)|их\s+(?:телефоны|номера\s+телефонов|адреса\s+электронной\s+почты|контактные\s+данные))(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function contactKnownNamesInItem(item = "", contacts = []) {
  const normalized = normalizeText(item);
  return contacts.filter(contact => normalized.includes(normalizeText(contact.name)));
}

function contactTupleRelationFailures(reply = "", claims = [], contacts = [], valueKey = "phones", targetSourceIds = null) {
  const unsupported = [];
  const mismatched = [];
  const implicitTarget = targetSourceIds?.size === 1
    ? contacts.find(contact => targetSourceIds.has(contact.sourceId)) || null
    : null;
  for (const claim of claims) {
    const owners = contacts.filter(contact => contact[valueKey].includes(claim.value));
    if (!owners.length) {
      unsupported.push(claim.value);
      continue;
    }
    const segmentOwner = nearestContactOwnerAtIndex(reply, claim.index, contacts) || implicitTarget;
    const targetMismatch = targetSourceIds?.size && !targetSourceIds.has(segmentOwner?.sourceId);
    if (!segmentOwner || targetMismatch || !owners.some(owner => owner.sourceId === segmentOwner.sourceId)) {
      mismatched.push(claim.value);
    }
  }
  return { unsupported, mismatched };
}

function escapeRegex(value = "") {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function contactNameOccurrences(bounds = {}, contacts = []) {
  const item = String(bounds?.text || "");
  const occurrences = [];
  for (const contact of contacts) {
    if (!contact?.name) continue;
    const pattern = new RegExp(escapeRegex(contact.name), "giu");
    for (const match of item.matchAll(pattern)) {
      occurrences.push({
        contact,
        index: Number(bounds?.start || 0) + (match.index || 0),
        end: Number(bounds?.start || 0) + (match.index || 0) + String(match[0] || "").length
      });
    }
  }
  return occurrences.sort((left, right) => left.index - right.index || left.end - right.end);
}

function nearestContactOwnerAtIndex(reply = "", index = 0, contacts = []) {
  const bounds = contactItemBoundsAroundIndex(reply, index, contacts);
  const occurrences = contactNameOccurrences(bounds, contacts);
  const preceding = occurrences.filter(entry => entry.index <= index).at(-1);
  if (preceding) return preceding.contact;
  return occurrences.length === 1 ? occurrences[0].contact : null;
}

function roleEntrySupportedForContact(entry = {}, contact = {}, contacts = []) {
  if (entry.municipality && normalizeText(entry.municipality) !== normalizeText(contact.municipality)) return false;
  const entryLabel = normalizeText(entry.label);
  const ownRole = normalizeText(contact.role);
  const ownFamily = normalizeText(contact.roleFamily);
  if (entryLabel === ownRole || entryLabel === ownFamily) return true;
  const entryFamilies = new Set(contacts
    .filter(candidate => normalizeText(candidate.role) === entryLabel || normalizeText(candidate.roleFamily) === entryLabel)
    .map(candidate => normalizeText(candidate.roleFamily))
    .filter(Boolean));
  return Boolean(ownFamily && entryFamilies.has(ownFamily));
}

function contactRoleRelationFailures(reply = "", evidence = null) {
  if (!evidence) return [];
  const roleEntries = [...evidence.roles, ...evidence.roleFamilies];
  const failures = [];
  for (const contact of evidence.contacts) {
    const namePattern = new RegExp(escapeRegex(contact.name), "giu");
    for (const match of String(reply || "").matchAll(namePattern)) {
      const matchIndex = match.index || 0;
      const bounds = contactItemBoundsAroundIndex(reply, matchIndex, evidence.contacts);
      const occurrences = contactNameOccurrences(bounds, evidence.contacts);
      const nextContact = occurrences.find(entry => entry.index > matchIndex);
      const item = occurrences.length === 1
        ? bounds.text
        : String(reply || "").slice(matchIndex, nextContact?.index || bounds.end);
      const claimedRoles = roleEntries.filter(entry => contactRoleLabelMentioned(item, entry.label));
      if (!claimedRoles.length) continue;
      const relationSupported = claimedRoles.every(entry =>
        roleEntrySupportedForContact(entry, contact, evidence.contacts)
      );
      if (!relationSupported) failures.push(contact.name);
    }
  }
  return [...new Set(failures)];
}

function missingRequiredContactRoles(reply = "", requiredContacts = [], evidence = null) {
  if (!evidence) return [];
  const roleEntries = [...evidence.roles, ...evidence.roleFamilies];
  const missing = [];
  for (const contact of requiredContacts) {
    if (!contact?.name || !contact?.role || normalizeText(contact.role) === "roll markimata") continue;
    const namePattern = new RegExp(escapeRegex(contact.name), "giu");
    const occurrences = [...String(reply || "").matchAll(namePattern)];
    if (!occurrences.length) continue;
    const hasOwnRole = occurrences.some(match => {
      const bounds = contactItemBoundsAroundIndex(reply, match.index || 0, evidence.contacts);
      return roleEntries.some(entry =>
        contactRoleLabelMentioned(bounds.text, entry.label) &&
        roleEntrySupportedForContact(entry, contact, evidence.contacts)
      );
    });
    if (!hasOwnRole) missing.push(contact.name);
  }
  return [...new Set(missing)];
}

function unexpectedContactPersonClaims(reply = "", evidence = null, allowedContacts = null) {
  if (!evidence) return [];
  const allowed = Array.isArray(allowedContacts) ? allowedContacts : evidence.contacts;
  const knownNames = allowed.map(contact => normalizeText(contact.name)).filter(Boolean);
  const roleLabels = [...evidence.roles, ...evidence.roleFamilies].map(entry => entry.label);
  const municipalityNames = evidence.municipalities.map(entry => normalizeText(entry.name));
  const unexpected = [];
  for (const line of String(reply || "").split(/[\r\n]+/u)) {
    let cleaned = line.replace(/[*_`]/gu, " ");
    for (const contact of allowed) {
      if (!contact?.name) continue;
      cleaned = cleaned.replace(new RegExp(escapeRegex(contact.name), "giu"), " ");
    }
    for (const match of cleaned.matchAll(/(?:^|[^\p{L}])([\p{Lu}][\p{L}'’.-]*(?:\s+[\p{Lu}][\p{L}'’.-]*){1,3})(?=$|[^\p{L}])/gu)) {
      const fullCandidate = String(match[1] || "").trim();
      const normalizedFullCandidate = normalizeText(fullCandidate);
      if (!normalizedFullCandidate || knownNames.some(name => normalizedFullCandidate.includes(name))) continue;
      if (/(?:^|\s)(?:the\s+)?service\s+map(?:$|\s)/u.test(normalizedFullCandidate)) continue;
      const candidate = fullCandidate.split(/\s+/u).slice(0, 2).join(" ");
      const normalizedCandidate = normalizeText(candidate);
      if (municipalityNames.some(name => normalizedCandidate.includes(name))) continue;
      if (roleLabels.some(label => contactRoleLabelMentioned(candidate, label))) continue;
      if (/(?:linnavalitsus|vallavalitsus|sotsiaalosakond|teenusekaart|kontakt|allikas|source|municipal|social\s+department|источник|муниципал)/u.test(normalizedCandidate)) continue;
      unexpected.push(candidate);
    }
  }
  return [...new Set(unexpected)];
}

function contactCountClaimSupported(message = "", reply = "", claim = {}, evidence = null) {
  if (!evidence || claim.percentage) return false;
  const sentence = sentenceAroundIndex(reply, claim.index || 0);
  if (
    ["subset", "known_zero"].includes(evidence.activeScope?.kind) &&
    claim.numeric === evidence.activeScope.count &&
    contactTotalClaimScopeSupported(sentence) &&
    (
      evidence.activeScope.contextual ||
      [
        ...evidence.activeScope.roles,
        ...evidence.activeScope.roleFamilies,
        ...evidence.activeScope.requestedRoleFamilies
      ]
        .some(entry => contactRoleLabelMentioned(sentence, entry.label))
    )
  ) {
    return true;
  }
  const municipalityCounts = evidence.municipalities.length
    ? evidence.municipalities
    : [{ name: "", count: evidence.totalCount }];
  if (asksForCombinedContactTotal(message) && claim.numeric === evidence.totalCount && contactTotalClaimScopeSupported(sentence)) {
    return true;
  }
  if (municipalityCounts.some(entry =>
    claim.numeric === entry.count &&
    contactTotalClaimScopeSupported(sentence) &&
    (municipalityCounts.length === 1 || contactLabelMentioned(sentence, entry.name))
  )) {
    return true;
  }
  return [...evidence.roles, ...evidence.roleFamilies].some(entry =>
    claim.numeric === entry.count &&
    contactRoleLabelMentioned(sentence, entry.label) &&
    (!contactCountWorkforceClaim(sentence) || contactTotalScopeMentioned(sentence) || contactCountExplicitlyDistinguished(sentence)) &&
    (municipalityCounts.length === 1 || contactLabelMentioned(sentence, entry.municipality))
  );
}

function requestedContactRoleCounts(message = "", evidence = null) {
  if (!evidence) return [];
  if (evidence.activeScope?.contextual) return [];
  const requestedFamilies = (Array.isArray(evidence.activeScope?.requestedRoleFamilies)
    ? evidence.activeScope.requestedRoleFamilies
    : []).filter(entry => contactRoleLabelMentioned(message, entry.label));
  if (requestedFamilies.length) return requestedFamilies;
  const matchedFamilies = evidence.roleFamilies.filter(entry => contactRoleLabelMentioned(message, entry.label));
  if (matchedFamilies.length) return matchedFamilies;
  return evidence.roles.filter(entry => contactRoleLabelMentioned(message, entry.label));
}

function contactRoleCountSeen(reply = "", claims = [], entry = {}) {
  return claims.some(claim => {
    if (claim.numeric !== entry.count) return false;
    const sentence = sentenceAroundIndex(reply, claim.index || 0);
    return contactRoleLabelMentioned(sentence, entry.label) &&
      (!contactCountWorkforceClaim(sentence) || contactTotalScopeMentioned(sentence) || contactCountExplicitlyDistinguished(sentence));
  });
}

function contactAuxiliaryNumericClaimSupported(reply = "", claim = {}, evidence = null) {
  const sentence = sentenceAroundIndex(reply, claim.index || 0);
  if (claim.year) {
    const checkedYears = new Set(evidence.contacts
      .map(contact => Number(contact.checkedAt.slice(0, 4)))
      .filter(year => Number.isInteger(year)));
    return checkedYears.has(claim.numeric) && /(?:kontroll|varsk|verified|checked|провер\p{L}*)/u.test(normalizeText(sentence));
  }
  return evidence.contacts.some(contact =>
    contact.addressNumbers.has(claim.value) &&
    (normalizeText(sentence).includes(normalizeText(contact.name)) || /(?:aadress|address|адрес)/u.test(normalizeText(sentence)))
  );
}

function isMunicipalityContactInventory(retrievalMeta = null) {
  const queryPlan = retrievalMeta?.queryPlan && typeof retrievalMeta.queryPlan === "object"
    ? retrievalMeta.queryPlan
    : {};
  const mode = String(queryPlan?.mode || queryPlan?.queryPlanMode || "").trim();
  const strategy = String(queryPlan?.selection_strategy || queryPlan?.selectionStrategy || "").trim();
  return mode === "municipality_contact_list" || strategy === "municipality_contact_inventory";
}

function durationClaimSupportedByEquivalentWording(reply = "", claim = {}, source = {}) {
  if (claim.value !== "12" || claim.percentage || claim.year) return false;
  const replySentence = normalizeText(sentenceAroundIndex(reply, claim.index || 0));
  const claimsTwelveMonths = /(?<![\p{L}\d])12(?:\s*[-–—]\s*|\s+)(?:kuu\p{L}*|month\p{L}*|месяц\p{L}*)(?![\p{L}\d])/u
    .test(replySentence);
  if (!claimsTwelveMonths) return false;

  const evidence = normalizeText(source.body);
  return /\b(?:viimase|eelneva|moodunud)\s+aasta(?:\s+jooksul)?\b/u.test(evidence) ||
    /\b(?:during\s+)?(?:the\s+)?(?:last|past|previous)\s+year\b/u.test(evidence) ||
    /\b(?:за\s+)?последн\p{L}*\s+год\p{L}*\b/u.test(evidence);
}

const CALENDAR_MONTH_PATTERNS = Object.freeze([
  /\b(?:jaanuar\p{L}*|january|январ\p{L}*)\b/u,
  /\b(?:veebruar\p{L}*|february|феврал\p{L}*)\b/u,
  /\b(?:marts\p{L}*|march|март\p{L}*)\b/u,
  /\b(?:aprill\p{L}*|april|апрел\p{L}*)\b/u,
  /\b(?:mai\p{L}*|may|ма[йя]\p{L}*)\b/u,
  /\b(?:juuni\p{L}*|june|июн\p{L}*)\b/u,
  /\b(?:juuli\p{L}*|july|июл\p{L}*)\b/u,
  /\b(?:august\p{L}*|август\p{L}*)\b/u,
  /\b(?:septembr\p{L}*|сентябр\p{L}*)\b/u,
  /\b(?:oktoobr\p{L}*|october|октябр\p{L}*)\b/u,
  /\b(?:novembr\p{L}*|ноябр\p{L}*)\b/u,
  /\b(?:detsembr\p{L}*|december|декабр\p{L}*)\b/u
]);

function calendarDateClaimSupportedByEquivalentWording(reply = "", claim = {}, source = {}) {
  if (claim.percentage || claim.year || !Number.isInteger(claim.numeric) || claim.numeric < 1 || claim.numeric > 31) {
    return false;
  }
  const claimIndex = Math.max(0, claim.index || 0);
  const replySentence = normalizeText(String(reply || "").slice(
    Math.max(0, claimIndex - 4),
    Math.min(String(reply || "").length, claimIndex + 96)
  ));
  const monthIndex = CALENDAR_MONTH_PATTERNS.findIndex(pattern => pattern.test(replySentence));
  if (monthIndex < 0) return false;
  const dayPattern = new RegExp(`(?<![\\p{L}\\d])${claim.numeric}\\.?\\s+`, "u");
  if (!dayPattern.test(replySentence)) return false;
  const replyYears = numericClaims(replySentence).filter(item => item.year).map(item => item.value);
  if (!replyYears.length) return false;

  const day = String(claim.numeric).padStart(2, "0");
  const month = String(monthIndex + 1).padStart(2, "0");
  return replyYears.some(year => new RegExp(
    `(?<!\\d)0?${day.replace(/^0/u, "")}[-./]0?${month.replace(/^0/u, "")}[-./]${year}(?!\\d)`,
    "u"
  ).test(source.body));
}

function numericDateClaimSupportedByEquivalentFormatting(reply = "", claim = {}, source = {}) {
  if (claim.percentage || claim.year) return false;
  const claimIndex = Math.max(0, claim.index || 0);
  const localReply = String(reply || "").slice(
    claimIndex,
    Math.min(String(reply || "").length, claimIndex + 32)
  );
  const fullNumericDate = localReply.match(/^(\d{1,2})[-./](\d{1,2})[-./]((?:19|20)\d{2})(?!\d)/u);
  if (fullNumericDate) {
    const day = Number(fullNumericDate[1]);
    const month = Number(fullNumericDate[2]);
    const year = fullNumericDate[3];
    if (
      [day, month].includes(claim.numeric) &&
      new RegExp(`(?<!\\d)0?${day}[-./]0?${month}[-./]${year}(?!\\d)`, "u").test(source.body)
    ) return true;
  }

  const datePrefix = String(claim.value || "").match(/^(\d{1,2})[.]([0-1]?\d)$/u);
  if (!datePrefix) return false;
  const replyYears = numericClaims(localReply).filter(item => item.year).map(item => item.value);
  if (!replyYears.length) return false;
  const day = Number(datePrefix[1]);
  const month = Number(datePrefix[2]);
  if (!Number.isInteger(day) || day < 1 || day > 31 || !Number.isInteger(month) || month < 1 || month > 12) {
    return false;
  }
  return replyYears.some(year => new RegExp(
    `(?<!\\d)0?${day}[-./]0?${month}[-./]${year}(?!\\d)`,
    "u"
  ).test(source.body));
}

function numericClaimSupportedBySource(reply = "", claim = {}, source = {}) {
  return source.allNumbers.has(claim.value) ||
    durationClaimSupportedByEquivalentWording(reply, claim, source) ||
    calendarDateClaimSupportedByEquivalentWording(reply, claim, source) ||
    numericDateClaimSupportedByEquivalentFormatting(reply, claim, source);
}

const CATEGORY_LABEL_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "consisted", "for", "from", "in", "included", "is", "of", "on", "or", "participated", "the", "to", "was", "were", "who", "with",
  "et", "iga", "ja", "kaasati", "kes", "koosnes", "kokku", "kui", "mida", "mis", "moodustas", "ning", "oli", "olid", "olema", "olnud", "oma", "on", "osaleb", "osales", "total", "voi",
  "был", "была", "были", "быть", "в", "включал", "включала", "включали", "всего", "есть", "и", "из", "или", "итого", "к", "как", "которые", "на", "по", "с", "состоял", "состояла", "состояло", "участвовал", "участвовали"
]);

const CATEGORY_LABEL_GENERIC_PREFIXES = [
  "group", "inime", "isik", "osalej", "participant", "person", "ruhm", "sihtruhm",
  "sample", "study", "uuring", "valim", "выборк", "групп", "исслед", "участник", "человек"
];

const CATEGORY_NUMBER_TOKEN_SOURCE = String.raw`(?:\d{1,3}(?:[ .]\d{3})+|\d+(?:[.,]\d+)?|null|uks|uht|uhe|kaks|kaht|kahe|kolm|kolme|neli|nelja|viis|viit|viie|kuus|kuut|kuue|seitse|seitset|seitsme|kaheksa|uheksa|kumme|kummet|one|two|three|four|five|six|seven|eight|nine|ten|один|одна|одно|одного|одной|одному|одним|одну|два|две|двух|двум|двумя|три|трех|трем|тремя|четыре|четырех|четырем|четырьмя|пять|пяти|пятью|шесть|шести|шестью|семь|семи|семью|восемь|восьми|восемью|девять|девяти|девятью|десять|десяти|десятью)`;

const PARTICIPANT_UNIT_SOURCE = String.raw`(?:inim\p{L}*|isik\p{L}*|osalej\p{L}*|vastaj\p{L}*|praktik\p{L}*|kohtunik\p{L}*|sotsiaaltootaj\p{L}*|tootaj\p{L}*|people|persons?|participants?|respondents?|practitioners?|judges?|workers?|social\s+workers?|человек\p{L}*|люд\p{L}*|лиц\p{L}*|участник\p{L}*|респондент\p{L}*|практик\p{L}*|суд(?:ья|ьи|ей|ье|ью|ьям|ьями|ьях)\p{L}*|работник\p{L}*|сотрудник\p{L}*)`;

function parsedCategoryNumberValue(value = "") {
  const normalized = normalizeText(value);
  const claim = normalizedNumericClaims(normalized).find(item => !item.year);
  if (claim) return claim.value;
  return NON_EST_SMALL_NUMBER_VALUES.get(normalized) || null;
}

function alignedCategoryNumericClaims(value = "") {
  const normalized = normalizeText(value);
  const claims = [];
  const pattern = new RegExp(
    `(?<![\\p{L}\\d])(${CATEGORY_NUMBER_TOKEN_SOURCE})(?=$|[^\\p{L}\\d])`,
    "gu"
  );
  for (const match of normalized.matchAll(pattern)) {
    const numberValue = parsedCategoryNumberValue(match[1]);
    const numeric = Number(numberValue);
    if (!numberValue || !Number.isFinite(numeric)) continue;
    claims.push({
      value: numberValue,
      numeric,
      year: Number.isInteger(numeric) && numeric >= YEAR_MIN && numeric <= YEAR_MAX,
      index: match.index || 0
    });
  }
  return claims;
}

function significantCategoryLabelTokens(value = "") {
  return (normalizeText(value).match(/[\p{L}]+/gu) || [])
    .filter(token => token.length >= 4)
    .filter(token => !CATEGORY_LABEL_STOP_WORDS.has(token))
    .filter(token => !CATEGORY_LABEL_GENERIC_PREFIXES.some(prefix => token.startsWith(prefix)));
}

function categoryTokenMatches(left = "", right = "") {
  if (left === right) return true;
  const prefixLength = Math.min(7, left.length, right.length);
  return prefixLength >= 5 && left.slice(0, prefixLength) === right.slice(0, prefixLength);
}

function containsCategoryNumber(value = "") {
  return new RegExp(`(?:^|[^\\p{L}\\d])${CATEGORY_NUMBER_TOKEN_SOURCE}(?=$|[^\\p{L}\\d])`, "u")
    .test(normalizeText(value));
}

function splitNumericCategorySegments(value = "") {
  const segments = [];
  for (const part of String(value || "").split(/;|(?:(?<!\d)[.]|[.](?!\d))|(?:(?<!\d),|,(?!\d))/u)) {
    const conjunctions = [...part.matchAll(/\s+(?:ja|ning|and|и)\s+|\s*:\s*/gu)];
    let start = 0;
    for (const conjunction of conjunctions) {
      const left = part.slice(start, conjunction.index || 0);
      const right = part.slice((conjunction.index || 0) + String(conjunction[0] || "").length);
      if (!containsCategoryNumber(left) || !containsCategoryNumber(right)) continue;
      segments.push(left);
      start = (conjunction.index || 0) + String(conjunction[0] || "").length;
    }
    segments.push(part.slice(start));
  }
  return segments.map(segment => segment.trim()).filter(Boolean);
}

function numericCategoryScope(value = "") {
  const normalized = normalizeText(value);
  const totalCue = /(?:^|[^\p{L}])(?:kokku|koguarv\p{L}*|uldarv\p{L}*|in\s+total|total|altogether|всего|итого)(?=$|[^\p{L}])/u.test(normalized);
  const wholeSampleCue = /(?:^|[^\p{L}])(?:valim\p{L}*|uuring\p{L}*|sample\p{L}*|study|выборк\p{L}*|исслед\p{L}*)(?=$|[^\p{L}])/u.test(normalized);
  return { explicitTotal: totalCue, wholeSample: wholeSampleCue };
}

function categorySemanticTokens(value = "") {
  return (normalizeText(value).match(/[\p{L}]+/gu) || [])
    .filter(token => !CATEGORY_LABEL_STOP_WORDS.has(token))
    .filter(token => !["altogether", "koguarv", "uldarv"].some(prefix => token.startsWith(prefix)));
}

function isEntityCoverageCategoryLabel(value = "") {
  const normalized = normalizeText(value);
  const groupCue = uniformGroupCue(normalized);
  const prefixTokens = groupCue
    ? significantCategoryLabelTokens(normalized.slice(0, groupCue.index || 0))
    : [];
  const tokens = categorySemanticTokens(value);
  const finalToken = prefixTokens.at(-1) || tokens.at(-1) || "";
  return /^(?:kohus\p{L}*|kohtu\p{L}*|maakoh\p{L}*|asutus\p{L}*|asutuse\p{L}*|erihoolekandeasut\p{L}*|omavalits\p{L}*|kov|linn\p{L}*|vald\p{L}*|maakond\p{L}*|piirkond\p{L}*|asukoht\p{L}*|organisatsioon\p{L}*|uhing\p{L}*|uksus\p{L}*|kool\p{L}*|haigla\p{L}*|teenus\p{L}*|koolitus\p{L}*|allik\p{L}*|artikkel\p{L}*|dokum\p{L}*|aasta\p{L}*|protsent\p{L}*|riik\p{L}*|voor\p{L}*|etapp\p{L}*|faas\p{L}*|intervjuu\p{L}*|kusimus\p{L}*|meetod\p{L}*|teema\p{L}*|juhtum\p{L}*|kord\p{L}*|minut\p{L}*|tund\p{L}*|paev\p{L}*|nadal\p{L}*|kuu\p{L}*|euro\p{L}*|courts?|institutions?|municipalit\p{L}*|authorit\p{L}*|cities|city|counties|county|regions?|locations?|organi[sz]ations?|schools?|hospitals?|services?|trainings?|sources?|articles?|documents?|years?|countries|country|rounds?|stages?|phases?|interviews?|questions?|methods?|topics?|cases?|times?|minutes?|hours?|days?|weeks?|months?|euros?|суд(?:ы|а|ов|ам|ами|ах)\p{L}*|учрежд\p{L}*|муниципал\p{L}*|город\p{L}*|район\p{L}*|регион\p{L}*|мест\p{L}*|организац\p{L}*|школ\p{L}*|больниц\p{L}*|услуг\p{L}*|обучен\p{L}*|источник\p{L}*|стат\p{L}*|документ\p{L}*|год\p{L}*|стран\p{L}*|этап\p{L}*|фаз\p{L}*|интервью\p{L}*|вопрос\p{L}*|метод\p{L}*|тем\p{L}*|случа\p{L}*|минут\p{L}*|час\p{L}*|дн\p{L}*|недел\p{L}*|месяц\p{L}*|евро\p{L}*)$/u.test(finalToken);
}

function extractNumericCategoryLabels(value = "") {
  const labels = [];
  for (const line of String(value || "").split(/[\r\n]+/u)) {
    for (const segment of splitNumericCategorySegments(line)) {
      const normalizedSegment = normalizeText(stripStructuralNumbers(segment));
      const numberFirst = normalizedSegment.match(new RegExp(
        `^(?:[-*•]\\s*)?(${CATEGORY_NUMBER_TOKEN_SOURCE})\\s*%?(?:\\s*[:=–—-]\\s*|\\s+)(.+?)\\s*[.]?\\s*$`,
        "u"
      ));
      const labelFirst = numberFirst ? null : normalizedSegment.match(new RegExp(
        `^(?:[-*•]\\s*)?(.+?)(?:\\s*[:=–—-]\\s*|\\s+)(${CATEGORY_NUMBER_TOKEN_SOURCE})\\s*%?\\s*[.]?\\s*$`,
        "u"
      ));
      const numberValue = parsedCategoryNumberValue(numberFirst?.[1] || labelFirst?.[2]);
      const label = String(numberFirst?.[2] || labelFirst?.[1] || "").trim();
      const tokens = significantCategoryLabelTokens(label);
      const categoryScope = numericCategoryScope(label);
      if (
        !numberValue ||
        !tokens.length
      ) continue;
      labels.push({
        value: numberValue,
        label,
        tokens,
        percentage: /%/u.test(normalizedSegment),
        explicitTotalScope: categoryScope.explicitTotal,
        wholeSampleScope: categoryScope.wholeSample
      });
    }
  }
  return labels;
}

function isGenericParticipantCategoryLabel(value = "") {
  const normalized = normalizeText(value);
  return /(?:^|[^\p{L}])(?:inim\p{L}*|isik\p{L}*|osalej\p{L}*|vastaj\p{L}*|praktik\p{L}*|people|persons?|participants?|respondents?|practitioners?|человек\p{L}*|люд\p{L}*|лиц\p{L}*|участник\p{L}*|респондент\p{L}*|практик\p{L}*)(?=$|[^\p{L}])/u.test(normalized);
}

function isGroupCountCategoryLabel(value = "") {
  const normalized = normalizeText(value);
  const tokens = categorySemanticTokens(value);
  const finalToken = tokens.at(-1) || "";
  const hasGroupHead = /^(?:.*(?:siht)?ruhm\p{L}*|.*groups?|.*categories?|.*групп\p{L}*|.*категор\p{L}*)$/u.test(finalToken);
  if (!hasGroupHead) return false;
  const groupCue = uniformGroupCue(normalized);
  if (!groupCue) return true;
  const prefix = normalized.slice(0, groupCue.index || 0);
  return significantCategoryLabelTokens(prefix).length === 0;
}

function categoryIsWholeTotal(category = {}, knownTotalValue = null) {
  const genericParticipant = isGenericParticipantCategoryLabel(category.label);
  if (
    category.explicitTotalScope &&
    genericParticipant &&
    knownTotalValue &&
    category.value === knownTotalValue
  ) return true;
  return Boolean(
    category.wholeSampleScope &&
    genericParticipant &&
    knownTotalValue &&
    category.value === knownTotalValue
  );
}

function categoryRepresentsParticipant(category = {}, knownTotalValue = null) {
  if (category.percentage || isGroupCountCategoryLabel(category.label)) return false;
  if (isEntityCoverageCategoryLabel(category.label)) return false;
  if (categoryIsWholeTotal(category, knownTotalValue)) return false;
  return true;
}

function countedParticipantValues(value = "") {
  const normalized = normalizeText(value);
  const matches = [];
  const pattern = new RegExp(
    `(?<![\\p{L}\\d])(${CATEGORY_NUMBER_TOKEN_SOURCE})\\s+(?:[\\p{L}-]+\\s+){0,2}?(${PARTICIPANT_UNIT_SOURCE})(?=$|[^\\p{L}])`,
    "gu"
  );
  for (const match of normalized.matchAll(pattern)) {
    const numberValue = parsedCategoryNumberValue(match[1]);
    if (!numberValue) continue;
    matches.push({
      value: numberValue,
      start: match.index || 0,
      end: (match.index || 0) + String(match[0] || "").length
    });
  }
  return matches;
}

function closestParticipantValue(counts = [], cue = null, maxDistance = 80) {
  if (!cue || !counts.length) return null;
  const cueStart = cue.index || 0;
  const cueEnd = cueStart + String(cue[0] || "").length;
  const ranked = counts
    .map(count => ({
      ...count,
      distance: count.end <= cueStart
        ? cueStart - count.end
        : count.start >= cueEnd
          ? count.start - cueEnd
          : 0
    }))
    .sort((left, right) => left.distance - right.distance || left.start - right.start);
  return ranked[0]?.distance <= maxDistance ? ranked[0].value : null;
}

function totalValueAroundCue(value = "", cue = null) {
  if (!cue) return null;
  const normalized = normalizeText(value);
  const cueStart = cue.index || 0;
  const cueEnd = cueStart + String(cue[0] || "").length;
  const participantCounts = countedParticipantValues(normalized);
  const numericValues = alignedCategoryNumericClaims(normalized).filter(claim => !claim.year);
  const participantAfter = participantCounts
    .filter(count => count.start >= cueEnd)
    .sort((left, right) => left.start - right.start)[0];
  const numericAfter = numericValues.find(claim => claim.index >= cueEnd);
  const numericBefore = [...numericValues].reverse().find(claim => claim.index < cueStart);
  let immediateTotalBeforeCue = false;
  if (numericBefore) {
    const beforeCueText = normalized.slice(numericBefore.index, cueStart).trim();
    immediateTotalBeforeCue = new RegExp(
      `^${CATEGORY_NUMBER_TOKEN_SOURCE}(?:\\s+(?:[\\p{L}-]+\\s+){0,2}?${PARTICIPANT_UNIT_SOURCE})?\\s*[-–—,;:]?$`,
      "u"
    ).test(beforeCueText);
  }
  if (numericAfter) {
    const beforeNumericAfter = normalized.slice(cueEnd, numericAfter.index);
    const numericAfterStartsSubgroup = /(?:^|[^\p{L}])(?:neist|nendest|millest|sealhulgas|sh|including|of\s+whom|of\s+these|из\s+них|среди\s+них)(?=$|[^\p{L}])/u.test(beforeNumericAfter);
    const numericAfterStartsNewClause = /[;,]/u.test(beforeNumericAfter);
    if (immediateTotalBeforeCue && (numericAfterStartsSubgroup || numericAfterStartsNewClause)) {
      return numericBefore.value;
    }
    const numericTail = normalized.slice(numericAfter.index);
    const numericAfterDescribesGroup = new RegExp(
      `^${CATEGORY_NUMBER_TOKEN_SOURCE}\\s+(?:[\\p{L}-]+\\s+){0,2}?(?:siht\\s*[-–—]?\\s*ruhm\\p{L}*|ruhm\\p{L}*|group\\p{L}*|categor\\p{L}*|групп\\p{L}*|категор\\p{L}*)(?=$|[^\\p{L}])`,
      "u"
    ).test(numericTail);
    if (!numericAfterDescribesGroup || !participantAfter) return numericAfter.value;
  }
  if (immediateTotalBeforeCue) return numericBefore.value;
  return participantAfter?.value || numericBefore?.value || null;
}

function categoryAroundTotalCue(value = "", cue = null, totalValue = null) {
  if (!cue || !totalValue) return null;
  const existing = extractNumericCategoryLabels(value).find(category =>
    category.explicitTotalScope &&
    category.value === totalValue &&
    categorySemanticTokens(category.label).length
  );
  if (existing) return existing;
  const cueEnd = (cue.index || 0) + String(cue[0] || "").length;
  const numericAfter = alignedCategoryNumericClaims(value).find(claim =>
    !claim.year && claim.index >= cueEnd && claim.value === totalValue
  );
  if (!numericAfter) return null;
  const tailCategory = extractNumericCategoryLabels(value.slice(numericAfter.index))
    .find(category => category.value === totalValue);
  return tailCategory ? { ...tailCategory, explicitTotalScope: true } : null;
}

function uniformGroupCue(value = "") {
  const estonianGroupCount = String.raw`(?:\d+|null\p{L}*|uhe\p{L}*|kahe\p{L}*|kolme\p{L}*|nelja\p{L}*|viie\p{L}*|kuue\p{L}*|seitsme\p{L}*|kaheksa\p{L}*|uheksa\p{L}*|kumne\p{L}*)`;
  const russianGroupCount = String.raw`(?:\d+|одн\p{L}*|дв\p{L}*|тр\p{L}*|четыр\p{L}*|пят\p{L}*|шест\p{L}*|сем\p{L}*|восем\p{L}*|девят\p{L}*|десят\p{L}*)`;
  const patterns = [
    new RegExp(
      `(?:^|[^\\p{L}])(?:iga\\p{L}*|koig\\p{L}*)\\s+(?:${estonianGroupCount}\\s+)?(?:siht\\s*[-–—]?\\s*ruhm\\p{L}*|ruhm\\p{L}*)(?=$|[^\\p{L}])`,
      "u"
    ),
    new RegExp(
      `(?:^|[^\\p{L}])(?:(?:in|from)\\s+)?(?:each|every)\\s+(?:(?:of\\s+)?(?:the\\s+)?)?(?:${CATEGORY_NUMBER_TOKEN_SOURCE}\\s+)?(?:groups?|categories?)(?=$|[^\\p{L}])`,
      "u"
    ),
    /(?:^|[^\p{L}])per\s+(?:group|category)(?=$|[^\p{L}])/u,
    new RegExp(
      `(?:^|[^\\p{L}])(?:(?:в|из|по)\\s+)?кажд\\p{L}*(?:\\s+из)?\\s+(?:${russianGroupCount}\\s+)?(?:групп\\p{L}*|категор\\p{L}*)(?=$|[^\\p{L}])`,
      "u"
    )
  ];
  return patterns
    .map(pattern => pattern.exec(value))
    .filter(Boolean)
    .sort((left, right) => (left.index || 0) - (right.index || 0))[0] || null;
}

function extractUniformParticipantBreakdown(value = "") {
  const perGroupValues = new Set();
  const totalValues = extractWholeScopeNumbers(value, { includeFallback: false });
  const sentences = normalizeText(value).split(/(?<=[.!?])\s+/u);
  for (const rawSentence of sentences) {
    const sentence = normalizeText(stripStructuralNumbers(rawSentence));
    const counts = countedParticipantValues(sentence);
    if (counts.length) {
      const groupCue = uniformGroupCue(sentence);
      const perGroupValue = closestParticipantValue(counts, groupCue);
      if (perGroupValue) perGroupValues.add(perGroupValue);
    }
  }
  return {
    perGroupValue: perGroupValues.size === 1 ? [...perGroupValues][0] : null,
    totalValue: totalValues.size === 1 ? [...totalValues][0] : null
  };
}

function uniformParticipantRelation(source = {}, reply = "", categoryLabels = []) {
  const sourceBreakdown = extractUniformParticipantBreakdown(source.body);
  const replyBreakdown = extractUniformParticipantBreakdown(reply);
  const knownTotalValue = sourceBreakdown.totalValue || replyBreakdown.totalValue;
  const participantCategories = categoryLabels
    .filter(category => categoryRepresentsParticipant(category, knownTotalValue));
  const expectedPerGroupValue = sourceBreakdown.perGroupValue || replyBreakdown.perGroupValue;
  const observedCategoryValues = participantCategories.map(({ value }) => value);
  const mismatchedCategoryValues = expectedPerGroupValue && participantCategories.length >= 2
    ? participantCategories.filter(({ value }) => value !== expectedPerGroupValue)
    : [];
  const perGroupMismatch = Boolean(
    sourceBreakdown.perGroupValue &&
    replyBreakdown.perGroupValue &&
    sourceBreakdown.perGroupValue !== replyBreakdown.perGroupValue
  );
  const totalMismatch = Boolean(
    sourceBreakdown.totalValue &&
    replyBreakdown.totalValue &&
    sourceBreakdown.totalValue !== replyBreakdown.totalValue
  );
  const checked = Boolean(
    (expectedPerGroupValue && participantCategories.length >= 2) ||
    (sourceBreakdown.perGroupValue && replyBreakdown.perGroupValue) ||
    (sourceBreakdown.totalValue && replyBreakdown.totalValue)
  );
  return {
    checked,
    mismatch: perGroupMismatch || totalMismatch || mismatchedCategoryValues.length > 0,
    expectedPerGroupValue,
    observedCategoryValues,
    expectedTotalValue: sourceBreakdown.totalValue || null,
    observedTotalValue: replyBreakdown.totalValue || null
  };
}

function asksForCategoricalNumericBreakdown(message = "") {
  const normalized = normalizeText(message);
  const explicitCategoryCue = /(?:^|[^\p{L}])(?:categor\p{L}*|group\p{L}*|participant\p{L}*|role\p{L}*|kategoor\p{L}*|osal\p{L}*|ruhm\p{L}*|roll\p{L}*|sihtruhm\p{L}*|категор\p{L}*|групп\p{L}*|рол\p{L}*|участ\p{L}*)(?=[^\p{L}]|$)/u.test(normalized);
  const listShape = (String(message || "").match(/,/gu) || []).length >= 2 &&
    /(?:^|[^\p{L}])(?:and|ja|ning|и)(?=[^\p{L}]|$)/u.test(normalized);
  return asksForNumericFact(message) && (explicitCategoryCue || listShape);
}

function sourceSupportsCategoryLabel(source = {}, tokens = []) {
  if (!tokens.length) return true;
  const evidenceTokens = normalizeText(source.body).match(/[\p{L}]+/gu) || [];
  const windowSize = Math.max(12, tokens.length * 5);
  const requiredMatches = tokens.length === 1 ? 1 : Math.max(2, Math.ceil(tokens.length * 0.6));
  for (let start = 0; start < evidenceTokens.length; start += 1) {
    const window = evidenceTokens.slice(start, start + windowSize);
    const matchedTokens = tokens.filter(token =>
      window.some(evidenceToken => categoryTokenMatches(token, evidenceToken))
    );
    if (matchedTokens.length >= requiredMatches) {
      return true;
    }
  }
  return false;
}

function unsupportedNumericCategoryLabels(message = "", reply = "", source = {}) {
  if (!asksForCategoricalNumericBreakdown(message)) return [];
  const labels = extractNumericCategoryLabels(reply);
  if (labels.length < 2) return [];
  const sourceTotalValue = extractUniformParticipantBreakdown(source.body).totalValue ||
    extractUniformParticipantBreakdown(reply).totalValue;
  return labels
    .filter(category => !categoryIsWholeTotal(category, sourceTotalValue))
    .filter(({ tokens }) => !sourceSupportsCategoryLabel(source, tokens))
    .map(({ label }) => label);
}

function explicitPeopleCounts(value = "") {
  const counts = new Set();
  for (const match of normalizeText(value).matchAll(/(?<![\p{L}\d])(\d+(?:[ .]\d{3})*|\d+)\s+(?:inimest|inimese|isikut|isiku|osalejat|osaleja|vastajat|vastaja|ohvrit|ohvri)\b/gu)) {
    counts.add(normalizeNumber(match[1]));
  }
  return counts;
}

function percentCountRelationMismatch(reply = "", source = {}) {
  const relations = extractPercentCountRelations(source.body);
  if (!relations.length) return false;
  for (const relation of relations) {
    const replyPercentPattern = new RegExp(`(?<![\\p{L}\\d])${relation.percent.replace(".", "[.,]")}\\s*%`, "u");
    const replyPercentMatch = replyPercentPattern.exec(String(reply || ""));
    if (!replyPercentMatch) continue;
    const replySentence = sentenceAroundIndex(reply, replyPercentMatch.index || 0);
    const replyParagraph = paragraphAroundIndex(reply, replyPercentMatch.index || 0);
    const evidenceSentence = sentenceAroundIndex(source.body, relation.index);
    const normalizedReplyParagraph = normalizeText(replyParagraph);
    const normalizedEvidenceSentence = normalizeText(evidenceSentence);
    const countPattern = relation.count.replace(".", "[.,]");
    const replyTreatsCountAsSampleAfterCount = new RegExp(
      `(?<![\\p{L}\\d])${countPattern}\\s+(?:inimese|isiku|osaleja|vastaja)?\\s*(?:suuruses\\s+)?valim\\w*`,
      "u"
    ).test(normalizedReplyParagraph);
    const replyTreatsCountAsSampleBeforeCount = new RegExp(
      `\\bvalim\\w*(?:\\s+\\S+){0,6}\\s+${countPattern}(?![\\p{L}\\d])`,
      "u"
    ).test(normalizedReplyParagraph);
    const replyTreatsCountAsSample = replyTreatsCountAsSampleAfterCount || replyTreatsCountAsSampleBeforeCount;
    const evidenceTreatsCountAsSample = new RegExp(
      `(?<![\\p{L}\\d])${countPattern}\\s+(?:inimese|isiku|osaleja|vastaja)?\\s*(?:suuruses\\s+)?valim\\w*`,
      "u"
    ).test(normalizedEvidenceSentence);
    if (replyTreatsCountAsSample && !evidenceTreatsCountAsSample) return true;

    const evidenceCounts = explicitPeopleCounts(evidenceSentence);
    for (const claimedCount of explicitPeopleCounts(replySentence)) {
      if (claimedCount !== relation.count && !evidenceCounts.has(claimedCount)) return true;
    }
  }
  return false;
}

function asksForPublicationYear(message = "") {
  const normalized = normalizeText(message);
  return /\b(?:avaldat\w*|ilmus\w*|publitseerit\w*)\b/u.test(normalized);
}

function asksForWholeScope(message = "") {
  const normalized = normalizeText(message);
  const quantitativePattern = /(?:^|[^\p{L}\p{N}])(?:kui\s+palju|mitu|koguarv\p{L}*|uldarv\p{L}*|how\s+many|number\s+of|total|сколько|число|всего|итого)(?=$|[^\p{L}\p{N}])/gu;
  const quantitativeSlots = normalized.match(quantitativePattern) || [];
  const explicitTotalCue = /(?:^|[^\p{L}\p{N}])(?:kokku|koguarv\p{L}*|uldarv\p{L}*|in\s+total|total|altogether|всего|итого|общее\s+число)(?=$|[^\p{L}\p{N}])/u.test(normalized);
  if (!explicitTotalCue && quantitativeSlots.length > 1) return false;
  if (asksForCategoricalNumericBreakdown(message) && !explicitTotalCue) return false;
  return (explicitTotalCue || quantitativeSlots.length > 0 || /(?:^|[^\p{L}\p{N}])(?:arv|arvu|arvud|arvust|arvuga)(?=$|[^\p{L}\p{N}])/u.test(normalized)) &&
    !/(?:^|[^\p{L}\p{N}])(?:osakaal\p{L}*|protsent\p{L}*|percentage|percent|процент\p{L}*)(?=$|[^\p{L}\p{N}])/u.test(normalized);
}

function failureReply(replyLang = "et") {
  if (replyLang === "en") {
    return "The retrieved source excerpts do not confirm the requested value, scope, and year unambiguously enough to give an exact answer.";
  }
  if (replyLang === "ru") {
    return "В найденных фрагментах источников недостаточно однозначно подтверждены запрошенные значение, охват и год, поэтому точный ответ дать нельзя.";
  }
  return "Kasutatud allikakatkenditest ei saa küsitud arvu, ulatust ja aastat piisavalt üheselt kinnitada.";
}

function contactFailureReply(replyLang = "et") {
  if (replyLang === "en") {
    return "The requested current contact details could not be confirmed from the freshness-verified municipal contact registry.";
  }
  if (replyLang === "ru") {
    return "Запрошенные актуальные контактные данные не удалось подтвердить по проверенному на свежесть реестру контактов муниципалитета.";
  }
  return "Küsitud praeguseid kontaktandmeid ei õnnestunud värskuskontrollitud KOV-i kontaktiregistrist kinnitada.";
}

export function shouldValidateExactFactAnswer({ message = "", sources = [], retrievalMeta = null } = {}) {
  if (retrievalMeta?.structuredContactMissingMunicipalityTurn === true) return true;
  if (retrievalMeta?.structuredContactMonitorTurn === true) return true;
  if (retrievalMeta?.structuredContactRegistryTurn === true) return true;
  if (isMunicipalityContactInventory(retrievalMeta)) return true;
  if (
    retrievalMeta?.currentMunicipalityContactEvidenceRequested === true &&
    contactAnswerIntentRequested(message)
  ) return true;
  if (!asksForNumericFact(message)) return false;
  if (retrievalMeta?.numericFactEvidence?.enabled === true) return true;
  return Array.isArray(sources) && sources.some(source => String(source?.evidenceText || "").trim());
}

export function validateExactFactAnswer({
  message = "",
  reply = "",
  sources = [],
  retrievalMeta = null,
  replyLang = "et"
} = {}) {
  const evidenceSources = (Array.isArray(sources) ? sources : [])
    .map(splitEvidence)
    .filter(source => source.evidenceText);
  const documentIdentity = retrievalMeta?.documentIdentityEvidence && typeof retrievalMeta.documentIdentityEvidence === "object"
    ? retrievalMeta.documentIdentityEvidence
    : null;
  const authorCorpus = retrievalMeta?.authorCorpusEvidence && typeof retrievalMeta.authorCorpusEvidence === "object"
    ? retrievalMeta.authorCorpusEvidence
    : null;
  const claims = normalizedNumericClaims(reply);
  const baseTrace = {
    version: "exact_numeric_fact_v5",
    enabled: true,
    buffered: true,
    claim_values: claims.map(claim => claim.value),
    source_count: evidenceSources.length,
    document_identity_required: documentIdentity?.required === true,
    document_identity_matched: documentIdentity?.matched === true,
    document_identity_confidence: documentIdentity?.confidence || null,
    selected_document_id: documentIdentity?.selectedDocumentId || null,
    author_corpus_required: authorCorpus?.required === true,
    author_corpus_complete: authorCorpus?.complete === true,
    author_corpus_document_count: Number.isInteger(Number(authorCorpus?.documentCount))
      ? Number(authorCorpus.documentCount)
      : null
  };
  if (retrievalMeta?.structuredContactMissingMunicipalityTurn === true) {
    const expectedReply = String(retrievalMeta?.deterministicContactReply || "").trim();
    const actualReply = String(reply || "").trim();
    const passed = Boolean(expectedReply && actualReply === expectedReply);
    return {
      passed,
      reply: passed ? actualReply : contactFailureReply(replyLang),
      trace: {
        ...baseTrace,
        passed,
        reason: passed ? "contact_municipality_clarification_validated" : "contact_municipality_clarification_mismatch",
        contact_municipality_clarification_checked: true,
        supporting_source_ids: []
      }
    };
  }
  if (retrievalMeta?.structuredContactMonitorTurn === true) {
    const monitorSources = evidenceSources.filter(source => source.sourceType === "service_map_contact_monitor");
    const schedule = retrievalMeta?.serviceMapKovContactCheckSchedule;
    const expectedCadence = String(schedule?.cadence || "").trim().toLowerCase();
    const scheduleSourceId = String(schedule?.sourceId || "").trim();
    const cadenceClaims = contactCheckCadenceClaims(reply);
    const unsupportedCadences = cadenceClaims.filter(cadence => cadence !== expectedCadence);
    const sourcePresent = Boolean(
      scheduleSourceId && monitorSources.some(source => source.sourceId === scheduleSourceId)
    );
    const passed = Boolean(
      expectedCadence &&
      cadenceClaims.includes(expectedCadence) &&
      !unsupportedCadences.length &&
      sourcePresent
    );
    return {
      passed,
      reply: passed ? String(reply || "").trim() : contactFailureReply(replyLang),
      trace: {
        ...baseTrace,
        passed,
        reason: passed ? "contact_monitor_schedule_validated" : !sourcePresent
          ? "contact_check_cadence_source_missing"
          : unsupportedCadences.length
            ? "unsupported_contact_check_cadence"
            : "contact_check_cadence_missing",
        contact_monitor_checked: true,
        contact_check_cadence_expected: expectedCadence || null,
        contact_check_cadence_claims: cadenceClaims,
        unsupported_contact_check_cadences: unsupportedCadences,
        supporting_source_ids: passed ? [scheduleSourceId] : []
      }
    };
  }
  const contactEvidence = structuredContactEvidence(retrievalMeta);
  const contactInventoryValidation = retrievalMeta?.structuredContactRegistryTurn === true ||
    isMunicipalityContactInventory(retrievalMeta);
  const mixedStructuredContactValidation = !contactInventoryValidation &&
    retrievalMeta?.currentMunicipalityContactEvidenceRequested === true &&
    contactAnswerIntentRequested(message);
  if (contactInventoryValidation || mixedStructuredContactValidation) {
    const contactSources = evidenceSources.filter(source => source.sourceType === "service_map_contact");
    const contactMonitorSources = evidenceSources.filter(source => source.sourceType === "service_map_contact_monitor");
    if (!contactEvidence?.contacts.length || !contactSources.length) {
      return {
        passed: false,
        reply: contactFailureReply(replyLang),
        trace: {
          ...baseTrace,
          reason: "contact_inventory_unavailable",
          contact_inventory_checked: true,
          contact_inventory_load_state: String(retrievalMeta?.serviceMapKovContactLoadState || "unknown"),
          contact_inventory_expected_name_count: contactEvidence?.contacts.length || 0,
          contact_source_count: contactSources.length,
          supporting_source_ids: []
        }
      };
    }
    {
      const contactClaims = contactNumericClaims(reply);
      const contactBaseTrace = {
        ...baseTrace,
        claim_values: contactClaims.map(claim => claim.value)
      };
      const messageNormalized = normalizeText(message);
      const activeScopeContacts = contactEvidence.activeScope
        ? contactEvidence.contacts.filter(contact => contactEvidence.activeScope.sourceIds.has(contact.sourceId))
        : contactEvidence.contacts;
      const targetedContacts = contactEvidence.contacts.filter(contact =>
        messageNormalized.includes(normalizeText(contact.name))
      );
      const targetedSourceIds = new Set(targetedContacts.map(contact => contact.sourceId));
      const replyDates = contactDateClaims(reply);
      const replyPhones = contactPhoneClaims(reply).filter(phone =>
        !replyDates.some(date => phone.index >= date.index && phone.index < date.end)
      );
      const replyEmails = contactEmailClaims(reply);
      const phoneRelations = contactTupleRelationFailures(
        reply,
        replyPhones,
        contactEvidence.contacts,
        "phones",
        targetedSourceIds
      );
      const emailRelations = contactTupleRelationFailures(
        reply,
        replyEmails,
        contactEvidence.contacts,
        "emails",
        targetedSourceIds
      );
      const nonPhoneClaims = contactClaims.filter(claim =>
        !replyPhones.some(phone => claim.index >= phone.index && claim.index < phone.end)
      );
      const nonContactValueClaims = nonPhoneClaims.filter(claim =>
        !replyEmails.some(email => claim.index >= email.index && claim.index < email.end) &&
        !replyDates.some(date => claim.index >= date.index && claim.index < date.end)
      );
      const supportedCheckedDates = new Set(contactEvidence.contacts
        .map(contact => contact.checkedAt.slice(0, 10))
        .filter(Boolean));
      const dateSupportingContacts = contactEvidence.contacts.filter(contact =>
        replyDates.some(claim => claim.value === contact.checkedAt.slice(0, 10))
      );
      const unsupportedDates = replyDates
        .filter(() => contactInventoryValidation || contactAnswerIntent(message).wantsFreshness)
        .filter(claim => !supportedCheckedDates.has(claim.value))
        .map(claim => claim.value);
      const answerIntent = contactAnswerIntent(message);
      const unsupportedClaims = nonPhoneClaims
        .filter(claim => nonContactValueClaims.includes(claim))
        .filter(() => contactInventoryValidation || answerIntent.wantsContactCount)
        .filter(claim =>
          !contactCountClaimSupported(message, reply, claim, contactEvidence) &&
          !contactAuxiliaryNumericClaimSupported(reply, claim, contactEvidence)
        )
        .map(claim => claim.value);
      const cadenceClaims = contactCheckCadenceClaims(reply);
      const expectedCadence = contactEvidence.checkSchedule?.cadence || "";
      const cadenceSourceId = contactEvidence.checkSchedule?.sourceId || "";
      const unsupportedCadences = cadenceClaims.filter(cadence => cadence !== expectedCadence);
      const requiredCadenceMissing = asksForContactCheckCadence(message) &&
        (!expectedCadence || !cadenceClaims.includes(expectedCadence));
      const cadenceSourceMissing = cadenceClaims.length > 0 && (
        !cadenceSourceId ||
        !contactMonitorSources.some(source => source.sourceId === cadenceSourceId)
      );
      const countRequired = !answerIntent.wantsFreshness && (
        (contactInventoryValidation && asksForNumericFact(message)) ||
        answerIntent.wantsContactCount
      );
      const activeScopeMunicipalityCounts = new Map();
      for (const contact of activeScopeContacts) {
        activeScopeMunicipalityCounts.set(contact.municipality, (activeScopeMunicipalityCounts.get(contact.municipality) || 0) + 1);
      }
      const expectedTotals = contactEvidence.activeScope?.kind === "known_zero"
        ? [{ name: "", count: contactEvidence.activeScope.count }]
        : contactEvidence.activeScope?.kind === "subset"
          ? contactEvidence.activeScope.contextual || asksForCombinedContactTotal(message)
          ? [{ name: "", count: contactEvidence.activeScope.count }]
          : [...activeScopeMunicipalityCounts.entries()].map(([name, count]) => ({ name, count }))
        : contactEvidence.activeScope?.contextual
          ? [{ name: "", count: contactEvidence.activeScope.count }]
        : asksForCombinedContactTotal(message)
        ? [{ name: "", count: contactEvidence.totalCount }]
        : contactEvidence.municipalities.length
          ? contactEvidence.municipalities
          : [{ name: "", count: contactEvidence.totalCount }];
      const seenTotals = expectedTotals.filter(expected => nonContactValueClaims.some(claim => {
        if (claim.numeric !== expected.count) return false;
        const sentence = sentenceAroundIndex(reply, claim.index || 0);
        return contactTotalClaimScopeSupported(sentence) &&
          (expectedTotals.length === 1 || contactLabelMentioned(sentence, expected.name));
      }));
      const totalClaimsComplete = !countRequired || seenTotals.length === expectedTotals.length;
      const requestedRoleCounts = countRequired
        ? requestedContactRoleCounts(message, contactEvidence)
        : [];
      const seenRequestedRoleCounts = requestedRoleCounts.filter(entry =>
        contactRoleCountSeen(reply, nonContactValueClaims, entry)
      );
      const roleClaimsComplete = !countRequired || seenRequestedRoleCounts.length === requestedRoleCounts.length;
      const requireAllContacts = contactInventoryValidation && asksForCompleteContactList(message);
      const requireActiveScopeValues = Boolean(contactEvidence.activeScope) &&
        asksForPluralContactValues(message, answerIntent);
      const replyNormalized = normalizeText(reply);
      const seenContacts = contactEvidence.contacts.filter(contact =>
        replyNormalized.includes(normalizeText(contact.name))
      );
      const supportedRoleMentioned = [...contactEvidence.roles, ...contactEvidence.roleFamilies]
        .some(entry => contactRoleLabelMentioned(reply, entry.label));
      const supportedScopedTotalMentioned = nonContactValueClaims.some(claim =>
        contactCountClaimSupported(message, reply, claim, contactEvidence)
      );
      const requireActiveScopeNames = requireAllContacts || requireActiveScopeValues || (
        answerIntent.wantsIdentity && (
          contactEvidence.activeScope?.kind === "subset" ||
          contactEvidence.activeScope?.contextual
        )
      );
      const requiredIdentityContacts = requireActiveScopeNames ? activeScopeContacts : [];
      const missingContactNames = requireActiveScopeNames
        ? requiredIdentityContacts
          .filter(contact => !seenContacts.some(seen => seen.sourceId === contact.sourceId))
          .map(contact => contact.name)
        : [];
      const allowedReplyContacts = contactEvidence.activeScope?.kind === "subset"
        ? activeScopeContacts
        : contactEvidence.contacts;
      const unexpectedContactItems = unexpectedContactPersonClaims(reply, contactEvidence, allowedReplyContacts);
      const unsupportedRoleRelations = contactRoleRelationFailures(reply, contactEvidence);
      const missingContactRoles = (requireAllContacts || answerIntent.wantsIdentity)
        ? missingRequiredContactRoles(reply, requiredIdentityContacts, contactEvidence)
        : [];
      const missingTargetIdentityNames = answerIntent.wantsIdentity
        ? targetedContacts
          .filter(contact => !seenContacts.some(seen => seen.sourceId === contact.sourceId))
          .map(contact => contact.name)
        : [];
      const requiredTargetMentionMissing = targetedContacts.length > 0 && (
        answerIntent.wantsIdentity ? missingTargetIdentityNames.length > 0 : !seenContacts.length
      );
      const requiredGeneralIdentityMissing = answerIntent.wantsIdentity &&
        !targetedContacts.length &&
        contactEvidence.activeScope?.kind !== "known_zero" &&
        !seenContacts.length;
      const requiredContactNameMissing = !countRequired &&
        !answerIntent.wantsPhone &&
        !answerIntent.wantsEmail &&
        !answerIntent.wantsContactDetails &&
        (requiredTargetMentionMissing || requiredGeneralIdentityMissing);
      const requiredContactEvidenceMissing = !countRequired &&
        !answerIntent.wantsPhone &&
        !answerIntent.wantsEmail &&
        !answerIntent.wantsContactDetails &&
        !answerIntent.wantsIdentity &&
        !answerIntent.wantsFreshness &&
        !targetedContacts.length &&
        !seenContacts.length &&
        !supportedRoleMentioned &&
        !supportedScopedTotalMentioned;
      const requiredPhoneMissing = answerIntent.wantsPhone && !replyPhones.length;
      const requiredEmailMissing = answerIntent.wantsEmail && !replyEmails.length;
      const requiredContactValueMissing = answerIntent.wantsContactDetails && !replyPhones.length && !replyEmails.length;
      const replyStartsWithNegativePresence = /^(?:ei|no|нет)(?=$|[^\p{L}\p{N}])/u.test(replyNormalized);
      const supportedPositivePresence = seenContacts.length > 0 ||
        replyPhones.length > 0 ||
        replyEmails.length > 0 ||
        supportedRoleMentioned ||
        nonContactValueClaims.some(claim =>
          claim.numeric > 0 && contactCountClaimSupported(message, reply, claim, contactEvidence)
        );
      const supportedZeroPresence = nonContactValueClaims.some(claim =>
        claim.numeric === 0 && contactCountClaimSupported(message, reply, claim, contactEvidence)
      );
      const expectedPresenceCount = Number.isInteger(Number(contactEvidence.activeScope?.count))
        ? Number(contactEvidence.activeScope.count)
        : Number(contactEvidence.totalCount);
      const contactPresenceMismatch = answerIntent.wantsPresence && (
        expectedPresenceCount > 0
          ? replyStartsWithNegativePresence || !supportedPositivePresence
          : !replyStartsWithNegativePresence || !supportedZeroPresence
      );
      const phoneOwners = replyPhones.flatMap(claim =>
        contactEvidence.contacts.filter(contact => contact.phones.includes(claim.value))
      );
      const emailOwners = replyEmails.flatMap(claim =>
        contactEvidence.contacts.filter(contact => contact.emails.includes(claim.value))
      );
      const replyPhoneOwnerIds = new Set(phoneOwners.map(contact => contact.sourceId));
      const replyEmailOwnerIds = new Set(emailOwners.map(contact => contact.sourceId));
      const missingContactPhones = requireActiveScopeValues && (answerIntent.wantsPhone || answerIntent.wantsContactDetails)
        ? activeScopeContacts
          .filter(contact => contact.phones.length && !replyPhoneOwnerIds.has(contact.sourceId))
          .map(contact => contact.name)
        : [];
      const missingContactEmails = requireActiveScopeValues && (answerIntent.wantsEmail || answerIntent.wantsContactDetails)
        ? activeScopeContacts
          .filter(contact => contact.emails.length && !replyEmailOwnerIds.has(contact.sourceId))
          .map(contact => contact.name)
        : [];
      const roleSupportingContacts = contactEvidence.contacts.filter(contact =>
        contactRoleLabelMentioned(reply, contact.role) || contactRoleLabelMentioned(reply, contact.roleFamily)
      );
      const supportingContacts = contactEvidence.activeScope?.contextual
        ? activeScopeContacts
        : countRequired || requireAllContacts || supportedScopedTotalMentioned
          ? contactEvidence.contacts
          : requireActiveScopeNames
            ? requiredIdentityContacts
        : [...seenContacts, ...phoneOwners, ...emailOwners, ...roleSupportingContacts, ...dateSupportingContacts];
      const supportingSourceIds = [...new Set(supportingContacts.map(contact => contact.sourceId))]
        .filter(sourceId => contactSources.some(source => source.sourceId === sourceId));
      if (
        cadenceClaims.includes(expectedCadence) &&
        cadenceSourceId &&
        contactMonitorSources.some(source => source.sourceId === cadenceSourceId)
      ) {
        supportingSourceIds.push(cadenceSourceId);
      }
      if (
        phoneRelations.unsupported.length ||
        phoneRelations.mismatched.length ||
        emailRelations.unsupported.length ||
        emailRelations.mismatched.length ||
        unsupportedDates.length ||
        unsupportedClaims.length ||
        !totalClaimsComplete ||
        !roleClaimsComplete ||
        missingContactNames.length ||
        unexpectedContactItems.length ||
        unsupportedRoleRelations.length ||
        missingContactRoles.length ||
        requiredContactNameMissing ||
        requiredContactEvidenceMissing ||
        requiredPhoneMissing ||
        requiredEmailMissing ||
        requiredContactValueMissing ||
        contactPresenceMismatch ||
        missingContactPhones.length ||
        missingContactEmails.length ||
        unsupportedCadences.length ||
        requiredCadenceMissing ||
        cadenceSourceMissing
      ) {
        return {
          passed: false,
          reply: failureReply(replyLang),
          trace: {
            ...contactBaseTrace,
            reason: phoneRelations.unsupported.length
              ? "unsupported_contact_phone"
              : phoneRelations.mismatched.length
                ? "unsupported_contact_phone_relation"
                : emailRelations.unsupported.length
                  ? "unsupported_contact_email"
                : emailRelations.mismatched.length
                  ? "unsupported_contact_email_relation"
                  : unsupportedDates.length
                    ? "unsupported_contact_checked_date"
                    : unsupportedClaims.length
                      ? "unsupported_contact_inventory_claim"
                      : !totalClaimsComplete
                        ? "contact_inventory_total_missing"
                        : !roleClaimsComplete
                          ? "contact_role_count_missing"
                        : missingContactNames.length
                          ? "contact_inventory_names_incomplete"
                          : unexpectedContactItems.length
                            ? "unexpected_contact_items"
                            : unsupportedRoleRelations.length
                              ? "unsupported_contact_role_relation"
                              : missingContactRoles.length
                                ? "contact_role_not_answered"
                              : requiredPhoneMissing
                                ? "contact_phone_not_answered"
                              : requiredEmailMissing
                                ? "contact_email_not_answered"
                                : missingContactPhones.length
                                  ? "contact_phone_list_incomplete"
                                  : missingContactEmails.length
                                    ? "contact_email_list_incomplete"
                                  : unsupportedCadences.length
                                    ? "unsupported_contact_check_cadence"
                                    : requiredCadenceMissing
                                      ? "contact_check_cadence_missing"
                                      : cadenceSourceMissing
                                        ? "contact_check_cadence_source_missing"
                                  : requiredContactValueMissing
                                    ? "contact_details_not_answered"
                                    : contactPresenceMismatch
                                      ? "contact_presence_mismatch"
                                    : requiredContactEvidenceMissing
                                      ? "contact_evidence_not_answered"
                                      : "contact_name_not_answered",
            contact_inventory_checked: true,
            contact_inventory_total_expected: expectedTotals.map(entry => `${entry.name}:${entry.count}`),
            contact_inventory_total_seen: seenTotals.map(entry => `${entry.name}:${entry.count}`),
            contact_role_count_expected: requestedRoleCounts.map(entry => `${entry.municipality}:${entry.label}:${entry.count}`),
            contact_role_count_seen: seenRequestedRoleCounts.map(entry => `${entry.municipality}:${entry.label}:${entry.count}`),
            contact_inventory_expected_name_count: contactEvidence.contacts.length,
            contact_inventory_seen_name_count: seenContacts.length,
            missing_contact_names: missingContactNames,
            unexpected_contact_items: unexpectedContactItems,
            unsupported_contact_role_relations: unsupportedRoleRelations,
            missing_contact_roles: missingContactRoles,
            unsupported_claim_values: unsupportedClaims,
            unsupported_contact_phone_values: phoneRelations.unsupported,
            unsupported_contact_phone_relations: phoneRelations.mismatched,
            unsupported_contact_email_values: emailRelations.unsupported,
            unsupported_contact_email_relations: emailRelations.mismatched,
            unsupported_contact_date_values: unsupportedDates,
            missing_target_contact_names: missingTargetIdentityNames,
            missing_contact_phone_names: missingContactPhones,
            missing_contact_email_names: missingContactEmails,
            expected_contact_check_cadence: expectedCadence || null,
            contact_check_cadence_claims: cadenceClaims,
            unsupported_contact_check_cadences: unsupportedCadences,
            supporting_source_ids: supportingSourceIds
          }
        };
      }
      return {
        passed: true,
        reply: String(reply || "").trim(),
        trace: {
          ...contactBaseTrace,
          passed: true,
          reason: "contact_inventory_cross_source",
          contact_inventory_checked: true,
          contact_source_count: contactSources.length,
          contact_inventory_total_expected: expectedTotals.map(entry => `${entry.name}:${entry.count}`),
          contact_inventory_total_seen: seenTotals.map(entry => `${entry.name}:${entry.count}`),
          contact_role_count_expected: requestedRoleCounts.map(entry => `${entry.municipality}:${entry.label}:${entry.count}`),
          contact_role_count_seen: seenRequestedRoleCounts.map(entry => `${entry.municipality}:${entry.label}:${entry.count}`),
          contact_inventory_expected_name_count: contactEvidence.contacts.length,
          contact_active_scope_count: activeScopeContacts.length,
          contact_inventory_seen_name_count: seenContacts.length,
          contact_phone_claim_count: replyPhones.length,
          contact_phone_relation_checked: replyPhones.length > 0,
          contact_email_claim_count: replyEmails.length,
          contact_email_relation_checked: replyEmails.length > 0,
          contact_check_cadence_expected: expectedCadence || null,
          contact_check_cadence_claims: cadenceClaims,
          contact_check_cadence_validated: cadenceClaims.length > 0,
          supporting_source_count: supportingSourceIds.length,
          supporting_source_ids: supportingSourceIds,
          category_relation_checked: nonContactValueClaims.length > 0,
          year_mode: "freshness_checked_contact_inventory",
          whole_scope_checked: true
        }
      };
    }
    return {
      passed: false,
      reply: failureReply(replyLang),
      trace: {
        ...baseTrace,
        reason: "contact_inventory_sources_missing",
        contact_inventory_checked: true
      }
    };
  }
  if (authorCorpus?.required === true) {
    if (
      authorCorpus.complete !== true ||
      authorCorpus.matched !== true ||
      !Number.isInteger(Number(authorCorpus.documentCount))
    ) {
      return {
        passed: false,
        reply: failureReply(replyLang),
        trace: { ...baseTrace, reason: "author_corpus_count_unconfirmed" }
      };
    }
    if (!evidenceSources.length) {
      return {
        passed: false,
        reply: failureReply(replyLang),
        trace: { ...baseTrace, reason: "author_corpus_sources_missing" }
      };
    }
    if (!claims.length) {
      return {
        passed: false,
        reply: failureReply(replyLang),
        trace: { ...baseTrace, reason: "author_corpus_count_not_answered" }
      };
    }
    const expectedCount = Number(authorCorpus.documentCount);
    const nonYearClaims = claims.filter(claim => !claim.year);
    if (!nonYearClaims.some(claim => claim.numeric === expectedCount)) {
      return {
        passed: false,
        reply: failureReply(replyLang),
        trace: { ...baseTrace, reason: "author_corpus_count_mismatch" }
      };
    }
    if (nonYearClaims.some(claim => claim.numeric !== expectedCount)) {
      return {
        passed: false,
        reply: failureReply(replyLang),
        trace: { ...baseTrace, reason: "unsupported_author_corpus_numeric_claim" }
      };
    }
    const unsupportedYears = claims
      .filter(claim => claim.year)
      .filter(claim => !evidenceSources.some(source => source.allNumbers.has(claim.value)));
    if (unsupportedYears.length) {
      return {
        passed: false,
        reply: failureReply(replyLang),
        trace: { ...baseTrace, reason: "unsupported_author_work_year" }
      };
    }
    return {
      passed: true,
      reply: String(reply || "").trim(),
      trace: {
        ...baseTrace,
        passed: true,
        reason: "author_metadata_aggregate",
        supporting_source_id: evidenceSources[0]?.sourceId || null,
        supporting_source_count: evidenceSources.length,
        year_mode: "publication_year_per_source",
        whole_scope_checked: true
      }
    };
  }
  if (documentIdentity?.required === true && (
    documentIdentity.matched !== true || documentIdentity.confidence !== "high"
  )) {
    return {
      passed: false,
      reply: failureReply(replyLang),
      trace: { ...baseTrace, reason: "document_identity_unconfirmed" }
    };
  }
  if (!evidenceSources.length) {
    return { passed: false, reply: failureReply(replyLang), trace: { ...baseTrace, reason: "no_rendered_evidence" } };
  }
  if (!claims.length) {
    return { passed: false, reply: failureReply(replyLang), trace: { ...baseTrace, reason: "no_numeric_claim" } };
  }

  const selectedDocumentId = String(documentIdentity?.selectedDocumentId || "").trim();
  const selectedTitle = normalizeText(documentIdentity?.selectedTitle || "");
  const identityEligibleSources = documentIdentity?.required === true
    ? evidenceSources.filter(source =>
        (selectedDocumentId && source.documentId === selectedDocumentId) ||
        (selectedTitle && normalizeText(source.title) === selectedTitle)
      )
    : evidenceSources;
  if (documentIdentity?.required === true && !identityEligibleSources.length) {
    return {
      passed: false,
      reply: failureReply(replyLang),
      trace: { ...baseTrace, reason: "identified_document_missing_from_rendered_sources" }
    };
  }

  const supportingSources = identityEligibleSources.filter(source =>
    claims.every(claim => numericClaimSupportedBySource(reply, claim, source))
  );
  if (!supportingSources.length) {
    const individuallySupported = claims.every(claim =>
      identityEligibleSources.some(source => numericClaimSupportedBySource(reply, claim, source))
    );
    const unsupportedClaimValues = claims
      .filter(claim => !identityEligibleSources.some(source => numericClaimSupportedBySource(reply, claim, source)))
      .map(claim => claim.value);
    return {
      passed: false,
      reply: failureReply(replyLang),
      trace: {
        ...baseTrace,
        reason: individuallySupported ? "cross_source_numeric_mix" : "unsupported_numeric_claim",
        unsupported_claim_values: unsupportedClaimValues
      }
    };
  }

  const yearClaims = claims.filter(claim => claim.year);
  if (asksForYear(message) && !yearClaims.length) {
    return { passed: false, reply: failureReply(replyLang), trace: { ...baseTrace, reason: "missing_requested_year" } };
  }
  const yearRequested = asksForYear(message);
  const publicationYearRequested = asksForPublicationYear(message);
  const yearCompatibleSources = !yearRequested || publicationYearRequested
    ? supportingSources
    : supportingSources.filter(source => yearClaims.some(claim => source.bodyYears.has(claim.value)));
  if (yearRequested && yearClaims.length && !yearCompatibleSources.length) {
    return {
      passed: false,
      reply: failureReply(replyLang),
      trace: { ...baseTrace, reason: "source_year_not_body_year" }
    };
  }

  const compatibleSources = yearCompatibleSources.length ? yearCompatibleSources : supportingSources;
  const durationEquivalenceUsed = compatibleSources.some(source =>
    claims.some(claim => !source.allNumbers.has(claim.value) &&
      durationClaimSupportedByEquivalentWording(reply, claim, source))
  );
  if (compatibleSources.every(source => percentCountRelationMismatch(reply, source))) {
    return {
      passed: false,
      reply: failureReply(replyLang),
      trace: { ...baseTrace, reason: "numeric_relation_mismatch" }
    };
  }
  const categoryLabels = extractNumericCategoryLabels(reply);
  const uniformRelations = compatibleSources.map(source => ({
    source,
    relation: uniformParticipantRelation(source, reply, categoryLabels)
  }));
  const uniformRelationChecked = asksForCategoricalNumericBreakdown(message) &&
    uniformRelations.some(({ relation }) => relation.checked);
  const uniformCompatibleSources = uniformRelationChecked
    ? uniformRelations.filter(({ relation }) => relation.checked && !relation.mismatch).map(({ source }) => source)
    : compatibleSources;
  if (uniformRelationChecked && !uniformCompatibleSources.length) {
    const relation = uniformRelations.find(item => item.relation.mismatch)?.relation || uniformRelations[0]?.relation;
    return {
      passed: false,
      reply: failureReply(replyLang),
      trace: {
        ...baseTrace,
        reason: "numeric_category_value_mismatch",
        category_relation_checked: true,
        category_relation_mode: "uniform_participant_groups",
        expected_per_group_value: relation?.expectedPerGroupValue || null,
        observed_category_values: relation?.observedCategoryValues || [],
        expected_total_value: relation?.expectedTotalValue || null,
        observed_total_value: relation?.observedTotalValue || null
      }
    };
  }
  const categoryRelationChecked = asksForCategoricalNumericBreakdown(message) && (
    categoryLabels.length >= 2 || uniformRelationChecked
  );
  const categoryCompatibleSources = categoryRelationChecked
    ? uniformCompatibleSources.filter(source => !unsupportedNumericCategoryLabels(message, reply, source).length)
    : uniformCompatibleSources;
  if (categoryRelationChecked && !categoryCompatibleSources.length) {
    const unsupportedLabels = Array.from(new Set(
      compatibleSources.flatMap(source => unsupportedNumericCategoryLabels(message, reply, source))
    ));
    return {
      passed: false,
      reply: failureReply(replyLang),
      trace: {
        ...baseTrace,
        reason: "unsupported_numeric_category_relation",
        category_relation_checked: true,
        unsupported_category_labels: unsupportedLabels
      }
    };
  }
  const relationCompatibleSources = categoryCompatibleSources.length
    ? categoryCompatibleSources
    : compatibleSources;
  const firstNonYearClaim = claims.find(claim => !claim.year);
  const replyWholeScopeNumbers = extractWholeScopeNumbers(reply);
  const claimedWholeScopeValues = replyWholeScopeNumbers.size
    ? replyWholeScopeNumbers
    : new Set(firstNonYearClaim ? [firstNonYearClaim.value] : []);
  const sourcesWithWholeScope = relationCompatibleSources.filter(source => source.wholeScopeNumbers.size > 0);
  if (
    asksForWholeScope(message) &&
    claimedWholeScopeValues.size &&
    sourcesWithWholeScope.length &&
    !sourcesWithWholeScope.some(source =>
      [...claimedWholeScopeValues].every(value => source.wholeScopeNumbers.has(value))
    )
  ) {
    return {
      passed: false,
      reply: failureReply(replyLang),
      trace: { ...baseTrace, reason: "whole_scope_mismatch" }
    };
  }

  const supportingSource = (
    sourcesWithWholeScope.find(source =>
      [...claimedWholeScopeValues].every(value => source.wholeScopeNumbers.has(value))
    ) ||
    relationCompatibleSources[0]
  );
  const supportingUniformRelation = uniformRelations
    .find(item => item.source === supportingSource)?.relation || null;
  return {
    passed: true,
    reply: String(reply || "").trim(),
    trace: {
      ...baseTrace,
      passed: true,
      reason: "all_claims_in_one_rendered_source",
      supporting_source_id: supportingSource?.sourceId || null,
      duration_equivalence_used: durationEquivalenceUsed,
      category_relation_checked: categoryRelationChecked,
      category_relation_mode: uniformRelationChecked ? "uniform_participant_groups" : null,
      expected_per_group_value: supportingUniformRelation?.expectedPerGroupValue || null,
      observed_category_values: supportingUniformRelation?.observedCategoryValues || [],
      expected_total_value: supportingUniformRelation?.expectedTotalValue || null,
      observed_total_value: supportingUniformRelation?.observedTotalValue || null,
      year_mode: publicationYearRequested ? "publication_year" : yearRequested ? "body_evidence_year" : "not_requested",
      whole_scope_checked: asksForWholeScope(message) && sourcesWithWholeScope.length > 0
    }
  };
}
