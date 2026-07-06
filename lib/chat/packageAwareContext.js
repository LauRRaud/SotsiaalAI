const HIGH_RISK_MISSING_SECTIONS = ["forms", "contacts", "legal_basis", "fees", "deadlines"];
const QUERY_SECTION_PATTERNS = {
  forms: /\b(vorm|vormi|vormid|blankett|blanketi|avaldus|avalduse|taotlusvorm|taotlusvormi|docx|pdf|fail|faili)\b/,
  contacts: /\b(kontakt|kontakti|kontaktid|telefon|e-post|epost|email|meil|spetsialist|kelle poole|kuhu poord)\b/,
  legal_basis: /(§|\b(paragrahv|oigus|oiguslik|alus|maarus|seadus|kord)\b)/,
  fees: /\b(tasu|tasud|hind|maksumus|omaosalus|summa|maksab|tasuline|euro|eur|€)\b/,
  deadlines: /\b(tahtaeg|tahtajad|kaua|millal|otsustamise aeg|menetlusaeg|toopaev)\b/
};
const SECTION_LABELS_ET = {
  description: "kirjeldus",
  eligibility: "tingimused/sihtrühm",
  application: "taotlemine",
  forms: "vormid",
  contacts: "kontaktid",
  legal_basis: "õiguslik alus",
  fees: "tasud",
  deadlines: "tähtajad"
};

function clean(value) {
  const text = String(value || "").trim();
  return text || null;
}

function unique(values = []) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeToken(token = "") {
  const value = String(token || "").trim();
  if (/^koduteen/.test(value)) return "koduteenus";
  if (/^sotsiaalteen/.test(value)) return "sotsiaalteenus";
  if (/^hooldajatoetu/.test(value)) return "hooldajatoetus";
  if (/^toetu/.test(value)) return "toetus";
  if (/^teen/.test(value)) return "teenus";
  return value;
}

function queryAnchorTokens(query = "") {
  const generic = new Set(["teenus", "sotsiaalteenus", "toetus", "abi"]);
  return [...new Set(normalizeText(query)
    .split(" ")
    .map(normalizeToken)
    .filter(token => token.length >= 4)
    .filter(token => !generic.has(token))
    .filter(token => /teenus$/.test(token) || /toetus$/.test(token)))];
}

function queryRelevantMissingSections(query = "", missingSections = []) {
  const missing = unique(missingSections).filter(section => HIGH_RISK_MISSING_SECTIONS.includes(section));
  if (!clean(query)) return missing;
  const normalized = normalizeText(query);
  const asksApplication = /\b(taotle|taotleda|taotlemine|taotl|avaldus|avalduse|kuidas saada|kuidas kasutada)\b/.test(normalized);
  const relevant = missing.filter(section => QUERY_SECTION_PATTERNS[section]?.test(normalized));
  if (asksApplication) {
    for (const section of ["forms", "contacts"]) {
      if (missing.includes(section) && !relevant.includes(section)) relevant.push(section);
    }
  }
  return relevant;
}

function isServiceOverviewQuestion(query = "") {
  const normalized = normalizeText(query);
  if (!normalized) return false;
  const asksService = /\b[a-z0-9]*teenus[a-z0-9]*\b/u.test(normalized);
  const asksAvailabilityOrOverview = /\b(kas|on|olemas|pakutakse|pakub|saab|mis|mida|kuidas)\b/.test(normalized);
  return asksService && asksAvailabilityOrOverview;
}

function isServiceConditionQuestion(query = "") {
  const normalized = normalizeText(query);
  if (!normalized) return false;
  return /\b(tingimus|tingimused|sihtruhm|kellele|oigus saada|saamise kord|eeldused)\b/.test(normalized);
}

function packageIdentityText(pkg = {}) {
  const sections = normalizeSections(pkg.sections);
  return normalizeText([
    pkg.title,
    pkg.package_id,
    pkg.canonical_item_id,
    pkg.package_type,
    ...["description", "eligibility", "application"].flatMap(section => {
      const list = sections[section];
      return Array.isArray(list)
        ? list.flatMap(source => [source?.title, source?.source_id, source?.resource_type, source?.source_type])
        : [];
    })
  ].filter(Boolean).join(" "));
}

function packageRelevanceScore(pkg = {}, options = {}) {
  const anchors = queryAnchorTokens(options.query);
  const text = packageIdentityText(pkg);
  let score = 0;
  for (const anchor of anchors) {
    if (text.includes(anchor)) score += 100;
  }
  if (Array.isArray(pkg.source_ids) && pkg.source_ids.length) score += Math.min(8, pkg.source_ids.length);
  const counts = sectionCounts(pkg);
  score += Object.values(counts).filter(value => Number(value) > 0).length;
  return score;
}

function choosePackages(sourcePackages = [], options = {}) {
  const packages = (Array.isArray(sourcePackages) ? sourcePackages : [])
    .filter(pkg => pkg && typeof pkg === "object")
    .filter(pkg => clean(pkg.package_id) && clean(pkg.canonical_item_id) && clean(pkg.municipality_id));
  const anchors = queryAnchorTokens(options.query);
  const maxPackages = Number.isFinite(Number(options.maxPackages)) ? Math.max(1, Number(options.maxPackages)) : 3;
  const scored = packages.map((pkg, index) => ({
    pkg,
    index,
    score: packageRelevanceScore(pkg, options)
  }));
  const relevant = anchors.length ? scored.filter(item => item.score >= 100) : scored;
  const pool = relevant.length ? relevant : scored;
  return pool
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, anchors.length ? 1 : maxPackages)
    .map(item => item.pkg);
}

function normalizeSections(sections = {}) {
  return sections && typeof sections === "object" ? sections : {};
}

function packageSourceIds(pkg = {}) {
  const ids = new Set(Array.isArray(pkg.source_ids) ? pkg.source_ids.map(clean).filter(Boolean) : []);
  for (const list of Object.values(normalizeSections(pkg.sections))) {
    if (!Array.isArray(list)) continue;
    for (const source of list) {
      const id = clean(source?.source_id);
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

function sourceUrl(source = {}) {
  return clean(
    source.url ||
    source.url_canonical ||
    source.urlCanonical ||
    source.source_url ||
    source.sourceUrl ||
    source.official_url ||
    source.officialUrl
  );
}

function sectionSourceLines(section, sources = [], options = {}) {
  if (!Array.isArray(sources) || !sources.length) {
    return options.includeMissingLine === true
      ? [`- ${SECTION_LABELS_ET[section] || section}: missing`]
      : [];
  }
  return sources.slice(0, 6).map(source => {
    const url = sourceUrl(source);
    const parts = [
      `source_id=${clean(source.source_id) || "unknown"}`,
      clean(source.title),
      clean(source.source_type) ? `source_type=${clean(source.source_type)}` : "",
      clean(source.resource_type) ? `resource_type=${clean(source.resource_type)}` : "",
      clean(source.evidence_strength) ? `evidence_strength=${clean(source.evidence_strength)}` : "",
      url ? `url=${url}` : ""
    ].filter(Boolean);
    return `- ${SECTION_LABELS_ET[section] || section}: ${parts.join("; ")}`;
  });
}

function sectionCounts(pkg = {}) {
  if (pkg.section_counts && typeof pkg.section_counts === "object") return pkg.section_counts;
  const sections = normalizeSections(pkg.sections);
  return Object.fromEntries(Object.entries(sections).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0]));
}

export function buildPackageAwareContext(sourcePackages = [], options = {}) {
  const packages = choosePackages(sourcePackages, options);

  if (!packages.length) {
    return {
      used: false,
      contextText: "",
      usedPackageIds: [],
      missingSectionsUsed: [],
      packageDisplayedSourceIds: [],
      packageAnswerFlags: []
    };
  }

  const blocks = [];
  const usedPackageIds = [];
  const missingSections = new Set();
  const displayedSourceIds = new Set();
  const answerFlags = new Set();
  const serviceOverviewQuestion = isServiceOverviewQuestion(options.query);
  const serviceConditionQuestion = isServiceConditionQuestion(options.query);
  const professionalRole = String(options.role || options.normalizedRole || "").trim().toUpperCase() === "SOCIAL_WORKER";

  packages.forEach((pkg, index) => {
    usedPackageIds.push(pkg.package_id);
    for (const id of packageSourceIds(pkg)) displayedSourceIds.add(id);
    const missing = queryRelevantMissingSections(options.query, pkg.missing_sections || []);
    for (const section of missing) {
      missingSections.add(section);
      answerFlags.add(`missing_${section}`);
    }

    const sections = normalizeSections(pkg.sections);
    const counts = sectionCounts(pkg);
    const lines = [
      `SOURCE PACKAGE ${index + 1}: ${clean(pkg.title) || clean(pkg.canonical_item_id) || "KOV service"}`,
      `package_id=${pkg.package_id}`,
      `canonical_item_id=${pkg.canonical_item_id}`,
      `package_type=${clean(pkg.package_type) || "unknown"}`,
      `municipality_id=${pkg.municipality_id}`,
      pkg.municipality_name ? `municipality_name=${pkg.municipality_name}` : "",
      pkg.confidence ? `confidence=${pkg.confidence}` : "",
      serviceOverviewQuestion ? "answer_focus=availability,service_content,legal_basis,application,forms,contacts" : "",
      serviceConditionQuestion ? "answer_focus_conditions=use_confirmed_description_eligibility_application_and_legal_basis" : "",
      `missing_sections_relevant_to_question=${missing.length ? missing.join(",") : "none"}`,
      `section_counts=${Object.entries(counts).map(([key, value]) => `${key}:${value}`).join(",")}`,
      "",
      "Confirmed package sections:"
    ].filter(line => typeof line === "string");

    for (const section of ["description", "eligibility", "application", "forms", "contacts", "legal_basis", "fees", "deadlines"]) {
      lines.push(...sectionSourceLines(section, sections[section], {
        includeMissingLine: missing.includes(section)
      }));
    }
    blocks.push(lines.join("\n"));
  });

  const guardrails = [
    "PACKAGE-AWARE ANSWERING RULES:",
    "- Kasuta SourcePackage'i esmase struktuurina KOV teenuse või toetuse vastuses.",
    "- Teenuse olemasolu küsimuses anna kohe tervikvastus: kas teenus on olemas, teenuse eesmärk ja sisu, kuidas taotleda, ning kinnitatud vormi- ja kontaktiallikas, kui need on package'is olemas.",
    "- Kombineeri KOV teenuselehe praktiline info ja KOV määruse/legal_basis info; ära piirdu ainult ühega, kui mõlemad on package'is olemas.",
    "- Ära lõpeta vastust lubadusega neid detaile hiljem anda, kui taotlemise, vormi, kontakti või teenuse sisu info on allikates olemas; anna need kohe lühidalt.",
    "- Ära leiuta puuduvat vormi, kontakti, tasu, tähtaega ega õiguslikku alust.",
    "- Puuduvat vormi, kontakti, tasu või tähtaega maini ainult siis, kui kasutaja seda küsib või see on vastuse jaoks vältimatult oluline.",
    "- Kui forms sektsioonis on vormi URL ja vastus mainib taotlemist või vormi, too see vormi link vastuses välja.",
    "- Kui contacts sektsioonis on kontaktiallikas ja vastus mainib taotlemist, too kontakt või kontaktileht vastuses välja.",
    "- Kui legal_basis sektsioon on olemas, kasuta seda teenuse sisu ja õigusliku aluse täpsustamiseks koos KOV teenuselehega.",
    "- Tallinna linna puhul: kui teenuse taotlemine käib elukohajärgse linnaosa sotsiaalhoolekande osakonna kaudu ja kasutaja ei ole linnaosa/asumit täpsustanud, ütle, et konkreetse kontakti valimiseks on vaja linnaosa, ning küsi linnaosa üle. Ära jäta sellepärast teenuse tingimusi, taotlemise põhisuunda või õiguslikku alust vastamata.",
    "- Kui kasutaja on Tallinnas nimetanud linnaosa, asumit või aadressi ning kontaktiallikad on olemas, paku vastava linnaosa kontakt või kontaktileht; kui täpne linnaosa kontakt puudub, paku Tallinna teenuse ametlik leht ja palu linnaosa täpsustada.",
    "- journal_article võib olla taust, aga mitte current teenuse, vormi, kontakti, tasu, tähtaja või õigusliku aluse kinnitus.",
    "- Kasutajale kuvatavad allikad peavad tulema package'i kinnitatud source_id väärtustest."
  ].join("\n");
  const conditionGuardrail = [
    "PACKAGE-AWARE CONDITION QUESTION RULE:",
    "- Kui kasutaja küsib teenuse tingimusi, aga eraldi eligibility/tingimused sektsioon on tühi, ära ütle automaatselt, et tingimusi ei saa välja tuua. Anna kinnitatud teenuse sihtrühm, eesmärk, sisu, taotlemise viis ja õiguslik alus description, application ja legal_basis sektsioonidest.",
    "- Sõnasta piirang usaldust hoidvalt: mitte \"ma ei saa tingimusi kinnitada\" või \"tingimused ei ole piisavalt kinnitatavad\", vaid \"kasutatud allikates on teenuse tingimused kirjeldatud üldiselt\" või \"eraldi abikõlblikkuse kriteeriume, tasusid või tähtaegu nendes allikates ei täpsustata\".",
    "- Ära sea kahtluse alla kinnitatud teenuselehte, vormi või õiguslikku alust; erista ainult seda, millist detaili allikad ei täpsusta."
  ].join("\n");
  const professionalLegalGuardrail = professionalRole
    ? [
        "SPETSIALISTI ÕIGUSVIITE REEGEL:",
        "- Kui vastad sotsiaalvaldkonna spetsialistile ja legal_basis sektsioon on olemas, nimeta paragrahvinumber ja paragrahvi pealkiri, kui need on allika pealkirjas või metaandmetes nähtavad.",
        "- Erista õigusakti tasand: KOV kord/määrus, riiklik seadus või muu õigusakt.",
        "- Kui allikas kinnitab ainult õigusakti nimetuse, aga mitte täpset paragrahvi, ütle seda lühidalt; ära mõtle paragrahve välja."
      ].join("\n")
    : "";

  return {
    used: true,
    contextText: [guardrails, conditionGuardrail, professionalLegalGuardrail, ...blocks].filter(Boolean).join("\n\n"),
    usedPackageIds,
    missingSectionsUsed: [...missingSections].sort(),
    packageDisplayedSourceIds: [...displayedSourceIds].sort(),
    packageAnswerFlags: [...answerFlags].sort()
  };
}
