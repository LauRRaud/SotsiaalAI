import { getTranscriptionConfig } from "@/lib/documents/audioWorkflow"
import { createArtifactError } from "@/lib/documents/artifacts"
import { prisma } from "@/lib/prisma"

function normalizeLanguage(value) {
  const base = String(value || "").toLowerCase().split("-")[0].trim()
  if (!base || base === "auto") return undefined
  return base.length === 2 ? base : undefined
}

export async function transcribeAudioFile({
  buffer,
  fileName,
  mime,
  language,
  env = process.env
}) {
  const config = getTranscriptionConfig(env)
  if (!config.enabled || config.provider === "disabled") {
    throw createArtifactError("documents.errors.transcription_not_configured", 503)
  }

  if (config.provider === "mock") {
    return {
      text: [
        "Mock-transkriptsioon.",
        "",
        "See tekst on loodud arendus- või testirežiimis ning põhineb valitud helifaili metaandmetel, mitte päris helisisul."
      ].join("\n"),
      provider: "mock",
      model: "mock",
      language: normalizeLanguage(language) || config.language
    }
  }

  if (config.provider !== "openai") {
    throw createArtifactError("documents.errors.transcription_not_configured", 503)
  }

  if (!env.OPENAI_API_KEY) {
    throw createArtifactError("documents.errors.transcription_not_configured", 503)
  }

  let OpenAI
  try {
    ({ default: OpenAI } = await import("openai"))
  } catch (error) {
    throw createArtifactError(error?.message || "documents.errors.transcription_failed", 503)
  }

  const file = new File([buffer], fileName || "audio.webm", {
    type: mime || "audio/webm"
  })
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY })
  const resolvedLanguage = normalizeLanguage(language) || normalizeLanguage(config.language)
  const transcription = await client.audio.transcriptions.create({
    file,
    model: config.model,
    response_format: "json",
    ...(resolvedLanguage ? { language: resolvedLanguage } : {})
  })
  const text = String(transcription?.text || "").trim()
  if (!text) {
    throw createArtifactError("documents.errors.transcription_empty", 502)
  }

  return {
    text,
    provider: "openai",
    model: config.model,
    language: resolvedLanguage || config.language,
    usage: transcription?.usage || null
  }
}

export async function createTranscriptionJob({
  sourceDocumentId,
  requestedByUserId,
  provider,
  model,
  language
}) {
  return prisma.transcriptionJob.create({
    data: {
      sourceDocumentId,
      requestedByUserId,
      provider: provider || "disabled",
      model: model || null,
      language: language || null,
      status: "QUEUED"
    }
  })
}

export async function startTranscriptionJob({ jobId }) {
  return prisma.transcriptionJob.update({
    where: { id: jobId },
    data: {
      status: "PROCESSING",
      startedAt: new Date()
    }
  })
}

export async function completeTranscriptionJob({ jobId, transcriptDocumentId }) {
  return prisma.transcriptionJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      transcriptDocumentId,
      completedAt: new Date()
    }
  })
}

export async function failTranscriptionJob({ jobId, error }) {
  return prisma.transcriptionJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      error: String(error || "documents.errors.transcription_failed").slice(0, 500),
      completedAt: new Date()
    }
  })
}

export async function getTranscriptionJobStatus({ jobId }) {
  const id = String(jobId || "").trim()
  if (!id) throw createArtifactError("documents.errors.missing_id", 400)
  return prisma.transcriptionJob.findUnique({
    where: { id },
    select: {
      id: true,
      sourceDocumentId: true,
      transcriptDocumentId: true,
      provider: true,
      model: true,
      language: true,
      status: true,
      error: true,
      startedAt: true,
      completedAt: true,
      cancelledAt: true,
      createdAt: true,
      updatedAt: true
    }
  })
}

export async function cancelTranscriptionJob({ jobId }) {
  const id = String(jobId || "").trim()
  if (!id) throw createArtifactError("documents.errors.missing_id", 400)
  return prisma.transcriptionJob.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date()
    }
  })
}
