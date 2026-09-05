import { createRagRetiredError } from "@/lib/rag/retired";
import { DEFAULT_MODEL, OPENAI_MAX_OUTPUT_TOKENS } from "@/lib/chat/settings"
import { createArtifactError } from "@/lib/documents/artifacts"


import { logOpenAIUsage } from "@/lib/openaiUsage"


import { normalizeText } from "@/lib/documents/sourceMaterial";


const AGENT_MAX_OUTPUT_TOKENS = Number(process.env.AGENT_MAX_OUTPUT_TOKENS || OPENAI_MAX_OUTPUT_TOKENS || 1_800)







const AGENT_AUDIENCE_VALUES = new Set(["worker", "client"])
const AGENT_TONE_VALUES = new Set(["professional", "supportive", "plain"])
const AGENT_LENGTH_VALUES = new Set(["short", "standard", "detailed"])
const AGENT_LANGUAGE_VALUES = new Set(["et", "en", "ru"])

function languageLabel(language) {
  if (language === "en") return "English"
  if (language === "ru") return "Russian"
  return "Estonian"
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

export async function generateArtifactDraftContent() {
  throw createRagRetiredError();
}

export async function refineArtifactDraftContent() {
  throw createRagRetiredError();
}
