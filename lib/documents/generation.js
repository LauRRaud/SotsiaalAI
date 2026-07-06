import { DEFAULT_MODEL, OPENAI_MAX_OUTPUT_TOKENS } from "@/lib/chat/settings"
import { createArtifactError } from "@/lib/documents/artifacts"
import { ensureDocumentIndexed } from "@/lib/documents/embeddings"
import { buildEvidenceContext, evidenceTokenBudgetForLength } from "@/lib/documents/evidence"
import { logOpenAIUsage } from "@/lib/openaiUsage"
import {
  classifyRetrievalFailure,
  createRetrievalDebugMeta,
  logAgentRetrieval,
  logAgentRetrievalChunks,
  recordRetrievalExecution
} from "@/lib/documents/retrievalObservability"
import { searchDocumentChunks } from "@/lib/documents/search"
import { collectFallbackSourceMaterial, normalizeText } from "@/lib/documents/sourceMaterial"
import { redactPersonalData } from "@/lib/privacy/piiFilter"

const AGENT_MAX_OUTPUT_TOKENS = Number(process.env.AGENT_MAX_OUTPUT_TOKENS || OPENAI_MAX_OUTPUT_TOKENS || 1_800)
const AGENT_SEARCH_TOP_K = Number(process.env.AGENT_SEARCH_TOP_K || 20)
const AGENT_MAX_CHUNKS_PER_DOCUMENT = Number(process.env.AGENT_MAX_CHUNKS_PER_DOCUMENT || 2)
const AGENT_MAX_CHUNKS_PER_DOCUMENT_DETAILED = Number(
  process.env.AGENT_MAX_CHUNKS_PER_DOCUMENT_DETAILED || 3
)

const AGENT_AUDIENCE_VALUES = new Set(["worker", "client"])
const AGENT_TONE_VALUES = new Set(["professional", "supportive", "plain"])
const AGENT_LENGTH_VALUES = new Set(["short", "standard", "detailed"])
const AGENT_LANGUAGE_VALUES = new Set(["et", "en", "ru"])

function languageLabel(language) {
  if (language === "en") return "English"
  if (language === "ru") return "Russian"
  return "Estonian"
}

function audienceLabel(audience) {
  return audience === "client" ? "help-seeker / client" : "social work specialist"
}

function toneLabel(tone) {
  if (tone === "supportive") return "supportive and calm"
  if (tone === "plain") return "plain-language and easy to follow"
  return "professional and neutral"
}

function lengthLabel(length) {
  if (length === "short") return "short"
  if (length === "detailed") return "detailed"
  return "standard"
}

function maxChunksPerDocumentForLength(length) {
  return length === "detailed"
    ? Math.max(1, AGENT_MAX_CHUNKS_PER_DOCUMENT_DETAILED)
    : Math.max(1, AGENT_MAX_CHUNKS_PER_DOCUMENT)
}

function limitChunksPerDocument(chunks, length) {
  const limit = maxChunksPerDocumentForLength(length)
  const perDocumentCounts = new Map()
  const filtered = []

  for (const chunk of Array.isArray(chunks) ? chunks : []) {
    const docKey = String(chunk?.docId || chunk?.originalDocumentId || "unknown")
    const used = perDocumentCounts.get(docKey) || 0
    if (used >= limit) continue
    filtered.push(chunk)
    perDocumentCounts.set(docKey, used + 1)
  }

  return filtered
}

function structureGuide(type) {
  if (type === "CASE_BRIEF") {
    return "Use sections for situation summary, key facts, risks and needs, and recommended next steps."
  }
  if (type === "CASE_SUMMARY") {
    return "Use sections for case context, relevant facts, assessment, risks, support needs, and next steps."
  }
  if (type === "PRE_ASSESSMENT_SUMMARY") {
    return "Use sections for initial concern, relevant background, needs, risks, existing support, and suggested follow-up questions."
  }
  if (type === "STAR_HELPER") {
    return "Return structured source material that helps fill STAR fields, grouped by observations, needs, strengths, risks, actions, and follow-up."
  }
  if (type === "MEETING_SUMMARY") {
    return "Use sections for context, main discussion points, agreed actions, and follow-up."
  }
  if (type === "ACTION_PLAN") {
    return "Return a practical action plan with goals, steps, responsible parties, timing, and follow-up."
  }
  if (type === "CHECKLIST") {
    return "Return a practical checklist with short actionable bullet points."
  }
  if (type === "LETTER_DRAFT") {
    return "Write a complete letter with greeting, concise body paragraphs, and closing."
  }
  if (type === "REPORT_DRAFT") {
    return "Use sections for purpose, relevant facts, assessment, and next steps."
  }
  return "Use a clear, practical structure that fits the task."
}

function defaultInstruction(type, audience) {
  if (type === "LETTER_DRAFT") {
    return audience === "client"
      ? "Draft a clear letter for the client."
      : "Draft a professional letter for a specialist or institution."
  }
  if (type === "CHECKLIST") return "Create a practical checklist from the selected documents."
  if (type === "MEETING_SUMMARY") return "Create a meeting summary from the selected documents."
  if (type === "CASE_SUMMARY") return "Create a case summary from the selected documents."
  if (type === "PRE_ASSESSMENT_SUMMARY") return "Create a pre-assessment summary from the selected documents."
  if (type === "STAR_HELPER") return "Create STAR entry support material from the selected documents."
  if (type === "ACTION_PLAN") return "Create an action plan from the selected documents."
  if (type === "CASE_BRIEF") return "Create a concise case brief from the selected documents."
  return "Create a useful first draft from the selected documents."
}

function normalizeAgentOption(value, allowedValues, fallback) {
  const normalized = String(value || "").trim().toLowerCase()
  return allowedValues.has(normalized) ? normalized : fallback
}

export function normalizeAgentAudience(value) {
  return normalizeAgentOption(value, AGENT_AUDIENCE_VALUES, "worker")
}

export function normalizeAgentTone(value) {
  return normalizeAgentOption(value, AGENT_TONE_VALUES, "professional")
}

export function normalizeAgentLength(value) {
  return normalizeAgentOption(value, AGENT_LENGTH_VALUES, "standard")
}

export function normalizeAgentLanguage(value, fallback = "et") {
  return normalizeAgentOption(value, AGENT_LANGUAGE_VALUES, fallback)
}

export function normalizeAgentInstruction(value) {
  const normalized = normalizeText(value)
  if (normalized.length > 4_000) {
    throw createArtifactError("documents.artifacts.errors.instruction_too_long", 400)
  }
  return normalized
}

export function normalizeRefinementInstruction(value) {
  const normalized = normalizeText(value)
  if (!normalized) {
    throw createArtifactError("documents.artifacts.errors.refinement_required", 400)
  }
  if (normalized.length > 4_000) {
    throw createArtifactError("documents.artifacts.errors.instruction_too_long", 400)
  }
  return normalized
}

async function createOpenAIClient() {
  let OpenAI
  try {
    ({ default: OpenAI } = await import("openai"))
  } catch (error) {
    throw createArtifactError(error?.message || "documents.artifacts.errors.ai_unavailable", 503)
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw createArtifactError("documents.artifacts.errors.ai_unavailable", 503)
  }

  return new OpenAI({ apiKey })
}

async function buildRetrievedEvidence({
  documents,
  query,
  length,
  observabilityRoute,
  observabilityStage,
  userId,
  userRole,
  conversationId,
  artifactId,
  researchJobId
}) {
  const indexedDocuments = []
  const unavailableSources = []
  const indexingFailures = []
  const tokenBudget = evidenceTokenBudgetForLength(length)
  const ragObservability = {
    route: observabilityRoute,
    stage: observabilityStage,
    userId,
    role: userRole,
    conversationId,
    artifactId,
    researchJobId
  }

  for (const document of documents) {
    try {
      await ensureDocumentIndexed(document, ragObservability)
      indexedDocuments.push(document)
    } catch (error) {
      const reason = classifyRetrievalFailure(error, "rag_ingest_failed")
      unavailableSources.push(document.title || document.originalName || document.id)
      indexingFailures.push(reason)
      console.error("[documents artifacts] indexing failed", {
        documentId: document.id,
        message: error?.message || "unknown",
        reason
      })
    }
  }

  if (!indexedDocuments.length) {
    const error = createArtifactError("documents.artifacts.errors.analysis_failed", 502)
    error.retrievalReason = indexingFailures[0] || "rag_ingest_failed"
    error.documentsIndexed = 0
    error.tokenBudget = tokenBudget
    throw error
  }

  let chunks
  try {
    chunks = await searchDocumentChunks(query, indexedDocuments, AGENT_SEARCH_TOP_K, ragObservability)
  } catch (error) {
    error.documentsIndexed = indexedDocuments.length
    error.tokenBudget = tokenBudget
    throw error
  }
  if (!chunks.length) {
    const error = createArtifactError("documents.artifacts.errors.analysis_failed", 502)
    error.retrievalReason = "rag_search_failed"
    error.documentsIndexed = indexedDocuments.length
    error.tokenBudget = tokenBudget
    throw error
  }

  const limitedChunks = limitChunksPerDocument(chunks, length)
  if (!limitedChunks.length) {
    const error = createArtifactError("documents.artifacts.errors.analysis_failed", 502)
    error.retrievalReason = "rag_search_failed"
    error.documentsIndexed = indexedDocuments.length
    error.tokenBudget = tokenBudget
    throw error
  }

  const { evidenceText, evidenceCount } = buildEvidenceContext(limitedChunks, tokenBudget)
  if (!evidenceText) {
    const error = createArtifactError("documents.artifacts.errors.analysis_failed", 502)
    error.retrievalReason = "rag_search_failed"
    error.documentsIndexed = indexedDocuments.length
    error.tokenBudget = tokenBudget
    throw error
  }

  return {
    mode: "rag",
    materialLabel: "EVIDENCE",
    materialText: redactPersonalData(evidenceText).redactedText,
    unavailableSources,
    evidenceCount,
    debugMeta: createRetrievalDebugMeta({
      retrievalMode: "rag",
      chunksUsed: evidenceCount,
      documentsIndexed: indexedDocuments.length,
      tokenBudget,
      fallbackReason: null
    }),
    chunks: limitedChunks
  }
}

async function buildMaterialContext({
  documents,
  query,
  length,
  sourceMaterialText,
  sourceMaterialName,
  observabilityRoute,
  observabilityStage,
  userId,
  userRole,
  conversationId,
  artifactId,
  researchJobId
}) {
  const normalizedSourceMaterialText = normalizeText(redactPersonalData(sourceMaterialText).redactedText)
  const normalizedSourceMaterialName = normalizeText(sourceMaterialName)

  if (normalizedSourceMaterialText) {
    return {
      mode: "session_source_material",
      materialLabel: normalizedSourceMaterialName
        ? `SESSION_SOURCE_MATERIAL: ${normalizedSourceMaterialName}`
        : "SESSION_SOURCE_MATERIAL",
      materialText: normalizedSourceMaterialText,
      unavailableSources: [],
      evidenceCount: 0,
      debugMeta: createRetrievalDebugMeta({
        retrievalMode: "fallback_source_material",
        chunksUsed: 0,
        documentsIndexed: 0,
        tokenBudget: evidenceTokenBudgetForLength(length),
        fallbackReason: "session_source_material"
      }),
      chunks: []
    }
  }

  try {
    return await buildRetrievedEvidence({
      documents,
      query,
      length,
      observabilityRoute,
      observabilityStage,
      userId,
      userRole,
      conversationId,
      artifactId,
      researchJobId
    })
  } catch (error) {
    const fallbackReason = classifyRetrievalFailure(error, "rag_search_failed")
    const tokenBudget = Number(error?.tokenBudget) || evidenceTokenBudgetForLength(length)
    const documentsIndexed = Number(error?.documentsIndexed) || 0
    console.error("[documents artifacts] retrieval fallback triggered", {
      message: error?.message || "unknown",
      reason: fallbackReason
    })

    const { sourceBlocks, unavailableSources } = await collectFallbackSourceMaterial(documents)
    return {
      mode: "fallback_source_material",
      materialLabel: "SOURCE_DOCUMENT_EXCERPT",
      materialText: sourceBlocks.join("\n\n---\n\n"),
      unavailableSources,
      evidenceCount: 0,
      debugMeta: createRetrievalDebugMeta({
        retrievalMode: "fallback_source_material",
        chunksUsed: 0,
        documentsIndexed,
        tokenBudget,
        fallbackReason
      }),
      chunks: []
    }
  }
}

function limitationsText(unavailableSources, retrievalMode) {
  if (!unavailableSources.length) return ""
  const sourceList = unavailableSources.join(", ")
  if (retrievalMode === "fallback_source_material") {
    return `Some selected documents could not be extracted in time: ${sourceList}. If relevant, mention that some material may be missing.`
  }
  return `Some selected documents could not be indexed or searched in time: ${sourceList}. If relevant, mention that some material may be missing.`
}

function joinPromptSections(sections) {
  return sections
    .filter(Boolean)
    .join("\n\n")
}

function splitTranscriptIntoBlocks(text, maxChars = 16_000) {
  const normalized = normalizeText(text)
  if (!normalized) return []
  const paragraphs = normalized.split(/\n{2,}/)
  const blocks = []
  let current = ""

  for (const paragraph of paragraphs) {
    const nextParagraph = paragraph.trim()
    if (!nextParagraph) continue
    const candidate = current ? `${current}\n\n${nextParagraph}` : nextParagraph
    if (candidate.length <= maxChars) {
      current = candidate
      continue
    }
    if (current) blocks.push(current)
    current = nextParagraph.length <= maxChars ? nextParagraph : nextParagraph.slice(0, maxChars)
  }

  if (current) blocks.push(current)
  return blocks
}

function transcriptSummarySystemPrompt(language) {
  return [
    "You are SotsiaalAI's transcript summary assistant for social work workflows.",
    `Write in ${languageLabel(language)}.`,
    "Use only the provided transcript or intermediate transcript summaries.",
    "Do not invent facts, dates, decisions, risks, diagnoses, legal conclusions, clinical conclusions, or people.",
    "The summary may be shorter and better organized, but it must not change the transcript's meaning, participant claims, certainty level, or emphasis.",
    "If a sentence cannot be justified by the transcript, leave it out.",
    "Do not turn uncertainty into fact, possibility into decision, wishes into agreements, descriptions into accusations, or difficulties into diagnoses.",
    "Use neutral, dignified, non-stigmatizing wording.",
    "Return only the summary in markdown. Do not wrap it in code fences."
  ].join(" ")
}

function transcriptSummaryStructurePrompt() {
  return [
    "Create one standard paragraph- and theme-based summary. Do not create a sentence-by-sentence paraphrase.",
    "For long or repetitive material, consolidate repeated points under the same theme and remove filler words, interruptions, repetitions, and irrelevant digressions.",
    "Preserve important context, meaning, uncertainty, and stated agreements.",
    "Use this exact structure:",
    "1. Vestluse üldine teema",
    "2. Peamised käsitletud teemad",
    "3. Olulisemad asjaolud",
    "4. Isiku või osalejate kirjeldatud olukord",
    "5. Esile toodud vajadused, mured või küsimused",
    "6. Olemasolevad ressursid ja toetavad asjaolud",
    "7. Kokkulepped ja järgmised sammud",
    "8. Lahtised küsimused või täpsustamist vajav info",
    "9. Märkused ebakindluse kohta",
    "If a section has no support in the transcript, write exactly one of these: \"Transkriptist ei selgu.\" or \"Seda teemat vestluses ei käsitletud.\"",
    "Do not fill missing sections with assumptions."
  ].join("\n")
}

async function createTranscriptIntermediateSummary({
  client,
  transcriptBlock,
  language,
  index,
  total,
  userId,
  userRole
}) {
  const startedAt = Date.now()
  const response = await client.responses.create({
    model: DEFAULT_MODEL,
    max_output_tokens: Math.min(AGENT_MAX_OUTPUT_TOKENS, 1_400),
    text: { verbosity: "low" },
    reasoning: { effort: "low" },
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: transcriptSummarySystemPrompt(language) }]
      },
      {
        role: "user",
        content: [{
          type: "input_text",
          text: [
            `This is transcript block ${index + 1} of ${total}.`,
            "Create a short intermediate thematic summary for this block only.",
            "Preserve uncertainty and do not add any facts.",
            "",
            "TRANSCRIPT BLOCK",
            transcriptBlock
          ].join("\n")
        }]
      }
    ]
  })
  await logOpenAIUsage({
    response,
    model: DEFAULT_MODEL,
    route: "api/documents/transcript-summary",
    stage: "transcript_summary_intermediate",
    latencyMs: Date.now() - startedAt,
    userId,
    role: userRole
  })
  return normalizeText(response?.output_text || "")
}

export async function generateTranscriptSummaryContent({
  transcriptText,
  language,
  userId = null,
  userRole = null
}) {
  const resolvedLanguage = normalizeAgentLanguage(language, "et")
  const transcript = normalizeText(transcriptText)
  if (!transcript) {
    throw createArtifactError("documents.errors.transcript_required", 400)
  }

  const client = await createOpenAIClient()
  const blocks = splitTranscriptIntoBlocks(transcript)
  const sourceText = blocks.length > 1
    ? (await Promise.all(blocks.map((block, index) =>
        createTranscriptIntermediateSummary({
          client,
          transcriptBlock: block,
          language: resolvedLanguage,
          index,
          total: blocks.length,
          userId,
          userRole
        })
      ))).filter(Boolean).map((summary, index) => `Vahekokkuvõte ${index + 1}:\n${summary}`).join("\n\n")
    : transcript

  const startedAt = Date.now()
  const response = await client.responses.create({
    model: DEFAULT_MODEL,
    max_output_tokens: Math.max(AGENT_MAX_OUTPUT_TOKENS, 2_200),
    text: { verbosity: "low" },
    reasoning: { effort: "low" },
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: transcriptSummarySystemPrompt(resolvedLanguage) }]
      },
      {
        role: "user",
        content: [{
          type: "input_text",
          text: joinPromptSections([
            "TASK",
            transcriptSummaryStructurePrompt(),
            blocks.length > 1
              ? "The transcript was long, so the source below contains intermediate summaries made from transcript blocks. Create the final whole-meeting summary from them without adding new facts."
              : "Create the final whole-meeting summary from the transcript below.",
            blocks.length > 1 ? "INTERMEDIATE SUMMARIES" : "TRANSCRIPT",
            sourceText
          ])
        }]
      }
    ]
  })
  await logOpenAIUsage({
    response,
    model: DEFAULT_MODEL,
    route: "api/documents/transcript-summary",
    stage: "transcript_summary_final",
    latencyMs: Date.now() - startedAt,
    userId,
    role: userRole
  })

  const content = normalizeText(response?.output_text || "")
  if (!content) {
    throw createArtifactError("documents.artifacts.errors.ai_empty", 502)
  }
  return {
    content,
    model: DEFAULT_MODEL,
    chunkCount: blocks.length
  }
}

export async function generateArtifactDraftContent({
  type,
  documents,
  sourceMaterialText,
  sourceMaterialName,
  templateTitle,
  instruction,
  audience,
  tone,
  language,
  length,
  observabilityRoute = "api/documents/artifacts",
  observabilityStage = "document_generate",
  userId = null,
  userRole = null,
  conversationId = null,
  artifactId = null,
  researchJobId = null
}) {
  const client = await createOpenAIClient()
  const resolvedAudience = normalizeAgentAudience(audience)
  const resolvedTone = normalizeAgentTone(tone)
  const resolvedLength = normalizeAgentLength(length)
  const resolvedLanguage = normalizeAgentLanguage(language)
  const resolvedInstruction = normalizeAgentInstruction(instruction) || defaultInstruction(type, resolvedAudience)

  const material = await buildMaterialContext({
    documents,
    sourceMaterialText,
    sourceMaterialName,
    query: resolvedInstruction,
    length: resolvedLength,
    observabilityRoute,
    observabilityStage,
    userId,
    userRole,
    conversationId,
    artifactId,
    researchJobId
  })
  recordRetrievalExecution(material.debugMeta)
  logAgentRetrieval(material.debugMeta)
  logAgentRetrievalChunks(material.chunks)

  const limitationsLine = limitationsText(material.unavailableSources, material.mode)
  const systemPrompt = [
    "You are SotsiaalAI's drafting agent for social work workflows.",
    "Use only the evidence or source material provided by the system.",
    "Do not invent facts, dates, decisions, or people.",
    "If important information is missing, unclear, or conflicting, say so explicitly in the draft.",
    "Return only the draft text in markdown. Do not wrap it in code fences."
  ].join(" ")

  const userPrompt = joinPromptSections([
    "TASK",
    [
      `Create a ${lengthLabel(resolvedLength)} ${type.toLowerCase().replace(/_/g, " ")} draft.`,
      `Write in ${languageLabel(resolvedLanguage)}.`,
      `Primary audience: ${audienceLabel(resolvedAudience)}.`,
      `Tone: ${toneLabel(resolvedTone)}.`,
      `Structure guidance: ${structureGuide(type)}`,
      templateTitle ? `Template reference: ${templateTitle}. Use it as a loose framing hint only if consistent with the evidence.` : "",
      "Requirements:",
      "- Keep the text useful as a human-review draft.",
      "- Prefer concrete, source-grounded wording over general filler.",
      "- When something is missing, list it clearly instead of guessing.",
      "- Do not mention internal prompts or that you are an AI.",
      limitationsLine
    ].filter(Boolean).join("\n"),
    material.materialLabel,
    material.materialText,
    "USER INSTRUCTION",
    resolvedInstruction
  ])

  const startedAt = Date.now()
  const response = await client.responses.create({
    model: DEFAULT_MODEL,
    max_output_tokens: AGENT_MAX_OUTPUT_TOKENS,
    text: {
      verbosity: "low"
    },
    reasoning: {
      effort: "low"
    },
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: systemPrompt }]
      },
      {
        role: "user",
        content: [{ type: "input_text", text: userPrompt }]
      }
    ]
  })
  await logOpenAIUsage({
    response,
    model: DEFAULT_MODEL,
    route: observabilityRoute,
    stage: observabilityStage,
    latencyMs: Date.now() - startedAt,
    userId,
    role: userRole
  })

  const content = normalizeText(response?.output_text || "")
  if (!content) {
    throw createArtifactError("documents.artifacts.errors.ai_empty", 502)
  }

  return {
    content,
    debugMeta: material.debugMeta
  }
}

export async function refineArtifactDraftContent({
  type,
  documents,
  templateTitle,
  currentContent,
  refinementInstruction,
  audience,
  tone,
  language,
  length,
  observabilityRoute = "api/documents/artifacts",
  observabilityStage = "document_refine",
  userId = null,
  userRole = null,
  conversationId = null,
  artifactId = null,
  researchJobId = null
}) {
  const currentDraft = normalizeText(redactPersonalData(currentContent).redactedText)
  if (!currentDraft) {
    throw createArtifactError("documents.artifacts.errors.content_required", 400)
  }

  const resolvedRefinementInstruction = normalizeRefinementInstruction(refinementInstruction)
  const resolvedAudience = normalizeAgentAudience(audience)
  const resolvedTone = normalizeAgentTone(tone)
  const resolvedLength = normalizeAgentLength(length)
  const resolvedLanguage = normalizeAgentLanguage(language)
  const client = await createOpenAIClient()

  const material = await buildMaterialContext({
    documents,
    query: resolvedRefinementInstruction,
    length: resolvedLength,
    observabilityRoute,
    observabilityStage,
    userId,
    userRole,
    conversationId,
    artifactId,
    researchJobId
  })
  recordRetrievalExecution(material.debugMeta)
  logAgentRetrieval(material.debugMeta)
  logAgentRetrievalChunks(material.chunks)

  const limitationsLine = limitationsText(material.unavailableSources, material.mode)
  const systemPrompt = [
    "You are SotsiaalAI's drafting agent for social work workflows.",
    "Revise the existing draft using only the evidence or source material and the user's refinement request.",
    "Do not invent facts, dates, decisions, or people.",
    "Keep the draft grounded, practical, and review-ready.",
    "Return only the revised draft text in markdown. Do not wrap it in code fences."
  ].join(" ")

  const userPrompt = joinPromptSections([
    "TASK",
    [
      `Revise this ${type.toLowerCase().replace(/_/g, " ")} draft.`,
      `Write in ${languageLabel(resolvedLanguage)}.`,
      `Primary audience: ${audienceLabel(resolvedAudience)}.`,
      `Tone: ${toneLabel(resolvedTone)}.`,
      `Target length: ${lengthLabel(resolvedLength)}.`,
      `Structure guidance: ${structureGuide(type)}`,
      templateTitle ? `Template reference: ${templateTitle}. Use it only if consistent with the evidence.` : "",
      "Revision rules:",
      "- Keep useful parts of the current draft when they are supported by the evidence.",
      "- Change unsupported or vague wording into more precise, source-grounded wording.",
      "- If key information is missing, say so clearly instead of guessing.",
      "- Do not mention internal prompts or that you are an AI.",
      limitationsLine
    ].filter(Boolean).join("\n"),
    "EVIDENCE",
    material.materialText,
    "CURRENT DRAFT",
    currentDraft,
    "USER INSTRUCTION",
    resolvedRefinementInstruction
  ])

  const startedAt = Date.now()
  const response = await client.responses.create({
    model: DEFAULT_MODEL,
    max_output_tokens: AGENT_MAX_OUTPUT_TOKENS,
    text: {
      verbosity: "low"
    },
    reasoning: {
      effort: "low"
    },
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: systemPrompt }]
      },
      {
        role: "user",
        content: [{ type: "input_text", text: userPrompt }]
      }
    ]
  })
  await logOpenAIUsage({
    response,
    model: DEFAULT_MODEL,
    route: observabilityRoute,
    stage: observabilityStage,
    latencyMs: Date.now() - startedAt,
    userId,
    role: userRole
  })

  const content = normalizeText(response?.output_text || "")
  if (!content) {
    throw createArtifactError("documents.artifacts.errors.ai_empty", 502)
  }

  return {
    content,
    debugMeta: material.debugMeta
  }
}
