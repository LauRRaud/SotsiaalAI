export const AUDIO_SOURCE_KINDS = ["CALL_AUDIO_RECORDING", "UPLOADED_AUDIO_SOURCE"]
export const TRANSCRIPT_DOCUMENT_KINDS = ["CALL_TRANSCRIPT", "AUDIO_TRANSCRIPT"]
const DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe"
const DEFAULT_TRANSCRIPTION_LANGUAGE = "et"
const DEFAULT_TRANSCRIPTION_MAX_FILE_SIZE_MB = 50

const AUDIO_EXTENSIONS = new Set([".aac", ".aiff", ".flac", ".m4a", ".mp3", ".mp4", ".mpeg", ".oga", ".ogg", ".opus", ".wav", ".webm"])
const EXTRA_AUDIO_MIMES = new Set([
  "application/ogg",
  "video/mp4",
  "video/webm"
])

function readBooleanEnv(value, fallback = false) {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (!normalized) return Boolean(fallback)
  return ["1", "true", "yes", "on"].includes(normalized)
}

export function getTranscriptionConfig(env = process.env) {
  const enabled = readBooleanEnv(env.TRANSCRIPTION_ENABLED, false)
  const provider = String(env.TRANSCRIPTION_PROVIDER || (enabled ? "openai" : "disabled"))
    .trim()
    .toLowerCase()
  const model = String(env.OPENAI_TRANSCRIPTION_MODEL || DEFAULT_TRANSCRIPTION_MODEL).trim()
  const language = String(env.TRANSCRIPTION_DEFAULT_LANGUAGE || DEFAULT_TRANSCRIPTION_LANGUAGE).trim().toLowerCase()
  const maxFileSizeMb = Number(env.TRANSCRIPTION_MAX_FILE_SIZE_MB || DEFAULT_TRANSCRIPTION_MAX_FILE_SIZE_MB)
  return {
    enabled,
    provider: ["mock", "openai", "disabled"].includes(provider) ? provider : "disabled",
    model,
    language,
    maxFileSizeMb: Number.isFinite(maxFileSizeMb) && maxFileSizeMb > 0 ? maxFileSizeMb : DEFAULT_TRANSCRIPTION_MAX_FILE_SIZE_MB,
    maxFileSizeBytes: Math.max(1, Math.floor((Number.isFinite(maxFileSizeMb) && maxFileSizeMb > 0 ? maxFileSizeMb : DEFAULT_TRANSCRIPTION_MAX_FILE_SIZE_MB) * 1024 * 1024))
  }
}

function getAudioExtension(fileName) {
  const match = String(fileName || "").toLowerCase().match(/\.[a-z0-9]{1,8}$/)
  return match ? match[0] : ""
}

function isSupportedAudioMime(mime) {
  const normalized = String(mime || "").trim().toLowerCase()
  return normalized.startsWith("audio/") || EXTRA_AUDIO_MIMES.has(normalized)
}

export function isSupportedAudioFile(file) {
  const mimeOk = isSupportedAudioMime(file?.type)
  const extOk = AUDIO_EXTENSIONS.has(getAudioExtension(file?.name))
  return mimeOk && extOk
}

export function ensureAllowedAudioUpload(file, env = process.env) {
  if (!file || typeof file === "string") {
    const error = new Error("documents.errors.audio_file_required")
    error.status = 400
    throw error
  }

  const config = getTranscriptionConfig(env)
  const fileSize = Number(file.size || 0)
  if (fileSize > config.maxFileSizeBytes) {
    const error = new Error("documents.errors.audio_file_too_large")
    error.status = 413
    error.maxFileSizeMb = config.maxFileSizeMb
    throw error
  }

  if (!isSupportedAudioFile(file)) {
    const error = new Error("documents.errors.audio_mime_not_allowed")
    error.status = 415
    throw error
  }

  return String(file.type || "audio/webm").trim().toLowerCase()
}

export function assertAudioSignature(buffer, mime, fileName = "") {
  const ext = getAudioExtension(fileName)
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || [])
  if (!bytes.length) {
    const error = new Error("documents.errors.audio_file_required")
    error.status = 400
    throw error
  }

  const header4 = bytes.subarray(0, 4)
  const header12 = bytes.subarray(0, 12).toString("latin1")
  const isOgg = header4.toString("latin1") === "OggS"
  const isWebm = header4.equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
  const isWav = header12.startsWith("RIFF") && header12.includes("WAVE")
  const isAiff = header12.startsWith("FORM") && header12.includes("AIFF")
  const isFlac = header4.toString("latin1") === "fLaC"
  const isMp4 = bytes.length >= 12 && bytes.subarray(4, 8).toString("latin1") === "ftyp"
  const isMp3 = bytes.subarray(0, 3).toString("latin1") === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  const isAac = bytes[0] === 0xff && (bytes[1] === 0xf1 || bytes[1] === 0xf9)
  const isKnown = isOgg || isWebm || isWav || isAiff || isFlac || isMp4 || isMp3 || isAac

  if (!isKnown && (String(mime || "").includes("mpeg") || ext === ".mp3")) {
    return
  }

  if (!isKnown) {
    const error = new Error("documents.errors.audio_signature_invalid")
    error.status = 415
    throw error
  }
}

export function buildTranscriptTitle(now = new Date(), locale = "et") {
  let dateLabel = ""
  try {
    dateLabel = new Intl.DateTimeFormat(locale || "et").format(now)
  } catch {
    dateLabel = now.toISOString().slice(0, 10)
  }
  return `Helifaili transkript - ${dateLabel}`
}

export function transcriptKindForAudioSource(kind) {
  return kind === "CALL_AUDIO_RECORDING" ? "CALL_TRANSCRIPT" : "AUDIO_TRANSCRIPT"
}

export function buildTranscriptSummaryTitle(now = new Date(), locale = "et") {
  let dateLabel = ""
  try {
    dateLabel = new Intl.DateTimeFormat(locale || "et").format(now)
  } catch {
    dateLabel = now.toISOString().slice(0, 10)
  }
  return `Transkripti kokkuvõte - ${dateLabel}`
}

export function buildTranscriptFileName(now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, "-")
  return `audio-transcript-${stamp}.txt`
}

export function serializeAudioSourceDocument(document) {
  const transcript = document?.derivedDocuments?.[0] || null
  const callRecordingFile = document?.callRecordingFiles?.[0] || null
  const recordingRequest = callRecordingFile?.recordingRequest || null
  return {
    id: document.id,
    title: document.title,
    originalName: document.originalName,
    kind: document.kind,
    mime: document.mime,
    size: document.size,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    callRecording: callRecordingFile
      ? {
          callSessionId: callRecordingFile.callSessionId,
          recordingRequestId: callRecordingFile.recordingRequestId,
          purpose: recordingRequest?.purpose || null,
          purposeText: recordingRequest?.purposeText || null,
          durationSeconds: callRecordingFile.durationSeconds || null,
          callStartedAt: recordingRequest?.callSession?.startedAt || null,
          callEndedAt: recordingRequest?.callSession?.endedAt || null,
          retentionUntil: callRecordingFile.retentionUntil || null
        }
      : null,
    transcript: transcript
      ? {
          id: transcript.id,
          title: transcript.title,
          kind: transcript.kind,
          sourceDocumentId: transcript.sourceDocumentId || document.id,
          createdAt: transcript.createdAt,
          updatedAt: transcript.updatedAt,
          preview: String(transcript.content || "").slice(0, 1200)
        }
      : null
  }
}
