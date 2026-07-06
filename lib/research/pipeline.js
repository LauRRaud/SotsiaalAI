import path from "node:path";
import { normalizeRole } from "@/lib/authz";
import { logEvent } from "@/lib/chat/logger";
import { DEFAULT_MODEL, RAG_BASE } from "@/lib/chat/settings";
import { persistAppend, persistDone, persistInit } from "@/lib/chat/persistence";
import {
  cancelResearchJob,
  isResearchCancelled,
  markResearchDone,
  markResearchFailed,
  markResearchRunning,
  publishResearchProgress,
  syncResearchCancellation,
} from "@/lib/research/jobStore";
import { resolveResearchConfig } from "@/lib/research/settings";
import { RAG_SERVICE_KEY } from "@/lib/server/ragAuth";
import { logOpenAIUsage } from "@/lib/openaiUsage";

function nowMs() {
  return Date.now();
}

function toLocale(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "ru") return "ru";
  if (raw === "en") return "en";
  return "et";
}

function toGeoLevel(rawLevel) {
  const value = String(rawLevel || "").trim().toUpperCase();
  if (value === "NATIONAL") return "NATIONAL";
  if (value === "MUNICIPALITY") return "MUNICIPALITY";
  if (value === "DISTRICT") return "DISTRICT";
  return "ALL";
}

function sanitizeText(value, maxChars = 1200) {
  const raw = String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!raw) return "";
  if (raw.length <= maxChars) return raw;
  return `${raw.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

function getRemainingBudgetMs(deadlineMs, reserveMs = 1500) {
  const remaining = Number(deadlineMs) - nowMs() - Math.max(0, Number(reserveMs) || 0);
  if (!Number.isFinite(remaining) || remaining <= 0) return 0;
  return Math.max(1000, Math.trunc(remaining));
}

function getResearchLocaleCopy(locale) {
  if (locale === "ru") {
    return {
      retrievalPartialFailure:
        "Часть поисков по источникам завершилась с ошибкой, поэтому отчёт может опираться на более узкий набор материалов.",
      districtExpanded:
        "Доказательств на уровне района было мало; область поиска расширили до уровня муниципалитета.",
      nationalExpanded:
        "Локальных доказательств было мало; область поиска расширили до национального уровня.",
      noEvidenceSummary:
        "По выбранной теме и области поиска не удалось найти достаточно документальных подтверждений для подготовки отчёта.",
      noEvidenceGap:
        "В базе документов не нашлось достаточно надёжных ссылок, чтобы сделать доказательный вывод по этому запросу.",
      noEvidenceNextAction:
        "Уточните тему, регион или название услуги, чтобы сузить поиск и повысить точность результатов.",
    };
  }
  if (locale === "en") {
    return {
      retrievalPartialFailure:
        "Some evidence searches failed, so the report may rely on a narrower source base than usual.",
      districtExpanded:
        "District-level evidence was limited, so the search scope was expanded to municipality level.",
      nationalExpanded:
        "Local evidence was limited, so the search scope was expanded to national level.",
      noEvidenceSummary:
        "The selected topic and scope did not return enough documentary evidence to build a report.",
      noEvidenceGap:
        "The document base did not contain enough reliable references for an evidence-based summary of this request.",
      noEvidenceNextAction:
        "Narrow the topic, region, or service name so deep research can search a more precise source set.",
    };
  }
  return {
    retrievalPartialFailure:
      "Mõned otsingud ebaõnnestusid, seega võib raport tugineda tavapärasest kitsamale allikabaasile.",
    districtExpanded:
      "Piirkondlikke (linnaosa) tõendeid oli vähe; ulatust laiendati KOV tasemele.",
    nationalExpanded:
      "Kohalikke tõendeid oli vähe; ulatust laiendati riiklikule tasemele.",
    noEvidenceSummary:
      "Valitud teema ja ulatuse kohta ei leitud dokumentidest piisavaid tõendeid raporti koostamiseks.",
    noEvidenceGap:
      "Dokumendibaasist ei leitud piisavalt usaldusväärseid viiteid selle küsimuse tõenduspõhiseks kokkuvõtteks.",
    noEvidenceNextAction:
      "Täpsusta teemat, piirkonda või teenuse nimetust, et süvauuring saaks otsida kitsamast allikahulgast.",
  };
}

function parseJsonLoose(text, fallback = null) {
  const raw = String(text || "").trim();
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {}
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {}
  }
  return fallback;
}

function mapWithConcurrency(items, concurrency, worker) {
  const list = Array.isArray(items) ? items : [];
  const limit = Math.max(1, Number(concurrency) || 1);
  const out = new Array(list.length);
  let cursor = 0;
  const runners = new Array(Math.min(limit, list.length)).fill(0).map(async () => {
    while (cursor < list.length) {
      const index = cursor++;
      out[index] = await worker(list[index], index);
    }
  });
  return Promise.all(runners).then(() => out);
}

async function throwIfCancelled(job) {
  if (isResearchCancelled(job) || await syncResearchCancellation(job)) {
    const err = new Error("research.error.cancelled");
    err.code = "RESEARCH_CANCELLED";
    throw err;
  }
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const err = new Error("research.error.cancelled");
    err.code = "RESEARCH_CANCELLED";
    throw err;
  }
}

function makeResearchError(code, message = code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function fetchRagSearch({
  query,
  topK,
  where,
  timeoutMs,
  signal,
  observabilityRoute = "api/research/jobs",
  observabilityStage = "research_retrieval",
  userId = null,
  role = null,
  conversationId = null,
  researchJobId = null
}) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, Math.max(1000, Number(timeoutMs) || 10_000));
  if (signal) {
    if (signal.aborted) controller.abort();
    signal.addEventListener(
      "abort",
      () => {
        try {
          controller.abort();
        } catch {}
      },
      { once: true }
    );
  }
  try {
    const response = await fetch(`${RAG_BASE}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(observabilityRoute ? { "X-Observability-Route": observabilityRoute } : {}),
        ...(observabilityStage ? { "X-Observability-Stage": observabilityStage } : {}),
        ...(userId ? { "X-Observability-User-Id": String(userId) } : {}),
        ...(role ? { "X-Observability-Role": String(role) } : {}),
        ...(conversationId ? { "X-Observability-Conversation-Id": String(conversationId) } : {}),
        ...(researchJobId ? { "X-Observability-Research-Job-Id": String(researchJobId) } : {}),
        ...(RAG_SERVICE_KEY ? { "X-API-Key": RAG_SERVICE_KEY } : {}),
      },
      body: JSON.stringify({
        query,
        top_k: topK,
        where: where || undefined,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    const raw = await response.text().catch(() => "");
    const parsed = parseJsonLoose(raw, {});
    if (!response.ok) {
      return {
        ok: false,
        status: Number(response.status) || 500,
        error: `http_${Number(response.status) || 500}`,
        results: [],
      };
    }
    return {
      ok: true,
      status: Number(response.status) || 200,
      error: null,
      results: Array.isArray(parsed?.results) ? parsed.results : [],
    };
  } catch (error) {
    if (signal?.aborted) throw makeResearchError("RESEARCH_CANCELLED", "research.error.cancelled");
    return {
      ok: false,
      status: null,
      error: timedOut ? "timeout" : String(error?.name || "network_error"),
      results: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

function compactForPrompt(value, max = 3500) {
  const text = sanitizeText(value, max + 20);
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

function buildPlannerFallback(query, config) {
  const cleaned = sanitizeText(query, 260);
  return {
    subquestions: [
      {
        id: "Q1",
        question: cleaned || "Põhiküsimus",
        search_queries: [cleaned].filter(Boolean),
        query_terms: [cleaned].filter(Boolean),
      },
    ],
    success_criteria: ["Leia usaldusväärsed allikad ja vasta ainult tõendatud väidetega."],
    max_evidence_per_q: Math.min(3, config.maxSnippets),
    max_total_evidence: config.maxSnippets,
  };
}

function normalizePlanner(raw, query, config) {
  const fallback = buildPlannerFallback(query, config);
  if (!raw || typeof raw !== "object") return fallback;

  const maxSub = Math.max(1, config.maxSubquestions);
  const maxEvidencePerQ = Math.max(1, Math.min(5, Number(raw.max_evidence_per_q) || 2));
  const maxTotalEvidence = Math.max(
    2,
    Math.min(config.maxSnippets, Number(raw.max_total_evidence) || config.maxSnippets)
  );

  const subquestions = Array.isArray(raw.subquestions)
    ? raw.subquestions
        .map((item, index) => {
          const question = sanitizeText(item?.question || item?.q || "", 220);
          if (!question) return null;
          const searchQueries = Array.isArray(item?.search_queries)
            ? item.search_queries.map(v => sanitizeText(v, 220)).filter(Boolean)
            : [];
          const queryTerms = Array.isArray(item?.query_terms)
            ? item.query_terms.map(v => sanitizeText(v, 160)).filter(Boolean)
            : [];
          return {
            id: sanitizeText(item?.id || `Q${index + 1}`, 16) || `Q${index + 1}`,
            question,
            search_queries: searchQueries,
            query_terms: queryTerms.length ? queryTerms : [question],
          };
        })
        .filter(Boolean)
        .slice(0, maxSub)
    : [];

  const successCriteria = Array.isArray(raw.success_criteria)
    ? raw.success_criteria.map(v => sanitizeText(v, 200)).filter(Boolean).slice(0, 6)
    : [];

  return {
    subquestions: subquestions.length ? subquestions : fallback.subquestions,
    success_criteria: successCriteria.length ? successCriteria : fallback.success_criteria,
    max_evidence_per_q: maxEvidencePerQ,
    max_total_evidence: maxTotalEvidence,
  };
}

function normalizeRetrievalQueryText(value, maxChars = 260) {
  return sanitizeText(value, maxChars).replace(/\s+/g, " ").trim();
}

function uniqueNormalizedTexts(values, maxItems) {
  const seen = new Set();
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = normalizeRetrievalQueryText(value);
    if (!text) continue;
    const key = text.toLocaleLowerCase("et");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}

function countQueryWords(value) {
  return normalizeRetrievalQueryText(value)
    .split(/\s+/)
    .map(part => part.trim())
    .filter(Boolean).length;
}

function isWeakRetrievalQuery(value) {
  const text = normalizeRetrievalQueryText(value);
  if (!text) return true;
  return countQueryWords(text) < 2;
}

function buildCompositeRetrievalQuery(subquestion) {
  const question = normalizeRetrievalQueryText(subquestion?.question);
  const terms = uniqueNormalizedTexts(subquestion?.query_terms, 6);
  if (!question) return terms.join(" ");

  const questionLower = question.toLocaleLowerCase("et");
  const supportingTerms = terms.filter(term => !questionLower.includes(term.toLocaleLowerCase("et")));
  return normalizeRetrievalQueryText([question, supportingTerms.join(" ")].filter(Boolean).join(" "));
}

function buildRetrievalQueries(subquestion, maxQueries) {
  const maxItems = Math.max(1, Number(maxQueries) || 1);
  const question = normalizeRetrievalQueryText(subquestion?.question);
  const composite = buildCompositeRetrievalQuery(subquestion);
  const terms = uniqueNormalizedTexts(subquestion?.query_terms, 6);
  const termPhrase = normalizeRetrievalQueryText(terms.join(" "));
  const expandedSearchQueries = uniqueNormalizedTexts(subquestion?.search_queries, 4).map(query => {
    if (!isWeakRetrievalQuery(query)) return query;
    return normalizeRetrievalQueryText([question, query, termPhrase].filter(Boolean).join(" "));
  });

  return uniqueNormalizedTexts(
    [
      ...expandedSearchQueries,
      composite,
      question,
      isWeakRetrievalQuery(termPhrase) ? "" : termPhrase,
    ],
    maxItems
  );
}

function evidenceFromResult(result, snippetMaxChars) {
  if (!result || typeof result !== "object") return null;
  const chunk = sanitizeText(result.chunk || result.text || "", snippetMaxChars);
  if (!chunk) return null;
  const sourcePath = result.url || result.source_path || result.fileName || "";
  return {
    chunkId: String(result.id || "").trim() || null,
    docId: String(result.docId || result.doc_id || "").trim() || null,
    articleId: String(result.articleId || "").trim() || null,
    title: sanitizeText(result.title || "", 180) || null,
    year: Number.isFinite(Number(result.year)) ? Number(result.year) : null,
    issueLabel: sanitizeText(result.issueLabel || result.issue || "", 40) || null,
    section: sanitizeText(result.section || "", 80) || null,
    source_path: sanitizeText(sourcePath, 300) || null,
    pageRange: sanitizeText(result.pageRange || result.pages || "", 60) || null,
    snippet: chunk,
    distance: Number.isFinite(Number(result.distance)) ? Number(result.distance) : null,
  };
}

function normalizeEvidenceKeyPart(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("et")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function evidenceIdentityKey(item) {
  if (!item || typeof item !== "object") return "";
  const title = normalizeEvidenceKeyPart(item.title);
  const doc = normalizeEvidenceKeyPart(item.articleId || item.docId || item.source_path || title);
  const page = normalizeEvidenceKeyPart(item.pageRange);
  const section = normalizeEvidenceKeyPart(item.section);

  if ((doc || title) && (page || section)) {
    return ["docpage", doc || title, title, section, page].filter(Boolean).join(":");
  }
  if (item.chunkId) return `chunk:${String(item.chunkId).trim()}`;

  const snippet = normalizeEvidenceKeyPart(item.snippet).slice(0, 180);
  return snippet ? `snippet:${snippet}` : "";
}

function selectEvidenceWithDiversity(items, maxItems, docCap) {
  const list = Array.isArray(items) ? items : [];
  const byDistance = [...list].sort((a, b) => {
    const ad = Number.isFinite(a?.distance) ? a.distance : 10_000;
    const bd = Number.isFinite(b?.distance) ? b.distance : 10_000;
    return ad - bd;
  });
  const picked = [];
  const perDoc = new Map();
  for (const item of byDistance) {
    if (picked.length >= maxItems) break;
    const docId = item?.docId || item?.articleId || item?.title || item?.chunkId || "__unknown";
    const used = perDoc.get(docId) || 0;
    if (used >= docCap) continue;
    picked.push(item);
    perDoc.set(docId, used + 1);
  }
  return picked;
}

function buildAudienceWhere(outputStyle) {
  return outputStyle === "SOCIAL_WORKER"
    ? { audience: { $in: ["SOCIAL_WORKER", "BOTH"] } }
    : { audience: { $in: ["CLIENT", "BOTH"] } };
}

function geoVariants(geo) {
  const level = toGeoLevel(geo?.level);
  if (level === "DISTRICT") return ["DISTRICT", "MUNICIPALITY", "NATIONAL"];
  if (level === "MUNICIPALITY") return ["MUNICIPALITY", "NATIONAL"];
  if (level === "NATIONAL") return ["NATIONAL"];
  return ["ALL"];
}

function buildWhereForGeo({ outputStyle, collectionIds, geo, variant }) {
  const where = {
    ...buildAudienceWhere(outputStyle),
  };
  const collectionId = Array.isArray(collectionIds) ? String(collectionIds[0] || "").trim() : "";
  if (collectionId) where.collection_id = collectionId;

  if (variant === "NATIONAL") {
    where.jurisdiction_level = { $in: ["NATIONAL"] };
    return where;
  }

  if (variant === "MUNICIPALITY") {
    const municipalityId = String(geo?.municipality_id || "").trim();
    const municipalityName = String(geo?.municipality_name || "").trim();
    if (municipalityId) where.municipality_id = municipalityId;
    else if (municipalityName) where.municipality_name = municipalityName;
    where.jurisdiction_level = { $in: ["MUNICIPALITY", "CITY_GOVERNMENT"] };
    return where;
  }

  if (variant === "DISTRICT") {
    const districtId = String(geo?.district_id || "").trim();
    const districtName = String(geo?.district_name || "").trim();
    const municipalityId = String(geo?.municipality_id || "").trim();
    const municipalityName = String(geo?.municipality_name || "").trim();
    if (districtId) where.district_id = districtId;
    else if (districtName) where.district_name = districtName;
    if (municipalityId) where.municipality_id = municipalityId;
    else if (municipalityName) where.municipality_name = municipalityName;
    where.jurisdiction_level = { $in: ["DISTRICT", "MUNICIPALITY", "CITY_GOVERNMENT"] };
    return where;
  }

  return where;
}

function normalizeResearchOutput(raw, evidence) {
  const data = raw && typeof raw === "object" ? raw : {};
  const evidenceIds = new Set((Array.isArray(evidence) ? evidence : []).map(item => item.id));
  const cleanReportText = (value, maxChars) =>
    sanitizeText(value, maxChars)
      .replace(/\bEitatud materjal\b/gi, "Leitud materjal")
      .replace(/\bavailable material\b/gi, "available evidence")
      .replace(/\bprovided material\b/gi, "retrieved evidence")
      .trim();
  const isAssistantOffer = value =>
    /^(kui soovid|soovi korral saan|saan koostada|if you want|i can|при желании|если хотите)/i.test(
      String(value || "").trim()
    );
  const normalized = {
    summary: [],
    findings: [],
    gaps: [],
    next_actions: [],
    evidence: Array.isArray(evidence) ? evidence : [],
  };

  normalized.summary = Array.isArray(data.summary)
    ? data.summary.map(v => cleanReportText(v, 260)).filter(Boolean).slice(0, 6)
    : [];
  normalized.gaps = Array.isArray(data.gaps)
    ? data.gaps.map(v => cleanReportText(v, 260)).filter(Boolean).slice(0, 10)
    : [];
  normalized.next_actions = Array.isArray(data.next_actions)
    ? data.next_actions
        .map(v => cleanReportText(v, 260))
        .filter(v => v && !isAssistantOffer(v))
        .slice(0, 8)
    : [];

  const findings = Array.isArray(data.findings) ? data.findings : [];
  for (const item of findings) {
    const claim = cleanReportText(item?.claim || "", 320);
    if (!claim) continue;
    const refs = Array.isArray(item?.evidence_refs)
      ? Array.from(
          new Set(
            item.evidence_refs.map(v => String(v || "").trim()).filter(v => v && evidenceIds.has(v))
          )
        )
      : [];
    const confidenceRaw = String(item?.confidence || "").trim().toLowerCase();
    const confidence = confidenceRaw === "high" || confidenceRaw === "low" ? confidenceRaw : "medium";
    if (!refs.length) {
      normalized.gaps.push(`${claim} (insufficient evidence)`);
      continue;
    }
    normalized.findings.push({
      claim,
      evidence_refs: refs,
      confidence,
    });
  }

  if (!normalized.summary.length && normalized.findings.length) {
    normalized.summary = normalized.findings.slice(0, 2).map(item => item.claim);
  }
  if (!normalized.next_actions.length) {
    normalized.next_actions = ["Täpsusta vajadusel teema ulatust või piirkonda, et saada täpsemad viited."];
  }

  return normalized;
}

function formatConfidence(confidence, locale) {
  if (locale === "en") {
    if (confidence === "high") return "high";
    if (confidence === "low") return "low";
    return "medium";
  }
  if (locale === "ru") {
    if (confidence === "high") return "высокая";
    if (confidence === "low") return "низкая";
    return "средняя";
  }
  if (confidence === "high") return "kõrge";
  if (confidence === "low") return "madal";
  return "keskmine";
}

function renderReportText(report, locale, targetStyle) {
  const i18n =
    locale === "en"
      ? {
          title: "Deep Research",
          targetPrefix: "Formatted for",
          summary: "Summary",
          findings: "Findings",
          gaps: "Unverified or missing",
          next: "Next actions",
          confidence: "confidence",
          targetWorker: "social work specialist",
          targetClient: "help-seeker",
        }
      : locale === "ru"
        ? {
            title: "Глубокое исследование",
            targetPrefix: "Формат для",
            summary: "Кратко",
            findings: "Ключевые выводы",
            gaps: "Что не подтверждено",
            next: "Следующие шаги",
            confidence: "уверенность",
            targetWorker: "специалиста по социальной работе",
            targetClient: "обращающегося за поддержкой",
          }
        : {
            title: "Süvauuring",
            targetPrefix: "Vormistus",
            summary: "Kokkuvõte",
            findings: "Põhipunktid",
            gaps: "Mis jäi tõendamata",
            next: "Järgmised sammud",
            confidence: "kindlus",
            targetWorker: "sotsiaaltöö spetsialistile",
            targetClient: "eluküsimusega pöördujale",
          };

  const target = targetStyle === "SOCIAL_WORKER" ? i18n.targetWorker : i18n.targetClient;
  const lines = [`${i18n.title}`, `${i18n.targetPrefix}: ${target}`, "", `${i18n.summary}`];
  const evidenceIndexById = new Map(
    (Array.isArray(report.evidence) ? report.evidence : [])
      .map((ev, index) => [String(ev?.id || "").trim(), String(index + 1)])
      .filter(([id]) => id)
  );

  for (const item of report.summary) lines.push(`- ${item}`);

  lines.push("", `${i18n.findings}`);
  if (!report.findings.length) {
    lines.push("-");
  } else {
    for (const finding of report.findings) {
      const refs = Array.isArray(finding.evidence_refs)
        ? finding.evidence_refs
            .map(ref => evidenceIndexById.get(String(ref || "").trim()))
            .filter(Boolean)
        : [];
      const refPart = refs.length ? ` [${Array.from(new Set(refs)).join(", ")}]` : "";
      lines.push(`- ${finding.claim}${refPart} (${i18n.confidence}: ${formatConfidence(finding.confidence, locale)})`);
    }
  }

  lines.push("", `${i18n.gaps}`);
  for (const item of report.gaps.length ? report.gaps : ["-"]) lines.push(item === "-" ? item : `- ${item}`);

  lines.push("", `${i18n.next}`);
  for (const item of report.next_actions) lines.push(`- ${item}`);
  return lines.join("\n").trim();
}

function toConversationSources(evidence) {
  if (!Array.isArray(evidence)) return [];
  return evidence.map(item => {
    const sourcePath = String(item.source_path || "").trim();
    const isHttp = /^https?:\/\//i.test(sourcePath);
    return {
      id: item.id,
      title: item.title || item.docId || item.id,
      url: isHttp ? sourcePath : undefined,
      fileName: !isHttp && sourcePath ? path.basename(sourcePath) : undefined,
      section: item.section || undefined,
      authors: Array.isArray(item.authors) ? item.authors : undefined,
      journalTitle: item.journalTitle || undefined,
      year: Number.isFinite(item.year) ? item.year : undefined,
      issueLabel: item.issueLabel || undefined,
      pageRange: item.pageRange || undefined,
      evidence_ref: item.id,
      source_type: "rag",
    };
  });
}

const PLANNER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subquestions", "success_criteria", "max_evidence_per_q", "max_total_evidence"],
  properties: {
    subquestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "question", "search_queries", "query_terms"],
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          search_queries: {
            type: "array",
            items: { type: "string" },
          },
          query_terms: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
    success_criteria: {
      type: "array",
      items: { type: "string" },
    },
    max_evidence_per_q: { type: "integer" },
    max_total_evidence: { type: "integer" },
  },
};

const RESEARCH_REPORT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "findings", "gaps", "next_actions"],
  properties: {
    summary: {
      type: "array",
      items: { type: "string" },
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "evidence_refs", "confidence"],
        properties: {
          claim: { type: "string" },
          evidence_refs: {
            type: "array",
            items: { type: "string" },
          },
          confidence: {
            type: "string",
            enum: ["low", "medium", "high"],
          },
        },
      },
    },
    gaps: {
      type: "array",
      items: { type: "string" },
    },
    next_actions: {
      type: "array",
      items: { type: "string" },
    },
  },
};

async function callJsonModel({
  systemPrompt,
  userPrompt,
  maxOutputTokens,
  signal,
  timeoutMs,
  route = "api/research/jobs",
  stage,
  userId = null,
  role = null,
  jsonSchema = null,
  verbosity = "low"
}) {
  let OpenAI;
  try {
    ({ default: OpenAI } = await import("openai"));
  } catch (err) {
    throw new Error(err?.message || "research.error.openai_missing");
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("research.error.openai_key_missing");
  const client = new OpenAI({ apiKey });
  const model = DEFAULT_MODEL;
  const startedAt = Date.now();
  const textConfig = {
    verbosity: verbosity === "medium" || verbosity === "high" ? verbosity : "low",
  };
  if (jsonSchema?.name && jsonSchema?.schema) {
    textConfig.format = {
      type: "json_schema",
      name: jsonSchema.name,
      description: jsonSchema.description || undefined,
      schema: jsonSchema.schema,
      strict: true,
    };
  }
  throwIfAborted(signal);
  let response;
  try {
    response = await client.responses.create(
      {
        model,
        max_output_tokens: maxOutputTokens,
        text: textConfig,
        reasoning: {
          effort: "low"
        },
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: userPrompt }],
          },
        ],
      },
      {
        timeout: Math.max(1000, Number(timeoutMs) || 60_000),
        maxRetries: 0,
        fetchOptions: signal ? { signal } : undefined,
      }
    );
  } catch (error) {
    if (signal?.aborted) throw makeResearchError("RESEARCH_CANCELLED", "research.error.cancelled");
    const errorName = String(error?.name || "");
    const errorCode = String(error?.code || "");
    if (errorName === "AbortError" || errorCode === "ETIMEDOUT" || errorCode === "ECONNABORTED") {
      throw makeResearchError("RESEARCH_TIMEOUT", "research.error.timeout");
    }
    throw error;
  }
  await logOpenAIUsage({
    response,
    model,
    route,
    stage,
    latencyMs: Date.now() - startedAt,
    userId,
    role
  });
  const text = String(response?.output_text || "").trim();
  const outputTokens = Number(response?.usage?.output_tokens || 0) || 0;
  return { text, outputTokens };
}

async function runPlanner({ query, locale, config, payload, signal, timeoutMs }) {
  const localeHint = locale === "en" ? "English" : locale === "ru" ? "Russian" : "Estonian";
  const systemPrompt =
    "You are a research planner. Return strict JSON only. Do not include markdown or prose.";
  const userPrompt = `Create a compact research plan for a RAG-only deep research request.
Language: ${localeHint}
Output style target: ${payload.output_style}
Profile: ${config.profile}
Max subquestions: ${config.maxSubquestions}
Allowed fields:
{
  "subquestions":[{"id":"Q1","question":"...","search_queries":["full phrase or sentence for vector search"],"query_terms":["supporting term or phrase"]}],
  "success_criteria":["..."],
  "max_evidence_per_q":2,
  "max_total_evidence":${config.maxSnippets}
}
Rules:
- keep 2..${config.maxSubquestions} subquestions unless query is very narrow.
- search_queries must be complete search phrases with the main nouns from the question; never use isolated one-word queries.
- query_terms are optional supporting phrases, not the primary search query.
- JSON only.

Query:
${compactForPrompt(query, 1200)}`;
  const modelResult = await callJsonModel({
    systemPrompt,
    userPrompt,
    maxOutputTokens: Math.min(900, config.maxOutputTokens),
    signal,
    timeoutMs,
    stage: "research_planner",
    userId: payload?.userId || null,
    role: payload?.userRole || null,
    jsonSchema: {
      name: "research_planner",
      description: "A compact RAG research plan with full search phrases.",
      schema: PLANNER_JSON_SCHEMA,
    }
  });
  const parsed = parseJsonLoose(modelResult.text, null);
  return {
    planner: normalizePlanner(parsed, query, config),
    tokens: modelResult.outputTokens,
  };
}

async function retrieveEvidence({ job, planner, payload, config, signal, deadlineMs, locale }) {
  const variants = geoVariants(payload.geo);
  const copy = getResearchLocaleCopy(locale);
  const retrievalGaps = [];
  let selectedVariant = variants[0];
  let selectedEvidence = [];
  let requestCount = 0;
  let failedRequestCount = 0;

  for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
    const variant = variants[variantIndex];
    const where = buildWhereForGeo({
      outputStyle: payload.output_style,
      collectionIds: payload.collection_ids,
      geo: payload.geo,
      variant,
    });
    const perQuestion = await mapWithConcurrency(
      planner.subquestions,
      config.retrievalConcurrency,
      async subquestion => {
        const queries = buildRetrievalQueries(subquestion, config.queriesPerSubquestion);

        const allResults = [];
        for (const q of queries) {
          throwIfAborted(signal);
          requestCount += 1;
          const searchResult = await fetchRagSearch({
            query: q,
            topK: config.ragTopK,
            where,
            timeoutMs: Math.min(
              config.ragTimeoutMs,
              Math.max(1000, getRemainingBudgetMs(deadlineMs, 1200))
            ),
            signal,
            observabilityRoute: "api/research/jobs",
            observabilityStage: "research_retrieval",
            userId: payload.userId || null,
            role: normalizeRole(payload.userRole || payload.output_style || "CLIENT"),
            conversationId: payload.convId || null,
            researchJobId: job?.id || null,
          });
          if (!searchResult.ok) {
            failedRequestCount += 1;
            continue;
          }
          allResults.push(...searchResult.results);
        }
        const dedup = new Map();
        for (const hit of allResults) {
          const ev = evidenceFromResult(hit, config.maxCharsPerSnippet);
          if (!ev) continue;
          const key = evidenceIdentityKey(ev) || `${ev.docId || "doc"}:${ev.snippet.slice(0, 80)}`;
          if (!dedup.has(key)) dedup.set(key, ev);
        }
        return selectEvidenceWithDiversity(
          Array.from(dedup.values()),
          planner.max_evidence_per_q,
          config.docDiversityCap
        );
      }
    );

    const merged = [];
    const mergedSeen = new Set();
    for (const list of perQuestion) {
      for (const item of Array.isArray(list) ? list : []) {
        const key = evidenceIdentityKey(item) || `${item.docId || "doc"}:${item.snippet.slice(0, 80)}`;
        if (mergedSeen.has(key)) continue;
        mergedSeen.add(key);
        merged.push(item);
      }
    }
    selectedEvidence = selectEvidenceWithDiversity(
      merged,
      Math.min(config.maxSnippets, planner.max_total_evidence),
      config.docDiversityCap
    );
    selectedVariant = variant;
    const enough = selectedEvidence.length >= Math.min(4, config.maxSnippets);
    if (enough || variantIndex === variants.length - 1) break;
    const nextVariant = variants[variantIndex + 1];
    if (nextVariant) {
      if (variant === "DISTRICT" && nextVariant === "MUNICIPALITY") {
        retrievalGaps.push(copy.districtExpanded);
      } else if (nextVariant === "NATIONAL") {
        retrievalGaps.push(copy.nationalExpanded);
      }
    }
  }

  if (requestCount > 0 && failedRequestCount >= requestCount) {
    throw makeResearchError("RESEARCH_RETRIEVAL_UNAVAILABLE", "research.error.retrieval_unavailable");
  }
  if (failedRequestCount > 0) {
    retrievalGaps.push(copy.retrievalPartialFailure);
  }

  const evidence = selectedEvidence.map((item, index) => ({
    id: `E${index + 1}`,
    docId: item.docId || "",
    articleId: item.articleId || "",
    chunkId: item.chunkId || "",
    title: item.title || "",
    authors: Array.isArray(item.authors) ? item.authors : [],
    year: item.year,
    journalTitle: item.journalTitle || "",
    issueLabel: item.issueLabel || "",
    section: item.section || "",
    source_path: item.source_path || "",
    pageRange: item.pageRange || "",
    snippet: sanitizeText(item.snippet, config.maxCharsPerSnippet),
  }));

  return {
    evidence,
    retrievalGaps,
    variantUsed: selectedVariant,
    requestCount,
    failedRequestCount,
  };
}

async function runSynthesis({ query, payload, planner, evidence, locale, config, signal, timeoutMs }) {
  const localeHint = locale === "en" ? "English" : locale === "ru" ? "Russian" : "Estonian";
  const evidenceTable = evidence
    .map(item => {
      const title = item.title || item.docId || item.id;
      const year = Number.isFinite(item.year) ? item.year : "";
      const section = item.section || "";
      const page = item.pageRange || "";
      const header = `${item.id} | ${title} | ${year} | ${section} | ${page}`.trim();
      return `${header}\n${compactForPrompt(item.snippet, config.maxCharsPerSnippet)}`;
    })
    .join("\n\n");

  const systemPrompt =
    "You synthesize retrieved evidence into a decision-ready report. Return strict JSON only.";
  const userPrompt = `Build final report in ${localeHint}.
Output style target: ${payload.output_style}
Focus flags: ${(Array.isArray(payload.focus) && payload.focus.length ? payload.focus.join(", ") : "none")}
Success criteria: ${(planner.success_criteria || []).join(" | ")}

Return JSON only:
{
  "summary":[string],
  "findings":[{"claim":string,"evidence_refs":["E1"],"confidence":"low|medium|high"}],
  "gaps":[string],
  "next_actions":[string]
}

Rules:
- Every finding must include at least one valid evidence ref.
- Never invent refs.
- Unknown or weakly supported info must go to gaps.
- Directly answer every major part of the question. If the question asks about both services and benefits/supports, but evidence covers only one part, explicitly put the missing part in gaps.
- Do not use placeholders, empty bullets, or generic section filler.
- Do not end with offers such as "Kui soovid, saan..." / "If you want, I can..."; next_actions must be concrete professional checks or follow-up actions.
- Use natural, grammatical ${localeHint}. Do not use source-status phrases like "Eitatud materjal"; say "leitud tõendid" / "retrieved evidence" if needed.
- Keep response concise and practical, but include enough substance for the selected output style.

Question:
${compactForPrompt(query, 1300)}

Evidence:
${evidenceTable}`;

  const modelResult = await callJsonModel({
    systemPrompt,
    userPrompt,
    maxOutputTokens: config.maxOutputTokens,
    signal,
    timeoutMs,
    stage: "research_synthesizer",
    userId: payload?.userId || null,
    role: payload?.userRole || null,
    jsonSchema: {
      name: "research_report",
      description: "An evidence-backed research report with cited findings.",
      schema: RESEARCH_REPORT_JSON_SCHEMA,
    },
    verbosity: "medium"
  });
  return {
    output: parseJsonLoose(modelResult.text, null),
    tokens: modelResult.outputTokens,
  };
}

function buildNoEvidenceReport(locale, retrievalGaps = []) {
  const copy = getResearchLocaleCopy(locale);
  return {
    summary: [copy.noEvidenceSummary],
    findings: [],
    gaps: [...retrievalGaps, copy.noEvidenceGap],
    next_actions: [copy.noEvidenceNextAction],
    evidence: [],
  };
}

function buildEvidenceFallbackReport({ query, locale, evidence, retrievalGaps = [] }) {
  const selectedEvidence = Array.isArray(evidence) ? evidence.slice(0, 5) : [];
  const topic = sanitizeText(query, 180);
  const summaryText =
    locale === "en"
      ? `The report is based on ${selectedEvidence.length} retrieved evidence item(s), but the synthesis step returned too little structured content.`
      : locale === "ru"
        ? `Отчёт основан на ${selectedEvidence.length} найденных фрагментах доказательств, но этап синтеза вернул недостаточно структурированного содержания.`
        : `Raport tugineb ${selectedEvidence.length} leitud tõendifragmendile, kuid sünteesietapp tagastas liiga vähe struktureeritud sisu.`;
  const scopeGap =
    locale === "en"
      ? "Review the evidence references and narrow the question if a more specific conclusion is needed."
      : locale === "ru"
        ? "Проверьте ссылки на доказательства и при необходимости сузьте вопрос для более точного вывода."
        : "Kontrolli tõendiviiteid ja vajadusel täpsusta küsimust, kui on vaja konkreetsemat järeldust.";
  const nextAction =
    locale === "en"
      ? "Use the listed evidence as the starting point and rerun deep research with a narrower service, benefit, or municipality if needed."
      : locale === "ru"
        ? "Используйте перечисленные доказательства как отправную точку и при необходимости повторите исследование с более узкой услугой, пособием или муниципалитетом."
        : "Kasuta allolevaid tõendeid lähtekohana ja vajadusel käivita süvauuring uuesti kitsama teenuse, toetuse või KOV nimetusega.";
  const questionPrefix = locale === "en" ? "Question" : locale === "ru" ? "Вопрос" : "Küsimus";

  const findings = selectedEvidence
    .map(item => {
      const snippet = sanitizeText(item?.snippet || "", 260);
      if (!snippet || !item?.id) return null;
      return {
        claim: snippet,
        evidence_refs: [item.id],
        confidence: "medium",
      };
    })
    .filter(Boolean);

  return {
    summary: topic ? [`${summaryText} ${questionPrefix}: ${topic}`] : [summaryText],
    findings,
    gaps: [...retrievalGaps, scopeGap].filter(Boolean),
    next_actions: [nextAction],
    evidence: selectedEvidence,
  };
}

function hasSubstantiveResearchContent(report) {
  return Boolean(
    (Array.isArray(report?.summary) && report.summary.length) ||
      (Array.isArray(report?.findings) && report.findings.length)
  );
}

export async function runDeepResearchJob(job) {
  const startedAtMs = nowMs();
  const payload = job?.payload || {};
  const locale = toLocale(payload.ui_locale);
  const config = resolveResearchConfig(payload.profile);
  const timeBudgetMs = config.timeBudgetMs;
  const deadlineMs = startedAtMs + timeBudgetMs;
  const metrics = {
    profile: config.profile,
    planning_ms: 0,
    retrieval_ms: 0,
    synthesis_ms: 0,
    total_ms: 0,
    evidence_count: 0,
    gaps_count: 0,
    output_tokens: 0,
    geo_variant: null,
    retrieval_requests: 0,
    retrieval_failed_requests: 0,
    synthesis_skipped: false,
  };

  const ensureBudget = () => {
    if (nowMs() > deadlineMs) {
      const err = new Error("research.error.timeout");
      err.code = "RESEARCH_TIMEOUT";
      throw err;
    }
  };

  try {
    await markResearchRunning(job);
    await throwIfCancelled(job);

    if (payload.persist && payload.convId && payload.userId) {
      await persistInit({
        convId: payload.convId,
        userId: payload.userId,
        role: normalizeRole(payload.userRole || payload.output_style || "CLIENT"),
        userMessage: payload.query,
      });
    }

    await publishResearchProgress(job, { stage: "planning", index: 1, total: 3 });
    const planningStart = nowMs();
    const plannerResult = await runPlanner({
      query: payload.query,
      locale,
      config,
      payload,
      signal: job.abortController.signal,
      timeoutMs: getRemainingBudgetMs(deadlineMs, 1500),
    });
    metrics.planning_ms = nowMs() - planningStart;
    metrics.output_tokens += plannerResult.tokens || 0;
    ensureBudget();
    await throwIfCancelled(job);

    await publishResearchProgress(job, { stage: "retrieving", index: 2, total: 3 });
    const retrievalStart = nowMs();
    const retrievalResult = await retrieveEvidence({
      job,
      planner: plannerResult.planner,
      payload,
      config,
      signal: job.abortController.signal,
      deadlineMs,
      locale,
    });
    metrics.retrieval_ms = nowMs() - retrievalStart;
    metrics.evidence_count = retrievalResult.evidence.length;
    metrics.geo_variant = retrievalResult.variantUsed;
    metrics.retrieval_requests = retrievalResult.requestCount;
    metrics.retrieval_failed_requests = retrievalResult.failedRequestCount;
    ensureBudget();
    await throwIfCancelled(job);

    let normalized;
    if (!retrievalResult.evidence.length) {
      metrics.synthesis_skipped = true;
      normalized = buildNoEvidenceReport(locale, retrievalResult.retrievalGaps);
    } else {
      await publishResearchProgress(job, { stage: "synthesizing", index: 3, total: 3 });
      const synthStart = nowMs();
      const synthesisResult = await runSynthesis({
        query: payload.query,
        payload,
        planner: plannerResult.planner,
        evidence: retrievalResult.evidence,
        locale,
        config,
        signal: job.abortController.signal,
        timeoutMs: getRemainingBudgetMs(deadlineMs, 1200),
      });
      metrics.synthesis_ms = nowMs() - synthStart;
      metrics.output_tokens += synthesisResult.tokens || 0;

      normalized = normalizeResearchOutput(
        {
          ...(synthesisResult.output || {}),
          gaps: [...(Array.isArray(synthesisResult.output?.gaps) ? synthesisResult.output.gaps : []), ...retrievalResult.retrievalGaps],
        },
        retrievalResult.evidence
      );
      if (!hasSubstantiveResearchContent(normalized)) {
        normalized = buildEvidenceFallbackReport({
          query: payload.query,
          locale,
          evidence: retrievalResult.evidence,
          retrievalGaps: retrievalResult.retrievalGaps,
        });
      }
    }
    metrics.gaps_count = normalized.gaps.length;
    metrics.total_ms = nowMs() - startedAtMs;

    const reportText = renderReportText(normalized, locale, payload.output_style);
    const sources = toConversationSources(normalized.evidence);
    await throwIfCancelled(job);

    if (payload.persist && payload.convId && payload.userId) {
      await persistAppend({
        convId: payload.convId,
        userId: payload.userId,
        fullText: reportText,
      });
      await persistDone({
        convId: payload.convId,
        userId: payload.userId,
        status: "COMPLETED",
        finalText: reportText,
        sources,
        attachments: [],
        isCrisis: false,
      });
    }

    await logEvent("research_run", {
      userId: payload.userId,
      role: payload.output_style,
      profile: config.profile,
      totalMs: metrics.total_ms,
      planningMs: metrics.planning_ms,
      retrievalMs: metrics.retrieval_ms,
      synthesisMs: metrics.synthesis_ms,
      evidenceCount: metrics.evidence_count,
      gapsCount: metrics.gaps_count,
      outputTokens: metrics.output_tokens,
      geoVariant: metrics.geo_variant,
      queryLength: String(payload.query || "").length,
    });

    await markResearchDone(
      job,
      {
        report: normalized,
        report_text: reportText,
        sources,
      },
      metrics
    );
  } catch (error) {
    metrics.total_ms = nowMs() - startedAtMs;
    const message =
      error?.code === "RESEARCH_CANCELLED"
        ? "research.error.cancelled"
        : error?.code === "RESEARCH_TIMEOUT"
          ? "research.error.timeout"
          : String(error?.message || "research.error.failed");
    if (error?.code === "RESEARCH_CANCELLED" || isResearchCancelled(job)) {
      await cancelResearchJob(job, "research.error.cancelled");
      return;
    }
    await markResearchFailed(job, message, metrics);
  }
}
