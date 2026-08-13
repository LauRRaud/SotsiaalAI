import { buildPersonalDataWarning, detectPersonalData } from "./privacy/piiFilter.js";

const LIFE_DOMAIN_RULES = Object.freeze([
  {
    label: "suhtlemine",
    keywords: ["suhtle", "suhe", "üksinda", "tugivõrg", "lähedane", "naaber", "sõber"]
  },
  {
    label: "vaimne tervis",
    keywords: ["vaimne", "ärev", "depress", "mälu", "dements", "psüüh", "sõltuv", "enesetapp"]
  },
  {
    label: "füüsiline tervis",
    keywords: ["tervis", "haigus", "ravim", "liikum", "kõnd", "käimine", "abivahend", "füüsil"]
  },
  {
    label: "elukeskkond",
    keywords: ["eluase", "elukoht", "elamisting", "kodune keskkond", "korter", "üür", "kodutu", "abi kutsumiseks"]
  },
  {
    label: "hõivatus",
    keywords: ["töö", "töötu", "õpp", "hõive", "töötukassa", "sissetulek"]
  },
  {
    label: "vaba aeg ja huvitegevus",
    keywords: ["vaba aeg", "huvitegev", "huviring", "üksild", "päevakeskus"]
  },
  {
    label: "igapäevaelu toimingud",
    keywords: ["igapäev", "pesem", "söö", "joom", "toidu", "korist", "majapid", "hooldus", "koduteenus", "riiet", "raha"]
  }
]);

const TARGET_GROUP_RULES = Object.freeze([
  {
    label: "eakas inimene",
    keywords: ["eakas", "vanur", "dements", "hooldekodu", "üldhooldus"]
  },
  {
    label: "lähedane või hooldaja",
    keywords: ["hooldan", "hooldaja", "hoolduskoorm", "lähedane", "ema", "isa", "abikaasa"]
  },
  {
    label: "puudega inimene",
    keywords: ["puue", "puudega", "erivajadus", "abivahend", "töövõime"]
  },
  {
    label: "vaimse tervise murega inimene",
    keywords: ["vaimne", "ärev", "depress", "psüüh", "sõltuv", "enesetapp"]
  }
]);

const START_ONLY_PHRASES = Object.freeze([
  "soovin alustada abivajaduse eelkaardistust",
  "alusta abivajaduse eelkaardistust",
  "alusta eelkaardistust",
  "eelkaardistust"
]);

const FIRST_STEP_QUESTIONS = Object.freeze([
  "Millises KOV-is või piirkonnas inimene elab?",
  "Kas soovid koostada kirja KOV sotsiaaltöötajale, lastekaitsele või teenuseosutajale?",
  "Kas soovid teha eelkaardistuse küsimustiku või koostada kohe lihtsa pöördumise mustandi?",
  "Kirjelda lühidalt, mis olukord vajab abi ja kas midagi on praegu kiireloomuline."
]);

const DOMAIN_QUESTIONS = Object.freeze({
  "suhtlemine": "Kes on inimese tugivõrgustikus ja kas keegi aitab igapäevaselt?",
  "vaimne tervis": "Kas mure on seotud mälu, vaimse tervise, otsuste tegemise või riskikäitumisega?",
  "füüsiline tervis": "Kas inimene liigub kodus ja väljaspool kodu iseseisvalt või vajab kõrvalist abi või abivahendit?",
  "elukeskkond": "Kas kodune keskkond on turvaline ja kas inimesel on võimalik vajadusel abi kutsuda?",
  "hõivatus": "Kas töö, õppimine, hõive või sissetulek on olukorra tõttu muutunud?",
  "vaba aeg ja huvitegevus": "Kas inimene saab oma päeva sisustada ja osaleda talle olulistes tegevustes?",
  "igapäevaelu toimingud": "Kas inimene vajab abi igapäevatoimingutes, näiteks pesemisel, söömisel, toidu valmistamisel või majapidamises?"
});

function normalizeText(...values) {
  return values
    .map((value) => String(value || ""))
    .join(" ")
    .toLocaleLowerCase("et")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForMatch(...values) {
  return normalizeText(...values)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function hasExplicitChildContext(text) {
  const normalized = normalizeForMatch(text);
  const explicitlyNoChildren = /\b(?:lapsi|lapsel|lapsed)\b[^.!?]{0,32}\b(?:ei ole|pole)\b|\blasteta\b/u.test(normalized);
  if (explicitlyNoChildren && !/\b(?:lapse\w*|alaeali\w*|nooruk\w*|teismelis\w*)\b[^.!?]{0,48}\b(?:oh|turval|kius|vaarkoht|hooletus|seksuaal|ahvard)\w*/u.test(normalized)) {
    return false;
  }
  return /\b(?:laps\w*|laste\w*|alaeali\w*|nooruk\w*|teismelis\w*|koolilaps\w*|lasteaed\w*|lastekaitse\w*)\b/u.test(normalized);
}

function hasYouthContext(text) {
  return /\b(?:noor|nooruk\w*|teismelis\w*)\b/u.test(normalizeForMatch(text));
}

function hasCurrentCrisisSignal(text) {
  const normalized = normalizeForMatch(text);
  const crisisSignal = /\b(?:kodu|lahisuhte)?vagival\w*|\bahvard\w*|\bvahetu\w*\s+oh\w*|\bei\s+ole\s+turvaline\b|\benesevigast\w*|\bennast\s+vigasta\w*|\bvigasta\w*\s+ennast\b|\benesetap\w*|\btahan\s+surra\b|\bei\s+taha\s+enam\s+elada\b|\btapab\b|\bviolence\b|\bviolent\b|\bthreaten\w*|\bimmediate\s+danger\b|\bnot\s+safe\b|\bself[- ]?harm\w*|\bsuicid\w*|насили\w*|угрожа\w*|непосредственн\w*\s+опасност\w*|самоповрежд\w*|навредить\s+себе|небезопасно/u.test(normalized);
  if (!crisisSignal) return false;

  const explicitlySafe = /\bvagival\w*\s+(?:ei\s+ole|pole)\b|\bkeegi\s+ei\s+ahvarda\b|\bvahetu\w*\s+oht\w*\s+(?:ei\s+ole|pole)\b|\bno\s+(?:violence|immediate\s+danger)\b|\bnot\s+violent\b|насили[а-яё]*\s+нет|опасност[а-яё]*\s+нет|не\s+угрожа[а-яё]*/u.test(normalized);
  if (explicitlySafe) return false;

  const historical = /\b(?:varem|minevikus|in\s+the\s+past|previously)\b|раньше|в\s+прошлом/u.test(normalized);
  const currentDanger = /\b(?:praegu|hetkel|vahetu\w*)\b[^.!?]{0,64}\b(?:oh\w*|kardab|ahvard\w*|vagival\w*)\b|\bimmediate\s+danger\b|\bcurrently\b[^.!?]{0,48}\b(?:danger|threat|violent)\w*|сейчас[^.!?]{0,64}(?:опасност|угрожа|насили)/u.test(normalized);
  return !historical || currentDanger;
}

function includesAny(text, keywords = []) {
  return keywords.some((keyword) => text.includes(keyword));
}

function hasOlderAdultSignal(text) {
  return /\b(?:6[5-9]|[7-9]\d|1\d{2})\b/.test(text);
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function removeStartOnlyPhrases(text) {
  return START_ONLY_PHRASES.reduce(
    (current, phrase) => current.replaceAll(phrase, " "),
    text
  ).replace(/\s+/g, " ").trim();
}

export function buildPreInquiryAssessment({
  topic = "",
  situation = "",
  assistantMessage = "",
  selectedNeedAreas = [],
  urgencyLevel = ""
} = {}) {
  const personalData = detectPersonalData(topic, situation, assistantMessage, selectedNeedAreas.join(" "));
  const text = normalizeText(topic, situation, assistantMessage, selectedNeedAreas.join(" "));
  const meaningfulText = removeStartOnlyPhrases(text);
  const childProtection = hasExplicitChildContext(text);
  const youthContext = hasYouthContext(text);
  const crisis = hasCurrentCrisisSignal(text);
  const lifeDomains = LIFE_DOMAIN_RULES
    .filter((rule) => includesAny(text, rule.keywords))
    .map((rule) => rule.label);
  if (childProtection) lifeDomains.push("lapse heaolu ja pere");
  const targetGroups = TARGET_GROUP_RULES
    .filter((rule) => includesAny(text, rule.keywords))
    .map((rule) => rule.label);
  if (childProtection) targetGroups.unshift("laps ja pere");

  if (hasOlderAdultSignal(text) && !targetGroups.includes("eakas inimene")) {
    targetGroups.unshift("eakas inimene");
  }

  const needsMoreInput = meaningfulText.length < 18 && !lifeDomains.length && !targetGroups.length && !crisis;
  const normalizedUrgency = String(urgencyLevel || "").trim().toUpperCase();
  const finalUrgency = crisis ? "URGENT" : (normalizedUrgency || "NORMAL");
  const suggestedNextSteps = needsMoreInput
    ? "ASK_DETAILS"
    : crisis
    ? "CRISIS"
    : childProtection
      ? "CHILD_PROTECTION"
      : lifeDomains.includes("igapäevaelu toimingud") || targetGroups.includes("lähedane või hooldaja")
        ? "BOTH"
        : "KOV";
  const clarifyingQuestions = needsMoreInput
    ? [...FIRST_STEP_QUESTIONS]
    : childProtection
    ? [
        "Mis on lapse või pere peamine mure ja kas lapse turvalisus vajab kiiret sekkumist?",
        "Kas kool, lasteaed, perearst, lähedane või mõni muu osapool on juba kaasatud?"
      ]
    : unique([
        ...lifeDomains.map((domain) => DOMAIN_QUESTIONS[domain]),
        "Mida inimene ise soovib ja mis oleks tema jaoks esimene praktiline järgmine samm?",
        "Kas KOV-i, teenuseosutaja, perearsti või muu osapoolega on varem suheldud?"
      ]).slice(0, 5);
  const riskFlags = unique([
    personalData.hasPersonalData ? "PERSONAL_DATA" : "",
    crisis ? "CRISIS" : "",
    childProtection ? "CHILD_SAFETY" : "",
    childProtection && youthContext ? "YOUTH_SAFETY" : ""
  ]);
  const warnings = [
    buildPersonalDataWarning(personalData),
    "Eelkaardistus ei ole ametlik abivajaduse hindamine ega STAR2 hindamise asendaja.",
    childProtection
      ? "Lapse või alaealise ohutuse korral suuna inimene Lasteabi 116 111, vahetu ohu korral 112 või KOV lastekaitse poole. AI ei tee lõplikku riskihinnangut."
      : "",
    finalUrgency === "URGENT"
      ? "Vägivalla või kuriteo korral saab nõu ohvriabi kriisitelefonilt 116 006."
      : "",
    finalUrgency === "URGENT"
      ? "Kui olukord on vahetult ohtlik või vajab kiiret abi, helista 112 või pöördu kriisiabi poole."
      : ""
  ].filter(Boolean);

  return {
    assessmentMode: "PRE_ASSESSMENT",
    needsMoreInput,
    lifeDomains: unique(lifeDomains),
    targetGroups: unique(targetGroups),
    riskFlags,
    personalDataCategories: personalData.categories,
    urgencyLevel: finalUrgency,
    suggestedNextSteps,
    clarifyingQuestions,
    warnings
  };
}
