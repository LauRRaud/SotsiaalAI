import { normalizeList, normalizeText } from "./covisionShared.js";

const MAX_QUERY_LENGTH = 1200;
const MAX_SNIPPET_LENGTH = 520;
const DEFAULT_TOP_K = 8;
const EFFECTIVE_PRACTICE_RAG_PREFIX = "effective-practice";

function compactUnique(values = [], { maxItems = 24, maxLength = 180 } = {}) {
  return normalizeList(values, { maxItems, maxLength });
}

function textFrom(...values) {
  return values
    .map((value) => normalizeText(value, 260))
    .filter(Boolean)
    .join(" ");
}

function metadataOf(entry = {}) {
  return entry?.metadata && typeof entry.metadata === "object" ? entry.metadata : {};
}

function readFirstString(...values) {
  for (const value of values) {
    const text = normalizeText(value, 500);
    if (text) return text;
  }
  return "";
}

function categoryFromResult(entry = {}) {
  const metadata = metadataOf(entry);
  const sourceText = [
    entry.source_type,
    entry.sourceType,
    entry.resource_type,
    metadata.source_type,
    metadata.resource_type,
    metadata.evidence_role,
    entry.title,
    metadata.title
  ].join(" ").toLocaleLowerCase("et");

  if (/(seadus|õigus|oigus|legal|\blaw\b|\bact\b|riigi teataja|regulation)/i.test(sourceText)) return "legal";
  if (/(praktika|practice|best_practice|kogemus|case_example)/i.test(sourceText)) return "practice";
  if (/(juhend|guide|metoodika|methodology|standard|recommendation)/i.test(sourceText)) return "guidance";
  if (/(teenus|service|toetus|benefit|kov|municipal|organization_profile)/i.test(sourceText)) return "service";
  return "other";
}

function resultTitle(entry = {}, fallback = "Allikas") {
  const metadata = metadataOf(entry);
  return readFirstString(
    entry.title,
    entry.fileName,
    entry.file_name,
    metadata.title,
    metadata.fileName,
    metadata.file_name,
    entry.doc_id,
    metadata.doc_id,
    fallback
  );
}

function resultUrl(entry = {}) {
  const metadata = metadataOf(entry);
  return readFirstString(
    entry.url,
    entry.source_url,
    entry.sourceUrl,
    metadata.url,
    metadata.source_url,
    metadata.sourceUrl
  );
}

function resultSnippet(entry = {}) {
  return readFirstString(
    entry.chunk,
    entry.text,
    entry.document,
    entry.content,
    metadataOf(entry).snippet,
    metadataOf(entry).description
  ).slice(0, MAX_SNIPPET_LENGTH);
}

export function buildCovisionKnowledgeQuery(covisionCase = {}) {
  const risks = (Array.isArray(covisionCase.riskFactors) ? covisionCase.riskFactors : [])
    .map((factor) => factor?.label)
    .filter(Boolean);
  const parties = (Array.isArray(covisionCase.parties) ? covisionCase.parties : [])
    .map((party) => party?.label || party?.type)
    .filter(Boolean);

  const parts = [
    covisionCase.centralQuestion,
    covisionCase.summary,
    covisionCase.anonymizedDescription,
    covisionCase.title,
    compactUnique(covisionCase.topics).join(", "),
    compactUnique(covisionCase.expectedHelpTypes).join(", "),
    compactUnique(risks).join(", "),
    compactUnique(parties).join(", "),
    "sotsiaaltöö seadus juhend metoodika praktika teenus toetus võrgustikutöö dokumenteerimine"
  ];

  return textFrom(...parts).slice(0, MAX_QUERY_LENGTH);
}

export function normalizeCovisionKnowledgeResults(results = []) {
  const seen = new Set();
  return (Array.isArray(results) ? results : [])
    .map((entry, index) => {
      const snippet = resultSnippet(entry);
      const explicitTitle = resultTitle(entry, "");
      if (!snippet && !explicitTitle) return null;
      const title = explicitTitle || "Allikas";
      const metadata = metadataOf(entry);
      const id = readFirstString(entry.id, entry.chunk_id, metadata.id, metadata.chunk_id, `${title}-${index}`);
      const docId = readFirstString(entry.doc_id, entry.docId, metadata.doc_id, metadata.docId);
      const key = `${docId || id}:${title}:${snippet.slice(0, 80)}`.toLocaleLowerCase("et");
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        id,
        docId,
        title,
        category: categoryFromResult(entry),
        snippet,
        url: resultUrl(entry),
        sourceType: readFirstString(entry.source_type, entry.sourceType, metadata.source_type, metadata.resource_type),
        organization: readFirstString(entry.organization, metadata.organization, metadata.publisher),
        distance: Number.isFinite(Number(entry.distance)) ? Number(entry.distance) : null
      };
    })
    .filter(Boolean)
    .slice(0, DEFAULT_TOP_K);
}

export function buildEffectivePracticeRagDocId(practice = {}) {
  const id = normalizeText(practice.id, 120);
  return id ? `${EFFECTIVE_PRACTICE_RAG_PREFIX}::${id}` : "";
}

export function buildEffectivePracticeRagText(practice = {}) {
  const sections = [
    ["Praktikanäide", practice.title],
    ["Teemad", compactUnique(practice.topics).join(", ")],
    ["Sildid", compactUnique(practice.tags).join(", ")],
    ["Olukorra üldine taust", practice.background],
    ["Peamine takistus", practice.mainChallenge],
    ["Mis aitas", practice.whatHelped],
    ["Võrgustiku või teenuse roll", practice.networkOrServiceRole],
    ["Tulemus", practice.outcome],
    ["Õppimiskohad", practice.learningPoints],
    ["Piirangud", practice.limitations],
    ["Seotud allikad või juhised", practice.sources]
  ];

  return sections
    .map(([label, value]) => {
      const text = normalizeText(value, 4000);
      return text ? `${label}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 16_000);
}

export function buildEffectivePracticeRagMetadata(practice = {}, docId = buildEffectivePracticeRagDocId(practice)) {
  return {
    doc_id: docId,
    source_type: "practice_example",
    resource_type: "practice_example",
    evidence_role: "practice_guidance",
    title: normalizeText(practice.title, 240),
    topics: compactUnique(practice.topics),
    tags: compactUnique(practice.tags, { maxItems: 32, maxLength: 80 }),
    source_covision_case_id: normalizeText(practice.sourceCovisionCaseId, 120) || null,
    author_id: normalizeText(practice.authorId, 120) || null,
    status: normalizeText(practice.status, 80) || null,
    collection_id: process.env.EFFECTIVE_PRACTICE_RAG_COLLECTION_ID || "effective_practices",
    language: "et"
  };
}

export async function fetchCovisionKnowledgeSupport(auth = {}, covisionCase = {}, options = {}) {
  const query = buildCovisionKnowledgeQuery(covisionCase);
  if (!query) {
    return { ok: true, available: true, query: "", results: [] };
  }
  if (!String(process.env.RAG_SERVICE_API_KEY || "").trim()) {
    return { ok: true, available: false, reason: "rag_key_missing", query, results: [] };
  }

  const { buildRagHeaders, ragServiceRequest } = await import("@/lib/documents/ragService");
  const payload = await ragServiceRequest(
    "/search",
    {
      method: "POST",
      headers: buildRagHeaders("application/json", {
        route: "covision",
        stage: "knowledge_search",
        userId: auth.userId,
        role: auth.role
      }),
      body: JSON.stringify({
        query,
        top_k: Math.max(1, Math.min(20, Number(options.topK) || DEFAULT_TOP_K)),
        retrievers: ["dense", "title_match", "exact_phrase", "bm25"],
        include: ["documents", "metadatas", "distances"]
      })
    },
    "covision.errors.knowledge_failed"
  );

  return {
    ok: true,
    available: true,
    query,
    results: normalizeCovisionKnowledgeResults(payload?.results)
  };
}
