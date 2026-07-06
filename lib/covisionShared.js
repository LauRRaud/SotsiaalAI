import { COVISION_RISK_OPTIONS } from "./covisionConstants.js";

const MAX_SNIPPET_LENGTH = 120;

const ANONYMITY_RULES = Object.freeze([
  {
    type: "personal_code",
    label: "Võimalik isikukood",
    pattern: /\b[1-6]\d{10}\b/g
  },
  {
    type: "email",
    label: "E-posti aadress",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
  },
  {
    type: "phone",
    label: "Võimalik telefoninumber",
    pattern: /(?:\+372[\s-]?)?(?:5|6|7|8)\d(?:[\s-]?\d){5,6}\b/g
  },
  {
    type: "exact_date",
    label: "Väga konkreetne kuupäev",
    pattern: /\b(?:\d{1,2}\.\d{1,2}\.\d{2,4}|\d{4}-\d{2}-\d{2})\b/g
  },
  {
    type: "address",
    label: "Võimalik täpne aadress",
    pattern: /\b[\p{Lu}ÕÄÖÜŠŽ][\p{L}õäöüšž-]+\s+(?:tn|tänav|tee|maantee|pst|puiestee)\s+\d+\w?\b/gu
  },
  {
    type: "name",
    label: "Võimalik nimi",
    pattern: /\b[\p{Lu}ÕÄÖÜŠŽ][\p{Ll}õäöüšž-]{2,}\s+[\p{Lu}ÕÄÖÜŠŽ][\p{Ll}õäöüšž-]{2,}\b/gu
  },
  {
    type: "small_place",
    label: "Väike asula või kitsas piirkond",
    pattern: /\b[\p{Lu}ÕÄÖÜŠŽ][\p{L}õäöüšž-]+\s+(?:küla|alevik|alev)\b/gu
  },
  {
    type: "institution",
    label: "Konkreetne kool, töökoht või asutus",
    pattern: /\b[\p{Lu}ÕÄÖÜŠŽ][\p{L}õäöüšž-]+(?:\s+[\p{Lu}ÕÄÖÜŠŽ][\p{L}õäöüšž-]+)?\s+(?:kool|gümnaasium|lasteaed|haigla|hooldekodu|ettevõte|asutus)\b/giu
  },
  {
    type: "rare_detail",
    label: "Võimalik äratuntav haruldane detail",
    pattern: /\b(?:ainus|haruldane|meedias|ajalehes|õnnetus|põleng|kohtulahend|avalikult teada)\b/giu
  }
]);

const TOPIC_KEYWORDS = Object.freeze([
  ["hoolduskoormus", ["hoolduskoorm", "hooldaja", "hooldan", "lähedase hooldus"]],
  ["puue", ["puue", "erivajad", "abivajad", "rehabilitatsioon"]],
  ["lapsed ja pered", ["laps", "pere", "vanem", "lastekaitse", "kool", "lasteaed"]],
  ["eluase", ["eluase", "korter", "üür", "kodutu", "elukoht"]],
  ["võlad ja toimetulek", ["võlg", "toimetulek", "sissetulek", "arve", "raha"]],
  ["lähisuhtevägivald", ["vägivald", "lähisuhte", "ohvriabi", "turvakodu"]],
  ["vaimne tervis", ["vaimne", "psühhiaater", "psühholoog", "depress", "ärevus", "suitsiid"]],
  ["sõltuvus", ["sõltuvus", "alkohol", "narkoot", "hasart"]],
  ["töö ja karjäär", ["töötukassa", "töö", "karjäär", "hõive"]],
  ["abivahendid", ["abivahend", "ratastool", "ortoos"]],
  ["KOV teenused", ["KOV", "omavalitsus", "sotsiaaltöötaja", "teenus"]],
  ["teenuseosutaja koostöö", ["teenuseosutaja", "teenuse osutaja", "hooldekodu", "koduteenus"]],
  ["võrgustikutöö", ["võrgustik", "koostöö", "osapool", "kohtumine"]],
  ["eetiline dilemma", ["eetiline", "dilemma", "vastutus", "nõusolek"]],
  ["dokumenteerimine", ["dokumenteer", "dokument", "kirjeldus", "otsus"]],
  ["kriis", ["kriis", "kiire", "häda", "oht", "112"]]
]);

export function normalizeText(value, maxLength = 12_000) {
  const normalized = String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  return normalized ? normalized.slice(0, maxLength) : "";
}

export function normalizeList(value, { maxItems = 40, maxLength = 80 } = {}) {
  const source = Array.isArray(value)
    ? value
    : String(value || "").split(/[,;\n\r]/);
  const seen = new Set();
  const result = [];
  for (const item of source) {
    const normalized = normalizeText(item, maxLength);
    const key = normalized.toLocaleLowerCase("et");
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= maxItems) break;
  }
  return result;
}

export function normalizeEmail(value) {
  const email = normalizeText(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function buildSnippet(text, match) {
  const index = Math.max(0, match.index || 0);
  const raw = String(text || "");
  const start = Math.max(0, index - 36);
  const end = Math.min(raw.length, index + String(match[0] || "").length + 36);
  return raw.slice(start, end).replace(/\s+/g, " ").trim().slice(0, MAX_SNIPPET_LENGTH);
}

export function detectAnonymityIssues(text) {
  const input = String(text || "");
  if (!input.trim()) return [];
  const issues = [];
  const seen = new Set();
  for (const rule of ANONYMITY_RULES) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    for (const match of input.matchAll(pattern)) {
      const snippet = buildSnippet(input, match);
      const key = `${rule.type}:${snippet.toLocaleLowerCase("et")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push({
        type: rule.type,
        label: rule.label,
        snippet,
        suggestion: anonymitySuggestion(rule.type)
      });
      if (issues.length >= 12) return issues;
    }
  }
  return issues;
}

function anonymitySuggestion(type) {
  if (type === "personal_code") return "Eemalda isikukood täielikult.";
  if (type === "email") return "Asenda e-posti aadress rolli või kontaktikanaliga.";
  if (type === "phone") return "Eemalda telefoninumber või jäta ainult kontaktikanali kirjeldus.";
  if (type === "exact_date") return "Kasuta perioodi, näiteks kuu, aasta või sündmuse järjekord.";
  if (type === "address") return "Üldista aadress piirkonnaks või teenuse liigiks.";
  if (type === "name") return "Asenda nimi rolliga, näiteks klient, lapsevanem või hooldaja.";
  if (type === "small_place") return "Kasuta laiemat piirkonda, kui väike asula võib inimest tuvastada.";
  if (type === "institution") return "Üldista asutus rolliks, näiteks kool, tööandja või teenuseosutaja.";
  return "Hinda, kas detail on juhtumi mõistmiseks vajalik või saab seda üldistada.";
}

export function buildAnonymizedDraft(text) {
  return normalizeText(text)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[e-post eemaldatud]")
    .replace(/\b[1-6]\d{10}\b/g, "[isikukood eemaldatud]")
    .replace(/\b(?:\d{1,2}\.\d{1,2}\.\d{2,4}|\d{4}-\d{2}-\d{2})\b/g, "[kuupäev üldistada]")
    .replace(/(?:\+372[\s-]?)?(?:5|6|7|8)\d(?:[\s-]?\d){5,6}\b/g, "[telefon eemaldatud]")
    .replace(/\b[\p{Lu}ÕÄÖÜŠŽ][\p{L}õäöüšž-]+\s+(?:tn|tänav|tee|maantee|pst|puiestee)\s+\d+\w?\b/gu, "[aadress üldistada]");
}

export function inferCovisionTopics(...values) {
  const text = values
    .map((value) => String(value || ""))
    .join(" ")
    .toLocaleLowerCase("et");
  const detected = [];
  for (const [topic, keywords] of TOPIC_KEYWORDS) {
    if (keywords.some((keyword) => text.includes(keyword.toLocaleLowerCase("et")))) {
      detected.push(topic);
    }
  }
  return detected.length ? detected : ["muu"];
}

export function suggestCentralQuestions({ description = "", topics = [], riskFactors = [] } = {}) {
  const normalizedTopics = normalizeList(topics);
  const risks = Array.isArray(riskFactors) ? riskFactors : [];
  const riskLabels = risks
    .filter((item) => String(item?.type || item?.kind || "").toLowerCase() !== "protective")
    .map((item) => item?.label)
    .filter(Boolean);
  const inferred = normalizedTopics.length
    ? normalizedTopics
    : inferCovisionTopics(description);
  const primaryTopic = inferred[0] || "olukord";
  const primaryRisk = riskLabels[0] || COVISION_RISK_OPTIONS.find((risk) => description.toLocaleLowerCase("et").includes(risk.slice(0, 6))) || "";

  const questions = [
    `Milliseid järgmisi tööalaseid samme võiks kaaluda teemal "${primaryTopic}", hoides otsuse spetsialisti ja võrgustiku vastutuses?`,
    primaryRisk
      ? `Kuidas arutelus läbi mõelda riski "${primaryRisk}" ning samal ajal märgata olemasolevaid kaitsetegureid?`
      : "Milliseid riske ja kaitsetegureid peaksid kolleegid selles juhtumis esmalt aitama läbi mõelda?",
    "Kuidas sõnastada olukorra dokumenteerimine nii, et kirjeldus oleks neutraalne, anonüümne ja tööalaselt kasutatav?"
  ];

  return [...new Set(questions)].slice(0, 3);
}

function compactList(values, fallback = "Puudub") {
  const list = normalizeList(values, { maxItems: 8, maxLength: 140 });
  return list.length ? list.map((value) => `- ${value}`).join("\n") : fallback;
}

export function draftCovisionSummary(covisionCase = {}, messages = []) {
  const activeMessages = Array.isArray(messages) ? messages : [];
  const byType = (type) => activeMessages
    .filter((message) => String(message?.messageType || message?.type || "").toLowerCase() === type)
    .map((message) => normalizeText(message?.body, 220))
    .filter(Boolean);

  const observations = byType("observation");
  const questions = byType("question");
  const nextSteps = byType("next_step");
  const documentation = byType("documentation_note");
  const network = byType("network_note");
  const risks = [
    ...(covisionCase.riskFactors || [])
      .filter((item) => String(item?.type || "").toLowerCase() === "risk")
      .map((item) => item.label),
    ...byType("risk")
  ];
  const protective = [
    ...(covisionCase.riskFactors || [])
      .filter((item) => String(item?.type || "").toLowerCase() === "protective")
      .map((item) => item.label),
    ...byType("protective_factor")
  ];

  const keyObservations = observations.length
    ? compactList(observations)
    : covisionCase.summary || "Arutelus korduvad tähelepanekud vajavad spetsialisti ülevaatust.";

  return {
    content: [
      `Keskne küsimus: ${covisionCase.centralQuestion || "täpsustamisel"}`,
      "",
      "Peamised tähelepanekud:",
      keyObservations,
      "",
      "Võimalikud järgmised tööalased sammud:",
      compactList(nextSteps, "Kolleegid ei ole veel järgmisi samme eraldi sõnastanud.")
    ].join("\n"),
    keyObservations,
    questions: compactList(questions, "Täpsustavad küsimused ei ole veel koondatud."),
    risks: compactList(risks, "Arutelus märgitud riskid puuduvad või vajavad lisamist."),
    protectiveFactors: compactList(protective, "Kaitsetegurid vajavad eraldi märkimist."),
    possibleNextSteps: compactList(nextSteps, "Järgmised sammud jäävad juhtumi püstitaja otsustada."),
    ethicalNotes: "AI ei tee juhtumi kohta otsust. Eetilised ja metoodilised kaalutlused jäävad spetsialistide arutelusse.",
    documentationNotes: compactList(documentation, "Dokumenteerimise tähelepanekud vajavad ülevaatust."),
    networkNotes: compactList(network, "Võrgustikutöö mõtted vajavad täpsustamist."),
    takeaways: "Juhtumi püstitaja täpsustab, mida ta arutelust kaasa võtab.",
    openQuestions: compactList(questions, "Lahtised küsimused täpsustatakse enne kovisiooni sulgemist.")
  };
}

export function buildEffectivePracticeDraft(covisionCase = {}, summary = {}) {
  const title = covisionCase.title
    ? `Toimiv praktika: ${covisionCase.title}`.slice(0, 160)
    : "Toimiva praktika mustand";
  const protective = (covisionCase.riskFactors || [])
    .filter((item) => String(item?.type || "").toLowerCase() === "protective")
    .map((item) => item.label);
  const network = (covisionCase.parties || []).map((party) => party.label || party.type).filter(Boolean);

  return {
    title,
    topics: covisionCase.topics || [],
    tags: covisionCase.tags || [],
    background: covisionCase.summary || covisionCase.anonymizedDescription || "",
    mainChallenge: covisionCase.centralQuestion || "",
    whatHelped: summary.protectiveFactors || compactList(protective, ""),
    networkOrServiceRole: summary.networkNotes || compactList(network, ""),
    outcome: "",
    learningPoints: summary.takeaways || "",
    limitations: "Kirje vajab üldistamist ja anonüümsuse kontrolli enne avaldamist.",
    status: "anonymity_check"
  };
}
