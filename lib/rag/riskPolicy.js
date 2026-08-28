const LEGAL_FINANCIAL_INTENTS = new Set(["legal_exact"]);
const ACTIONABLE_INTENTS = new Set(["kov_service_or_benefit", "life_situation_guidance"]);

const SOURCE_POLICY = {
  low: {
    requiredEvidence: "medium",
    preferredSourceTypes: ["journal_article", "methodology_guide", "practice_example", "state_guide"],
    insufficientEvidenceMode: false
  },
  medium: {
    requiredEvidence: "strong",
    preferredSourceTypes: [
      "municipality_kov",
      "municipality_service",
      "kov_service_info",
      "kov_service",
      "kov_web",
      "municipality_web",
      "application_form",
      "web_form",
      "pdf_form",
      "official_contact",
      "service_map_contact",
      "service_map_contact_monitor",
      "contact_page",
      "state_guide"
    ],
    insufficientEvidenceMode: true
  },
  high: {
    requiredEvidence: "strong",
    preferredSourceTypes: [
      "national_law",
      "kov_regulation",
      "municipal_regulation",
      "state_guide",
      "municipality_kov",
      "municipality_service",
      "kov_service_info",
      "kov_service",
      "kov_web",
      "municipality_web",
      "application_form",
      "official_contact",
      "service_map_contact",
      "service_map_contact_monitor"
    ],
    insufficientEvidenceMode: true
  }
};

const OFFICIAL_STRONG_SOURCE_TYPES = new Set([
  "national_law",
  "kov_regulation",
  "municipal_regulation",
  "state_guide",
  "municipality_kov",
  "municipality_service",
  "kov_service_info",
  "kov_service",
  "kov_web",
  "municipality_web",
  "official_form",
  "application_form",
  "web_form",
  "pdf_form",
  "official_contact",
  "service_map_contact",
  "service_map_contact_monitor",
  "contact_page"
]);

const BACKGROUND_SOURCE_TYPES = new Set([
  "journal_article",
  "official_guideline",
  "information_material",
  "research_report",
  "study",
  "survey_report",
  "evaluation_report",
  "statistics",
  "statistical_report",
  "official_report",
  "academic_paper",
  "policy_report",
  "policy_analysis",
  "practice_example",
  "project_description",
  "personal_story",
  "opinion",
  "historical_source",
  "methodology_guide",
  "methodology_material",
  "state_guide",
  "quality_guideline",
  "service_standard",
  "guide",
  "manual",
  "training_material",
  "template",
  "faq",
  "organization_profile",
  "partner_service_info"
]);

export function classifyRagRisk(_message = "", options = {}) {
  const semanticContract = options?.semanticContract && typeof options.semanticContract === "object"
    ? options.semanticContract
    : {};
  const intent = String(semanticContract?.intent || "default").trim();
  const semanticScope = String(semanticContract?.risk_scope || "general").trim();

  let riskLevel = "low";
  let stakes = "informational";
  let evidenceScope = semanticScope === "source_bounded_description"
    ? "source_bounded"
    : "general_background";
  let reasons = semanticScope === "source_bounded_description"
    ? ["structured_source_bounded_scope"]
    : ["structured_general_scope"];

  if (options?.isCrisis) {
    riskLevel = "high";
    stakes = "safety_critical";
    evidenceScope = "current_authoritative";
    reasons = ["explicit_crisis_route"];
  } else if (LEGAL_FINANCIAL_INTENTS.has(intent)) {
    riskLevel = "high";
    stakes = "legal_financial";
    evidenceScope = "current_legal";
    reasons = [`structured_intent:${intent}`];
  } else if (semanticScope === "current_status" || ACTIONABLE_INTENTS.has(intent)) {
    riskLevel = "medium";
    stakes = "actionable";
    evidenceScope = intent === "kov_service_or_benefit"
      ? "current_municipality"
      : "current_authoritative";
    reasons = semanticScope === "current_status"
      ? ["structured_current_scope"]
      : [`structured_intent:${intent}`];
  }

  const policy = SOURCE_POLICY[riskLevel] || SOURCE_POLICY.low;
  return {
    riskLevel,
    reasons: [...new Set(reasons)].slice(0, 6),
    semanticTermsUsed: false,
    decisionSource: "structured_semantic_contract",
    stakes,
    evidenceScope,
    requiredEvidence: policy.requiredEvidence,
    preferredSourceTypes: policy.preferredSourceTypes,
    insufficientEvidenceMode: policy.insufficientEvidenceMode
  };
}

export function buildRiskPolicyInstruction(policy, replyLang = "et") {
  if (!policy || policy.riskLevel === "low") return "";
  const sourceTypes = Array.isArray(policy.preferredSourceTypes) ? policy.preferredSourceTypes.join(", ") : "";
  if (replyLang === "en") {
    return [
      `RAG_RISK_POLICY: ${policy.riskLevel}.`,
      `Required evidence: ${policy.requiredEvidence}.`,
      sourceTypes ? `Prefer these source types: ${sourceTypes}.` : "",
      "For rights, benefits, amounts, deadlines, forms, contacts, eligibility or validity, state a firm fact only when RAG_CONTEXT directly supports it.",
      "If the visible context does not confirm the claim, say what is confirmed, what is not confirmed, and where it should be checked."
    ].filter(Boolean).join(" ");
  }
  if (replyLang === "ru") {
    return [
      `RAG_RISK_POLICY: ${policy.riskLevel}.`,
      `Требуемая доказательность: ${policy.requiredEvidence}.`,
      sourceTypes ? `Предпочитай эти типы источников: ${sourceTypes}.` : "",
      "По правам, пособиям, суммам, срокам, формам, контактам, праву на помощь и действительности информации утверждай факт только при прямом подтверждении в RAG_CONTEXT.",
      "Если контекст не подтверждает утверждение, скажи, что подтверждено, что не подтверждено и где это нужно проверить."
    ].filter(Boolean).join(" ");
  }
  return [
    `RAG_RISK_POLICY: ${policy.riskLevel}.`,
    `Nõutav tõendusaste: ${policy.requiredEvidence}.`,
    sourceTypes ? `Eelista neid allikatüüpe: ${sourceTypes}.` : "",
    "Õiguse, toetuse, summa, tähtaja, vormi, kontakti, abikõlblikkuse või kehtivuse kohta esita kindel fakt ainult siis, kui RAG_CONTEXT seda otseselt kinnitab.",
    "Kui nähtav kontekst väidet ei kinnita, ütle, mida allikad kinnitavad, mida nad ei kinnita ja kust info üle kontrollida."
  ].filter(Boolean).join(" ");
}

function readSourceType(source = {}) {
  return String(source?.source_type || source?.sourceType || source?.type || "").trim();
}

function readSourceStatus(source = {}) {
  return String(source?.source_status || source?.sourceStatus || source?.content_status || source?.contentStatus || "").trim().toLowerCase();
}

export function inferSourceEvidenceStrength(source = {}, _policy = null) {
  const sourceType = readSourceType(source);
  const status = readSourceStatus(source);
  const historical = source?.historical === true || String(source?.historical || "").toLowerCase() === "true";

  if (status === "inactive" || status === "archived") {
    return {
      strength: "insufficient",
      reason: "inactive_or_archived_source"
    };
  }
  if (status === "stale") {
    return {
      strength: "weak",
      reason: "stale_source"
    };
  }
  if (OFFICIAL_STRONG_SOURCE_TYPES.has(sourceType)) {
    return {
      strength: "strong",
      reason: "official_source_type"
    };
  }
  if (BACKGROUND_SOURCE_TYPES.has(sourceType)) {
    return {
      strength: "medium",
      reason: historical ? "historical_background_source_type" : "background_source_type"
    };
  }
  if (!sourceType) {
    return {
      strength: "weak",
      reason: "missing_source_type"
    };
  }
  return {
    strength: "weak",
    reason: "unrecognized_source_type"
  };
}

export function sourceMeetsEvidenceRequirement(source = {}, policy = null) {
  const evidence = inferSourceEvidenceStrength(source, policy);
  return {
    ok: evidence.reason !== "inactive_or_archived_source",
    requiredEvidence: policy?.requiredEvidence || "medium",
    advisoryOnly: true,
    ...evidence
  };
}
