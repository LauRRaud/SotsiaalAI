const CONTACT_ROLE_GENERIC_TOKENS = new Set([
  "spetsialist", "peaspetsialist", "tootaja", "tootajad", "ametnik", "ametnikud",
  "specialist", "specialists", "employee", "employees", "staff", "worker", "workers",
  "специалист", "специалисты", "сотрудник", "сотрудники", "работник", "работники"
]);

export function isInstitutionalApplicationGuidance(message = "") {
  const text = normalizeContactRoleText(message);
  const application = /\b(?:vorm\w*|avald\w*|taotl\w*|application|form\w*)\b/u.test(text);
  const destination = /\b(?:kelle poole|kuhu|where|which office)\b/u.test(text);
  const explicitContact = /\b(?:kontakt\w*|telefon\w*|e-post\w*|email\w*|epost\w*|nimi|nimed|nimelis\w*|praegu|hetkel|varsk\w*|ajakoh\w*|phone\w*|contact\w*|name\w*|current\w*)\b/u.test(text);
  return application && destination && !explicitContact;
}

const CONTACT_ROLE_FAMILIES = [
  {
    key: "child_welfare",
    label: "laste heaolu ja lastekaitse",
    pattern: /(?:\blaste\s+heaolu\p{L}*|\blastekaits\p{L}*|\b(?:laps|laste)\p{L}*|\bchild(?:ren)?\p{L}*|\bchild\s+(?:welfare|protection)\p{L}*|(?:^|[^\p{L}\p{N}])ребен\p{L}*|(?:^|[^\p{L}\p{N}])дет\p{L}*\s+(?:благополуч\p{L}*|защит\p{L}*))/u
  },
  {
    key: "social_work",
    label: "sotsiaaltöö",
    pattern: /(?:\bsotsiaaltoo\p{L}*|\bsocial\s+(?:work|worker)\p{L}*|(?:^|[^\p{L}\p{N}])социальн\p{L}*\s+(?:работник\p{L}*|сотрудник\p{L}*|специалист\p{L}*))/u
  },
  {
    key: "guardianship",
    label: "eestkoste",
    pattern: /(?:\beestkost\p{L}*|\bguardianship\p{L}*|(?:^|[^\p{L}\p{N}])опек\p{L}*)/u
  },
  {
    key: "case_management",
    label: "juhtumikorraldus",
    pattern: /(?:\bjuhtumikorrald\p{L}*|\bcase\s+manag\p{L}*|(?:^|[^\p{L}\p{N}])куратор\p{L}*\s+случа\p{L}*)/u
  },
  {
    key: "youth_welfare",
    label: "noorte heaolu",
    pattern: /(?:\bnoorte\s+heaolu\p{L}*|\byouth\s+welfare\p{L}*|(?:^|[^\p{L}\p{N}])благополуч\p{L}*\s+молодеж\p{L}*)/u
  },
  {
    key: "benefits",
    label: "toetused",
    pattern: /(?:\b\p{L}*toetus\p{L}*|\bbenefit\p{L}*|(?:^|[^\p{L}\p{N}])пособ\p{L}*)/u
  },
  {
    key: "care",
    label: "hooldus",
    pattern: /(?:\bhooldus\p{L}*|\bcare\p{L}*|(?:^|[^\p{L}\p{N}])уход\p{L}*)/u
  }
];

export function normalizeContactRoleText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLocaleLowerCase("et")
    .replace(/[-–—/]+/gu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function explicitChildWelfareSelector(normalized = "") {
  return /(?:\b(?:laps|laste)\p{L}*\s+heaolu\p{L}*|\blastekaits\p{L}*|\bchild(?:ren)?\s+(?:welfare|protection)\p{L}*|(?:^|[^\p{L}\p{N}])дет\p{L}*\s+(?:благополуч\p{L}*|защит\p{L}*)|(?:^|[^\p{L}\p{N}])защит\p{L}*\s+(?:дет\p{L}*|ребен\p{L}*))/u.test(normalized);
}

function contactRoleSemanticKeys(value = "") {
  const normalized = normalizeContactRoleText(value);
  const keys = CONTACT_ROLE_FAMILIES
    .filter(family => family.pattern.test(normalized))
    .map(family => family.key);
  // "Lapsetoetus" / "child benefit" is a benefits topic, not by itself a
  // child-welfare or child-protection role selector. Preserve both families
  // only when the user explicitly names welfare/protection as well.
  if (keys.includes("benefits") && keys.includes("child_welfare") && !explicitChildWelfareSelector(normalized)) {
    return keys.filter(key => key !== "child_welfare");
  }
  return keys;
}

export function contactRoleSemanticSelections(value = "") {
  const keys = new Set(contactRoleSemanticKeys(value));
  return CONTACT_ROLE_FAMILIES
    .filter(family => keys.has(family.key))
    .map(({ key, label }) => ({ key, label }));
}

export function hasContactRoleSemanticSelector(value = "") {
  return contactRoleSemanticSelections(value).length > 0;
}

function contactRoleTokens(value = "") {
  return (normalizeContactRoleText(value).match(/[\p{L}\p{N}]+/gu) || [])
    .filter(token => token.length >= 5)
    .filter(token => !CONTACT_ROLE_GENERIC_TOKENS.has(token))
    .filter(token => !/^(?:sotsiaalvaldk|sotsiaalosak)/u.test(token));
}

function contactRoleTokenMatches(left = "", right = "") {
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length < 7 || longer.length - shorter.length > 8) return false;
  return longer.startsWith(shorter);
}

export function canonicalContactRoleFamilyLabel(role = "", fallback = "roll markimata") {
  const normalized = normalizeContactRoleText(role);
  const semanticKeys = new Set(contactRoleSemanticKeys(normalized));
  const family = CONTACT_ROLE_FAMILIES.find(entry => semanticKeys.has(entry.key));
  if (family) return family.label;

  const cleaned = String(role || "")
    .replace(/\s+(?:pea)?spetsialist\p{L}*\s*$/iu, "")
    .replace(/\s+(?:juht|juhataja|koordinaator)\p{L}*\s*$/iu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 80);
  return cleaned ? cleaned.toLocaleLowerCase("et") : fallback;
}

export function contactRoleQueryMatches(message = "", role = "", roleFamily = "") {
  const queryKeys = new Set(contactRoleSemanticKeys(message));
  const roleKeys = contactRoleSemanticKeys(`${role} ${roleFamily}`);
  if (roleKeys.some(key => queryKeys.has(key))) return true;

  const queryTokens = contactRoleTokens(message);
  const roleTokens = contactRoleTokens(`${role} ${roleFamily}`);
  return roleTokens.some(roleToken => queryTokens.some(queryToken =>
    contactRoleTokenMatches(roleToken, queryToken)
  ));
}

export function contactRoleTextMatches(value = "", label = "") {
  const normalizedValue = normalizeContactRoleText(value);
  const normalizedLabel = normalizeContactRoleText(label);
  if (!normalizedValue || !normalizedLabel) return false;
  if (normalizedValue.includes(normalizedLabel)) return true;

  const valueKeys = new Set(contactRoleSemanticKeys(normalizedValue));
  const labelKeys = contactRoleSemanticKeys(normalizedLabel);
  if (labelKeys.some(key => valueKeys.has(key))) return true;

  const labelTokens = contactRoleTokens(normalizedLabel);
  const valueTokens = contactRoleTokens(normalizedValue);
  if (!labelTokens.length) return false;
  const required = labelTokens.length === 1 ? 1 : Math.max(2, Math.ceil(labelTokens.length * 0.6));
  return labelTokens.filter(labelToken => valueTokens.some(valueToken =>
    contactRoleTokenMatches(labelToken, valueToken)
  )).length >= required;
}
