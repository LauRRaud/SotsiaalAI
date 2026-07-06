import fs from "node:fs/promises";
import path from "node:path";

export const KNOWLEDGE_SCHEMA_VERSION = "knowledge-doc-v1";

export const ALLOWED_DOCUMENT_KINDS = new Set([
  "guideline",
  "research_report",
  "policy_analysis",
  "methodology",
  "manual",
  "training_material",
  "journal_article"
]);

export const ALLOWED_RESOURCE_TYPES = new Set([
  "best_practice_guidance",
  "research_evidence",
  "policy_context",
  "method_guidance",
  "training_material",
  "professional_article",
  "information_material",
  "organization_guidance"
]);

export const ALLOWED_SOURCE_TYPES = new Set([
  "official_guideline",
  "information_material",
  "research_report",
  "policy_analysis",
  "methodology_material",
  "methodology_guide",
  "state_guide",
  "quality_guideline",
  "training_material",
  "journal_article",
  "uploaded_file"
]);

export const ALLOWED_COLLECTION_IDS = new Set([
  "national_guidelines",
  "research_reports",
  "policy_analyses",
  "organization_guidelines",
  "organization_materials",
  "sotsiaaltoo_articles",
  "training_materials",
  "guides",
  "methodology_guides",
  "journal_articles"
]);

export const ALLOWED_EVIDENCE_ROLES = new Set([
  "practice_guidance",
  "research_evidence",
  "policy_context",
  "methodology_background",
  "professional_ethics",
  "communication_guidance",
  "case_example",
  "definition",
  "background"
]);

export const ALLOWED_AUDIENCES = new Set([
  "SOCIAL_WORKER",
  "CLIENT",
  "BOTH",
  "ADMIN",
  "PROFESSIONAL",
  "CLIENT_SIMPLIFIED_ADAPTATION"
]);

export const DISALLOWED_CURRENT_EVIDENCE_CLAIMS = [
  "legal_entitlement",
  "benefit_amount",
  "municipal_service_availability",
  "application_deadline",
  "medical_diagnosis_or_treatment"
];

export const DEFAULT_ALLOWED_GUIDANCE_CLAIMS = [
  "practice_recommendation",
  "professional_ethics",
  "communication_guidance",
  "methodology_background",
  "case_example",
  "definition"
];

const DOCUMENT_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".md"]);
const FORMAT_BY_EXTENSION = {
  ".pdf": "pdf",
  ".doc": "doc",
  ".docx": "docx",
  ".md": "markdown"
};

export function clean(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function arrayValue(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export function unique(values = []) {
  return [...new Set(arrayValue(values).map(clean).filter(Boolean))];
}

export function sourceFormatForPath(filePath) {
  return FORMAT_BY_EXTENSION[path.extname(String(filePath || "")).toLowerCase()] || null;
}

export function isKnowledgeSourceFile(fileName) {
  return DOCUMENT_EXTENSIONS.has(path.extname(String(fileName || "")).toLowerCase());
}

export async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

export async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function listKnowledgeFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

export async function loadKnowledgeMetadataFiles(root) {
  const files = await listKnowledgeFiles(root);
  const metadata = [];
  for (const fileName of files.filter(file => file.toLowerCase().endsWith(".json"))) {
    metadata.push({
      fileName,
      filePath: path.join(root, fileName),
      data: await readJson(path.join(root, fileName))
    });
  }
  return metadata;
}

export function normalizeKnowledgeMetadata(input = {}) {
  const sourcePath = clean(input.source_path || input.sourcePath);
  const sourceFormat = clean(input.source_format || input.sourceFormat) || sourceFormatForPath(sourcePath);
  const publisher = clean(input.publisher || input.source_organization || input.sourceOrganization);
  const topics = unique(input.topics || input.tags);
  const audiences = unique(input.audiences || input.audience).filter(value => value !== "BOTH");
  const audience = clean(input.audience) || (audiences.length > 1 ? "BOTH" : audiences[0]) || "BOTH";
  const allowedClaimTypes = unique(input.allowed_claim_types || input.allowedClaimTypes);
  const disallowedClaimTypes = unique(input.disallowed_claim_types || input.disallowedClaimTypes);

  return {
    ...input,
    schemaVersion: clean(input.schemaVersion) || KNOWLEDGE_SCHEMA_VERSION,
    docId: clean(input.docId || input.document_id || input.id),
    title: clean(input.title),
    document_kind: clean(input.document_kind || input.documentKind),
    resource_type: clean(input.resource_type || input.resourceType),
    source_type: clean(input.source_type || input.sourceType),
    source_origin_type: clean(input.source_origin_type || input.sourceOriginType),
    source_format: sourceFormat,
    collection_id: clean(input.collection_id || input.collectionId),
    evidence_role: clean(input.evidence_role || input.evidenceRole),
    language: clean(input.language),
    publisher,
    source_organization: clean(input.source_organization || input.sourceOrganization) || publisher,
    year: input.year == null ? null : Number(input.year),
    publication_date: clean(input.publication_date || input.publicationDate),
    audience,
    audiences: audiences.length ? audiences : unique(input.audience).filter(value => value !== "BOTH"),
    country: clean(input.country),
    jurisdiction_level: clean(input.jurisdiction_level || input.jurisdictionLevel),
    source_path: sourcePath,
    source_url: clean(input.source_url || input.sourceUrl),
    checked_at: clean(input.checked_at || input.checkedAt),
    source_status: clean(input.source_status || input.sourceStatus),
    historical: input.historical === true,
    topics,
    target_groups: unique(input.target_groups || input.targetGroups),
    conditions_or_target_groups: unique(input.conditions_or_target_groups || input.conditionsOrTargetGroups),
    allowed_claim_types: allowedClaimTypes,
    disallowed_claim_types: disallowedClaimTypes,
    display_full_text: input.display_full_text === true,
    allow_excerpts: clean(input.allow_excerpts || input.allowExcerpts),
    sectionIndex: Array.isArray(input.sectionIndex) ? input.sectionIndex : []
  };
}

export function upgradeKnowledgeMetadata(input = {}) {
  const normalized = normalizeKnowledgeMetadata(input);
  const isGuideline = normalized.document_kind === "guideline" || !normalized.document_kind;
  const title = normalized.title || "Terviseprobleemiga laste ja nende perede toetamise hea tava";
  return {
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    docId: normalized.docId || "sm-terviseprobleemiga-laste-perede-hea-tava-2025",
    canonical_source_id: normalized.canonical_source_id || normalized.docId || "sm-terviseprobleemiga-laste-perede-hea-tava-2025",
    title,
    description: clean(normalized.description) || "Sotsiaalministeeriumi hea tava juhendmaterjal spetsialistidele; pöördujale kasutamiseks lihtsustatud selgituste ja praktiliste soovituste alusena.",
    publisher: normalized.publisher || "Sotsiaalministeerium",
    source_organization: normalized.source_organization || normalized.publisher || "Sotsiaalministeerium",
    publisher_type: clean(normalized.publisher_type) || "government_ministry",
    authority_level: clean(normalized.authority_level) || "national_ministry_guidance",
    authors: unique(normalized.authors),
    contributors: unique(normalized.contributors),
    year: normalized.year || 2025,
    publication_date: normalized.publication_date || "2025-12-12",
    checked_at: normalized.checked_at || new Date().toISOString().slice(0, 10),
    language: normalized.language || "et",
    document_kind: normalized.document_kind || "guideline",
    resource_type: normalized.resource_type || (isGuideline ? "best_practice_guidance" : "research_evidence"),
    source_type: normalized.source_type === "file" || !normalized.source_type ? "official_guideline" : normalized.source_type,
    source_origin_type: normalized.source_origin_type || "file",
    source_format: normalized.source_format || "pdf",
    collection_id: normalized.collection_id || "national_guidelines",
    jurisdiction_level: normalized.jurisdiction_level || "NATIONAL",
    country: normalized.country || "EE",
    sector: clean(normalized.sector) || "social",
    domain: clean(normalized.domain) || "children_and_families",
    audience: normalized.audience || "BOTH",
    audiences: normalized.audiences?.length ? normalized.audiences : ["SOCIAL_WORKER", "CLIENT"],
    secondary_audiences: unique(normalized.secondary_audiences || ["CLIENT_SIMPLIFIED_ADAPTATION"]),
    evidence_role: normalized.evidence_role || "practice_guidance",
    allowed_claim_types: normalized.allowed_claim_types?.length ? normalized.allowed_claim_types : DEFAULT_ALLOWED_GUIDANCE_CLAIMS,
    disallowed_claim_types: normalized.disallowed_claim_types?.length
      ? unique([...normalized.disallowed_claim_types, ...DISALLOWED_CURRENT_EVIDENCE_CLAIMS])
      : DISALLOWED_CURRENT_EVIDENCE_CLAIMS,
    topics: normalized.topics?.length ? normalized.topics : [
      "laste heaolu",
      "terviseprobleemiga laps",
      "puudega laps",
      "pere toetamine",
      "ametniku eetika",
      "lapse kaasamine",
      "traumateadlik suhtlus"
    ],
    target_groups: normalized.target_groups?.length ? normalized.target_groups : [
      "terviseprobleemiga lapsed",
      "puudega lapsed",
      "lastega pered",
      "lastega töötavad spetsialistid"
    ],
    conditions_or_target_groups: normalized.conditions_or_target_groups?.length ? normalized.conditions_or_target_groups : [
      "mõlema silma pimedus",
      "intellektipuue",
      "harvikhaigused",
      "autismi raskemad vormid",
      "Downi sündroom",
      "vähidiagnoosid"
    ],
    source_path: normalized.source_path || "Terviseprobleemiga laste ja nende perede toetamise hea tava 12.122025_VEEB.pdf",
    source_url: normalized.source_url || null,
    source_status: normalized.source_status || "active",
    historical: normalized.historical === true,
    copyright_status: clean(normalized.copyright_status) || "restricted_citation_summary_only",
    display_full_text: normalized.display_full_text === true ? normalized.display_full_text : false,
    allow_excerpts: normalized.allow_excerpts || "short_only",
    ingest: {
      chunking_strategy: clean(normalized.ingest?.chunking_strategy) || "section_aware",
      preserve_page_numbers: normalized.ingest?.preserve_page_numbers !== false,
      preserve_heading_path: normalized.ingest?.preserve_heading_path !== false,
      display_full_text: normalized.ingest?.display_full_text === true,
      allow_short_excerpts: normalized.ingest?.allow_short_excerpts !== false
    },
    quality: {
      metadata_complete: true,
      section_index_complete: Array.isArray(normalized.sectionIndex) && normalized.sectionIndex.length > 0,
      ocr_required: normalized.quality?.ocr_required === true,
      needs_manual_review: normalized.quality?.needs_manual_review === true
    },
    sectionIndex: normalized.sectionIndex?.length ? normalized.sectionIndex : defaultHeaTavaSectionIndex()
  };
}

export function defaultHeaTavaSectionIndex() {
  const disallowed = DISALLOWED_CURRENT_EVIDENCE_CLAIMS;
  const guidanceClaims = DEFAULT_ALLOWED_GUIDANCE_CLAIMS;
  return [
    {
      section_id: "eessona",
      title: "Eessõna",
      page_start: 4,
      page_end: 4,
      section_type: "front_matter",
      evidence_role: "background",
      allowed_claim_types: ["background", "definition"],
      disallowed_claim_types: disallowed,
      topic_tags: ["juhendi eesmärk", "taust"]
    },
    {
      section_id: "sissejuhatus",
      title: "Sissejuhatus",
      page_start: 5,
      page_end: 5,
      section_type: "introduction",
      evidence_role: "practice_guidance",
      allowed_claim_types: ["practice_recommendation", "methodology_background", "definition"],
      disallowed_claim_types: disallowed,
      topic_tags: ["lapse toetamine", "pere toetamine", "spetsialistid"]
    },
    {
      section_id: "ametniku-sekkumise-eetika",
      title: "Ametniku sekkumise eetika",
      page_start: 6,
      page_end: 18,
      section_type: "ethics_guidance",
      evidence_role: "professional_ethics",
      allowed_claim_types: ["professional_ethics", "communication_guidance", "practice_recommendation", "case_example"],
      disallowed_claim_types: disallowed,
      topic_tags: ["ametniku eetika", "lapse kaasamine", "traumateadlik suhtlus", "pere toetamine"]
    },
    {
      section_id: "molema-silma-pimedus",
      title: "Mõlema silma pimedus",
      page_start: 20,
      page_end: 26,
      section_type: "condition_overview",
      evidence_role: "practice_guidance",
      allowed_claim_types: guidanceClaims,
      disallowed_claim_types: disallowed,
      topic_tags: ["mõlema silma pimedus", "puudega laps", "praktiline toetamine"]
    },
    {
      section_id: "intellektipuue",
      title: "Intellektipuue",
      page_start: 27,
      page_end: 33,
      section_type: "condition_overview",
      evidence_role: "practice_guidance",
      allowed_claim_types: guidanceClaims,
      disallowed_claim_types: disallowed,
      topic_tags: ["intellektipuue", "puudega laps", "pere toetamine"]
    },
    {
      section_id: "harvikhaigused",
      title: "Harvikhaigused",
      page_start: 34,
      page_end: 41,
      section_type: "condition_overview",
      evidence_role: "practice_guidance",
      allowed_claim_types: guidanceClaims,
      disallowed_claim_types: disallowed,
      topic_tags: ["harvikhaigused", "terviseprobleemiga laps", "pere toetamine"]
    },
    {
      section_id: "autismi-raskemad-vormid",
      title: "Autismi raskemad vormid",
      page_start: 42,
      page_end: 53,
      section_type: "condition_overview",
      evidence_role: "practice_guidance",
      allowed_claim_types: guidanceClaims,
      disallowed_claim_types: disallowed,
      topic_tags: ["autismi raskemad vormid", "kommunikatsioon", "lapse kaasamine"]
    },
    {
      section_id: "downi-sundroom",
      title: "Downi sündroom",
      page_start: 54,
      page_end: 57,
      section_type: "condition_overview",
      evidence_role: "practice_guidance",
      allowed_claim_types: guidanceClaims,
      disallowed_claim_types: disallowed,
      topic_tags: ["Downi sündroom", "puudega laps", "praktiline toetamine"]
    },
    {
      section_id: "vahidiagnoosid",
      title: "Vähidiagnoosid",
      page_start: 58,
      page_end: 64,
      section_type: "condition_overview",
      evidence_role: "practice_guidance",
      allowed_claim_types: guidanceClaims,
      disallowed_claim_types: disallowed,
      topic_tags: ["vähidiagnoosid", "terviseprobleemiga laps", "pere toetamine"]
    }
  ];
}

export function buildKnowledgeRagDocumentMetadata(metadata = {}) {
  const normalized = normalizeKnowledgeMetadata(metadata);
  return {
    docId: normalized.docId,
    document_id: normalized.docId,
    title: normalized.title,
    document_kind: normalized.document_kind,
    resource_type: normalized.resource_type,
    source_type: normalized.source_type,
    source_origin_type: normalized.source_origin_type,
    source_format: normalized.source_format,
    collection_id: normalized.collection_id,
    evidence_role: normalized.evidence_role,
    authority_level: clean(normalized.authority_level),
    publisher: normalized.publisher,
    publisher_type: clean(normalized.publisher_type),
    authors: unique(normalized.authors),
    year: normalized.year,
    publication_date: normalized.publication_date,
    language: normalized.language,
    audience: normalized.audience,
    audiences: normalized.audiences,
    country: normalized.country,
    jurisdiction_level: normalized.jurisdiction_level,
    topics: normalized.topics,
    target_groups: normalized.target_groups,
    checked_at: normalized.checked_at,
    source_status: normalized.source_status,
    historical: normalized.historical,
    allowed_claim_types: normalized.allowed_claim_types,
    disallowed_claim_types: normalized.disallowed_claim_types,
    copyright_status: clean(normalized.copyright_status),
    display_full_text: normalized.display_full_text === true,
    allow_excerpts: normalized.allow_excerpts,
    legal_basis: false
  };
}

export function buildKnowledgeRagChunkMetadata(metadata = {}, section = {}) {
  const documentMetadata = buildKnowledgeRagDocumentMetadata(metadata);
  return {
    docId: documentMetadata.docId,
    document_id: documentMetadata.docId,
    section_id: clean(section.section_id),
    heading_path: unique([section.title]),
    page_start: Number(section.page_start),
    page_end: Number(section.page_end || section.page_start),
    section_type: clean(section.section_type),
    evidence_role: clean(section.evidence_role) || documentMetadata.evidence_role,
    claim_type: null,
    allowed_claim_types: unique(section.allowed_claim_types).length ? unique(section.allowed_claim_types) : documentMetadata.allowed_claim_types,
    disallowed_claim_types: unique(section.disallowed_claim_types).length ? unique(section.disallowed_claim_types) : documentMetadata.disallowed_claim_types,
    legal_basis: false,
    source_type: documentMetadata.source_type,
    collection_id: documentMetadata.collection_id,
    document_kind: documentMetadata.document_kind,
    resource_type: documentMetadata.resource_type
  };
}

export function buildKnowledgeDocIngestPayload(metadata = {}) {
  const normalized = normalizeKnowledgeMetadata(metadata);
  return {
    doc_id: normalized.docId,
    metadata: buildKnowledgeRagDocumentMetadata(normalized),
    chunks: normalized.sectionIndex.map(section => ({
      section_id: clean(section.section_id),
      text: "",
      metadata: buildKnowledgeRagChunkMetadata(normalized, section)
    }))
  };
}

export function validateKnowledgeMetadata(metadataInput = {}, context = {}) {
  const metadata = normalizeKnowledgeMetadata(metadataInput);
  const errors = [];
  const warnings = [];
  const root = context.root || process.cwd();

  function requireField(field) {
    if (metadata[field] == null || metadata[field] === "" || (Array.isArray(metadata[field]) && metadata[field].length === 0)) {
      errors.push(`${field} is required`);
    }
  }

  for (const field of [
    "schemaVersion",
    "docId",
    "title",
    "document_kind",
    "resource_type",
    "source_type",
    "source_format",
    "collection_id",
    "evidence_role",
    "language",
    "country",
    "jurisdiction_level",
    "checked_at",
    "source_status"
  ]) {
    requireField(field);
  }
  if (!metadata.publisher && !metadata.source_organization) errors.push("publisher or source_organization is required");
  if (!metadata.year && !metadata.publication_date) warnings.push("year or publication_date is recommended");
  if (!metadata.audience && !metadata.audiences.length) errors.push("audience or audiences is required");
  if (!metadata.source_path && !metadata.source_url) errors.push("source_path or source_url is required");
  if (!metadata.allowed_claim_types.length) errors.push("allowed_claim_types is required");
  if (!metadata.disallowed_claim_types.length) errors.push("disallowed_claim_types is required");

  if (metadata.schemaVersion !== KNOWLEDGE_SCHEMA_VERSION) errors.push(`schemaVersion must be ${KNOWLEDGE_SCHEMA_VERSION}`);
  if (!ALLOWED_DOCUMENT_KINDS.has(metadata.document_kind)) errors.push(`document_kind is not allowed: ${metadata.document_kind}`);
  if (!ALLOWED_RESOURCE_TYPES.has(metadata.resource_type)) errors.push(`resource_type is not allowed: ${metadata.resource_type}`);
  if (!ALLOWED_SOURCE_TYPES.has(metadata.source_type)) errors.push(`source_type is not allowed: ${metadata.source_type}`);
  if (!ALLOWED_COLLECTION_IDS.has(metadata.collection_id)) errors.push(`collection_id is not allowed: ${metadata.collection_id}`);
  if (!ALLOWED_EVIDENCE_ROLES.has(metadata.evidence_role)) errors.push(`evidence_role is not allowed: ${metadata.evidence_role}`);
  if (metadata.evidence_role === "legal_basis") errors.push("knowledge documents must not use legal_basis evidence_role");

  for (const audience of unique([metadata.audience, ...metadata.audiences, ...arrayValue(metadata.secondary_audiences)])) {
    if (!ALLOWED_AUDIENCES.has(audience)) errors.push(`audience is not allowed: ${audience}`);
  }

  if (metadata.source_path) {
    const expectedFormat = sourceFormatForPath(metadata.source_path);
    if (expectedFormat && metadata.source_format !== expectedFormat) {
      errors.push(`source_format ${metadata.source_format} does not match source_path extension ${expectedFormat}`);
    }
  }

  if (metadata.document_kind === "guideline" || metadata.document_kind === "research_report") {
    for (const claim of DISALLOWED_CURRENT_EVIDENCE_CLAIMS) {
      if (!metadata.disallowed_claim_types.includes(claim)) {
        errors.push(`disallowed_claim_types must include ${claim}`);
      }
    }
  }

  if (metadata.copyright_status === "restricted_citation_summary_only" && metadata.display_full_text === true) {
    errors.push("display_full_text cannot be true for restricted_citation_summary_only");
  }

  if (metadata.collection_id === "kov_services") errors.push("knowledge documents must not use kov_services collection");
  if (metadata.source_type === "kov_regulation") errors.push("knowledge documents must not use kov_regulation source_type");

  for (const [index, section] of metadata.sectionIndex.entries()) {
    const prefix = `sectionIndex[${index}]`;
    if (!clean(section.section_id)) errors.push(`${prefix}.section_id is required`);
    if (!clean(section.title)) errors.push(`${prefix}.title is required`);
    const pageStart = Number(section.page_start);
    const pageEnd = Number(section.page_end || section.page_start);
    if (!Number.isInteger(pageStart) || pageStart < 1) errors.push(`${prefix}.page_start must be a positive integer`);
    if (!Number.isInteger(pageEnd) || pageEnd < pageStart) errors.push(`${prefix}.page_end must be >= page_start`);
    if (!ALLOWED_EVIDENCE_ROLES.has(clean(section.evidence_role))) errors.push(`${prefix}.evidence_role is not allowed: ${section.evidence_role}`);
    if (!arrayValue(section.allowed_claim_types).length) errors.push(`${prefix}.allowed_claim_types is required`);
    if (!arrayValue(section.disallowed_claim_types).length) errors.push(`${prefix}.disallowed_claim_types is required`);
  }

  if (!metadata.sectionIndex.length) warnings.push("sectionIndex is empty");

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    metadata,
    sourceFilePath: metadata.source_path ? path.resolve(root, metadata.source_path) : null
  };
}
