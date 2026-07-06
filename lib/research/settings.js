function toInt(value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function toProfile(value) {
  const raw = String(value || "").trim().toLowerCase();
  return raw === "light" ? "light" : "standard";
}

const PROFILE_LIGHT = {
  profile: "light",
  timeBudgetMs: toInt(process.env.RESEARCH_TIME_BUDGET_LIGHT_MS, 120_000, 30_000, 900_000),
  maxSubquestions: toInt(process.env.RESEARCH_MAX_SUBQUESTIONS_LIGHT, 3, 1, 8),
  ragTopK: toInt(process.env.RESEARCH_RAG_TOP_K_LIGHT, 3, 1, 12),
  ragCtxMaxChars: toInt(process.env.RESEARCH_RAG_CTX_MAX_CHARS_LIGHT, 1800, 600, 8000),
  ragTimeoutMs: toInt(process.env.RESEARCH_RAG_TIMEOUT_MS_LIGHT, 7000, 1000, 60_000),
  maxOutputTokens: toInt(process.env.RESEARCH_MAX_OUTPUT_TOKENS_LIGHT, 1200, 200, 5000),
  maxSnippets: toInt(process.env.RESEARCH_MAX_SNIPPETS_LIGHT, 10, 2, 30),
  maxCharsPerSnippet: toInt(process.env.RESEARCH_MAX_CHARS_PER_SNIPPET_LIGHT, 500, 120, 1600),
  queriesPerSubquestion: toInt(process.env.RESEARCH_QUERIES_PER_SUBQUESTION_LIGHT, 1, 1, 3),
  retrievalConcurrency: toInt(process.env.RESEARCH_RETRIEVAL_CONCURRENCY_LIGHT, 3, 1, 8),
  docDiversityCap: toInt(process.env.RESEARCH_DOC_DIVERSITY_CAP_LIGHT, 2, 1, 6),
};

const PROFILE_STANDARD = {
  profile: "standard",
  timeBudgetMs: toInt(process.env.RESEARCH_TIME_BUDGET_MS, 300_000, 30_000, 900_000),
  maxSubquestions: toInt(process.env.RESEARCH_MAX_SUBQUESTIONS, 5, 1, 10),
  ragTopK: toInt(process.env.RESEARCH_RAG_TOP_K, 4, 1, 14),
  ragCtxMaxChars: toInt(process.env.RESEARCH_RAG_CTX_MAX_CHARS, 2800, 600, 9000),
  ragTimeoutMs: toInt(process.env.RESEARCH_RAG_TIMEOUT_MS, 10_000, 1000, 60_000),
  maxOutputTokens: toInt(process.env.RESEARCH_MAX_OUTPUT_TOKENS, 2200, 300, 6000),
  maxSnippets: toInt(process.env.RESEARCH_MAX_SNIPPETS, 14, 2, 40),
  maxCharsPerSnippet: toInt(process.env.RESEARCH_MAX_CHARS_PER_SNIPPET, 600, 120, 1800),
  queriesPerSubquestion: toInt(process.env.RESEARCH_QUERIES_PER_SUBQUESTION, 1, 1, 4),
  retrievalConcurrency: toInt(process.env.RESEARCH_RETRIEVAL_CONCURRENCY, 3, 1, 10),
  docDiversityCap: toInt(process.env.RESEARCH_DOC_DIVERSITY_CAP, 3, 1, 8),
};

export function resolveResearchConfig(rawProfile) {
  return toProfile(rawProfile) === "light" ? PROFILE_LIGHT : PROFILE_STANDARD;
}
