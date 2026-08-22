import {
  collapsePages,
  groupMatches,
  diversifyGroupsMMR,
  selectOverviewSynthesisGroups,
  selectMultiSourceGroups,
  selectTemporalGroups,
  rankGroupsWithTopicHints,
  filterGroupsForLegalPlan,
  buildContextWithBudget,
  makeShortRef,
  filterMunicipalityScopedMatches,
  filterMatchesToMunicipalities,
  displayUrl
} from "@/lib/chat/ragContext";
import { groundingStrength } from "@/lib/chat/safety";
import { RAG_TOP_K, CONTEXT_GROUPS_MAX, DIVERSIFY_LAMBDA } from "@/lib/chat/settings";
import { shouldUseExternalSourcesForTurn } from "@/lib/chat/sourceNeed";
import {
  buildTemporalRetrievalPlan,
  buildTemporalBreakdownInstruction,
  buildTemporalFillQueries,
  extractTopicHints
} from "@/lib/chat/retrievalPlanning";
import {
  extractRecentUserText,
  normalizeIntentText,
  isMunicipalityDependentSocialHelpQuestion,
  getDocContextBudget,
  buildEphemeralDocContext,
  getEphemeralSourceLabel,
  detectMentionedMunicipalitiesFromUserText
} from "@/lib/chat/requestContext";
import {
  buildRagSearchQuery,
  searchRagQueries,
  extractParagraphReferences,
  inferSourceLookupSubject,
  detectSourceAvailabilityRequest,
  detectPreviousSourceUseRequest,
  buildSourceLookupSearchQuery,
  dedupeRagMatches,
  extractMatchGroupYear,
  inferRetrieversUsed,
  hasRecentAssistantSources,
  isBroadMultiSourceRagQuestion,
  isThematicSynthesisRagQuestion
} from "@/lib/chat/retrievalOrchestrator";
import {
  buildGeneralBackgroundQueries,
  buildNationalServiceBenefitQuery,
  buildRagQueryPlan,
  buildServiceJurisdictionQuery
} from "@/lib/chat/queryPlanner";
import { buildQuestionPlan } from "@/lib/chat/questionPlanner";
import {
  buildEvidencePackage,
  buildEvidencePackageInstruction,
  shouldBuildEvidencePackage
} from "@/lib/chat/evidencePackage";
import { buildPackageAwareContext } from "@/lib/chat/packageAwareContext";
import { buildSectionAttribution } from "@/lib/chat/sectionAttribution";
import { buildRuntimeSourcePackages } from "@/lib/chat/sourcePackages";
import { prisma } from "@/lib/prisma";
import {
  graphChannelLookup,
  graphHintsToQueryTexts,
  isGraphChannelEnabled,
  graphChannelSearchTopK,
  selectGraphChannelSupplement,
  GRAPH_CHANNEL_MAX_DISPLAYED
} from "@/lib/rag/graph/graphRetrieval";
import { buildRiskPolicyInstruction, classifyRagRisk } from "@/lib/rag/riskPolicy";

function finiteOptionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizePageRangeString(value = "") {
  return String(value).replace(/\s*[-\u2010-\u2015]\s*/g, "-").trim();
}

function stableSourceIdFromRawMatch(match = {}, index = 0) {
  const md = match?.metadata || {};
  const sourceType = String(match?.source_type || md.source_type || "").trim();
  const legalChunkId =
    /^(national_law|law|kov_regulation|regulation|riigiteataja_regulation)$/.test(sourceType)
      ? match?.chunk_id || match?.chunkId || md.chunk_id || md.chunkId || md.canonical_chunk_id || md.canonicalChunkId || match?.id
      : "";
  const raw =
    legalChunkId ||
    match?.source_id ||
    match?.sourceId ||
    md.source_id ||
    md.sourceId ||
    match?.id ||
    md.chunk_id ||
    md.chunkId ||
    md.doc_id ||
    md.docId ||
    md.item_id ||
    md.itemId ||
    md.article_id ||
    md.articleId ||
    md.source_url ||
    md.url ||
    md.title ||
    `retrieved_${index}`;
  return String(raw || `retrieved_${index}`).trim() || `retrieved_${index}`;
}

function stableSourceIdFromDisplaySource(source = {}, index = 0) {
  const sourceType = String(source?.sourceType || source?.source_type || "").trim();
  const legalId =
    /^(national_law|law|kov_regulation|regulation|riigiteataja_regulation)$/.test(sourceType)
      ? source?.id || source?.key || source?.chunk_id || source?.chunkId
      : "";
  const raw =
    legalId ||
    source?.source_id ||
    source?.sourceId ||
    source?.id ||
    source?.key ||
    source?.url ||
    source?.short_ref ||
    source?.title ||
    `source_${index}`;
  return String(raw || `source_${index}`).trim() || `source_${index}`;
}

function displayedSourceUrl(source = {}) {
  return String(
    source?.url ||
    source?.source_url ||
    source?.sourceUrl ||
    source?.url_canonical ||
    source?.urlCanonical ||
    source?.official_url ||
    source?.officialUrl ||
    source?.official_website ||
    source?.officialWebsite ||
    source?.metadata?.official_website ||
    source?.metadata?.officialWebsite ||
    ""
  ).trim();
}

function normalizeDisplayAliasText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function shouldIncludeContextAuthors(message = "", groups = [], options = {}) {
  if (options?.sourceLookupRequest === true) return true;
  const normalizedMessage = normalizeIntentText(message);
  if (!normalizedMessage) return false;
  if (/\b(autor|autorid|autori|autoreid|autorlus|kirjutas|kirjutanud|kelle kirjutatud|kelle artikkel)\b/.test(normalizedMessage)) {
    return true;
  }

  const messageWords = new Set(normalizedMessage.split(/[^a-z0-9]+/i).filter(Boolean));
  for (const group of Array.isArray(groups) ? groups : []) {
    for (const author of Array.isArray(group?.authors) ? group.authors : []) {
      const normalizedAuthor = normalizeIntentText(author);
      if (!normalizedAuthor) continue;
      if (normalizedMessage.includes(normalizedAuthor)) return true;
      const authorWords = normalizedAuthor.split(/[^a-z0-9]+/i).filter(Boolean);
      const surname = authorWords.at(-1);
      if (surname && surname.length >= 4 && messageWords.has(surname)) return true;
    }
  }
  return false;
}

function normalizePersonName(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function personNameFromQuestion(message = "") {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  const match = text.match(/\b(?:millest|mida)\s+(?:on\s+)?(.+?)\s+kirjutanud\b/iu) ||
    text.match(/^\s*kes\s+on\s+(.+?)[?.!]*\s*$/iu) ||
    text.match(/^\s*(.+?)\s+(?:artiklid|artikleid|autorlus)\b/iu);
  return String(match?.[1] || "").trim();
}

export function selectPersonSourceGroups(message = "", groups = [], k = CONTEXT_GROUPS_MAX, personName = null) {
  const candidates = Array.isArray(groups) ? groups.filter(Boolean) : [];
  const target = normalizePersonName(personName || personNameFromQuestion(message));
  const limit = Math.max(0, Math.min(Math.trunc(Number(k) || 0), candidates.length));
  if (!target || !limit) return candidates.slice(0, limit);
  const authored = [];
  const others = [];
  for (const group of candidates) {
    const exactAuthor = (Array.isArray(group?.authors) ? group.authors : [])
      .some(author => normalizePersonName(author) === target);
    (exactAuthor ? authored : others).push(group);
  }
  return [...authored, ...others].slice(0, limit);
}

export function selectGroupsWithPreferredSourceYear(
  groups = [],
  preferredYears = [],
  k = CONTEXT_GROUPS_MAX,
  lambda = DIVERSIFY_LAMBDA
) {
  const candidates = Array.isArray(groups) ? groups : [];
  const limit = Math.max(0, Math.min(Math.trunc(Number(k) || 0), candidates.length));
  const years = Array.from(new Set((Array.isArray(preferredYears) ? preferredYears : [])
    .map(year => Number(year))
    .filter(year => Number.isInteger(year) && year >= 1900 && year <= 2100)));
  if (!limit) return [];
  if (years.length !== 1) return diversifyGroupsMMR(candidates, limit, lambda);

  const preferredYear = years[0];
  const preferredGroups = candidates.filter(group => extractMatchGroupYear(group) === preferredYear);
  if (!preferredGroups.length) return diversifyGroupsMMR(candidates, limit, lambda);

  const fallbackGroups = candidates.filter(group => extractMatchGroupYear(group) !== preferredYear);
  const preferredChosen = diversifyGroupsMMR(
    preferredGroups,
    Math.min(limit, preferredGroups.length),
    lambda
  );
  return [
    ...preferredChosen,
    ...diversifyGroupsMMR(fallbackGroups, Math.max(0, limit - preferredChosen.length), lambda)
  ].slice(0, limit);
}

const NUMERIC_FACT_COUNT_WORDS = new Map([
  ["uks", 1], ["uhe", 1], ["one", 1], ["kaks", 2], ["two", 2],
  ["kolm", 3], ["three", 3], ["neli", 4], ["four", 4],
  ["viis", 5], ["five", 5], ["kuus", 6], ["six", 6]
]);

function requestedProportionCount(message = "") {
  const normalized = normalizeIntentText(message);
  if (!/(?:\bosakaal\w*\b|\bprotsent\w*\b|%|\bkui\s+suur\s+osa\b)/u.test(normalized)) return 0;
  const countMatch = normalized.match(
    /\b(\d{1,2}|uks|uhe|one|kaks|two|kolm|three|neli|four|viis|five|kuus|six)\s+(?:\S+\s+){0,2}?(?:osakaal\w*|protsent\w*|naitaja\w*)\b/u
  );
  if (!countMatch) return 1;
  const numeric = Number(countMatch[1]);
  if (Number.isInteger(numeric) && numeric > 0) return numeric;
  return NUMERIC_FACT_COUNT_WORDS.get(countMatch[1]) || 1;
}

function countUniquePercentageEvidence(group = {}) {
  const text = (Array.isArray(group?.bodies) ? group.bodies : [])
    .map(value => String(value || ""))
    .join("\n");
  const values = new Set();
  for (const match of text.matchAll(/\b(\d{1,3}(?:[.,]\d+)?)\s*(?:%|protsent\w*)/giu)) {
    values.add(String(match[1]).replace(",", "."));
  }
  return values.size;
}

export function selectSingleSourceNumericFactGroups(message = "", groups = []) {
  const candidates = Array.isArray(groups) ? groups.filter(Boolean) : [];
  const expectedCount = requestedProportionCount(message);
  if (!expectedCount || !candidates.length) {
    return {
      enabled: false,
      sufficient: false,
      expectedCount: 0,
      evidenceCount: 0,
      groups: candidates
    };
  }
  const primary = candidates[0];
  const evidenceCount = countUniquePercentageEvidence(primary);
  return {
    enabled: true,
    sufficient: evidenceCount >= expectedCount,
    expectedCount,
    evidenceCount,
    // A focused numerical answer may not borrow convenient numbers from a
    // second article merely because the primary article's exact chunk is absent.
    groups: [primary]
  };
}

function sourceAliasKeysForUrlMerge(source = {}) {
  const keys = [];
  const canonicalId = String(source?.canonical_item_id || source?.canonicalItemId || "").trim();
  if (canonicalId) keys.push(`canonical:${canonicalId}`);
  const title = normalizeDisplayAliasText(source?.title || source?.label || source?.short_ref);
  const muni = String(source?.municipality_id || source?.municipalityId || "").trim();
  const type = normalizeDisplayAliasText(source?.sourceType || source?.source_type || source?.resourceType || source?.resource_type);
  if (title && muni) keys.push(`title-muni:${muni}:${title}`);
  if (title && muni && type) keys.push(`title-muni-type:${muni}:${type}:${title}`);
  return keys;
}

function uniqueIds(values = []) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const id = String(value || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function cleanContextText(value = "", maxLength = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 3)).trim()}...` : text;
}

function municipalityContactScope(municipalities = []) {
  const ids = uniqueIds(
    (Array.isArray(municipalities) ? municipalities : [])
      .flatMap((item) => [item?.id, item?.municipalityId, item?.municipality_id])
  );
  const names = uniqueIds(
    (Array.isArray(municipalities) ? municipalities : [])
      .flatMap((item) => [
        item?.displayName,
        item?.municipalityName,
        item?.name,
        item?.baseName && item?.type
          ? `${item.baseName} ${String(item.type).toLowerCase()}`
          : ""
      ])
  );
  return { ids, names };
}

export function excludeSupersededKovContactMatches(matches = [], serviceMapContacts = []) {
  if (!Array.isArray(matches) || !Array.isArray(serviceMapContacts) || !serviceMapContacts.length) {
    return matches;
  }
  const { ids, names } = municipalityContactScope(serviceMapContacts);
  const municipalityIds = new Set(ids.map((value) => String(value).trim().toLowerCase()));
  const municipalityNames = new Set(names.map((value) => normalizeIntentText(value)));

  return matches.filter((entry) => {
    const itemType = String(entry?.itemType || entry?.item_type || "").trim().toLowerCase();
    if (itemType !== "contact" && itemType !== "official_contact") return true;
    const municipalityId = String(entry?.municipalityId || entry?.municipality_id || "").trim().toLowerCase();
    const municipalityName = normalizeIntentText(entry?.municipalityName || entry?.municipality_name || "");
    const superseded =
      (municipalityId && municipalityIds.has(municipalityId)) ||
      (municipalityName && municipalityNames.has(municipalityName));
    return !superseded;
  });
}

async function loadServiceMapKovContactsForMunicipalities(municipalities = []) {
  const { ids, names } = municipalityContactScope(municipalities);
  const or = [
    ...(ids.length ? [{ municipalityId: { in: ids } }] : []),
    ...names.map((name) => ({ municipalityName: { equals: name, mode: "insensitive" } }))
  ];
  if (!or.length) return [];

  return prisma.serviceMapEntry.findMany({
    where: {
      status: "PUBLISHED",
      type: {
        in: ["KOV_SOCIAL_CONTACT", "KOV_GENERAL_CONTACT"]
      },
      OR: or
    },
    orderBy: [
      { type: "asc" },
      { title: "asc" }
    ],
    take: 40,
    select: {
      id: true,
      type: true,
      title: true,
      description: true,
      municipalityId: true,
      municipalityName: true,
      county: true,
      address: true,
      phone: true,
      email: true,
      website: true,
      sourceUrl: true,
      checkedAt: true,
      updatedAt: true
    }
  });
}

const CONTACT_ROLE_UNKNOWN = "roll markimata";

function contactRoleLabel(entry = {}) {
  const description = String(entry?.description || "");
  const roleLine = description.match(/^\s*Roll:\s*(.+)$/mu);
  if (roleLine) return cleanContextText(roleLine[1], 80);
  const departmentLine = description.match(/^\s*Osakond:\s*(.+)$/mu);
  if (departmentLine) return cleanContextText(departmentLine[1], 80);
  return CONTACT_ROLE_UNKNOWN;
}

export function buildServiceMapKovContactContext(entries = []) {
  const decorated = (Array.isArray(entries) ? entries : [])
    .filter(Boolean)
    .map((entry) => ({
      entry,
      role: contactRoleLabel(entry) || CONTACT_ROLE_UNKNOWN,
      municipality: cleanContextText(entry.municipalityName || entry.county, 80)
    }));
  if (!decorated.length) return "";

  // Role index first: without it the model reads a flat name list and answers
  // with the one or two roles whose title happens to match the question wording.
  const roleIndex = new Map();
  for (const item of decorated) {
    if (!roleIndex.has(item.municipality)) roleIndex.set(item.municipality, new Map());
    const roles = roleIndex.get(item.municipality);
    roles.set(item.role, (roles.get(item.role) || 0) + 1);
  }
  const roleLines = [...roleIndex.entries()].map(([municipality, roles]) => {
    const summary = [...roles.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "et"))
      .map(([role, count]) => `${role} (${count})`)
      .join(" · ");
    return `- ${[municipality, summary].filter(Boolean).join(": ")}`;
  });

  const rows = decorated
    .slice()
    .sort((a, b) =>
      a.municipality.localeCompare(b.municipality, "et") ||
      a.role.localeCompare(b.role, "et") ||
      String(a.entry.title || "").localeCompare(String(b.entry.title || ""), "et"))
    .map(({ entry, role, municipality }) => {
      const parts = [
        municipality,
        `roll: ${role}`,
        cleanContextText(entry.title, 120),
        // Role already has its own field; keep only what it does not carry.
        cleanContextText(String(entry.description || "").replace(/^\s*Roll:.*$/mu, ""), 160),
        entry.phone ? `tel: ${cleanContextText(entry.phone, 80)}` : "",
        entry.email ? `email: ${cleanContextText(entry.email, 120)}` : "",
        entry.address ? `aadress: ${cleanContextText(entry.address, 140)}` : "",
        entry.website ? `veeb: ${cleanContextText(entry.website, 140)}` : ""
      ].filter(Boolean);
      return parts.length ? `- ${parts.join(" | ")}` : "";
    })
    .filter(Boolean);

  if (!rows.length) return "";

  return [
    "SERVICE_MAP_KOV_CONTACTS:",
    "KOV_CONTACT_ROLES (millised ametirollid selles KOV-is olemas on):",
    ...roleLines,
    "KOV_CONTACT_LIST:",
    ...rows
  ].join("\n");
}

const KOV_CONTACT_MODE_INSTRUCTIONS_EN = {
  overview: "For a general municipal services, department, or 'what can you help me with' turn, use KOV_CONTACT_ROLES to describe which specialists this municipality actually has and what topic each role covers. Do not name one or two people, phone numbers, or email addresses as default contacts. End by asking which topic the person needs help with, so the next answer can name the specialist for that topic.",
  contacts: "The user is asking for a contact or a specialist. If the topic is clear, name every contact whose role covers that topic (for a child topic, all child welfare specialists), not just the first one. If the topic is not clear, list the roles from KOV_CONTACT_ROLES and ask which topic; when the user explicitly asks for all contacts, list them all grouped by role.",
  service: "When answering about a specific municipal service or benefit, add the contact whose role matches that topic (benefit -> benefits specialist, child topic -> child welfare specialist, care -> care manager). Do not fall back to the general social welfare specialist when KOV_CONTACT_ROLES contains a closer role; if no closer role exists, say the municipality assigns the specialist by topic."
};

const KOV_CONTACT_MODE_INSTRUCTIONS_ET = {
  overview: "KOV teenuste, osakonna voi uldise 'millega saad aidata' kusimuse puhul kirjelda KOV_CONTACT_ROLES pohjal, millised spetsialistid selles vallas voi linnas tegelikult on ja mis teemaga iga roll tegeleb. Ara nimeta uht-kaht inimest, telefoninumbrit ega e-posti vaikimisi kontaktina. Lopeta kusimusega, mis teemaga inimest aidata saab, et jargmine vastus saaks nimetada just selle teema spetsialisti.",
  contacts: "Kasutaja kusib kontakti voi spetsialisti. Kui teema on teada, nimeta koik selle teema rolliga kontaktid (lapse teemal koik laste heaolu spetsialistid), mitte ainult esimest. Kui teema ei ole teada, loetle KOV_CONTACT_ROLES-i rollid ja kusi teemat; koigi kontaktide selge palve korral loetle koik kontaktid rollide kaupa.",
  service: "Konkreetse KOV teenuse voi toetuse vastuses lisa selle teemaga sobiva rolliga kontakt (toetus -> toetuste spetsialist, lapse teema -> laste heaolu spetsialist, hooldus -> hooldusjuht). Ara kasuta uldist sotsiaalhoolekandespetsialisti vaikevastusena, kui KOV_CONTACT_ROLES sisaldab teemale tapsemat rolli; kui tapsemat rolli ei ole, utle, et sobiva spetsialisti maarab KOV teema jargi."
};

export function buildServiceMapKovContactInstruction(replyLang = "et", options = {}) {
  const mode = KOV_CONTACT_MODE_INSTRUCTIONS_ET[options.mode] ? options.mode : "service";
  if (replyLang === "en") {
    return [
      "SERVICE_MAP_CONTACT_MODE:",
      "When the user's municipality is known and SERVICE_MAP_KOV_CONTACTS is present, use those entries as the authoritative municipal contact layer.",
      "Do not say municipal contacts are missing when that block contains phone or email data.",
      "KOV_CONTACT_ROLES lists the professional roles this municipality really has. Do not narrow the answer down to one or two generic job titles when more roles exist.",
      KOV_CONTACT_MODE_INSTRUCTIONS_EN[mode]
    ].join("\n");
  }
  return [
    "SERVICE_MAP_CONTACT_MODE:",
    "Kui kasutaja KOV on teada ja SERVICE_MAP_KOV_CONTACTS on olemas, kasuta neid kirjeid KOV kontaktide autoriteetse kontaktikihina.",
    "Ara utle, et KOV kontaktid puuduvad, kui selles plokis on telefon voi e-post.",
    "KOV_CONTACT_ROLES naitab, millised ametirollid selles KOV-is tegelikult olemas on. Ara ahenda vastust kahe uldnimetusega inimeseni, kui rolle on rohkem.",
    KOV_CONTACT_MODE_INSTRUCTIONS_ET[mode]
  ].join("\n");
}

function buildServiceMapKovContactSources(entries = []) {
  return (Array.isArray(entries) ? entries : []).map((entry) => ({
    id: `service-map-contact:${entry.id}`,
    source_id: `service-map-contact:${entry.id}`,
    sourceId: `service-map-contact:${entry.id}`,
    title: entry.title || entry.municipalityName || "KOV kontakt",
    url: entry.sourceUrl || entry.website || undefined,
    source_url: entry.sourceUrl || undefined,
    sourceUrl: entry.sourceUrl || undefined,
    collectionId: "service_map",
    collection_id: "service_map",
    sourceType: "service_map_contact",
    source_type: "service_map_contact",
    municipality_id: entry.municipalityId || undefined,
    municipality_name: entry.municipalityName || undefined,
    last_checked: entry.checkedAt || entry.updatedAt || undefined,
    short_ref: entry.title || entry.municipalityName || "KOV kontakt",
    evidenceText: [
      entry.description,
      entry.phone ? `tel: ${entry.phone}` : "",
      entry.email ? `email: ${entry.email}` : "",
      entry.address
    ].filter(Boolean).join("\n")
  }));
}

function displaySourceIdForContextEntry(entry = {}, idx = 0) {
  const sourceType = String(entry.sourceType || "").trim();
  if (/^(national_law|law|kov_regulation|regulation|riigiteataja_regulation)$/.test(sourceType)) {
    return String(entry.key || entry.chunkId || entry.canonicalItemId || entry.sourceId || `source-${idx}`).trim();
  }
  return String(entry.sourceId || entry.key || entry.docId || entry.articleId || entry.url || entry.fileName || `source-${idx}`).trim();
}

function packageDisplayedSourcesFromPackages(sourcePackages = [], allowedIds = []) {
  const allowed = new Set((Array.isArray(allowedIds) ? allowedIds : [])
    .map(value => String(value || "").trim())
    .filter(Boolean));
  if (!allowed.size) return [];

  const seen = new Set();
  const out = [];

  for (const pkg of Array.isArray(sourcePackages) ? sourcePackages : []) {
    const sections = pkg?.sections && typeof pkg.sections === "object" ? pkg.sections : {};
    for (const [section, list] of Object.entries(sections)) {
      if (!Array.isArray(list)) continue;
      for (const source of list) {
        const id = String(source?.source_id || "").trim();
        if (!id || !allowed.has(id) || seen.has(id)) continue;
        seen.add(id);
        const url = displayedSourceUrl(source);
        out.push({
          id,
          source_id: id,
          sourceId: id,
          title: source.title || pkg.title || pkg.canonical_item_id || id,
          url: url
            ? displayUrl(url)
            : undefined,
          url_canonical: source.url_canonical || undefined,
          urlCanonical: source.urlCanonical || undefined,
          source_url: source.source_url || undefined,
          sourceUrl: source.sourceUrl || undefined,
          official_url: source.official_url || undefined,
          officialUrl: source.officialUrl || undefined,
          collectionId: source.collection_id || undefined,
          collection_id: source.collection_id || undefined,
          sourceType: source.source_type || undefined,
          source_type: source.source_type || undefined,
          authority: source.authority || undefined,
          municipality_id: source.municipality_id || pkg.municipality_id || undefined,
          municipality_name: source.municipality_name || pkg.municipality_name || undefined,
          source_status: source.source_status || undefined,
          last_checked: source.last_checked || pkg.last_checked || undefined,
          historical: source.historical === true ? true : undefined,
          canonical_item_id: pkg.canonical_item_id || undefined,
          canonicalItemId: pkg.canonical_item_id || undefined,
          item_type: source.item_type || undefined,
          itemType: source.item_type || undefined,
          resource_type: source.resource_type || undefined,
          resourceType: source.resource_type || undefined,
          section,
          evidence_strength: source.evidence_strength || undefined,
          short_ref: source.title || pkg.title || undefined,
          evidenceText: source.title || pkg.title || ""
        });
      }
    }
  }

  return out;
}

export function mergePackageDisplayedSources(existingSources = [], packageSources = []) {
  const out = Array.isArray(existingSources) ? existingSources.slice() : [];
  const indexById = new Map();
  const indexByAlias = new Map();
  out.forEach((source, index) => {
    const id = stableSourceIdFromDisplaySource(source, index);
    if (id && !indexById.has(id)) indexById.set(id, index);
    for (const alias of sourceAliasKeysForUrlMerge(source)) {
      if (!indexByAlias.has(alias)) indexByAlias.set(alias, index);
    }
  });

  for (const packageSource of Array.isArray(packageSources) ? packageSources : []) {
    const id = stableSourceIdFromDisplaySource(packageSource);
    if (!id) continue;
    const existingIndex = indexById.get(id) ??
      sourceAliasKeysForUrlMerge(packageSource)
        .map(alias => indexByAlias.get(alias))
        .find(index => typeof index === "number");
    if (typeof existingIndex !== "number") {
      indexById.set(id, out.length);
      for (const alias of sourceAliasKeysForUrlMerge(packageSource)) {
        if (!indexByAlias.has(alias)) indexByAlias.set(alias, out.length);
      }
      out.push(packageSource);
      continue;
    }
    const existing = out[existingIndex] || {};
    const existingUrl = displayedSourceUrl(existing);
    const packageUrl = displayedSourceUrl(packageSource);
    if (!existingUrl && packageUrl) {
      out[existingIndex] = {
        ...packageSource,
        ...existing,
        url: displayUrl(packageUrl),
        url_canonical: existing.url_canonical || packageSource.url_canonical || undefined,
        urlCanonical: existing.urlCanonical || packageSource.urlCanonical || undefined,
        source_url: existing.source_url || packageSource.source_url || undefined,
        sourceUrl: existing.sourceUrl || packageSource.sourceUrl || undefined,
        official_url: existing.official_url || packageSource.official_url || undefined,
        officialUrl: existing.officialUrl || packageSource.officialUrl || undefined
      };
    }
  }

  return out;
}

export function buildRagSearchErrorPayload({
  err,
  userId,
  role,
  isCrisis,
  stage = "rag_search",
  optional = false,
  queryPlan,
  selectionStrategy,
  topK,
  conversationId
} = {}) {
  const rawMessage = String(err?.message || "rag search error").trim();
  return {
    userId,
    role,
    isCrisis,
    stage,
    optional,
    error_message: rawMessage.slice(0, 240),
    queryPlanMode: queryPlan?.mode,
    queryPlanSelectionStrategy: selectionStrategy || queryPlan?.selection_strategy,
    queryPlanQueryOrder: queryPlan?.query_order,
    query_plan: queryPlan
      ? {
          mode: queryPlan.mode,
          query_order: queryPlan.query_order,
          selection_strategy: queryPlan.selection_strategy,
          query_count: queryPlan.query_count,
          rag_top_k: queryPlan.rag_top_k
        }
      : undefined,
    top_k: topK,
    conversation_id: conversationId
  };
}

async function logRagSearchError({
  err,
  event = "rag_error",
  logError,
  logEvent,
  userId,
  role,
  isCrisis,
  stage,
  optional,
  queryPlan,
  selectionStrategy,
  topK,
  conversationId
} = {}) {
  const payload = buildRagSearchErrorPayload({
    err,
    userId,
    role,
    isCrisis,
    stage,
    optional,
    queryPlan,
    selectionStrategy,
    topK,
    conversationId
  });
  if (typeof logError === "function") {
    logError(optional ? "rag.search.optional_error" : "rag.search.error", {
      err: payload.error_message,
      stage,
      optional,
      role,
      userId,
      conversationId,
      queryPlanMode: queryPlan?.mode,
      queryPlanSelectionStrategy: selectionStrategy || queryPlan?.selection_strategy
    });
  }
  if (typeof logEvent === "function") {
    await logEvent(event, payload);
  }
}

function hasServiceTerm(normalized = "") {
  return /\b[a-z0-9]*teenus[a-z0-9]*\b/u.test(normalized);
}

function hasBenefitTerm(normalized = "") {
  return /\b[a-z0-9]*toetus[a-z0-9]*\b/u.test(normalized);
}

function hasTargetGroupTerm(normalized = "") {
  return /\b(laps|lapse|lapsel|lapsele|lapsega|lapsed|laste|lastel|lastega|alaealine|alaealisele|pere|perel|perele|perega|vanem|vanemal|vanemale|eakas|eakal|eakale|eakaga|vanur|vanurile|puue|puudega|erivajadus|erivajadusega|hooldusvajadus|hooldusvajadusega|kriis|kriisis)\b/.test(normalized);
}

function isServiceJurisdictionClassificationQuestion(message = "") {
  const normalized = normalizeIntentText(message);
  if (!normalized || !hasServiceTerm(normalized)) return false;
  const mentionsJurisdiction = /\b(kov|kohalik|kohaliku|omavalitsus|omavalitsuse|riik|riigi|riiklik|riiklikud|riikliku)\b/.test(normalized);
  const asksClassification = /\b(kas|on|voi|või|kumma|kumb|kuulub|korraldab|vastutab|vastutus)\b/.test(normalized);
  return mentionsJurisdiction && asksClassification;
}

export function isNationalServiceBenefitQuestion(message = "") {
  const normalized = normalizeIntentText(message);
  if (!normalized) return false;
  const mentionsNationalLevel = /\b(riik|riigi|riiklik|riiklikud|riiklikke|shs|sotsiaalhoolekande seadus)\b/.test(normalized);
  const asksServiceOrBenefit = hasServiceTerm(normalized) || hasBenefitTerm(normalized);
  const asksListOrDefinition = /\b(mis|mida|millised|milliseid|loetle|nimeta|pakub|on|maara|maarab|reguleeri|reguleerib|sisalda|sisaldab|nimetab|saab|kohustus|kohustuse|kohustab|ulesanne|ulesanded|ülesanne|ülesanded|korralda|korraldab|korraldada|korraldamise|vastutab|vastutus)\b/.test(normalized);
  if (mentionsNationalLevel && asksServiceOrBenefit && asksListOrDefinition) return true;

  // Fee/condition questions about a concrete service or benefit are national
  // SHS-layer questions by default when no municipality is named. Municipality
  // routes are computed independently and keep priority in query-plan mode
  // selection, so a KOV-named fee question still takes the KOV route.
  const mentionsMunicipality = /\b(vald|valla|vallas|linn|linna|linnas|omavalitsus|omavalitsuse|kov)\b/.test(normalized);
  const asksFeeOrCondition = /\b(omaosalus|omaosaluse|omaosalust|tasu|tasud|tasuline|tasuta|hind|hinna|hinnad|maksab|maksumus|maksma)\b/.test(normalized);
  return !mentionsMunicipality && asksServiceOrBenefit && asksFeeOrCondition;
}

function isNationalServiceBenefitFollowup(message = "", history = []) {
  const normalized = normalizeIntentText(message).replace(/[.!?\s]+$/g, "");
  if (!/^(jah|jaa|jep|ok|okei|palun|sobib|1|2|3)$/.test(normalized)) return false;
  const recent = extractRecentUserText(history, 4).join("\n");
  return isNationalServiceBenefitQuestion(recent);
}

function shouldCarryMunicipalityFromHistory(message = "") {
  const normalized = normalizeIntentText(message);
  if (!normalized) return false;
  if (/^(jah|jaa|jep|ok|okei|palun|sobib|1|2|3)$/.test(normalized.replace(/[.!?\s]+$/g, ""))) return true;
  if (hasServiceTerm(normalized) || hasBenefitTerm(normalized)) return true;
  if (hasTargetGroupTerm(normalized)) return true;
  const socialHelpFollowup =
    /\b(loetle|nimeta|too valja|too välja|millised|mis|teenus|teenused|teenuseid|toetus|toetused|toetusi|abi|sotsiaalabi|sotsiaalteenus|sotsiaalteenused|sotsiaalteenuseid|sotsiaaltoetus|sotsiaaltoetused|sotsiaaltoetusi)\b/.test(normalized);
  if (socialHelpFollowup) return true;
  if (normalized.length <= 40) {
    return /\b(see|seda|selle|seal|siin|sealt|sinna|samas|too|need|nende)\b/.test(normalized);
  }
  return /\b(see|seda|selle|seal|siin|sealt|sinna|samas|too|need|nende|kontakt|kontaktid|telefon|e-post|email|taotlus|taotlema)\b/.test(normalized);
}

export function isMunicipalityServiceBenefitListRequest(message = "") {
  const normalized = normalizeIntentText(message);
  if (!normalized) return false;
  const asksList = /\b(kas|on|olemas|leia|otsi|tuvasta|loetle|nimeta|too valja|too välja|millised|mis|koik|kõik|nimekiri|ulevaade|ülevaade)\b/.test(normalized);
  const barePluralList = /\b(sotsiaalteenused|sotsiaalteenuseid|teenused|teenuseid|sotsiaaltoetused|sotsiaaltoetusi|toetused|toetusi|abi liigid)\b/.test(normalized);
  const asksServicesOrBenefits =
    hasServiceTerm(normalized) ||
    hasBenefitTerm(normalized) ||
    /\b(sotsiaalabi|abi liigid)\b/.test(normalized);
  return (asksList || barePluralList) && asksServicesOrBenefits;
}

function detectServiceBenefitIntent(message = "") {
  const normalized = normalizeIntentText(message);
  const wantsServices = hasServiceTerm(normalized);
  const wantsBenefits = hasBenefitTerm(normalized);
  const wantsGeneralSocialHelp = /\b(sotsiaalabi|abi liigid)\b/.test(normalized);
  return {
    wantsServices: wantsServices || wantsGeneralSocialHelp,
    wantsBenefits: wantsBenefits || wantsGeneralSocialHelp
  };
}

function detectServiceBenefitTurnIntent(message = "", history = []) {
  const current = detectServiceBenefitIntent(message);
  if (current.wantsServices || current.wantsBenefits) return current;
  if (isAffirmativeServiceBenefitFollowup(message, history) || isContextualServiceBenefitListFollowup(message, history)) {
    const previous = detectServiceBenefitIntent(extractRecentUserText(history, 4).join("\n"));
    if (previous.wantsServices || previous.wantsBenefits) return previous;
  }
  return {
    wantsServices: true,
    wantsBenefits: true
  };
}

function isAffirmativeServiceBenefitFollowup(message = "", history = []) {
  const normalized = normalizeIntentText(message).replace(/[.!?\s]+$/g, "");
  if (!/^(jah|jaa|jep|ok|okei|palun|sobib)$/.test(normalized)) return false;
  return isMunicipalityServiceBenefitListRequest(extractRecentUserText(history, 4).join("\n"));
}

function isContextualServiceBenefitListFollowup(message = "", history = []) {
  const normalized = normalizeIntentText(message).replace(/[.!?\s]+$/g, "");
  if (!normalized || normalized.length > 120) return false;
  return isMunicipalityServiceBenefitListRequest(extractRecentUserText(history, 4).join("\n"));
}

function hasContactRequestTerm(normalized = "") {
  if (/\b(kontakt\w*|kontaktandmed|telefoninumb\w*|telefon\w*|e-post\w*|epost\w*|email\w*|meiliaadress\w*|spetsialist\w*|ametnik\w*|sotsiaaltootaja\w*|lastekaitsetootaja\w*|juhtumikorraldaja\w*)\b/u.test(normalized)) {
    return true;
  }
  return /\b(kelle poole|kelle juurde|kelle kaest|kellega uhendust|kellega raakida|kes tegeleb|kes aitab|kes vastutab|kes minuga)\b/u.test(normalized);
}

// Which contact layer the turn needs. Without an explicit topic the answer must
// stay on the role level and ask, instead of defaulting to whichever one or two
// people carry the most generic job title.
export function resolveKovContactMode({ message = "", listRequest = false, serviceSpecific = false } = {}) {
  const normalized = normalizeIntentText(message);
  if (hasContactRequestTerm(normalized)) return "contacts";
  if (listRequest) return "overview";
  if (serviceSpecific) return "service";
  const hasTopic = hasServiceTerm(normalized) || hasBenefitTerm(normalized) || hasTargetGroupTerm(normalized);
  return hasTopic ? "service" : "overview";
}

function isMunicipalityServiceBenefitTurn(message = "", history = []) {
  return isMunicipalityServiceBenefitListRequest(message) ||
    isAffirmativeServiceBenefitFollowup(message, history);
}

function isConcreteKovItemGroup(group, itemType) {
  return String(group?.collectionId || "") === "kov_services" &&
    String(group?.itemType || "") === itemType;
}

function isKovRegulationGroup(group) {
  const collectionId = String(group?.collectionId || "").trim();
  return collectionId === "kov_regulations" || collectionId === "kov_legal";
}

function sortByGroupRank(groups = []) {
  return [...groups].sort((a, b) => {
    const aScore = typeof a?.rankScore === "number" ? a.rankScore : (a?.bestScore || 0);
    const bScore = typeof b?.rankScore === "number" ? b.rankScore : (b?.bestScore || 0);
    return bScore - aScore;
  });
}

function roundTraceNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(6)) : undefined;
}

function summarizeHybridRetrieval(matches = []) {
  const channelCounts = {};
  let scoredCount = 0;
  let topHybridScore = null;
  let topRrfScore = null;
  let mergeStrategy = null;
  let channelStats = null;
  for (const match of Array.isArray(matches) ? matches : []) {
    const channels = Array.isArray(match?.retrieval_channels)
      ? match.retrieval_channels
      : Array.isArray(match?.retrievalChannels)
        ? match.retrievalChannels
        : [];
    for (const channel of channels) {
      const key = String(channel || "").trim();
      if (!key) continue;
      channelCounts[key] = (channelCounts[key] || 0) + 1;
    }
    const hybridScore = roundTraceNumber(match?.hybrid_score ?? match?.hybridScore);
    const rrfScore = roundTraceNumber(match?.rrf_score);
    if (typeof hybridScore === "number") {
      scoredCount += 1;
      topHybridScore = typeof topHybridScore === "number" ? Math.max(topHybridScore, hybridScore) : hybridScore;
    }
    if (typeof rrfScore === "number") {
      topRrfScore = typeof topRrfScore === "number" ? Math.max(topRrfScore, rrfScore) : rrfScore;
    }
    if (!mergeStrategy && match?.retrieval_merge_strategy && typeof match.retrieval_merge_strategy === "object") {
      mergeStrategy = match.retrieval_merge_strategy;
    }
    if (!channelStats && match?.retrieval_channel_stats && typeof match.retrieval_channel_stats === "object") {
      channelStats = match.retrieval_channel_stats;
    }
  }
  if (!Object.keys(channelCounts).length && !mergeStrategy && !channelStats && scoredCount === 0) return null;
  return {
    merge_strategy: mergeStrategy
      ? {
          strategy: mergeStrategy.strategy,
          rrf_k: mergeStrategy.rrf_k,
          requested_retrievers: Array.isArray(mergeStrategy.requested_retrievers) ? mergeStrategy.requested_retrievers : undefined,
          channel_weights: mergeStrategy.channel_weights,
          channel_boosts: mergeStrategy.channel_boosts,
          bm25_config: mergeStrategy.bm25_config,
          score_formula: mergeStrategy.score_formula
        }
      : undefined,
    channel_counts: Object.keys(channelCounts).length ? channelCounts : channelStats?.channel_counts,
    top_channels: Array.isArray(channelStats?.top_channels) ? channelStats.top_channels : undefined,
    dense_only_count: typeof channelStats?.dense_only_count === "number" ? channelStats.dense_only_count : undefined,
    lexical_only_count: typeof channelStats?.lexical_only_count === "number" ? channelStats.lexical_only_count : undefined,
    dense_and_lexical_count: typeof channelStats?.dense_and_lexical_count === "number" ? channelStats.dense_and_lexical_count : undefined,
    bm25: channelStats?.bm25 && typeof channelStats.bm25 === "object" ? channelStats.bm25 : undefined,
    scored_count: scoredCount,
    top_hybrid_score: topHybridScore ?? undefined,
    top_rrf_score: topRrfScore ?? undefined
  };
}

function buildMunicipalityRegulationPackageQueries(municipalities = []) {
  const out = [];
  const seen = new Set();
  for (const municipality of Array.isArray(municipalities) ? municipalities : []) {
    const municipalityId = String(municipality?.id || municipality?.municipalityId || municipality?.municipality_id || "").trim();
    if (!municipalityId || seen.has(municipalityId)) continue;
    seen.add(municipalityId);
    const name = String(municipality?.displayName || municipality?.name || municipality?.municipalityName || municipalityId).trim();
    out.push({
      query: [
        name,
        "sotsiaalhoolekandelise abi andmise kord",
        "sotsiaalabi määrus"
      ].filter(Boolean).join(" "),
      filters: {
        source_type: "kov_regulation",
        collection_id: {
          $in: ["kov_legal", "kov_regulations"]
        },
        municipality_id: municipalityId
      }
    });
  }
  return out;
}

function selectMunicipalityServiceBenefitGroups(groups = [], k = CONTEXT_GROUPS_MAX, intent = {}) {
  const selected = [];
  const seen = new Set();
  const add = (items) => {
    for (const item of items) {
      const key = item?.key || item?.docId || item?.articleId || item?.title;
      if (!key || seen.has(key) || selected.length >= k) continue;
      seen.add(key);
      selected.push(item);
    }
  };
  const benefits = sortByGroupRank(groups.filter(group => isConcreteKovItemGroup(group, "benefit")));
  const services = sortByGroupRank(groups.filter(group => isConcreteKovItemGroup(group, "service")));
  const regulations = sortByGroupRank(groups.filter(isKovRegulationGroup));
  const rest = sortByGroupRank(groups.filter(group =>
    !isConcreteKovItemGroup(group, "benefit") &&
    !isConcreteKovItemGroup(group, "service") &&
    !isKovRegulationGroup(group)
  ));
  const wantsServices = intent?.wantsServices !== false;
  const wantsBenefits = intent?.wantsBenefits !== false;

  if (wantsBenefits && !wantsServices) {
    add(benefits);
    add(regulations);
    add(rest);
    return selected;
  }

  if (wantsServices && !wantsBenefits) {
    add(services);
    add(regulations);
    add(rest);
    return selected;
  }

  if (benefits.length && services.length) {
    const benefitTarget = Math.min(benefits.length, Math.ceil(k / 2));
    add(benefits.slice(0, benefitTarget));
    add(services.slice(0, Math.max(1, k - selected.length - Math.min(1, regulations.length))));
    add(benefits.slice(benefitTarget));
    add(services);
  } else {
    add(benefits);
    add(services);
  }
  add(regulations);
  add(rest);
  return selected;
}

export function buildLegalExactSelection(groups = [], legalLookupPlan = null, options = {}) {
  if (!legalLookupPlan?.enabled) {
    return {
      groupedMatches: Array.isArray(groups) ? groups : [],
      selectionGroups: Array.isArray(groups) ? groups : [],
      missingParagraphRefs: [],
      insufficientPreciseLegalSourceSupport: false
    };
  }

  const filteredGroups = filterGroupsForLegalPlan(groups, legalLookupPlan);
  if (legalLookupPlan.mode !== "explicit_paragraph") {
    const rankedGroups = legalLookupPlan.mode === "topic_to_paragraphs"
      ? rankGroupsWithTopicHints(filteredGroups, legalLookupPlan.topicTerms || [], options)
      : filteredGroups;
    return {
      groupedMatches: rankedGroups,
      selectionGroups: rankedGroups,
      missingParagraphRefs: [],
      insufficientPreciseLegalSourceSupport: false
    };
  }

  const wantedParagraphRefs = Array.isArray(legalLookupPlan.paragraphRefs)
    ? legalLookupPlan.paragraphRefs.map(value => String(value || "").trim()).filter(Boolean)
    : [];
  const foundParagraphRefs = new Set(
    filteredGroups
      .map(group => String(group?.paragraphNumber || "").trim())
      .filter(Boolean)
  );
  const missingParagraphRefs = wantedParagraphRefs.filter(ref => !foundParagraphRefs.has(ref));
  const rankedGroups = sortByGroupRank(filteredGroups);

  return {
    groupedMatches: rankedGroups,
    selectionGroups: rankedGroups,
    missingParagraphRefs,
    insufficientPreciseLegalSourceSupport: missingParagraphRefs.length > 0 || rankedGroups.length === 0
  };
}

function buildLegalExactMissingInstruction(replyLang = "et", legalLookupPlan = null, missingParagraphRefs = []) {
  const refs = (Array.isArray(missingParagraphRefs) ? missingParagraphRefs : [])
    .map(ref => `§ ${String(ref || "").trim()}`)
    .filter(Boolean)
    .join(", ");
  const actTitle = String(legalLookupPlan?.actTitle || "the requested act").trim();

  if (replyLang === "en") {
    return refs
      ? `LEGAL_EXACT_LOOKUP_RESULT: The current retrieval did not find an exact current legal source for ${actTitle} ${refs}. State that the current search did not provide sufficiently precise legal confirmation and do not substitute a similar paragraph.`
      : `LEGAL_EXACT_LOOKUP_RESULT: The current retrieval did not find an exact current legal source for the requested paragraph. State that the current search did not provide sufficiently precise legal confirmation and do not substitute a similar paragraph.`;
  }

  if (replyLang === "ru") {
    return refs
      ? `LEGAL_EXACT_LOOKUP_RESULT: Текущий поиск не нашёл точный действующий правовой источник для ${actTitle} ${refs}. Скажи, что текущий поиск не дал достаточно точного правового подтверждения, и не подменяй его похожим параграфом.`
      : "LEGAL_EXACT_LOOKUP_RESULT: Текущий поиск не нашёл точный действующий правовой источник для запрошенного параграфа. Скажи, что текущий поиск не дал достаточно точного правового подтверждения, и не подменяй его похожим параграфом.";
  }

  return refs
    ? `LEGAL_EXACT_LOOKUP_RESULT: Praegune otsing ei leidnud ${actTitle} ${refs} kohta täpset kehtivat õigusallikat. Ütle, et praeguse otsinguga ei leitud piisavalt täpset õiguslikku allikakinnitust, ja ära asenda seda sarnase paragrahviga.`
    : "LEGAL_EXACT_LOOKUP_RESULT: Praegune otsing ei leidnud küsitud paragrahvi kohta täpset kehtivat õigusallikat. Ütle, et praeguse otsinguga ei leitud piisavalt täpset õiguslikku allikakinnitust, ja ära asenda seda sarnase paragrahviga.";
}

function isNationalLawSourceLookup(subject = "", combinedText = "") {
  const normalizedSubject = normalizeIntentText(subject);
  const normalizedCombined = normalizeIntentText(combinedText);
  if (/\bsotsiaalhoolekande sead/.test(normalizedSubject) || /\bshs\b/.test(normalizedCombined)) {
    return true;
  }
  return /\b(riigi teataja|riigiteataja)\b/.test(normalizedSubject) &&
    /\b(seadus|paragrahv|paragraph|shs|sotsiaalhoolekande)\b/.test(normalizedCombined);
}

export function buildRagContextBudgetOptions({
  temporalRetrievalPlan,
  municipalityServiceBenefitListRequest,
  broadMultiSourceQuestion,
  sourceLookupRequest,
  sourceLookupTargetsNationalLaw,
  sourceLookupParagraphRefs,
  contextGroupTarget
} = {}) {
  const maxGroups = Number.isFinite(Number(contextGroupTarget))
    ? Math.max(1, Math.trunc(Number(contextGroupTarget)))
    : CONTEXT_GROUPS_MAX;
  const paragraphRefs = Array.isArray(sourceLookupParagraphRefs) ? sourceLookupParagraphRefs : [];

  if (temporalRetrievalPlan?.enabled) {
    return {
      preferredYears: temporalRetrievalPlan.years,
      maxGroups
    };
  }
  if (municipalityServiceBenefitListRequest) {
    return {
      compact: true,
      maxGroups
    };
  }
  if (broadMultiSourceQuestion) {
    return {
      compact: true,
      maxGroups
    };
  }
  if (sourceLookupRequest && sourceLookupTargetsNationalLaw && paragraphRefs.length === 0) {
    return {
      compact: true,
      maxGroups
    };
  }
  return {
    maxGroups
  };
}

function buildLayeredContextInstruction(replyLang = "et") {
  if (replyLang === "en") {
    return [
      "LAYERED_CONTEXT_MODE:",
      "When sources support several levels, structure the answer from general/national background to municipal support or service and then to direct service provider or partner.",
      "Do not force every level into the answer.",
      "Mention municipal or provider-level details only when RAG_CONTEXT contains evidence for that level.",
      "If the municipality is missing for a municipality-dependent question, give only general background and ask for the municipality."
    ].join("\n");
  }

  if (replyLang === "ru") {
    return [
      "LAYERED_CONTEXT_MODE:",
      "Если источники покрывают несколько уровней, строй ответ от общего/государственного фона к поддержке или услуге местного самоуправления, затем к прямому поставщику услуги или партнёру.",
      "Не добавляй все уровни принудительно.",
      "Упоминай муниципальные детали или поставщика услуги только тогда, когда RAG_CONTEXT содержит подтверждение этого уровня.",
      "Если для вопроса нужен муниципалитет, но он неизвестен, дай только общий фон и спроси муниципалитет."
    ].join("\n");
  }

  return [
    "LAYERED_CONTEXT_MODE:",
    "Kui allikad toetavad mitut tasandit, struktureeri vastus üldisest või riiklikust taustast KOV toe või teenuseni ning sealt otsese teenuseosutaja või partnerini.",
    "Ära suru kõiki tasandeid vastusesse vägisi.",
    "Nimeta KOV- või teenusepartneri tasandi detaile ainult siis, kui RAG_CONTEXT sisaldab selle tasandi tõendust.",
    "Kui küsimus sõltub omavalitsusest, aga omavalitsus pole teada, anna ainult üldine taust ja küsi omavalitsust."
  ].join("\n");
}

function buildThematicSynthesisInstruction(replyLang = "et") {
  if (replyLang === "en") {
    return [
      "THEMATIC_SYNTHESIS_MODE:",
      "The user is asking for a thematic synthesis, not one narrow lookup.",
      "State the thematic conclusion directly, then group the answer into the supported main issues or themes.",
      "Combine journal articles, studies, reports, statistics, official guides, methodology materials and practice examples when the selected content supports them.",
      "Do not collapse the answer into one source type if several relevant source types are present.",
      "Make the answer reflect the sources that were actually selected, even when they use different wording for the same topic.",
      "Never mention RAG_CONTEXT, retrieval, search status or source-base width in the answer. If a requested detail is missing, state only that concrete missing detail."
    ].join("\n");
  }
  return [
    "THEMATIC_SYNTHESIS_MODE:",
    "Kasutaja küsib teemalist kokkuvõtet, mitte ühte kitsast allikat.",
    "Esita teemaline järeldus otse ja rühmita vastus seejärel toetatud põhiprobleemide või teemade kaupa.",
    "Ära raamista sünteesi väljenditega \"allikates tõuseb esile\", \"allikad näitavad\", \"allikates kordub\", \"valitud materjalide põhjal\" ega muu allikate vahendamist kirjeldava lausega. Ütle sama sisuline järeldus otse, näiteks \"Peamised võimalused ja riskid on…\".",
    "Esimesed kaks sisulist lauset esita ilma sõnadeta \"allikas\", \"allikad\", \"materjal\", \"otsing\", \"kontekst\", \"RAG\" ja \"artikkel\" ning ilma nende käändevormideta.",
    "Kombineeri ajakirjaartikleid, uuringuid, raporteid, statistikat, ametlikke juhendeid, metoodikamaterjale ja praktikakirjeldusi, kui valitud sisu neid toetab.",
    "Ära taanda vastust ainult ühele allikatüübile, kui kontekstis on mitu asjakohast allikatüüpi.",
    "Lase vastusel peegeldada päriselt valitud allikaid ka siis, kui need kasutavad sama teema kohta erinevat sõnastust.",
    "Ära nimeta vastuses RAG-konteksti, otsingu seisu ega allikabaasi laiust. Kui mõni küsitud detail puudub, nimeta ainult see konkreetne puuduv detail."
  ].join("\n");
}

function buildEvidencePreservationInstruction(replyLang = "et") {
  if (replyLang === "en") {
    return [
      "EVIDENCE_PRESERVATION:",
      "Before saying that the materials do not contain a concrete example, check every directly relevant named example in RAG_CONTEXT.",
      "If the context names and describes a system, practice, person or organization relevant to the question, include it and do not claim that the example is absent.",
      "Attribute the example briefly to its time. Unless the user explicitly asks about current operational status, the date or source-time wording is enough; do not add a separate paragraph about missing current confirmation.",
      "A relevant journal article or study can support a source-reported example; do not demand an official source unless the user asks for current official status or the risk policy requires it."
    ].join("\n");
  }
  if (replyLang === "ru") {
    return [
      "EVIDENCE_PRESERVATION:",
      "Прежде чем утверждать, что в материалах нет конкретного примера, проверь все прямо относящиеся к вопросу именованные примеры в RAG_CONTEXT.",
      "Если контекст называет и описывает систему, практику, человека или организацию, относящиеся к вопросу, включи этот пример и не утверждай, что его нет.",
      "Кратко укажи время примера. Если пользователь прямо не спрашивает о текущем рабочем статусе, даты или временной формулировки достаточно; не добавляй отдельный абзац об отсутствии текущего подтверждения.",
      "Подходящая журнальная статья или исследование могут подтверждать пример как сообщение источника; не требуй официальный источник, если пользователь не спрашивает именно о текущем официальном статусе или этого не требует политика риска."
    ].join("\n");
  }
  return [
    "EVIDENCE_PRESERVATION:",
    "Enne kui ütled, et materjalides konkreetset näidet ei ole, kontrolli kõiki RAG_CONTEXT-is olevaid küsimusega otseselt seotud nimelisi näiteid.",
    "Kui kontekst nimetab ja kirjeldab küsimusega seotud süsteemi, praktikat, inimest või organisatsiooni, lisa see vastusesse. Ära väida, et materjalides konkreetset näidet ei ole.",
    "Seo näide lühidalt selle ajaga. Kui kasutaja ei küsi sõnaselgelt tänast kasutusolekut, piisab aastast või ajavormist; ära lisa eraldi lõiku tänase kinnituse puudumise või uue allika vajaduse kohta.",
    "Asjakohane ajakirjaartikkel või uuring võib kinnitada allikapõhist näidet; ära nõua ametlikku allikat, kui kasutaja ei küsi just praegust ametlikku staatust või riskireegel seda ei nõua."
  ].join("\n");
}

function buildOverviewSynthesisInstruction(replyLang = "et") {
  if (replyLang === "en") {
    return [
      "OVERVIEW_SYNTHESIS_MODE:",
      "The user is asking for a broad overview. Build a synthesis across the selected sources, not a summary of one article or document.",
      "Use recurring themes, patterns and differences in emphasis across sources.",
      "Do not generalize one document's claim to the whole field unless other selected sources support it.",
      "Use stronger documents in more depth only when their chunks add new details or perspectives.",
      "Do not add meta-commentary about the width of the selected source base. If a requested fact is unsupported, name only that specific missing fact briefly.",
      "The answer may be more substantive than a short two-paragraph reply, but keep it readable."
    ].join("\n");
  }
  return [
    "OVERVIEW_SYNTHESIS_MODE:",
    "Kasutaja küsib laia ülevaadet. Koosta valitud allikate ülene süntees, mitte ühe artikli või dokumendi kokkuvõte.",
    "Too välja korduvad teemad, mustrid ja eri allikate rõhuasetused.",
    "Ära üldista ühe dokumendi väidet kogu valdkonnale, kui teised valitud allikad seda ei toeta.",
    "Kasuta tugevamaid dokumente sügavamalt ainult siis, kui nende lõigud lisavad uusi detaile või vaatenurki.",
    "Ära lisa vastusesse meta-kommentaari valitud allikabaasi laiuse kohta. Kui mõni küsitud fakt jäi kinnitamata, nimeta lühidalt ainult see konkreetne puuduv fakt.",
    "Vastus võib olla sisukam kui lühike kahe lõigu vastus, aga hoia see loetav."
  ].join("\n");
}

function buildResourceDiscoveryInstruction(replyLang = "et") {
  if (replyLang === "en") {
    return [
      "RESOURCE_DISCOVERY_MODE:",
      "The user is looking for organizations, materials, contacts, networks, or practical help resources.",
      "Prefer organization, material, guideline, contact, and resource sources from RAG_CONTEXT. If direct organization/material sources are sparse, use relevant journal articles, studies, and guidance materials as supporting material sources.",
      "Use legal sources as background only; do not make national law the sole displayed basis when organization or material sources are available.",
      "Do not discuss source-base width. If a requested resource type is missing, name only that specific gap briefly."
    ].join("\n");
  }
  if (replyLang === "ru") {
    return [
      "RESOURCE_DISCOVERY_MODE:",
      "Пользователь ищет организации, материалы, контакты, сети поддержки или практические источники помощи.",
      "Отдавай предпочтение источникам об организациях, материалах, руководствах, контактах и ресурсах из RAG_CONTEXT. Если прямых источников об организациях или материалах мало, используй релевантные журнальные статьи, исследования и руководства как поддерживающие материалы.",
      "Правовые источники используй как фон; не делай закон единственной основой ответа, если есть источники об организациях или материалах.",
      "Если база найденных источников узкая, скажи об этом естественно."
    ].join("\n");
  }
  return [
    "RESOURCE_DISCOVERY_MODE:",
    "Kasutaja otsib organisatsioone, materjale, kontakte, võrgustikke või praktilisi abiallikaid.",
    "Eelista RAG_CONTEXTis organisatsiooni-, materjali-, juhendi-, kontakti- ja ressursiallikaid. Kui otseseid organisatsiooni- või materjaliallikaid on vähe, kasuta toetavate materjalidena ka asjakohaseid ajakirjaartikleid, uuringuid ja juhendeid.",
    "Õigusallikaid kasuta taustaks; ära tee seadusest ainsat kuvatavat põhiallikat, kui organisatsiooni- või materjaliallikaid on olemas.",
    "Ära arutle allikabaasi laiuse üle. Kui mõni küsitud ressursiliik puudub, nimeta lühidalt ainult see konkreetne puudujääk."
  ].join("\n");
}

function buildPersonSourceLookupInstruction(replyLang = "et") {
  if (replyLang === "en") {
    return [
      "PERSON_SOURCE_LOOKUP_MODE:",
      "Distinguish works whose author metadata exactly names the person from works that merely mention or interview them.",
      "For a who-is question, combine only explicit dated role facts with the person's directly authored works; do not reduce the person to one old role when newer attributed evidence is available.",
      "For a what-has-the-author-written question, list themes only from directly authored works and keep the work titles and years attributable."
    ].join("\n");
  }
  return [
    "PERSON_SOURCE_LOOKUP_MODE:",
    "Erista teosed, mille autorimetaandmetes on küsitud isik, tekstidest, mis teda ainult mainivad või intervjueerivad.",
    "Küsimusele „kes on” vasta ainult allikates selgelt kinnitatud ja ajaliselt märgitud rollide ning isiku enda kirjutatud tööde põhjal; ära taanda inimest ühele vanale rollile, kui leidub uuemat atribueeritud tõendit.",
    "Küsimusele „millest autor on kirjutanud” nimeta teemad ainult isiku enda autorsusega töödest ning säilita pealkirjade ja aastate kontrollitav seos."
  ].join("\n");
}

function isReportedPracticeQuestion(message = "") {
  const normalized = normalizeIntentText(message);
  if (!normalized) return false;
  const asksUseOrPractice = /\b(kasuta|kasutatakse|kasutab|kasutavad|kasutus|rakenda|rakendatakse|toimib|praktika|praktikas|naide|näide)\b/.test(normalized);
  const asksAsQuestion = /\b(kas|kuidas|kus|millisel kujul|mismoodi)\b/.test(normalized) || /\?$/.test(String(message || "").trim());
  return asksUseOrPractice && asksAsQuestion;
}

function hasBackgroundPracticeSource(entries = []) {
  return (Array.isArray(entries) ? entries : []).some((entry = {}) => {
    const sourceType = String(entry.sourceType || entry.source_type || "").trim();
    const collectionId = String(entry.collectionId || entry.collection_id || "").trim();
    return sourceType === "journal_article" ||
      sourceType === "methodology_guide" ||
      sourceType === "state_guide" ||
      sourceType === "research_report" ||
      collectionId === "sotsiaaltoo_articles";
  });
}

export function shouldUseReportedPracticeInstruction(message = "", entries = []) {
  return isReportedPracticeQuestion(message) && hasBackgroundPracticeSource(entries);
}

function buildReportedPracticeInstruction(replyLang = "et") {
  if (replyLang === "en") {
    return [
      "REPORTED_PRACTICE_SOURCE_MODE:",
      "If RAG_CONTEXT contains a journal article, study or guide that describes an organization using a tool or practice, do not reject the point merely because the source is not an official current service register.",
      "Answer in source-bounded language: say that the source describes or reports the practice.",
      "If the user explicitly asks about current live operation, distinguish it from the reported use. Otherwise a brief date or past-tense framing is sufficient; do not add a separate current-status disclaimer."
    ].join("\n");
  }
  return [
    "REPORTED_PRACTICE_SOURCE_MODE:",
    "Kui RAG_CONTEXT sisaldab ajakirjaartiklit, uuringut või juhendit, mis kirjeldab mõne organisatsiooni tööriista või praktika kasutamist, ära lükka väidet tagasi ainult seepärast, et allikas ei ole ametlik tänase kasutusoleku register.",
    "Vasta allikaga piiratud sõnastuses: ütle, et allikas kirjeldab või käsitleb seda praktikat.",
    "Kui kasutaja küsib sõnaselgelt tänast kasutusolekut, erista see kirjeldatud kasutusest. Muul juhul piisab lühikesest aastast või ajavormist; ära lisa eraldi tänase seisu hoiatust."
  ].join("\n");
}

function buildMunicipalityListInstruction(replyLang = "et") {
  if (replyLang === "en") {
    return [
      "MUNICIPALITY_LIST_MODE:",
      "When listing municipal services and benefits, list only items explicitly present in RAG_CONTEXT.",
      "If the user asks about both services and benefits, answer both branches separately when both are present in RAG_CONTEXT.",
      "Separate services from benefits/supports. If one side is missing, say the current search did not find sufficient source confirmation for that branch instead of inventing names.",
      "Distinguish direct service pages from broad regulation categories such as 'other services'.",
      "Do not say that you lack access to the whole database. Refer to what the current search could or could not confirm."
    ].join("\n");
  }
  return [
    "MUNICIPALITY_LIST_MODE:",
    "Kui loetled KOV teenuseid ja toetusi, loetle ainult need nimetused, mis on RAG_CONTEXT-is otseselt olemas.",
    "Kui kasutaja kusib nii teenuseid kui toetusi, vasta molema haru kohta eraldi, kui molemad on RAG_CONTEXT-is olemas.",
    "Eralda teenused toetustest. Kui allikad ei anna yhe haru kohta piisavalt infot, ytle loomulikult, et praegune otsing ei leidnud selle kohta piisavat kinnitust; ara leiuta nimetusi juurde.",
    "Erista konkreetseid teenuselehti uldistest maaruse kategooriatest, nt 'muud teenused'.",
    "Kui allikad on leitud, vasta otse ja loomulikus keeles. Ara kasuta valjendeid \"Praegu nahtavas kontekstis\", \"RAG kontekstis\", \"kontekstis ei ole\" ega \"selles vaates ei ole\".",
    "Ara utle, et sul puudub ligipaas kogu andmebaasile. Viita sellele, mida praegune otsing sai voi ei saanud allikate pohjal kinnitada."
  ].join("\n");
}

function buildServiceJurisdictionInstruction(replyLang = "et") {
  if (replyLang === "en") {
    return [
      "SERVICE_JURISDICTION_MODE:",
      "The user is asking whether a service is municipal/local-government or national/state-level.",
      "Answer the classification directly. Do not ask for the municipality merely to classify the service.",
      "If recent conversation identifies a municipality, connect the answer to that municipality only when retrieved sources support it.",
      "Keep national legal framework and municipal implementation distinct."
    ].join("\n");
  }
  if (replyLang === "ru") {
    return [
      "SERVICE_JURISDICTION_MODE:",
      "Пользователь спрашивает, относится ли услуга к муниципальному или государственному уровню.",
      "Ответь на классификацию прямо. Не спрашивай муниципалитет только для того, чтобы классифицировать услугу.",
      "Если в недавнем разговоре указан муниципалитет, связывай ответ с ним только при наличии подтверждения в найденных источниках.",
      "Разделяй государственную правовую рамку и муниципальную организацию услуги."
    ].join("\n");
  }
  return [
    "SERVICE_JURISDICTION_MODE:",
    "Kasutaja küsib, kas teenus on KOV/kohaliku omavalitsuse või riigi tasandi teenus.",
    "Vasta liigitusele otse. Ära küsi omavalitsust ainult teenuse tasandi liigitamiseks.",
    "Kui hiljutisest vestlusest on omavalitsus teada, seo vastus selle omavalitsusega ainult siis, kui leitud allikad seda toetavad.",
    "Erista riiklik õigusraam ja KOV praktiline teenuse korraldus."
  ].join("\n");
}

function buildLegalCitationInstruction(replyLang = "et") {
  if (replyLang === "en") {
    return [
      "LEGAL_CITATION_MODE:",
      "When answering about a law, regulation or legal order, name the exact paragraph number and paragraph title if RAG_CONTEXT shows them.",
      "When the user names a specific law paragraph, answer about that exact paragraph only if the sources confirm it. Do not substitute a semantically similar provision for the requested paragraph.",
      "Do not invent paragraph numbers or quote legal wording that RAG_CONTEXT does not support.",
      "If the legal source support is only general or incomplete, say which part is confirmed and which exact provision the current search did not sufficiently confirm."
    ].join("\n");
  }
  if (replyLang === "ru") {
    return [
      "LEGAL_CITATION_MODE:",
      "Когда отвечаешь о законе, постановлении или порядке, укажи точный номер параграфа и заголовок, если они есть в RAG_CONTEXT.",
      "Не придумывай номера параграфов и не цитируй правовую формулировку, которой нет в RAG_CONTEXT.",
      "Если найденный правовой контекст общий или неполный, скажи, что подтверждено, а какого точного положения не видно."
    ].join("\n");
  }
  return [
    "LEGAL_CITATION_MODE:",
    "Kui vastad seaduse, määruse või korra kohta, nimeta täpne paragrahvinumber ja paragrahvi pealkiri, kui allikad neid kinnitavad.",
    "Kui kasutaja nimetab konkreetse seaduse paragrahvi, vasta selle täpse paragrahvi kohta ainult siis, kui allikad seda kinnitavad. Ära asenda küsitud paragrahvi semantiliselt sarnase sättega.",
    "Ära mõtle paragrahvinumbreid välja ega tsiteeri õiguslikku sõnastust, millele RAG_CONTEXT ei anna tuge.",
    "Kui leitud õiguslik allikatugi on ainult üldine või puudulik, ütle, mida see kinnitab, ja kasuta puuduva detaili kohta sõnastust: \"Ma ei leidnud praeguse otsinguga sellele piisavalt täpset õiguslikku allikakinnitust.\""
  ].join("\n");
}

export async function assembleRetrievalContext({
  payloadAudience,
  // Test-only override for the graph channel: set by an authenticated chat
  // payload (graphChannelTest), lets eval compare flag-on behavior without
  // enabling RAG_GRAPH_CHANNEL_ENABLED for end users.
  graphChannelTestOverride = false,
  normalizedRole,
  rawHistory,
  effectiveMessage,
  forceSources,
  forcedMode,
  hasHistory,
  replyLang,
  ephemeralChunks,
  ephemeralSource,
  combineSources,
  userId,
  convId,
  isCrisis,
  logInfo,
  logError,
  logEvent,
  buildMissingMunicipalityInstruction,
  buildSourceLookupInstruction,
    docContextBudgets,
    onBeforeRag = null,
    // B0b: minimaalne dependency-injection ainult testimiseks. Tootmises jääb
    // määramata ja kasutatakse päris searchRagQueries'it.
    searchRagQueriesImpl = null
}) {
  const runRagSearchImpl = typeof searchRagQueriesImpl === "function"
    ? searchRagQueriesImpl
    : searchRagQueries;
  const retrievalTimings = [];
  const runRagSearch = async (options = {}) => runRagSearchImpl({
    ...options,
    onTiming: timing => {
      if (!timing || typeof timing !== "object") return;
      retrievalTimings.push({
        request_id: typeof timing.request_id === "string" ? timing.request_id.slice(0, 200) : null,
        observabilityStage: typeof timing.observabilityStage === "string"
          ? timing.observabilityStage.slice(0, 100)
          : null,
        embedding_duration_ms: finiteOptionalNumber(timing.embedding_duration_ms),
        retriever_duration_ms: finiteOptionalNumber(timing.retriever_duration_ms),
        retrieval_total_ms: finiteOptionalNumber(timing.retrieval_total_ms),
        retrieval_timeout_ms: finiteOptionalNumber(timing.retrieval_timeout_ms),
        aborted_stage: typeof timing.aborted_stage === "string"
          ? timing.aborted_stage.slice(0, 100)
          : null,
        time_since_previous_rag_request_ms: finiteOptionalNumber(timing.time_since_previous_rag_request_ms),
        http_status: finiteOptionalNumber(timing.http_status),
        outcome: typeof timing.outcome === "string" ? timing.outcome.slice(0, 40) : null
      });
    }
  });
  let ragRiskPolicy = classifyRagRisk(effectiveMessage, {
    isCrisis,
    role: normalizedRole
  });
  const questionPlan = buildQuestionPlan({
    message: effectiveMessage,
    role: normalizedRole
  });
  const previousSourceUseRequest = detectPreviousSourceUseRequest(rawHistory, effectiveMessage);
  const sourceLookupRequest = !previousSourceUseRequest && detectSourceAvailabilityRequest(rawHistory, effectiveMessage);
  const recentAssistantSourcesAvailable = hasRecentAssistantSources(rawHistory);
  const questionPlanForcesRag =
    questionPlan?.needs_rag === true &&
    questionPlan?.mode &&
    questionPlan.mode !== "default";
  const externalSourcesNeeded = shouldUseExternalSourcesForTurn(effectiveMessage, {
    forceSources,
    defaultToExternalSources: forcedMode === "rag" || questionPlanForcesRag,
    hasHistory,
    hasRecentAssistantSources: recentAssistantSourcesAvailable,
    sourceLookupRequest,
    previousSourceUseRequest
  });
  const sourceLookupCombinedText = sourceLookupRequest
    ? [effectiveMessage, ...extractRecentUserText(rawHistory, 8)].join("\n")
    : "";
  const sourceLookupSubject = sourceLookupRequest
    ? inferSourceLookupSubject(sourceLookupCombinedText)
    : "";
  const sourceLookupParagraphRefs = sourceLookupRequest ? extractParagraphReferences(sourceLookupCombinedText) : [];
  const sourceLookupTargetsNationalLaw = sourceLookupRequest &&
    isNationalLawSourceLookup(sourceLookupSubject, sourceLookupCombinedText);
  const thematicSynthesisQuestion = !sourceLookupRequest && isThematicSynthesisRagQuestion(effectiveMessage);
  const broadMultiSourceQuestion = !sourceLookupRequest && isBroadMultiSourceRagQuestion(effectiveMessage);

  const audienceFilter = payloadAudience === "CLIENT" || normalizedRole === "CLIENT"
    ? {
        // Legacy documents have no marker and remain eligible as v0. A source
        // explicitly superseded by the lifecycle must never reach retrieval.
        is_current_version: { $ne: false },
        audience: {
          $in: ["CLIENT", "BOTH"]
        }
      }
    : {
        is_current_version: { $ne: false },
        audience: {
          $in: ["SOCIAL_WORKER", "BOTH"]
        }
      };

  const currentMessageMunicipalities = await detectMentionedMunicipalitiesFromUserText([], effectiveMessage, {
    logError
  });
  const carryMunicipalityFromHistory = !currentMessageMunicipalities.length && shouldCarryMunicipalityFromHistory(effectiveMessage);
  const mentionedMunicipalities = carryMunicipalityFromHistory
    ? await detectMentionedMunicipalitiesFromUserText(rawHistory, effectiveMessage, {
        logError
      })
    : currentMessageMunicipalities;
  const effectiveMunicipalities = currentMessageMunicipalities.length
    ? currentMessageMunicipalities
    : carryMunicipalityFromHistory
      ? mentionedMunicipalities
      : [];
  const allowMunicipalityScopedRag = effectiveMunicipalities.length > 0 && !sourceLookupTargetsNationalLaw;
  let serviceMapKovContacts = [];
  if (allowMunicipalityScopedRag) {
    try {
      serviceMapKovContacts = await loadServiceMapKovContactsForMunicipalities(effectiveMunicipalities);
    } catch (err) {
      if (typeof logError === "function") {
        logError("service_map_contacts.load_failed", {
          err: err?.message || String(err),
          municipalities: effectiveMunicipalities.map((item) => item.displayName).filter(Boolean)
        });
      }
      serviceMapKovContacts = [];
    }
  }
  const serviceMapKovContactContext = buildServiceMapKovContactContext(serviceMapKovContacts);
  const municipalityServiceBenefitListRequest =
    allowMunicipalityScopedRag && (
      isMunicipalityServiceBenefitTurn(effectiveMessage, rawHistory) ||
      (currentMessageMunicipalities.length > 0 && isContextualServiceBenefitListFollowup(effectiveMessage, rawHistory))
    );
  const currentServiceBenefitIntent = detectServiceBenefitIntent(effectiveMessage);
  const targetGroupFollowup = hasTargetGroupTerm(normalizeIntentText(effectiveMessage));
  const serviceJurisdictionQuestion = isServiceJurisdictionClassificationQuestion(effectiveMessage);
  const nationalServiceBenefitQuestion =
    isNationalServiceBenefitQuestion(effectiveMessage) ||
    isNationalServiceBenefitFollowup(effectiveMessage, rawHistory);
  const legalSourceQuestion =
    /\b(seadus|shs|maarus|määrus|korra|kord|riigi teataja|riigiteataja|paragrahv|§|oigusakt|õigusakt)\b/.test(normalizeIntentText(effectiveMessage));
  const municipalityServiceBenefitRagRequest =
    allowMunicipalityScopedRag &&
    (municipalityServiceBenefitListRequest || currentServiceBenefitIntent.wantsServices || currentServiceBenefitIntent.wantsBenefits || targetGroupFollowup);
  const overviewSynthesisQuestion =
    thematicSynthesisQuestion &&
    broadMultiSourceQuestion &&
    !allowMunicipalityScopedRag &&
    !municipalityServiceBenefitListRequest &&
    !municipalityServiceBenefitRagRequest &&
    !nationalServiceBenefitQuestion &&
    !serviceJurisdictionQuestion &&
    !sourceLookupTargetsNationalLaw;
  const resourceDiscoveryQuestion =
    questionPlan.mode === "resource_discovery" &&
    !sourceLookupRequest &&
    !overviewSynthesisQuestion &&
    !allowMunicipalityScopedRag &&
    !municipalityServiceBenefitListRequest &&
    !municipalityServiceBenefitRagRequest &&
    !nationalServiceBenefitQuestion &&
    !serviceJurisdictionQuestion &&
    !sourceLookupTargetsNationalLaw;
  const personSourceLookupQuestion =
    questionPlan.mode === "person_source_lookup" &&
    !sourceLookupRequest &&
    !allowMunicipalityScopedRag &&
    !sourceLookupTargetsNationalLaw;
  const municipalityServiceBenefitIntent = municipalityServiceBenefitListRequest
    ? detectServiceBenefitTurnIntent(effectiveMessage, rawHistory)
    : currentServiceBenefitIntent.wantsServices || currentServiceBenefitIntent.wantsBenefits
      ? currentServiceBenefitIntent
      : targetGroupFollowup
        ? {
            wantsServices: true,
            wantsBenefits: true
          }
      : {
          wantsServices: true,
          wantsBenefits: true
        };
  const municipalityQuestionNeedsClarification =
    !allowMunicipalityScopedRag &&
    !serviceJurisdictionQuestion &&
    !nationalServiceBenefitQuestion &&
    isMunicipalityDependentSocialHelpQuestion(effectiveMessage);
  const baseRagQueryText = sourceLookupRequest
    ? buildSourceLookupSearchQuery(effectiveMessage, rawHistory)
    : serviceJurisdictionQuestion
      ? buildServiceJurisdictionQuery(effectiveMessage)
    : nationalServiceBenefitQuestion
      ? buildNationalServiceBenefitQuery(effectiveMessage)
    : buildRagSearchQuery(effectiveMessage, rawHistory);
  const temporalRetrievalPlan = sourceLookupRequest
    ? {
        enabled: false,
        years: [],
        preferredYears: [],
        focusText: "",
        queries: baseRagQueryText ? [baseRagQueryText] : []
      }
    : buildTemporalRetrievalPlan({
        message: effectiveMessage,
        history: rawHistory,
        baseQuery: baseRagQueryText
      });
  const journalChunksPerDocument = (
    broadMultiSourceQuestion ||
    overviewSynthesisQuestion ||
    resourceDiscoveryQuestion ||
    personSourceLookupQuestion ||
    temporalRetrievalPlan.enabled ||
    municipalityServiceBenefitListRequest ||
    municipalityServiceBenefitRagRequest ||
    nationalServiceBenefitQuestion ||
    serviceJurisdictionQuestion ||
    sourceLookupTargetsNationalLaw
  ) ? 3 : 8;
  const topicHints = extractTopicHints(temporalRetrievalPlan.focusText || effectiveMessage);
  const extraSystemInstructions = [
    ...(municipalityQuestionNeedsClarification
      ? [buildMissingMunicipalityInstruction(normalizedRole, replyLang)]
      : []),
    ...(sourceLookupRequest ? [buildSourceLookupInstruction(replyLang)] : []),
    ...(!sourceLookupRequest && externalSourcesNeeded ? [buildLayeredContextInstruction(replyLang)] : []),
    ...(resourceDiscoveryQuestion ? [buildResourceDiscoveryInstruction(replyLang)] : []),
    ...(personSourceLookupQuestion ? [buildPersonSourceLookupInstruction(replyLang)] : []),
    ...(overviewSynthesisQuestion ? [buildOverviewSynthesisInstruction(replyLang)] : []),
    ...(thematicSynthesisQuestion && !overviewSynthesisQuestion ? [buildThematicSynthesisInstruction(replyLang)] : []),
    ...(externalSourcesNeeded && ragRiskPolicy.riskLevel !== "low"
      ? [buildRiskPolicyInstruction(ragRiskPolicy, replyLang)]
      : []),
    ...((legalSourceQuestion || sourceLookupTargetsNationalLaw || nationalServiceBenefitQuestion || serviceJurisdictionQuestion)
      ? [buildLegalCitationInstruction(replyLang)]
      : []),
    ...(serviceJurisdictionQuestion ? [buildServiceJurisdictionInstruction(replyLang)] : []),
    ...(municipalityServiceBenefitRagRequest ? [buildMunicipalityListInstruction(replyLang)] : []),
    ...(temporalRetrievalPlan.enabled ? [buildTemporalBreakdownInstruction(replyLang, temporalRetrievalPlan.years)] : [])
  ];

  let matches = [];
  let ragSearchFailed = false;
  let groupedMatches = [];
  let chosen = [];
  let overviewSelection = null;
  let budgeted = {
    text: "",
    used: []
  };
  let temporalMissingYears = [];
  let numericFactEvidence = {
    enabled: false,
    sufficient: false,
    expectedCount: 0,
    evidenceCount: 0
  };
  let legalSelection = {
    groupedMatches: [],
    selectionGroups: [],
    missingParagraphRefs: [],
    insufficientPreciseLegalSourceSupport: false
  };
  const preferRagForSourceLookup = sourceLookupRequest;
  const shouldRunRag =
    externalSourcesNeeded &&
    !previousSourceUseRequest &&
    (preferRagForSourceLookup || !ephemeralChunks.length || combineSources);
  const {
    ragQueryText,
    legalLookupPlan,
    ragQueries,
    primaryRagQueries,
    searchFilters,
    sourceLookupTopK,
    ragSearchTopK,
    ragRetrievers,
    selectionStrategy,
    contextGroupTarget,
    queryPlan
  } = buildRagQueryPlan({
    baseRagQueryText,
    effectiveMessage,
    rawHistory,
    sourceLookupRequest,
    sourceLookupParagraphRefs,
    temporalRetrievalPlan,
    overviewSynthesisQuestion,
    thematicSynthesisQuestion,
    nationalServiceBenefitQuestion,
    serviceJurisdictionQuestion,
    allowMunicipalityScopedRag,
    municipalityServiceBenefitRagRequest,
    municipalityServiceBenefitListRequest,
    municipalityServiceBenefitIntent,
    effectiveMunicipalities,
    audienceFilter,
    sourceLookupTargetsNationalLaw,
    externalSourcesNeeded,
    shouldRunRag,
    previousSourceUseRequest,
    broadMultiSourceQuestion,
    ragRiskPolicy,
    questionPlan,
    resourceDiscoveryQuestion
  });

  // Graph-lite channel (C2): behind RAG_GRAPH_CHANNEL_ENABLED. Matched graph
  // entities expand retrieval queries with related forms/contacts/legal basis;
  // never produces answer text and never bypasses attribution.
  // Graph expansion only helps modes that look for related items (forms,
  // contacts, services). Comparison/legal/overview have purpose-built query
  // plans that graph expansions measurably dilute (eval 2026-06-12: §17
  // dropped from comparison displayed sources), so they are excluded.
  const GRAPH_CHANNEL_EXCLUDED_MODES = new Set([
    "comparison", "legal_exact", "explicit_paragraph", "overview_synthesis",
    "national_source_lookup", "source_lookup", "temporal", "municipality_service_benefit_list"
  ]);
  let graphChannel = null;
  // Graph queries run as a SEPARATE pass (below, after the native search) rather
  // than mixed into primaryRagQueries — that keeps native retrieval at full
  // per-query depth and lets the graph supplement be marked and quota-capped.
  let graphChannelQueries = [];
  const graphChannelActive =
    shouldRunRag &&
    (isGraphChannelEnabled() || graphChannelTestOverride === true) &&
    !GRAPH_CHANNEL_EXCLUDED_MODES.has(String(queryPlan?.mode || ""));
  if (graphChannelActive) {
    try {
      const graphLookup = await graphChannelLookup({
        question: effectiveMessage,
        prisma,
        municipalityNames: effectiveMunicipalities.map((item) => item.displayName).filter(Boolean)
      });
      graphChannelQueries = graphHintsToQueryTexts(graphLookup);
      graphChannel = {
        matched_entities: graphLookup.matched_entities,
        hint_group_count: (graphLookup.hints || []).length,
        added_query_count: graphChannelQueries.length
      };
      if (queryPlan && typeof queryPlan === "object") queryPlan.graph_channel = graphChannel;
      logInfo?.("rag.graph_channel", graphChannel);
    } catch (graphErr) {
      logError?.("rag.graph_channel_failed", { message: graphErr?.message || String(graphErr) });
    }
  }

  if (shouldRunRag) {
    if (typeof onBeforeRag === "function") {
      await onBeforeRag();
    }
    try {
      matches = await runRagSearch({
        queries: primaryRagQueries,
        topK: ragSearchTopK,
        retrievers: ragRetrievers,
        journalChunksPerDocument,
        filters: searchFilters,
        userId,
        role: normalizedRole,
        conversationId: convId
      });
      matches = filterMunicipalityScopedMatches(matches, {
        allowMunicipalityScoped: allowMunicipalityScopedRag
      });
      matches = filterMatchesToMunicipalities(matches, effectiveMunicipalities);

      if ((sourceLookupTargetsNationalLaw || nationalServiceBenefitQuestion || serviceJurisdictionQuestion) && matches.length === 0) {
        const nationalFallbackMatches = await runRagSearch({
          queries: ragQueries,
          topK: sourceLookupRequest
            ? Math.min(24, Math.max(12, sourceLookupTopK || RAG_TOP_K))
            : nationalServiceBenefitQuestion || serviceJurisdictionQuestion
              ? Math.min(36, Math.max(18, RAG_TOP_K * 3))
              : Math.min(24, Math.max(12, RAG_TOP_K)),
          filters: audienceFilter,
          observabilityStage: "rag_search_national_fallback",
          userId,
          role: normalizedRole,
          conversationId: convId
        });
        matches = filterMunicipalityScopedMatches(nationalFallbackMatches, {
          allowMunicipalityScoped: false
        });
      }

      if (!sourceLookupRequest && allowMunicipalityScopedRag && !sourceLookupTargetsNationalLaw && !municipalityServiceBenefitListRequest) {
        const backgroundTopK = Math.min(12, Math.max(6, RAG_TOP_K));
        try {
          const backgroundMatches = await runRagSearch({
            queries: buildGeneralBackgroundQueries(ragQueries, ragQueryText),
            topK: backgroundTopK,
            filters: audienceFilter,
            observabilityStage: "rag_search_background_scope",
            userId,
            role: normalizedRole,
            conversationId: convId
          });
          matches = dedupeRagMatches([
            ...matches,
            ...filterMunicipalityScopedMatches(backgroundMatches, {
              allowMunicipalityScoped: false
            })
          ]);
        } catch (err) {
          await logRagSearchError({
            err,
            event: "rag_optional_search_error",
            logError,
            logEvent,
            userId,
            role: normalizedRole,
            isCrisis,
            stage: "rag_search_background_scope",
            optional: true,
            queryPlan,
            selectionStrategy,
            topK: backgroundTopK,
            conversationId: convId
          });
        }
      }

      if (
        !sourceLookupRequest &&
        allowMunicipalityScopedRag &&
        municipalityServiceBenefitRagRequest &&
        !municipalityServiceBenefitListRequest &&
        !(legalLookupPlan?.enabled && legalLookupPlan.mode === "explicit_paragraph")
      ) {
        const regulationQueries = buildMunicipalityRegulationPackageQueries(effectiveMunicipalities);
        if (regulationQueries.length) {
          const regulationTopK = Math.min(8, Math.max(4, regulationQueries.length * 4));
          try {
            const regulationMatches = await runRagSearch({
              queries: regulationQueries,
              topK: regulationTopK,
              filters: audienceFilter,
              observabilityStage: "rag_search_kov_regulation_package_candidates",
              userId,
              role: normalizedRole,
              conversationId: convId
            });
            matches = dedupeRagMatches([
              ...matches,
              ...filterMatchesToMunicipalities(
                filterMunicipalityScopedMatches(regulationMatches, {
                  allowMunicipalityScoped: true
                }),
                effectiveMunicipalities
              )
            ]);
          } catch (err) {
            await logRagSearchError({
              err,
              event: "rag_optional_search_error",
              logError,
              logEvent,
              userId,
              role: normalizedRole,
              isCrisis,
              stage: "rag_search_kov_regulation_package_candidates",
              optional: true,
              queryPlan,
              selectionStrategy,
              topK: regulationTopK,
              conversationId: convId
            });
          }
        }
      }

      // Graph-channel supplement (C2 quota): a separate pass so native depth is
      // untouched. Keep only graph-found documents native retrieval missed, mark
      // them retrieval_channel=graph, and cap to GRAPH_CHANNEL_MAX_DISPLAYED.
      if (graphChannelActive && graphChannelQueries.length) {
        try {
          const graphMatchesRaw = await runRagSearch({
            queries: graphChannelQueries,
            topK: graphChannelSearchTopK(graphChannelQueries.length),
            filters: searchFilters,
            observabilityStage: "rag_search_graph_channel",
            userId,
            role: normalizedRole,
            conversationId: convId
          });
          const graphMatchesScoped = filterMatchesToMunicipalities(
            filterMunicipalityScopedMatches(graphMatchesRaw, {
              allowMunicipalityScoped: allowMunicipalityScopedRag
            }),
            effectiveMunicipalities
          );
          const graphSupplement = selectGraphChannelSupplement(
            matches,
            graphMatchesScoped,
            GRAPH_CHANNEL_MAX_DISPLAYED
          );
          if (graphSupplement.length) {
            matches = dedupeRagMatches([...matches, ...graphSupplement]);
          }
          if (graphChannel) graphChannel.added_candidate_count = graphSupplement.length;
        } catch (graphErr) {
          logError?.("rag.graph_channel_search_failed", {
            message: graphErr?.message || String(graphErr)
          });
        }
      }
    } catch (err) {
      ragSearchFailed = true;
      await logRagSearchError({
        err,
        event: "rag_error",
        logError,
        logEvent,
        userId,
        role: normalizedRole,
        isCrisis,
        stage: "rag_search",
        optional: false,
        queryPlan,
        selectionStrategy,
        topK: ragSearchTopK,
        conversationId: convId
      });
    }

      groupedMatches = rankGroupsWithTopicHints(groupMatches(matches), topicHints, {
        ragRiskPolicy
      });
    if (temporalRetrievalPlan.enabled) {
      const coveredYears = new Set(
        groupedMatches
          .map(extractMatchGroupYear)
          .filter((year) => Number.isInteger(year))
      );
      const missingYears = temporalRetrievalPlan.years.filter((year) => !coveredYears.has(year));
      temporalMissingYears = missingYears;
      if (missingYears.length) {
        const fallbackSettled = await Promise.allSettled(
          missingYears.map((year) =>
            runRagSearch({
              queries: buildTemporalFillQueries({
                years: [year],
                focusText: temporalRetrievalPlan.focusText || effectiveMessage,
                message: effectiveMessage,
                topicHints
              }),
              topK: Math.max(12, RAG_TOP_K),
              filters: sourceLookupTargetsNationalLaw
                ? {
                    ...audienceFilter,
                    jurisdiction_level: "NATIONAL"
                  }
                : audienceFilter,
              observabilityStage: `rag_search_temporal_fill_${year}`,
              userId,
              role: normalizedRole,
              conversationId: convId
            })
          )
        );
        const fallbackMatches = fallbackSettled.flatMap((item) =>
          item.status === "fulfilled" && Array.isArray(item.value) ? item.value : []
        );
        matches = dedupeRagMatches([
          ...matches,
          ...filterMatchesToMunicipalities(
            filterMunicipalityScopedMatches(fallbackMatches, {
              allowMunicipalityScoped: allowMunicipalityScopedRag
            }),
            effectiveMunicipalities
          )
        ]);
        groupedMatches = rankGroupsWithTopicHints(groupMatches(matches), topicHints, {
          ragRiskPolicy
        });
      }
    }

    if (serviceMapKovContacts.length) {
      matches = excludeSupersededKovContactMatches(matches, serviceMapKovContacts);
      groupedMatches = rankGroupsWithTopicHints(groupMatches(matches), topicHints, {
        ragRiskPolicy
      });
    }

    legalSelection = buildLegalExactSelection(groupedMatches, legalLookupPlan, {
      ragRiskPolicy
    });
    groupedMatches = legalSelection.groupedMatches;
    if (legalSelection.insufficientPreciseLegalSourceSupport) {
      extraSystemInstructions.push(
        buildLegalExactMissingInstruction(replyLang, legalLookupPlan, legalSelection.missingParagraphRefs)
      );
    }

    if (legalLookupPlan?.enabled && legalLookupPlan.mode === "explicit_paragraph") {
      chosen = legalSelection.selectionGroups.slice(0, contextGroupTarget);
    } else if (temporalRetrievalPlan.enabled) {
      chosen = selectTemporalGroups(groupedMatches, temporalRetrievalPlan.years, CONTEXT_GROUPS_MAX, DIVERSIFY_LAMBDA);
    } else if (temporalRetrievalPlan.preferredYears?.length === 1) {
      chosen = selectGroupsWithPreferredSourceYear(
        groupedMatches,
        temporalRetrievalPlan.preferredYears,
        contextGroupTarget,
        DIVERSIFY_LAMBDA
      );
    } else if (municipalityServiceBenefitListRequest) {
      chosen = selectMunicipalityServiceBenefitGroups(
        groupedMatches,
        contextGroupTarget,
        municipalityServiceBenefitIntent
      );
    } else if (overviewSynthesisQuestion) {
      overviewSelection = selectOverviewSynthesisGroups(groupedMatches, contextGroupTarget, DIVERSIFY_LAMBDA, {
        minDocuments: 3,
        preferredSourceCount: 6,
        dominantShareLimit: 0.4
      });
      chosen = overviewSelection.selected;
    } else if (personSourceLookupQuestion) {
      chosen = selectPersonSourceGroups(
        effectiveMessage,
        groupedMatches,
        contextGroupTarget,
        questionPlan.person_name
      );
    } else if (resourceDiscoveryQuestion) {
      chosen = selectMultiSourceGroups(groupedMatches, contextGroupTarget, DIVERSIFY_LAMBDA);
    } else if (broadMultiSourceQuestion || selectionStrategy === "multi_source_diversity") {
      chosen = selectMultiSourceGroups(groupedMatches, contextGroupTarget, DIVERSIFY_LAMBDA);
    } else {
      chosen = diversifyGroupsMMR(groupedMatches, contextGroupTarget, DIVERSIFY_LAMBDA);
    }
    if (journalChunksPerDocument > 3) {
      // Focused numeric facts need the highest-ranked topical source, not an
      // MMR-diversified substitute that merely contains convenient numbers.
      numericFactEvidence = selectSingleSourceNumericFactGroups(effectiveMessage, groupedMatches);
      if (numericFactEvidence.enabled) {
        chosen = numericFactEvidence.groups;
        if (!numericFactEvidence.sufficient) {
          extraSystemInstructions.push(
            "NUMERIC_SOURCE_COHERENCE: insufficient_same_source. Ära täida küsitud arve teise artikli, aruande või allikagrupi arvudega. Ütle lühidalt, et neid arvulisi väiteid ei saa valitud põhiallikaga piisavalt kinnitada."
          );
        }
      }
    }
    budgeted = buildContextWithBudget(
      chosen,
      {
        ...buildRagContextBudgetOptions({
        temporalRetrievalPlan,
        municipalityServiceBenefitListRequest,
        broadMultiSourceQuestion: broadMultiSourceQuestion || resourceDiscoveryQuestion || personSourceLookupQuestion || selectionStrategy === "multi_source_diversity",
        sourceLookupRequest,
        sourceLookupTargetsNationalLaw,
        sourceLookupParagraphRefs,
        contextGroupTarget
        }),
        maxBodies: journalChunksPerDocument > 3 ? journalChunksPerDocument : 2,
        secondaryMaxBodies: journalChunksPerDocument > 3 ? 2 : undefined,
        secondaryBodyMaxChars: journalChunksPerDocument > 3 ? 1100 : undefined,
        allowExpandedBodyBudget: journalChunksPerDocument > 3,
        includeAuthors: shouldIncludeContextAuthors(effectiveMessage, chosen, { sourceLookupRequest })
      }
    );
    if (shouldUseReportedPracticeInstruction(effectiveMessage, budgeted.used)) {
      extraSystemInstructions.push(buildReportedPracticeInstruction(replyLang));
    }
  }

  const ragContext = budgeted.text;
  const sourcePackageEntries = [
    ...budgeted.used,
    ...groupedMatches
  ];
  const sourcePackages = buildRuntimeSourcePackages(sourcePackageEntries.map((entry, idx) => ({
    ...entry,
    id: displaySourceIdForContextEntry(entry, idx),
    source_id: displaySourceIdForContextEntry(entry, idx),
    raw_source_id: entry.sourceId || undefined
  })));
  const packageAwareContext = buildPackageAwareContext(sourcePackages, {
    query: effectiveMessage,
    role: normalizedRole
  });
  const packageAwareAnsweringUsed = !!(
    packageAwareContext.used &&
    !(legalLookupPlan?.enabled && legalLookupPlan.mode === "explicit_paragraph")
  );
  if (packageAwareContext.insufficientPreciseSupport === true) {
    ragRiskPolicy = {
      ...ragRiskPolicy,
      riskLevel: "high",
      requiredEvidence: "strong",
      insufficientEvidenceMode: true,
      reasons: [
        ...(Array.isArray(ragRiskPolicy.reasons) ? ragRiskPolicy.reasons : []),
        packageAwareContext.packageSelectionStatus === "insufficient_service_match"
          ? "insufficient_service_match"
          : "missing_precise_service_evidence"
      ].filter((value, index, values) => values.indexOf(value) === index).slice(0, 6)
    };
    extraSystemInstructions.push(buildRiskPolicyInstruction(ragRiskPolicy, replyLang));
  }
  if (packageAwareContext.packageSelectionStatus === "insufficient_service_match") {
    extraSystemInstructions.push(
      "PACKAGE_SELECTION_STATUS: insufficient_service_match. Ära kasuta sama omavalitsuse teise teenuse paketti küsitud teenuse tasu, tähtaja, vormi, kontakti ega tingimuste kinnitamiseks. Kui RAG_CONTEXT ei sisalda küsitud teenuse otsest kinnitust, ütle, et kasutatud allikad ei kinnita detaili piisavalt."
    );
  }
  const sectionAttribution = buildSectionAttribution({
    sourcePackages,
    packageAwareAnswering: {
      used: packageAwareAnsweringUsed
    },
    ragRiskPolicy,
    queryPlan
  });
  if (packageAwareAnsweringUsed) {
    extraSystemInstructions.push(
      "Kasuta KOV teenuse või toetuse vastamisel SourcePackage'i esmase struktuurina. Teenuse olemasolu küsimuses anna kohe lühidalt ka teenuse sisu, taotlemise info ning kinnitatud vormi/kontakti lingid, kui need on SourcePackage'is olemas. Kombineeri KOV teenuselehe praktiline info ja KOV määruse info; ära luba neid detaile hiljem anda, kui need on allikates juba olemas. Ära väida puuduvat vormi, kontakti, õiguslikku alust, tasu ega tähtaega, kui package märgib selle sektsiooni puuduvaks."
    );
  }
  const preciseServiceContactUnsupported = packageAwareAnsweringUsed &&
    packageAwareContext.requiredEvidenceSections?.includes("contacts");
  const useServiceMapKovContactContext = !!serviceMapKovContactContext && !preciseServiceContactUnsupported;
  const kovContactMode = resolveKovContactMode({
    message: effectiveMessage,
    listRequest: municipalityServiceBenefitListRequest,
    serviceSpecific: packageAwareAnsweringUsed
  });
  if (useServiceMapKovContactContext) {
    extraSystemInstructions.push(buildServiceMapKovContactInstruction(replyLang, {
      mode: kovContactMode
    }));
  } else if (preciseServiceContactUnsupported) {
    extraSystemInstructions.push(
      "CONTACT_EVIDENCE_STATUS: insufficient_service_match. SourcePackage ei kinnita sellele teenusele kontakti. Ara esita RAG_CONTEXT-i eraldiseisvat uldkontakti, nime, telefoninumbrit ega e-posti selle teenuse kinnitatud kontaktina; utle, et kasutatud allikad ei kinnita teenuse kontaktisikut piisavalt."
    );
  }
  const docBudget = getDocContextBudget(normalizedRole, combineSources, docContextBudgets);
  const docQueryText = [effectiveMessage, ...extractRecentUserText(rawHistory, 2)].filter(Boolean).join("\n");
  const docContextResult = buildEphemeralDocContext(ephemeralChunks, {
    queryText: docQueryText,
    charBudget: docBudget.charBudget,
    maxChunks: docBudget.maxChunks,
    maxInputChunks: docContextBudgets.maxInputChunks,
    chunkCharsMax: docContextBudgets.chunkCharsMax
  });
  const docContext = docContextResult.text;
  const contextParts = [];

  if (docContext && !preferRagForSourceLookup) {
    contextParts.push(`USER DOCUMENT:\n${docContext}`);
  }
  if (packageAwareAnsweringUsed && packageAwareContext.contextText) {
    contextParts.push(packageAwareContext.contextText);
  }
  if (preferRagForSourceLookup) {
    if (ragContext) contextParts.push(ragContext);
  } else if (!docContext) {
    if (ragContext) contextParts.push(ragContext);
  } else if (combineSources && ragContext) {
    contextParts.push(ragContext);
  }
  if (useServiceMapKovContactContext) {
    contextParts.push(serviceMapKovContactContext);
  }

  const context = contextParts.filter(Boolean).join("\n\n");
  const lookupFallbackContext = sourceLookupRequest
    ? "SOURCE_LOOKUP_CONTEXT: The current targeted source lookup returned no matches."
    : "";
  const conversationalFallbackContext =
    !externalSourcesNeeded && !docContext
      ? "CONVERSATIONAL_CONTEXT: No verified external context was retrieved for this turn."
      : "";
  const effectiveContext = context && context.trim() ? context : lookupFallbackContext || conversationalFallbackContext;
  const grounding = groundingStrength(groupedMatches);
  const usedDocContext = contextParts.some((part) => part.startsWith("USER DOCUMENT:\n"));
  const usedRagContext = !!ragContext && contextParts.some((part) => part === ragContext);
  const usedServiceMapKovContactContext = !!serviceMapKovContactContext &&
    contextParts.some((part) => part === serviceMapKovContactContext);
  const groupedYears = Array.from(new Set(groupedMatches.map(extractMatchGroupYear).filter((year) => Number.isInteger(year))));
  const selectedYears = Array.from(new Set(chosen.map(extractMatchGroupYear).filter((year) => Number.isInteger(year))));
  const contextYears = Array.from(new Set(budgeted.used.map(extractMatchGroupYear).filter((year) => Number.isInteger(year))));
  const retrieversUsed = inferRetrieversUsed(matches, shouldRunRag ? ["dense"] : []);

  if (typeof logInfo === "function") {
    logInfo("rag.afterSearch", {
      rawMatches: matches.length,
      groups: groupedMatches.length,
      grounding,
      mmrSelected: chosen.length,
      groupedYears,
      selectedYears,
      contextYears,
      retrieversUsed,
      requestedYears: temporalRetrievalPlan.enabled ? temporalRetrievalPlan.years : [],
      preferredSourceYears: temporalRetrievalPlan.preferredYears || [],
      missingYears: temporalMissingYears,
      docChunkInputCount: ephemeralChunks.length,
      docChunkUsedCount: docContextResult.usedChunks,
      docContextChars: docContextResult.usedChars,
      serviceMapKovContactCount: serviceMapKovContacts.length,
      kovContactMode: usedServiceMapKovContactContext ? kovContactMode : undefined,
      ragSkipped: !shouldRunRag,
      externalSourcesNeeded,
      sourceLookupRequest,
      ragRiskLevel: ragRiskPolicy.riskLevel,
      ragRequiredEvidence: ragRiskPolicy.requiredEvidence,
      queryPlanMode: queryPlan.mode,
      queryPlanSelectionStrategy: selectionStrategy,
      queryPlanQueryOrder: queryPlan.query_order,
      municipalityMentioned: allowMunicipalityScopedRag,
      municipalityMatches: effectiveMunicipalities.map((item) => item.displayName)
    });
  }

  if (typeof logEvent === "function") {
    if (shouldRunRag || usedDocContext || usedRagContext || usedServiceMapKovContactContext) {
      await logEvent("rag_search", {
        userId,
        role: normalizedRole,
        isCrisis,
        ragMatchCount: matches.length,
        groupCount: groupedMatches.length,
        chosenGroupCount: chosen.length,
        grounding,
        groupedYears: groupedYears.join(",") || undefined,
        selectedYears: selectedYears.join(",") || undefined,
        contextYears: contextYears.join(",") || undefined,
        retrieversUsed,
        requestedYears: temporalRetrievalPlan.enabled ? temporalRetrievalPlan.years.join(",") : undefined,
        preferredSourceYears: temporalRetrievalPlan.preferredYears?.length
          ? temporalRetrievalPlan.preferredYears.join(",")
          : undefined,
        missingYears: temporalMissingYears.length ? temporalMissingYears.join(",") : undefined,
        docChunkInputCount: ephemeralChunks.length,
        docChunkUsedCount: docContextResult.usedChunks,
        docContextChars: docContextResult.usedChars,
        hadDocContext: usedDocContext,
        hadRagContext: usedRagContext,
        hadServiceMapKovContactContext: usedServiceMapKovContactContext,
        serviceMapKovContactCount: serviceMapKovContacts.length,
        kovContactMode: usedServiceMapKovContactContext ? kovContactMode : undefined,
        sourceLookupRequest,
        ragRiskLevel: ragRiskPolicy.riskLevel,
        ragRequiredEvidence: ragRiskPolicy.requiredEvidence,
        ragInsufficientEvidenceMode: ragRiskPolicy.insufficientEvidenceMode,
        queryPlanMode: queryPlan.mode,
        queryPlanSelectionStrategy: selectionStrategy,
        queryPlanQueryOrder: queryPlan.query_order,
        municipalityMentioned: allowMunicipalityScopedRag,
        municipalityMatches: effectiveMunicipalities.map((item) => item.displayName),
        retrievalTimings: retrievalTimings.length ? retrievalTimings : undefined
      });
    } else {
      await logEvent("chat_no_external_sources", {
        userId,
        role: normalizedRole,
        isCrisis,
      sourceLookupRequest,
      ragRiskLevel: ragRiskPolicy.riskLevel,
      messageLength: effectiveMessage.length
      });
    }

    if (isCrisis) {
      await logEvent("crisis_detected", {
        userId,
        role: normalizedRole,
        hasHistory,
        hadRagContext: usedRagContext
      });
    }
  }

  const docSources = ephemeralChunks && ephemeralChunks.length
    ? [{
        id: "user-document",
        title: getEphemeralSourceLabel(ephemeralSource, "(Uploaded document)"),
        url: undefined,
        file: undefined,
        fileName: getEphemeralSourceLabel(ephemeralSource, "") || undefined,
        audience: undefined,
        pageRange: undefined,
        authors: undefined,
        issueLabel: undefined,
        issueId: undefined,
        journalTitle: undefined,
        section: undefined,
        paragraphTitle: undefined,
        year: undefined,
        pages: undefined,
        short_ref: "(uploaded document)"
      }]
    : [];
  const ragSources = budgeted.used.map((entry, idx) => {
    const pageNumbers = Array.isArray(entry.pages) ? entry.pages : [];
    const pageRanges = Array.isArray(entry.pageRanges) ? Array.from(new Set(entry.pageRanges.filter(Boolean))) : [];
    const pageTextRaw = (pageRanges.length ? pageRanges.join(", ") : collapsePages(pageNumbers)).trim();
    const pageText = normalizePageRangeString(pageTextRaw);
    const shortRefText = (makeShortRef(entry, pageText) || "").trim();
    const displaySourceId = displaySourceIdForContextEntry(entry, idx);
    return {
      id: displaySourceId,
      source_id: entry.sourceId || undefined,
      sourceId: entry.sourceId || undefined,
      title: entry.title,
      url: entry.url ? displayUrl(entry.url) : undefined,
      file: undefined,
      fileName: entry.fileName || undefined,
      audience: entry.audience || undefined,
      pageRange: pageText || undefined,
      authors: Array.isArray(entry.authors) && entry.authors.length ? entry.authors : undefined,
      issueLabel: entry.issueLabel || undefined,
      issueId: entry.issueId || undefined,
      journalTitle: entry.journalTitle || undefined,
      actTitle: entry.actTitle || undefined,
      act_title: entry.actTitle || undefined,
      actReference: entry.actReference || undefined,
      act_reference: entry.actReference || undefined,
      collectionId: entry.collectionId || undefined,
      collection_id: entry.collectionId || undefined,
      sourceType: entry.sourceType || undefined,
      source_type: entry.sourceType || undefined,
      authority: entry.authority || undefined,
      municipality_id: entry.municipalityId || undefined,
      municipality_name: entry.municipalityName || undefined,
      source_status: entry.sourceStatus || undefined,
      last_checked: entry.lastChecked || undefined,
      valid_from: entry.validFrom || undefined,
      valid_to: entry.validTo || undefined,
      historical: entry.historical === true ? true : undefined,
      canonical_item_id: entry.canonicalItemId || undefined,
      canonicalItemId: entry.canonicalItemId || undefined,
      item_type: entry.itemType || undefined,
      itemType: entry.itemType || undefined,
      resource_type: entry.resourceType || undefined,
      resourceType: entry.resourceType || undefined,
      sections_present: Array.isArray(entry.sectionsPresent) && entry.sectionsPresent.length ? entry.sectionsPresent : undefined,
      sectionsPresent: Array.isArray(entry.sectionsPresent) && entry.sectionsPresent.length ? entry.sectionsPresent : undefined,
      retrieval_channels: Array.isArray(entry.retrievalChannels) && entry.retrievalChannels.length ? entry.retrievalChannels : undefined,
      retrievalChannels: Array.isArray(entry.retrievalChannels) && entry.retrievalChannels.length ? entry.retrievalChannels : undefined,
      section: entry.section || undefined,
      paragraphTitle: entry.paragraphTitle || undefined,
      paragraphNumber: entry.paragraphNumber || undefined,
      subsectionNumber: entry.subsectionNumber || undefined,
      pointNumber: entry.pointNumber || undefined,
      year: entry.year || undefined,
      pages: pageNumbers.length ? pageNumbers : undefined,
      short_ref: shortRefText || undefined,
      evidenceText: Array.isArray(entry.bodies) ? entry.bodies.join("\n") : undefined
    };
  });

  let sources;
  if (preferRagForSourceLookup) {
    sources = ragSources;
  } else if (docSources.length && combineSources) {
    sources = [...docSources, ...ragSources];
  } else if (docSources.length) {
    sources = docSources;
  } else {
    sources = ragSources;
  }

  if (packageAwareAnsweringUsed) {
    const packageDisplaySources = packageDisplayedSourcesFromPackages(
      sourcePackages,
      packageAwareContext.packageDisplayedSourceIds
    );
    const packageDisplayIds = new Set(
      packageAwareContext.packageDisplayedSourceIds.map(value => String(value || "").trim()).filter(Boolean)
    );
    const retainedSources = sources.filter((source, index) => packageDisplayIds.has(stableSourceIdFromDisplaySource(source, index)));
    sources = mergePackageDisplayedSources(
      packageDisplaySources.length ? retainedSources : sources,
      packageDisplaySources
    );
  }

  const serviceMapKovContactSources = buildServiceMapKovContactSources(serviceMapKovContacts);
  if (serviceMapKovContactSources.length) {
    sources = [...sources, ...serviceMapKovContactSources];
  }

  const retrievedSourceIds = uniqueIds(matches.map(stableSourceIdFromRawMatch));
  const selectedContextSourceIds = uniqueIds(sources.map(stableSourceIdFromDisplaySource));
  const selectedContextDetails = budgeted.used.map((entry, idx) => ({
    source_id: displaySourceIdForContextEntry(entry, idx),
    raw_source_id: entry.sourceId || undefined,
    title: entry.title || undefined,
    section: entry.section || undefined,
    paragraph_number: entry.paragraphNumber || undefined,
    paragraph_title: entry.paragraphTitle || undefined,
    subsection_number: entry.subsectionNumber || undefined,
    body_preview: Array.isArray(entry.bodies) && entry.bodies[0]
      ? String(entry.bodies[0]).slice(0, 1000)
      : undefined,
    source_type: entry.sourceType || undefined,
    collection_id: entry.collectionId || undefined,
    canonical_item_id: entry.canonicalItemId || undefined,
    item_type: entry.itemType || undefined,
    resource_type: entry.resourceType || undefined,
    sections_present: Array.isArray(entry.sectionsPresent) && entry.sectionsPresent.length ? entry.sectionsPresent : undefined,
    municipality_id: entry.municipalityId || undefined,
    municipality_name: entry.municipalityName || undefined,
    source_status: entry.sourceStatus || undefined,
    historical: entry.historical === true ? true : undefined,
    retrieval_channels: Array.isArray(entry.retrievalChannels) && entry.retrievalChannels.length ? entry.retrievalChannels : undefined,
    hybrid_score: typeof entry.bestScore === "number" ? roundTraceNumber(entry.bestScore) : undefined,
    dense_score: typeof entry.denseScore === "number" ? roundTraceNumber(entry.denseScore) : undefined,
    lexical_score: typeof entry.lexicalScore === "number" ? roundTraceNumber(entry.lexicalScore) : undefined,
    lexical_score_normalized: typeof entry.lexicalScoreNormalized === "number" ? roundTraceNumber(entry.lexicalScoreNormalized) : undefined,
    bm25_score: typeof entry.bm25Score === "number" ? roundTraceNumber(entry.bm25Score) : undefined,
    bm25_coverage: typeof entry.bm25Coverage === "number" ? roundTraceNumber(entry.bm25Coverage) : undefined,
    bm25_matches: typeof entry.bm25Matches === "number" ? entry.bm25Matches : undefined,
    bm25_query_tokens: typeof entry.bm25QueryTokens === "number" ? entry.bm25QueryTokens : undefined,
    rrf_score: typeof entry.rrfScore === "number" ? roundTraceNumber(entry.rrfScore) : undefined,
    channel_boost: typeof entry.channelBoost === "number" ? roundTraceNumber(entry.channelBoost) : undefined,
    hybrid_rank: typeof entry.hybridRank === "number" ? entry.hybridRank : undefined,
    dense_rank: typeof entry.denseRank === "number" ? entry.denseRank : undefined,
    global_dense_rank: typeof entry.globalDenseRank === "number" ? entry.globalDenseRank : undefined,
    fact_segment_dense_rank: typeof entry.factSegmentDenseRank === "number" ? entry.factSegmentDenseRank : undefined,
    lexical_rank: typeof entry.lexicalRank === "number" ? entry.lexicalRank : undefined,
    rank_score: typeof entry.rankScore === "number" ? Number(entry.rankScore.toFixed(4)) : undefined,
    topic_boost: typeof entry.topicBoost === "number" ? Number(entry.topicBoost.toFixed(4)) : undefined,
    quality_adjust: typeof entry.qualityAdjust === "number" ? Number(entry.qualityAdjust.toFixed(4)) : undefined
  }));
  const hybridRetrieval = summarizeHybridRetrieval(matches);
  const insufficientPreciseLegalSourceSupport = !!(
    legalLookupPlan?.enabled &&
    legalLookupPlan.mode === "explicit_paragraph" &&
    legalSelection.insufficientPreciseLegalSourceSupport
  );
  const evidencePackage = shouldBuildEvidencePackage({
    queryPlan,
    legalLookupPlan,
    packageAwareAnsweringUsed,
    usedDocContext
  })
    ? buildEvidencePackage({
        queryPlan,
        selectedEntries: budgeted.used,
        selectedSources: sources,
        ragRiskPolicy,
        overviewSynthesis: overviewSelection?.metadata || null
      })
    : null;

  if (shouldRunRag && !isCrisis) {
    extraSystemInstructions.push(buildEvidencePreservationInstruction(replyLang));
    extraSystemInstructions.push(
      "STRICT_CORPUS_BOUNDARY: Faktivastus peab tuginema ainult RAG_CONTEXT-is olevale otseselt asjakohasele materjalile. Kui kontekst puudub või käsitleb teist riiki, omavalitsust, teenust või teemat, ära lisa mudeli üldteadmisi faktidena. Ütle lühidalt, et kasutatud korpus ei kinnita vastust, ning nimeta ainult see lisainfo või ametlik allikas, mida oleks vastamiseks vaja."
    );
  }

  if (evidencePackage) {
    extraSystemInstructions.push(buildEvidencePackageInstruction(evidencePackage));
  }

  return {
    previousSourceUseRequest,
    sourceLookupRequest,
    extraSystemInstructions,
    effectiveContext,
    grounding,
    sources,
    retrievalMeta: {
      ragAttempted: shouldRunRag,
      ragSearchFailed,
      rawMatchesCount: matches.length,
      retrievedSourceIds,
      selectedContextSourceIds,
      selectedContextDetails,
      selectedContextCount: sources.length,
      retrieversUsed,
      hybridRetrieval,
      sourcePackages,
      municipalityContext: effectiveMunicipalities.map((item) => ({
        slug: item.slug,
        id: item.id,
        municipalityId: item.municipalityId,
        baseName: item.baseName,
        type: item.type,
        displayName: item.displayName,
        matchedTerm: item.matchedTerm,
        matchSource: item.matchSource
      })),
      serviceMapKovContactCount: serviceMapKovContacts.length,
      packageAwareAnswering: {
        used: packageAwareAnsweringUsed,
        usedPackageIds: packageAwareAnsweringUsed ? packageAwareContext.usedPackageIds : [],
        missingSectionsUsed: packageAwareAnsweringUsed ? packageAwareContext.missingSectionsUsed : [],
        packageDisplayedSourceIds: packageAwareAnsweringUsed ? packageAwareContext.packageDisplayedSourceIds : [],
        packageAnswerFlags: packageAwareContext.packageAnswerFlags || [],
        packageSelectionStatus: packageAwareContext.packageSelectionStatus,
        serviceAnchors: packageAwareContext.serviceAnchors || [],
        insufficientPreciseSupport: packageAwareContext.insufficientPreciseSupport === true,
        requiredEvidenceSections: packageAwareContext.requiredEvidenceSections || []
      },
      sectionAttribution,
      ragRiskPolicy,
      legalLookupPlan,
      insufficientPreciseLegalSourceSupport,
      numericFactEvidence: {
        enabled: numericFactEvidence.enabled,
        sufficient: numericFactEvidence.sufficient,
        expectedCount: numericFactEvidence.expectedCount,
        evidenceCount: numericFactEvidence.evidenceCount
      },
      overviewSynthesis: overviewSelection?.metadata || null,
      evidencePackage,
      queryPlan,
      hadDocContext: usedDocContext,
      sourceCount:
        Number(chosen.length || 0) +
        Number(usedDocContext ? docContextResult.usedChunks || 0 : 0) +
        Number(serviceMapKovContacts.length || 0)
    }
  };
}
